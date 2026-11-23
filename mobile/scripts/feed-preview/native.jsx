// Font scaling emulation for browser layout QA; native scaling needs a device.
import React from 'react';
import * as RN from 'react-native-web';
export * from 'react-native-web';
const scale = Number(new URLSearchParams(location.search).get('fontScale')) || 1;
const scaled = props => { const style = RN.StyleSheet.flatten(props.style) || {}; return { ...props, style: [props.style, props.allowFontScaling === false ? {} : { ...(style.fontSize ? { fontSize: style.fontSize * scale } : {}), ...(style.lineHeight ? { lineHeight: style.lineHeight * scale } : {}) }] }; };
export const Text = React.forwardRef((props, ref) => <RN.Text {...scaled(props)} ref={ref}/>);
export const TextInput = React.forwardRef((props, ref) => <RN.TextInput {...scaled(props)} ref={ref}/>);
export function useWindowDimensions() { return { ...RN.useWindowDimensions(), fontScale: scale }; }
