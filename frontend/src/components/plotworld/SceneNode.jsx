import { PLOTWORLD_SCENE_AI_ENABLED } from "../../../../shared/features.js";
// components/plotworld/SceneNode.jsx

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { STATUS_META, VOLUME_META } from "./constants";

const STATUS_CARD = {
  idea:     { bg: "#faf8f5", accent: "#e8e2d9" },
  drafting: { bg: "#fdfbf4", accent: "#ede3c8" },
  writing:  { bg: "#f8f9ff", accent: "#c8d4ee" },
  done:     { bg: "#f5fbf7", accent: "#bde0c5" },
};

const HANDLE_POSITIONS = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
];

function resolveActStyle(data) {
  const color = data.isAlternative ? "#ca8a04" : (data.actColor || "#888");
  const label = data.isAlternative ? "Alternatif Dal" : (data.actLabel || data.act || "—");
  return { color, label };
}

function VolumePip({ volume }) {
  const meta = VOLUME_META[volume];
  if (!meta) return null;
  const w = { short: 3, medium: 6, long: 9 }[volume] || 3;
  return (
    <span
      className="wn-vol-pip"
      style={{ background: meta.color, width: w }}
      title={`${meta.label} — ${meta.pages}`}
    />
  );
}

function ActionBtn({ icon, label, onClick, mod }) {
  return (
    <button
      className={`nodrag nopan wn-act-btn${mod ? ` wn-act-btn--${mod}` : ""}`}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

export default function SceneNode({ data, selected }) {
  const isAlt  = data.isAlternative || false;
  const status = data.status || "idea";
  const card   = STATUS_CARD[status] || STATUS_CARD.idea;
  const sm     = STATUS_META[status] || STATUS_META.idea;

  const hasGoal = !!data.goal?.trim();
  const hasDesc = !!data.desc?.trim();
  const dimmed  = data.dimmed      || false;
  const hilite  = data.highlighted || false;

  const { color: actColor, label: actLabel } = resolveActStyle(data);

  const [expanded, setExpanded] = useState(false);


  function stop(e, fn) { e.stopPropagation(); fn?.(); }

  return (
    <div
      className={[
        "wn-node",
        `wn-node--${status}`,
        isAlt    && "wn-node--alt",
        selected && "wn-node--selected",
        dimmed   && "wn-node--dimmed",
        hilite   && "wn-node--hilite",
        expanded && "wn-node--expanded",
      ].filter(Boolean).join(" ")}
      style={{
        "--card-bg":     card.bg,
        "--card-accent": card.accent,
        "--act-color":   actColor,
      }}
      onDoubleClick={e => { e.stopPropagation(); if (hasDesc) setExpanded(v => !v); }}
      role="article"
      aria-label={`Sahne: ${data.label}`}
    >
      {HANDLE_POSITIONS.map(position => (
        <Handle
          key={`target-${position}`}
          id={`target-${position}`}
          type="target"
          position={position}
          className={`wn-handle wn-handle--target wn-handle--${position}`}
        />
      ))}
      {HANDLE_POSITIONS.map(position => (
        <Handle
          key={`source-${position}`}
          id={`source-${position}`}
          type="source"
          position={position}
          className={`wn-handle wn-handle--source wn-handle--${position}`}
        />
      ))}

      <div className="wn-rail" aria-hidden="true" />

      {isAlt && <div className="wn-alt-pip" aria-label="Alternatif Dal" />}

      <div className="wn-inner">
        <div className="wn-act-row">
          <span className="wn-act-label" style={{ color: actColor }}>{actLabel}</span>
          {data.volume && <VolumePip volume={data.volume} />}
        </div>

        <div className="wn-title">{data.label}</div>

        <div className={`wn-goal${!hasGoal ? " wn-goal--empty" : ""}`}>
          <span className="wn-goal-mark" aria-hidden="true">◎</span>
          <span className="wn-goal-text">
            {hasGoal ? data.goal : hasDesc ? data.desc : "Amaç belirtilmemiş"}
          </span>
        </div>

        {expanded && hasDesc && (
          <div className="wn-desc">{data.desc}</div>
        )}
      </div>

      <div className="wn-footer">
        <div className="wn-footer-l">
          <span className="wn-status-pip" style={{ background: sm.color }} aria-hidden="true" />
          <span className="wn-status-text">{sm.label}</span>
        </div>
        <div className="wn-footer-r">
          {hasDesc && (
            <button
              className="wn-expand-btn nodrag nopan"
              aria-label={expanded ? "Küçült" : "Açıklamayı göster"}
              onClick={e => stop(e, () => setExpanded(v => !v))}
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>

      {!dimmed && (
        <div className="wn-actions" role="toolbar" aria-label="Sahne aksiyonları">
          <ActionBtn icon="✎"  label="Düzenle"       onClick={e => stop(e, data.onEdit)} />
          <ActionBtn icon="⇢"  label="Bağlantı ekle" onClick={e => stop(e, data.onConnect)} />
          {PLOTWORLD_SCENE_AI_ENABLED && <ActionBtn icon="🦋" label="Kelebek Etkisi" onClick={e => stop(e, data.onButterfly)} mod="butterfly" />}
          <ActionBtn icon="✕"  label="Sil"           onClick={e => stop(e, data.onDelete)} mod="danger" />
        </div>
      )}
    </div>
  );
}
