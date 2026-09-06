import { Platform } from 'react-native';

/**
 * LaCuenta Porfa palette — matches the look of our other Expo app (findmypet):
 * bright, white-card-on-light-gray, Tailwind-style semantic colors, soft
 * shadows instead of hard borders, and bold rounded-pill accents.
 */
const tintColorLight = '#3B82F6';
const tintColorDark = '#60A5FA';

export const Colors = {
  light: {
    text: '#111827',
    textMuted: '#6B7280',
    background: '#F9FAFB',
    card: '#FFFFFF',
    border: '#F3F4F6',
    tint: tintColorLight,
    icon: '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    success: '#059669',
    successBg: '#D1FAE5',
    danger: '#EF4444',
    dangerBg: '#FEE2E2',
    warning: '#D97706',
    warningBg: '#FEF3C7',
  },
  dark: {
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    background: '#101317',
    card: '#1A1E24',
    border: '#262B33',
    tint: tintColorDark,
    icon: '#9CA3AF',
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
    success: '#34D399',
    successBg: '#0F2E22',
    danger: '#F87171',
    dangerBg: '#3A1515',
    warning: '#FBBF24',
    warningBg: '#3A2A0A',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Soft elevation for cards — cross-platform (iOS/Android shadow props +
 * web boxShadow via react-native-web). */
export const CardShadow = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(17,24,39,0.06)' },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
}) as object;

/** Stronger elevation for floating/primary elements (FAB, primary buttons). */
export const RaisedShadow = Platform.select({
  web: { boxShadow: '0 4px 12px rgba(59,130,246,0.28)' },
  default: {
    shadowColor: tintColorLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
}) as object;

/** Cycling palette for avatar initials — picked deterministically from a
 * name so the same person always gets the same color. */
export const AvatarPalette = ['#3B82F6', '#8B5CF6', '#F97316', '#10B981', '#F59E0B', '#EC4899'];
