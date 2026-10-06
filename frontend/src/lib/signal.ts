/**
 * Signal contact for the current staff shift, decided by New York time (not the customer's own clock, so
 * every customer is routed to whoever is actually on shift):
 *  - 04:00 – 15:59 New York time → day shift
 *  - 16:00 – 03:59 New York time → night shift
 */

export interface SignalContact {
  url: string        // The full signal.me deep link from the app
  username: string   // Username to display / copy as fallback
  shift: 'day' | 'night'
}

const DAY_CONTACT: SignalContact = {
  url: 'https://signal.me/#eu/h6jF1V-z5XHmi-mxBJJD0kPXM00MG0flLMaLaf6bwP2TflRKflpPlYf1WdGT1ksM',
  username: 'vaultsweeps.70',
  shift: 'day',
}

const NIGHT_CONTACT: SignalContact = {
  url: 'https://signal.me/#eu/SwIeIDifkOIWnBifem2b2MGct4TbojFKQkY1BOesAvZaKX2qaxdM3IohLtupoSmK',
  username: 'Vaulter.39',
  shift: 'night',
}

function newYorkHour(now: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(now)
  return Number(hour)
}

export function getSignalContact(now: Date = new Date()): SignalContact {
  const h = newYorkHour(now)
  return h >= 4 && h < 16 ? DAY_CONTACT : NIGHT_CONTACT
}

/** Legacy: returns just the URL string */
export function getSignalUrl(): string {
  return getSignalContact().url
}
