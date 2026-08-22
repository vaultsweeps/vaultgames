import { CashMachineProviderService } from './CashMachineProviderService';
import { Provider } from '@prisma/client';

/**
 * GameRoomProviderService
 *
 * GameRoom (gameroom777.com) uses an API that is structurally identical to
 * CashMachine (cashmachine777.com). The only difference is the base URL and
 * credentials, which come from the Provider DB record:
 *
 *   agentId    → "VegasG01"
 *   secretKey  → "AbcD1122@@"
 *   apiBaseUrl → "https://agentserver1.gameroom777.com"
 *
 * All logic is inherited from CashMachineProviderService — no override needed.
 */
export class GameRoomProviderService extends CashMachineProviderService {
  constructor(provider: Provider) {
    super(provider);
  }
}
