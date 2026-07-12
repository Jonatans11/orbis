import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function OnboardingScreen() {
  const navigation = useNavigation();

  return (
    <Screen scroll={false} withBottomInset style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>◉</Text>
        </View>
        <Text style={styles.title}>ORBIS.ID</Text>
        <Text style={styles.subtitle}>
          Your identity. Your data. Your terms.{'\n'}One verifiable digital identity —
          owned by you, not a platform.
        </Text>
        <View style={styles.badges}>
          <Badge label="Self-sovereign" tone="primary" />
          <Badge label="Zero-knowledge" tone="success" />
          <Badge label="W3C DID/VC" tone="neutral" />
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          title="Create your identity"
          onPress={() => navigation.navigate('Login', { mode: 'register' })}
        />
        <Button
          title="I already have an account"
          variant="secondary"
          onPress={() => navigation.navigate('Login', { mode: 'login' })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  mark: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: colors.accent, fontSize: 40 },
  title: {
    color: colors.text,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },
  badges: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap', justifyContent: 'center' },
  actions: { gap: spacing[3], paddingBottom: spacing[4] },
});
