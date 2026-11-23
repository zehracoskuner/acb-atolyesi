import type { ExpoConfig } from 'expo/config';
const host = process.env.EXPO_PUBLIC_APP_LINK_HOST;
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const allowHttp = process.env.ACB_ALLOW_HTTP === '1';
const iosGoogleScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ? `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.replace('.apps.googleusercontent.com', '')}` : undefined;
const config: ExpoConfig = {
  name: 'ACB Atölyesi', slug: 'acb-atolyesi', version: '1.0.5', scheme: 'acbatolyesi',
  icon: './assets/icon.png', backgroundColor: '#F7F5F0',
  orientation: 'default', userInterfaceStyle: 'automatic', platforms: ['ios', 'android'],
  ios: { bundleIdentifier: 'com.acbatolyesi.mobile', buildNumber: '6', supportsTablet: true,
    infoPlist: { NSAppTransportSecurity: { NSAllowsArbitraryLoads: allowHttp }, NSLocalNetworkUsageDescription: 'Geliştirme sırasında yerel ACB sunucusuna bağlanır.' },
    ...(host ? { associatedDomains: [`applinks:${host}`] } : {}) },
  android: { package: 'com.acbatolyesi.mobile', versionCode: 6, softwareKeyboardLayoutMode: 'resize', blockedPermissions: ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#F7F5F0' },
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    ...(host ? { intentFilters: [{ action: 'VIEW', autoVerify: true,
      data: [{ scheme: 'https', host, pathPrefix: '/mobile-link' }], category: ['BROWSABLE', 'DEFAULT'] }] } : {}) },
  plugins: ['expo-router', 'expo-secure-store', 'expo-notifications', 'expo-system-ui', ['expo-image-picker', { photosPermission: 'Atölyene bir kapak veya profil fotoğrafı seçmek için fotoğraflarını kullanır.', cameraPermission: false, microphonePermission: false }],
    ['expo-build-properties', { android: { usesCleartextTraffic: allowHttp } }],
    ...(iosGoogleScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: iosGoogleScheme }] as [string, Record<string, unknown>]] : [])],
  experiments: { typedRoutes: false },
  extra: projectId ? { eas: { projectId } } : {},
};
export default config;
