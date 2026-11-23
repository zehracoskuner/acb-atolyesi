import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { SessionProvider, useSession } from '../src/session';
import { SyncProvider, useSync } from '../src/sync';
import { fonts, Loading, ThemeProvider, useUI } from '../src/ui';
function Navigation() {
  const { colors, dark } = useUI();
  useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.paper); }, [colors.paper]);
  const session = useSession(); const segments = useSegments(); const { online } = useSync();
  useEffect(() => {
    if (!session.user) return;
    const open = () => router.push('/notifications');
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then(response => { if (response) { open(); void Notifications.clearLastNotificationResponseAsync(); } });
    return () => sub.remove();
  }, [session.user]);
  useEffect(() => {
    if (session.loading) return;
    const first = String(segments[0] || '');
    if (['auth', 'legal', 'mobile-link'].includes(first)) return;
    if (session.user && (!session.user.profileComplete || session.user.requiresTermsAcceptance)) router.replace('/auth/complete');
  }, [session.loading, session.user, segments]);
  if (session.loading) return <Loading/>;
  return <View style={{ flex: 1, backgroundColor: colors.paper }}><StatusBar style={dark ? "light" : "dark"}/>
    {!online && String(segments[0]) !== "read" && <Text accessibilityLiveRegion="polite" style={{ padding: 10, color: colors.paper, backgroundColor: colors.accent, paddingTop: 30 }}>Çevrimdışısın · sunucu bağlantısı bekleniyor</Text>}
    <Stack key={session.user?._id || 'guest'} screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { fontFamily: fonts.medium, fontSize: 15 }, headerTintColor: colors.accent, headerShadowVisible: false, contentStyle: { backgroundColor: colors.paper }, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
      <Stack.Screen name="work/[id]" options={{ title: 'Eser' }}/>
      <Stack.Screen name="read/[workId]/[chapterId]" options={{ headerShown: false }}/>
      <Stack.Screen name="studio/[id]" options={{ title: 'Eser atölyesi' }}/>
      <Stack.Screen name="write/[id]" options={{ headerShown: false }}/>
      <Stack.Screen name="tools/[workId]" options={{ title: 'Hikâye araçları' }}/>
      <Stack.Screen name="compose" options={{ title: 'Günlük yaz' }}/>
      <Stack.Screen name="notifications" options={{ title: 'Bildirimler' }}/>
      <Stack.Screen name="profile-edit" options={{ title: 'Profili düzenle' }}/><Stack.Screen name="settings" options={{ title: 'Hesap ayarları' }}/>
      <Stack.Screen name="profile/[id]" options={{ title: 'Yazar', headerShown: false }}/>
      <Stack.Screen name="discussion/[id]" options={{ title: 'Sohbet' }}/>
      <Stack.Screen name="notes" options={{ title: 'Not defterin' }}/>
      <Stack.Screen name="lists" options={{ title: 'Okuma listeleri' }}/>
      <Stack.Screen name="quotes" options={{ title: 'Alıntılar' }}/>
      <Stack.Screen name="paragraph-comments" options={{ title: 'Paragraf sohbetleri' }}/>
      <Stack.Screen name="report" options={{ title: 'İçeriği bildir' }}/>
      <Stack.Screen name="reports" options={{ title: 'Başvurularım' }}/>
      <Stack.Screen name="index" options={{ headerShown: false }}/>
      <Stack.Screen name="auth/[mode]" options={{ title: 'ACB Atölyesi' }}/>
      <Stack.Screen name="legal/[id]" options={{ title: 'Atölye ilkeleri' }}/>
      <Stack.Screen name="mobile-link/[action]" options={{ title: 'Hesap doğrulama' }}/>
    </Stack></View>;
}
function RootContent() {
  const { colors } = useUI();
  const [loaded, error] = useFonts({
    PlayfairDisplay: require('../assets/fonts/PlayfairDisplay_600SemiBold.ttf'),
    DMSans: require('../assets/fonts/DMSans_400Regular.ttf'),
    DMSansMedium: require('../assets/fonts/DMSans_500Medium.ttf'),
    DMSansSemiBold: require('../assets/fonts/DMSans_600SemiBold.ttf'),
    Lora: require('../assets/fonts/Lora_400Regular.ttf'),
    LoraItalic: require('../assets/fonts/Lora_400Regular_Italic.ttf'),
  });
  return <SafeAreaProvider>{!loaded && !error ? <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center' }}><Loading/></View> : <SessionProvider><SyncProvider><Navigation/></SyncProvider></SessionProvider>}</SafeAreaProvider>;
}

export default function Root() { return <ThemeProvider><RootContent/></ThemeProvider>; }
