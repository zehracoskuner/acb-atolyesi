import { AccessibilityInfo, findNodeHandle, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '../ui';
import type { ReaderPalette } from '../readerModel';
export function focusReaderControl(control: Text | View | null) {
  if (Platform.OS === 'web') { (control as unknown as { focus?: () => void })?.focus?.(); return; }
  const node = findNodeHandle(control); if (node) AccessibilityInfo.setAccessibilityFocus(node);
}
export function ReaderButton({ title, onPress, palette: c, primary, disabled, selected, accessibilityLabel }: { title: string; onPress: () => void; palette: ReaderPalette; primary?: boolean; disabled?: boolean; selected?: boolean; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minWidth: 48, minHeight: 48, padding: 12, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: selected ? c.accent : c.line, backgroundColor: primary ? c.accent : selected ? c.soft : c.paper, opacity: disabled ? .5 : pressed ? .7 : 1 })}><Text style={{ color: primary ? c.onAccent : c.ink, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center' }}>{title}</Text></Pressable>;
}
export function ReaderField({ palette: c, label, ...props }: TextInputProps & { label: string; palette: ReaderPalette }) {
  return <View style={{ gap: 8 }}><Text style={{ color: c.muted }}>{label}</Text><TextInput {...props} multiline accessibilityLabel={label} placeholderTextColor={c.muted} selectionColor={c.accent} style={{ minHeight: 120, borderWidth: 1, borderColor: c.line, color: c.ink, backgroundColor: c.soft, borderRadius: 12, padding: 14, fontFamily: fonts.body, fontSize: 17, textAlignVertical: 'top' }}/></View>;
}
export function ReaderSheet({ title, palette: c, close, children, reducedMotion, virtualized = false }: React.PropsWithChildren<{ title: string; palette: ReaderPalette; close: () => void; reducedMotion: boolean; virtualized?: boolean }>) {
  const heading = useRef<Text>(null);
  const insets = useSafeAreaInsets();
  return <Modal transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={() => { if (Keyboard.isVisible()) Keyboard.dismiss(); else close(); }} onShow={() => focusReaderControl(heading.current)}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}>
      <Pressable accessibilityLabel="Paneli kapat" onPress={close} style={{ flex: 1, minHeight: 24 }}/>
      <View accessibilityViewIsModal style={{ maxHeight: '94%', height: virtualized ? '94%' : undefined, width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: c.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 18, paddingBottom: Math.max(16, insets.bottom) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14 }}><Text ref={heading} accessible accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.display, color: c.ink, fontSize: 24 }}>{title}</Text><ReaderButton title="Kapat" palette={c} onPress={close}/></View>
        {virtualized ? children : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>{children}</ScrollView>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
