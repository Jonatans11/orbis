/**
 * Vault session state:
 *  - biometric re-gate — the vault is the most sensitive tab; entry requires
 *    fresh biometric auth when the last one is older than 5 minutes (spec 07 §1.1)
 *  - monetization preferences (master switch + per-record flags, spec 07 §6)
 */
import { authenticateWithBiometrics, getBiometricCapability } from '@/services/biometrics';
import { SecureKeys, secureGet, secureSet } from '@/storage/secureStore';

const VAULT_AUTH_TTL_MS = 5 * 60 * 1000;

let lastVaultAuthAt = 0;

export function needsVaultAuth(now: number = Date.now()): boolean {
  return now - lastVaultAuthAt > VAULT_AUTH_TTL_MS;
}

export function markVaultAuth(now: number = Date.now()): void {
  lastVaultAuthAt = now;
}

/**
 * Run the vault biometric gate. Devices without enrolled biometrics fall
 * through (the app-level lock already covers them) rather than dead-ending.
 */
export async function runVaultGate(): Promise<boolean> {
  if (!needsVaultAuth()) return true;
  const capability = await getBiometricCapability();
  if (!capability.available || !capability.enrolled) {
    markVaultAuth();
    return true;
  }
  const ok = await authenticateWithBiometrics('Unlock your data vault');
  if (ok) markVaultAuth();
  return ok;
}

// ---------------------------------------------------------------------------
// Monetization preferences
//
// The master switch is a device preference and stays local. Per-record
// consent is server-authoritative: PATCH /api/wallet/vault/:recordId/consent
// via walletApi.setConsent — the old local per-record map is gone.
// ---------------------------------------------------------------------------

export async function isMonetizationEnabled(): Promise<boolean> {
  return (await secureGet(SecureKeys.monetizationEnabled)) === 'true';
}

export async function setMonetizationEnabled(enabled: boolean): Promise<void> {
  await secureSet(SecureKeys.monetizationEnabled, enabled ? 'true' : 'false');
}
