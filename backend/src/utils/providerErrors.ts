/**
 * Did a game provider reject createPlayer because that account name is already taken?
 * Providers word it differently ("Username Already Exists", "The account number already exists, please re-enter it!", …),
 * so match on the common phrase instead of one exact string. Callers then retry with a suffixed name.
 */
export function isDuplicateAccountError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? '')
  return /already\s+exist/i.test(msg)
}
