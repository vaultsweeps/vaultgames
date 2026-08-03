import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import prisma from '../lib/prisma'
import { logger } from '../utils/logger'

// Escapes Telegram legacy-Markdown metacharacters in user-controlled text
// before interpolating it into a `parse_mode: 'Markdown'` message — without
// this, a support-ticket subject/message (fully free text) could embed
// `[label](https://evil.example)` and render as a real clickable link in the
// admin-facing Telegram notification.
function escMd(s: any): string {
  return String(s ?? '').replace(/([_*`\[\]])/g, '\\$1')
}

export class TelegramService {
  static async sendManualCashoutRequest(data: {
    amount: number
    method: string
    accountInfo: string
    username: string
    email: string
    qrCodePath?: string
    requestId?: string
    withdrawalId?: string
  }) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_GROUP_CHAT_ID

    if (!token || !chatId) {
      logger.warn('Telegram bot token or chat ID not configured. Skipping Telegram notification.')
      return
    }

    // Escape HTML special chars to prevent parse errors
    const esc = (s: string) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    const message = [
      `🚨 <b>New Cashout Request</b> 🚨`,
      data.requestId ? `📋 <b>Request ID:</b> <code>${esc(data.requestId)}</code>` : '',
      `👤 <b>User:</b> ${esc(data.username)} (${esc(data.email)})`,
      `💰 <b>Amount:</b> $${data.amount}`,
      `🏦 <b>Method:</b> ${esc(data.method.toUpperCase())}`,
      `🏷 <b>Account/Tag:</b> <code>${esc(data.accountInfo)}</code>`,
      ``,
      `Please process this request manually.`,
    ].filter(Boolean).join('\n')

    const replyMarkup = data.requestId ? {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `wd_approve_${data.requestId}` },
        { text: '❌ Reject',  callback_data: `wd_reject_${data.requestId}` },
      ]]
    } : undefined

    try {
      let response;
      if (data.qrCodePath && fs.existsSync(data.qrCodePath)) {
        const formData = new FormData()
        formData.append('chat_id', chatId)
        formData.append('caption', message)
        formData.append('parse_mode', 'HTML')
        if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup))
        formData.append('photo', fs.createReadStream(data.qrCodePath))
        response = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, formData, {
          headers: formData.getHeaders()
        })
      } else {
        const payload: any = {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }
        if (replyMarkup) payload.reply_markup = replyMarkup
        response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, payload)
      }

      if (data.withdrawalId && response?.data?.result) {
        await prisma.withdrawal.update({
          where: { id: data.withdrawalId },
          data: {
            telegramMessageId: String(response.data.result.message_id),
            telegramChatId: String(response.data.result.chat.id)
          }
        })
      }

      logger.info('Telegram notification sent successfully.')
    } catch (error: any) {
      logger.error(`Failed to send Telegram notification: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message}`)
    }
  }

  static async sendSupportTicketNotification(username: string, subject: string, message: string, priority: string) {
    const text = `
🚨 *New Support Ticket* 🚨
*User:* ${escMd(username)}
*Priority:* ${escMd(priority.toUpperCase())}
*Subject:* ${escMd(subject)}

*Message:*
${escMd(message)}
    `;
    return this.sendTextMessage(text);
  }

  static async sendWithdrawalRequestNotification(username: string, email: string, amount: number, method: string, accountInfo: string, requestId?: string, withdrawalId?: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_GROUP_CHAT_ID

    if (!token || !chatId) {
      logger.warn('Telegram Bot token or chat ID is not configured.')
      return false
    }

    const text = `
💸 *New Withdrawal Request* 💸
${requestId ? `📋 *Request ID:* \`${requestId}\`\n` : ''}*User:* ${escMd(username)} (${escMd(email)})
*Amount:* $${amount.toFixed(2)}
*Method:* ${escMd(method)}

*Account Info:*
${escMd(accountInfo)}
    `.trim();

    try {
      const payload: any = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      }

      if (requestId) {
        payload.reply_markup = {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `wd_approve_${requestId}` },
              { text: '❌ Reject', callback_data: `wd_reject_${requestId}` },
            ]
          ]
        }
      }

      const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, payload)

      if (withdrawalId && response?.data?.result) {
        await prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            telegramMessageId: String(response.data.result.message_id),
            telegramChatId: String(response.data.result.chat.id)
          }
        })
      }

      return true
    } catch (error: any) {
      logger.error('Failed to send Telegram message:', error?.response?.data || error.message)
      return false
    }
  }

  static async sendDepositNotification(username: string, email: string, amount: number, method: string, txRef: string) {
    const text = `
💰 *New Deposit Created* 💰
*User:* ${escMd(username)} (${escMd(email)})
*Amount:* $${amount.toFixed(2)}
*Method:* ${escMd(method)}
*Ref:* ${escMd(txRef)}
    `;
    return this.sendTextMessage(text);
  }

  private static async sendTextMessage(text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_GROUP_CHAT_ID

    if (!token || !chatId) {
      logger.warn('Telegram Bot token or chat ID is not configured.')
      return false
    }

    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
      return true
    } catch (error: any) {
      logger.error('Failed to send Telegram message:', error?.response?.data || error.message)
      return false
    }
  }
}
