import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function MessagesScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>
        End-to-end encrypted DIDComm messaging. Text, voice, and video — private by
        design, addressed by DID.
      </Text>

      <SectionHeader title="Conversations" />
      <Card>
        <Text style={styles.emptyText}>
          No conversations yet. Add a contact by scanning their DID QR code, or share
          yours from the Home tab. (DIDComm chat integration lands with the messaging
          engineer's relay work.)
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing[4],
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing[2],
    lineHeight: 20,
  },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
});
