import { useEffect, useRef, useState } from 'react';
import { Linking, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { readerDocument, type ReaderDocumentData } from '../readerDocument';
import type { ReaderLocation, ReaderPalette, ReaderPrefs } from '../readerModel';
export type ReaderMessage = { ready?: boolean; action?: string; paragraph?: number; selection?: string; position?: ReaderLocation; direction?: number; link?: string };
export type ReaderSurfaceProps = { data: ReaderDocumentData; prefs: ReaderPrefs; palette: ReaderPalette; location: ReaderLocation; counts: Record<number, number>; commentTotal?: number; likeBusy?: boolean; like?: { liked: boolean; likeCount: number }; onMessage: (data: ReaderMessage) => void };
export function ReaderSurface(props: ReaderSurfaceProps) {
  const { fontScale } = useWindowDimensions(); const web = useRef<WebView>(null);
  const [source] = useState(() => ({ html: readerDocument(props.data, props.prefs, props.palette, fontScale, props.location) }));
  const applyPrefs = () => web.current?.injectJavaScript(`window.readerPrefs?.(${JSON.stringify(props.prefs)},${JSON.stringify(props.palette)},${fontScale});true;`);
  const applySocial = () => web.current?.injectJavaScript(`window.readerCounts?.(${JSON.stringify(props.counts)});window.readerTotal?.(${JSON.stringify(props.commentTotal ?? null)});window.readerLike?.(${props.like?.liked || false},${props.like?.likeCount ?? 'null'},${!!props.likeBusy});true;`);
  const apply = () => { applyPrefs(); applySocial(); };
  useEffect(applyPrefs, [props.prefs, props.palette, fontScale]);
  useEffect(applySocial, [props.counts, props.like, props.commentTotal, props.likeBusy]);
  return <WebView ref={web} source={source} onLoadEnd={apply} style={{ flex: 1, backgroundColor: props.palette.paper }} originWhitelist={['about:*']}
    onShouldStartLoadWithRequest={req => req.url === 'about:blank'} javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never" setSupportMultipleWindows={false} textZoom={100} automaticallyAdjustContentInsets={false}
    menuItems={[{ label: 'Alıntılarıma ekle', key: 'quote' }]} onCustomMenuSelection={event => props.onMessage({ selection: event.nativeEvent.selectedText, action: 'quote' })}
    onMessage={event => { try { const data = JSON.parse(event.nativeEvent.data) as ReaderMessage; if (data.link && /^https?:\/\//.test(data.link)) { void Linking.openURL(data.link); return; } props.onMessage(data); } catch { /* Ignore malformed bridge messages. */ } }}/ >;
}
