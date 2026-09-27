import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Headphones, MessageCircle, RefreshCw, Clock, AlertCircle, CheckCheck } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, EmptyState, IconTile } from '@/components/dashboard/ui';

// Chat surface height: viewport-relative (dvh so mobile browser chrome never hides the input bar),
// clamped so it stays comfortable on tiny phones and huge monitors.
const CHAT_HEIGHT = 'h-[clamp(440px,calc(100dvh-290px),680px)]';

// How often to re-fetch the message list while the tab is visible and a conversation is open. This
// replaces a Supabase Realtime subscription that never actually delivered anything: the frontend uses the
// anon key with no Supabase Auth session, and RLS (correctly, for INF-6/INF-7) denies it read access to
// every table — a client only ever receives realtime events for rows it could also SELECT, so the
// subscription was silently inert from day one regardless of how it was wired up. Polling through the
// existing authenticated Express endpoint sidesteps that mismatch entirely and actually works.
const POLL_INTERVAL_MS = 4000;

export default function LiveChat() {
  // apiClient (shared with the rest of the app) sends the session cookie automatically and attaches the
  // fallback Authorization header itself when needed — no raw token read here at all now.
  const { user } = useAuthStore() as any;
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchMessages = useCallback(async (convId: string, opts?: { silent?: boolean }) => {
    try {
      const res = await apiClient.get(`/support/chat/messages/${convId}`);
      if (res.data.success) {
        // Replace wholesale with the authoritative list from the server — simplest correct way to merge
        // in new staff replies AND reconcile the just-sent message without hand-rolled de-dupe logic.
        // Any locally-pending (not-yet-confirmed) optimistic message is preserved until the server list
        // actually contains its confirmed counterpart, a moment later.
        setMessages(prev => {
          const pending = prev.filter(m => m._pending || m._failed)
          const serverIds = new Set(res.data.messages.map((m: any) => m.id))
          return [...res.data.messages, ...pending.filter(m => !serverIds.has(m.id))]
        })
      }
    } catch (error) {
      if (!opts?.silent) console.error('Failed to fetch messages', error);
    } finally {
      setLoading(false)
    }
  }, []);

  const fetchConversation = useCallback(async () => {
    try {
      const res = await apiClient.get(`/support/chat/conversation`);
      if (res.data.success) {
        setConversation(res.data.conversation);
        await fetchMessages(res.data.conversation.id);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to fetch conversation', error);
      setLoading(false);
    }
  }, [fetchMessages]);

  useEffect(() => {
    if (user) {
      fetchConversation();
    }
  }, [user, fetchConversation]);

  // Poll while a conversation is open and the tab is actually visible — pausing when hidden avoids
  // wasted requests, and refetching immediately on return makes coming back feel instant rather than
  // waiting for the next tick.
  useEffect(() => {
    if (!conversation) return;

    const tick = () => fetchMessages(conversation.id, { silent: true });

    const startPolling = () => {
      if (pollRef.current) return
      pollRef.current = setInterval(tick, POLL_INTERVAL_MS)
    };
    const stopPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { tick(); startPolling() }
      else stopPolling()
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [conversation, fetchMessages]);

  // Re-scroll whenever the message count grows (new send, poll picking up a staff reply, etc).
  const prevCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevCount.current) scrollToBottom();
    prevCount.current = messages.length;
  }, [messages.length]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !conversation || sending) return;

    setInputText('');
    setSending(true);

    const tempId = `pending-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, sender_type: 'user', message: text, created_at: new Date().toISOString(), _pending: true }]);

    try {
      await apiClient.post(`/support/chat/messages`, { conversationId: conversation.id, text });
      // Pull the authoritative list right away instead of waiting for the next poll tick — replaces the
      // pending bubble with the confirmed one with no visible gap.
      await fetchMessages(conversation.id, { silent: true });
    } catch (error) {
      console.error('Failed to send message', error);
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)));
    } finally {
      setSending(false);
    }
  };

  const retryMessage = async (failedMsg: any) => {
    if (!conversation) return;
    setMessages(prev => prev.map(m => (m.id === failedMsg.id ? { ...m, _pending: true, _failed: false } : m)));
    try {
      await apiClient.post(`/support/chat/messages`, { conversationId: conversation.id, text: failedMsg.message });
      setMessages(prev => prev.filter(m => m.id !== failedMsg.id));
      await fetchMessages(conversation.id, { silent: true });
    } catch {
      setMessages(prev => prev.map(m => (m.id === failedMsg.id ? { ...m, _pending: false, _failed: true } : m)));
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
    <div className={`ds-card ${CHAT_HEIGHT} flex flex-col overflow-hidden relative`}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 border-b border-border-subtle relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--ds-accent) 14%, var(--bg-surface-elevated)), var(--bg-surface-elevated))' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <IconTile icon={Headphones} tone="cyan" size="md" className="!rounded-full" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--bg-surface-elevated)]">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="text-primary font-semibold text-[15px] sm:text-base leading-tight truncate">Vault Sweeps Support</h3>
            <p className="text-[13px] text-secondary flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" /> Online 24/7 — replies land here automatically
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { if (conversation) fetchMessages(conversation.id) }}
          className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-secondary hover:text-primary bg-surface border border-border-subtle transition-all hover:brightness-125 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          title="Refresh messages"
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
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.sender_type === 'user';
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-end gap-2 max-w-[88%] sm:max-w-[75%] min-w-0 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isUser && (
                      <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-elevated border border-border-subtle">
                        <Headphones className="w-4 h-4 text-sky-400" strokeWidth={2} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div
                        className={`min-w-0 px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm ${isUser
                          ? 'text-white rounded-2xl rounded-br-md shadow-[0_6px_18px_-10px_rgba(59,130,246,0.8)]'
                          : 'bg-surface-elevated border border-border-subtle text-primary rounded-2xl rounded-bl-md'} ${msg._pending ? 'opacity-70' : ''} ${msg._failed ? 'border border-red-500/50' : ''}`}
                        style={isUser ? { background: msg._failed ? 'color-mix(in srgb, #ef4444 25%, var(--ds-accent))' : 'var(--ds-accent)' } : undefined}
                      >
                        {msg.message}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1 text-[12px] leading-none text-muted ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <span>{new Date(msg.created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isUser && msg._pending && <Clock className="w-3 h-3" />}
                        {isUser && !msg._pending && !msg._failed && <CheckCheck className="w-3.5 h-3.5 text-sky-400" />}
                        {isUser && msg._failed && (
                          <button type="button" onClick={() => retryMessage(msg)} className="flex items-center gap-1 text-red-400 hover:text-red-300 font-medium">
                            <AlertCircle className="w-3 h-3" /> Failed — tap to retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
            maxLength={2000}
            className="ds-input flex-1 min-w-0 !rounded-full !bg-surface !px-5 !text-[16px]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
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
