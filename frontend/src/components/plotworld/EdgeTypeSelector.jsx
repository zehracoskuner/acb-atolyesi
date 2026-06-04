// components/plotworld/EdgeTypeSelector.jsx
import { useEffect, useRef } from "react";
import { EDGE_TYPES } from "./constants";

export default function EdgeTypeSelector({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="ets-overlay" role="dialog" aria-modal="true" aria-label="Bağlantı tipi seç">
      <div className="ets-popup" ref={ref}>
        <div className="ets-header">
          <span className="ets-header-icon" aria-hidden="true">⇢</span>
          <span className="ets-header-title">Bu bağlantı nasıl kuruldu?</span>
        </div>
        <div className="ets-grid">
          {Object.entries(EDGE_TYPES).map(([key, meta]) => (
            <button
              key={key}
              className="ets-item"
              onClick={() => onSelect(key)}
              title={meta.label}
            >
              <span
                className="ets-item-icon"
                style={{ color: meta.color, background: `${meta.color}14`, borderColor: `${meta.color}40` }}
              >
                {meta.icon}
              </span>
              <span className="ets-item-label">{meta.label}</span>
              {meta.dash && <span className="ets-item-dash">·-·</span>}
            </button>
          ))}
        </div>
        <button className="ets-skip" onClick={() => onSelect(null)}>
          Tipini belirlemeden bağla →
        </button>
      </div>
    </div>
  );
}