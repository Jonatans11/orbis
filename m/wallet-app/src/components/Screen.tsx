import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  /** Use a ScrollView container (default true). */
  scroll?: boolean;
  style?: ViewStyle;
  /** Apply bottom safe-area inset (off inside tab navigator). */
  withBottomInset?: boolean;
}

/** Base screen container: dark surface, safe-area aware, padded. */
export function Screen({ children, scroll = true, style, withBottomInset = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing[2],
    paddingBottom: withBottomInset ? insets.bottom + spacing[4] : spacing[4],
  };

  if (!scroll) {
    return <View style={[styles.base, padding, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.base, padding, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  base: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing[4],
  },
});
