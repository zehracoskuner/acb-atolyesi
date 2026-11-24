import { AccessibilityInfo, findNodeHandle, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
export function ReaderField({ palette: c, label, compact = false, ...props }: TextInputProps & { label: string; palette: ReaderPalette; compact?: boolean }) {
  return <View style={{ gap: 8 }}>
    {!compact && <Text style={{ color: c.muted }}>{label}</Text>}
    <TextInput {...props} multiline accessibilityLabel={label} placeholder={props.placeholder ?? (compact ? label : undefined)} placeholderTextColor={c.muted} selectionColor={c.accent} style={{ minHeight: compact ? 64 : 120, maxHeight: compact ? 128 : undefined, borderWidth: 1, borderColor: c.line, color: c.ink, backgroundColor: c.soft, borderRadius: 12, padding: compact ? 10 : 14, fontFamily: fonts.body, fontSize: compact ? 16 : 17, textAlignVertical: 'top' }}/>
  </View>;
}
export function ReaderSheet({ title, palette: c, close, children, reducedMotion, compact = false, virtualized = false }: React.PropsWithChildren<{ title: string; palette: ReaderPalette; close: () => void; reducedMotion: boolean; compact?: boolean; virtualized?: boolean }>) {
  const heading = useRef<Text>(null);
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (!compact) return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, [compact]);
  const height = compact && !keyboardOpen ? '58%' : virtualized ? '94%' : undefined;
  return <Modal transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={() => { if (Keyboard.isVisible()) Keyboard.dismiss(); else close(); }} onShow={() => focusReaderControl(heading.current)}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: compact ? '#00000038' : '#00000066', justifyContent: 'flex-end' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Paneli kapat" onPress={close} style={{ flex: 1, minHeight: 24 }}/>
      <View accessibilityViewIsModal style={{ maxHeight: '94%', height, width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: c.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: compact ? 18 : 22, paddingTop: compact ? 10 : 18, paddingBottom: Math.max(16, insets.bottom) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: compact ? 8 : 14 }}>
          <Text ref={heading} accessible accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.display, color: c.ink, fontSize: compact ? 22 : 24 }}>{title}</Text>
          {compact ? <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={close} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.line : c.soft })}>
            <Ionicons name="close" size={22} color={c.ink} />
          </Pressable> : <ReaderButton title="Kapat" palette={c} onPress={close}/>}
        </View>
        {virtualized ? children : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>{children}</ScrollView>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
