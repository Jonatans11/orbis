import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

/**
 * QR scanner — entry point for credential issuance offers, presentation
 * requests, and DIDComm out-of-band invitations.
 */
export function ScanQRScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const onScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    // Phase 2: route to credential-offer / presentation / OOB handlers.
    Alert.alert('QR code scanned', data.slice(0, 200), [
      { text: 'Scan again', onPress: () => setScanned(false) },
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
  };

  if (!permission) {
    return (
      <Screen scroll={false} style={styles.center}>
        <Text style={styles.hint}>Checking camera permission…</Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen scroll={false} style={styles.center}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.hint}>
          ORBIS.ID uses the camera only to scan QR codes for credential exchange.
        </Text>
        <View style={styles.actions}>
          <Button title="Allow camera" onPress={() => void requestPermission()} />
          <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScan}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.overlayHint}>Point at an ORBIS.ID QR code</Text>
        <Button title="Close" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', gap: spacing[3] },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  hint: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  actions: { gap: spacing[2], marginTop: spacing[4] },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    padding: spacing[6],
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    backgroundColor: 'transparent',
  },
  overlayHint: { color: colors.text, fontSize: fontSize.sm },
});
