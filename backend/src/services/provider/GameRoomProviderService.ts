import { CashMachineProviderService } from './CashMachineProviderService';
import { Provider } from '@prisma/client';

/**
 * GameRoomProviderService
 *
 * GameRoom (gameroom777.com) uses an API that is structurally identical to
 * CashMachine (cashmachine777.com). The only difference is the base URL and
 * credentials, which come from the Provider DB record (set via seed script
 * or admin panel — never hardcoded here):
 *
 *   agentId    → stored in Provider.agentId  (DB)
 *   secretKey  → stored in Provider.secretKey (DB)
 *   apiBaseUrl → "https://agentserver1.gameroom777.com"
 *
 * All logic is inherited from CashMachineProviderService — no override needed.
 */
export class GameRoomProviderService extends CashMachineProviderService {
  constructor(provider: Provider) {
    super(provider);
  }
}
