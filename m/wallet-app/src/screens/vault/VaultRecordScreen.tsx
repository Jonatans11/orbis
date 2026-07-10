import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { Sheet } from '@/components/Sheet';
import { GrantRow } from '@/components/vault/GrantRow';
import { grantCopy, monetizeCopy, recordCopy } from '@/features/vault/copy';
import { parseServerDate, truncateDid } from '@/features/vault/format';
import {
  isMonetizationEnabled,
  isRecordMonetizable,
  setRecordMonetizable,
} from '@/features/vault/session';
import { decryptRecordPayload, deleteRecordKey, type VaultRecordPayload } from '@/services/vaultCrypto';
import {
  parseMeta,
  walletApi,
  type Grant,
  type VaultRecordMeta,
  type VaultRecordRow,
} from '@/services/walletApi';
import type { RootStackParamList } from '@/navigation/types';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type RecordRoute = RouteProp<RootStackParamList, 'VaultRecord'>;
type DecryptState = 'loading' | 'ok' | 'failed';

export function VaultRecordScreen() {
  const route = useRoute<RecordRoute>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { recordId } = route.params;

  const [record, setRecord] = useState<VaultRecordRow | null>(null);
  const [meta, setMeta] = useState<VaultRecordMeta>({ title: route.params.title ?? '…', type: '' });
  const [payload, setPayload] = useState<VaultRecordPayload | null>(null);
  const [decryptState, setDecryptState] = useState<DecryptState>('loading');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [accessLogGrant, setAccessLogGrant] = useState<Grant | null>(null);
  const [monetizable, setMonetizable] = useState(false);
  const [monetizeConfirmOpen, setMonetizeConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [recordRes, grantsRes, recMonetizable] = await Promise.all([
        walletApi.getRecord(recordId, true),
        walletApi.listGrants(recordId),
        isRecordMonetizable(recordId),
      ]);
      setRecord(recordRes.record);
      setMeta(parseMeta(recordRes.record.meta_json));
      setGrants(grantsRes);
      setMonetizable(recMonetizable);
      if (recordRes.record.ciphertext && recordRes.record.iv) {
        try {
          const decrypted = await decryptRecordPayload(recordId, {
            ciphertext: recordRes.record.ciphertext,
            iv: recordRes.record.iv,
            alg: 'A256GCM',
          });
          setPayload(decrypted);
          setDecryptState('ok');
        } catch {
          setDecryptState('failed');
        }
      } else {
        setDecryptState('failed');
      }
    } catch {
      Alert.alert('Record unavailable', 'Could not load this record.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [navigation, recordId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const retryDecrypt = () => {
    setDecryptState('loading');
    void load();
  };

  const revoke = useCallback((grant: Grant) => {
    Alert.alert('Revoke access', grantCopy.revokeConfirm(truncateDid(grant.grantee_did)), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await walletApi.revokeGrant(grant.grant_id);
              setGrants((prev) =>
                prev.map((g) => (g.grant_id === grant.grant_id ? { ...g, revoked: 1 } : g)),
              );
              AccessibilityInfo.announceForAccessibility('Access revoked');
            } catch {
              Alert.alert('Revoke failed', 'Please check your connection and try again.');
            }
          })();
        },
      },
    ]);
  }, []);

  const exportRecord = () => {
    Alert.alert('Export record?', `${recordCopy.exportWarning}. Anyone with the exported file can read it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Export',
        onPress: () => {
          void (async () => {
            if (!payload) return;
            try {
              const safeName = (meta.title || 'record').replace(/[^\w.-]+/g, '_').slice(0, 60);
              let fileUri: string;
              if (payload.kind === 'image' || payload.kind === 'file') {
                const ext =
                  payload.fileName?.split('.').pop() ??
                  (payload.kind === 'image' ? 'jpg' : 'bin');
                fileUri = `${FileSystem.cacheDirectory}${safeName}.${ext}`;
                await FileSystem.writeAsStringAsync(fileUri, payload.dataBase64 ?? '', {
                  encoding: FileSystem.EncodingType.Base64,
                });
              } else {
                fileUri = `${FileSystem.cacheDirectory}${safeName}.txt`;
                const text =
                  payload.kind === 'note'
                    ? (payload.note ?? '')
                    : (payload.fields ?? []).map((f) => `${f.key}: ${f.value}`).join('\n');
                await FileSystem.writeAsStringAsync(fileUri, text);
              }
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
              } else {
                Alert.alert('Sharing unavailable', 'This device cannot export files.');
              }
            } catch {
              Alert.alert('Export failed', 'Could not export this record.');
            }
          })();
        },
      },
    ]);
  };

  const deleteRecord = () => {
    Alert.alert('Delete record?', recordCopy.deleteConfirm, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await walletApi.deleteRecord(recordId);
              await deleteRecordKey(recordId);
              await setRecordMonetizable(recordId, false);
              navigation.goBack();
            } catch {
              Alert.alert('Delete failed', 'Please check your connection and try again.');
            }
          })();
        },
      },
    ]);
  };

  const toggleMonetize = async (next: boolean) => {
    if (!next) {
      setMonetizable(false);
      await setRecordMonetizable(recordId, false);
      return;
    }
    if (!(await isMonetizationEnabled())) {
      Alert.alert(
        'Data monetization is off',
        'Turn on data monetization in Settings → Privacy & data first.',
      );
      return;
    }
    setMonetizeConfirmOpen(true);
  };

  const confirmMonetize = async () => {
    setMonetizable(true);
    await setRecordMonetizable(recordId, true);
    setMonetizeConfirmOpen(false);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[2] }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.title} numberOfLines={2}>
            {meta.title}
          </Text>
          <Text style={styles.subtitle}>{meta.type}</Text>
        </View>
      </View>

      {/* Consent block — always visible, above content actions (spec 07 §3). */}
      <Card style={styles.consentCard}>
        {grants.length === 0 ? (
          <View style={styles.privateRow}>
            <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
            <Text style={styles.privateText}>{grantCopy.privateRecord}</Text>
          </View>
        ) : (
          grants.map((grant, i) => (
            <View key={grant.grant_id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <GrantRow grant={grant} onRevoke={revoke} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Viewed ${grant.access_count} times. Open access log`}
                onPress={() => setAccessLogGrant(grant)}
                style={({ pressed }) => [styles.viewsRow, pressed && styles.pressed]}
              >
                <Ionicons name="eye" size={14} color={colors.textSecondary} />
                <Text style={styles.viewsText}>
                  Viewed {grant.access_count} {grant.access_count === 1 ? 'time' : 'times'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <SectionHeader title="Contents" />
      {decryptState === 'loading' ? (
        <Card>
          <Text style={styles.loadingText}>Decrypting on this device…</Text>
        </Card>
      ) : decryptState === 'failed' ? (
        <Card style={styles.failCard}>
          <Text style={styles.failTitle}>{recordCopy.decryptFailed}</Text>
          <Text style={styles.failHint}>
            The key for this record isn't on this device. Restore from recovery on the device
            where it was created.
          </Text>
          <View style={styles.failActions}>
            <Button title="Retry" variant="secondary" onPress={retryDecrypt} style={styles.failBtn} />
          </View>
        </Card>
      ) : payload ? (
        <Card style={styles.contentCard}>
          {payload.kind === 'image' && payload.dataBase64 ? (
            <Image
              source={{ uri: `data:${payload.mime ?? 'image/jpeg'};base64,${payload.dataBase64}` }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={meta.title}
            />
          ) : payload.kind === 'file' ? (
            <View style={styles.fileRow}>
              <Ionicons name="document" size={22} color={colors.accent} />
              <View style={styles.fileMeta}>
                <Text style={styles.fileName}>{payload.fileName ?? 'Encrypted file'}</Text>
                <Text style={styles.fileMime}>{payload.mime}</Text>
              </View>
            </View>
          ) : (
            <>
              {payload.note ? <Text style={styles.note}>{payload.note}</Text> : null}
              {(payload.fields ?? []).map((f) => (
                <View key={f.key} style={styles.fieldRow}>
                  <Text style={styles.fieldKey}>{f.key}</Text>
                  <Text style={styles.fieldValue}>{f.value}</Text>
                </View>
              ))}
            </>
          )}
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Share"
          onPress={() =>
            navigation.navigate('VaultShare', { recordId, recordTitle: meta.title })
          }
          disabled={decryptState !== 'ok'}
        />
        <Button
          title="Export"
          variant="secondary"
          onPress={exportRecord}
          disabled={decryptState !== 'ok'}
        />
        <Button title="Delete" variant="danger" onPress={deleteRecord} />
      </View>

      <Card style={styles.monetizeCard}>
        <View style={styles.monetizeRow}>
          <View style={styles.monetizeMeta}>
            <Text style={styles.monetizeLabel}>{recordCopy.monetizeToggle}</Text>
            <Text style={styles.monetizeHint}>
              Others can ask to pay for access. Nothing is shared without your explicit approval.
            </Text>
          </View>
          <Switch
            value={monetizable}
            onValueChange={(v) => void toggleMonetize(v)}
            trackColor={{ true: colors.premium }}
          />
        </View>
      </Card>

      {/* Access log sheet — last 10 accesses, visible only to the owner. */}
      <Sheet
        visible={accessLogGrant !== null}
        onClose={() => setAccessLogGrant(null)}
        title="Access log"
      >
        {accessLogGrant ? (
          <View style={styles.logList}>
            {accessLogGrant.accessLog.length === 0 ? (
              <Text style={styles.logEmpty}>No accesses yet.</Text>
            ) : (
              accessLogGrant.accessLog.map((entry, i) => (
                <View key={`${entry.accessed_at}-${i}`} style={styles.logRow}>
                  <Text style={styles.logDid} numberOfLines={1}>
                    {truncateDid(entry.accessed_by_did)}
                  </Text>
                  <Text style={styles.logTime}>
                    {parseServerDate(entry.accessed_at).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
            <Text style={styles.logFooter}>{grantCopy.accessLogFooter}</Text>
          </View>
        ) : null}
      </Sheet>

      {/* First-enable monetization confirm (spec 07 §3/§6). */}
      <Sheet
        visible={monetizeConfirmOpen}
        onClose={() => setMonetizeConfirmOpen(false)}
        title="Allow paid access requests?"
      >
        <Text style={styles.monetizeExplainer}>{monetizeCopy.explainer}</Text>
        <Button title={monetizeCopy.turnOn} onPress={() => void confirmMonetize()} style={styles.sheetBtn} />
        <Button
          title={monetizeCopy.notNow}
          variant="ghost"
          onPress={() => setMonetizeConfirmOpen(false)}
        />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing[4], paddingBottom: spacing[10] },
  header: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  backBtn: { padding: spacing[1], marginTop: 2 },
  headerMeta: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm },
  consentCard: { gap: spacing[1] },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  privateText: { color: colors.textSecondary, fontSize: fontSize.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[1] },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingBottom: spacing[2],
  },
  viewsText: { color: colors.textSecondary, fontSize: fontSize.xs, flex: 1 },
  pressed: { opacity: 0.7 },
  loadingText: { color: colors.textMuted, fontSize: fontSize.sm },
  failCard: { borderColor: colors.danger, gap: spacing[2] },
  failTitle: { color: colors.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  failHint: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  failActions: { flexDirection: 'row', marginTop: spacing[1] },
  failBtn: { flex: 1 },
  contentCard: { gap: spacing[3] },
  image: { width: '100%', height: 280, borderRadius: radius.md },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  fileMeta: { flex: 1, gap: 2 },
  fileName: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  fileMime: { color: colors.textMuted, fontSize: fontSize.xs },
  note: { color: colors.text, fontSize: fontSize.base, lineHeight: 24 },
  fieldRow: { gap: 2 },
  fieldKey: { color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase' },
  fieldValue: { color: colors.text, fontSize: fontSize.base },
  actions: { gap: spacing[3], marginTop: spacing[6] },
  monetizeCard: { marginTop: spacing[6] },
  monetizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  monetizeMeta: { flex: 1, gap: 2 },
  monetizeLabel: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  monetizeHint: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 },
  monetizeExplainer: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 21 },
  sheetBtn: { marginTop: spacing[4], marginBottom: spacing[2] },
  logList: { gap: spacing[3] },
  logEmpty: { color: colors.textMuted, fontSize: fontSize.sm },
  logRow: { gap: 2 },
  logDid: { color: colors.text, fontSize: fontSize.sm },
  logTime: { color: colors.textMuted, fontSize: fontSize.xs },
  logFooter: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing[2] },
});
