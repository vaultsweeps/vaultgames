import { Request, Response } from 'express';
import { SupportService } from '../services/SupportService';
import { TelegramSupportBot } from '../services/TelegramSupportBot';
import { markViewingChat } from '../lib/redis';

// Ensure you have auth middleware and it adds 'user' to the request.
// Assuming your existing auth middleware sets req.user.
interface AuthRequest extends Request {
  user?: any; // Replace 'any' with your actual User type if available
}

export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const name = req.user?.username || 'Website User';

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const conversation = await SupportService.getOrCreateWebsiteConversation(userId, name);
    res.status(200).json({ success: true, conversation });
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const conversation = await SupportService.getConversationById(conversationId);
    
    if (!conversation || conversation.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const messages = await SupportService.getMessagesByConversationId(conversationId);
    res.status(200).json({ success: true, messages });
    // Fire-and-forget: the frontend polls this endpoint every 4s while the chat tab is open and visible
    // (LiveChat.tsx), so a successful call here IS the "user is actively looking at this conversation"
    // signal — used to skip a redundant notification when a staff reply arrives while they're already
    // watching it live. Never let this delay or fail the response above.
    markViewingChat(userId, conversationId).catch(() => {});
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, text } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.username || 'Website User';

    if (!userId || typeof text !== 'string' || !text.trim() || typeof conversationId !== 'string') {
      return res.status(400).json({ success: false, message: 'Bad Request' });
    }
    if (text.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters).' });
    }

    const conversation = await SupportService.getConversationById(conversationId);
    
    if (!conversation || conversation.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Save message to DB
    const message = await SupportService.saveMessage(conversationId, 'user', text);

    // Forward to Telegram
    await TelegramSupportBot.getInstance().forwardWebsiteMessageToTelegram(conversation, text, userName);

    res.status(201).json({ success: true, message });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
