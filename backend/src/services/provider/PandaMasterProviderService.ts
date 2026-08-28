import { CashMachineProviderService } from './CashMachineProviderService';
import { Provider } from '@prisma/client';

/**
 * PandaMasterProviderService
 *
 * Panda Master uses an API that is structurally identical to
 * CashMachine (cashmachine777.com). Endpoints are:
 *
 *   POST /api/agent/login        → JWT Bearer token
 *   GET  /api/player/playerList  → paginated player list
 *   POST /api/player/insertPlayer
 *   GET  /api/player/getScore?id=...
 *   POST /api/player/playerRecharge
 *   POST /api/player/playerWithdraw
 *
 * Provider DB config (set via admin panel or seed script — never hardcoded):
 *   agentId    → stored in Provider.agentId   (agent username, e.g. "vault687")
 *   secretKey  → stored in Provider.secretKey  (agent password, e.g. "Joker_123")
 *   apiBaseUrl → stored in Provider.apiBaseUrl  (e.g. "https://agentserver.pandamaster.vip")
 *
 * All logic is inherited from CashMachineProviderService — no override needed.
 */
export class PandaMasterProviderService extends CashMachineProviderService {
  constructor(provider: Provider) {
    super(provider);
  }
}
