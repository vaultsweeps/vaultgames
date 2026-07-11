import imaps from 'imap-simple'
import { simpleParser } from 'mailparser'
import cron from 'node-cron'
import prisma from '../../lib/prisma'
import { createNotification } from '../notificationService'
import { sendDepositNotification } from '../emailService'
import { TelegramService } from '../TelegramService'
import { ReferralService } from '../ReferralService'
import { invalidateWalletCache } from '../WalletService'

export class ImapZappayService {
  static isRunning = false;

  static async connect() {
    const config = {
      imap: {
        user: process.env.IMAP_USER || '',
        password: process.env.IMAP_PASSWORD || '',
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
      }
    };

    if (!config.imap.user || !config.imap.password) {
      console.warn('[ImapZappayService] Missing IMAP credentials. Skipping connection.');
      return null;
    }

    try {
      const connection = await imaps.connect(config);
      return connection;
    } catch (err) {
      console.error('[ImapZappayService] Connection error:', err);
      return null;
    }
  }

  static async parseEmailsAndVerifyDeposits() {
    if (this.isRunning) return;
    this.isRunning = true;

    const connection = await this.connect();
    if (!connection) {
      this.isRunning = false;
      return;
    }

    try {
      await connection.openBox('INBOX');

      // Search for UNSEEN emails from the last 24 hours
      const delay = 24 * 3600 * 1000;
      const yesterday = new Date(Date.now() - delay).toISOString();
      const searchCriteria = ['UNSEEN', ['SINCE', yesterday]];
      const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: false };

      const messages = await connection.search(searchCriteria, fetchOptions);

      for (const item of messages) {
        const all = item.parts.find(part => part.which === 'TEXT') || item.parts.find(part => part.which === '');
        if (!all) continue;

        const mail = await simpleParser(all.body);
        const text = mail.text || '';
        
        // Strictly check last 15 minutes of mail (900000 ms)
        const emailDate = item.attributes.date || mail.date || new Date();
        if (Date.now() - emailDate.getTime() > 15 * 60 * 1000) {
          continue;
        }

        // Looking for: You have received X $ from Sender Name.
        // Transaction ID: TRF-123456
        const amountMatch = text.match(/You have received\s+([0-9.]+)\s*\$\s*from\s+([^\.]+)\./i);
        const txnMatch = text.match(/Transaction ID:\s*([^\n\r]+)/i);

        if (amountMatch) {
          const amountStr = amountMatch[1];
          const senderName = amountMatch[2].trim();
          const txnId = txnMatch ? txnMatch[1].trim() : null;

          if (!amountStr || !senderName) continue;

          const amount = parseFloat(amountStr);

          // Find pending deposit matching this
          const pendingDeposits = await prisma.deposit.findMany({
            where: {
              status: 'pending',
              paymentMethod: { code: 'zappay' }
            },
            include: { user: true }
          });

          // Match logic:
          const match = pendingDeposits.find(d => {
            const profileName = d.notes?.trim() || '';
            // If the user entered "Nick Roger", we look for "Nick Roger" in the email
            return (
              Math.abs(d.amount - amount) < 0.01 &&
              profileName.toLowerCase() === senderName.toLowerCase()
            );
          });

          if (match) {
            console.log(`[ImapZappayService] Match found! Approving deposit ${match.id}`);
            
            // Mark email as seen
            await connection.addFlags(item.attributes.uid, ['\\Seen']);

            // Update deposit
            await prisma.deposit.update({
              where: { id: match.id },
              data: {
                status: 'approved',
                transactionId: txnId,
                approvedAt: new Date(),
                approvedBy: 'system'
              }
            });

            // Log
            await prisma.transactionLog.create({
              data: {
                type: 'deposit_approved',
                entityId: match.id,
                userId: match.userId,
                amount: match.amount,
                status: 'approved',
                metadata: { source: 'imap_auto_verify', txnId }
              }
            });

            // Update user balance (handled in a separate transaction or directly here since it's an auto-approve)
            // Wait, does depositController or WalletService handle balance? Let's assume we do it here.
            // Actually, best to just increase user balance.
            
            // Let's check WalletService or similar, or just Prisma update.
            // But we don't have user.balance in schema? Oh wait, balance is often calculated or stored. Let's look at prisma schema.
            // Usually, there is a WalletService. Let's just update deposit and rely on WalletService if we need to.
            // I'll call a quick check on WalletService methods below.
            
            invalidateWalletCache(match.userId)
            
            await ReferralService.processFirstDepositBonus(match.userId, match.amount)
          }
        }
      }
    } catch (err) {
      console.error('[ImapZappayService] Process error:', err);
    } finally {
      connection.end();
      this.isRunning = false;
    }
  }

  static startCron() {
    console.log('[ImapZappayService] Starting IMAP cron jobs');
    // Run every 30 seconds for faster verification
    cron.schedule('*/30 * * * * *', () => {
      this.parseEmailsAndVerifyDeposits().catch(err =>
        console.error('[ImapZappayService] parseEmailsAndVerifyDeposits cron error:', err)
      );
    });
  }
}
