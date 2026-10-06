'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  type CountryCode,
} from 'libphonenumber-js'
import examples from 'libphonenumber-js/examples.mobile.json'

export { isValidPhoneNumber }

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null

const COUNTRIES = getCountries()
  .map(code => ({ code, name: regionNames?.of(code) || code, dial: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name))

const Flag = ({ code }: { code: CountryCode }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt="" width={20} height={14} className="w-5 h-[14px] rounded-[2px] object-cover shrink-0" loading="lazy" />
)

interface Props {
  /** Full international number in E.164 form (e.g. "+12025550123"), or '' when empty */
  value: string
  onChange: (e164: string) => void
  onBlur?: () => void
  defaultCountry?: CountryCode
  /** Replaces the default field styling (background, border, radius) */
  className?: string
}

/** Country picker (flag + dial code) and a national-number field that formats as you type. */
export default function PhoneNumberInput({ value, onChange, onBlur, defaultCountry = 'US', className = 'bg-[#13131A] border border-transparent focus-within:border-neon-blue/50 rounded-xl' }: Props) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry)
  const [national, setNational] = useState('')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // A parent reset (form reset) clears the field
  useEffect(() => { if (!value) setNational('') }, [value])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const close = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const placeholder = useMemo(() => {
    const ex = getExampleNumber(country, examples as any)
    return ex ? ex.formatNational() : 'Phone number'
  }, [country])

  const emit = (c: CountryCode, text: string) => {
    const digits = text.replace(/\D/g, '')
    onChange(digits ? `+${getCountryCallingCode(c)}${digits}` : '')
  }

  const handleInput = (raw: string) => {
    // Pasting a full international number switches the country to match
    if (raw.trim().startsWith('+')) {
      const typer = new AsYouType()
      typer.input(raw)
      const detected = typer.getCountry()
      const nationalDigits = typer.getNationalNumber()
      if (detected && nationalDigits) {
        setCountry(detected)
        const formatted = new AsYouType(detected).input(nationalDigits)
        setNational(formatted)
        emit(detected, nationalDigits)
        return
      }
    }
    const digits = raw.replace(/\D/g, '').slice(0, 15)
    // Don't re-format while deleting a formatting character, otherwise backspace gets stuck on ")" or "-"
    const formatted = raw.length < national.length ? raw : new AsYouType(country).input(digits)
    setNational(formatted)
    emit(country, digits)
  }

  const pickCountry = (c: CountryCode) => {
    setCountry(c)
    setOpen(false)
    setQuery('')
    const digits = national.replace(/\D/g, '')
    setNational(digits ? new AsYouType(c).input(digits) : '')
    emit(c, digits)
  }

  const q = query.trim().toLowerCase().replace(/^\+/, '')
  const filtered = q
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.dial.startsWith(q) || c.code.toLowerCase() === q)
    : COUNTRIES

  return (
    <div ref={wrapRef} className={`relative flex items-stretch transition-all ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 pl-4 pr-2 text-sm text-white border-r border-white/10 shrink-0"
        aria-label="Select country code"
      >
        <Flag code={country} />
        <span className="text-secondary">+{getCountryCallingCode(country)}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        onChange={e => handleInput(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent px-3 py-3.5 text-sm text-white placeholder-muted focus:outline-none"
      />

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full max-w-xs bg-[#1C1C24] border border-border-strong rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
            <Search className="w-4 h-4 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="flex-1 bg-transparent text-sm text-white placeholder-muted focus:outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map(c => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => pickCountry(c.code)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-white/5 ${c.code === country ? 'text-neon-blue' : 'text-white'}`}
                >
                  <Flag code={c.code} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted">+{c.dial}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
