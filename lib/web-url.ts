import { Platform } from 'react-native';

/**
 * Canonical base URL used to build guest links that work from any device
 * (SMS, WhatsApp, etc.), not just the browser tab that generated them.
 * Falls back to the current origin when running the web build directly.
 */
export function getWebBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_WEB_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://split-bill.example.com';
}
