import { beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('../src/api', () => ({ api: request }));
import { characterFields, characterPatch, relationPerspective, relationshipBody, saveCharacter } from '../src/characters';
const original = { _id: 'a', name: 'Ada', role: 'Tanık', color: '#abcdef', notes: 'Eski', x: 812, y: 411, faction: 'Kuzey', tagline: 'Bir ses' };
beforeEach(() => request.mockReset());
it('sends only changed editable fields with the owning work, preserving position and hidden metadata', async () => {
  await saveCharacter('work-A', { ...characterFields(original), notes: 'Yeni\nnot' }, original);
  expect(request).toHaveBeenCalledWith('/characters/a', 'PATCH', { workId: 'work-A', notes: 'Yeni\nnot' });
  expect(characterPatch(characterFields(original), characterFields(original))).toEqual({});
});
it('never creates a blank character and omits optional empty fields', async () => {
  await expect(saveCharacter('work-A', characterFields())).rejects.toThrow('adı'); expect(request).not.toHaveBeenCalled();
  await saveCharacter('work-B', { ...characterFields(), name: ' İpek ' });
  expect(request).toHaveBeenCalledWith('/characters', 'POST', { workId: 'work-B', name: 'İpek' });
});
it('preserves the draft and propagates failed saves for retry', async () => {
  const draft = { ...characterFields(original), notes: 'Kaybolmasın' }; request.mockRejectedValueOnce(new Error('offline'));
  await expect(saveCharacter('work-A', draft, original)).rejects.toThrow('offline'); expect(draft.notes).toBe('Kaybolmasın');
  request.mockResolvedValueOnce({ item: { ...original, ...draft } }); await saveCharacter('work-A', draft, original); expect(request).toHaveBeenCalledTimes(2);
});
it('keeps custom keys, swaps incoming endpoints and preserves strength and description', () => {
  const body = relationshipBody('work-A', 'a', 'b', 'custom_123', 'incoming', 5, ' Bir sır ');
  expect(body).toEqual({ workId: 'work-A', from: 'b', to: 'a', type: 'custom_123', directed: true, strength: 5, label: 'Bir sır' });
  expect(relationPerspective({ ...body, _id: 'r' }, 'a')).toEqual({ otherId: 'b', direction: 'Gelen ilişki' });
  expect(relationPerspective({ ...body, _id: 'r', directed: false }, 'b').direction).toBe('Karşılıklı');
  expect(() => relationshipBody('w', 'a', 'a', 'love', 'mutual', 3, '')).toThrow();
});
