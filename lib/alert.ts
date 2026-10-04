import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Drop-in replacement for Alert.alert that also works on web, where
 * react-native-web's Alert.alert is a no-op. On web, alerts with a
 * cancel button plus an action become window.confirm; the rest window.alert.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  if (typeof window === 'undefined') return;

  const text = message ? `${title}\n\n${message}` : title;
  const cancel = buttons?.find((b) => b.style === 'cancel');
  const action = buttons?.find((b) => b.style !== 'cancel');

  if (cancel && action) {
    if (window.confirm(text)) action.onPress?.();
    else cancel.onPress?.();
    return;
  }
  window.alert(text);
  buttons?.[0]?.onPress?.();
}
