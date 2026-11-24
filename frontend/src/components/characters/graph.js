import { legacyRelationshipName, RELATION_TYPES, relationshipTypeIdentity } from "../../../../shared/relationshipTypes";

export const NODE_WIDTH = 128;
export const PORTRAIT_RADIUS = 40;
export const MAP_FIT_OPTIONS = { padding: { x: "3.75%", y: "7%" }, maxZoom: 1.6 };
export { RELATION_TYPES, relationshipTypeIdentity };

const conflictTypes = new Set(["conflict", "enemy", "enmity", "rivalry", "manip", "trauma", "çatışma", "düşmanlık", "rekabet", "manipülasyon", "travma"]);
const uncertainTypes = new Set(["secret", "unknown", "uncertain", "karma", "sır", "belirsiz"]);
const knownLabels = new Map(RELATION_TYPES.map(({ key, label }) => [key, label]));
const storedTypeKey = workId => `acb_custom_rel_types_${workId}`;

export function readCustomTypes(workId) {
  try {
    const types = JSON.parse(localStorage.getItem(storedTypeKey(workId)));
    return Array.isArray(types) ? types.filter(t => typeof t?.key === "string" && typeof t.label === "string") : [];
  } catch {
    return [];
  }
}

export function storeCustomTypes(workId, types) {
  try { localStorage.setItem(storedTypeKey(workId), JSON.stringify(types)); }
  catch { /* The saved relationship still carries its type. */ }
}

export function relationName(type, customTypes = []) {
  return customTypes.find(t => t.key === type)?.label || knownLabels.get(type) || legacyRelationshipName(type) || type;
}

export function relationDash(type, label = "") {
  const category = [type, label].map(value => value?.toLocaleLowerCase("tr"));
  if (category.some(value => conflictTypes.has(value))) return "6 5";
  if (category.some(value => uncertainTypes.has(value))) return "1 5";
  return undefined;
}

export function toCharacter(item, index = 0) {
  return {
    ...item,
    id: String(item._id || item.id),
    x: Number.isFinite(item.x) ? item.x : 96 + (index % 5) * 156,
    y: Number.isFinite(item.y) ? item.y : 96 + Math.floor(index / 5) * 120,
    positionMode: item.positionMode || (Number.isFinite(item.x) && Number.isFinite(item.y) ? "manual" : "auto"),
  };
}

export function toRelationship(item) {
  return { ...item, id: String(item._id || item.id), from: String(item.from), to: String(item.to), directed: item.directed ?? true, strength: item.strength ?? 3 };
}

export function drawableRelationships(relationships, nodesById) {
  return relationships.filter(({ from, to }) => from !== to && nodesById.has(from) && nodesById.has(to));
}

export function parallelLanes(relationships) {
  const pairs = new Map();
  for (const relationship of relationships) {
    const key = JSON.stringify([relationship.from, relationship.to].sort());
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(relationship);
  }
  const lanes = new Map();
  for (const pair of pairs.values()) {
    pair.sort((a, b) => a.id.localeCompare(b.id));
    pair.forEach(({ id, from, to }, index) => {
      lanes.set(id, (index - (pair.length - 1) / 2) * (from < to ? 1 : -1));
    });
  }
  return lanes;
}

function unit(dx, dy) {
  const length = Math.hypot(dx, dy);
  return length ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
}

export function relationshipCurve(source, target, lane) {
  const a = { x: source.x + NODE_WIDTH / 2, y: source.y + PORTRAIT_RADIUS };
  const b = { x: target.x + NODE_WIDTH / 2, y: target.y + PORTRAIT_RADIUS };
  const dx = b.x - a.x, dy = b.y - a.y;
  const direction = unit(dx, dy);
  const bend = lane * 39;
  const control = { x: (a.x + b.x) / 2 - direction.y * bend, y: (a.y + b.y) / 2 + direction.x * bend };
  const startDirection = unit(control.x - a.x, control.y - a.y);
  const endDirection = unit(b.x - control.x, b.y - control.y);
  const radius = Math.min(PORTRAIT_RADIUS + 2, Math.hypot(dx, dy) / 2);
  const start = { x: a.x + startDirection.x * radius, y: a.y + startDirection.y * radius };
  const end = { x: b.x - endDirection.x * radius, y: b.y - endDirection.y * radius };
  const tailX = end.x - endDirection.x * 8, tailY = end.y - endDirection.y * 8;
  return {
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    x: (start.x + 2 * control.x + end.x) / 4,
    y: (start.y + 2 * control.y + end.y) / 4,
    arrow: `M ${tailX - endDirection.y * 3} ${tailY + endDirection.x * 3} L ${end.x} ${end.y} L ${tailX + endDirection.y * 3} ${tailY - endDirection.x * 3}`,
  };
}

export function unpackPosition(node) {
  return { x: node.x, y: node.y };
}

export async function arrangeCharacters(characters, relationships) {
  const { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } = await import("d3-force");
  const particles = characters.map(({ id, x, y, positionMode }) => ({
    id, x, y, ...(positionMode === "auto" ? {} : { fx: x, fy: y }),
  }));
  const center = particles.reduce((point, particle) => ({
    x: point.x + particle.x / particles.length,
    y: point.y + particle.y / particles.length,
  }), { x: 0, y: 0 });
  const links = relationships.map(({ from, to }) => ({ source: from, target: to }));
  forceSimulation(particles).stop()
    .force("links", forceLink(links).id(node => node.id).distance(152).strength(0.42))
    .force("charge", forceManyBody().strength(-230))
    .force("spacing", forceCollide(72).iterations(2))
    .force("x", forceX(center.x).strength(0.06))
    .force("y", forceY(center.y).strength(0.06))
    .tick(135);
  return particles.filter(particle => particle.fx === undefined);
}
