import { describe, expect, it } from 'vitest';
import { connectionTargets, sceneActs, sceneIndex } from './scenes';
import type { Scene } from './types';
const scene = (id: string, act = 'giris', title = id): Scene => ({ _id: id, title, act, description: '', goal: '', order: Number(id) || 0, status: 'idea', connections: [] });
describe('large plot navigation', () => {
  it('offers only eligible targets and searches Turkish case correctly across all acts', () => {
    const source = { ...scene('1'), connections: [{ target: '2', edgeType: 'sonuc' }] };
    const scenes = [source, scene('2'), scene('3', 'sonuc', 'İSTANBUL'), scene('4', 'sonuc', 'IŞIK')];
    expect(connectionTargets(scenes, source, '', 'add').map(s => s._id)).toEqual(['3', '4']);
    expect(connectionTargets(scenes, source, 'istanbul', 'add').map(s => s._id)).toEqual(['3']);
    expect(connectionTargets(scenes, source, 'ışık', 'add').map(s => s._id)).toEqual(['4']);
    expect(connectionTargets(scenes, source, '', 'existing').map(s => s._id)).toEqual(['2']);
  });
  it('indexes a hundred scenes once and finds ordering boundaries independently per act', () => {
    const scenes = Array.from({ length: 100 }, (_, i) => scene(String(i), i % 2 ? 'sonuc' : 'giris'));
    const index = sceneIndex(scenes); expect(index.byId.size).toBe(100);
    expect(index.bounds.get('0')).toEqual({ first: true, last: false });
    expect(index.bounds.get('1')).toEqual({ first: true, last: false });
    expect(index.bounds.get('98')).toEqual({ first: false, last: true });
    expect(index.bounds.get('99')).toEqual({ first: false, last: true });
    expect(connectionTargets(scenes, scenes[0]!, '', 'add')).toHaveLength(99);
  });
  it('preserves custom legacy and recovered acts with readable labels and no ID entry', () => {
    const acts = sceneActs([{ id: 'custom', label: 'Yolculuk' }], [scene('1', 'custom'), scene('2', 'legacy'), scene('3', 'legacy')], 'recovered');
    expect(acts).toEqual([{ id: 'custom', label: 'Yolculuk' }, { id: 'legacy', label: 'Diğer perde 1' }, { id: 'recovered', label: 'Diğer perde 2' }]);
    expect(sceneActs(undefined, [])).toHaveLength(3);
  });
});
