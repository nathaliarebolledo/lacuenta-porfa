import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[(colorScheme ?? 'light') as 'light' | 'dark'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        headerShown: false,
        tabBarButton: (props) => <HapticTab {...(props as any)} />,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mis eventos',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contactos',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
