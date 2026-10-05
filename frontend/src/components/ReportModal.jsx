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
import { createPortal } from "react-dom";
import "./ReportDialog.css";
import { apiPost } from "../lib/api";
import { useState, useEffect, useCallback, useRef, useId } from "react";



const REASON_OPTIONS = [
  { value: "spam",             label: "Spam / Reklam" },
  { value: "uygunsuz_icerik",  label: "Uygunsuz içerik" },
  { value: "telif_ihlali",     label: "Telif hakkı ihlali" },
  { value: "taciz",            label: "Taciz / Zorbalık" },
  { value: "nefret_soylemi",   label: "Nefret söylemi" },
  { value: "diger",            label: "Diğer" },
];

const TYPE_LABELS = {
  cover: "kapak görselini", avatar: "profil fotoğrafını", banner: "profil bannerını",
  work:    "eseri",
  chapter: "bölümü",
  comment: "yorumu",
  user:    "kullanıcıyı",
};

export default function ReportModal({
  isOpen,
  targetType,
  targetId,
  targetLabel = "",
  expectedUrl,
  onClose,
  initialReason = "",
}) {
  const dialogRef = useRef(null);
  const fieldId = useId();
  const [originalWork, setOriginalWork] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [reason,      setReason]      = useState("");
  const [description, setDescription] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");
  const [submitted,   setSubmitted]   = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    dialogRef.current?.focus();
    const trap = e => {
      if (e.key !== 'Tab') return;
      const elements = dialogRef.current?.querySelectorAll('button:not(:disabled), textarea, a[href]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [isOpen]);

  // Modal açılınca formu sıfırla
  useEffect(() => {
    if (isOpen) {
      setReason(initialReason);
      setOriginalWork(""); setReceipt(null);
      setDescription("");
      setError("");
      setSubmitting(false);
      setSubmitted(false);
    }
  }, [isOpen, initialReason]);

  // Escape tuşu
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!reason) { setError("Lütfen bir sebep seç."); return; }
    if (reason === "telif_ihlali" && !["cover", "avatar", "banner"].includes(targetType) && (!originalWork.trim() || !description.trim())) { setError("Özgün eser ve gerekçe zorunludur."); return; }
    setError("");
    setSubmitting(true);

    try {
      const data = await apiPost('/reports', { targetType, targetId, expectedUrl, contentReview: targetType === 'chapter' && reason !== 'telif_ihlali', reason, description: description.trim(), originalWork: originalWork.trim() });
      setReceipt(data.sikayet);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Beklenmeyen bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  }, [reason, description, originalWork, targetType, targetId, expectedUrl]);

  if (!isOpen) return null;

  const typeLabel = TYPE_LABELS[targetType] || "içeriği";

  return createPortal(
    <div className="rm-veil" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="rm-box" role="dialog" aria-modal="true" aria-label="Şikâyet başvurusu" onClick={(e) => e.stopPropagation()}>

        {/* Başlık */}
        <div className="rm-header">
          <h3 className="rm-title">
            {submitted ? "Bildiriminiz iletildi" : "Bildirimde bulunun"}
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
              {receipt && <p>Başvuru numarası: {receipt.number || receipt.id}<br />Durum: Alındı<br /><a href={`/basvurular/${receipt.id}`}>Başvuruyu takip et</a></p>}
              <p className="rm-success-title">Bildiriminiz alındı.</p>
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
              {REASON_OPTIONS.filter(opt => targetType !== 'user' || opt.value !== 'telif_ihlali').map((opt) => (
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

            {reason === 'telif_ihlali' && !['cover', 'avatar', 'banner'].includes(targetType) && <>
              <label className="rm-label" htmlFor={`${fieldId}-original`}>Özgün eserin bağlantısı veya açıklaması (zorunlu)</label>
              <textarea id={`${fieldId}-original`} className="rm-desc" maxLength={4000} value={originalWork} onChange={e => setOriginalWork(e.target.value)} />
              <p>Şikâyet edilen içerik: {targetLabel || targetId}. Dış bağlantılar kanıt olarak alınır; ACB dış sitedeki içeriği kaldıramaz. Bağlantılar otomatik ziyaret edilmez.</p>
            </>}
            {/* Açıklama */}
            <label className="rm-label" htmlFor={`${fieldId}-description`}>Açıklama <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{reason === "telif_ihlali" && !["cover", "avatar", "banner"].includes(targetType) ? "(gerekçe zorunlu)" : "(opsiyonel)"}</span></label>
            <textarea
              id={`${fieldId}-description`}
              className="rm-desc"
              placeholder="İncelememize yardımcı olacak bilgileri paylaşabilirsiniz…"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
            />

            {/* Hata */}
            {error && <p className="rm-error" role="alert">{error}</p>}

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
                {submitting ? "Gönderiliyor…" : "İncelemeye gönder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>, document.body
  );
}
