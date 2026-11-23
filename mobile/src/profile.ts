export const profileSections = [
  { id: 'logs', label: 'Günlük' }, { id: 'works', label: 'Eserler' },
  { id: 'quotes', label: 'Alıntılar' }, { id: 'lists', label: 'Okuma listeleri' },
  { id: 'drafts', label: 'Taslaklar', owner: true }, { id: 'library', label: 'Kütüphane', owner: true },
] as const;
export type ProfileSection = typeof profileSections[number]['id'];
export function profileSection(value: unknown, owner: boolean): ProfileSection {
  return profileSections.find(s => s.id === value && (owner || !('owner' in s)))?.id || 'logs';
}
export function safeWebsite(value?: string) {
  if (!value?.trim()) return null;
  try {
    const text = value.trim();
    const url = new URL(/^[\w+.-]+:/.test(text) ? text : `https://${text}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function profileColumns(width: number, fontScale: number) { return width < 360 || fontScale > 1.3 ? 1 : width >= 850 ? 3 : 2; }
export function workState(work: { status?: string; pendingReviewCount?: number; rejectedCount?: number; unpublishedChangesCount?: number }) {
  return [work.status === 'published' ? 'Yayında' : work.status === 'archived' ? 'Arşivde' : 'Taslak',
    work.pendingReviewCount ? `${work.pendingReviewCount} bölüm incelemede` : '',
    work.rejectedCount ? `${work.rejectedCount} bölüm için düzeltme istendi` : '',
    work.unpublishedChangesCount ? `${work.unpublishedChangesCount} bölümde yayınlanmamış değişiklik` : '',
  ].filter(Boolean).join(' · ');
}
