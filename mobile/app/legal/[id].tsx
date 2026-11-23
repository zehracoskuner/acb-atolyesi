import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useResource } from '../../src/useResource';
import type { MobileConfig } from '../../src/types';
import { ErrorBox, Loading, Page, Title, useUI } from '../../src/ui';
export default function Legal() {
  const { styles } = useUI();
  const { id } = useLocalSearchParams<{ id: string }>(); const resource = useResource<MobileConfig>('/mobile/config'); const doc = resource.data?.legal.find(d => d.id === id);
  return <Page>{resource.loading && <Loading/>}<ErrorBox error={resource.error} retry={resource.reload}/>{doc && <><Title>{doc.title}</Title><Text style={styles.muted}>Sürüm: {resource.data?.termsVersion} · Mevcut üründeki hukuki inceleme taslağı</Text>{doc.sections.map((section, i) => <View key={i} style={{ gap: 10 }}><Text style={styles.heading}>{section.title}</Text><Text selectable style={styles.text}>{section.content}</Text></View>)}</>}</Page>;
}
