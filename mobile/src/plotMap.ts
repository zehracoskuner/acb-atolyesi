import type { Scene } from './types';
import { sceneActs, type Act } from './scenes';

export const edgeTypes = {
  karar: 'Karar', sonuc: 'Sonuç', kacis: 'Kaçış', yuzlesme: 'Yüzleşme', kesif: 'Keşif', zorunluluk: 'Zorunluluk',
} as const;
export type EdgeType = keyof typeof edgeTypes;
export type Point = { x: number; y: number };
export type Camera = Point & { zoom: number };
export const nodeWidth = 224;
export const nodeHeight = 146;
export function plotLayout(scenes: Scene[], defined: Act[], fontScale = 1) {
  const height = nodeHeight * Math.max(1, fontScale);
  const acts = sceneActs(defined, scenes);
  const nodes = acts.flatMap((act, column) => scenes.filter(scene => scene.act === act.id)
    .sort((a, b) => a.order - b.order || a._id.localeCompare(b._id))
    .map((scene, row) => ({ id: scene._id, scene, x: 28 + column * 310, y: 70 + row * (height + 76), width: nodeWidth, height })));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const edges = nodes.flatMap(node => (node.scene.connections || []).flatMap(link => {
    const target = byId.get(link.target);
    return target && target.id !== node.id ? [{ id: `${node.id}:${target.id}`, from: node.id, to: target.id, label: edgeTypes[link.edgeType as EdgeType] || link.edgeType || 'Bağ', type: link.edgeType }] : [];
  }));
  return { nodes, edges, acts, width: Math.max(310, acts.length * 310), height: Math.max(400, ...nodes.map(n => n.y + n.height + 80)) };
}
// Keep the graph point below the fingers stationary during a pinch.
export function zoomAt(camera: Camera, zoom: number, anchor: Point): Camera {
  const next = Math.max(.55, Math.min(1.6, zoom));
  return { zoom: next, x: anchor.x - (anchor.x - camera.x) * next / camera.zoom, y: anchor.y - (anchor.y - camera.y) * next / camera.zoom };
}
export function focusNode(node: Point & { width: number; height: number }, viewport: { width: number; height: number }): Camera {
  return { zoom: 1, x: (viewport.width - node.width) / 2 - node.x, y: Math.max(24, (viewport.height - node.height) / 3) - node.y };
}
