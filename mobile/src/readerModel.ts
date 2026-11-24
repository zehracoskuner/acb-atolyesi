export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'system';
export type ReaderPrefs = { size: number; spacing: number; serif: boolean; theme: ReaderTheme; markers: boolean };
export const defaultReaderPrefs: ReaderPrefs = { size: 19, spacing: 1.7, serif: true, theme: 'system', markers: true };
export const readerPalettes = {
  light: { paper: '#FAFAF7', ink: '#25352F', muted: '#5D6B63', accent: '#236455', line: '#DCE2DA', soft: '#EDF2EC', onAccent: '#FFFFFF' },
  sepia: { paper: '#F4EAD6', ink: '#40372B', muted: '#74614A', accent: '#77512E', line: '#D9C9AD', soft: '#EBDDC4', onAccent: '#FFFFFF' },
  dark: { paper: '#18201D', ink: '#E5E9DF', muted: '#AFBBAF', accent: '#A5D4BB', line: '#39493F', soft: '#26372D', onAccent: '#15281D' },
};
export type ReaderPalette = typeof readerPalettes.light;
export type ReaderBlock = { id: string; index: number; html: string; text: string; paragraphId?: string; anchorScale?: number };
export type ReaderLocation = { scrollPosition: number; anchor?: { id: string; fraction: number } };
export function parseReaderPrefs(value: string | null): ReaderPrefs {
  try { const p = JSON.parse(value || '{}'); return {
    size: Math.max(14, Math.min(34, Number(p.size) || 19)), spacing: Math.max(1.4, Math.min(2.2, Number(p.spacing) || 1.7)),
    serif: p.serif !== false, markers: p.markers !== false,
    theme: ['light', 'sepia', 'dark', 'system'].includes(p.theme) ? p.theme : 'system',
  }; } catch { return defaultReaderPrefs; }
}
export function resumeLocation(mode: string | undefined, chapterId: string, saved: (ReaderLocation & { chapterId: string }) | null): ReaderLocation {
  return mode === 'resume' && saved?.chapterId === chapterId ? saved : { scrollPosition: 0 };
}
