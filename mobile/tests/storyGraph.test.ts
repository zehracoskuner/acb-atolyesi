import { expect, it } from 'vitest';
import { characterLayout, characterNeighborhood, unlinkedScenes } from '../src/storyGraph';
import type { Character, Scene } from '../src/types';
const people = ['Ada', 'Deniz', 'İpek', 'Meryem'].map((name, i) => ({ _id: String(i), name, role: '', notes: '' } as Character));
const links = [{ from: '0', to: '1' }, { from: '2', to: '0' }];
it('neighborhood includes incoming and outgoing relations but excludes unrelated characters', () => {
  expect([...characterNeighborhood('0', links)].sort()).toEqual(['0', '1', '2']);
  const result = characterLayout(people, links, '0', true, 1);
  expect(result.map(n => n.id).sort()).toEqual(['0', '1', '2']);
});
it('centers the selected writer choice, preserves input and reserves space for large text', () => {
  const before = JSON.stringify(people);
  const result = characterLayout(people, links, '2', false, 2);
  expect(result[0]?.id).toBe('2');
  expect(JSON.stringify(people)).toBe(before);
  for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
    expect(Math.hypot(result[i]!.x - result[j]!.x, result[i]!.y - result[j]!.y)).toBeGreaterThan(result[i]!.width);
  }
  expect(characterLayout([], [], '', false, 1)).toEqual([]);
});
it('finds disconnected scenes ignoring deleted targets and self-links', () => {
  const scenes = [{ _id: 'a', connections: [{ target: 'b' }] }, { _id: 'b', connections: [] }, { _id: 'c', connections: [{ target: 'deleted' }, { target: 'c' }] }] as Scene[];
  expect(unlinkedScenes(scenes).map(s => s._id)).toEqual(['c']);
});
