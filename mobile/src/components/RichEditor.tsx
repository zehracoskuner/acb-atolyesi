import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { editorDocument } from '../editorDocument';
import { useUI } from '../ui';
export type EditorHandle = { command: (name: string, value?: string) => void; replace: (html: string) => void; flush: () => Promise<void> };
// The editor loads an isolated local document, never a website.
export const RichEditor = forwardRef<EditorHandle, { initial: string; title?: string; position?: { scroll: number; start?: number; end?: number }; onPosition?: (position: { scroll: number; start?: number; end?: number }) => void; onUnsupported?: () => void; onPasteBlocked?: () => void; onChange: (html: string, organic: boolean, title?: string) => void; onBlur: () => void }>(function RichEditor({ initial, title, position, onPosition, onUnsupported, onPasteBlocked, onChange, onBlur }, ref) {
  const { colors } = useUI();
  const web = useRef<WebView>(null); const { fontScale } = useWindowDimensions();
  const requests = useRef(new Map<string, { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  useEffect(() => { const pending = requests.current; return () => { pending.forEach(r => { clearTimeout(r.timer); r.reject(new Error('Editör kapandı.')); }); pending.clear(); }; }, []);
  const applyTheme = useCallback(() => { web.current?.injectJavaScript(`document.body.style.backgroundColor=${JSON.stringify(colors.card)};document.body.style.color=${JSON.stringify(colors.ink)};document.documentElement.style.backgroundColor=${JSON.stringify(colors.card)};document.body.style.fontSize=${JSON.stringify(`${19 * fontScale}px`)};document.documentElement.style.setProperty('--muted',${JSON.stringify(colors.muted)});document.documentElement.style.setProperty('--accent',${JSON.stringify(colors.accent)});true;`); }, [colors, fontScale]);
  useEffect(applyTheme, [applyTheme]); // Preserve the editor document and selection.
  // Preserve selection/DOM during typing; only explicit conflict resolution replaces the document.
  // A chapter owns this component's lifetime. State/theme/save receipts never reload its DOM.
  const [source] = useState(() => ({ html: editorDocument(initial, fontScale, title, position) }));
  useEffect(() => { web.current?.injectJavaScript(`document.body.style.fontSize=${JSON.stringify(`${19 * fontScale}px`)};true;`); }, [fontScale]);
  useImperativeHandle(ref, () => ({ command(name, value) { web.current?.injectJavaScript(`window.command(${JSON.stringify(name)},${JSON.stringify(value || '')});true;`); },
    flush() { return new Promise<void>((resolve, reject) => { const token = `${Date.now()}:${Math.random()}`; const timer = setTimeout(() => { requests.current.delete(token); reject(new Error('Editör yanıt vermedi. Tekrar dene.')); }, 3000); requests.current.set(token, { resolve, reject, timer }); web.current?.injectJavaScript(`window.flush(${JSON.stringify(token)});true;`); }); },
    replace(html) { web.current?.injectJavaScript(`window.replaceContent(${JSON.stringify(html)});true;`); } }));
  return <WebView ref={web} source={source} onLoadEnd={applyTheme} style={{ flex: 1, backgroundColor: colors.card }} originWhitelist={['about:*']} onShouldStartLoadWithRequest={req => req.url === 'about:blank'}
    javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never" setSupportMultipleWindows={false}
    keyboardDisplayRequiresUserAction={false} hideKeyboardAccessoryView={false} textZoom={100} automaticallyAdjustContentInsets={false}
    onMessage={e => { try { const data = JSON.parse(e.nativeEvent.data); if (data.flushed) { const request = requests.current.get(data.flushed); if (request) { clearTimeout(request.timer); requests.current.delete(data.flushed); if (data.error) request.reject(new Error(data.error)); else request.resolve(); } } else if (data.unsupported) onUnsupported?.(); else if (data.pasteBlocked) onPasteBlocked?.(); else if (data.position) onPosition?.(data.position); else if (data.blur) onBlur(); else if (typeof data.content === 'string') onChange(data.content, data.organic !== false, data.title); } catch { /* Ignore malformed bridge messages. */ } }}/>;
});
