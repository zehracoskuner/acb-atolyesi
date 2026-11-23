import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { joinAtelier, MemberGate } from '../src/components/MemberGate';
import { ReaderComments } from '../src/components/ReaderComments';
import { ReaderSheet } from '../src/components/ReaderControls';
import { useResource } from '../src/useResource';
import { useSession } from '../src/session';
import { readerPalettes, type ReaderBlock } from '../src/readerModel';
import { Button, ErrorBox, Loading, Page, Title, useUI } from '../src/ui';
function ParagraphCommentsContent() {
  const { workId, chapterId } = useLocalSearchParams<{ workId: string; chapterId: string }>();
  const { user } = useSession(); const { dark, styles } = useUI();
  const chapter = useResource<{ item: { blocks: ReaderBlock[]; contentVersion: string } }>(`/public/works/${workId}/chapters/${chapterId}`);
  const [selected, setSelected] = useState<ReaderBlock | 'detached' | null>(null);
  const backHandler = useRef<(() => boolean) | null>(null);
  return <Page><Title>Paragraf yorumları</Title>{chapter.loading && <Loading/>}<ErrorBox error={chapter.error} retry={chapter.reload}/>
    <Button secondary title="Önceki sürümdeki paragraf yorumları" onPress={() => setSelected('detached')}/>{chapter.data?.item.blocks.filter(block => block.text).map(block => <View key={block.id + block.index} style={styles.card}><Text style={styles.text}>{block.text.slice(0, 220)}</Text><Button secondary title="Bu paragrafa yorum yaz" onPress={() => setSelected(block)}/></View>)}
    {selected && chapter.data && <ReaderSheet title="Paragraf yorumları" palette={readerPalettes[dark ? 'dark' : 'light']} reducedMotion close={() => { if (!backHandler.current?.()) setSelected(null); }} virtualized><ReaderComments workId={workId} chapterId={chapterId} userId={user?._id} block={selected === 'detached' ? undefined : selected} detached={selected === 'detached'} version={chapter.data.item.contentVersion} palette={readerPalettes[dark ? 'dark' : 'light']} workTitle="Eser" chapterTitle="Paragraf yorumları" onChanged={() => {}} onTotal={() => {}} onLogin={() => joinAtelier()} backHandler={backHandler} onProfile={id => { setSelected(null); router.push(('/profile/' + id) as any); }}/></ReaderSheet>}
  </Page>;
}
export default function ParagraphComments() { return <MemberGate title="Paragraf yorumları"><ParagraphCommentsContent/></MemberGate>; }
