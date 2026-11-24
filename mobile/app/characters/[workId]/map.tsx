import { Stack, useLocalSearchParams } from 'expo-router';
import CharacterMapScreen from '../../../src/components/CharacterMapScreen';
import { MemberGate } from '../../../src/components/MemberGate';
import { Empty, Page } from '../../../src/ui';

export default function CharacterMapRoute() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Karakter haritası' }} />
      <MemberGate title="Karakter haritası">
        {typeof workId === 'string' && workId ? <CharacterMapScreen key={workId} workId={workId} /> : (
          <Page><Empty title="Eser seçilmedi." /></Page>
        )}
      </MemberGate>
    </>
  );
}
