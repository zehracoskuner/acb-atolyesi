import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
export const WebView = forwardRef(function PreviewEditor({ source, style, onMessage, onLoadEnd }, ref) {
  const frame = useRef(null);
  useImperativeHandle(ref, () => ({ injectJavaScript(script) { const doc = frame.current?.contentDocument; if (doc) { const node = doc.createElement('script'); node.textContent = script; doc.body.appendChild(node); node.remove(); } } }));
  useEffect(() => { const handle = event => { if (event.source === frame.current?.contentWindow && typeof event.data?.editorData === 'string') onMessage({ nativeEvent: { data: event.data.editorData } }); }; window.addEventListener('message', handle); return () => window.removeEventListener('message', handle); }, [onMessage]);
  const html = source.html.replace('<script>', `<script>window.ReactNativeWebView={postMessage:data=>window.parent.postMessage({editorData:data},${JSON.stringify(window.location.origin)})};</script><script>`);
  return <View style={[{ flex: 1 }, style]}><iframe onLoad={onLoadEnd} ref={frame} title="Yerel yazı alanı" srcDoc={html} style={{ border: 0, flex: 1, minHeight: 180, width: '100%' }}/></View>;
});
