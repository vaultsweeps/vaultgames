import type { ProviderAdapter } from '../services/provider/ProviderAdapter'

/** Starting password of every new game account (the player is encouraged to change it with "Reset password") */
export const STARTING_GAME_PASSWORD = 'Vault123!'
/** Same password without the symbol, for games that only accept letters and numbers (e.g. Vegas Roll) */
export const STARTING_GAME_PASSWORD_PLAIN = 'Vault123'

/**
 * Creates a game account that starts with STARTING_GAME_PASSWORD. If the game refuses that password because of its own
 * style rule ("letters and numbers only", length, format…) it is created once more with the plain version. Returns the
 * created account AND the password that was really used, which is what must be stored and shown to the player.
 * Any other failure (taken username, agent login problem, network…) is thrown unchanged so callers keep their own handling.
 */
export async function createPlayerWithStartingPassword(provider: ProviderAdapter, username: string) {
  try {
    const data = await provider.createPlayer(username, STARTING_GAME_PASSWORD)
    return { data, password: STARTING_GAME_PASSWORD }
  } catch (err: any) {
    const msg = String(err?.message ?? '')
    const duplicate = /already\s+exist/i.test(msg)
    const loginProblem = /agent|credential|temporarily unavailable|connection/i.test(msg)
    const passwordStyleProblem = /password|passwd|pwd|Code:\s*(8|9)(?!\d)|format/i.test(msg)
    if (duplicate || loginProblem || !passwordStyleProblem) throw err
    const data = await provider.createPlayer(username, STARTING_GAME_PASSWORD_PLAIN)
    return { data, password: STARTING_GAME_PASSWORD_PLAIN }
  }
}
