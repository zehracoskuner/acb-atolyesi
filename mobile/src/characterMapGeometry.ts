export const NODE_W = 126; // web kart boyutuyla aynı: iki taraf aynı haritayı görür
export const NODE_H = 56;
export const WORLD = 4000;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2.5;

const BEND = 38;
const ARROW = 12;
const GAP = 4;

export type Pt = { x: number; y: number };
/** Ekran noktası = s * dünya noktası + (tx, ty) */
export type View2D = { s: number; tx: number; ty: number };

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const centerOf = (p: Pt): Pt => ({ x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 });

/** Web ile aynı varsayılan ızgara: konumu olmayan karakterler için. */
export function defaultPosition(index: number): Pt {
  return { x: 160 + (index % 4) * 160, y: 120 + Math.floor(index / 4) * 160 };
}

/** Give characters that share stored coordinates separate positions without changing their saved layout. */
export function layoutPositions(characters: readonly { _id: string; x?: number; y?: number }[]): Record<string, Pt> {
  const positions: Record<string, Pt> = {};
  const placed = new Set<string>();
  const unplaced: string[] = [];
  const ordered = [...characters].sort((a, b) => a._id.localeCompare(b._id));
  for (const { _id, x, y } of ordered) {
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y) || placed.has([x, y].join(','))) {
      unplaced.push(_id);
      continue;
    }
    positions[_id] = { x, y };
    placed.add([x, y].join(','));
  }
  let index = 0;
  for (const id of unplaced) {
    let candidate = defaultPosition(index++);
    while (placed.has([candidate.x, candidate.y].join(','))) candidate = defaultPosition(index++);
    positions[id] = candidate;
    placed.add([candidate.x, candidate.y].join(','));
  }
  return positions;
}

const rotate = (v: Pt, angle: number): Pt => ({
  x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
  y: v.x * Math.sin(angle) + v.y * Math.cos(angle),
});

/**
 * İki kart arasındaki eğri.
 * - Eğrilik yönü from→to yönüne bağlı: A→B ve B→A zıt taraflara kıvrılır, üst üste binmez.
 * - `mid` eğrinin gerçek orta noktasıdır (pin tam ip üzerinde durur).
 * - Yönlü bağda ok ucu hedef kartın kenarında biter.
 */
export function edgeShape(fromPos: Pt, toPos: Pt, directed: boolean) {
  const a = centerOf(fromPos);
  const b = centerOf(toPos);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!len) {
    const start = { x: a.x + NODE_W / 2, y: a.y };
    const end = { x: a.x, y: a.y - NODE_H / 2 - GAP };
    const ctrl = { x: start.x + BEND, y: end.y - BEND };
    return {
      d: `M ${start.x} ${start.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`,
      mid: { x: 0.25 * start.x + 0.5 * ctrl.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * ctrl.y + 0.25 * end.y },
      arrow: directed ? `M ${end.x} ${end.y} l 9 -10 l 4 9 Z` : null,
    };
  }
  const ctrl: Pt = { x: (a.x + b.x) / 2 - (dy / len) * BEND, y: (a.y + b.y) / 2 + (dx / len) * BEND };

  let end = b;
  let arrow: string | null = null;

  if (directed) {
    const back = { x: ctrl.x - b.x, y: ctrl.y - b.y };
    const backLen = Math.hypot(back.x, back.y) || 1;
    const u = { x: back.x / backLen, y: back.y / backLen };
    const reach = Math.min((NODE_W / 2 + GAP) / Math.abs(u.x), (NODE_H / 2 + GAP) / Math.abs(u.y));
    end = { x: b.x + u.x * reach, y: b.y + u.y * reach };

    const w1 = rotate(u, 0.5);
    const w2 = rotate(u, -0.5);
    arrow =
      `M ${end.x} ${end.y} ` +
      `L ${end.x + w1.x * ARROW} ${end.y + w1.y * ARROW} ` +
      `L ${end.x + w2.x * ARROW} ${end.y + w2.y * ARROW} Z`;
  }

  return {
    d: `M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`,
    mid: { x: 0.25 * a.x + 0.5 * ctrl.x + 0.25 * end.x, y: 0.25 * a.y + 0.5 * ctrl.y + 0.25 * end.y },
    arrow,
  };
}

export const strokeFor = (strength = 3) => 1.2 + strength * 0.6;

/**
 * İplerin çizildiği SVG'nin kapladığı alan. Android'de büyük SVG bellek yer,
 * bu yüzden tüm dünyayı değil, kartların bulunduğu bölgeyi (200px adımlarla) kaplar.
 */
export function svgBox(points: Pt[]) {
  if (!points.length) return { x: 0, y: 0, w: 400, h: 400 };
  const Q = 200;
  const PAD = 200;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.floor((Math.min(...xs) - PAD) / Q) * Q;
  const y0 = Math.floor((Math.min(...ys) - PAD) / Q) * Q;
  const x1 = Math.ceil((Math.max(...xs) + NODE_W + PAD) / Q) * Q;
  const y1 = Math.ceil((Math.max(...ys) + NODE_H + PAD) / Q) * Q;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function fitView(points: Pt[], vw: number, vh: number, topInset: number, bottomInset: number): View2D {
  if (!points.length || !vw || !vh) return { s: 1, tx: 0, ty: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const bw = Math.max(...xs) + NODE_W - minX;
  const bh = Math.max(...ys) + NODE_H - minY;
  const availH = vh - topInset - bottomInset;
  const s = clamp(Math.min((vw - 48) / bw, (availH - 24) / bh), MIN_SCALE, 1.1);
  const cx = minX + bw / 2;
  const cy = minY + bh / 2;
  return { s, tx: vw / 2 - s * cx, ty: topInset + availH / 2 - s * cy };
}

/** Odak noktasının altındaki dünya noktası sabit kalacak şekilde yakınlaştır. */
export function zoomAbout(v: View2D, focal: Pt, factor: number): View2D {
  const s = clamp(v.s * factor, MIN_SCALE, MAX_SCALE);
  const wx = (focal.x - v.tx) / v.s;
  const wy = (focal.y - v.ty) / v.s;
  return { s, tx: focal.x - s * wx, ty: focal.y - s * wy };
}

export function centerOn(v: View2D, world: Pt, vw: number, vh: number): View2D {
  return { s: v.s, tx: vw / 2 - v.s * world.x, ty: vh / 2 - v.s * world.y };
}
