import { router } from 'expo-router';
import { Text, View } from 'react-native';
import type { Draft } from '../draftEngine';
import { groupDeviceDrafts, type StudioWork } from '../studioStorage';
import { Button, useUI } from '../ui';
import type { SyncIssue } from '../syncResult';

export function LocalDraftShelf({ drafts, works, issues = [] }: { drafts: Draft[]; works: StudioWork[]; issues?: SyncIssue[] }) {
  const { styles } = useUI();
  if (!drafts.length) return null;
  return <View style={{ gap: 16 }}>
    <Text accessibilityRole="header" style={styles.heading}>Bu cihazdaki bölümler</Text>
    <Text style={styles.muted}>Daha önce açtığın bölümlere internet olmadan da dönüp yazabilirsin.</Text>
    {groupDeviceDrafts(drafts, works).map(group => <View key={group.workId} style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>{group.title || 'Cihazda kayıtlı eser'}</Text>
      {group.drafts.map(draft => <View key={draft.chapterId} style={{ gap: 8 }}>
        <Text style={styles.text}>{draft.title}</Text>
        <Text style={styles.muted}>{draft.conflict ? 'Sürüm çakışması · iki metin de korunuyor' : draft.dirty ? 'Cihazda kayıtlı · eşitleme bekliyor' : 'Cihazda kayıtlı · son eşitleme tamamlandı'}</Text>
        {issues.filter(issue => issue.kind === 'chapter' && issue.id === draft.chapterId).map(issue => <Text key={issue.id} accessibilityLiveRegion="polite" style={styles.text}>Eşitlenemedi: {issue.message}</Text>)}
        <Button secondary title="Yazmaya devam et" onPress={() => router.push({ pathname: '/write/[id]', params: { id: draft.chapterId, workId: draft.workId } })}/>
      </View>)}
    </View>)}
  </View>;
}
