import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../utils/supabase';

const prisma = new PrismaClient();

export class SupportService {
  /**
   * Retrieves or creates an active conversation for a user.
   */
  static async getOrCreateWebsiteConversation(userId: string, name: string) {
    let conversation = await prisma.conversation.findFirst({
      where: { user_id: userId, status: 'open', source: 'website' }
    });

    if (!conversation) {
      const convId = `CONV-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // We will create the topic in Telegram Support Bot, so we save it first without thread_id
      conversation = await prisma.conversation.create({
        data: {
          conversation_id: convId,
          user_id: userId,
          source: 'website',
          status: 'open'
        }
      });
    }
    return conversation;
  }

  static async getOrCreateTelegramConversation(telegramUserId: string, name: string, telegramUsername?: string) {
    let conversation = await prisma.conversation.findFirst({
      where: { telegram_user_id: telegramUserId, status: 'open', source: 'telegram' }
    });

    if (!conversation) {
      const convId = `CONV-${Math.floor(1000 + Math.random() * 9000)}`;
      
      conversation = await prisma.conversation.create({
        data: {
          conversation_id: convId,
          telegram_user_id: telegramUserId,
          source: 'telegram',
          status: 'open'
        }
      });
    }

    // Use raw SQL to update the telegram_username to completely bypass Prisma Client validation 
    // This prevents crashes on the live server if the Prisma Client hasn't been regenerated yet.
    if (telegramUsername) {
      try {
        await prisma.$executeRaw`UPDATE "Conversation" SET telegram_username = ${telegramUsername} WHERE id = ${conversation.id}`;
      } catch (e) {
        // Ignore errors if column doesn't exist yet
      }
    }
    return conversation;
  }

  static async updateConversationThreadId(id: string, threadId: string) {
    return prisma.conversation.update({
      where: { id },
      data: { telegram_thread_id: threadId }
    });
  }

  static async saveMessage(conversationId: string, senderType: 'user' | 'agent', text: string) {
    const msg = await prisma.message.create({
      data: {
        conversation_id: conversationId,
        sender_type: senderType,
        message: text
      }
    });

    // Broadcast to Supabase Realtime
    try {
      if (supabase) {
        await supabase.from('messages').insert({
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_type: msg.sender_type,
          message: msg.message,
          created_at: msg.created_at.toISOString()
        });
      }
    } catch (e) {
      console.error('Supabase broadcast failed', e);
    }

    return msg;
  }

  static async getConversationByThreadId(threadId: string) {
    return prisma.conversation.findFirst({
      where: { telegram_thread_id: threadId, status: 'open' }
    });
  }

  static async getConversationById(id: string) {
    return prisma.conversation.findUnique({
      where: { id }
    });
  }

  static async getMessagesByConversationId(conversationId: string) {
    return prisma.message.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' }
    });
  }

  static async closeConversation(id: string) {
    return prisma.conversation.update({
      where: { id },
      data: { status: 'closed' }
    });
  }
}
