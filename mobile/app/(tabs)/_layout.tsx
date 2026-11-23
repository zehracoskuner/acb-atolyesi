import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand, fonts, IconButton, NavigationGlyph, useUI } from '../../src/ui';
const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = { index: 'newspaper-outline', explore: 'compass-outline', library: 'book-outline', studio: 'create-outline', profile: 'person-outline' };
const labels: Record<string, string> = { index: 'Akış', explore: 'Keşfet', library: 'Kütüphane', studio: 'Atölye', profile: 'Profil' };
export default function TabLayout() {
  const { colors, wide } = useUI();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <Tabs screenOptions={({ route }) => ({ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink, headerShadowVisible: false,
    headerTitle: () => <Brand compact/>, headerTitleAlign: 'left', headerRight: () => <IconButton icon="notifications-outline" label="Bildirimleri aç" onPress={() => router.push('/notifications')}/>, headerRightContainerStyle: { paddingRight: 12 },
    tabBarPosition: wide ? 'left' : 'bottom', tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
    tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, marginTop: 3 },
    tabBarLabel: ({ color }) => <Text numberOfLines={2} style={{ color, fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, textAlign: 'center', width: '100%', marginTop: 3 }}>{labels[route.name]}</Text>,
    tabBarItemStyle: wide ? { minHeight: 60, marginVertical: 4 } : undefined,
    tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, borderTopWidth: 1, elevation: 0, width: wide ? 180 : undefined, height: wide ? undefined : 64 + Math.max(insets.bottom, 8) + Math.max(0, fontScale - 1) * 32, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8) }, tabBarHideOnKeyboard: true,
    tabBarIcon: ({ focused }) => <NavigationGlyph icon={icons[route.name] || 'ellipse-outline'} selected={focused}/> })}>
    <Tabs.Screen name="index" options={{ title: 'Akış', headerTitle: 'ACB Atölyesi' }}/><Tabs.Screen name="explore" options={{ title: 'Keşfet' }}/>
    <Tabs.Screen name="studio" options={{ title: 'Atölye' }}/><Tabs.Screen name="library" options={{ title: 'Kütüphane' }}/><Tabs.Screen name="profile" options={{ title: 'Profil', headerShown: false }}/>
  </Tabs>;
}
