'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Shield, Zap, Users, Globe, Award, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Link from 'next/link'

const TEAM_VALUES = [
  { icon: Shield, title: 'Security First', desc: 'Bank-grade encryption and multi-layer security protect every account and transaction.', color: '#00D4FF' },
  { icon: Zap, title: 'Lightning Fast', desc: 'Instant deposits and rapid withdrawal processing power your gaming experience.', color: '#7B2FFF' },
  { icon: Users, title: 'Community Driven', desc: 'Built for players, by players. Your feedback shapes every feature we build.', color: '#00FFC8' },
  { icon: Globe, title: 'Global Platform', desc: 'Supporting players from 100+ countries with localized payment methods.', color: '#FF2D9B' },
  { icon: Award, title: 'Premium Quality', desc: 'Only the best, fully verified games make it into our curated library.', color: '#FFD700' },
  { icon: TrendingUp, title: 'Always Growing', desc: 'Continuously adding new games, features, and bonuses based on community needs.', color: '#00FF88' },
]

const MILESTONES = [
  { year: '2020', title: 'Founded', desc: 'Vault Sweeps launched with 50 games and a small but dedicated team.' },
  { year: '2021', title: '100K Users', desc: 'Reached 100,000 registered players and expanded our game library.' },
  { year: '2022', title: 'Crypto Payments', desc: 'Integrated cryptocurrency payments for faster, borderless transactions.' },
  { year: '2023', title: '500+ Games', desc: 'Grew library to 500+ games and launched our VIP program.' },
  { year: '2024', title: 'Global Scale', desc: 'Serving 850,000+ active players across 100+ countries worldwide.' },
]

export default function AboutPage() {
  const [mounted, setMounted] = useState(false)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Our Story</p>
            <h1 className="font-display font-bold text-5xl sm:text-6xl text-white mb-4">
              ABOUT <span className="gradient-text">VAULT SWEEPS</span>
            </h1>
            <p className="text-secondary text-xl max-w-2xl mx-auto leading-relaxed">
              We're building the future of online gaming — a platform where players come first, security is non-negotiable, and every experience is extraordinary.
            </p>
          </div>

          {/* Mission */}
          <div className="glass-card p-10 text-center mb-14 relative overflow-hidden">
            <div className="absolute inset-0 cyber-grid opacity-10" />
            <div className="relative z-10">
              <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Our Mission</p>
              <p className="text-2xl sm:text-3xl text-white font-display font-bold leading-relaxed max-w-3xl mx-auto">
                "To create the most trusted, exciting, and rewarding gaming platform on the internet — accessible to everyone, everywhere."
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="mb-16">
            <h2 className="font-display font-bold text-3xl text-white text-center mb-10">OUR <span className="gradient-text">VALUES</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {TEAM_VALUES.map((v, i) => (
                <div key={i} className="glass-card p-6 group hover:-translate-y-1 transition-all cursor-default">
                  <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{ background: `${v.color}15`, border: `1px solid ${v.color}30` }}>
                    <v.icon className="w-6 h-6" style={{ color: v.color }} />
                  </div>
                  <h3 className="font-display font-bold text-white mb-2">{v.title}</h3>
                  <p className="text-secondary text-sm leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="mb-16">
            <h2 className="font-display font-bold text-3xl text-white text-center mb-10">OUR <span className="gradient-text">JOURNEY</span></h2>
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-neon-blue via-neon-purple to-transparent" />
              <div className="space-y-8 pl-20">
                {MILESTONES.map((m, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-14 top-1 w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    <div className="glass-card p-5">
                      <span className="font-display font-black text-neon-blue text-lg">{m.year}</span>
                      <h3 className="font-display font-bold text-white mt-1 mb-1">{m.title}</h3>
                      <p className="text-secondary text-sm">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="glass-card p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 cyber-grid opacity-10" />
            <div className="relative z-10">
              <h2 className="font-display font-bold text-3xl text-white mb-3">JOIN THE <span className="gradient-text">VAULT SWEEPS</span></h2>
              <p className="text-secondary mb-6">Be part of the fastest-growing gaming community online.</p>
              {mounted && isAuthenticated ? (
                <Link href="/dashboard" className="btn-primary inline-block py-3 px-10 text-sm">Go to Dashboard</Link>
              ) : (
                <Link href="/register" className="btn-primary inline-block py-3 px-10 text-sm">Create Free Account</Link>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
