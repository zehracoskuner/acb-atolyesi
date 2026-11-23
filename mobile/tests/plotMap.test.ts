import { expect, it } from 'vitest';
import { focusNode, plotLayout, zoomAt } from '../src/plotMap';
import type { Scene } from '../src/types';
const scene = (id: string, act: string, order = 0, target = ''): Scene => ({ _id: id, title: id, act, order, description: '', goal: '', status: 'idea', connections: target ? [{ target, edgeType: 'karar' }] : [] });
it('keeps unknown web acts, sorts without mutating data, and preserves cyclic directed edges', () => {
  const data = [scene('b', 'giris', 2, 'a'), scene('a', 'giris', 0, 'b'), scene('c', 'web-custom', 0, 'deleted')];
  const snapshot = JSON.stringify(data);
  const result = plotLayout(data, [{ id: 'giris', label: 'Giriş' }]);
  expect(result.nodes.map(n => n.id)).toEqual(['a', 'b', 'c']);
  expect(result.acts.map(a => a.id)).toEqual(['giris', 'web-custom']);
  expect(result.edges.map(e => [e.from, e.to, e.label])).toEqual([['a', 'b', 'Karar'], ['b', 'a', 'Karar']]);
  expect(JSON.stringify(data)).toBe(snapshot);
});
it('reserves non-overlapping space at large accessibility font sizes', () => {
  const result = plotLayout([scene('a', 'giris'), scene('b', 'giris', 1)], [], 2);
  expect(result.nodes[1]!.y).toBeGreaterThan(result.nodes[0]!.y + result.nodes[0]!.height);
});
it('pinch keeps the focal graph point fixed and limits zoom', () => {
  const camera = { x: -90, y: 40, zoom: .8 }; const anchor = { x: 130, y: 200 };
  const next = zoomAt(camera, 1.4, anchor);
  expect((anchor.x - next.x) / next.zoom).toBeCloseTo((anchor.x - camera.x) / camera.zoom);
  expect((anchor.y - next.y) / next.zoom).toBeCloseTo((anchor.y - camera.y) / camera.zoom);
  expect(zoomAt(camera, 10, anchor).zoom).toBe(1.6);
  expect(zoomAt(camera, 0, anchor).zoom).toBe(.55);
});
it('focus brings a distant node into a narrow phone viewport', () => {
  const node = { x: 3000, y: 8000, width: 224, height: 146 }; const camera = focusNode(node, { width: 320, height: 360 });
  expect(node.x + camera.x).toBe(48);
  expect(node.y + camera.y).toBeGreaterThanOrEqual(24);
  expect(node.y + camera.y + node.height).toBeLessThan(360);
});
