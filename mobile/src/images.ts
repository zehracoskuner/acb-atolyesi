import * as ImagePicker from 'expo-image-picker';
import { api } from './api';
export async function pickAndUpload<T>(endpoint: string, field = 'file'): Promise<T | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;
  const image = result.assets[0];
  if (image.fileSize && image.fileSize > 5 * 1024 * 1024) throw new Error('5 MB altında bir görsel seç.');
  if (['avatar', 'banner'].includes(field) && image.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)) throw new Error('JPEG, PNG veya WebP türünde bir görsel seç.');
  const form = new FormData();
  form.append(field, { uri: image.uri, name: image.fileName || 'image.jpg', type: image.mimeType || 'image/jpeg' } as unknown as Blob);
  return api<T>(endpoint, 'POST', form, 60000);
}
