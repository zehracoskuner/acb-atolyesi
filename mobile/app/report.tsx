import { MemberGate } from '../src/components/MemberGate';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../src/api';
import { Button, ErrorBox, Field, Page, Title, useAction, useUI } from '../src/ui';
const reasons: Record<string, string> = { spam: 'Spam', uygunsuz_icerik: 'Uygunsuz içerik', telif_ihlali: 'Telif ihlali', taciz: 'Taciz', nefret_soylemi: 'Nefret söylemi', diger: 'Diğer' };
function ReportRoute() {
  const { styles } = useUI();
  const { targetId, targetType } = useLocalSearchParams<{ targetId: string; targetType: string }>(); const action = useAction(); const [selectedReason, setReason] = useState('diger'); const [description, setDescription] = useState(''); const [originalWork, setOriginalWork] = useState(''); const [done, setDone] = useState(false);
  const options = Object.entries(reasons).filter(([key]) => targetType !== 'comment' || key !== 'telif_ihlali');
  const reason = options.some(([key]) => key === selectedReason) ? selectedReason : 'diger';
  return <Page><Title description="Bildirimin mevcut moderasyon sürecine iletilir.">Atölyeye bildir.</Title>{done ? <><Text style={styles.text}>Bildirimin alındı. Başvurularım ekranından takip edebilirsin.</Text><Button title="Başvurularımı aç" onPress={() => router.replace('/reports')}/></> : <><View style={styles.row}>{options.map(([key, label]) => <Button key={key} secondary title={`${reason === key ? '✓ ' : ''}${label}`} onPress={() => setReason(key)}/>)}</View><Field label="Açıklama" multiline value={description} onChangeText={setDescription}/>{reason === 'telif_ihlali' && <Field label="Özgün eserin kaynağı ve hak sahipliği" multiline value={originalWork} onChangeText={setOriginalWork}/>}<Button title="Bildirimi gönder" busy={action.busy} disabled={!description.trim()} onPress={() => action.run(async () => { await api('/reports', 'POST', { targetType, targetId, reason, description, originalWork }); setDone(true); })}/><ErrorBox error={action.error}/></>}</Page>;
}

export default function Report() { return <MemberGate title="İçeriği bildir"><ReportRoute/></MemberGate>; }
