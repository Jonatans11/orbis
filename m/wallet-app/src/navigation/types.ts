import type { NavigatorScreenParams } from '@react-navigation/native';

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
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
