export interface ProviderAdapter {
  createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }>;
  rechargePlayer(userId: string, amount: number, orderId: string): Promise<any>;
  withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any>;
  getPlayerBalance(userId: string): Promise<number>;
  getAgentBalance(): Promise<number>;
  getPlayerIdByUsername(username: string): Promise<string>;
  /**
   * true only when getPlayerIdByUsername really asks the provider and throws for an unknown name. Most adapters just
   * echo the name back, so "no error" proves nothing there — sign-up must not read that as "already taken".
   */
  readonly supportsUsernameLookup?: boolean;
  /**
   * `interactive: true` means the player pressed "Reset password" and the new password is shown to them. Adapters that can
   * only reset in that case (CashMachine / CashFrenzy) ignore calls without it, e.g. the background sync after a site
   * password change, so those flows behave exactly as before.
   */
  resetPlayerPassword(userId: string, newPassword?: string, opts?: { interactive?: boolean }): Promise<boolean>;
  /** A new password that satisfies this provider's own password rules, for the Reset password button (optional) */
  generateResetPassword?(): string;
  forcePlayerOffline(userId: string): Promise<boolean>;
  getProviderId(): string;
}
