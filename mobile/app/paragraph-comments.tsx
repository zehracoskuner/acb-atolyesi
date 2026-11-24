import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ParagraphComments() {
  const { workId, chapterId } = useLocalSearchParams<{ workId?: string; chapterId?: string }>();
  if (!workId || !chapterId) return <Redirect href="/" />;
  return <Redirect href={{ pathname: '/read/[workId]/[chapterId]', params: { workId, chapterId, mode: 'start' } }} />;
}
