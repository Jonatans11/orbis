/**
 * ORBIS.ID design tokens — sourced from /design/colors/tokens.json
 * (Wallet UI/UX Designer). Dark mode is the wallet default per
 * MOBILE-WALLET-PLAN.md ("Dark mode default — fintech standard").
 */

export const palette = {
  brand: {
    primary: '#4F46E5',
    primaryHover: '#4338CA',
    primaryActive: '#3730A3',
    primarySoft: '#EEF2FF',
    primaryOn: '#FFFFFF',
    accent: '#22D3EE',
    accentHover: '#06B6D4',
    accentSoft: '#CFFAFE',
    accentOn: '#083344',
    premium: '#F59E0B',
    premiumSoft: '#FEF3C7',
    premiumOn: '#78350F',
    success: '#10B981',
    successSoft: '#D1FAE5',
    successOn: '#064E3B',
    danger: '#EF4444',
    dangerSoft: '#FEE2E2',
    dangerOn: '#7F1D1D',
    warning: '#FBBF24',
    warningSoft: '#FEF3C7',
    warningOn: '#78350F',
    info: '#3B82F6',
    infoSoft: '#DBEAFE',
    infoOn: '#1E3A8A',
  },
  dark: {
    primary: '#6366F1',
    accent: '#67E8F9',
    surfaceBase: '#0B1020',
    surfaceRaised: '#111827',
    surfaceSunken: '#0F172A',
    textPrimary: '#F8FAFC',
  },
  light: {
    surfaceBase: '#FFFFFF',
    surfaceRaised: '#F8FAFC',
    surfaceSunken: '#F1F5F9',
    textPrimary: '#0F172A',
  },
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Dark theme — the wallet's default appearance. */
export const colors = {
  // Surfaces
  background: palette.dark.surfaceBase,
  surface: palette.dark.surfaceRaised,
  surfaceSunken: palette.dark.surfaceSunken,
  overlay: 'rgba(15, 23, 42, 0.6)',

  // Borders
  border: 'rgba(148, 163, 184, 0.16)',
  borderStrong: 'rgba(148, 163, 184, 0.32)',
  borderFocus: palette.dark.primary,

  // Text
  text: palette.dark.textPrimary,
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F172A',

  // Brand
  primary: palette.dark.primary,
  primaryPressed: palette.brand.primaryHover,
  onPrimary: palette.brand.primaryOn,
  accent: palette.dark.accent,
  premium: palette.brand.premium,

  // Status
  success: palette.brand.success,
  danger: palette.brand.danger,
  warning: palette.brand.warning,
  info: palette.brand.info,
} as const;

export type ThemeColors = typeof colors;
