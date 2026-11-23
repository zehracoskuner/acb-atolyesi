import { Text, View } from 'react-native';
import { useUI } from '../ui';
export function ResultView({ value }: { value: unknown }) {
  const { styles } = useUI();
  if (value == null) return null;
  if (typeof value !== 'object') return <Text selectable style={styles.text}>{String(value)}</Text>;
  return <View style={{ gap: 12 }}>{Object.entries(value).filter(([key]) => !['_id', '__v'].includes(key)).map(([key, item]) => <View key={key}><Text style={styles.muted}>{key}</Text><ResultView value={item}/></View>)}</View>;
}
