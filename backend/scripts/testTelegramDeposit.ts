import dotenv from 'dotenv'
dotenv.config()

async function testTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID

  console.log('Token exists:', !!token)
  console.log('ChatId:', chatId)

  if (!token || !chatId) {
    console.error('Missing token or chatId!')
    return
  }

  const { Telegraf } = await import('telegraf')
  const bot = new Telegraf(token)

  try {
    const result = await bot.telegram.sendMessage(chatId, '🧪 Test deposit notification from Nexus Gaming backend\\n\\n✅ Approve / ❌ Reject buttons test', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Approve', callback_data: 'dep_approve_TEST123' },
          { text: '❌ Reject',  callback_data: 'dep_reject_TEST123' },
        ]]
      }
    })
    console.log('SUCCESS! Message sent, msg_id:', result.message_id)
  } catch (e: any) {
    console.error('FAILED:', e.message)
    console.error('Full error:', JSON.stringify(e, null, 2))
  }
}

testTelegram()
