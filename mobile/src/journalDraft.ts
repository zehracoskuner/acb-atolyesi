export const JOURNAL_LIMIT = 800;
export interface JournalDraft { content: string; visibility: 'public' | 'followers' | 'private'; relatedWork: string }
export const journalDraftKey = (userId: string, id?: string) => `acb.log-draft:${userId}${id ? `:edit:${id}` : ''}`;
export function parseJournalDraft(raw: string): JournalDraft {
  const value = JSON.parse(raw);
  if (typeof value.content !== 'string' || !['public', 'followers', 'private'].includes(value.visibility) || typeof value.relatedWork !== 'string')
    throw new Error('Cihazdaki taslak okunamadı. Kayıt değiştirilmedi.');
  return value;
}
