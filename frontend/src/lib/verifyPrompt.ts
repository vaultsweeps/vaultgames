// "Verify your account" popup shown after a sign-up that included a coupon code.
// requestVerifyPrompt() is called right after the new account is signed in; <VerifyCouponPopup /> (mounted once in the
// root layout) listens for it. The flag is also kept in localStorage so the popup still appears if the page reloads first.
export const VERIFY_PROMPT_KEY = 'vs_verify_prompt'
export const VERIFY_PROMPT_EVENT = 'vs:verify-prompt'

export function requestVerifyPrompt() {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(VERIFY_PROMPT_KEY, '1') } catch {}
  window.dispatchEvent(new Event(VERIFY_PROMPT_EVENT))
}

export function clearVerifyPrompt() {
  try { localStorage.removeItem(VERIFY_PROMPT_KEY) } catch {}
}
