import React from 'react';
import { Text } from 'react-native';
import ionicons from '../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';
import feather from '../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json';
export const Ionicons = ({ name, size = 20, color, style }) => <Text aria-hidden style={[{ fontFamily: 'Ionicons', fontSize: size, color }, style]}>{String.fromCodePoint(ionicons[name] || 63)}</Text>;
export const Feather = ({ name, size = 20, color, style }) => <Text aria-hidden style={[{ fontFamily: 'Feather', fontSize: size, color }, style]}>{String.fromCodePoint(feather[name] || 63)}</Text>;
