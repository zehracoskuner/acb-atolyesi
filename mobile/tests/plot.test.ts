import { describe, expect, it } from 'vitest';
import { filterScenes, plotActs, sceneLinks } from '../src/plot';
import type { Scene } from '../src/types';
const scenes: Scene[] = [
  { _id: 'a', title: 'İstanbul', description: '', goal: '', status: 'idea', order: 0, act: 'eski', connections: [{ target: 'b', edgeType: 'karar' }], isAlternative: true },
  { _id: 'b', title: 'Dönüş', description: '', goal: '', status: 'done', order: 1, act: 'giris', characters: [{ _id: 'c', name: 'İpek' }] },
];
describe('mobile plot data', () => {
  it('keeps unknown acts accessible after changing structure and offers no implicit structure for an empty work', () => {
    expect(plotActs(undefined, [])).toEqual([]);
    expect(plotActs({ acts: [{ id: 'giris', label: 'Giriş' }] }, scenes)).toEqual([{ id: 'giris', label: 'Giriş' }, { id: 'eski', label: 'eski' }]);
  });
  it('filters Turkish text and intersects act, status and character without mutating the full list', () => {
    expect(filterScenes(scenes, 'istan', '', '', '').map(s => s._id)).toEqual(['a']);
    expect(filterScenes(scenes, '', 'giris', 'done', 'c').map(s => s._id)).toEqual(['b']);
    expect(scenes).toHaveLength(2);
  });
  it('correctly presents incoming and outgoing edges without inventing reverse links', () => {
    expect(sceneLinks(scenes, 'a')[0]).toMatchObject({ outgoing: true, type: 'karar' });
    expect(sceneLinks(scenes, 'b')[0]).toMatchObject({ outgoing: false, source: { _id: 'a' } });
  });
});
