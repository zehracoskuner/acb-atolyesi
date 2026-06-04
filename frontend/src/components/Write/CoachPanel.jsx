// src/components/Write/CoachPanel.jsx
import React from "react";

export default function CoachPanel({ coachNotes, setCoachNotes, dismissedNotes, setDismissedNotes }) {
  const visibleNotes = coachNotes?.filter((n) => !dismissedNotes.has(n.key)) || [];

  return (
    <div className="write-coach-panel">
      <div className="coach-panel-head">
        <span className="coach-panel-title">🧠 Koç</span>
        <button
          className="coach-clear-btn"
          onClick={() => setCoachNotes([])}
          disabled={visibleNotes.length === 0}
        >
          Temizle
        </button>
      </div>
      
      <div className="coach-notes-scroll">
        {visibleNotes.length === 0 ? (
          <div className="coach-empty">
            <span className="coach-empty-icon">✦</span>
            <p>Yazdıkça koç sessizce buraya not düşecek.</p>
          </div>
        ) : (
          visibleNotes.slice(0, 6).map((note) => {
            const sev = note.severity || "low";
            return (
              <div key={note.key} className={`coach-note sev-${sev}`}>
                <div className="cn-top">
                  <div className="cn-left">
                    <span className="cn-icon">{note.icon || "📝"}</span>
                    <span className="cn-title">{note.title}</span>
                    {note.count > 1 && <span className="cn-count">×{note.count}</span>}
                  </div>
                  <div className="cn-right">
                    <span className={`cn-badge sev-${sev}`}>
                      {sev === "medium" ? "Orta" : "Hafif"}
                    </span>
                    <button
                      className="cn-dismiss"
                      onClick={() => setDismissedNotes((p) => new Set([...p, note.key]))}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="cn-body">{note.message}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}