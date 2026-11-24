import { api } from './api';
import type { Character } from './types';
export type CharacterFields = { name: string; role: string; color: string; notes: string };
export type CharacterRelation = { _id: string; from: string; to: string; type: string; label?: string; directed?: boolean; strength?: number };
export const relationshipTypes: Record<string, string> = { love: 'Aşk', conflict: 'Çatışma', manip: 'Manipülasyon', protect: 'Koruma', trauma: 'Travma', alliance: 'İttifak', secret: 'Sır', rivalry: 'Rekabet', unknown: 'Belirsiz' };
export function characterFields(c?: Character): CharacterFields { return { name: c?.name || '', role: c?.role || '', color: c?.color || '', notes: c?.notes || '' }; }
export function characterPatch(before: CharacterFields, after: CharacterFields) {
  const patch: Partial<CharacterFields> = {};
  for (const key of ['name', 'role', 'color', 'notes'] as const) if (before[key] !== after[key]) patch[key] = key === 'notes' ? after[key] : after[key].trim();
  return patch;
}
export async function saveCharacter(workId: string, draft: CharacterFields, original?: Character) {
  if (!workId || !draft.name.trim()) throw new Error('Karakter adı zorunlu.');
  const fields = original ? characterPatch(characterFields(original), draft) : Object.fromEntries(Object.entries(draft).filter(([, value]) => value.trim()).map(([key, value]) => [key, key === 'notes' ? value : value.trim()]));
  return api<{ item: Character }>(original ? `/characters/${encodeURIComponent(original._id)}` : '/characters', original ? 'PATCH' : 'POST', { workId, ...fields });
}
export function relationPerspective(r: CharacterRelation, id: string) { return { otherId: r.from === id ? r.to : r.from, direction: r.directed === false ? 'Karşılıklı' : r.from === id ? 'Giden ilişki' : 'Gelen ilişki' }; }
export function relationshipBody(workId: string, source: string, target: string, type: string, direction: string, strength: number, label: string) {
  if (!workId || !source || !target || source === target || !type.trim() || strength < 1 || strength > 5 || !Number.isInteger(strength)) throw new Error('İlişki alanlarını kontrol et.');
  return { workId, from: direction === 'incoming' ? target : source, to: direction === 'incoming' ? source : target, type: type.trim(), directed: direction !== 'mutual', strength, label: label.trim() };
}

export type MapCharacter = Character & { x?: number; y?: number };

const relationStyles: Record<string, { emoji: string; color: string }> = {
  love: { emoji: '❤️', color: '#fb7185' },
  conflict: { emoji: '⚡', color: '#f97316' },
  manip: { emoji: '🧠', color: '#a78bfa' },
  protect: { emoji: '🛡️', color: '#22c55e' },
  trauma: { emoji: '💔', color: '#60a5fa' },
  alliance: { emoji: '🤝', color: '#facc15' },
  secret: { emoji: '🤫', color: '#e879f9' },
  rivalry: { emoji: '🗡️', color: '#fb923c' },
  unknown: { emoji: '❓', color: '#94a3b8' },
};

export function relationMeta(type: string) {
  if (!Object.hasOwn(relationStyles, type)) return { label: type, emoji: '🧵', color: '#94a3b8' };
  return { ...relationStyles[type]!, label: relationshipTypes[type]! };
}

export function saveCharacterPosition(workId: string, id: string, x: number, y: number) {
  return api<{ item: MapCharacter }>('/characters/' + encodeURIComponent(id) + '/position', 'PATCH', { workId, x, y });
}

export function deleteCharacterRelation(workId: string, id: string) {
  return api('/relationships/' + encodeURIComponent(id) + '?workId=' + encodeURIComponent(workId), 'DELETE');
}
