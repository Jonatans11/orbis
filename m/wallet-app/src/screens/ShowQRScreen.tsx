import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShowQR'>;

/** Present your DID (or an arbitrary payload) as a QR code. */
export function ShowQRScreen({ route }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const payload = route.params?.payload ?? user?.did ?? 'orbisid://no-did';

  return (
    <Screen scroll={false} withBottomInset style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>Your identity QR</Text>
        <View style={styles.qrWrap}>
          <QRCode value={payload} size={220} backgroundColor="#FFFFFF" color="#0B1020" />
        </View>
        <Text style={styles.payload} numberOfLines={2}>
          {payload}
        </Text>
        <Text style={styles.hint}>
          Only your public identifier is shared — never your keys or personal data.
        </Text>
      </View>
      <Button title="Close" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
  qrWrap: {
    backgroundColor: '#FFFFFF',
    padding: spacing[4],
    borderRadius: radius.xl,
  },
  payload: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingHorizontal: spacing[6],
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingHorizontal: spacing[6],
  },
});
