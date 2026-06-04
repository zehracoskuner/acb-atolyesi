// components/plotworld/SceneModal.jsx
// isAlternative toggle kaldırıldı — alternatif dal artık edge tipinden yönetiliyor.
// Perde seçimi actMeta'dan label alıyor — dinamik şablonlarla uyumlu.

import { useState } from "react";
import { VOLUME_META, CHAR_PALETTE } from "./constants";

export default function SceneModal({
  initial,
  defaultAct,
  onSave,
  onClose,
  saving,
  characters = [],
  actOrder   = [],
  actMeta    = {},
}) {
  const isEdit = !!initial;

  const resolvedAct = initial?.raw?.act || defaultAct || actOrder[0] || "";

  const [form, setForm] = useState({
    act:         resolvedAct,
    title:       initial?.label       || "",
    goal:        initial?.goal        || "",
    volume:      initial?.volume      || "",
    charIds:     initial?.charIds     || [],
    description: initial?.desc        || "",
    status:      initial?.status      || "idea",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.title.trim()) return;
    onSave({ ...form, title: form.title.trim() });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") onClose();
  }

  /* actMeta'dan label al — dinamik perde yapısıyla uyumlu */
  const getActMeta = (k) => actMeta[k] || { label: k, color: "#888", roman: "" };

  return (
    <div
      className="wm-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="wm-modal wm-modal--slim" role="dialog" aria-modal="true" aria-label={isEdit ? "Sahneyi Düzenle" : "Yeni Sahne"}>

        {/* ── Header ── */}
        <div className="wm-header">
          <div className="wm-header-left">
            {isEdit && form.act && (
              <span
                className="wm-act-pill"
                style={{
                  color:       getActMeta(form.act).color,
                  borderColor: getActMeta(form.act).color + "44",
                  background:  getActMeta(form.act).color + "0e",
                }}
              >
                {getActMeta(form.act).label}
              </span>
            )}
            <span className="wm-title">
              {isEdit ? "Sahneyi Düzenle" : "Yeni Sahne"}
            </span>
          </div>
          <button className="wm-close" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        {/* ── Body ── */}
        <div className="wm-body">

          {/* Başlık */}
          <div className="wm-field">
            <label className="wm-label">Sahne Adı</label>
            <input
              className="wm-input"
              placeholder="Bu sahneye bir isim ver…"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              autoFocus
              aria-required="true"
            />
          </div>

          {/* Perde seçimi — sadece yeni sahnede */}
{actOrder.length > 0 && (
  <div className="wm-field">
    <label className="wm-label">
      Perde
      {isEdit && (
        <span className="wm-label-hint"> — sahneyi sürükleyerek değiştir</span>
      )}
    </label>
    <div className="wm-act-btns" role="group" aria-label="Perde seç">
      {actOrder.map(k => {
        const v      = getActMeta(k);
        const active = form.act === k;
        return (
          <button
            key={k}
            type="button"
            className={`wm-act-btn ${active ? "wm-act-btn--on" : ""}`}
            style={active ? {
              borderColor: v.color,
              color:       v.color,
              background:  v.color + "0f",
            } : {}}
            onClick={() => !isEdit && set("act", k)}
            disabled={isEdit}
            aria-pressed={active}
            aria-disabled={isEdit}
          >
            {v.roman ? `${v.roman}. ` : ""}{v.label}
          </button>
        );
      })}
    </div>
  </div>
)}

          {/* Sahnenin amacı */}
          <div className="wm-field">
            <label className="wm-label">
              Bu sahnenin amacı nedir?
              <span className="wm-label-hint"> — opsiyonel ama güçlü</span>
            </label>
            <input
              className="wm-input"
              placeholder="Bu sahne hikâyeyi ne kadar ileri taşıyor?"
              value={form.goal}
              onChange={e => set("goal", e.target.value)}
            />
          </div>

          {/* Hacim */}
          <div className="wm-field">
            <label className="wm-label">Tahmini Hacim</label>
            <div className="wm-volume-btns" role="group" aria-label="Hacim seç">
              {Object.entries(VOLUME_META).map(([k, v]) => {
                const active = form.volume === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`wm-volume-btn ${active ? "wm-volume-btn--on" : ""}`}
                    style={active ? { borderColor: v.color, color: v.color } : {}}
                    onClick={() => set("volume", active ? "" : k)}
                    title={v.pages}
                    aria-pressed={active}
                  >
                    {v.label}
                    <span className="wm-volume-pages">{v.pages}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Karakterler */}
          {characters.length > 0 && (
            <div className="wm-field">
              <label className="wm-label">Karakterler</label>
              <div className="wm-char-list" role="group" aria-label="Karakter seç">
                {characters.map((c, i) => {
                  const id       = String(c._id);
                  const selected = form.charIds.includes(id);
                  const color    = c.color || CHAR_PALETTE[i % CHAR_PALETTE.length];
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`wm-char-btn ${selected ? "wm-char-btn--on" : ""}`}
                      style={selected ? {
                        borderColor: color,
                        background:  color + "12",
                      } : {}}
                      onClick={() =>
                        set("charIds", selected
                          ? form.charIds.filter(x => x !== id)
                          : [...form.charIds, id]
                        )
                      }
                      aria-pressed={selected}
                    >
                      <span
                        className="wm-char-dot"
                        style={{ background: color }}
                        aria-hidden="true"
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="wm-footer">
          <button
            className="wm-btn wm-btn--ghost"
            onClick={onClose}
            disabled={saving}
            type="button"
          >
            İptal
          </button>
          <button
            className="wm-btn wm-btn--primary"
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            type="button"
          >
            {saving
              ? <><span className="wm-spinner" aria-hidden="true" /> Kaydediliyor…</>
              : isEdit ? "Kaydet" : "Sahneyi Ekle"
            }
          </button>
        </div>

      </div>
    </div>
  );
}