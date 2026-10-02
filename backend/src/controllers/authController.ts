import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { generateToken, evictAuthCache } from '../middleware/auth'
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../services/emailService'
import { AuthRequest } from '../middleware/auth'
import { securityLog, bumpFailure, getFailures, clearFailures } from '../middleware/security'
import { escapeLike } from '../utils/safe'
import { setSessionCookies, clearSessionCookies } from '../utils/authCookies'
import { ProviderFactory } from '../services/provider/ProviderFactory'
import { WalletService } from '../services/WalletService'
import { BonusService } from '../services/BonusService'
import { revokeTokensIssuedBefore, markEmailVerifyTokenIssued, isEmailVerifyTokenValid, clearEmailVerifyToken, createTelegramLinkToken } from '../lib/redis'
import { auth } from '../lib/firebaseAdmin'
import { createNotification } from '../services/notificationService'


const LOGIN_MAX_FAILS = 30
const LOGIN_FAIL_WINDOW_SEC = 15 * 60

// POST /api/auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body
  // Untyped JSON: anything but a plain string must never reach a query (Prisma would treat an object as an operator)
  const referralCode = typeof req.body.referralCode === 'string' ? req.body.referralCode.trim().slice(0, 40) : ''
  const couponCode = typeof req.body.couponCode === 'string' ? req.body.couponCode.trim().slice(0, 60) : ''

  // Check existing — username uniqueness is case-insensitive (login matches case-insensitively, so "Admin" and "admin"
  // would otherwise be two accounts one of which can never be logged in to unambiguously)
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: { equals: escapeLike(username), mode: 'insensitive' } }] }
  })
  if (existing) {
    if (existing.email === email) throw new AppError('Email already registered', 409)
    throw new AppError('Username already taken', 409)
  }

  // Check coupon before creating user
  let coupon = null
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode } })
    if (!coupon) throw new AppError('Invalid coupon code', 400)
    if (!coupon.isActive) throw new AppError('Coupon code is inactive', 400)
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError('Coupon code has expired', 400)
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw new AppError('Coupon code usage limit reached', 400)
  }
  const claimCoupon = async (c: NonNullable<typeof coupon>, userId: string) => {
    // The check above is only a fast path: the counter itself is claimed atomically so concurrent sign-ups cannot exceed the limit
    const claimed = await prisma.coupon.updateMany({
      where: c.usageLimit !== null ? { id: c.id, usedCount: { lt: c.usageLimit } } : { id: c.id },
      data: { usedCount: { increment: 1 } }
    })
    if (claimed.count !== 1) return false
    await prisma.couponUsage.create({ data: { couponId: c.id, userId } })
    return true
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const verifyToken = crypto.randomBytes(32).toString('hex')

  let referredById = null
  if (referralCode) {
    const referrer = await prisma.user.findFirst({
      where: {
        OR: [
          { referralCode: { equals: escapeLike(referralCode), mode: 'insensitive' } },
          { promoCode: { equals: escapeLike(referralCode), mode: 'insensitive' } }
        ]
      }
    })
    if (referrer) {
      referredById = referrer.id
    }
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      verifyToken,
      referredById,
      profile: { 
        create: {
          telegramUsername: typeof req.body.telegramUsername === 'string' && /^@?[A-Za-z0-9_]{3,32}$/.test(req.body.telegramUsername.trim())
            ? `@${req.body.telegramUsername.trim().replace(/^@/, '')}`
            : null
        } 
      }
    },
    select: { id: true, username: true, email: true, role: true, isVerified: true, createdAt: true }
  })

  // Process coupon if present
  if (coupon && (await claimCoupon(coupon, user.id))) {

    // Find or create freeplay bonus definition
    let freeplayBonus = await prisma.bonus.findFirst({ where: { type: 'freeplay' } })
    if (!freeplayBonus) {
      freeplayBonus = await prisma.bonus.create({
        data: {
          title: 'Freeplay Coupon Bonus',
          description: 'Bonus granted from freeplay coupon',
          type: 'freeplay',
          requirements: 'None',
          terms: 'Cannot be cashed out directly.'
        }
      })
    }

    await prisma.bonusClaim.create({
      data: {
        userId: user.id,
        bonusId: freeplayBonus.id,
        amount: coupon.amount
      }
    })
  }

  // Records the signup IP so a later referral reward can compare it against the referrer's — see
  // ReferralService.assessAbuseSignals. TRUST_PROXY-aware via req.ip, same as every other IP-based check.
  prisma.activityLog.create({
    data: { userId: user.id, action: 'register', ip: req.ip, userAgent: req.headers['user-agent'] }
  }).catch(e => console.error('Activity log error:', e))

  // Send verification email asynchronously so it doesn't block registration
  markEmailVerifyTokenIssued(verifyToken).catch(() => {})
  sendVerificationEmail(email, username, verifyToken).catch((e) => {
    console.error('Email send error:', e)
  })

  // Auto-create provider account (async)
  ;(async () => {
    try {
      const providerService = await ProviderFactory.getActiveProvider()
      if (providerService) {
        let newProviderData = null;
        let attempts = 0;
        let currentUsername = username;

        while (!newProviderData && attempts < 5) {
          attempts++;
          try {
            newProviderData = await providerService.createPlayer(currentUsername, password);
          } catch (err: any) {
            if (err?.message?.includes('Username Already Exists') || err?.message?.includes('Username already exists')) {
              // Generate new username
              const suffix = Math.floor(Math.random() * 9000) + 1000;
              currentUsername = `${username.substring(0, 10)}_${suffix}`;
            } else {
              console.error('Provider player creation failed for user', user.id, err);
              break; // Break on other errors
            }
          }
        }

        if (newProviderData) {
          await prisma.providerUser.create({
            data: {
              userId: user.id,
              providerId: providerService.getProviderId(),
              providerUserId: newProviderData.userId,
              accountName: newProviderData.accountName
            }
          });
        }
      }
    } catch (e) {
      console.error('Provider fetch error:', e)
    }
  })();

  res.status(201).json({
    success: true,
    message: 'Account created! Please check your email to verify your account.',
    data: user
  })
})

// POST /api/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (typeof email !== 'string' || typeof password !== 'string') throw new AppError('Invalid credentials', 401)
  const identifier = email.trim()

  // Look up by email OR username (case-insensitive for username)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: { equals: escapeLike(identifier), mode: 'insensitive' } }
      ]
    },
    include: { profile: true }
  })

  if (!user) {
    // Run a dummy hash comparison so a non-existent account doesn't return
    // measurably faster than a wrong-password attempt on a real account —
    // otherwise response timing alone leaks whether an email/username exists.
    await bcrypt.compare(password, '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1TOTf9k6dQ1jJ0m5x8n9c5x8n9c5')
    securityLog('login_failed', req, { reason: 'unknown_account' })
    throw new AppError('Invalid credentials', 401)
  }
  // Per-ACCOUNT throttle, independent of IP and of whether the e-mail or the username was typed
  const failKey = `login:${user.id}`
  const throttled = (await getFailures(failKey)) >= LOGIN_MAX_FAILS

  const isMatch = await bcrypt.compare(password, user.password)
  if (throttled) {
    // The account is under a guessing attack. Never let a *guess* succeed, but do not lock the real owner out either:
    // a correct password is accepted only from an address that already logged in to this account successfully before.
    const knownIp = isMatch && req.ip ? await prisma.activityLog.findFirst({ where: { userId: user.id, action: 'login', ip: req.ip }, select: { id: true } }) : null
    if (!knownIp) {
      securityLog('login_account_throttled', req, { targetUserId: user.id, targetRole: user.role })
      throw new AppError('Too many failed login attempts. Please wait a few minutes and try again.', 429)
    }
  }
  if (!isMatch) {
    const n = await bumpFailure(failKey, LOGIN_FAIL_WINDOW_SEC)
    securityLog('login_failed', req, { reason: 'bad_password', targetUserId: user.id, targetRole: user.role, failures: n })
    throw new AppError('Invalid credentials', 401)
  }
  // Account state is revealed only to someone who proved they know the password
  if (!user.isActive) throw new AppError('Account is suspended. Contact support.', 403)
  if (user.isBanned) throw new AppError('Account has been banned.', 403)
  clearFailures(failKey).catch(() => {})
  if (user.role === 'admin') securityLog('admin_login', req, { adminId: user.id })

  // Update last login (async)
  prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() }
  }).catch(e => console.error('Last login update error:', e))

  // Log activity (async)
  prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'login',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }
  }).catch(e => console.error('Activity log error:', e))

  // Admin sessions are short-lived: a stolen admin token is the highest-impact credential in the system
  const isAdmin = user.role === 'admin'
  const maxAgeMs = isAdmin ? 12 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
  const token = generateToken({ id: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion }, isAdmin ? '12h' : '7d')

  // Primary path: an HttpOnly cookie the frontend never reads directly, plus a separate, deliberately
  // JS-readable CSRF cookie (double-submit pattern — see middleware/csrf.ts). `token` is still returned in
  // the body too: browsers where the cross-origin cookie doesn't land (Safari/ITP) fall back to sending it
  // as an Authorization header exactly as before — see frontend/src/lib/api.ts.
  const csrfToken = setSessionCookies(res, token, maxAgeMs)

  const { password: _, verifyToken, resetToken, resetExpiry, ...safeUser } = user

  res.json({
    success: true,
    message: 'Login successful',
    data: { user: safeUser, token, csrfToken }
  })
})

// GET /api/auth/me
export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, username: true, email: true, role: true,
      isVerified: true, isActive: true, isBanned: true,
      lastLogin: true, createdAt: true, profile: true
    }
  })

  if (!user) throw new AppError('User not found', 404)
  const telegramLinkToken = await createTelegramLinkToken(user.id)
  res.json({ success: true, data: { ...user, telegramLinkToken } })
})

// POST /api/auth/verify-email/:token
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params

  const user = await prisma.user.findFirst({ where: { verifyToken: token as string } })
  if (!user) throw new AppError('Invalid or expired verification link', 400)
  if (!(await isEmailVerifyTokenValid(token as string))) {
    throw new AppError('Invalid or expired verification link', 400)
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, verifyToken: null },
    select: { isPhoneVerified: true }
  })
  clearEmailVerifyToken(token as string).catch(() => {})

  try { await sendWelcomeEmail(user.email, user.username) } catch {}

  // If both email and phone are now verified, notify the user they unlocked the 100% welcome bonus
  if (updatedUser.isPhoneVerified) {
    createNotification(user.id, {
      title: '🎁 Welcome Bonus Unlocked!',
      message: 'You have verified both your email and phone number! Make your first deposit to automatically receive a 100% welcome bonus on your game balance.',
      type: 'success',
      link: '/games'
    }).catch(console.error);
  }

  res.json({ success: true, message: 'Email verified successfully! You can now login.' })
})

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body

  const GENERIC = { success: true, message: 'If that email is registered, you will receive reset instructions.' }
  if (typeof email !== 'string') return res.json(GENERIC)

  const user = await prisma.user.findFirst({ where: { email: { equals: escapeLike(email.trim()), mode: 'insensitive' } } })
  // Same response whether or not the account exists (and whether or not the mail could be sent)
  if (!user) return res.json(GENERIC)

  // Re-send a still-valid token instead of rotating it: rotating let anyone who knows the address invalidate the
  // link in the owner's earlier mail just by submitting the form again.
  const reusable = !!user.resetToken && !!user.resetExpiry && user.resetExpiry.getTime() > Date.now() + 5 * 60 * 1000
  const resetToken = reusable ? user.resetToken! : crypto.randomBytes(32).toString('hex')
  const resetExpiry = reusable ? user.resetExpiry! : new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  if (!reusable) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetExpiry }
    })
  }

  // Not awaited: the time SMTP takes must not tell an attacker the address exists
  sendPasswordResetEmail(user.email, user.username, resetToken).catch((e) => console.error('Reset email send error:', e?.message))

  res.json(GENERIC)
})

// POST /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params
  const { password } = req.body

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token as string,
      resetExpiry: { gt: new Date() }
    }
  })

  if (!user) throw new AppError('Invalid or expired reset link', 400)

  const hashedPassword = await bcrypt.hash(password, 12)

  // A password reset must invalidate any JWTs issued before this moment — otherwise a token stolen prior to
  // the reset keeps working for its full remaining lifetime even after the user has "secured" their account.
  // tokenVersion is bumped in the SAME write as the password change, so this guarantee holds as long as this
  // DB call succeeds (which the reset already requires) — it does not depend on Redis being reachable.
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, resetToken: null, resetExpiry: null, tokenVersion: { increment: 1 } }
  })
  evictAuthCache(user.id)

  // Fast-path only, see revokeTokensIssuedBefore's doc comment — the durable guarantee is the tokenVersion
  // bump above, which just happened regardless of this call's outcome.
  const revoked = await revokeTokensIssuedBefore(user.id)
  if (!revoked) securityLog('token_revocation_fast_path_failed', req, { userId: user.id, action: 'password_reset' })

  // Sync password with provider (async)
  try {
    const providerUser = await prisma.providerUser.findFirst({ where: { userId: user.id } })
    if (providerUser) {
      const providerService = await ProviderFactory.getProviderById(providerUser.providerId)
      if (providerService) {
        providerService.resetPlayerPassword(providerUser.providerUserId, password).catch(err => {
          console.error('Provider password sync failed for user', user.id, err)
        })
      }
    }
  } catch (e) {
    console.error('Provider password sync error:', e)
  }

  res.json({ success: true, message: 'Password reset successfully. You can now login.' })
})

// POST /api/auth/logout
export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user?.id) {
    // Durable revocation: bump the DB tokenVersion in the same write every time, so logout is fully
    // effective even if Redis is down, unreachable, or was never configured — see middleware/auth.ts.
    await prisma.user.update({ where: { id: req.user.id }, data: { tokenVersion: { increment: 1 } } })
    evictAuthCache(req.user.id)

    // Fast-path only (see revokeTokensIssuedBefore's doc comment): failure here does not weaken the
    // revocation above, but it does mean the 30s in-process auth cache on OTHER instances could still
    // accept the old token briefly, so it's worth a security log line.
    const revoked = await revokeTokensIssuedBefore(req.user.id)
    if (!revoked) securityLog('token_revocation_fast_path_failed', req, { userId: req.user.id, action: 'logout' })

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'logout', ip: req.ip }
    }).catch(() => {})
  }
  clearSessionCookies(res)
  res.json({ success: true, message: 'Logged out successfully' })
})

// GET /api/auth/balance
export const getBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [balances, bonusBalance] = await Promise.all([
    WalletService.getBalances(req.user!.id),
    BonusService.getBonusBalance(req.user!.id),
  ]);
  res.json({
    success: true,
    data: {
      // `balance`/`withdrawable` kept exactly as before for backward compatibility with existing consumers.
      balance: balances.displayBalance,
      withdrawable: balances.withdrawableBalance,
      walletBalance: balances.displayBalance,
      bonusBalance,
    },
  });
})

// GET /api/auth/dashboard-init?gameId=xxx
// Bundles user + wallet balance + provider account into a single request to reduce waterfall
export const dashboardInit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const gameId = req.query.gameId as string | undefined

  const [userRes, balanceRes, bonusBalanceRes, providerUserRes] = await Promise.allSettled([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, role: true, isVerified: true, isActive: true, isBanned: true, lastLogin: true, createdAt: true, profile: true }
    }),
    WalletService.getWalletBalance(userId),
    BonusService.getBonusBalance(userId),
    gameId
      ? (async () => {
          const providerId = await ProviderFactory.getProviderIdForGame(gameId)
          if (!providerId) return { isMaintenance: true }
          return prisma.providerUser.findFirst({ where: { userId, providerId }, include: { provider: true } })
        })()
      : Promise.resolve(null)
  ])

  const user = userRes.status === 'fulfilled' ? userRes.value : null
  const balance = balanceRes.status === 'fulfilled' ? balanceRes.value : 0
  const bonusBalance = bonusBalanceRes.status === 'fulfilled' ? bonusBalanceRes.value : 0
  const providerUser = providerUserRes.status === 'fulfilled' ? providerUserRes.value : null
  const telegramLinkToken = user ? await createTelegramLinkToken(user.id) : null

  res.json({
    success: true,
    data: {
      user: user ? { ...user, telegramLinkToken } : user,
      balance,
      bonusBalance,
      providerAccount: providerUser
        ? (providerUser as any).isMaintenance
          ? { isMaintenance: true, hasAccount: false }
          : { accountName: (providerUser as any).accountName, hasAccount: true, providerName: (providerUser as any).provider?.name || '' }
        : { hasAccount: false }
    }
  })
})

// GET /api/auth/check-username?username=xxx  (public — no auth needed)
export const checkUsername = asyncHandler(async (req: Request, res: Response) => {
  const username = (req.query.username as string || '').trim()

  // Format check first
  if (!username || username.length < 3 || username.length > 20) {
    return res.json({ available: false, reason: 'Username must be 3–20 characters.' })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.json({ available: false, reason: 'Only letters, numbers, and underscores allowed.' })
  }

  // Check our DB
  const existing = await prisma.user.findFirst({ where: { username: { equals: escapeLike(username), mode: 'insensitive' } } })
  if (existing) {
    return res.json({ available: false, reason: 'Username already taken on this platform.' })
  }

  // Check game provider (async — best effort; if it fails we still allow registration)
  try {
    const providerService = await ProviderFactory.getActiveProvider()
    if (providerService) {
      await providerService.getPlayerIdByUsername(username)
      // If no error was thrown, the username exists in the game
      return res.json({ available: false, reason: 'Username already registered in the game. Please choose another.' })
    }
  } catch (err: any) {
    // A "User not found" type error from the provider means the username IS free
    const msg = (err?.message || '').toLowerCase()
    const isFreeSignal = msg.includes('not found') || msg.includes('invalid') || msg.includes('user id') || msg.includes('8') // error code 8 = invalid user id
    if (!isFreeSignal) {
      // Provider call failed for unknown reason — allow the registration and let it fail at create time
      console.warn('[checkUsername] Provider check failed non-fatally:', err?.message)
    }
  }

  return res.json({ available: true })
})

// POST /api/auth/check-phone
export const checkPhone = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone } = req.body;
  const userId = req.user!.id;

  if (!phone) {
    throw new AppError('Phone number is required', 400);
  }

  const formattedPhone = phone.startsWith('+') ? phone : '+' + phone;

  // Check if phone number is already used by another account
  const existingProfile = await prisma.userProfile.findFirst({
    where: { phone: formattedPhone, userId: { not: userId } }
  });

  if (existingProfile) {
    throw new AppError('This phone number is already verified on another account.', 400);
  }

  res.json({ success: true, message: 'Phone number is available' });
});

// POST /api/auth/verify-otp
export const verifyPhoneOTP = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { idToken } = req.body;
  const userId = req.user!.id;

  if (!idToken || typeof idToken !== 'string') {
    throw new AppError('Firebase ID token is required', 400);
  }

  {
    let decodedToken: any;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error: any) {
      console.error('[Firebase Admin] Error verifying ID token:', error?.code || error?.message);
      throw new AppError('Invalid or expired Firebase ID token', 400);
    }
    const phoneNumber = decodedToken.phone_number;

    if (!phoneNumber) {
      throw new AppError('No phone number found in Firebase token', 400);
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;

    // Check if phone number is already used by another account
    const existingProfile = await prisma.userProfile.findFirst({
      where: { phone: formattedPhone, userId: { not: userId } }
    });

    if (existingProfile) {
      throw new AppError('This phone number is already verified on another account.', 400);
    }

    // Save phone number to user profile
    await prisma.userProfile.upsert({
      where: { userId },
      update: { phone: formattedPhone },
      create: { userId, phone: formattedPhone }
    });

    // Mark phone as verified
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isPhoneVerified: true },
      select: { isVerified: true }
    });

    // Notify user of phone verification
    await createNotification(userId, {
      title: '📱 Phone Number Verified!',
      message: `Your phone number ${formattedPhone} has been successfully verified.`,
      type: 'success',
    });

    // If both email and phone are now verified, notify the user they unlocked the 100% welcome bonus
    if (updatedUser.isVerified) {
      await createNotification(userId, {
        title: '🎁 Welcome Bonus Unlocked!',
        message: 'You have verified both your email and phone number! Make your first deposit to automatically receive a 100% welcome bonus on your game balance.',
        type: 'success',
        link: '/games'
      });
    }

    res.json({ success: true, message: 'Phone number verified successfully' });
  }
});
