import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = `"NexusGaming" <${process.env.SMTP_USER || 'noreply@nexusgaming.com'}>`
const SITE_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

const baseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NexusGaming</title>
</head>
<body style="margin:0;padding:0;background:#030712;font-family:Inter,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#00D4FF,#7B2FFF);padding:12px 24px;border-radius:12px;">
        <span style="color:#fff;font-family:monospace;font-weight:900;font-size:20px;letter-spacing:4px;">⚡ NEXUSGAMING</span>
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(0,212,255,0.15);border-radius:16px;padding:32px;">
      ${content}
    </div>
    <div style="text-align:center;margin-top:24px;color:#475569;font-size:12px;">
      <p>© ${new Date().getFullYear()} NexusGaming. All rights reserved.</p>
      <p>You received this email because you have an account at NexusGaming.</p>
    </div>
  </div>
</body>
</html>
`

export const sendVerificationEmail = async (email: string, username: string, token: string) => {
  const verifyUrl = `${SITE_URL}/verify-email/${token}`

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '⚡ Verify Your NexusGaming Account',
    html: baseTemplate(`
      <h2 style="color:#fff;font-family:monospace;font-size:24px;margin:0 0 8px;">VERIFY YOUR EMAIL</h2>
      <p style="color:#94a3b8;font-size:15px;margin:0 0 24px;">Hi ${username}! One last step to activate your account.</p>
      <a href="${verifyUrl}" style="display:block;background:linear-gradient(135deg,#00D4FF,#7B2FFF);color:#fff;text-align:center;padding:14px 32px;border-radius:8px;text-decoration:none;font-family:monospace;font-weight:700;font-size:14px;letter-spacing:2px;margin-bottom:24px;">VERIFY EMAIL →</a>
      <p style="color:#475569;font-size:12px;text-align:center;">Link expires in 24 hours. If you didn't create this account, ignore this email.</p>
    `)
  })
}

export const sendPasswordResetEmail = async (email: string, username: string, token: string) => {
  const resetUrl = `${SITE_URL}/reset-password/${token}`

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '🔐 Reset Your NexusGaming Password',
    html: baseTemplate(`
      <h2 style="color:#fff;font-family:monospace;font-size:24px;margin:0 0 8px;">RESET PASSWORD</h2>
      <p style="color:#94a3b8;font-size:15px;margin:0 0 24px;">Hi ${username}, click below to reset your password.</p>
      <a href="${resetUrl}" style="display:block;background:linear-gradient(135deg,#7B2FFF,#FF2D9B);color:#fff;text-align:center;padding:14px 32px;border-radius:8px;text-decoration:none;font-family:monospace;font-weight:700;font-size:14px;letter-spacing:2px;margin-bottom:24px;">RESET PASSWORD →</a>
      <p style="color:#475569;font-size:12px;text-align:center;">Link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `)
  })
}

export const sendWelcomeEmail = async (email: string, username: string) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '🎮 Welcome to NexusGaming!',
    html: baseTemplate(`
      <h2 style="color:#00D4FF;font-family:monospace;font-size:28px;margin:0 0 8px;text-align:center;">WELCOME TO THE NEXUS!</h2>
      <p style="color:#94a3b8;font-size:15px;margin:0 0 24px;text-align:center;">Hey ${username}! Your account is verified and ready to go.</p>
      <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.15);border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#e2e8f0;font-size:14px;margin:0 0 12px;font-weight:600;">Get started:</p>
        <p style="color:#94a3b8;font-size:13px;margin:4px 0;">• Make your first deposit and claim your 500% Welcome Bonus</p>
        <p style="color:#94a3b8;font-size:13px;margin:4px 0;">• Browse 500+ games in our library</p>
        <p style="color:#94a3b8;font-size:13px;margin:4px 0;">• Join our Telegram community for daily bonuses</p>
      </div>
      <a href="${SITE_URL}/dashboard" style="display:block;background:linear-gradient(135deg,#00D4FF,#7B2FFF);color:#fff;text-align:center;padding:14px 32px;border-radius:8px;text-decoration:none;font-family:monospace;font-weight:700;font-size:14px;letter-spacing:2px;">GO TO DASHBOARD →</a>
    `)
  })
}

export const sendDepositNotification = async (email: string, username: string, amount: number, status: string) => {
  const isApproved = status === 'approved'
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: isApproved ? '✅ Deposit Approved!' : '❌ Deposit Rejected',
    html: baseTemplate(`
      <h2 style="color:${isApproved ? '#00FF88' : '#FF4444'};font-family:monospace;font-size:24px;margin:0 0 8px;">
        DEPOSIT ${isApproved ? 'APPROVED' : 'REJECTED'}
      </h2>
      <p style="color:#94a3b8;font-size:15px;margin:0 0 24px;">Hi ${username}!</p>
      <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="color:#64748b;font-size:12px;margin:0 0 4px;">AMOUNT</p>
        <p style="color:#00D4FF;font-family:monospace;font-size:28px;font-weight:900;margin:0;">$${amount}</p>
      </div>
      ${isApproved
        ? '<p style="color:#94a3b8;font-size:14px;">Your deposit has been approved and is ready to use.</p>'
        : '<p style="color:#94a3b8;font-size:14px;">Your deposit was rejected. Please contact support for assistance.</p>'
      }
    `)
  })
}
