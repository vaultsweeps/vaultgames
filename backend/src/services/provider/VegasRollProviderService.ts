import { CashMachineProviderService } from './CashMachineProviderService';

/**
 * VegasRollProviderService
 *
 * VegasRoll uses an API that is structurally identical to CashMachine.
 * The only difference is the base URL and credentials, which come from
 * the Provider DB record (set via admin panel — never hardcoded here):
 *
 *   agentId    → stored in Provider.agentId  (DB)
 *   secretKey  → stored in Provider.secretKey (DB)
 *   apiBaseUrl → e.g. "https://agentserver.vegasroll777.com"
 *
 * All logic is inherited from CashMachineProviderService — no override needed.
 */
export class VegasRollProviderService extends CashMachineProviderService {
  // Inherits all properties and methods from CashMachineProviderService
}
