import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, User as UserIcon, Bot, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function LiveChat() {
  const { user, token } = useAuthStore() as any;
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversation = async () => {
    try {
      const res = await axios.get(`${API_URL}/support/chat/conversation`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setConversation(res.data.conversation);
        fetchMessages(res.data.conversation.id);
      }
    } catch (error) {
      console.error('Failed to fetch conversation', error);
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await axios.get(`${API_URL}/support/chat/messages/${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages', error);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchConversation();
    }
  }, [user, token]);

  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel(`chat_${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload: any) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !conversation) return;

    const text = inputText.trim();
    setInputText('');

    try {
      await axios.post(
        `${API_URL}/support/chat/messages`,
        { conversationId: conversation.id, text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Failed to send message', error);
      // Fallback UI or retry logic could go here
    }
  };

  if (loading) {
    return <div className="glass-card py-16 text-center text-muted">Connecting to live support...</div>;
  }

  return (
    <div className="glass-card flex flex-col h-[600px] max-h-[70vh] border border-border-strong rounded-xl overflow-hidden relative">
      {/* Header */}
      <div className="bg-background/50 border-b border-border-subtle p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neon-blue/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-neon-blue" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Live Support</h3>
            <p className="text-xs text-neon-blue flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-neon-blue animate-pulse"></span> Online 24/7
            </p>
          </div>
        </div>
        <button
          onClick={() => { fetchConversation() }}
          className="p-2 text-secondary hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          title="Refresh Messages"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted">
            <Bot className="w-12 h-12 mb-3 opacity-50" />
            <p>Send a message to start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender_type === 'user';
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-end gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-purple-500/20 text-purple-400' : 'bg-neon-blue/20 text-neon-blue'}`}>
                    {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${isUser ? 'bg-purple-600 text-white rounded-tr-none' : 'glass border-border-subtle text-primary rounded-tl-none'}`}>
                    {msg.message}
                    <div className={`text-[10px] mt-1 ${isUser ? 'text-purple-300' : 'text-muted'}`}>
                      {new Date(msg.created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-background/50 border-t border-border-subtle">
        <form onSubmit={sendMessage} className="flex items-center gap-2 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="input-neon flex-1 pr-12 bg-surface"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-neon-blue text-dark-900 flex items-center justify-center disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4 ml-[-2px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
