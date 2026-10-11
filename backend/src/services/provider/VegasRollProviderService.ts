import { CashMachineProviderService } from './CashMachineProviderService';
import { generateShortPassword } from '../../utils/password';

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
  // Same game software as Cash Machine, so it gets the real "Reset password" too. Its own server has not been confirmed to
  // offer the call, so if it turns out not to, the player is told the game doesn't support resets instead of seeing an error.
  protected readonly resetMayBeMissing: boolean = true;

  // Vegas Roll's own rule (its server answers: "Password can only be letters and numbers, and must be between 6 and 16 characters")
  protected readonly passwordRule: RegExp = /^[A-Za-z0-9]{6,16}$/;
  protected readonly passwordRuleHint: string = '6 to 16 letters and numbers only';

  generateResetPassword(): string {
    return generateShortPassword(7); // letters and digits only, e.g. "kA7mX3e"
  }
}
