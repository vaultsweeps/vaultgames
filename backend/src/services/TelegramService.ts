import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import prisma from '../lib/prisma'
import { logger } from '../utils/logger'

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

    const message = `
🚨 *New Manual Cashout Request* 🚨
${data.requestId ? `\n📋 *Request ID:* \`${data.requestId}\`` : ''}
👤 *User:* ${data.username} (${data.email})
💰 *Amount:* $${data.amount}
🏦 *Method:* ${data.method.toUpperCase()}
🏷️ *Account/Tag:* \`${data.accountInfo}\`

Please process this request manually.
    `.trim()

    try {
      let response;
      if (data.qrCodePath && fs.existsSync(data.qrCodePath)) {
        // Send Photo with caption
        const formData = new FormData()
        formData.append('chat_id', chatId)
        formData.append('caption', message)
        formData.append('parse_mode', 'Markdown')
        if (data.requestId) {
          formData.append('reply_markup', JSON.stringify({
            inline_keyboard: [
              [
                { text: '✅ Approve', callback_data: `wd_approve_${data.requestId}` },
                { text: '❌ Reject', callback_data: `wd_reject_${data.requestId}` },
              ]
            ]
          }))
        }
        formData.append('photo', fs.createReadStream(data.qrCodePath))

        response = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, formData, {
          headers: formData.getHeaders()
        })
      } else {
        // Send plain text message
        const payload: any = {
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        }
        if (data.requestId) {
          payload.reply_markup = {
            inline_keyboard: [
              [
                { text: '✅ Approve', callback_data: `wd_approve_${data.requestId}` },
                { text: '❌ Reject', callback_data: `wd_reject_${data.requestId}` },
              ]
            ]
          }
        }
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
      logger.error(`Failed to send Telegram notification: ${error.message}`)
    }
  }

  static async sendSupportTicketNotification(username: string, subject: string, message: string, priority: string) {
    const text = `
🚨 *New Support Ticket* 🚨
*User:* ${username}
*Priority:* ${priority.toUpperCase()}
*Subject:* ${subject}

*Message:*
${message}
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
${requestId ? `📋 *Request ID:* \`${requestId}\`\n` : ''}*User:* ${username} (${email})
*Amount:* $${amount.toFixed(2)}
*Method:* ${method}

*Account Info:*
${accountInfo}
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
*User:* ${username} (${email})
*Amount:* $${amount.toFixed(2)}
*Method:* ${method}
*Ref:* ${txRef}
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
