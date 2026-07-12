import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/context/AuthContext';
import { CredentialsScreen } from '@/screens/CredentialsScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { LockedScreen } from '@/screens/LockedScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { MessagesScreen } from '@/screens/MessagesScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ScanQRScreen } from '@/screens/ScanQRScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { ShowQRScreen } from '@/screens/ShowQRScreen';
import { AllSharesScreen } from '@/screens/vault/AllSharesScreen';
import { CompensationScreen } from '@/screens/vault/CompensationScreen';
import { ShareRedeemScreen } from '@/screens/vault/ShareRedeemScreen';
import { VaultCategoryScreen } from '@/screens/vault/VaultCategoryScreen';
import { VaultHomeScreen } from '@/screens/vault/VaultHomeScreen';
import { VaultRecordScreen } from '@/screens/vault/VaultRecordScreen';
import { VaultShareScreen } from '@/screens/vault/VaultShareScreen';
import { colors, navigationTheme } from '@/theme';
import type { MainTabsParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabsParamList>();

const tabIcons: Record<keyof MainTabsParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Credentials: 'id-card',
  Vault: 'lock-closed',
  Messages: 'chatbubbles',
  Settings: 'settings',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? tabIcons[route.name] : (`${tabIcons[route.name]}-outline` as keyof typeof Ionicons.glyphMap)}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Credentials" component={CredentialsScreen} />
      <Tabs.Screen name="Vault" component={VaultHomeScreen} />
      <Tabs.Screen name="Messages" component={MessagesScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { status } = useAuth();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'onboarding' || status === 'loading' ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        ) : status === 'locked' ? (
          <Stack.Screen name="Locked" component={LockedScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="ScanQR"
              component={ScanQRScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="ShowQR"
              component={ShowQRScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="VaultCategory" component={VaultCategoryScreen} />
            <Stack.Screen name="VaultRecord" component={VaultRecordScreen} />
            <Stack.Screen name="VaultShare" component={VaultShareScreen} />
            <Stack.Screen name="AllShares" component={AllSharesScreen} />
            <Stack.Screen name="Compensation" component={CompensationScreen} />
            <Stack.Screen name="ShareRedeem" component={ShareRedeemScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
