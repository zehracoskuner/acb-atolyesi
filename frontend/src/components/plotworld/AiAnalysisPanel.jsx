// components/plotworld/AiAnalysisPanel.jsx
// Tek dış kabuk: header + 3 sekme (Hikâye Koçu, Boşluk Tespiti, Sahne Önerisi)

import { useState } from "react";
import StoryCoachPanel  from "./StoryCoachPanel";
import GapAnalysisPanel from "./GapAnalysisPanel";

const TABS = [
  { key: "coach",   label: "Hikâye Koçu"    },
  { key: "gap",     label: "Boşluk Tespiti" },
  { key: "suggest", label: "Sahne Önerisi"  },
];

export default function AiAnalysisPanel({
  nodes,
  actOrder,
  actMeta,
  characters,
  workId,
  onAddScene,
  onClose,
}) {
  const [tab, setTab] = useState("coach");

  const shared = { nodes, actOrder, actMeta, characters, workId };

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <span className="ai-panel-icon" aria-hidden="true">✦</span>
          AI Analiz
        </div>
        <button className="ai-panel-close" onClick={onClose} aria-label="Paneli kapat">×</button>
      </div>

      {/* Sekmeler */}
      <div className="ai-panel-tabs" role="tablist" aria-label="AI analiz sekmeleri">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`ai-panel-tab ${tab === t.key ? "ai-panel-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Gövde */}
      <div className="ai-panel-body">

        {/* Hikaye Koçu — mount kalır, CSS ile gizlenir */}
        <div className="ai-panel-pane" style={{ display: tab === "coach" ? "block" : "none" }}>
          <StoryCoachPanel embedded {...shared} onClose={onClose} />
        </div>

        {/* Boşluk Tespiti + Sahne Önerisi — TEK GapAnalysisPanel instance'ı */}
        {/* initialTab yerine activeTab prop'u ile dışarıdan kontrol ediyoruz */}
        <div
          className="ai-panel-pane"
          style={{ display: (tab === "gap" || tab === "suggest") ? "block" : "none" }}
        >
          <GapAnalysisPanel
            embedded
            activeTab={tab === "suggest" ? "suggest" : "gap"}
            {...shared}
            onAddScene={onAddScene}
            onClose={onClose}
          />
        </div>

      </div>
    </div>
  );
}