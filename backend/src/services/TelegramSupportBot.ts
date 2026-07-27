import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { SupportService } from './SupportService';
import { PrismaClient } from '@prisma/client';
import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { createNotification } from './notificationService';
import { invalidateWalletCache } from './WalletService';

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

const VOID_REASONS = [
  'Wrong payment received',
  'Fraudulent / Suspicious payment',
  'Payment reversed by sender',
  'Duplicate deposit detected',
  'Auto-verified in error',
  'Other — contact support',
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
      // Global error handler — prevents "Unhandled error while processing" crashes
      // (e.g., stale callback_query IDs after server restart)
      this.bot.catch((err: any) => {
        logger.warn(`[TelegramBot] Suppressed bot error: ${err?.message || err}`);
      });

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
    // /start command (User linking)
    this.bot.start(async (ctx) => {
      if (ctx.chat.type !== 'private') return;
      
      const payload = ctx.message.text.split(' ')[1];
      if (payload) {
        try {
          const user = await prisma.user.findUnique({ where: { id: payload } });
          if (user) {
            const telegramUsername = ctx.from.username ? `@${ctx.from.username}` : null;
            const telegramId = ctx.from.id.toString();
            // Telegram phone is only available if user explicitly shares it; ctx.from does not expose it
            // but we store the Telegram user ID so admin can look them up
            await prisma.userProfile.upsert({
              where: { userId: user.id },
              update: {
                telegramUsername,
                telegramId,
              },
              create: {
                userId: user.id,
                telegramUsername,
                telegramId,
              },
            });
            logger.info(`[TelegramBot] Linked Telegram ${telegramId}${telegramUsername ? ` (${telegramUsername})` : ''} to user ${user.id}`);
            await ctx.reply('✅ Your Telegram account has been successfully linked to your website profile! How can we help you today?');
          } else {
            await ctx.reply('❌ Invalid link code. Please contact support for assistance.');
          }
        } catch (err) {
          logger.error('Error linking telegram account', err);
          await ctx.reply('👋 Welcome to support! How can we help you today?');
        }
      } else {
        await ctx.reply('👋 Welcome to Vault Sweeps support! How can we help you today?');
      }
    });

    // Text and media messages
    this.bot.on('message', async (ctx, next) => {
      if ('text' in ctx.message && ctx.message.text.startsWith('/')) return next(); // Skip commands

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
    let text = '[Media/Attachment]';
    let phone: string | null = null;

    if ('text' in ctx.message) text = ctx.message.text;
    else if ('caption' in ctx.message) text = ctx.message.caption;
    else if ('contact' in ctx.message) {
      phone = ctx.message.contact.phone_number;
      text = `[Shared Contact: ${phone}]`;
    }

    let conversation: any = null;
    try {
      conversation = await SupportService.getOrCreateTelegramConversation(telegramUserId, name, telegramUsername);

      // Fire and forget profile sync to save latency
      try {
        const orConditions: any[] = [{ telegramId: telegramUserId }];
        if (telegramUsername) {
          orConditions.push({ telegramUsername: { equals: `@${telegramUsername.replace('@', '')}`, mode: 'insensitive' } });
          orConditions.push({ telegramUsername: { equals: telegramUsername.replace('@', ''), mode: 'insensitive' } });
        }

        prisma.userProfile.findFirst({
          where: { OR: orConditions }
        }).then(linked => {
          if (linked) {
            prisma.userProfile.update({
              where: { id: linked.id },
              data: {
                telegramUsername: telegramUsername ? `@${telegramUsername.replace('@', '')}` : linked.telegramUsername,
                telegramPhone: phone ? phone : linked.telegramPhone,
                telegramId: telegramUserId
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      } catch (_) { /* non-critical */ }


      if (!conversation.telegram_thread_id) {
        const topicName = `${conversation.conversation_id} - Telegram ${name}`;
        const topic = await ctx.telegram.createForumTopic(this.groupId, topicName);
        conversation = await SupportService.updateConversationThreadId(conversation.id, topic.message_thread_id.toString());

        await ctx.telegram.sendMessage(
          this.groupId,
          `📩 New Telegram User\nConversation: ${conversation.conversation_id}\nTelegram User: ${name}${telegramUsername ? ` (@${telegramUsername})` : ''}\nTelegram ID: ${telegramUserId}${phone ? `\nPhone: ${phone}` : ''}`,
          { message_thread_id: topic.message_thread_id }
        );
      }

      await Promise.all([
        SupportService.saveMessage(conversation.id, 'user', text),
        ctx.telegram.copyMessage(this.groupId, ctx.chat.id, ctx.message.message_id, {
          message_thread_id: Number(conversation.telegram_thread_id)
        })
      ]);
    } catch (e: any) {
      if (e.description && e.description.includes('message thread not found')) {
        try {
          // The admin deleted the topic in the group, so we need to create a new one
          const topicName = `${conversation.conversation_id} - Telegram ${name}`;
          const topic = await ctx.telegram.createForumTopic(this.groupId, topicName);
          conversation = await SupportService.updateConversationThreadId(conversation.id, topic.message_thread_id.toString());
          
          await ctx.telegram.sendMessage(
            this.groupId,
            `📩 New Telegram User (Recreated)\nConversation: ${conversation.conversation_id}\nTelegram User: ${name}${telegramUsername ? ` (@${telegramUsername})` : ''}\nTelegram ID: ${telegramUserId}${phone ? `\nPhone: ${phone}` : ''}`,
            { message_thread_id: topic.message_thread_id }
          );

          await Promise.all([
            SupportService.saveMessage(conversation.id, 'user', text),
            ctx.telegram.copyMessage(this.groupId, ctx.chat.id, ctx.message.message_id, {
              message_thread_id: Number(conversation.telegram_thread_id)
            })
          ]);
          return; // Success after recreation
        } catch (retryError: any) {
          logger.error('Error recreating topic', retryError);
          await ctx.reply(`Sorry, an error occurred. Error: ${retryError.message || String(retryError)}`);
          return;
        }
      }

      logger.error('Error handling private message', e);
      await ctx.reply(`Sorry, an error occurred while sending your message. Error: ${e.message || String(e)}`);
    }
  }

  // ─── Support Chat: Group reply ───────────────────────────────────────────
  private async handleGroupMessage(ctx: any) {
    if (!ctx.message.is_topic_message || !ctx.message.message_thread_id) return;
    if (ctx.message.text?.startsWith('/')) return;

    const threadId = ctx.message.message_thread_id.toString();
    let text = '[Media/Attachment]';
    if ('text' in ctx.message) text = ctx.message.text;
    else if ('caption' in ctx.message) text = ctx.message.caption;

    try {
      const conversation = await SupportService.getConversationByThreadId(threadId);
      if (!conversation) return;

      const promises: Promise<any>[] = [
        SupportService.saveMessage(conversation.id, 'agent', text)
      ];

      if (conversation.source === 'telegram' && conversation.telegram_user_id) {
        promises.push(
          ctx.telegram.copyMessage(conversation.telegram_user_id, ctx.chat.id, ctx.message.message_id)
        );
      }
      
      await Promise.all(promises);
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

      const promises: Promise<any>[] = [
        SupportService.saveMessage(conversation.id, 'user', text)
      ];

      if (threadId) {
        promises.push(
          this.bot.telegram.sendMessage(this.groupId, `User: ${text}`, {
            message_thread_id: Number(threadId)
          })
        );
      }

      await Promise.all(promises);
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

    const methodName = deposit.paymentMethod?.name || deposit.paymentMethod?.code || 'Unknown'
    const profileName = deposit.notes?.trim() || 'Not provided'

    const text =
      `🏦 New Deposit Request\n\n` +
      `📋 Ref: ${deposit.paymentReference}\n` +
      `👤 User: ${user?.username || 'Unknown'} (${user?.email || 'N/A'})\n` +
      `💰 Amount: $${Number(deposit.amount).toFixed(2)}\n` +
      `💳 Method: ${methodName}\n` +
      `🙍 Sender Name: ${profileName}\n` +
      `🕐 Created: ${createdAt}\n` +
      `⏳ Status: Pending`;

    try {
      const sent = await this.bot.telegram.sendMessage(groupId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `dep_approve_${deposit.id}` },
              { text: '❌ Reject',  callback_data: `dep_reject_${deposit.id}` },
              { text: '🚫 Void',    callback_data: `dep_void_${deposit.id}` },
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

  // ─── Send Auto-Approved Notification to Telegram ─────────────────────────
  public async sendAutoApprovedDepositNotification(deposit: any, user: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const groupId = process.env.TELEGRAM_GROUP_CHAT_ID

    if (!token || !groupId) return

    const methodName = deposit.paymentMethod?.name || deposit.paymentMethod?.code || 'Unknown'
    const profileName = deposit.notes?.trim() || 'Not provided'

    const text =
      `✅ Deposit Approved Automatically\n\n` +
      `📋 Ref: ${deposit.paymentReference}\n` +
      `👤 User: ${user?.username || 'Unknown'} (${user?.email || 'N/A'})\n` +
      `💰 Amount: $${Number(deposit.amount).toFixed(2)}\n` +
      `💳 Method: ${methodName}\n` +
      `🙍 Sender Name: ${profileName}\n` +
      `✨ Verified via Email`;

    try {
      const sent = await this.bot.telegram.sendMessage(groupId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚫 Void (Deduct Balance)', callback_data: `dep_void_${deposit.id}` },
            ]
          ]
        }
      });

      // Store message ID for later editing
      prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          telegramMessageId: String(sent.message_id),
          telegramChatId: String(sent.chat.id)
        }
      }).catch(e => logger.warn('Could not store Telegram message ID for auto-approved deposit:', e.message));

    } catch (e) {
      logger.error('Failed to send auto-approved Telegram notification', e)
    }
  }

  // ─── Process Deposit (Approve / Reject) ─────────────────────────────────
  private async processDeposit(ctx: any, depositId: string, action: 'approve' | 'reject') {
    const agentName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'Agent';

    try {
      const deposit = await prisma.deposit.findUnique({
        where: { id: depositId },
        include: {
          user: { select: { username: true, email: true } },
          paymentMethod: { select: { name: true, code: true } }
        }
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

      // Fire cache invalidation immediately (non-blocking) — user sees balance update ASAP
      invalidateWalletCache(deposit.userId);

      // Run notification + Telegram message edit concurrently for fastest response
      const notificationPromise = createNotification(deposit.userId, {
        title: action === 'approve' ? '✅ Deposit Approved!' : '❌ Deposit Failed',
        message: action === 'approve'
          ? `Your deposit of $${deposit.amount.toFixed(2)} has been approved and added to your balance.`
          : `Your deposit of $${deposit.amount.toFixed(2)} was rejected. Reason: No payment received. Contact support if needed.`,
        type: action === 'approve' ? 'success' : 'error',
        link: '/dashboard/deposits'
      }).catch((e: any) => logger.warn('Notification error:', e.message));

      // Edit original Telegram message — remove buttons, add sender + method
      const editPromise = (async () => {
        if (!updatedDeposit.telegramMessageId || !updatedDeposit.telegramChatId) return;
        const emoji = action === 'approve' ? '✅' : '❌';
        const methodName = deposit.paymentMethod?.name || deposit.paymentMethod?.code || 'Unknown';
        const senderName = deposit.notes?.trim() || 'Not provided';
        const editedText =
          `${emoji} *Deposit ${action === 'approve' ? 'Approved' : 'Rejected'}* by ${agentName}\n\n` +
          `📋 Ref: \`${deposit.paymentReference}\`\n` +
          `👤 User: ${deposit.user?.username || 'Unknown'} (${deposit.user?.email || 'N/A'})\n` +
          `💰 Amount: *$${Number(deposit.amount).toFixed(2)}*\n` +
          `💳 Method: ${methodName}\n` +
          `🙍 Sender: ${senderName}\n` +
          `📊 Status: ${action === 'approve' ? 'Approved ✅' : 'Rejected ❌'}`;
        try {
          await this.bot.telegram.editMessageText(
            updatedDeposit.telegramChatId,
            Number(updatedDeposit.telegramMessageId),
            undefined,
            editedText,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } }
          );
        } catch (e: any) {
          logger.warn(`Could not edit Telegram deposit message: ${e.message}`);
        }
      })();

      // Reply to admin in Telegram + wait for edit concurrently
      await Promise.all([
        ctx.reply(
          action === 'approve'
            ? `✅ Deposit \`${deposit.paymentReference}\` approved by ${agentName}`
            : `❌ Deposit \`${deposit.paymentReference}\` rejected by ${agentName}`,
          { parse_mode: 'Markdown' }
        ),
        notificationPromise,
        editPromise,
      ]);

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
      `🏦 Account: \`${withdrawal.accountDetails || withdrawal.accountInfo || 'N/A'}\`\n` +
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
      `🏦 Account: \`${withdrawal.accountDetails || withdrawal.accountInfo || 'N/A'}\`\n` +
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

    // Helper: answer the callback query silently — Telegram has a ~10s timeout on these.
    // After a server restart, queued callbacks arrive with stale IDs and answerCbQuery
    // throws "400: query is too old". We swallow that error to prevent crashes.
    const safeCbAnswer = (text: string) =>
      ctx.answerCbQuery(text).catch(() => {/* stale query — ignore */});

    try {
    // dep_approve_<depositId>
    if (data.startsWith('dep_approve_')) {
      const depositId = data.replace('dep_approve_', '');
      await safeCbAnswer('Processing approval...');
      await this.processDeposit(ctx, depositId, 'approve');
      return;
    }

    // dep_reject_<depositId>
    if (data.startsWith('dep_reject_')) {
      const depositId = data.replace('dep_reject_', '');
      await safeCbAnswer('Processing rejection...');
      await this.processDeposit(ctx, depositId, 'reject');
      return;
    }

    // dep_void_<depositId> — show void reason picker
    if (data.startsWith('dep_void_') && !data.startsWith('dep_void_reason_')) {
      const depositId = data.replace('dep_void_', '');
      await safeCbAnswer('Select void reason...');

      const reasonButtons = VOID_REASONS.map(r => ([{
        text: r,
        callback_data: `dep_void_reason_${depositId}__${r}`
      }]));

      await ctx.reply(
        `🚫 Select void reason for deposit \`${depositId.slice(0, 10)}...\`:`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: reasonButtons }
        }
      );
      return;
    }

    // dep_void_reason_<depositId>__<reason>
    if (data.startsWith('dep_void_reason_')) {
      const withoutPrefix = data.replace('dep_void_reason_', '');
      const separatorIdx = withoutPrefix.indexOf('__');
      if (separatorIdx === -1) return;

      const depositId = withoutPrefix.substring(0, separatorIdx);
      const reason = withoutPrefix.substring(separatorIdx + 2);

      await safeCbAnswer('Voiding deposit...');
      await this.processDepositVoid(ctx, depositId, reason);
      return;
    }

    // wd_approve_WD-1001
    if (data.startsWith('wd_approve_')) {
      const requestId = data.replace('wd_approve_', '');
      await safeCbAnswer('Processing approval...');
      await this.processWithdrawal(ctx, requestId, 'approve', null);
      return;
    }

    // wd_reject_WD-1001 — show reason picker
    if (data.startsWith('wd_reject_')) {
      const requestId = data.replace('wd_reject_', '');
      await safeCbAnswer('Select rejection reason...');

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

      await safeCbAnswer('Processing rejection...');
      await this.processWithdrawal(ctx, requestId, 'reject', reason);
      return;
    }

    } catch (e: any) {
      // Log but don't crash — stale callback queries, network hiccups, etc.
      logger.warn(`[TelegramBot] Callback query handler error (data="${data}"): ${e.message}`);
    }
  }

  // ─── Void Deposit Processor ──────────────────────────────────────────────
  private async processDepositVoid(ctx: any, depositId: string, reason: string) {
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
      if (deposit.status !== 'approved') {
        await ctx.reply(`⚠️ Deposit is *${deposit.status}* — only *approved* deposits can be voided.`, { parse_mode: 'Markdown' });
        return;
      }

      const adminNotes = (deposit.notes || '') + `\nVoided by ${agentName}: ${reason}`;
      await prisma.deposit.update({
        where: { id: depositId },
        data: { status: 'failed', notes: adminNotes }
      });

      // Invalidate wallet cache so balance deduction is instant
      invalidateWalletCache(deposit.userId);

      // Notify user in-app
      await createNotification(deposit.userId, {
        title: '🚫 Deposit Voided',
        message: `Your deposit of $${deposit.amount.toFixed(2)} has been voided. Reason: ${reason}. Contact support if you have questions.`,
        type: 'error',
        link: '/dashboard/deposits'
      });

      // Audit log
      await prisma.transactionLog.create({
        data: {
          type: 'deposit_voided',
          entityId: depositId,
          userId: agentName,
          amount: deposit.amount,
          status: 'failed',
          metadata: { reason, agentName }
        }
      }).catch(e => logger.error('TransactionLog error:', e));

      // Edit original Telegram message
      if (deposit.telegramMessageId && deposit.telegramChatId) {
        const editedText =
          `🚫 *Deposit Voided* by ${agentName}\n\n` +
          `📋 Ref: \`${deposit.paymentReference}\`\n` +
          `👤 User: ${deposit.user?.username || 'Unknown'} (${deposit.user?.email || 'N/A'})\n` +
          `💵 Amount: *$${Number(deposit.amount).toFixed(2)}*\n` +
          `📊 Status: Voided 🚫\n` +
          `📝 Reason: ${reason}`;
        try {
          await this.bot.telegram.editMessageText(
            deposit.telegramChatId,
            Number(deposit.telegramMessageId),
            undefined,
            editedText,
            { parse_mode: 'Markdown' }
          );
        } catch (e: any) {
          logger.warn(`Could not edit Telegram deposit message: ${e.message}`);
        }
      }

      await ctx.reply(
        `🚫 Deposit \`${deposit.paymentReference}\` voided by ${agentName}\n📝 Reason: ${reason}`,
        { parse_mode: 'Markdown' }
      );

      // Invalidate cache so balance updates instantly
      invalidateWalletCache(deposit.userId);

      logger.info(`Deposit ${deposit.paymentReference} voided by ${agentName} — reason: ${reason}`);
    } catch (e: any) {
      logger.error(`Error voiding deposit ${depositId}:`, e);
      await ctx.reply(`❌ Error voiding deposit. Please check the logs.`, { parse_mode: 'Markdown' });
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

      // Fire cache invalidation immediately — balance updates on website ASAP
      invalidateWalletCache(updated.userId);

      // Run all side-effects concurrently — reply + notification + edit + audit log
      const responseText = action === 'approve'
        ? `✅ *${requestId}* approved by ${agentName}`
        : `❌ *${requestId}* rejected by ${agentName}${reason ? `\n📝 Reason: ${reason}` : ''}`;

      await Promise.all([
        ctx.reply(responseText, { parse_mode: 'Markdown' }),
        createNotification(updated.userId, {
          title: action === 'approve' ? '✅ Withdrawal Approved!' : '❌ Withdrawal Rejected',
          message: action === 'approve'
            ? `Your withdrawal request ${requestId} for $${updated.amount.toFixed(2)} has been approved.`
            : `Your withdrawal request ${requestId} for $${updated.amount.toFixed(2)} was rejected.${reason ? ` Reason: ${reason}` : ''} Contact support for help.`,
          type: action === 'approve' ? 'success' : 'error',
          link: '/dashboard/withdrawals'
        }).catch((e: any) => logger.warn('Notification error:', e.message)),
        this.editWithdrawalMessage(updated, action === 'approve' ? 'approved' : 'rejected', reason),
        prisma.transactionLog.create({
          data: {
            type: `withdrawal_${action}d`,
            entityId: updated.id,
            userId: agentName,
            amount: updated.amount,
            status: updated.status,
            metadata: { requestId, agentName, reason }
          }
        }).catch((e: any) => logger.error('TransactionLog error:', e)),
      ]);

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
