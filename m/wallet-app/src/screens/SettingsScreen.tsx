import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Sheet } from '@/components/Sheet';
import { useAuth } from '@/context/AuthContext';
import { monetizeCopy } from '@/features/vault/copy';
import { isMonetizationEnabled, setMonetizationEnabled } from '@/features/vault/session';
import {
  getBiometricCapability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from '@/services/biometrics';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [biometricsOn, setBiometricsOn] = useState(false);
  const [monetizationOn, setMonetizationOn] = useState(false);
  const [monetizeSheetOpen, setMonetizeSheetOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const capability = await getBiometricCapability();
      setBiometricsAvailable(capability.available && capability.enrolled);
      setBiometricLabel(capability.label);
      setBiometricsOn(await isBiometricUnlockEnabled());
      setMonetizationOn(await isMonetizationEnabled());
    })();
  }, []);

  const toggleBiometrics = async (value: boolean) => {
    setBiometricsOn(value);
    await setBiometricUnlockEnabled(value);
  };

  // Master monetization switch (spec 07 §6): explainer sheet before first enable.
  const toggleMonetization = (value: boolean) => {
    if (value) {
      setMonetizeSheetOpen(true);
      return;
    }
    setMonetizationOn(false);
    void setMonetizationEnabled(false);
  };

  const confirmMonetization = () => {
    setMonetizationOn(true);
    void setMonetizationEnabled(true);
    setMonetizeSheetOpen(false);
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

      <SectionHeader title="Privacy & data" />
      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchMeta}>
            <Text style={styles.rowLabel}>Data monetization</Text>
            <Text style={styles.rowHint}>
              Request payment when someone asks for access to your data. Off by default.
            </Text>
          </View>
          <Switch
            value={monetizationOn}
            onValueChange={toggleMonetization}
            trackColor={{ true: colors.premium }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="All shares"
          onPress={() => navigation.navigate('AllShares')}
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressedRow]}
        >
          <View style={styles.switchMeta}>
            <Text style={styles.rowLabel}>All shares</Text>
            <Text style={styles.rowHint}>Every grant you've made — active, expired, revoked.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Card>

      <View style={styles.footer}>
        <Button title="Sign out" variant="danger" onPress={() => void signOut()} />
      </View>

      <Sheet
        visible={monetizeSheetOpen}
        onClose={() => setMonetizeSheetOpen(false)}
        title="Data monetization"
      >
        <Text style={styles.explainer}>{monetizeCopy.explainer}</Text>
        <Button title={monetizeCopy.turnOn} onPress={confirmMonetization} style={styles.sheetBtn} />
        <Button
          title={monetizeCopy.notNow}
          variant="ghost"
          onPress={() => setMonetizeSheetOpen(false)}
        />
      </Sheet>
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
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[3],
  },
  pressedRow: { opacity: 0.7 },
  explainer: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 21 },
  sheetBtn: { marginTop: spacing[4], marginBottom: spacing[2] },
  footer: { marginTop: spacing[8] },
});
