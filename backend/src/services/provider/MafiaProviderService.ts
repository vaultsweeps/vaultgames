import { CashMachineProviderService } from './CashMachineProviderService';
import { Provider } from '@prisma/client';

/**
 * MafiaProviderService
 *
 * Mafia (mafia77777.com) uses an API that is structurally identical to
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
 *   agentId    → stored in Provider.agentId   (agent username)
 *   secretKey  → stored in Provider.secretKey  (agent password)
 *   apiBaseUrl → e.g. "https://agentserver.mafia77777.com"
 *
 * All logic is inherited from CashMachineProviderService — no override needed.
 */
export class MafiaProviderService extends CashMachineProviderService {
  constructor(provider: Provider) {
    super(provider);
  }
}
