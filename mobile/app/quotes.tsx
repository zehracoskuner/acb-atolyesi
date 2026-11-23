import { MemberGate } from '../src/components/MemberGate';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../src/api';
import { useResource } from '../src/useResource';
import { Button, Empty, ErrorBox, Page, Title, useAction, confirmDelete, useUI } from '../src/ui';
interface Quote { _id: string; text: string; workTitle: string; authorName: string; tags: string[] }
function QuotesRoute() {
  const { styles } = useUI();
  const [page, setPage] = useState(1); const resource = useResource<{ items: Quote[]; totalPages: number }>(`/quotes/my?page=${page}`); const action = useAction();
  return <Page><Title>Alıntılar</Title><ErrorBox error={resource.error} retry={resource.reload}/><ErrorBox error={action.error}/>{resource.data?.items.map(q => <View key={q._id} style={styles.card}><Text selectable style={styles.text}>“{q.text}”</Text><Text style={styles.muted}>{q.workTitle} · {q.authorName}</Text><Button secondary title="Alıntıyı sil" onPress={() => confirmDelete('Alıntıyı sil?', () => action.run(async () => { await api(`/quotes/${q._id}`, 'DELETE'); await resource.reload(); }))}/></View>)}{resource.data?.items.length === 0 && <Empty title="İçinde yankılanan cümleleri biriktir." description="Okuma ekranındaki Alıntı kaydet eylemini kullan."/>}
    <View style={styles.row}><Button secondary title="Önceki" disabled={page === 1} onPress={() => setPage(p => p - 1)}/><Button secondary title="Sonraki" disabled={page >= (resource.data?.totalPages || 1)} onPress={() => setPage(p => p + 1)}/></View></Page>;
}

export default function Quotes() { return <MemberGate title="Alıntılar"><QuotesRoute/></MemberGate>; }
