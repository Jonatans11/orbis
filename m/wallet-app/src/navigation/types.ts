import type { NavigatorScreenParams } from '@react-navigation/native';

import type { VaultCategoryId } from '@/services/walletApi';

export type MainTabsParamList = {
  Home: undefined;
  Credentials: undefined;
  Vault: undefined;
  Messages: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: { mode?: 'login' | 'register' } | undefined;
  Locked: undefined;
  Main: NavigatorScreenParams<MainTabsParamList>;
  ScanQR: undefined;
  ShowQR: { payload?: string } | undefined;
  // Data Vault & consent (spec 07)
  VaultCategory: { category: VaultCategoryId };
  VaultRecord: { recordId: string; title?: string };
  VaultShare: { recordId: string; recordTitle?: string; granteeDid?: string };
  AllShares: undefined;
  Compensation: undefined;
  ShareRedeem: { grantId: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
