import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Brand, ThemeProvider, useUI } from '../../src/ui';
import Explore from '../../src/ExploreScreen';
import Work from '../../app/work/[id]';
import Profile from '../../app/profile/[id]';
import Library from '../../app/(tabs)/library';
import Discussion from '../../app/discussion/[id]';
import { FocusProvider, router } from './explore-adapters';
function App() {
  const { colors, setMode, styles } = useUI();
  const [route, setRoute] = useState(location.hash.slice(1) || '/explore');
  useEffect(() => { const change = () => setRoute(location.hash.slice(1) || '/explore'); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { setMode(new URLSearchParams(location.search).get('theme') || 'light'); }, []);
  const explore = route === '/explore';
  const Screen = route.startsWith('/work/') ? Work : route.startsWith('/profile/') ? Profile : route.startsWith('/discussion/') ? Discussion : route === '/library' ? Library : null;
  return <SafeAreaProvider><View style={{ height: '100%', backgroundColor: colors.paper }}>
    <View style={{ minHeight: 65, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: colors.line, justifyContent: 'center' }}>{explore ? <Brand compact/> : <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={router.back} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={styles.text}>← Geri</Text></Pressable>}</View>
    <FocusProvider value={explore}><View style={{ flex: 1, display: explore ? 'flex' : 'none' }}><Explore/></View></FocusProvider>
    {!explore && <FocusProvider value>{Screen ? <Screen key={route}/> : <View style={{ flex: 1 }}><Text>Giriş / Akış</Text></View>}</FocusProvider>}
    {explore && <View style={{ minHeight: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.line }}>{['Akış', 'Keşfet', 'Atölye', 'Kütüphane', 'Profil'].map(t => <Text key={t} style={[styles.muted, { fontSize: 11, color: t === 'Keşfet' ? colors.accent : colors.muted }]}>{t}</Text>)}</View>}
  </View></SafeAreaProvider>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider><App/></ThemeProvider>);
