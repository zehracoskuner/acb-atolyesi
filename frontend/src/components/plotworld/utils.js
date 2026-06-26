// components/plotworld/utils.js
import { Position } from "@xyflow/react";
import {
  ACT_ZONE_WIDTH,
  ACT_ZONE_HEIGHT,
  ACT_ZONE_COL_W,
  EDGE_TYPES
} from "./constants";

const FALLBACK_NODE_WIDTH = 220;
const FALLBACK_NODE_HEIGHT = 110;


/* ── charIds → isim dizisi ── */
export function resolveCharIds(rawChars = []) {
  return rawChars.map(c =>
    typeof c === "object" ? String(c._id) : String(c)
  );
}

export function resolveCharNames(rawChars = [], characterMap = {}) {
  return rawChars
    .map(c => {
      const id = typeof c === "object" ? String(c._id) : String(c);
      return characterMap[id]?.name || null;
    })
    .filter(Boolean);
}

/* ── Sahneleri node'lara dönüştür ── */
export function layoutScenes(scenes, characterMap = {}, actOrder = []) {
  const groups = {};
  actOrder.forEach(act => { groups[act] = []; });

  // Bilinmeyen akt varsa ilk akt'a düşür
  scenes.forEach(s => {
    const act = actOrder.includes(s.act) ? s.act : actOrder[0];
    if (!groups[act]) groups[act] = [];
    groups[act].push({ ...s, act });
  });

  return actOrder.flatMap((act, col) =>
    (groups[act] || []).map((s, row) => {
      const position =
        s.position?.x != null && s.position?.y != null
          ? { x: s.position.x, y: s.position.y }
          : { x: col * ACT_ZONE_COL_W + 60, y: row * 170 + 60 };

      return {
        id:   String(s._id),
        type: "sceneNode",
        position,
        data: {
          label:   s.title,
          goal:    s.goal        || "",
          volume:  s.volume      || "",
          isAlternative: s.isAlternative || false,
          chapter: s.chapter     || "",
          time:    s.time        || "",
          charIds: resolveCharIds(s.characters || []),
          chars:   resolveCharNames(s.characters || [], characterMap),
          act,
          status:  s.status      || "idea",
          desc:    s.description || "",
          raw:     s,
          onEdit:      null,
          onConnect:   null,
          onButterfly: null,
          onDelete:    null,
        },
      };
    })
  );
}

/* ── Akt arka plan zone node'ları — dinamik ── */
export function buildActZoneNodes(actOrder = [], actMeta = {}) {
  return actOrder.map((act, i) => ({
    id:         `zone-${act}`,
    type:       "actZone",
    position:   { x: i * ACT_ZONE_COL_W + 20, y: -60 },
    data:       { act, meta: actMeta[act] || {} },
    draggable:  false,
    selectable: false,
    focusable:  false,
    style:      { width: ACT_ZONE_WIDTH, height: ACT_ZONE_HEIGHT, zIndex: -1 },
  }));
}

/* ── Sürükleme sonrası hangi akt zone'unda bırakıldı ── */
export function detectDroppedAct(nodePosition, actOrder = []) {
  return actOrder.find((_, i) => {
    const zoneX = i * ACT_ZONE_COL_W + 20;
    return nodePosition.x >= zoneX && nodePosition.x <= zoneX + ACT_ZONE_WIDTH;
  }) || null;
}

function readSize(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getNodeBounds(node) {
  const width = readSize(
    node?.width ?? node?.measured?.width ?? node?.style?.width,
    FALLBACK_NODE_WIDTH
  );
  const height = readSize(
    node?.height ?? node?.measured?.height ?? node?.style?.height ?? node?.style?.minHeight,
    FALLBACK_NODE_HEIGHT
  );

  return {
    x: node?.position?.x ?? node?.positionAbsolute?.x ?? 0,
    y: node?.position?.y ?? node?.positionAbsolute?.y ?? 0,
    width,
    height,
  };
}

export function getNodeCenter(node) {
  const bounds = getNodeBounds(node);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function getOppositePosition(position) {
  switch (position) {
    case Position.Bottom:
      return Position.Top;
    case Position.Left:
      return Position.Right;
    case Position.Top:
      return Position.Bottom;
    case Position.Right:
    default:
      return Position.Left;
  }
}

export function getSmartHandlePositions(sourceNode, targetNode) {
  const sourceCenter = getNodeCenter(sourceNode);
  const targetCenter = getNodeCenter(targetNode);
  const angle = (Math.atan2(
    targetCenter.y - sourceCenter.y,
    targetCenter.x - sourceCenter.x
  ) * 180 / Math.PI + 360) % 360;

  let sourcePosition;
  if (angle >= 45 && angle < 135) {
    sourcePosition = Position.Bottom;
  } else if (angle >= 135 && angle < 225) {
    sourcePosition = Position.Left;
  } else if (angle >= 225 && angle < 315) {
    sourcePosition = Position.Top;
  } else {
    sourcePosition = Position.Right;
  }

  return {
    sourcePosition,
    targetPosition: getOppositePosition(sourcePosition),
  };
}

export function getHandlePoint(node, position) {
  const bounds = getNodeBounds(node);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  switch (position) {
    case Position.Bottom:
      return { x: centerX, y: bounds.y + bounds.height };
    case Position.Left:
      return { x: bounds.x, y: centerY };
    case Position.Top:
      return { x: centerX, y: bounds.y };
    case Position.Right:
    default:
      return { x: bounds.x + bounds.width, y: centerY };
  }
}

export function buildEdges(scenes) {
  const edges = [];
  scenes.forEach(scene => {
    (scene.connections || []).forEach(conn => {
      const targetId = conn.target ? String(conn.target) : String(conn);
      const edgeType = conn.edgeType || "sonuc";
      if (!targetId || targetId === "undefined") return;
 
      const EDGE_COLORS = {
        karar: "#6d28d9", sonuc: "#0891b2", kacis: "#b45309",
        yuzlesme: "#be123c", kesif: "#065f46", zorunluluk: "#7c3aed",
      };
      const color = EDGE_COLORS[edgeType] || "#0891b2";
 
      edges.push({
        id:        `e-${scene._id}-${targetId}`,
        source:    String(scene._id),
        target:    targetId,
        type:      "causal",
        data:      { edgeType },
        markerEnd: { type: "arrowclosed", color },
        style:     { stroke: `${color}99`, strokeWidth: 1.5 },
      });
    });
  });
  return edges;
}
