'use client'
/**
 * Admin presentation kit (adminrest pages). Pure UI: owns no data / routing / business logic.
 * Builds on the dashboard design system in components/dashboard/ui.tsx.
 */
import { ReactNode, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button, TONES, Tone, cn } from '@/components/dashboard/ui'

/** ds-input at a 16px font size (no iOS zoom). Use on inputs, selects and textareas. */
export const INPUT = 'ds-input !text-base'

/** Coloured numbers/icons that stay readable in the light theme (dark tint on light, bright on dark). */
export const NUM = {
  green: 'text-emerald-400 [:root:not(.dark)_&]:text-emerald-700',
  purple: 'text-violet-400 [:root:not(.dark)_&]:text-violet-700',
  amber: 'text-amber-400 [:root:not(.dark)_&]:text-amber-700',
  cyan: 'text-sky-400 [:root:not(.dark)_&]:text-sky-700',
  red: 'text-red-400 [:root:not(.dark)_&]:text-red-700',
  pink: 'text-pink-400 [:root:not(.dark)_&]:text-pink-700',
  orange: 'text-orange-400 [:root:not(.dark)_&]:text-orange-700',
} as const

/** Table classes. Header styling itself comes from `.data-table` (globals.css). */
export const TH = 'px-4 py-3 text-left whitespace-nowrap'
export const TD = 'px-4 py-3 align-middle'

/* ───────────────────────── icon buttons ───────────────────────── */
type IconTone = 'neutral' | 'green' | 'red' | 'cyan'
const ICON_TONE: Record<IconTone, string> = {
  neutral: 'bg-surface-elevated border border-border-subtle text-secondary hover:text-primary hover:brightness-110',
  green: `bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 ${NUM.green}`,
  red: `bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 ${NUM.red}`,
  cyan: `bg-sky-500/10 border border-sky-500/25 hover:bg-sky-500/20 ${NUM.cyan}`,
}

export function IconBtn({ tone = 'neutral', label, onClick, children, size = 'md', disabled, className }: {
  tone?: IconTone; label: string; onClick?: () => void; children: ReactNode; size?: 'md' | 'lg'; disabled?: boolean; className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={cn(
        'inline-flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
        size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-xl',
        ICON_TONE[tone], className)}>
      {children}
    </button>
  )
}

/* ───────────────────────── switch ───────────────────────── */
function SwitchKnob({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="relative inline-block w-11 h-6 rounded-full flex-shrink-0 transition-colors"
      style={{ background: on ? 'var(--ds-accent)' : 'var(--border-strong)' }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </span>
  )
}

/** Bare switch (for table cells). */
export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={onToggle}
      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60">
      <SwitchKnob on={on} />
    </button>
  )
}

/** Whole row is the switch: label + optional hint on the left, knob on the right. */
export function SwitchRow({ on, onToggle, label, hint, className }: { on: boolean; onToggle: () => void; label: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle}
      className={cn('w-full flex items-center justify-between gap-4 min-h-[52px] px-4 py-3 rounded-2xl text-left transition-colors',
        'bg-surface-elevated border border-border-subtle hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60', className)}>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-primary leading-snug">{label}</span>
        {hint && <span className="block text-[13px] text-secondary mt-0.5 leading-snug">{hint}</span>}
      </span>
      <SwitchKnob on={on} />
    </button>
  )
}

/* ───────────────────────── modal ───────────────────────── */
/** Viewport-fitting modal: fixed header + footer, body scrolls internally. */
export function AdminModal({ title, subtitle, onClose, closeOnBackdrop, maxWidth = 'max-w-lg', children, footer }: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; closeOnBackdrop?: boolean; maxWidth?: string; children: ReactNode; footer?: ReactNode
}) {
  // lock page scroll behind the modal
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(3,6,15,0.66)' }}
      onClick={closeOnBackdrop ? onClose : undefined}>
      <motion.div role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className={cn('ds-card w-full flex flex-col overflow-hidden max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-48px)]', maxWidth)}
        style={{ boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7)' }}>
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-border-subtle">
          <div className="min-w-0">
            <h3 className="text-[18px] sm:text-[20px] font-bold text-primary tracking-tight leading-snug break-words">{title}</h3>
            {subtitle && <p className="mt-1 text-[13px] text-secondary leading-snug">{subtitle}</p>}
          </div>
          <IconBtn label="Close" onClick={onClose} className="-mr-1.5 -mt-1"><X className="w-5 h-5" /></IconBtn>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-border-subtle">{footer}</div>}
      </motion.div>
    </div>
  )
}

/** Save / Cancel footer used by every editor modal. */
export function ModalActions({ onSave, onCancel, saving, saveLabel }: { onSave: () => void; onCancel: () => void; saving?: boolean; saveLabel: string }) {
  return (
    <div className="flex gap-3">
      <Button variant="primary" onClick={onSave} disabled={saving} className="flex-1">
        {saving
          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
          : saveLabel}
      </Button>
      <Button variant="secondary" onClick={onCancel} className="flex-1 sm:flex-none">Cancel</Button>
    </div>
  )
}

/* ───────────────────────── misc ───────────────────────── */
/** Card that holds a wide table: scrolls horizontally inside, never the page. */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('ds-card overflow-hidden', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

/** Muted skeleton rows for list/table loading states. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-surface-elevated animate-pulse" />)}
    </div>
  )
}

/** Soft tinted callout (info / warning). */
export function Callout({ tone = 'cyan', icon, title, children }: { tone?: Tone; icon?: ReactNode; title?: ReactNode; children: ReactNode }) {
  const t = TONES[tone]
  return (
    <div className="rounded-2xl p-4 flex gap-3" style={{ background: t.bg, boxShadow: `inset 0 0 0 1px ${t.ring}` }}>
      {icon && <span className="flex-shrink-0 mt-0.5" style={{ color: t.fg }}>{icon}</span>}
      <div className="min-w-0 text-[13px] leading-relaxed text-secondary">
        {title && <p className="text-[14px] font-semibold text-primary mb-0.5">{title}</p>}
        {children}
      </div>
    </div>
  )
}
