import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { message } from './api';

// The website's Explore / Workshop palette. Font files are bundled for offline use.
const light = { paper: '#F8F7F3', card: '#FFFFFF', ink: '#242C29', muted: '#64716B', accent: '#109d7c', rust: '#a56358', line: '#E4E7DF', soft: '#EDEEE7', sage: '#bee4a9', pale: '#E4EFE7', onAccent: '#FFFFFF' };
const dark = { paper: '#141D1A', card: '#1C2823', ink: '#F0EFE5', muted: '#ACBAB1', accent: '#96D3B7', rust: '#FFAD98', line: '#37473E', soft: '#29382F', sage: '#ACC69E', pale: '#293F34', onAccent: '#14291F' };
type ThemeMode = 'light' | 'dark' | 'system';
const ThemeContext = createContext({ mode: 'system' as ThemeMode, dark: false, setMode: (_mode: ThemeMode) => {}, error: '' });
export function ThemeProvider({ children }: React.PropsWithChildren) {
  const system = useColorScheme(); const [mode, update] = useState<ThemeMode>('system'); const [ready, setReady] = useState(false); const [error, setError] = useState('');
  useEffect(() => { AsyncStorage.getItem('acb.appearance').then(value => { if (value === 'light' || value === 'dark' || value === 'system') update(value); }).catch(() => setError('Tema tercihi okunamadı.')).finally(() => setReady(true)); }, []);
  const setMode = (value: ThemeMode) => { update(value); setError(''); void AsyncStorage.setItem('acb.appearance', value).catch(() => setError('Tema tercihi cihazda saklanamadı. Tekrar seçebilirsin.')); };
  return <ThemeContext.Provider value={{ mode, dark: mode === 'dark' || (mode === 'system' && system === 'dark'), setMode, error }}>{ready ? children : null}</ThemeContext.Provider>;
}
export function useUI() {
  const theme = useContext(ThemeContext); const { width, fontScale } = useWindowDimensions(); const colors = theme.dark ? dark : light;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { ...theme, colors, styles, wide: width / Math.max(1, fontScale) >= 850 };
}
export const fonts = { display: 'PlayfairDisplay', body: 'DMSans', medium: 'DMSansMedium', semibold: 'DMSansSemiBold', reading: 'Lora', italic: 'LoraItalic' };
type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function NavigationGlyph({ icon, selected }: { icon: IconName; selected: boolean }) {
  const { colors } = useUI();
  return <View style={{ width: 52, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: selected ? colors.pale : 'transparent' }}><Ionicons name={selected ? icon.replace('-outline', '') as IconName : icon} size={21} color={selected ? colors.accent : colors.muted}/></View>;
}
const makeStyles = (colors: typeof light) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, gap: 20, paddingBottom: 32, width: '100%', maxWidth: 1180, alignSelf: 'center' },
  title: { fontSize: 30, lineHeight: 38, fontFamily: fonts.display, color: colors.ink, letterSpacing: -.7 },
  heading: { fontSize: 22, lineHeight: 30, fontFamily: fonts.display, color: colors.ink, flexShrink: 1 },
  text: { fontSize: 16, lineHeight: 26, fontFamily: fonts.body, color: colors.ink },
  prose: { fontSize: 16, lineHeight: 29, fontFamily: fonts.reading, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 22, fontFamily: fonts.body, color: colors.muted },
  label: { fontSize: 11, lineHeight: 18, fontFamily: fonts.semibold, color: colors.accent, letterSpacing: 1.8 },
  card: { padding: 18, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }, rule: { height: 1, backgroundColor: colors.line },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: fonts.body, color: colors.ink, backgroundColor: colors.card },
  button: { minHeight: 48, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: colors.onAccent, fontSize: 14, lineHeight: 22, fontFamily: fonts.semibold, flexShrink: 1, textAlign: 'center' },
  hero: { padding: 22, gap: 14, borderWidth: 1, borderColor: colors.line, borderTopWidth: 3, borderTopColor: colors.accent, borderRadius: 16, borderBottomRightRadius: 16, backgroundColor: colors.soft },
});
export function Page({ children, scroll = true, contentStyle, safeTop = false }: React.PropsWithChildren<{ scroll?: boolean; contentStyle?: StyleProp<ViewStyle>; safeTop?: boolean }>) {
  const { styles } = useUI();
  return <SafeAreaView style={styles.page} edges={safeTop ? ['top', 'bottom'] : ['bottom']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={95}>
    {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, contentStyle]}>{children}</ScrollView> : children}
  </KeyboardAvoidingView></SafeAreaView>;
}
export function Title({ eyebrow, children, description, centered = false }: React.PropsWithChildren<{ eyebrow?: string; description?: string; centered?: boolean }>) {
  const { styles } = useUI();
  return <View style={{ gap: 8, alignSelf: 'stretch', maxWidth: '100%' }}>{eyebrow && <Text style={[styles.label, centered && { textAlign: 'center' }]}>{eyebrow.toLocaleUpperCase('tr')}</Text>}<Text accessibilityRole="header" style={[styles.title, centered && { textAlign: 'center' }]}>{children}</Text>{description && <Text style={[styles.muted, centered && { textAlign: 'center' }]}>{description}</Text>}</View>;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  const { colors } = useUI();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: compact ? 29 : 35, height: compact ? 29 : 35, borderColor: colors.accent, borderWidth: 1, borderRadius: 3, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="pencil-outline" size={compact ? 16 : 20} color={colors.accent}/></View><View><Text style={{ fontFamily: fonts.display, color: colors.ink, fontSize: compact ? 20 : 24, letterSpacing: -.4 }}>ACB Atölyesi</Text></View></View>;
}
export function SectionHeading({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const { styles } = useUI();
  return <View style={{ gap: 5 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Text accessibilityRole="header" style={styles.heading}>{title}</Text>{action && onPress && <TextAction title={action} onPress={onPress}/>}</View>{detail && <Text style={styles.muted}>{detail}</Text>}</View>;
}
export function Button({ title, onPress, secondary, disabled, busy, icon, style }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const { colors, styles } = useUI();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && { backgroundColor: 'transparent', borderColor: colors.line }, style, { opacity: disabled || busy ? .5 : pressed ? .7 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? colors.accent : colors.onAccent} /> : icon && <Ionicons name={icon} size={18} color={secondary ? colors.accent : colors.onAccent} />}
    <Text style={[styles.buttonText, secondary && { color: colors.accent }]}>{title}</Text></Pressable>;
}
export function IconButton({ icon, label, onPress, active = false }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  const { colors } = useUI();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: active || pressed ? colors.soft : 'transparent' })}><Ionicons name={icon} size={22} color={colors.accent}/></Pressable>;
}
export function TextAction({ title, icon, onPress, disabled }: { title: string; icon?: IconName; onPress: () => void; disabled?: boolean }) {
  const { colors } = useUI();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, opacity: disabled ? .45 : pressed ? .65 : 1, flexShrink: 1 })}><Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, color: colors.accent, flexShrink: 1 }}>{title}</Text>{icon && <Ionicons name={icon} color={colors.accent} size={16}/>}</Pressable>;
}
export function Chip({ title, selected, onPress, disabled }: { title: string; selected?: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors } = useUI();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, borderWidth: 1, borderColor: selected ? colors.accent : colors.line, backgroundColor: selected ? colors.pale : colors.card, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', opacity: disabled ? .5 : pressed ? .65 : 1 })}><Text style={{ fontFamily: selected ? fonts.semibold : fonts.body, fontSize: 13, color: selected ? colors.accent : colors.muted }}>{title}</Text></Pressable>;
}
export function Segments({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  const { colors } = useUI();
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line, gap: 24, flexWrap: 'wrap' }}>{options.map(option => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: option.value === value }} onPress={() => onChange(option.value)} style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: option.value === value ? colors.accent : 'transparent', paddingVertical: 10 }}><Text style={{ fontFamily: option.value === value ? fonts.semibold : fonts.body, fontSize: 14, color: option.value === value ? colors.accent : colors.muted }}>{option.label}</Text></Pressable>)}</View>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors, styles } = useUI();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}><Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.muted }}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} selectionColor={colors.accent} {...props} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, props.multiline && { minHeight: 120, textAlignVertical: 'top' }, focused && { borderColor: colors.accent }, props.editable === false && { backgroundColor: colors.soft }, props.style]} /></View>;
}
export function SearchField({ value, onChangeText, placeholder = 'Ara…' }: { value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  const { colors } = useUI();
  return <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingLeft: 14 }}><Ionicons name="search-outline" size={20} color={colors.muted}/><TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={colors.muted} value={value} onChangeText={onChangeText} autoCorrect={false} maxLength={100} returnKeyType="search" style={{ flex: 1, minWidth: 0, minHeight: 52, padding: 12, fontFamily: fonts.body, fontSize: 15, color: colors.ink }}/>{!!value && <IconButton icon="close-outline" label="Aramayı temizle" onPress={() => onChangeText('')}/>}</View>;
}
export function Avatar({ name, uri, size = 38 }: { name?: string; uri?: string; size?: number }) {
  const { colors } = useUI();
  return uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors/> : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.display, fontSize: size * .43, color: colors.accent }}>{(name || 'A').slice(0, 1).toLocaleUpperCase('tr')}</Text></View>;
}
export function MenuRow({ title, detail, icon, onPress, danger }: { title: string; detail?: string; icon: IconName; onPress: () => void; danger?: boolean }) {
  const { colors, styles } = useUI();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 17, minHeight: 64, borderBottomWidth: 1, borderColor: colors.line, opacity: pressed ? .6 : 1 })}><Ionicons name={icon} size={21} color={danger ? colors.rust : colors.accent}/><View style={{ flex: 1, gap: 3 }}><Text style={[styles.text, { fontSize: 15, color: danger ? colors.rust : colors.ink }]}>{title}</Text>{detail && <Text style={[styles.muted, { fontSize: 12 }]}>{detail}</Text>}</View><Ionicons name="chevron-forward-outline" size={17} color={colors.muted}/></Pressable>;
}
export function Empty({ title, description }: { title: string; description?: string }) {
  const { colors, styles } = useUI();
  return <View style={{ paddingVertical: 30, paddingHorizontal: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', gap: 12, marginVertical: 8 }}><Ionicons name="book-outline" size={28} color={colors.accent}/><Text style={[styles.heading, { textAlign: 'center' }]}>{title}</Text>{description && <Text style={[styles.muted, { textAlign: 'center' }]}>{description}</Text>}</View>;
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const { colors, styles } = useUI();
  return error ? <View accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: colors.pale, borderLeftWidth: 3, borderLeftColor: colors.rust }]}><Text style={[styles.text, { color: colors.rust, fontSize: 14 }]}>{message(error)}</Text>{retry && <TextAction title="Tekrar dene" icon="refresh-outline" onPress={retry}/>}</View> : null;
}
export function Loading() {
  const { colors } = useUI(); return <ActivityIndicator style={{ padding: 25 }} size="large" color={colors.accent} accessibilityLabel="Yükleniyor"/>; }
export function useAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => { if (running.current) return; running.current = true; setBusy(true); setError(null); try { await fn(); } catch (e) { setError(e); } finally { running.current = false; setBusy(false); } };
  return { busy, error, run };
}
export function confirmDelete(title: string, action: () => void) { Alert.alert(title, 'Bu işlem geri alınamaz.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: action }]); }
