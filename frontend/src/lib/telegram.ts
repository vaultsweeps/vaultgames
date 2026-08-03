export function getTelegramUrl(baseUrl: string, passedUser?: any): string {
  let user = passedUser;
  
  // If user is null (e.g. during initial render before Zustand hydrates),
  // try to fetch it directly from localStorage on the client side.
  if (!user && typeof window !== 'undefined') {
    try {
      const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
      if (authData?.state?.user) {
        user = authData.state.user;
      }
    } catch(e) {
      // Ignore errors
    }
  }

  if (!baseUrl) return '#';
  // A short-lived, single-use link token (minted by the backend on
  // getMe/dashboardInit) is used instead of the raw user ID — the ID isn't
  // secret, so embedding it directly would let anyone who learns a user's ID
  // DM the bot with `/start <id>` and hijack their Telegram account link.
  if (!user || !user.telegramLinkToken) return baseUrl;

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('start', user.telegramLinkToken);
    return url.toString();
  } catch (e) {
    // Fallback if baseUrl is not a valid full URL
    return `${baseUrl}?start=${user.telegramLinkToken}`;
  }
}
