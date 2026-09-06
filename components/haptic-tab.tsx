import * as Haptics from 'expo-haptics';
import { ComponentProps } from 'react';
import { Platform, Pressable } from 'react-native';

export function HapticTab(props: ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
