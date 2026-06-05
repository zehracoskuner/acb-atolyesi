// components/plotworld/StructureSetupModal.jsx
import { useState } from "react";
import { STRUCTURE_TEMPLATES, DEFAULT_TEMPLATE } from "./constants";

const PALETTE = [
  "#6d28d9","#0891b2","#b45309","#be123c",
  "#065f46","#1e40af","#7c3aed","#c2410c",
  "#0e7490","#166534","#9d174d","#92400e",
];

export default function StructureSetupModal({
  currentTemplate,
  currentActs,
  onSave,
  onClose,
  isFirstTime = false,
}) {
  const [selected, setSelected] = useState(currentTemplate || DEFAULT_TEMPLATE);

  const [customActs, setCustomActs] = useState(() => {
    if (currentTemplate === "serbest" && currentActs?.length) return currentActs;
    const serbest = STRUCTURE_TEMPLATES.serbest;
    return serbest?.acts?.length
      ? serbest.acts
      : [
          { id: "perde1", label: "I. Perde",  color: "#6d28d9", roman: "I"  },
          { id: "perde2", label: "II. Perde", color: "#0891b2", roman: "II" },
        ];
  });

  const isCustom = selected === "serbest";

  function addAct() {
    const i = customActs.length;
    setCustomActs(prev => [
      ...prev,
      {
        id:    `act${Date.now()}`,
        label: `${i + 1}. Perde`,
        color: PALETTE[i % PALETTE.length],
        roman: toRoman(i + 1),
      },
    ]);
  }

  function removeAct(idx) {
    if (customActs.length <= 2) return;
    setCustomActs(prev => prev.filter((_, i) => i !== idx));
  }

  function updateAct(idx, field, value) {
    setCustomActs(prev => prev.map((a, i) =>
      i === idx ? { ...a, [field]: value } : a
    ));
  }

  function handleSave() {
    const acts = isCustom ? customActs : STRUCTURE_TEMPLATES[selected]?.acts;
    if (!acts?.length) return;
    onSave(selected, acts);
  }

  return (
    <div className="ssm-overlay" onClick={e => e.target === e.currentTarget && !isFirstTime && onClose()}>
      <div className="ssm-modal">

        {/* Header */}
        <div className="ssm-header">
          <div>
            <div className="ssm-eyebrow">
              {isFirstTime ? "Hikayene başla" : "Perde yapısını değiştir"}
            </div>
            <div className="ssm-title">Hangi yapıyı kullanacaksın?</div>
          </div>
          {!isFirstTime && (
            <button className="ssm-close" onClick={onClose}>×</button>
          )}
        </div>

        {/* Şablon kartları */}
        <div className="ssm-templates">
          {Object.values(STRUCTURE_TEMPLATES).map(t => (
            <button
              key={t.id}
              className={`ssm-card ${selected === t.id ? "ssm-card--active" : ""}`}
              onClick={() => setSelected(t.id)}
            >
              <div className="ssm-card-acts">
                {(t.id === "serbest" ? customActs : (t.acts ?? [])).map(a => (
                  <span
                    key={a.id}
                    className="ssm-act-strip"
                    style={{ background: a.color, flex: 1 }}
                    title={a.label}
                  />
                ))}
              </div>
              <div className="ssm-card-label">{t.label}</div>
              <div className="ssm-card-desc">{t.description}</div>
              {selected === t.id && (
                <div className="ssm-card-check">✓</div>
              )}
            </button>
          ))}
        </div>

        {/* Seçilen şablonun akt önizlemesi */}
        {!isCustom && (
          <div className="ssm-preview">
            <div className="ssm-preview-label">Perdeler</div>
            <div className="ssm-preview-acts">
              {(STRUCTURE_TEMPLATES[selected]?.acts ?? []).map(a => (
                <div key={a.id} className="ssm-preview-act">
                  <span className="ssm-preview-dot" style={{ background: a.color }} />
                  <span className="ssm-preview-roman">{a.roman}.</span>
                  <span className="ssm-preview-name">{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Özel yapı editörü */}
        {isCustom && (
          <div className="ssm-custom">
            <div className="ssm-preview-label">Perdelerini Düzenle</div>
            {customActs.map((act, idx) => (
              <div key={act.id} className="ssm-custom-row">
                <input
                  type="color"
                  className="ssm-color-pick"
                  value={act.color}
                  onChange={e => updateAct(idx, "color", e.target.value)}
                  title="Renk seç"
                />
                <input
                  className="ssm-act-input"
                  placeholder="Perde adı"
                  value={act.label}
                  onChange={e => updateAct(idx, "label", e.target.value)}
                />
                <input
                  className="ssm-act-input ssm-act-input--roman"
                  placeholder="I"
                  value={act.roman}
                  onChange={e => updateAct(idx, "roman", e.target.value)}
                  maxLength={4}
                />
                <button
                  className="ssm-remove-act"
                  onClick={() => removeAct(idx)}
                  disabled={customActs.length <= 2}
                  title="Perdeyi sil"
                >
                  ✕
                </button>
              </div>
            ))}
            {customActs.length < 8 && (
              <button className="ssm-add-act" onClick={addAct}>
                + Perde Ekle
              </button>
            )}
          </div>
        )}

        {/* Uyarı — değiştirme durumunda */}
        {!isFirstTime && (
          <div className="ssm-warning">
            ⚠ Yapı değişirse mevcut sahneler ilk perdeye taşınabilir.
            Bağlantılar korunur.
          </div>
        )}

        {/* Footer */}
        <div className="ssm-footer">
          {!isFirstTime && (
            <button className="ssm-btn ssm-btn--ghost" onClick={onClose}>
              İptal
            </button>
          )}
          <button className="ssm-btn ssm-btn--primary" onClick={handleSave}>
            {isFirstTime ? "Başla →" : "Yapıyı Uygula"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Romen rakamı yardımcısı ── */
function toRoman(n) {
  const vals = [10,"X",9,"IX",5,"V",4,"IV",1,"I"];
  let result = "";
  for (let i = 0; i < vals.length; i += 2) {
    while (n >= vals[i]) { result += vals[i+1]; n -= vals[i]; }
  }
  return result;
}