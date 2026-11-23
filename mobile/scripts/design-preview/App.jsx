import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from './icons';
import { Brand, fonts, IconButton, NavigationGlyph, ThemeProvider, useUI } from '../../src/ui';
import Feed from '../../app/(tabs)/index';
import Explore from '../../app/(tabs)/explore';
import Library from '../../app/(tabs)/library';
import Studio from '../../app/(tabs)/studio';
import Profile from '../../app/(tabs)/profile';
import Auth from '../../app/auth/[mode]';
import Work from '../../app/work/[id]';
import StudioWork from '../../app/studio/[id]';
import Writer from '../../app/write/[id]';
import Reader from '../../app/read/[workId]/[chapterId]';
import WriterProfile from '../../app/profile/[id]';
import Notifications from '../../app/notifications';
import Compose from '../../app/compose';
import ProfileEdit from '../../app/profile-edit';
import PlotPreview from './PlotPreview';
import { PlotRoute } from '../../src/components/PlotScreens';
import { CharacterRoute } from '../../src/components/CharacterScreens';
const tabs = [['/', 'Akış', 'newspaper-outline'], ['/explore', 'Keşfet', 'compass-outline'], ['/studio', 'Atölye', 'create-outline'], ['/library', 'Kütüphane', 'book-outline'], ['/profile', 'Profil', 'person-outline']];
function App() {
  const { colors, setMode } = useUI();
  useEffect(() => { const theme = new URLSearchParams(location.search).get("theme"); if (["light","dark","system"].includes(theme)) setMode(theme); }, []);
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => { const change = () => setRoute(window.location.hash.slice(1) || '/'); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  const isTab = tabs.some(([path]) => path === route); const welcome = route.includes('welcome');
  const Screen = route === '/profile-edit' ? ProfileEdit : route === '/compose' ? Compose : route.startsWith('/auth') ? Auth : route.startsWith('/read/') ? Reader : route.startsWith('/work/') ? Work : route.startsWith('/studio/') ? StudioWork : route.startsWith('/write/') ? Writer : route.startsWith('/profile/') ? WriterProfile : route === '/notifications' ? Notifications : route === '/explore' ? Explore : route === '/library' ? Library : route === '/studio' ? Studio : route === '/profile' ? Profile : Feed;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><View style={{ height: '100%', backgroundColor: colors.paper }}>
    {!welcome && !route.startsWith('/characters/') && !route.startsWith('/plot/') && <View style={{ minHeight: 65, paddingHorizontal: 22, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>{isTab ? <Brand compact/> : <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={() => window.location.hash = '/'} style={{ paddingVertical: 14 }}><Ionicons name="arrow-back-outline" size={23} color={colors.accent}/></Pressable>}{!isTab && <Text style={{ fontFamily: fonts.medium, color: colors.ink }}>ACB Atölyesi</Text>}{isTab ? <IconButton label="Bildirimler" icon="notifications-outline" onPress={() => window.location.hash = '/notifications'}/> : <View style={{ width: 30 }}/>}</View>}
    {route.startsWith('/plot/') ? <PlotRoute key={route} screen={route.split('?')[0].endsWith('/new') ? 'new' : route.endsWith('/edit') ? 'edit' : route.endsWith('/move') ? 'move' : route.endsWith('/connect') ? 'connect' : route.endsWith('/structure') ? 'structure' : route.split('/').length === 3 ? 'home' : 'detail'}/> : route.startsWith('/characters/') ? <CharacterRoute key={route} screen={route.endsWith('/new') ? 'new' : route.endsWith('/edit') ? 'edit' : route.endsWith('/relation') ? 'relation' : route.split('/').length === 3 ? 'list' : 'detail'}/> : route === '/plot-map' || route === '/relationship-map' ? <PlotPreview key={route}/> : <Screen key={route}/>}
    {isTab && <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 10 }}>{tabs.map(([path, label, icon]) => <Pressable key={path} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: route === path }} onPress={() => window.location.hash = path} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 4, minHeight: 46, justifyContent: 'center' }}><NavigationGlyph icon={icon} selected={route === path}/><Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, width: '100%', textAlign: 'center', color: route === path ? colors.accent : colors.muted }}>{label}</Text></Pressable>)}</View>}
  </View></SafeAreaProvider>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider><App/></ThemeProvider>);
