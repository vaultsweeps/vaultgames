export interface ProviderAdapter {
  createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }>;
  rechargePlayer(userId: string, amount: number, orderId: string): Promise<any>;
  withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any>;
  getPlayerBalance(userId: string): Promise<number>;
  getAgentBalance(): Promise<number>;
  getPlayerIdByUsername(username: string): Promise<string>;
  resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean>;
  forcePlayerOffline(userId: string): Promise<boolean>;
  getProviderId(): string;
}
