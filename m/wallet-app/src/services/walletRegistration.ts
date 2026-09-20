/**
 * One-time wallet/device registration with the backend.
 *
 * POST /api/wallet/register binds this installation to the signed-in user
 * and returns { walletId, deviceId }. The deviceId is then sent on every
 * request as X-Orbis-Device-Id (see services/api.ts) for device binding.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { walletApi } from '@/services/walletApi';
import { SecureKeys, secureGet, secureSet } from '@/storage/secureStore';

export async function ensureWalletRegistered(): Promise<void> {
  const existing = await secureGet(SecureKeys.deviceId);
  if (existing) return;
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const res = await walletApi.register({
    deviceName: Constants.deviceName ?? undefined,
    platform,
  });
  await secureSet(SecureKeys.walletId, res.walletId);
  await secureSet(SecureKeys.deviceId, res.deviceId);
}
