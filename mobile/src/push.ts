import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';
export async function enablePush() {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!Device.isDevice) throw new Error('Push bildirimleri için fiziksel cihaz kullan.');
  if (!projectId) throw new Error('Telefon bildirimleri henüz hazır değil. Bildirimlerini uygulamanın içinden takip edebilirsin.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('atelier', { name: 'Atölye', importance: Notifications.AndroidImportance.DEFAULT });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Bildirim izni verilmedi. Sistem ayarlarından açabilirsin.');
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api('/mobile/push-device', 'POST', { token: data, platform: Platform.OS });
  await SecureStore.setItemAsync('acb.push', data);
}
export async function disablePush() {
  const token = await SecureStore.getItemAsync('acb.push');
  if (token) await api('/mobile/push-device', 'DELETE', { token });
  await SecureStore.deleteItemAsync('acb.push');
}
