// "Verify your account" popup for coupons. Two ways it gets asked for:
//   'signup' — right after a sign-up that included a coupon code (the code is remembered and applied automatically once
//              the account is verified)
//   'redeem' — the player tried to use a coupon from the claim box without being verified (nothing was remembered, so
//              they enter the code again after verifying)
// requestVerifyPrompt() is called by those flows; <VerifyCouponPopup /> (mounted once in the root layout) listens for
// it. The reason is also kept in localStorage so the popup still appears if the page reloads first.
export const VERIFY_PROMPT_KEY = 'vs_verify_prompt'
export const VERIFY_PROMPT_EVENT = 'vs:verify-prompt'
export type VerifyPromptMode = 'signup' | 'redeem'

export function requestVerifyPrompt(mode: VerifyPromptMode = 'signup') {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(VERIFY_PROMPT_KEY, mode) } catch {}
  window.dispatchEvent(new Event(VERIFY_PROMPT_EVENT))
}

export function clearVerifyPrompt() {
  try { localStorage.removeItem(VERIFY_PROMPT_KEY) } catch {}
}

/** The reason stored by requestVerifyPrompt (an older stored "1" means sign-up), or null when nothing is waiting */
export function readVerifyPromptMode(): VerifyPromptMode | null {
  try {
    const v = localStorage.getItem(VERIFY_PROMPT_KEY)
    if (!v) return null
    return v === 'redeem' ? 'redeem' : 'signup'
  } catch { return null }
}
