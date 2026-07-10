import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function LockedScreen() {
  const { unlock, signOut } = useAuth();

  useEffect(() => {
    // Prompt biometrics immediately on mount.
    void unlock();
  }, [unlock]);

  return (
    <Screen scroll={false} withBottomInset style={styles.container}>
      <View style={styles.center}>
        <Ionicons name="finger-print" size={64} color={colors.accent} />
        <Text style={styles.title}>Wallet locked</Text>
        <Text style={styles.subtitle}>Authenticate to access your identity.</Text>
      </View>
      <View style={styles.actions}>
        <Button title="Unlock" onPress={() => void unlock()} />
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  title: { color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm },
  actions: { gap: spacing[2], paddingBottom: spacing[4] },
});
