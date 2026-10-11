import { randomInt } from 'crypto'

// Look-alike characters (I, l, 1, O, 0) are left out so a password is easy to read out and type
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'

const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)])

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/**
 * A short, easy-to-read random password used by "Reset password": letters and digits only, with at least one
 * upper-case letter, one lower-case letter and one digit. 7 characters by default — inside every game provider's
 * accepted range (UltraPanda/VBlink 6–16, Yolo777 6–24, Cash Frenzy 6–16, Cash Machine/Game Room 6–12).
 */
export function generateShortPassword(length = 7): string {
  const len = Math.max(6, length)
  const upper = 2
  const digits = 2
  return shuffle([...pick(UPPER, upper), ...pick(DIGITS, digits), ...pick(LOWER, len - upper - digits)]).join('')
}

/** Same idea for providers that insist on a special symbol (Cash Machine / Game Room): 7 characters with one "@" */
export function generateShortPasswordWithSymbol(length = 7): string {
  const len = Math.max(6, length)
  return shuffle([...pick(UPPER, 2), ...pick(DIGITS, 1), '@', ...pick(LOWER, len - 4)]).join('')
}
