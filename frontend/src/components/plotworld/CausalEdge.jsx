// components/plotworld/CausalEdge.jsx
import { getBezierPath, EdgeLabelRenderer, BaseEdge, useNodes } from "@xyflow/react";
import { EDGE_TYPES, DEFAULT_EDGE_TYPE } from "./constants";
import { getHandlePoint, getSmartHandlePositions } from "./utils";

export default function CausalEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition: fallbackSourcePosition,
  targetPosition: fallbackTargetPosition,
  source, target,
  data = {}, selected, markerEnd,
}) {
  const nodes = useNodes();
  const sourceNode = nodes.find(node => node.id === source);
  const targetNode = nodes.find(node => node.id === target);
  const smartPositions = sourceNode && targetNode
    ? getSmartHandlePositions(sourceNode, targetNode)
    : {
        sourcePosition: fallbackSourcePosition,
        targetPosition: fallbackTargetPosition,
      };
  const sourcePoint = sourceNode
    ? getHandlePoint(sourceNode, smartPositions.sourcePosition)
    : { x: sourceX, y: sourceY };
  const targetPoint = targetNode
    ? getHandlePoint(targetNode, smartPositions.targetPosition)
    : { x: targetX, y: targetY };
  const et = EDGE_TYPES[data.edgeType] || EDGE_TYPES[DEFAULT_EDGE_TYPE];
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition: smartPositions.sourcePosition,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    targetPosition: smartPositions.targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke:          selected ? et.color : `${et.color}99`,
          strokeWidth:     selected ? 2.5 : 1.5,
          strokeDasharray: et.dash ? "5 3" : undefined,
          transition:      "stroke 180ms, stroke-width 180ms",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position:  "absolute",
            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            zIndex:    10,
          }}
          className={`ce-label${selected ? " ce-label--selected" : ""}`}
          title={et.label}
        >
          <span
            className="ce-icon"
            style={{ color: et.color, background: `${et.color}18`, borderColor: `${et.color}44` }}
          >
            {et.icon}
          </span>
          {selected && (
            <span className="ce-type-label" style={{ color: et.color }}>{et.label}</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
