import imaps from 'imap-simple'
import { simpleParser } from 'mailparser'
import cron from 'node-cron'
import prisma from '../../lib/prisma'
import { logger } from '../../utils/logger'
import { invalidateWalletCache } from '../WalletService'

// ─── Helpers ────────────────────────────────────────────────────────────────
function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Returns true when names overlap sufficiently (case-insensitive, partial token match) */
function namesMatch(emailName: string, profileName: string): boolean {
  const a = normalize(emailName)
  const b = normalize(profileName)
  if (!a || !b) return false

  // Exact match
  if (a === b) return true
  // One contains the other
  if (a.includes(b) || b.includes(a)) return true

  // At least one word token matches (handles "Chad M." vs "Chad")
  const tokensA = a.split(' ')
  const tokensB = b.split(' ')
  const commonTokens = tokensA.filter(t => t.length > 1 && tokensB.includes(t))
  return commonTokens.length >= 1
}

// ─── Service ────────────────────────────────────────────────────────────────
export class ImapChimePayPalService {
  static isRunning = false

  static async connect() {
    const config = {
      imap: {
        user: 'luisfeliciano7812@gmail.com',
        password: 'qezdijyvlvowehim',
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
      }
    }

    try {
      return await imaps.connect(config)
    } catch (err) {
      logger.error('[ImapChimePayPal] Connection error: ' + err)
      return null
    }
  }

  /**
   * Parse unseen emails and auto-approve any matching pending deposit.
   * Returns number of deposits approved.
   */
  static async parseEmailsAndVerifyDeposits(): Promise<number> {
    if (this.isRunning) return 0
    this.isRunning = true
    let approved = 0

    const connection = await this.connect()
    if (!connection) {
      this.isRunning = false
      return 0
    }

    try {
      await connection.openBox('INBOX')

      const since = new Date(Date.now() - 24 * 3600 * 1000)
      const messages = await connection.search(
        [['SINCE', since]],
        { bodies: ['HEADER', 'TEXT', ''], markSeen: false }
      )

      for (const item of messages) {
        try {
          const rawPart =
            item.parts.find(p => p.which === '') ||
            item.parts.find(p => p.which === 'TEXT')
          const headerPart = item.parts.find(p => p.which === 'HEADER')

          if (!rawPart) continue

          const mail = await simpleParser(rawPart.body)
          const text  = (mail.text  || '').replace(/\s+/g, ' ')
          const html  = (mail.html  || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
          const fullBody = `${text} ${html}`
          
          // Generate a unique ID for this email to prevent double-processing
          const emailId = mail.messageId || `msg_${item.attributes.uid}_${item.attributes.date?.getTime() || Date.now()}`

          let subject = ''
          if (headerPart?.body?.subject) {
            subject = Array.isArray(headerPart.body.subject)
              ? headerPart.body.subject[0]
              : headerPart.body.subject
          }

          const combined = `${subject} ${fullBody}`.toLowerCase()

          let amount: number | null = null
          let senderName: string | null = null
          let paymentMethod: 'chime' | 'paypal' | null = null

          // ── Chime patterns ──────────────────────────────────────────────
          if (combined.includes('chime')) {
            paymentMethod = 'chime'

            const rxRecv = fullBody.match(/you just received\s+\$?([\d,.]+)\s+from\s+([^.!?\n]+)/i)
            const rxSent = fullBody.match(/([A-Za-z .']+?)\s+just sent you\s+\$?([\d,.]+)/i)
            const rxSubj = subject.match(/([A-Za-z .']+?)\s+just sent you money/i)
            const rxAmt  = fullBody.match(/\$([\d,.]+)/)

            if (rxRecv) {
              amount     = parseFloat(rxRecv[1].replace(',', ''))
              senderName = rxRecv[2].split(/\s+for\s+/i)[0].trim()
            } else if (rxSent) {
              senderName = rxSent[1].trim()
              amount     = parseFloat(rxSent[2].replace(',', ''))
            } else if (rxSubj) {
              senderName = rxSubj[1].trim()
              if (rxAmt) amount = parseFloat(rxAmt[1].replace(',', ''))
            } else if (rxAmt) {
              amount = parseFloat(rxAmt[1].replace(',', ''))
            }
          }

          // ── PayPal patterns ─────────────────────────────────────────────
          else if (combined.includes('paypal')) {
            paymentMethod = 'paypal'

            const rxFrom  = fullBody.match(/(?:money from|received from|payment from)\s+([A-Za-z .']+?)(?:\s+[\$\d]|[,.]|$)/i)
            const rxSent2 = fullBody.match(/([A-Za-z .']+?)\s+sent you\s+\$?([\d,.]+)/i)
            const rxAmt   = fullBody.match(/\$([\d,.]+)/)
            const rxSubj  = subject.match(/(?:money from|from)\s+([A-Za-z .']+)/i)

            if (rxFrom) {
              senderName = rxFrom[1].trim()
              if (rxAmt) amount = parseFloat(rxAmt[1].replace(',', ''))
            } else if (rxSent2) {
              senderName = rxSent2[1].trim()
              amount     = parseFloat(rxSent2[2].replace(',', ''))
            } else if (rxSubj) {
              senderName = rxSubj[1].trim()
              if (rxAmt) amount = parseFloat(rxAmt[1].replace(',', ''))
            }
          }

          if (!amount || !senderName || !paymentMethod) continue

          // Check if we already processed this exact email
          const alreadyProcessed = await prisma.deposit.findFirst({
            where: { transactionId: emailId }
          })
          if (alreadyProcessed) continue

          logger.info(`[ImapChimePayPal] Email detected — method:${paymentMethod} sender:"${senderName}" amount:$${amount}`)

          // ── Find matching pending deposit ────────────────────────────────
          const pending = await prisma.deposit.findMany({
            where: {
              status: 'pending',
              paymentMethod: { code: paymentMethod }
            },
            include: { user: true, paymentMethod: true }
          })

          const match = pending.find(d => {
            const profile = (d.notes || '').trim()
            return (
              Math.abs(d.amount - amount!) < 0.01 &&
              namesMatch(senderName!, profile)
            )
          })

          if (!match) {
            logger.info(`[ImapChimePayPal] No match for sender:"${senderName}" amount:$${amount}`)
            continue
          }

          logger.info(`[ImapChimePayPal] ✅ Matched deposit ${match.id} — approving`)

          // Mark email seen (best effort)
          await connection.addFlags(item.attributes.uid, ['\\Seen']).catch(() => {})

          // Approve deposit and save emailId to transactionId to prevent double processing
          await prisma.deposit.update({
            where: { id: match.id },
            data: { 
              status: 'approved', 
              approvedAt: new Date(), 
              approvedBy: 'system_imap',
              transactionId: emailId
            }
          })

          // Invalidate wallet cache (balance is computed from approved deposits)
          invalidateWalletCache(match.userId)

          // Transaction log
          await prisma.transactionLog.create({
            data: {
              type: 'deposit_approved',
              entityId: match.id,
              userId: match.userId,
              amount: match.amount,
              status: 'approved',
              metadata: { source: 'imap_auto_verify', method: paymentMethod, sender: senderName }
            }
          })

          approved++
        } catch (emailErr) {
          logger.error('[ImapChimePayPal] Error processing email: ' + emailErr)
        }
      }
    } catch (err) {
      logger.error('[ImapChimePayPal] Process error: ' + err)
    } finally {
      try { connection.end() } catch {}
      this.isRunning = false
    }

    return approved
  }

  /**
   * Poll IMAP for `durationMs` milliseconds (checking every `intervalMs`).
   * Returns true if the deposit was auto-approved, false otherwise.
   */
  static async pollForDeposit(depositId: string, durationMs = 30000, intervalMs = 5000): Promise<boolean> {
    const deadline = Date.now() + durationMs
    while (Date.now() < deadline) {
      await this.parseEmailsAndVerifyDeposits()
      const d = await prisma.deposit.findUnique({ where: { id: depositId } })
      if (d?.status === 'approved') {
        logger.info(`[ImapChimePayPal] Deposit ${depositId} auto-approved within polling window`)
        return true
      }
      await new Promise(r => setTimeout(r, intervalMs))
    }
    return false
  }

  static async failExpiredDeposits() {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const expired = await prisma.deposit.findMany({
        where: {
          status: 'pending',
          paymentMethod: { code: { in: ['chime', 'paypal'] } },
          createdAt: { lt: twoHoursAgo }
        }
      })

      for (const d of expired) {
        await prisma.deposit.update({
          where: { id: d.id },
          data: {
            status: 'failed',
            notes: (d.notes || '') + '\nFailed automatically: no payment received within 2h'
          }
        })
      }
    } catch (err) {
      logger.error('[ImapChimePayPal] failExpiredDeposits error: ' + err)
    }
  }

  static startCron() {
    logger.info('[ImapChimePayPal] Starting IMAP cron jobs')
    cron.schedule('*/2 * * * *', () => {
      this.parseEmailsAndVerifyDeposits().catch(err =>
        logger.error('[ImapChimePayPal] cron error: ' + err)
      )
    })
    cron.schedule('*/10 * * * *', () => {
      this.failExpiredDeposits().catch(err =>
        logger.error('[ImapChimePayPal] failExpired cron error: ' + err)
      )
    })
  }
}
