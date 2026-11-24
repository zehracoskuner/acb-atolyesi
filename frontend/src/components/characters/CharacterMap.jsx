import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Background, BaseEdge, ConnectionMode, Handle, Position, ReactFlow, useStore } from "@xyflow/react";
import { Link2, Maximize, Minus, Plus } from "lucide-react";
import "@xyflow/react/dist/style.css";
import Portrait from "./Portrait";
import { MAP_FIT_OPTIONS, NODE_WIDTH, PORTRAIT_RADIUS, parallelLanes, relationshipCurve, relationDash, relationName, relationshipTypeIdentity } from "./graph";

const nodeDimensions = { "--cu-node-width": `${NODE_WIDTH}px`, "--cu-portrait-radius": `${PORTRAIT_RADIUS}px` };
const mapLabels = {
  "node.a11yDescription.default": "Enter ile karakteri açın. Ok tuşlarıyla konumunu değiştirin.",
  "node.a11yDescription.keyboardDisabled": "Enter ile karakteri açın.",
  "edge.a11yDescription.default": "Enter ile bağı seçin.",
  "node.a11yDescription.ariaLiveMessage": ({ x, y }) => `Karakter konumu ${x}, ${y}`,
};

const CharacterNode = memo(function CharacterNode({ id, data }) {
  const { character, linked, dim, match, onArm, onGrab, onCarry, onDrop, canConnect } = data;
  function arm(event) {
    event.stopPropagation();
    if (canConnect) onArm(id);
  }
  return (
    <div className={`cu-node${dim ? " is-dim" : ""}${match ? " is-match" : ""}${linked ? " is-linking" : ""}`}
      style={nodeDimensions} data-character-id={id} onPointerDownCapture={event => onGrab(event, character)}
      onPointerMove={onCarry} onPointerUp={onDrop} onPointerCancel={onDrop} onLostPointerCapture={onDrop}>
      <button className="cu-node-main" type="button" tabIndex={-1}>
        <Portrait character={character} className="cu-node-portrait" lazy />
        <span className="cu-node-name">{character.name}</span>
      </button>
      <Handle id="portrait" type="source" position={Position.Right} className="cu-handle"
        role="button" tabIndex={canConnect ? 0 : -1} aria-hidden={!canConnect}
        aria-label={`${character.name} ile bağ kur`} isConnectable={canConnect}
        onClick={arm} onKeyDown={event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          arm(event);
        }}>
        <Link2 size={12} aria-hidden="true" />
      </Handle>
    </div>
  );
});

const RelationshipEdge = memo(function RelationshipEdge({ id, source, target, data }) {
  const locate = useCallback(store => ({
    from: store.nodeLookup.get(source)?.internals.positionAbsolute,
    to: store.nodeLookup.get(target)?.internals.positionAbsolute,
  }), [source, target]);
  const { from, to } = useStore(locate, (a, b) =>
    a.from?.x === b.from?.x && a.from?.y === b.from?.y && a.to?.x === b.to?.x && a.to?.y === b.to?.y
  );
  if (!from || !to) return null;
  const { path, arrow, x, y } = relationshipCurve(from, to, data.lane);
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={15} className="cu-edge-path"
        style={{ strokeDasharray: data.dash }} />
      {data.directed && <path d={arrow} className="cu-edge-arrow" fill="none" />}
      <foreignObject className="cu-edge-caption" x={x - 100} y={y - 33} width={200} height={32} aria-hidden="true">
        <span>{data.label}</span>
      </foreignObject>
    </>
  );
});

const NODE_TYPES = { character: CharacterNode };
const EDGE_TYPES = { relationship: RelationshipEdge };
const INITIAL_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const WHEEL_QUIET_TIME = 160;
const DRAG_THRESHOLD = 5;

function useDragStableViewport(canvasRef) {
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT);
  const nodePointer = useRef(null);
  const wheelUntil = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function start(event) {
      if (event.isPrimary && event.button === 0 && event.target.closest?.("[data-character-id]")) {
        nodePointer.current = event.pointerId;
      }
    }
    function finish(event) {
      if (event.pointerId === nodePointer.current) nodePointer.current = null;
    }
    function reset() {
      nodePointer.current = null;
      wheelUntil.current = 0;
    }
    function block(event) {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    }
    function guardWheel(event) {
      const now = performance.now();
      if (nodePointer.current === null && now >= wheelUntil.current) return;
      wheelUntil.current = now + WHEEL_QUIET_TIME;
      block(event);
    }
    function guardSecondaryGesture(event) {
      if (nodePointer.current !== null && (event.touches?.length > 1 || event.button > 0)) block(event);
    }

    const capture = { capture: true, passive: false };
    canvas.addEventListener("pointerdown", start, true);
    canvas.addEventListener("wheel", guardWheel, capture);
    canvas.addEventListener("touchstart", guardSecondaryGesture, capture);
    canvas.addEventListener("touchmove", guardSecondaryGesture, capture);
    canvas.addEventListener("mousedown", guardSecondaryGesture, capture);
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
    window.addEventListener("blur", reset);
    return () => {
      canvas.removeEventListener("pointerdown", start, true);
      canvas.removeEventListener("wheel", guardWheel, true);
      canvas.removeEventListener("touchstart", guardSecondaryGesture, true);
      canvas.removeEventListener("touchmove", guardSecondaryGesture, true);
      canvas.removeEventListener("mousedown", guardSecondaryGesture, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
      window.removeEventListener("blur", reset);
      reset();
    };
  }, [canvasRef]);

  const onViewportChange = useCallback(next => {
    const locked = nodePointer.current !== null;
    setViewport(current => {
      if (current.x === next.x && current.y === next.y && current.zoom === next.zoom) return current;
      // A fresh snapshot also resets React Flow's internal pan/zoom position.
      return locked ? { ...current } : next;
    });
  }, []);

  return { viewport, onViewportChange };
}

export default function CharacterMap({
  canvasRef, flow, onInit, characters, relationships, names, types, focusId, selectedEdgeId,
  matchIds, sceneMode, scenePick, linkFrom, canConnect, onActivate, onSelectEdge, onArm, onLink,
  onPositions, onBlank, filter, theme, suspendFocusPan,
}) {
  const shiftConnection = useRef(null);
  const drag = useRef(null);
  const dragFrame = useRef(null);
  const fitOnMount = useRef(characters.length > 0);
  const [line, setLine] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [nodeMeasurements, setNodeMeasurements] = useState(() => new Map());
  const { viewport, onViewportChange } = useDragStableViewport(canvasRef);
  const onShiftStart = useCallback((event, id) => {
    if (!canConnect || !event.shiftKey || event.button !== 0 || event.target.closest(".cu-handle")) return;
    const canvas = canvasRef.current?.getBoundingClientRect();
    const portrait = event.currentTarget.querySelector(".cu-node-portrait")?.getBoundingClientRect();
    if (!canvas || !portrait) return;
    event.preventDefault();
    shiftConnection.current = {
      id, canvas, pointerId: event.pointerId,
      x: portrait.left + portrait.width / 2 - canvas.left,
      y: portrait.top + portrait.height / 2 - canvas.top,
    };
  }, [canvasRef, canConnect]);

  const onGrab = useCallback((event, character) => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest(".cu-handle")) return;
    if (event.shiftKey) {
      onShiftStart(event, character.id);
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: character.id, pointerId: event.pointerId,
      trigger: event.currentTarget.closest(".react-flow__node"),
      startX: event.clientX, startY: event.clientY,
      x: character.x, y: character.y, zoom: flow?.getZoom() ?? 1,
      position: null,
    };
  }, [flow, onShiftStart]);

  const onCarry = useCallback(event => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (!active.position && Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
    active.position = { id: active.id, x: active.x + dx / active.zoom, y: active.y + dy / active.zoom };
    if (dragFrame.current !== null) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;
      if (drag.current === active) setDragPreview(active.position);
    });
  }, []);

  const onDrop = useCallback(event => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (event.type === "pointerup") onCarry(event);
    drag.current = null;
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
    }
    if (active.position) {
      onPositions([active.position]);
      setDragPreview(null);
    } else if (event.type === "pointerup") {
      onActivate(active.id, active.trigger);
    }
  }, [onActivate, onCarry, onPositions]);

  useEffect(() => () => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
  }, []);

  const rememberMeasurements = useCallback(changes => {
    const measured = changes.filter(change => change.type === "dimensions" && change.dimensions);
    if (!measured.length) return;
    setNodeMeasurements(current => {
      const next = new Map(current);
      for (const { id, dimensions } of measured) next.set(id, dimensions);
      return next;
    });
  }, []);

  useEffect(() => {
    function move(event) {
      const start = shiftConnection.current;
      if (start?.pointerId !== event.pointerId) return;
      setLine({ start, x: event.clientX - start.canvas.left, y: event.clientY - start.canvas.top });
    }
    function finish(event) {
      const start = shiftConnection.current;
      if (start?.pointerId !== event.pointerId) return;
      shiftConnection.current = null;
      setLine(null);
      const target = event.type === "pointerup" && document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-character-id]");
      if (target) onLink(start.id, target.dataset.characterId);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [onLink]);

  const lanes = useMemo(() => parallelLanes(relationships), [relationships]);
  const connected = useMemo(() => {
    const result = new Set([focusId]);
    for (const { from, to } of relationships) {
      if (from === focusId) result.add(to);
      if (to === focusId) result.add(from);
    }
    return result;
  }, [focusId, relationships]);
  const nodes = useMemo(() => characters.map(character => ({
    id: character.id,
    type: "character",
    className: "nopan",
    position: { x: character.x, y: character.y },
    measured: nodeMeasurements.get(character.id),
    selected: (sceneMode ? [scenePick.a, scenePick.b].includes(character.id) : character.id === focusId),
    ariaRole: "group",
    ariaLabel: character.name,
    domAttributes: { onKeyDownCapture: event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onActivate(character.id, event.currentTarget);
        return;
      }
      const step = event.shiftKey ? 20 : 5;
      const offset = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (!offset) return;
      event.preventDefault();
      event.stopPropagation();
      onPositions([{ id: character.id, x: character.x + offset[0], y: character.y + offset[1], dragging: false }]);
    } },
    data: {
      character, onArm, onGrab, onCarry, onDrop, canConnect,
      linked: character.id === linkFrom,
      dim: Boolean((focusId && !connected.has(character.id)) || (matchIds && !matchIds.has(character.id))),
      match: matchIds?.has(character.id),
    },
  })), [characters, connected, focusId, linkFrom, matchIds, nodeMeasurements, onActivate, onArm, onGrab, onCarry, onDrop, onPositions, sceneMode, scenePick, canConnect]);
  const displayedNodes = useMemo(() => dragPreview ? nodes.map(node => node.id === dragPreview.id ? {
    ...node, position: { x: dragPreview.x, y: dragPreview.y }, className: "nopan is-moving", dragging: true,
  } : node) : nodes, [nodes, dragPreview]);

  const edges = useMemo(() => relationships.map(edge => {
    const label = relationName(edge.type, types);
    const related = focusId && (edge.from === focusId || edge.to === focusId);
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      sourceHandle: "portrait",
      targetHandle: "portrait",
      type: "relationship",
      zIndex: 0,
      hidden: filter !== "" && relationshipTypeIdentity(label) !== filter,
      selected: selectedEdgeId === edge.id,
      className: (related ? "is-related" : focusId ? "is-faded" : ""),
      ariaLabel: `${names.get(edge.from)} ${edge.directed ? "→" : "ve"} ${names.get(edge.to)}, ${label}${edge.label ? `, ${edge.label}` : ""}`,
      data: { label: edge.label ? `${label} · ${edge.label}` : label, dash: relationDash(edge.type, label), lane: lanes.get(edge.id), directed: edge.directed },
    };
  }), [filter, focusId, lanes, names, relationships, selectedEdgeId, types]);

  return (
    <>
      <ReactFlow nodes={displayedNodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES}
        onInit={onInit} onNodesChange={rememberMeasurements} onNodeClick={(event, node) => {
          if (event.detail === 0 && !event.shiftKey) onActivate(node.id, event.currentTarget);
        }}
        onEdgesChange={items => {
          const selection = items.find(item => item.type === "select" && item.selected);
          if (selection) onSelectEdge(selection.id);
        }}
        onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
        onPaneClick={onBlank}
        onConnect={({ source, target }) => onLink(source, target)}
        isValidConnection={({ source, target }) => source !== target}
        connectionMode={ConnectionMode.Loose} connectOnClick={false}
        nodesDraggable={false} nodesConnectable={canConnect}
        elevateEdgesOnSelect={false} elevateNodesOnSelect={false} edgesReconnectable={false} zIndexMode="manual"
        deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
        autoPanOnNodeDrag={false} autoPanOnConnect={false} autoPanOnNodeFocus={!suspendFocusPan}
        viewport={viewport} onViewportChange={onViewportChange}
        minZoom={0.2} maxZoom={2.1} fitView={fitOnMount.current} fitViewOptions={MAP_FIT_OPTIONS}
        colorMode={theme} ariaLabelConfig={mapLabels} proOptions={{ hideAttribution: true }}
        aria-label="Karakter ilişki haritası">
        <Background gap={25} size={1.05} color="var(--cu-dot)" />
      </ReactFlow>
      {line && <svg className="cu-shift-line" aria-hidden="true"><line x1={line.start.x} y1={line.start.y} x2={line.x} y2={line.y} /></svg>}
      <div className="cu-zoom" aria-label="Harita görünümü" role="group">
        <button type="button" title="Uzaklaştır" aria-label="Uzaklaştır" onClick={() => flow?.zoomOut()}><Minus size={17} /></button>
        <button type="button" title="Yakınlaştır" aria-label="Yakınlaştır" onClick={() => flow?.zoomIn()}><Plus size={17} /></button>
        <button type="button" title="Ekrana sığdır" aria-label="Ekrana sığdır" onClick={() => flow?.fitView(MAP_FIT_OPTIONS)}><Maximize size={15} /></button>
      </div>
    </>
  );
}
