import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAuth } from '@/context/AuthContext';
import {
  getBiometricCapability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from '@/services/biometrics';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [biometricsOn, setBiometricsOn] = useState(false);

  useEffect(() => {
    void (async () => {
      const capability = await getBiometricCapability();
      setBiometricsAvailable(capability.available && capability.enrolled);
      setBiometricLabel(capability.label);
      setBiometricsOn(await isBiometricUnlockEnabled());
    })();
  }, []);

  const toggleBiometrics = async (value: boolean) => {
    setBiometricsOn(value);
    await setBiometricUnlockEnabled(value);
  };

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>

      <SectionHeader title="Profile" />
      <Card style={styles.card}>
        <Row label="Name" value={user?.name ?? '—'} />
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Primary DID" value={user?.did ?? 'Not created yet'} />
      </Card>

      <SectionHeader title="Security" />
      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchMeta}>
            <Text style={styles.rowLabel}>{biometricLabel} unlock</Text>
            <Text style={styles.rowHint}>
              {biometricsAvailable
                ? 'Require biometric authentication to open the wallet.'
                : 'No biometrics enrolled on this device.'}
            </Text>
          </View>
          <Switch
            value={biometricsOn}
            onValueChange={(v) => void toggleBiometrics(v)}
            disabled={!biometricsAvailable}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </Card>

      <SectionHeader title="Data & privacy" />
      <Card style={styles.card}>
        <Text style={styles.rowHint}>
          Data monetization preferences, consent history, and GDPR export arrive with
          the Data Vault milestone.
        </Text>
      </Card>

      <View style={styles.footer}>
        <Button title="Sign out" variant="danger" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing[4],
  },
  card: { gap: spacing[3] },
  row: { gap: 2 },
  rowLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  rowValue: { color: colors.textMuted, fontSize: fontSize.sm },
  rowHint: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  switchMeta: { flex: 1, gap: 2 },
  footer: { marginTop: spacing[8] },
});
