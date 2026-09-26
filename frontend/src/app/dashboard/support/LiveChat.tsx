import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Headphones, MessageCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { Card, EmptyState, IconTile } from '@/components/dashboard/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Chat surface height: viewport-relative (dvh so mobile browser chrome never hides the input bar),
// clamped so it stays comfortable on tiny phones and huge monitors.
const CHAT_HEIGHT = 'h-[clamp(440px,calc(100dvh-290px),680px)]';

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
    return (
      <Card className={`${CHAT_HEIGHT} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-border-strong border-t-sky-400 animate-spin" />
          <p className="text-secondary text-[14px]">Connecting to live support...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`ds-card ${CHAT_HEIGHT} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 border-b border-border-subtle bg-surface-elevated">
        <div className="flex items-center gap-3 min-w-0">
          <IconTile icon={Headphones} tone="cyan" size="md" className="!rounded-full" />
          <div className="min-w-0">
            <h3 className="text-primary font-semibold text-[15px] sm:text-base leading-tight truncate">Vault Sweeps Support</h3>
            <p className="text-[13px] text-secondary flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" /> Online 24/7
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { fetchConversation() }}
          className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-secondary hover:text-primary bg-surface border border-border-subtle transition-all hover:brightness-125 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          title="Refresh Messages"
          aria-label="Refresh messages"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 space-y-3"
        style={{ background: 'color-mix(in srgb, var(--bg-background) 45%, var(--bg-surface))' }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState icon={MessageCircle} title="Start the conversation" text="Send a message to start the conversation." />
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
                <div className={`flex items-end gap-2 max-w-[88%] sm:max-w-[75%] min-w-0 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isUser && (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-elevated border border-border-subtle">
                      <Headphones className="w-4 h-4 text-sky-400" strokeWidth={2} />
                    </span>
                  )}
                  <div
                    className={`min-w-0 px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${isUser
                      ? 'text-white rounded-2xl rounded-br-md shadow-[0_6px_18px_-10px_rgba(59,130,246,0.8)]'
                      : 'bg-surface-elevated border border-border-subtle text-primary rounded-2xl rounded-bl-md'}`}
                    style={isUser ? { background: 'var(--ds-accent)' } : undefined}
                  >
                    {msg.message}
                    <div
                      className={`text-[12px] mt-1 leading-none ${isUser ? 'text-right' : 'text-muted'}`}
                      style={isUser ? { color: 'rgba(255,255,255,0.75)' } : undefined}
                    >
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
      <div className="px-3 py-3 sm:px-4 border-t border-border-subtle bg-surface-elevated">
        <form onSubmit={sendMessage} className="flex items-center gap-2.5">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            aria-label="Message"
            className="ds-input flex-1 min-w-0 !rounded-full !bg-surface !px-5 !text-[16px]"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            aria-label="Send message"
            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:pointer-events-none transition-all hover:brightness-110 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            style={{ background: 'var(--ds-accent)', boxShadow: 'var(--ds-accent-shadow)' }}
          >
            <Send className="w-[18px] h-[18px] -ml-0.5" strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
}
