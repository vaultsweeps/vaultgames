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
  resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean>;
  forcePlayerOffline(userId: string): Promise<boolean>;
  getProviderId(): string;
}
