// src/components/Modals/SprintModal.jsx
import React, { useState } from "react";

// SPRINT_MODES'u export ediyoruz ki Write.jsx içindeki üst barda da kullanılabilsin.
export const SPRINT_MODES = [
  { key: "sprint", icon: "⚡", label: "Sprint",    mins: 10, words: 150, hint: "İç eleştirmeni sustur. Dur, silme." },
  { key: "warmup", icon: "🔥", label: "Isınma",    mins: 2,  words: 60,  hint: "Akışı aç. Mükemmel olmasına gerek yok." },
  { key: "edit",   icon: "✂️",  label: "Düzenleme", mins: 5,  words: 0,   hint: "1 paragrafı sadeleştir. 2 kelime at, 1 güçlü fiil ekle." },
];

export default function SprintModal({ onStart, onClose }) {
  const [sel, setSel] = useState("sprint");
  const mode = SPRINT_MODES.find(m => m.key === sel);

  return (
    <div 
      style={{ 
        position: "fixed", 
        inset: 0, 
        background: "rgba(0,0,0,.35)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        zIndex: 1000, 
        padding: 24 
      }} 
      onClick={onClose}
    >
      <div 
        style={{ 
          background: "var(--paper)", 
          border: "1px solid var(--paper-3)", 
          borderRadius: 10, 
          padding: "1.6rem", 
          maxWidth: 380, 
          width: "100%", 
          boxShadow: "0 16px 48px rgba(0,0,0,.12)" 
        }} 
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontFamily: "var(--f-display)", fontSize: "1rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 .3rem" }}>
          Yazma Seansı
        </h3>
        <p style={{ fontFamily: "var(--f-ui)", fontSize: ".72rem", color: "var(--ink-3)", margin: "0 0 1.1rem" }}>
          Mod seç, zamanlayıcı başlasın.
        </p>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {SPRINT_MODES.map(m => (
            <button 
              key={m.key} 
              onClick={() => setSel(m.key)}
              style={{ 
                padding: "11px 13px", 
                borderRadius: 7, 
                border: `1.5px solid ${sel === m.key ? "var(--ink)" : "var(--paper-3)"}`, 
                background: sel === m.key ? "var(--ink)" : "var(--paper)", 
                cursor: "pointer", 
                textAlign: "left", 
                display: "flex", 
                alignItems: "center", 
                gap: 10,
                transition: "all 0.15s ease"
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
              <div>
                <p style={{ 
                  fontFamily: "var(--f-ui)", 
                  fontWeight: 500, 
                  fontSize: ".82rem", 
                  color: sel === m.key ? "var(--paper)" : "var(--ink)", 
                  margin: 0,
                  transition: "color 0.15s ease"
                }}>
                  {m.label} · {m.mins} dk{m.words > 0 ? ` · ${m.words} kelime` : ""}
                </p>
                <p style={{ 
                  fontFamily: "var(--f-ui)", 
                  fontSize: ".68rem", 
                  color: sel === m.key ? "rgba(249,247,243,.6)" : "var(--ink-3)", 
                  margin: "2px 0 0",
                  transition: "color 0.15s ease"
                }}>
                  {m.hint}
                </p>
              </div>
            </button>
          ))}
        </div>
        
        <button 
          onClick={() => onStart(mode)}
          style={{ 
            width: "100%", 
            padding: ".68rem", 
            background: "var(--ink)", 
            color: "var(--paper)", 
            border: "none", 
            borderRadius: 6, 
            fontFamily: "var(--f-ui)", 
            fontSize: ".8rem", 
            fontWeight: 500, 
            cursor: "pointer", 
            letterSpacing: ".04em",
            transition: "opacity 0.15s ease"
          }}
          onMouseOver={(e) => e.target.style.opacity = "0.85"}
          onMouseOut={(e) => e.target.style.opacity = "1"}
        >
          Başlat
        </button>
      </div>
    </div>
  );
}