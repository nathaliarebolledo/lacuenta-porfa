import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

const DISMISSED_KEY = 'lacuenta-porfa:install-banner-dismissed';

function isStandalone() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Shows how to install the PWA (requirement #6): a native "Instalar" button
 * on Android/Chrome via `beforeinstallprompt`, and step-by-step instructions
 * for iOS/Safari, which doesn't expose that API.
 */
function computeInitialVisibility() {
  if (Platform.OS !== 'web') return false;
  if (isStandalone()) return false;
  try {
    if (typeof window !== 'undefined' && window.localStorage.getItem(DISMISSED_KEY)) return false;
  } catch {}
  return true;
}

export function InstallBanner() {
  const [visible, setVisible] = useState(computeInitialVisibility);
  const [ios] = useState(isIOS);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  useEffect(() => {
    if (!visible || typeof window === 'undefined') return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
  };

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    dismiss();
  };

  return (
    <ThemedView style={[styles.banner, { backgroundColor: card, borderColor: border }]}>
      <IconSymbol name="arrow.down.to.line" size={22} color={tint} />
      <ThemedView style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">Instala La cuenta, porfa</ThemedText>
        {ios ? (
          <ThemedText type="caption">
            En Safari: toca Compartir → “Agregar a pantalla de inicio”.
          </ThemedText>
        ) : deferredPrompt ? (
          <ThemedText type="caption">Ábrela como app, sin barra de navegador.</ThemedText>
        ) : (
          <ThemedText type="caption">
            Menú del navegador → “Instalar app” o “Agregar a pantalla de inicio”.
          </ThemedText>
        )}
      </ThemedView>
      {!ios && deferredPrompt ? (
        <Pressable onPress={install} style={[styles.cta, { backgroundColor: tint }]}>
          <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Instalar</ThemedText>
        </Pressable>
      ) : null}
      <Pressable onPress={dismiss} hitSlop={8}>
        <IconSymbol name="xmark" size={18} color={tint} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
});
