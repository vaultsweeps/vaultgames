/**
 * Returns the correct Signal contact info based on the current local time:
 *  - 04:00 – 16:00  →  Vaulter.39   (day shift)
 *  - 16:01 – 03:59  →  vaultsweeps.70  (night shift)
 *
 * NOTE: Signal deep links require the full shareable link from the Signal app
 * (Settings → Profile → QR Code / Share Link). Until those are provided,
 * clicking will copy the username to clipboard.
 *
 * To get the real link: Open Signal → Settings → Profile → Share → Copy link
 * Replace the placeholder URLs below with the actual signal.me links.
 */

export interface SignalContact {
  url: string        // The full signal.me deep link from the app
  username: string   // Username to display / copy as fallback
}

const DAY_CONTACT: SignalContact = {
  url: 'https://signal.me/#p/Vaulter.39',   // ⚠️ Replace with real link from Signal app
  username: 'Vaulter.39',
}

const NIGHT_CONTACT: SignalContact = {
  url: 'https://signal.me/#eu/h6jF1V-z5XHmi-mxBJJD0kPXM00MG0flLMaLaf6bwP2TflRKflpPlYf1WdGT1ksM',
  username: 'vaultsweeps.70',
}

export function getSignalContact(): SignalContact {
  const h = new Date().getHours()
  const m = new Date().getMinutes()
  const isDayShift = (h > 4 || (h === 4 && m >= 0)) && (h < 16 || (h === 16 && m === 0))
  return isDayShift ? DAY_CONTACT : NIGHT_CONTACT
}

/** Legacy: returns just the URL string */
export function getSignalUrl(): string {
  return getSignalContact().url
}
