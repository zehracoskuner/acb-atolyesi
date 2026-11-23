import React from 'react';
import { View } from 'react-native';
// Browser has no native safe area; device insets are still handled by the real native provider.
export const SafeAreaProvider = ({ children }) => <>{children}</>;
export const SafeAreaView = ({ children, edges, ...props }) => <View {...props}>{children}</View>;
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
