// Must match MIN_WITHDRAWAL_USD in backend/src/controllers/withdrawalController.ts (the server enforces it)
export const MIN_WITHDRAWAL_USD = 50
export const MIN_WITHDRAWAL_MESSAGE = `Minimum withdrawal is $${MIN_WITHDRAWAL_USD}. You need at least $${MIN_WITHDRAWAL_USD} in your wallet to cash out.`
