import { MemberGate } from '../src/components/MemberGate';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../src/api';
import { useResource } from '../src/useResource';
import { ResultView } from '../src/components/ResultView';
import { Button, Empty, ErrorBox, Field, Page, Title, useAction, useUI } from '../src/ui';
interface Report { _id: string; revision: number; reason: string; status: string; stage?: string; description: string; decisions?: unknown[]; canAppeal?: boolean }
function ReportsRoute() {
  const { styles } = useUI();
  const { id: initialId } = useLocalSearchParams<{ id?: string }>(); const [id, setId] = useState(initialId || ''); const [text, setText] = useState(''); const [decisions, setDecisions] = useState(false); const action = useAction();
  const list = useResource<{ sikayetler: Report[] }>(decisions ? '/reports/decisions' : '/reports/mine'); const detail = useResource<{ report: Report }>(id ? `/reports/${id}` : null);
  return <Page><Title>Başvurularım</Title><View style={styles.row}><Button secondary title="Bildirimlerim" onPress={() => setDecisions(false)}/><Button secondary title="İçeriklerime ilişkin kararlar" onPress={() => setDecisions(true)}/></View><ErrorBox error={list.error} retry={list.reload}/>{list.data?.sikayetler.map(r => <View key={r._id} style={styles.card}><Text style={styles.text}>{r.description}</Text><Text style={styles.muted}>{r.stage || r.status}</Text><Button secondary title="Dosyayı aç" onPress={() => setId(r._id)}/></View>)}{list.data?.sikayetler.length === 0 && <Empty title="Henüz başvuru yok."/>}
    <ErrorBox error={detail.error} retry={detail.reload}/>{detail.data && <View style={styles.card}><Text style={styles.heading}>Başvuru ayrıntıları</Text><Text style={styles.text}>{detail.data.report.description}</Text><ResultView value={detail.data.report.decisions}/>{detail.data.report.reason === 'telif_ihlali' && <><Field label="Ek bilgi veya itiraz gerekçesi" multiline value={text} onChangeText={setText}/><Button secondary title="Ek bilgi gönder" busy={action.busy} disabled={!text.trim() || !['awaiting_information', 'appeal_review'].includes(detail.data.report.stage || '')} onPress={() => action.run(async () => { await api(`/reports/${id}/information`, 'POST', { text, revision: detail.data!.report.revision }); setText(''); await detail.reload(); })}/><Button secondary title="Karara itiraz et" busy={action.busy} disabled={!text.trim() || !detail.data.report.canAppeal} onPress={() => action.run(async () => { await api(`/reports/${id}/appeal`, 'POST', { text, revision: detail.data!.report.revision }); setText(''); await detail.reload(); })}/></>}</View>}<ErrorBox error={action.error}/></Page>;
}

export default function Reports() { return <MemberGate title="Başvurularım"><ReportsRoute/></MemberGate>; }
