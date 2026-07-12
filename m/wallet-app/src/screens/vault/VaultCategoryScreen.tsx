import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { ShareStatusPill } from '@/components/vault/ShareStatusPill';
import { categoryDef } from '@/features/vault/categories';
import { vaultCopy } from '@/features/vault/copy';
import { formatBytes, relativeTime } from '@/features/vault/format';
import { randomUUID } from '@/services/random';
import { encryptRecordPayload, type VaultRecordPayload } from '@/services/vaultCrypto';
import {
  MAX_BLOB_BYTES,
  parseMeta,
  primeRecordMeta,
  walletApi,
  type VaultListItem,
} from '@/services/walletApi';
import { ApiError } from '@/services/api';
import type { RootStackParamList } from '@/navigation/types';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type CategoryRoute = RouteProp<RootStackParamList, 'VaultCategory'>;

type AddMode = 'menu' | 'form';

const MAX_TITLE = 120;

export function VaultCategoryScreen() {
  const route = useRoute<CategoryRoute>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const cat = useMemo(() => categoryDef(route.params.category), [route.params.category]);

  const [items, setItems] = useState<VaultListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add flow
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('menu');
  const [pendingPayload, setPendingPayload] = useState<VaultRecordPayload | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFirst = useCallback(async () => {
    try {
      const page = await walletApi.listRecords(cat.id);
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch {
      Alert.alert('Vault unavailable', 'Could not load records. Pull to retry.');
    } finally {
      setLoading(false);
    }
  }, [cat.id]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await walletApi.listRecords(cat.id, cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      // silent — next end-reach retries
    } finally {
      setLoadingMore(false);
    }
  }, [cat.id, cursor, loadingMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirst();
    setRefreshing(false);
  }, [loadFirst]);

  const resetAdd = () => {
    setAddOpen(false);
    setAddMode('menu');
    setPendingPayload(null);
    setTitle('');
    setType('');
    setNote('');
  };

  const oversizeAlert = () =>
    Alert.alert('File too large', vaultCopy.blobTooLarge, [{ text: 'OK' }]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera unavailable', 'Allow camera access to add photos to your vault.');
      return;
    }
    // Compress to fit the 512 KB blob cap (spec 07 §2).
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.4 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    const bytes = Math.ceil((asset.base64.length * 3) / 4);
    if (bytes > MAX_BLOB_BYTES - 4096) {
      oversizeAlert();
      return;
    }
    setPendingPayload({
      kind: 'image',
      dataBase64: asset.base64,
      mime: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? 'photo.jpg',
    });
    setType('photo');
    setAddMode('form');
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    if ((asset.size ?? 0) > MAX_BLOB_BYTES - 4096) {
      oversizeAlert();
      return;
    }
    try {
      const dataBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setPendingPayload({
        kind: 'file',
        dataBase64,
        mime: asset.mimeType ?? 'application/octet-stream',
        fileName: asset.name,
      });
      setType('file');
      setAddMode('form');
    } catch {
      Alert.alert('Could not read file', 'Try a different file.');
    }
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give this record a short title.');
      return;
    }
    setSaving(true);
    const recordId = randomUUID();
    const payload: VaultRecordPayload =
      pendingPayload ?? { kind: 'note', note: note.trim() };
    try {
      // Client-side encryption — only {title, type} leave the device in plaintext.
      const enc = await encryptRecordPayload(recordId, payload);
      const ciphertextBytes = Math.ceil((enc.ciphertext.length * 3) / 4);
      if (ciphertextBytes > MAX_BLOB_BYTES) {
        oversizeAlert();
        return;
      }
      const meta = {
        title: title.trim().slice(0, MAX_TITLE),
        type: type.trim() || payload.kind,
      };
      await walletApi.storeRecord({
        recordId,
        category: cat.id,
        meta,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        alg: enc.alg,
      });
      primeRecordMeta(recordId, meta);
      resetAdd();
      await loadFirst();
    } catch (err) {
      if (err instanceof ApiError && (err.body as { code?: string })?.code === 'QUOTA_EXCEEDED') {
        Alert.alert('Vault full', vaultCopy.quotaExceeded);
      } else {
        Alert.alert('Save failed', 'Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: VaultListItem }) => {
    const meta = parseMeta(item.meta_json);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${meta.title}, ${meta.type}`}
        onPress={() =>
          navigation.navigate('VaultRecord', { recordId: item.record_id, title: meta.title })
        }
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name={cat.icon} size={20} color={colors.accent} />
        <View style={styles.rowMeta}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {meta.title}
          </Text>
          <Text style={styles.rowCaption} numberOfLines={1}>
            {meta.type} · {relativeTime(item.updated_at)} · {formatBytes(item.size)}
          </Text>
        </View>
        <ShareStatusPill
          grantCount={item.grantCount}
          monetizable={item.consent === 'monetizable'}
        />
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{cat.label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add to ${cat.label}`}
          onPress={() => setAddOpen(true)}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.record_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={cat.icon} size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Nothing here yet. Everything you add is encrypted on this device before it's
                stored.
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.accent} style={styles.footer} /> : null
          }
        />
      )}

      <Sheet
        visible={addOpen}
        onClose={resetAdd}
        title={addMode === 'menu' ? `Add to ${cat.label}` : 'New record'}
      >
        {addMode === 'menu' ? (
          <View style={styles.menu}>
            <MenuOption icon="camera" label="Take photo" onPress={() => void pickPhoto()} />
            <MenuOption icon="cloud-upload" label="Upload file" onPress={() => void pickFile()} />
            <MenuOption
              icon="create"
              label="Fill form"
              onPress={() => {
                setPendingPayload(null);
                setAddMode('form');
              }}
            />
          </View>
        ) : (
          <View style={styles.form}>
            {pendingPayload ? (
              <View style={styles.attachmentRow}>
                <Ionicons
                  name={pendingPayload.kind === 'image' ? 'image' : 'document'}
                  size={18}
                  color={colors.accent}
                />
                <Text style={styles.attachmentText} numberOfLines={1}>
                  {pendingPayload.fileName ?? 'Attachment'} — encrypted before upload
                </Text>
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={(t) => setTitle(t.slice(0, MAX_TITLE))}
              placeholder="e.g. Blood panel — Mar 2026"
              placeholderTextColor={colors.textMuted}
              maxLength={MAX_TITLE}
            />
            <View style={styles.helperRow}>
              <Text style={styles.helper}>{vaultCopy.titleHelper}</Text>
              <Text style={styles.counter}>
                {title.length}/{MAX_TITLE}
              </Text>
            </View>
            <Text style={styles.fieldLabel}>Type</Text>
            <TextInput
              style={styles.input}
              value={type}
              onChangeText={setType}
              placeholder="e.g. lab-result, statement, deed"
              placeholderTextColor={colors.textMuted}
            />
            {!pendingPayload ? (
              <>
                <Text style={styles.fieldLabel}>Content</Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Encrypted note — only you can read this."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </>
            ) : null}
            <Button
              title={saving ? 'Encrypting…' : 'Encrypt & save'}
              onPress={() => void save()}
              loading={saving}
              style={styles.saveBtn}
            />
          </View>
        )}
      </Sheet>
    </View>
  );
}

function MenuOption({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuOption, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  backBtn: { padding: spacing[1] },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[8], flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  pressed: { opacity: 0.7 },
  rowMeta: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  rowCaption: { color: colors.textMuted, fontSize: fontSize.xs },
  divider: { height: 1, backgroundColor: colors.border },
  skeletons: { paddingHorizontal: spacing[4], gap: spacing[3] },
  skeletonRow: {
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    opacity: 0.6,
  },
  empty: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[16] },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing[6],
  },
  footer: { paddingVertical: spacing[4] },
  menu: { gap: spacing[2] },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: spacing[4],
  },
  menuLabel: { flex: 1, color: colors.text, fontSize: fontSize.base },
  form: { gap: spacing[2] },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  attachmentText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.xs },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginTop: spacing[2],
  },
  input: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: fontSize.base,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  noteInput: { minHeight: 96, textAlignVertical: 'top' },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  helper: { flex: 1, color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 15 },
  counter: { color: colors.textMuted, fontSize: fontSize.xs },
  saveBtn: { marginTop: spacing[4] },
});
