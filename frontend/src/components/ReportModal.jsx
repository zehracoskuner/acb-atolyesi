// src/components/ReportModal.jsx
/**
 * ReportModal — Tek, kanonik şikayet modalı.
 *
 * Props:
 *   isOpen      : boolean
 *   targetType  : "work" | "chapter" | "comment" | "user"
 *   targetId    : string
 *   targetLabel : string (opsiyonel başlık)
 *   onClose     : () => void
 *
 * Uygulamanın herhangi bir yerinde useReport() hook'u ile aç,
 * bu bileşeni layout'a bir kez ekle — başka bir şey gerekmez.
 */
import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env?.VITE_API_URL ?? "/api";

const REASON_OPTIONS = [
  { value: "spam",             label: "Spam / Reklam" },
  { value: "uygunsuz_icerik",  label: "Uygunsuz içerik" },
  { value: "telif_ihlali",     label: "Telif hakkı ihlali" },
  { value: "taciz",            label: "Taciz / Zorbalık" },
  { value: "nefret_soylemi",   label: "Nefret söylemi" },
  { value: "diger",            label: "Diğer" },
];

const TYPE_LABELS = {
  work:    "eseri",
  chapter: "bölümü",
  comment: "yorumu",
  user:    "kullanıcıyı",
};

const CSS_ID = "report-modal-styles";

const CSS = `
.rm-veil {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0,0,0,.52); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; animation: rm-fade-in .15s ease;
}
@keyframes rm-fade-in { from { opacity: 0 } to { opacity: 1 } }

.rm-box {
  background: var(--rm-bg, #faf8f4);
  border: 1px solid var(--rm-border, rgba(0,0,0,.1));
  border-radius: 10px;
  padding: 1.75rem;
  width: 100%; max-width: 400px;
  animation: rm-slide-up .2s cubic-bezier(.22,1,.36,1);
  font-family: 'DM Sans', system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .rm-box {
    --rm-bg: #1a1e1c;
    --rm-border: rgba(255,255,255,.1);
  }
}
@keyframes rm-slide-up {
  from { opacity:0; transform: translateY(12px) }
  to   { opacity:1; transform: translateY(0) }
}

.rm-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: .75rem; margin-bottom: 1.2rem;
}
.rm-title {
  font-family: 'Cormorant Garamond', 'Georgia', serif;
  font-size: 1.25rem; font-weight: 300; font-style: italic;
  color: var(--rm-ink, #1a1a1a); line-height: 1.3; margin: 0;
}
@media (prefers-color-scheme: dark) { .rm-title { --rm-ink: #e8ede9; } }

.rm-close {
  flex-shrink: 0; background: none; border: none;
  cursor: pointer; padding: .2rem; line-height: 1;
  color: var(--rm-dim, #888); transition: color .15s;
}
.rm-close:hover { color: var(--rm-ink, #1a1a1a); }
@media (prefers-color-scheme: dark) {
  .rm-close { --rm-dim: #5a6a5c; }
  .rm-close:hover { --rm-ink: #e8ede9; }
}

.rm-subtitle {
  font-size: .72rem; color: var(--rm-dim, #888);
  margin: -.6rem 0 1.1rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.rm-label {
  display: block; font-size: .68rem; font-weight: 500;
  letter-spacing: .12em; text-transform: uppercase;
  color: var(--rm-dim, #888); margin-bottom: .5rem;
}

.rm-reasons {
  display: flex; flex-direction: column; gap: .3rem; margin-bottom: 1rem;
}
.rm-reason {
  display: flex; align-items: center; gap: .65rem;
  padding: .55rem .75rem; border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer; transition: background .12s, border-color .12s;
  font-size: .8rem; color: var(--rm-ink, #1a1a1a);
  background: none;
  width: 100%; text-align: left;
  font-family: inherit;
}
.rm-reason:hover {
  background: var(--rm-hover, rgba(0,0,0,.04));
}
.rm-reason--selected {
  background: var(--rm-sel-bg, rgba(184,150,42,.08));
  border-color: var(--rm-sel-border, rgba(184,150,42,.3));
  color: var(--rm-sel-fg, #7a6010);
}
@media (prefers-color-scheme: dark) {
  .rm-reason { --rm-ink: #c8d4c8; --rm-hover: rgba(255,255,255,.05); }
  .rm-reason--selected {
    --rm-sel-bg: rgba(184,150,42,.12);
    --rm-sel-border: rgba(184,150,42,.3);
    --rm-sel-fg: #d4a830;
  }
}

.rm-radio {
  width: 15px; height: 15px; border-radius: 50%;
  border: 1.5px solid var(--rm-radio-border, #bbb);
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  transition: border-color .12s;
}
.rm-reason--selected .rm-radio {
  border-color: var(--rm-sel-fg, #7a6010);
}
.rm-radio-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--rm-sel-fg, #7a6010);
  transform: scale(0); transition: transform .12s;
}
.rm-reason--selected .rm-radio-dot { transform: scale(1); }

.rm-desc {
  width: 100%; box-sizing: border-box;
  background: var(--rm-input-bg, rgba(0,0,0,.04));
  border: 1px solid var(--rm-border, rgba(0,0,0,.1));
  border-radius: 6px; padding: .6rem .8rem;
  font-family: inherit; font-size: .8rem;
  color: var(--rm-ink, #1a1a1a); resize: vertical;
  min-height: 72px; outline: none;
  transition: border-color .15s;
  margin-bottom: 1rem;
}
.rm-desc::placeholder { color: var(--rm-dim, #aaa); }
.rm-desc:focus { border-color: var(--rm-focus, rgba(184,150,42,.5)); }
@media (prefers-color-scheme: dark) {
  .rm-desc {
    --rm-input-bg: rgba(255,255,255,.05);
    --rm-focus: rgba(184,150,42,.4);
  }
}

.rm-error {
  font-size: .72rem; color: #c0392b;
  background: rgba(192,57,43,.07); border: 1px solid rgba(192,57,43,.2);
  border-radius: 4px; padding: .45rem .7rem; margin-bottom: .8rem;
}

.rm-success {
  text-align: center; padding: 1.5rem 0 .5rem;
}
.rm-success-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(74,124,89,.1); border: 1px solid rgba(74,124,89,.25);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto .9rem;
}
.rm-success-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.1rem; font-weight: 300; font-style: italic;
  color: var(--rm-ink, #1a1a1a); margin: 0 0 .35rem;
}
.rm-success-sub {
  font-size: .75rem; color: var(--rm-dim, #888);
}

.rm-footer {
  display: flex; justify-content: flex-end; gap: .5rem; margin-top: .25rem;
}
.rm-btn {
  font-family: inherit; font-size: .75rem; font-weight: 500;
  padding: .5rem 1.1rem; border-radius: 5px;
  border: 1px solid var(--rm-border, rgba(0,0,0,.12));
  cursor: pointer; transition: all .15s;
}
.rm-btn--ghost {
  background: none; color: var(--rm-dim, #888);
}
.rm-btn--ghost:hover { color: var(--rm-ink, #1a1a1a); }
.rm-btn--submit {
  background: var(--rm-submit-bg, #c0392b);
  border-color: transparent; color: #fff;
}
.rm-btn--submit:hover { background: var(--rm-submit-hover, #a93226); }
.rm-btn--submit:disabled { opacity: .45; cursor: not-allowed; }
.rm-btn--close {
  background: var(--rm-close-bg, rgba(74,124,89,.08));
  border-color: rgba(74,124,89,.25); color: #4a7c59;
}
.rm-btn--close:hover { background: rgba(74,124,89,.14); }
`;

function injectStyles() {
  if (document.getElementById(CSS_ID)) return;
  const tag = document.createElement("style");
  tag.id = CSS_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

export default function ReportModal({
  isOpen,
  targetType,
  targetId,
  targetLabel = "",
  onClose,
}) {
  const [reason,      setReason]      = useState("");
  const [description, setDescription] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");
  const [submitted,   setSubmitted]   = useState(false);

  // Stil enjeksiyonu
  useEffect(() => { injectStyles(); }, []);

  // Modal açılınca formu sıfırla
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setDescription("");
      setError("");
      setSubmitting(false);
      setSubmitted(false);
    }
  }, [isOpen]);

  // Escape tuşu
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!reason) { setError("Lütfen bir sebep seç."); return; }
    setError("");
    setSubmitting(true);

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // 409 = zaten şikayet edilmiş, bunu da başarı gibi göster
        if (res.status === 409) { setSubmitted(true); return; }
        throw new Error(data.message || "Şikayet gönderilemedi.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Beklenmeyen bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  }, [reason, description, targetType, targetId]);

  if (!isOpen) return null;

  const typeLabel = TYPE_LABELS[targetType] || "içeriği";

  return (
    <div className="rm-veil" onClick={onClose}>
      <div className="rm-box" onClick={(e) => e.stopPropagation()}>

        {/* Başlık */}
        <div className="rm-header">
          <h3 className="rm-title">
            {submitted ? "Şikayet İletildi" : "Şikayet Et"}
          </h3>
          <button className="rm-close" onClick={onClose} aria-label="Kapat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Başarı ekranı */}
        {submitted ? (
          <>
            <div className="rm-success">
              <div className="rm-success-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="#4a7c59" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <p className="rm-success-title">Şikayetin alındı.</p>
              <p className="rm-success-sub">
                Ekibimiz bu {typeLabel} inceleyecek.<br />
                Geri bildiriminiz için teşekkürler.
              </p>
            </div>
            <div className="rm-footer">
              <button className="rm-btn rm-btn--close" onClick={onClose}>Kapat</button>
            </div>
          </>
        ) : (
          <>
            {/* Alt başlık */}
            {targetLabel && (
              <p className="rm-subtitle" title={targetLabel}>
                "{targetLabel}"
              </p>
            )}

            {/* Sebep seçimi */}
            <span className="rm-label">Sebep</span>
            <div className="rm-reasons" role="radiogroup">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`rm-reason ${reason === opt.value ? "rm-reason--selected" : ""}`}
                  onClick={() => { setReason(opt.value); setError(""); }}
                  role="radio"
                  aria-checked={reason === opt.value}
                >
                  <div className="rm-radio">
                    <div className="rm-radio-dot" />
                  </div>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Açıklama */}
            <span className="rm-label">Açıklama <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opsiyonel)</span></span>
            <textarea
              className="rm-desc"
              placeholder="Ek bilgi vermek istersen buraya yazabilirsin…"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
            />

            {/* Hata */}
            {error && <p className="rm-error">{error}</p>}

            {/* Footer */}
            <div className="rm-footer">
              <button className="rm-btn rm-btn--ghost" onClick={onClose}>
                Vazgeç
              </button>
              <button
                className="rm-btn rm-btn--submit"
                onClick={handleSubmit}
                disabled={submitting || !reason}
              >
                {submitting ? "Gönderiliyor…" : "Şikayet Gönder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}