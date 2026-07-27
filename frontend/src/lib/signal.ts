/**
 * Returns the correct Signal contact URL based on the current local time:
 *  - 04:00 – 16:00  →  https://signal.me/#eu/Vaulter.39   (day shift)
 *  - 16:01 – 03:59  →  https://signal.me/#eu/vaultsweeps.70  (night shift)
 *
 * Signal username links use the format: https://signal.me/#eu/<username>
 */
export function getSignalUrl(): string {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  // Day shift: 04:00 (inclusive) → 16:00 (inclusive, i.e. up to 16:00)
  const isDayShift = (h > 4 || (h === 4 && m >= 0)) && (h < 16 || (h === 16 && m === 0))
  return isDayShift
    ? 'https://signal.me/#eu/Vaulter.39'
    : 'https://signal.me/#eu/vaultsweeps.70'
}
