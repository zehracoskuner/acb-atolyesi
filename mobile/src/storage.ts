import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Draft, DraftStorage } from './draftEngine';
export const draftStorage: DraftStorage = {
  async read(key) { const value = await AsyncStorage.getItem(key); return value ? JSON.parse(value) as Draft : null; },
  async write(key, draft) { await AsyncStorage.setItem(key, JSON.stringify(draft)); },
};
export async function listDrafts(userId: string): Promise<Draft[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(`draft:${userId}:`) && !k.includes(':backup:'));
  return (await AsyncStorage.multiGet(keys)).flatMap(([, value]) => value ? [JSON.parse(value) as Draft] : []);
}
