'use client'
import { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Send, MessageCircle, Mail, Clock, CheckCircle } from 'lucide-react'

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data: any) => {
    setSending(true)
    await new Promise(r => setTimeout(r, 1500))
    setSending(false)
    setSent(true)
    toast.success("Message sent! We'll reply within 24 hours.")
  }

  const CHANNELS = [
    { icon: Send, label: 'Telegram', handle: '@Vault Sweeps', href: 'https://t.me/vaultsweeps', color: '#229ED9', response: '< 5 min', desc: 'Fastest support channel' },
    { icon: MessageCircle, label: 'Facebook Messenger', handle: 'Vault Sweeps', href: 'https://m.me/vaultsweeps', color: '#1877F2', response: '< 15 min', desc: 'Chat on Messenger' },
    { icon: Mail, label: 'Email', handle: 'supportvaultsweeps@gmail.com', href: 'mailto:supportvaultsweeps@gmail.com', color: '#7B2FFF', response: '< 24 hr', desc: 'For detailed inquiries' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Get in touch</p>
            <h1 className="font-display font-bold text-5xl text-white mb-4">CONTACT <span className="gradient-text">US</span></h1>
            <p className="text-secondary text-lg max-w-xl mx-auto">Our support team is available 24/7 to help you with anything.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
            {CHANNELS.map((c, i) => (
              <motion.a key={i} href={c.href} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-card p-6 text-center group hover:border-white/15 transition-all">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform"
                  style={{ background: `${c.color}15`, border: `1px solid ${c.color}30` }}>
                  <c.icon className="w-7 h-7" style={{ color: c.color }} />
                </div>
                <h3 className="font-display font-bold text-white mb-1">{c.label}</h3>
                <p className="text-xs text-muted mb-2">{c.desc}</p>
                <p className="text-sm font-medium" style={{ color: c.color }}>{c.handle}</p>
                <div className="flex items-center justify-center gap-1 mt-3">
                  <Clock className="w-3 h-3 text-muted" />
                  <span className="text-xs text-muted">Avg response: {c.response}</span>
                </div>
              </motion.a>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact form */}
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <div className="glass-card p-8">
                <h2 className="font-display font-bold text-2xl text-white mb-6">SEND A MESSAGE</h2>
                {sent ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h3 className="font-display font-bold text-white text-lg mb-2">MESSAGE SENT!</h3>
                    <p className="text-secondary text-sm">We'll respond to your email within 24 hours.</p>
                    <button onClick={() => setSent(false)} className="btn-neon mt-4 text-sm">Send Another</button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Name</label>
                        <input {...register('name', { required: true })} type="text" placeholder="Your name" className="input-neon" />
                      </div>
                      <div>
                        <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Email</label>
                        <input {...register('email', { required: true })} type="email" placeholder="your@email.com" className="input-neon" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Subject</label>
                      <input {...register('subject', { required: true })} type="text" placeholder="How can we help?" className="input-neon" />
                    </div>
                    <div>
                      <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Message</label>
                      <textarea {...register('message', { required: true })} rows={5} placeholder="Describe your issue or question in detail..." className="input-neon resize-none" />
                    </div>
                    <button type="submit" disabled={sending} className="btn-primary w-full py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                      {sending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
                        : <><Send className="w-4 h-4" />Send Message</>}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>

            {/* FAQ preview */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
              <div className="glass-card p-8 h-full">
                <h2 className="font-display font-bold text-2xl text-white mb-6">QUICK ANSWERS</h2>
                <div className="space-y-4">
                  {[
                    { q: 'How quickly are deposits processed?', a: 'Crypto deposits are processed automatically via webhook within minutes. Manual methods may take up to 24 hours.' },
                    { q: 'What is the minimum withdrawal?', a: 'The minimum withdrawal is $20 USD regardless of payment method. See our Cashout Rules page for full details.' },
                    { q: 'My deposit is stuck as pending', a: 'Contact us via Telegram immediately with your transaction hash/reference number for fastest resolution.' },
                    { q: 'How do I verify my account?', a: 'For withdrawals over $500, you may be asked to submit ID verification. Submit via your profile settings.' },
                  ].map((item, i) => (
                    <div key={i} className="glass rounded-xl p-4">
                      <p className="text-white text-sm font-medium mb-1">{item.q}</p>
                      <p className="text-secondary text-xs leading-relaxed">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
