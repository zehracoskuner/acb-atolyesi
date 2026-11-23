// Visual approximation of native Dynamic Type for the isolated browser harness.
// Native Text already applies fontScale; RN Web needs explicit sizing for QA.
import React from 'react';
import * as Native from 'react-native-web';
export * from 'react-native-web';
const scale = () => Number(new URLSearchParams(location.search).get('fontScale')) || 1;
export function useWindowDimensions() { return { ...Native.useWindowDimensions(), fontScale: scale() }; }
function scaled(style, enabled) {
  const value = Native.StyleSheet.flatten(style) || {}, factor = enabled === false ? 1 : scale();
  return { ...value, ...(value.fontSize ? { fontSize: value.fontSize * factor } : {}), ...(value.lineHeight ? { lineHeight: value.lineHeight * factor } : {}) };
}
export const Text = React.forwardRef(({ style, allowFontScaling, ...props }, ref) => <Native.Text {...props} ref={ref} style={scaled(style, allowFontScaling)}/>);
export const TextInput = React.forwardRef(({ style, allowFontScaling, ...props }, ref) => <Native.TextInput {...props} ref={ref} style={scaled(style, allowFontScaling)}/>);
