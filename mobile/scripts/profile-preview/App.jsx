import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Text, View, useWindowDimensions } from 'react-native';
import { SessionProvider, router } from './adapters';
import { ProfileScreen } from '../../src/components/ProfileScreen';
import ProfileEdit from '../../app/profile-edit';
import Lists from '../../app/lists';
import Compose from '../../app/compose';
import { Button, ThemeProvider, useUI } from '../../src/ui';
function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || '/profile'); const path = route.split('?')[0]; const { colors, styles, setMode } = useUI(); const { width } = useWindowDimensions();
  useEffect(() => { setMode(new URLSearchParams(location.search).get('theme') || 'light'); const changed = () => setRoute(location.hash.slice(1)); addEventListener('hashchange', changed); return () => removeEventListener('hashchange', changed); }, []);
  const main = path === '/profile-edit' ? <ProfileEdit/> : path === '/lists' ? <Lists/> : path === '/compose' ? <Compose/> : path.startsWith('/profile') ? <ProfileScreen id={path.split('/')[2]}/> : <View><Text style={styles.text}>{path}</Text><Button title="Profile dön" onPress={() => router.push('/profile')}/></View>;
  return <View style={{ height: '100%', flexDirection: width >= 850 ? 'row' : 'column', backgroundColor: colors.paper }}>
    {width >= 850 && <View style={{ width: 180, padding: 20, gap: 30, backgroundColor: colors.card }}>{['Akış', 'Keşfet', 'Atölye', 'Kütüphane', 'Profil'].map(text => <Text key={text} style={styles.text}>{text}</Text>)}</View>}
    <View key={path} style={{ flex: 1, minWidth: 0 }}>{main}</View>
    {width < 850 && path === '/profile' && <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 18, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>{['Akış', 'Keşfet', 'Atölye', 'Kütüphane', 'Profil'].map(text => <Text key={text} style={[styles.muted, { fontSize: 11 }]}>{text}</Text>)}</View>}
  </View>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider><SessionProvider><App/></SessionProvider></ThemeProvider>);
