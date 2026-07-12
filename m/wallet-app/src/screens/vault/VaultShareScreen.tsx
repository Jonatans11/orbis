/**
 * Consent builder (spec 07 §4) — every share answers WHO / WHAT / HOW LONG /
 * FOR WHAT PRICE before anything is granted, reviewed in plain language and
 * confirmed with biometrics. The record key is sealed on-device for the
 * grantee's X25519 key; the server never sees key material.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { RadioCard } from '@/components/vault/RadioCard';
import { StepDots } from '@/components/vault/StepDots';
import { shareCopy } from '@/features/vault/copy';
import { expiryDisplay, formatMoney, truncateDid } from '@/features/vault/format';
import { ApiError, api } from '@/services/api';
import { resolveGranteeX25519 } from '@/services/didKeys';
import { authenticateWithBiometrics, getBiometricCapability } from '@/services/biometrics';
import { sealRecordKeyForRecipient } from '@/services/vaultCrypto';
import { MAX_GRANT_DAYS, walletApi, type GrantScope } from '@/services/walletApi';
import type { RootStackParamList } from '@/navigation/types';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type ShareRoute = RouteProp<RootStackParamList, 'VaultShare'>;

const STEPS = ['Who', 'What', 'How long', 'Price'] as const;

const DURATION_PRESETS: Array<{ label: string; hours: number }> = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 7 * 24 },
  { label: '30 days', hours: 30 * 24 },
  { label: '90 days', hours: 90 * 24 },
];

export function VaultShareScreen() {
  const route = useRoute<ShareRoute>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { recordId, recordTitle } = route.params;

  // review = step 4
  const [step, setStep] = useState(0);

  // WHO
  const [didInput, setDidInput] = useState(route.params.granteeDid ?? '');
  const [granteeDid, setGranteeDid] = useState<string | null>(null);
  const [granteeKey, setGranteeKey] = useState<Uint8Array | null>(null);
  const [granteeTrusted, setGranteeTrusted] = useState<boolean | null>(null);
  const [resolving, setResolving] = useState(false);
  const [whoError, setWhoError] = useState<string | null>(null);
  const [recentGrantees, setRecentGrantees] = useState<string[]>([]);

  // WHAT
  const [scope, setScope] = useState<GrantScope>('full');

  // HOW LONG
  const [durationHours, setDurationHours] = useState(7 * 24);
  const [customDays, setCustomDays] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [durationError, setDurationError] = useState<string | null>(null);

  // PRICE
  const [priceOn, setPriceOn] = useState(false);
  const [amountText, setAmountText] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const grants = await walletApi.listGrants();
        setRecentGrantees([...new Set(grants.map((g) => g.grantee_did))].slice(0, 5));
      } catch {
        // recents are a convenience only
      }
    })();
  }, []);

  useEffect(() => {
    if (step < STEPS.length) {
      AccessibilityInfo.announceForAccessibility(`Step ${step + 1} of 4: ${STEPS[step]}`);
    } else {
      AccessibilityInfo.announceForAccessibility('Review and confirm');
    }
  }, [step]);

  const resolveRecipient = useCallback(
    async (did: string) => {
      const trimmed = did.trim();
      if (!trimmed.startsWith('did:')) {
        setWhoError('Enter a DID, e.g. did:key:z6Mk…');
        return;
      }
      setResolving(true);
      setWhoError(null);
      try {
        const key = await resolveGranteeX25519(trimmed);
        if (!key) {
          // Blocking: grants are DID-bound and E2E-encrypted (spec 07 §4.1).
          setWhoError(shareCopy.whoNoKeyAgreement);
          setGranteeKey(null);
          setGranteeDid(null);
          return;
        }
        setGranteeKey(key);
        setGranteeDid(trimmed);
        try {
          const trust = await walletApi.trustCheck(trimmed);
          setGranteeTrusted(trust.trusted);
        } catch {
          setGranteeTrusted(null);
        }
        setStep(1);
      } finally {
        setResolving(false);
      }
    },
    [],
  );

  const expiresAt = useMemo(() => {
    const hours = useCustom
      ? Math.min(Math.max(parseInt(customDays, 10) || 0, 0), MAX_GRANT_DAYS) * 24
      : durationHours;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }, [customDays, durationHours, useCustom]);

  const priceMinor = useMemo(() => {
    if (!priceOn) return 0;
    const parsed = Math.round(parseFloat(amountText.replace(',', '.')) * 100);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amountText, priceOn]);

  const validateDuration = (): boolean => {
    if (useCustom) {
      const days = parseInt(customDays, 10);
      if (!Number.isFinite(days) || days < 1 || days > MAX_GRANT_DAYS) {
        setDurationError(`Enter 1–${MAX_GRANT_DAYS} days.`);
        return false;
      }
    }
    setDurationError(null);
    return true;
  };

  const whatLabel =
    scope === 'full'
      ? `everything in '${recordTitle ?? 'this record'}'`
      : `the title & type of '${recordTitle ?? 'this record'}'`;

  const reviewSentence = `${truncateDid(granteeDid ?? '')} can view ${whatLabel} until ${expiryDisplay(
    expiresAt,
  )}${priceMinor > 0 ? ` — requested compensation ${formatMoney(priceMinor)}` : ''}.`;

  const submit = useCallback(async () => {
    if (!granteeDid || !granteeKey) return;
    setSubmitting(true);
    try {
      const capability = await getBiometricCapability();
      if (capability.available && capability.enrolled) {
        const ok = await authenticateWithBiometrics('Confirm this share');
        if (!ok) {
          setSubmitting(false);
          return;
        }
      }

      // Wrap the record key for the grantee on-device (ECDH-ES sealed key).
      const encryptedKey = await sealRecordKeyForRecipient(recordId, granteeKey);
      const body = {
        recordId,
        granteeDid,
        scope,
        expiresAt: expiresAt.toISOString(),
        price: { amount: priceMinor, currency: 'USD' },
        encryptedKey,
      };

      try {
        const res = await walletApi.createGrant(body);
        setSuccessUrl(res.shareUrl);
      } catch (err) {
        if (err instanceof ApiError) {
          const message = err.message.toLowerCase();
          if (message.includes('expires')) {
            setDurationError('Expiry must be within 90 days.');
            setStep(2);
          } else if (message.includes('did')) {
            setWhoError('The recipient DID was rejected. Check it and try again.');
            setStep(0);
          } else {
            Alert.alert('Share failed', err.message);
          }
          return;
        }
        // Network error: the POST may have landed. The API creates a new
        // grantId per POST, so check for a just-created matching grant
        // before retrying to avoid duplicates (spec 07 §4 note).
        try {
          const grants = await walletApi.listGrants(recordId);
          const twoMinAgo = Date.now() - 2 * 60 * 1000;
          const existing = grants.find(
            (g) =>
              g.grantee_did === granteeDid &&
              g.revoked !== 1 &&
              new Date(g.created_at.includes('T') ? g.created_at : `${g.created_at.replace(' ', 'T')}Z`).getTime() >
                twoMinAgo,
          );
          if (existing) {
            setSuccessUrl(`https://orbis.id/api/wallet/share/${existing.grant_id}`);
            return;
          }
        } catch {
          // fall through to the alert
        }
        Alert.alert('Network problem', 'Could not create the share. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [expiresAt, granteeDid, granteeKey, priceMinor, recordId, scope]);

  const closeSuccess = () => {
    setSuccessUrl(null);
    navigation.goBack();
  };

  const sendInChat = async () => {
    if (!granteeDid || !successUrl) return;
    try {
      await api.didcomm.send({
        to: granteeDid,
        type: 'https://didcomm.org/basicmessage/2.0/message',
        body: { content: `I've shared '${recordTitle ?? 'a record'}' with you on ORBIS: ${successUrl}` },
      });
      Alert.alert('Sent', 'Share link delivered over ORBIS chat.');
    } catch {
      Alert.alert('Could not send', 'Copy the link instead.');
    }
  };

  const copyLink = async () => {
    if (!successUrl) return;
    await Clipboard.setStringAsync(successUrl);
    AccessibilityInfo.announceForAccessibility('Link copied');
  };

  const back = () => {
    if (step === 0) navigation.goBack();
    else setStep((s) => s - 1);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[2] }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.title}>Share record</Text>
          {recordTitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {recordTitle}
            </Text>
          ) : null}
        </View>
      </View>

      <StepDots total={4} current={Math.min(step, 3)} />

      {step === 0 ? (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>Who can access it?</Text>
          <Text style={styles.stepHint}>
            Shares are locked to one recipient's ID — there is no "anyone with the link".
          </Text>
          <TextInput
            style={styles.input}
            value={didInput}
            onChangeText={(t) => {
              setDidInput(t);
              setWhoError(null);
            }}
            placeholder="Paste their DID (did:key:… or did:web:…)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {whoError ? <Text style={styles.blockError}>{whoError}</Text> : null}
          {recentGrantees.length > 0 ? (
            <View style={styles.recents}>
              <Text style={styles.recentsLabel}>Recent</Text>
              {recentGrantees.map((did) => (
                <Pressable
                  key={did}
                  accessibilityRole="button"
                  onPress={() => setDidInput(did)}
                  style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
                >
                  <Ionicons name="person-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.recentDid} numberOfLines={1}>
                    {truncateDid(did)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button
            title={resolving ? 'Checking recipient…' : 'Continue'}
            onPress={() => void resolveRecipient(didInput)}
            loading={resolving}
            disabled={!didInput.trim()}
            style={styles.cta}
          />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>What can they see?</Text>
          {granteeTrusted === false ? (
            <View style={styles.amberNote}>
              <Ionicons name="alert-circle" size={16} color={colors.warning} />
              <Text style={styles.amberText}>{shareCopy.whoUnverified}</Text>
            </View>
          ) : null}
          <RadioCard
            title={shareCopy.scopeFull}
            caption={shareCopy.scopeFullCaption}
            selected={scope === 'full'}
            onSelect={() => setScope('full')}
          />
          <RadioCard
            title={shareCopy.scopeMeta}
            caption={shareCopy.scopeMetaCaption}
            selected={scope === 'meta-only'}
            onSelect={() => setScope('meta-only')}
          />
          <Text style={styles.footnote}>{shareCopy.scopeV2Note}</Text>
          <Button title="Continue" onPress={() => setStep(2)} style={styles.cta} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>For how long?</Text>
          <View style={styles.chips}>
            {DURATION_PRESETS.map((preset) => {
              const selected = !useCustom && durationHours === preset.hours;
              return (
                <Pressable
                  key={preset.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setUseCustom(false);
                    setDurationHours(preset.hours);
                    setDurationError(null);
                  }}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {preset.label}
                    {preset.hours === 90 * 24 ? ' (max)' : ''}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: useCustom }}
              onPress={() => setUseCustom(true)}
              style={[styles.chip, useCustom && styles.chipSelected]}
            >
              <Text style={[styles.chipText, useCustom && styles.chipTextSelected]}>Custom</Text>
            </Pressable>
          </View>
          {useCustom ? (
            <View style={styles.customRow}>
              <TextInput
                style={[styles.input, styles.customInput]}
                value={customDays}
                onChangeText={(t) => {
                  setCustomDays(t.replace(/[^0-9]/g, ''));
                  setDurationError(null);
                }}
                placeholder="Days"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.customHint}>days (up to {MAX_GRANT_DAYS})</Text>
            </View>
          ) : null}
          {durationError ? <Text style={styles.blockError}>{durationError}</Text> : null}
          <Text style={styles.footnote}>{shareCopy.durationRevocable}</Text>
          <Button
            title="Continue"
            onPress={() => {
              if (validateDuration()) setStep(3);
            }}
            style={styles.cta}
          />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>For what price?</Text>
          <Card>
            <View style={styles.priceToggleRow}>
              <View style={styles.priceToggleMeta}>
                <Text style={styles.priceToggleLabel}>Request compensation</Text>
                <Text style={styles.priceToggleHint}>Off means you share for free.</Text>
              </View>
              <Switch
                value={priceOn}
                onValueChange={setPriceOn}
                trackColor={{ true: colors.premium }}
              />
            </View>
            {priceOn ? (
              <>
                <View style={styles.amountRow}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.amountInput]}
                    value={amountText}
                    onChangeText={(t) => setAmountText(t.replace(/[^0-9.,]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.currencyPill}>
                    <Text style={styles.currencyPillText}>USD</Text>
                  </View>
                </View>
                <Text style={styles.footnote}>More currencies later.</Text>
              </>
            ) : null}
          </Card>
          {priceOn ? <Text style={styles.honesty}>{shareCopy.pricePending}</Text> : null}
          <Button title="Review" onPress={() => setStep(4)} style={styles.cta} />
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>Review & confirm</Text>
          <Card style={styles.reviewCard}>
            <Text style={styles.sentence} accessibilityRole="summary">
              {reviewSentence}
            </Text>
            {granteeTrusted === true ? (
              <View style={styles.trustRow}>
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                <Text style={styles.trustText}>Verified in the ORBIS trust registry</Text>
              </View>
            ) : granteeTrusted === false ? (
              <View style={styles.trustRow}>
                <Ionicons name="alert-circle" size={14} color={colors.warning} />
                <Text style={[styles.trustText, { color: colors.warning }]}>
                  {shareCopy.whoUnverified}
                </Text>
              </View>
            ) : null}
            <ReviewRow label="Recipient" value={truncateDid(granteeDid ?? '')} onEdit={() => setStep(0)} />
            <ReviewRow
              label="Scope"
              value={scope === 'full' ? shareCopy.scopeFull : shareCopy.scopeMeta}
              onEdit={() => setStep(1)}
            />
            <ReviewRow label="Expires" value={expiryDisplay(expiresAt)} onEdit={() => setStep(2)} />
            <ReviewRow
              label="Compensation"
              value={priceMinor > 0 ? formatMoney(priceMinor) : 'Free'}
              onEdit={() => setStep(3)}
            />
          </Card>
          {priceMinor > 0 ? <Text style={styles.honesty}>{shareCopy.pricePending}</Text> : null}
          <Button
            title={submitting ? 'Confirming…' : 'Confirm share'}
            onPress={() => void submit()}
            loading={submitting}
            style={styles.cta}
          />
          <Text style={styles.footnote}>{shareCopy.durationRevocable}</Text>
        </View>
      ) : null}

      {/* Success sheet with grant created (spec 07 §4). */}
      <Sheet visible={successUrl !== null} onClose={closeSuccess} title="Share created">
        <Text style={styles.successText}>{reviewSentence}</Text>
        <Button title="Send in ORBIS chat" onPress={() => void sendInChat()} style={styles.sheetBtn} />
        <Button title="Copy link" variant="secondary" onPress={() => void copyLink()} />
        <Text style={styles.footnote}>
          {shareCopy.linkLockedTo(truncateDid(granteeDid ?? 'the recipient'))}
        </Text>
        <Button title="Done" variant="ghost" onPress={closeSuccess} />
      </Sheet>
    </ScrollView>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Edit`}
      onPress={onEdit}
      style={({ pressed }) => [styles.reviewRow, pressed && styles.pressed]}
    >
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={1}>
        {value}
      </Text>
      <Ionicons name="pencil" size={14} color={colors.textMuted} />
    </Pressable>
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
  step: { marginTop: spacing[6], gap: spacing[3] },
  stepTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  stepHint: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
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
  blockError: { color: colors.danger, fontSize: fontSize.sm, lineHeight: 20 },
  recents: { gap: spacing[1], marginTop: spacing[2] },
  recentsLabel: { color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  recentDid: { color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 },
  pressed: { opacity: 0.7 },
  cta: { marginTop: spacing[4] },
  amberNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing[3],
  },
  amberText: { flex: 1, color: colors.warning, fontSize: fontSize.xs, lineHeight: 16 },
  footnote: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceSunken },
  chipText: { color: colors.textSecondary, fontSize: fontSize.sm },
  chipTextSelected: { color: colors.text, fontWeight: fontWeight.semibold },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  customInput: { width: 90, textAlign: 'center' },
  customHint: { color: colors.textMuted, fontSize: fontSize.sm },
  priceToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  priceToggleMeta: { flex: 1, gap: 2 },
  priceToggleLabel: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  priceToggleHint: { color: colors.textMuted, fontSize: fontSize.xs },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  currencySymbol: { color: colors.premium, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  amountInput: { flex: 1 },
  currencyPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    opacity: 0.6,
  },
  currencyPillText: { color: colors.textSecondary, fontSize: fontSize.sm },
  honesty: {
    color: colors.warning,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  reviewCard: { gap: spacing[3] },
  sentence: {
    color: colors.text,
    fontSize: fontSize.lg,
    lineHeight: 26,
    fontWeight: fontWeight.medium,
  },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  trustText: { color: colors.success, fontSize: fontSize.xs },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[3],
  },
  reviewLabel: { color: colors.textMuted, fontSize: fontSize.sm, width: 110 },
  reviewValue: { flex: 1, color: colors.text, fontSize: fontSize.sm },
  successText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 21 },
  sheetBtn: { marginTop: spacing[4], marginBottom: spacing[2] },
});
