import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Feed from '../../app/(tabs)/index';
import Compose from '../../app/compose';
import Discussion from '../../app/discussion/[id]';
import { ProfileLogs } from '../../src/components/ProfileTabs';
import { Brand, Button, Page, ThemeProvider, useUI } from '../../src/ui';
import { router } from './adapters';
function App() {
  const { colors, setMode } = useUI(); const [route, setRoute] = useState(location.hash.slice(1) || '/');
  useEffect(() => { setMode(new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light'); }, []);
  useEffect(() => { const update = () => setRoute(location.hash.slice(1) || '/'); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  const main = route === '/' || route === '/(tabs)';
  return <View style={{ height: '100%', backgroundColor: colors.paper }}>
    <View style={{ minHeight: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}>{!main && <Button secondary title="Geri" onPress={router.back}/>}<Brand compact/></View>
    <View style={{ flex: 1, display: main ? 'flex' : 'none' }}><Feed/></View>
    {route.startsWith('/compose') && <Compose key={route}/>}
    {route.startsWith('/discussion/') && <Discussion key={route}/>}
    {route.startsWith('/profile/') && <Page><ProfileLogs target={route.split('/')[2]} owner={route.endsWith('/viewer')}/></Page>}
    {route.startsWith('/read/') && <Page><Text>Seçilen bölüm: {route}</Text></Page>}
    {main && <View style={{ padding: 15, borderTopWidth: 1, borderColor: colors.line }}><Text style={{ textAlign: 'center', color: colors.accent }}>Akış · Keşfet · Atölye · Kütüphane · Profil</Text></View>}
  </View>;
}
createRoot(document.getElementById('root')).render(<SafeAreaProvider><ThemeProvider><App/></ThemeProvider></SafeAreaProvider>);
