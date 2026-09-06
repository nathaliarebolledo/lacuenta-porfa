// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add SF Symbols -> Material Icons mappings here. See https://icons.expo.fyi for Material Icons.
 */
const MAPPING = {
  'house.fill': 'home',
  'person.2.fill': 'people',
  'person.crop.circle.fill': 'account-circle',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'checkmark.circle.fill': 'check-circle',
  'clock.fill': 'schedule',
  'camera.fill': 'photo-camera',
  'photo.fill': 'image',
  'link': 'link',
  'square.and.arrow.up': 'ios-share',
  'trash.fill': 'delete',
  'pencil': 'edit',
  'creditcard.fill': 'credit-card',
  'gearshape.fill': 'settings',
  'xmark': 'close',
  'checkmark': 'check',
  'arrow.down.to.line': 'file-download',
  'wifi.slash': 'wifi-off',
  'bell.fill': 'notifications',
  'calendar': 'calendar-today',
  'percent': 'percent',
  'doc.text.fill': 'receipt-long',
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
