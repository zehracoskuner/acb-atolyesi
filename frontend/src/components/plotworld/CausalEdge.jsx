// components/plotworld/CausalEdge.jsx
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from "@xyflow/react";
import { EDGE_TYPES, DEFAULT_EDGE_TYPE } from "./constants";

export default function CausalEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data = {}, selected, markerEnd,
}) {
  const et = EDGE_TYPES[data.edgeType] || EDGE_TYPES[DEFAULT_EDGE_TYPE];
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
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