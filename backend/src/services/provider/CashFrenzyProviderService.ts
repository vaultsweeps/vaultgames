import { randomBytes } from 'crypto';
import { CashMachineProviderService } from './CashMachineProviderService';

/**
 * CashFrenzyProviderService
 *
 * CashFrenzy uses an API that is structurally identical to CashMachine.
 * The only difference is the base URL and credentials, which come from
 * the Provider DB record (set via admin panel — never hardcoded here):
 *
 *   agentId    → stored in Provider.agentId  (DB)
 *   secretKey  → stored in Provider.secretKey (DB)
 *   apiBaseUrl → e.g. "https://agentserver.cashfrenzy777.com"
 *
 * All logic is inherited from CashMachineProviderService except the "Reset password" password format: Cash Frenzy
 * accepts a plain 6–16 character password (the one it has always been given), whereas Cash Machine insists on upper
 * and lower case letters plus a special symbol.
 */
export class CashFrenzyProviderService extends CashMachineProviderService {
  protected readonly passwordRule: RegExp = /^\S{6,16}$/;
  protected readonly passwordRuleHint: string = '6 to 16 characters with no spaces';

  generateResetPassword(): string {
    return 'Nx' + randomBytes(6).toString('hex'); // 14 characters, e.g. "Nx1a2b3c4d5e6f" — unchanged from before
  }
}
