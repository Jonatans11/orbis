/**
 * Biometric authentication (expo-local-authentication).
 * Face ID / Touch ID / Android fingerprint & face unlock.
 */
import * as LocalAuthentication from 'expo-local-authentication';

import { SecureKeys, secureGet, secureSet } from '@/storage/secureStore';

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  label: string;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return { available: false, enrolled: false, label: 'Biometrics' };

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'Face ID'
    : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? 'Fingerprint'
      : 'Biometrics';

  return { available: true, enrolled, label };
}

/** Prompt the user for biometric unlock. Returns true when authenticated. */
export async function authenticateWithBiometrics(reason = 'Unlock your ORBIS.ID wallet'): Promise<boolean> {
  const capability = await getBiometricCapability();
  if (!capability.available || !capability.enrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  return (await secureGet(SecureKeys.biometricsEnabled)) === 'true';
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  await secureSet(SecureKeys.biometricsEnabled, enabled ? 'true' : 'false');
}
