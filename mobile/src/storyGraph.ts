import type { Character, Scene } from './types';
type Link = { from: string; to: string };
export function characterNeighborhood(id: string, links: Link[]) {
  const ids = new Set([id]);
  for (const link of links) { if (link.from === id) ids.add(link.to); if (link.to === id) ids.add(link.from); }
  return ids;
}
export function characterLayout(characters: Character[], links: Link[], selected: string, neighborhood: boolean, fontScale: number) {
  const nearby = characterNeighborhood(selected, links);
  const visible = neighborhood && selected ? characters.filter(c => nearby.has(c._id)) : characters;
  const counts = new Map(visible.map(c => [c._id, new Set<string>()]));
  for (const link of links) { counts.get(link.from)?.add(link.to); counts.get(link.to)?.add(link.from); }
  const ordered = [...visible].sort((a, b) => (counts.get(b._id)?.size || 0) - (counts.get(a._id)?.size || 0) || a.name.localeCompare(b.name, 'tr'));
  const root = visible.find(c => c._id === selected) || ordered[0];
  const others = ordered.filter(c => c !== root);
  const diameter = 164 * Math.max(1, fontScale);
  const radius = Math.max(diameter + 90, others.length * (diameter + 40) / (2 * Math.PI));
  return (root ? [root, ...others] : []).map((c, i) => ({ id: c._id, title: c.name, eyebrow: c.role || 'Karakter', detail: `${counts.get(c._id)?.size || 0} bağ`, kind: 'person' as const,
    x: radius + (i ? Math.cos((i - 1) * Math.PI * 2 / others.length - Math.PI / 2) * radius : 0),
    y: radius + (i ? Math.sin((i - 1) * Math.PI * 2 / others.length - Math.PI / 2) * radius : 0), width: diameter, height: diameter }));
}
export function unlinkedScenes(scenes: Scene[]) {
  const known = new Set(scenes.map(s => s._id)); const connected = new Set<string>();
  for (const scene of scenes) for (const link of scene.connections || []) {
    if (known.has(link.target) && link.target !== scene._id) { connected.add(scene._id); connected.add(link.target); }
  }
  return scenes.filter(s => !connected.has(s._id));
}
