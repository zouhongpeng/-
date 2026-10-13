import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useCSSVariable } from 'uniwind';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [background, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  let tabBarStyle: any = {
    backgroundColor: background,
    borderTopWidth: 1,
    borderTopColor: border,
  };

  if (Platform.OS === 'web') {
    tabBarStyle = { ...tabBarStyle, height: 'auto' };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '人物',
          tabBarIcon: ({ color }) => <FontAwesome6 name="people-group" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: '周报',
          tabBarIcon: ({ color }) => <FontAwesome6 name="chart-line" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => <FontAwesome6 name="gear" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}