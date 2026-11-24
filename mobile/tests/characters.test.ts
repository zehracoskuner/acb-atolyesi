import { beforeEach, expect, it, vi } from 'vitest';
import { characterFields, characterPatch, relationPerspective, relationshipBody, saveCharacter, saveCharacterPosition } from '../src/characters';
import { edgeShape, layoutPositions } from '../src/characterMapGeometry';
const request = vi.hoisted(() => vi.fn());
vi.mock('../src/api', () => ({ api: request }));
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

it('persists only the dragged position with the owning work', async () => {
  await saveCharacterPosition('work-A', 'a/b', 520, 310);
  expect(request).toHaveBeenCalledWith('/characters/a%2Fb/position', 'PATCH', { workId: 'work-A', x: 520, y: 310 });
});

it('keeps stored positions and consistently places characters that share a default position', () => {
  const characters = [{ _id: 'a', x: 240, y: 200 }, { _id: 'b', x: 240, y: 200 }, { _id: 'c', x: 160, y: 120 }, { _id: 'd' }];
  const positions = layoutPositions(characters);
  expect(positions.a).toEqual({ x: 240, y: 200 });
  expect(positions.c).toEqual({ x: 160, y: 120 });
  expect(positions.b).toEqual({ x: 320, y: 120 });
  expect(positions.d).toEqual({ x: 480, y: 120 });
  expect(layoutPositions([...characters].reverse())).toEqual(positions);
});

it('draws a finite path when one character is dragged onto another', () => {
  const point = { x: 240, y: 200 };
  const directed = edgeShape(point, point, true);
  expect(directed.d).not.toMatch(/NaN|Infinity/);
  expect(directed.arrow).not.toMatch(/NaN|Infinity/);
  expect(Number.isFinite(directed.mid.x) && Number.isFinite(directed.mid.y)).toBe(true);
  expect(edgeShape(point, point, false).arrow).toBeNull();
});
