import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { SupportService } from './SupportService';
import { PrismaClient } from '@prisma/client';
import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { createNotification } from './notificationService';

const prisma = new PrismaClient();

const REJECTION_REASONS = [
  'Duplicate request',
  'Verification required',
  'Incorrect details',
  'Bank information invalid',
  'Identity verification required',
  'Suspicious activity detected',
  'Account under review',
];

export class TelegramSupportBot {
  private bot: Telegraf;
  private groupId: string;
  private static instance: TelegramSupportBot;

  private constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.groupId = process.env.TELEGRAM_GROUP_CHAT_ID || '';

    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN is not set. Support Bot will not start.');
      this.bot = new Telegraf('dummy-token');
      return;
    }

    this.bot = new Telegraf(token);
    this.setupListeners();
  }

  public static getInstance(): TelegramSupportBot {
    if (!TelegramSupportBot.instance) {
      TelegramSupportBot.instance = new TelegramSupportBot();
    }
    return TelegramSupportBot.instance;
  }

  public async start() {
    if (process.env.TELEGRAM_BOT_TOKEN) {
      try {
        await this.bot.launch();
        logger.info('Telegram Support Bot started successfully.');
      } catch (e) {
        logger.error('Failed to start Telegram Support Bot', e);
      }
    }
  }

  // ─── Listeners ──────────────────────────────────────────────────────────
  private setupListeners() {
    // Text messages
    this.bot.on(message('text'), async (ctx, next) => {
      if (ctx.chat.id.toString() === this.groupId) {
        return this.handleGroupMessage(ctx);
      }
      if (ctx.chat.type === 'private') {
        return this.handlePrivateMessage(ctx);
      }
      return next();
    });

    // Inline button callbacks
    this.bot.on('callback_query', async (ctx) => {
      await this.handleCallbackQuery(ctx);
    });

    // /approve command
    this.bot.command('approve', async (ctx) => {
      if (ctx.chat.id.toString() !== this.groupId) return;
      await this.handleWithdrawalCommand(ctx, 'approve');
    });

    // /reject command
    this.bot.command('reject', async (ctx) => {
      if (ctx.chat.id.toString() !== this.groupId) return;
      await this.handleWithdrawalCommand(ctx, 'reject');
    });
  }

  // ─── Support Chat: Private DM ────────────────────────────────────────────
  private async handlePrivateMessage(ctx: any) {
    const telegramUserId = ctx.from.id.toString();
    const name = ctx.from.first_name || 'User';
    const telegramUsername = ctx.from.username || null;
    const text = ctx.message.text;

    try {
      let conversation = await SupportService.getOrCreateTelegramConversation(telegramUserId, name, telegramUsername);

      if (!conversation.telegram_thread_id) {
        const topicName = `${conversation.conversation_id} - Telegram ${name}`;
        const topic = await ctx.telegram.createForumTopic(this.groupId, topicName);
        conversation = await SupportService.updateConversationThreadId(conversation.id, topic.message_thread_id.toString());

        await ctx.telegram.sendMessage(
          this.groupId,
          `📩 New Telegram User\nConversation: ${conversation.conversation_id}\nTelegram User: ${name}${telegramUsername ? ` (@${telegramUsername})` : ''}\nTelegram ID: ${telegramUserId}`,
          { message_thread_id: topic.message_thread_id }
        );
      }

      await SupportService.saveMessage(conversation.id, 'user', text);

      await ctx.telegram.sendMessage(this.groupId, `User: ${text}`, {
        message_thread_id: Number(conversation.telegram_thread_id)
      });
    } catch (e) {
      logger.error('Error handling private message', e);
      await ctx.reply('Sorry, an error occurred while sending your message.');
    }
  }

  // ─── Support Chat: Group reply ───────────────────────────────────────────
  private async handleGroupMessage(ctx: any) {
    if (!ctx.message.is_topic_message || !ctx.message.message_thread_id) return;
    if (ctx.message.text?.startsWith('/')) return;

    const threadId = ctx.message.message_thread_id.toString();
    const text = ctx.message.text;

    try {
      const conversation = await SupportService.getConversationByThreadId(threadId);
      if (!conversation) return;

      await SupportService.saveMessage(conversation.id, 'agent', text);

      if (conversation.source === 'telegram' && conversation.telegram_user_id) {
        await ctx.telegram.sendMessage(conversation.telegram_user_id, text);
      }
    } catch (e) {
      logger.error('Error handling group message', e);
    }
  }

  // ─── Forward website chat to Telegram ───────────────────────────────────
  public async forwardWebsiteMessageToTelegram(conversation: any, text: string, userName: string) {
    try {
      let threadId = conversation.telegram_thread_id;

      if (!threadId) {
        const topicName = `${conversation.conversation_id} - ${userName}`;
        const topic = await this.bot.telegram.createForumTopic(this.groupId, topicName);
        threadId = topic.message_thread_id.toString();
        await SupportService.updateConversationThreadId(conversation.id, threadId);

        await this.bot.telegram.sendMessage(
          this.groupId,
          `💬 New Website User\nConversation: ${conversation.conversation_id}\nUser: ${userName}`,
          { message_thread_id: topic.message_thread_id }
        );
      }

      await this.bot.telegram.sendMessage(this.groupId, `User: ${text}`, {
        message_thread_id: Number(threadId)
      });
    } catch (e) {
      logger.error('Error forwarding website message to Telegram', e);
    }
  }

  // ─── Send Deposit Notification to Telegram ──────────────────────────────
  public async sendDepositNotification(deposit: any, user: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const groupId = process.env.TELEGRAM_GROUP_CHAT_ID

    if (!token || !groupId) {
      logger.warn('Telegram not configured — skipping deposit notification.')
      return
    }

    const createdAt = new Date(deposit.createdAt).toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });

    const text =
      `New Deposit Request\n\n` +
      `Ref: ${deposit.paymentReference}\n` +
      `User: ${user?.username || 'Unknown'} (${user?.email || 'N/A'})\n` +
      `Amount: $${Number(deposit.amount).toFixed(2)}\n` +
      `Method: Zappay\n` +
      `Profile Name: ${deposit.notes || 'Not provided'}\n` +
      `Created: ${createdAt}\n` +
      `Status: Pending`;

    try {
      const sent = await this.bot.telegram.sendMessage(groupId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Approve', callback_data: `dep_approve_${deposit.id}` },
              { text: 'Reject',  callback_data: `dep_reject_${deposit.id}` },
            ]
          ]
        }
      });

      logger.info(`Telegram deposit notification sent for ${deposit.paymentReference} (msg: ${sent.message_id})`);

      // Store message ID for later editing (non-blocking, best-effort)
      prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          telegramMessageId: String(sent.message_id),
          telegramChatId: String(sent.chat.id)
        }
      }).catch(e => logger.warn('Could not store Telegram message ID for deposit:', e.message));

    } catch (e: any) {
      logger.error(`Failed to send Telegram deposit notification: ${e?.message}`, e?.response?.error_code ? { code: e.response.error_code, description: e.response.description } : {});
      throw e // re-throw so the controller can log it too
    }
  }

  // ─── Process Deposit (Approve / Reject) ─────────────────────────────────
  private async processDeposit(ctx: any, depositId: string, action: 'approve' | 'reject') {
    const agentName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'Agent';

    try {
      const deposit = await prisma.deposit.findUnique({
        where: { id: depositId },
        include: { user: { select: { username: true, email: true } } }
      });

      if (!deposit) {
        await ctx.reply(`⚠️ Deposit \`${depositId}\` not found.`, { parse_mode: 'Markdown' });
        return;
      }
      if (deposit.status !== 'pending') {
        await ctx.reply(`⚠️ Deposit is already *${deposit.status}*. No changes made.`, { parse_mode: 'Markdown' });
        return;
      }

      const newStatus = action === 'approve' ? 'approved' : 'failed';
      const updatedDeposit = await prisma.deposit.update({
        where: { id: depositId },
        data: {
          status: newStatus,
          approvedBy: action === 'approve' ? agentName : undefined,
          approvedAt: action === 'approve' ? new Date() : undefined,
          rejectedBy: action === 'reject' ? agentName : undefined,
          rejectedAt: action === 'reject' ? new Date() : undefined,
          rejectionReason: action === 'reject' ? 'No payment received' : undefined,
        }
      });

      // Notify user in-app
      await createNotification(deposit.userId, {
        title: action === 'approve' ? '✅ Deposit Approved!' : '❌ Deposit Failed',
        message: action === 'approve'
          ? `Your deposit of $${deposit.amount.toFixed(2)} has been approved and added to your balance.`
          : `Your deposit of $${deposit.amount.toFixed(2)} was rejected. Reason: No payment received. Contact support if needed.`,
        type: action === 'approve' ? 'success' : 'error',
        link: '/dashboard/deposits'
      });

      // Edit original Telegram message
      if (updatedDeposit.telegramMessageId && updatedDeposit.telegramChatId) {
        const emoji = action === 'approve' ? '✅' : '❌';
        const editedText =
          `${emoji} *Deposit ${action === 'approve' ? 'Approved' : 'Rejected'}* by ${agentName}\n\n` +
          `📋 Ref: \`${deposit.paymentReference}\`\n` +
          `👤 User: ${deposit.user?.username || 'Unknown'} (${deposit.user?.email || 'N/A'})\n` +
          `💵 Amount: *$${Number(deposit.amount).toFixed(2)}*\n` +
          `📊 Status: ${action === 'approve' ? 'Approved ✅' : 'Rejected ❌'}`;
        try {
          await this.bot.telegram.editMessageText(
            updatedDeposit.telegramChatId,
            Number(updatedDeposit.telegramMessageId),
            undefined,
            editedText,
            { parse_mode: 'Markdown' }
          );
        } catch (e: any) {
          logger.warn(`Could not edit Telegram deposit message: ${e.message}`);
        }
      }

      await ctx.reply(
        action === 'approve'
          ? `✅ Deposit \`${deposit.paymentReference}\` approved by ${agentName}`
          : `❌ Deposit \`${deposit.paymentReference}\` rejected by ${agentName}`,
        { parse_mode: 'Markdown' }
      );

      logger.info(`Deposit ${deposit.paymentReference} ${action}d by ${agentName}`);
    } catch (e: any) {
      logger.error(`Error processing deposit ${depositId}:`, e);
      await ctx.reply(`❌ Error processing deposit. Please check the logs.`, { parse_mode: 'Markdown' });
    }
  }

  // ─── Send Withdrawal Notification ───────────────────────────────────────
  public async sendWithdrawalNotification(withdrawal: any, user: any) {
    if (!this.groupId || !process.env.TELEGRAM_BOT_TOKEN) return;

    const createdAt = new Date(withdrawal.createdAt).toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });

    const text =
      `🔔 *New Withdrawal Request*\n\n` +
      `📋 Request ID: \`${withdrawal.requestId}\`\n` +
      `👤 User: ${user?.username || 'Unknown'} (${user?.email || 'N/A'})\n` +
      `💰 Amount: *$${Number(withdrawal.amount).toFixed(2)}*\n` +
      `💳 Method: ${withdrawal.paymentMethodStr || 'Unknown'}\n` +
      `🏦 Account: \`${withdrawal.accountDetails || 'N/A'}\`\n` +
      `📅 Created: ${createdAt}\n` +
      `📊 Status: Pending ⏳`;

    try {
      const sent = await this.bot.telegram.sendMessage(this.groupId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `wd_approve_${withdrawal.requestId}` },
              { text: '❌ Reject', callback_data: `wd_reject_${withdrawal.requestId}` },
            ]
          ]
        }
      });

      // Store message ID for future editing
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          telegramMessageId: String(sent.message_id),
          telegramChatId: String(sent.chat.id)
        }
      });

      logger.info(`Telegram notification sent for ${withdrawal.requestId} (msg: ${sent.message_id})`);
    } catch (e) {
      logger.error(`Failed to send Telegram notification for ${withdrawal.requestId}:`, e);
    }
  }

  // ─── Edit Withdrawal Message (called after approve/reject) ────────────────
  public async editWithdrawalMessage(withdrawal: any, action: 'approved' | 'rejected', reason?: string | null) {
    if (!withdrawal.telegramMessageId || !withdrawal.telegramChatId) return;
    if (!process.env.TELEGRAM_BOT_TOKEN) return;

    const emoji = action === 'approved' ? '✅' : '❌';
    const statusText = action === 'approved' ? 'Approved ✅' : 'Rejected ❌';

    const newText =
      `${emoji} *Withdrawal ${action === 'approved' ? 'Approved' : 'Rejected'}*\n\n` +
      `📋 Request ID: \`${withdrawal.requestId}\`\n` +
      `👤 User: ${withdrawal.user?.username || 'Unknown'} (${withdrawal.user?.email || 'N/A'})\n` +
      `💰 Amount: *$${Number(withdrawal.amount).toFixed(2)}*\n` +
      `💳 Method: ${withdrawal.paymentMethodStr || 'Unknown'}\n` +
      `🏦 Account: \`${withdrawal.accountDetails || 'N/A'}\`\n` +
      `📊 Status: ${statusText}\n` +
      (action === 'approved'
        ? `✅ Approved by: ${withdrawal.approvedBy || 'Admin'}`
        : `❌ Rejected by: ${withdrawal.rejectedBy || 'Admin'}${reason ? `\n📝 Reason: ${reason}` : ''}`);

    try {
      await this.bot.telegram.editMessageText(
        withdrawal.telegramChatId,
        Number(withdrawal.telegramMessageId),
        undefined,
        newText,
        { parse_mode: 'Markdown' }
      );
    } catch (e: any) {
      // Message may be too old to edit — not a critical failure
      logger.warn(`Could not edit Telegram message ${withdrawal.telegramMessageId}: ${e.message}`);
    }
  }

  // ─── Callback Query Handler ──────────────────────────────────────────────
  private async handleCallbackQuery(ctx: any) {
    const data: string = ctx.callbackQuery?.data || '';
    if (!data) return;

    // dep_approve_<depositId>
    if (data.startsWith('dep_approve_')) {
      const depositId = data.replace('dep_approve_', '');
      await ctx.answerCbQuery('Processing approval...');
      await this.processDeposit(ctx, depositId, 'approve');
      return;
    }

    // dep_reject_<depositId>
    if (data.startsWith('dep_reject_')) {
      const depositId = data.replace('dep_reject_', '');
      await ctx.answerCbQuery('Processing rejection...');
      await this.processDeposit(ctx, depositId, 'reject');
      return;
    }

    // wd_approve_WD-1001
    if (data.startsWith('wd_approve_')) {
      const requestId = data.replace('wd_approve_', '');
      await ctx.answerCbQuery('Processing approval...');
      await this.processWithdrawal(ctx, requestId, 'approve', null);
      return;
    }

    // wd_reject_WD-1001 — show reason picker
    if (data.startsWith('wd_reject_')) {
      const requestId = data.replace('wd_reject_', '');
      await ctx.answerCbQuery('Select rejection reason...');

      const reasonButtons = REJECTION_REASONS.map(r => ([{
        text: r,
        callback_data: `wd_reason_${requestId}__${r}`
      }]));
      reasonButtons.push([{ text: '🚫 Reject Without Reason', callback_data: `wd_reason_${requestId}__NONE` }]);

      await ctx.reply(
        `Select rejection reason for \`${requestId}\`:`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: reasonButtons }
        }
      );
      return;
    }

    // wd_reason_WD-1001__Duplicate request
    if (data.startsWith('wd_reason_')) {
      const withoutPrefix = data.replace('wd_reason_', '');
      const separatorIdx = withoutPrefix.indexOf('__');
      if (separatorIdx === -1) return;

      const requestId = withoutPrefix.substring(0, separatorIdx);
      const rawReason = withoutPrefix.substring(separatorIdx + 2);
      const reason = rawReason === 'NONE' ? null : rawReason;

      await ctx.answerCbQuery('Processing rejection...');
      await this.processWithdrawal(ctx, requestId, 'reject', reason);
      return;
    }
  }

  // ─── Text Command Handler (/approve, /reject) ────────────────────────────
  private async handleWithdrawalCommand(ctx: any, action: 'approve' | 'reject') {
    const text: string = ctx.message.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length < 2) {
      return ctx.reply(`Usage: /${action} <request_id> ${action === 'reject' ? '[reason]' : ''}`, { parse_mode: 'Markdown' });
    }

    const requestId = parts[1].toUpperCase();
    const reason = action === 'reject' && parts.length > 2 ? parts.slice(2).join(' ') : null;

    await this.processWithdrawal(ctx, requestId, action, reason);
  }

  // ─── Core Atomic Processor ───────────────────────────────────────────────
  private async processWithdrawal(ctx: any, requestId: string, action: 'approve' | 'reject', reason: string | null) {
    const agentName = ctx.from?.username
      ? `@${ctx.from.username}`
      : ctx.from?.first_name || 'Agent';

    try {
      // Atomic transaction: lock check + update in single TX
      const updated = await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.withdrawal.findUnique({
          where: { requestId },
          include: { user: { select: { username: true, email: true } } }
        });

        if (!withdrawal) throw new Error(`NOT_FOUND`);
        if (withdrawal.locked) throw new Error(`ALREADY_PROCESSED:${withdrawal.status}`);

        const updateData: any = {
          status: action === 'approve' ? 'approved' : 'rejected',
          locked: true,
        };

        if (action === 'approve') {
          updateData.approvedBy = agentName;
          updateData.approvedAt = new Date();
        } else {
          updateData.rejectedBy = agentName;
          updateData.rejectedAt = new Date();
          updateData.rejectionReason = reason;
        }

        return tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: updateData,
          include: { user: { select: { username: true, email: true } } }
        });
      });

      // Broadcast via Supabase Realtime
      if (supabase) {
        const broadcastData: any = { status: updated.status };
        if (action === 'approve') broadcastData.approvedBy = agentName;
        else { broadcastData.rejectedBy = agentName; broadcastData.rejectionReason = reason; }

        supabase.from('Withdrawal').update(broadcastData).eq('requestId', requestId)
          .then(
            () => logger.info(`Supabase broadcast: ${action}d ${requestId}`),
            (e) => logger.error('Supabase broadcast error:', e)
          );
      }

      // Notify user in-app
      await createNotification(updated.userId, {
        title: action === 'approve' ? '✅ Withdrawal Approved!' : '❌ Withdrawal Rejected',
        message: action === 'approve'
          ? `Your withdrawal request ${requestId} for $${updated.amount.toFixed(2)} has been approved.`
          : `Your withdrawal request ${requestId} for $${updated.amount.toFixed(2)} was rejected.${reason ? ` Reason: ${reason}` : ''} Contact support for help.`,
        type: action === 'approve' ? 'success' : 'error',
        link: '/dashboard/withdrawals'
      });

      // Edit original Telegram message
      await this.editWithdrawalMessage(updated, action === 'approve' ? 'approved' : 'rejected', reason);

      // Audit log
      await prisma.transactionLog.create({
        data: {
          type: `withdrawal_${action}d`,
          entityId: updated.id,
          userId: agentName,
          amount: updated.amount,
          status: updated.status,
          metadata: { requestId, agentName, reason }
        }
      }).catch(e => logger.error('TransactionLog error:', e));

      // Reply in Telegram
      const responseText = action === 'approve'
        ? `✅ *${requestId}* approved by ${agentName}`
        : `❌ *${requestId}* rejected by ${agentName}${reason ? `\n📝 Reason: ${reason}` : ''}`;

      await ctx.reply(responseText, { parse_mode: 'Markdown' });
      logger.info(`Withdrawal ${requestId} ${action}d by ${agentName}`);

    } catch (e: any) {
      if (e.message === 'NOT_FOUND') {
        await ctx.reply(`⚠️ Request \`${requestId}\` not found.`, { parse_mode: 'Markdown' });
      } else if (e.message?.startsWith('ALREADY_PROCESSED:')) {
        const currentStatus = e.message.split(':')[1];
        await ctx.reply(`⚠️ Request \`${requestId}\` has already been processed.\nCurrent status: *${currentStatus}*`, { parse_mode: 'Markdown' });
      } else {
        logger.error(`Error processing withdrawal ${requestId}:`, e);
        await ctx.reply(`❌ Error processing \`${requestId}\`. Please try again or check the logs.`, { parse_mode: 'Markdown' });
      }
    }
  }

  public stopBot() {
    this.bot.stop();
  }
}
