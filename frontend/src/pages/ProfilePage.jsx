// src/pages/ProfilePage.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import { clearAuth } from "../lib/auth";
import "../styles/ProfilePage.css";
import LogTab from "../components/LogTab";
import "../styles/LogTab.css";
import AddFromLibraryModal from "../components/AddFromLibraryModal";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "/api";

/* ─── Yardımcılar ─────────────────────────────────────────────────────────── */
function fmtNum(n = 0) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
function fmtWords(n = 0) { return fmtNum(n) + " kelime"; }
function joinDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)     return "az önce";
  if (diff < 3600)   return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}
function getCurrentUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function getUsername(obj) {
  return obj?.kullaniciAdi || obj?.username || "";
}

/* ═══════════════════════════════════════════════════════════════════════════
   ReportModal
══════════════════════════════════════════════════════════════════════════════ */
const REPORT_REASONS = [
  { value: "spam",            label: "Spam" },
  { value: "uygunsuz_icerik", label: "Uygunsuz İçerik" },
  { value: "telif_ihlali",    label: "Telif İhlali" },
  { value: "taciz",           label: "Taciz / Zorbalık" },
  { value: "nefret_soylemi",  label: "Nefret Söylemi" },
  { value: "diger",           label: "Diğer" },
];

const TARGET_LABELS = {
  user: "kullanıcıyı",
  work: "eseri",
};

function ReportModal({ targetType, targetId, targetName, onClose }) {
  const [reason,      setReason]      = useState("");
  const [description, setDescription] = useState("");
  const [sending,     setSending]     = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState("");

  async function handleSubmit() {
    if (!reason) { setError("Lütfen bir sebep seç."); return; }
    setSending(true);
    setError("");
    try {
      await apiPost("/reports", { targetType, targetId, reason, description });
      setDone(true);
    } catch (e) {
      setError(e.message || "Şikayet gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div className="pf-modal" onClick={e => e.stopPropagation()} style={{ minWidth: 360, maxWidth: 440 }}>

        {done ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: ".75rem" }}>✓</div>
            <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", marginBottom: ".5rem" }}>
              Şikayetiniz alındı
            </h4>
            <p style={{ fontSize: ".83rem", color: "var(--ink-3)", lineHeight: 1.6 }}>
              En kısa sürede incelenecektir. Katkın için teşekkürler.
            </p>
            <button
              className="pf-btn pf-btn--primary"
              style={{ marginTop: "1.25rem" }}
              onClick={onClose}
            >
              Kapat
            </button>
          </div>
        ) : (
          <>
            <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.15rem", margin: "0 0 .25rem" }}>
              Şikayet Et
            </h4>
            <p style={{ fontSize: ".78rem", color: "var(--ink-3)", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--ink-2)" }}>{targetName}</strong> adlı{" "}
              {TARGET_LABELS[targetType] || "içeriği"} şikayet ediyorsun.
            </p>

            <div className="pf-form-group">
              <label className="pf-form-label">Şikayet Sebebi *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
                {REPORT_REASONS.map(r => (
                  <label
                    key={r.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: ".6rem",
                      cursor: "pointer",
                      padding: ".45rem .65rem",
                      borderRadius: 6,
                      border: `1px solid ${reason === r.value ? "var(--ink-3)" : "var(--border)"}`,
                      background: reason === r.value ? "var(--bg-2)" : "transparent",
                      transition: "all .15s",
                      fontSize: ".83rem",
                      color: "var(--ink-2)",
                    }}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      style={{ accentColor: "var(--ink)", width: 14, height: 14, flexShrink: 0 }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="pf-form-group" style={{ marginTop: ".9rem" }}>
              <label className="pf-form-label">
                Açıklama{" "}
                <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>(opsiyonel)</span>
              </label>
              <textarea
                className="pf-form-textarea"
                placeholder="Durumu kısaca anlat…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="pf-form-hint">{description.length} / 500</p>
            </div>

            {error && (
              <p style={{ fontSize: ".78rem", color: "#b83232", margin: "-.25rem 0 .75rem" }}>
                {error}
              </p>
            )}

            <div className="pf-modal-actions">
              <button className="pf-btn pf-btn--ghost" onClick={onClose} disabled={sending}>
                Vazgeç
              </button>
              <button
                className="pf-btn pf-btn--danger"
                onClick={handleSubmit}
                disabled={sending || !reason}
              >
                {sending ? "Gönderiliyor…" : "Şikayet Gönder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WorkCard
══════════════════════════════════════════════════════════════════════════════ */
function WorkCard({ work, isOwner, index, onDelete, onReport }) {
  const navigate    = useNavigate();
  const isPublished = work.status === "published";
  const workId      = work._id || work.id;
  const target      = isOwner ? `/work/${workId}` : `/story/${workId}`;

  return (
    <div className="pf-work-card" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="pf-work-cover" onClick={() => navigate(target)}>
        {work.coverImage ? (
          <img src={work.coverImage} alt={work.title} />
        ) : (
          <div className="pf-work-cover-placeholder">
            <div className="pf-work-cover-pattern" />
            <span className="pf-work-initials">{work.title?.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        {isOwner && (
          <span className={`pf-work-status pf-work-status--${isPublished ? "published" : "draft"}`}>
            {isPublished ? "Yayında" : "Taslak"}
          </span>
        )}
      </div>
      <h3 className="pf-work-title" onClick={() => navigate(target)}>{work.title}</h3>
      <div className="pf-work-meta">
        <span>{work.chapterCount ?? work.stats?.chapterCount ?? 0} bölüm</span>
        {(work.totalWords > 0 || work.stats?.totalWords > 0) && (
          <>
            <span className="pf-stat-sep">·</span>
            <span>{fmtWords(work.totalWords || work.stats?.totalWords)}</span>
          </>
        )}
      </div>
      {isOwner && (
        <div className="pf-work-actions">
          <button className="pf-work-action-btn" onClick={() => navigate(`/work/${workId}`)}>Düzenle</button>
          <button
            className="pf-work-action-btn pf-work-action-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(workId); }}
          >
            Sil
          </button>
        </div>
      )}
      {!isOwner && (
        <div className="pf-work-actions">
          <button
            className="pf-work-action-btn"
            style={{ color: "var(--ink-4)", fontSize: ".72rem" }}
            onClick={(e) => {
              e.stopPropagation();
              onReport?.({ targetType: "work", targetId: workId, targetName: work.title });
            }}
          >
            Şikayet Et
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LibraryCard
══════════════════════════════════════════════════════════════════════════════ */
function LibraryCard({ work, index }) {
  const navigate = useNavigate();
  const workId   = work._id || work.id;
  return (
    <div
      className="pf-work-card"
      style={{ animationDelay: `${index * 0.05}s`, cursor: "pointer" }}
      onClick={() => navigate(`/story/${workId}`)}
    >
      <div className="pf-work-cover">
        {work.coverImage ? (
          <img src={work.coverImage} alt={work.title} />
        ) : (
          <div className="pf-work-cover-placeholder">
            <div className="pf-work-cover-pattern" />
            <span className="pf-work-initials">{work.title?.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
      </div>
      <h3 className="pf-work-title">{work.title}</h3>
      <div className="pf-work-meta">
        <span>{getUsername(work.author) || "Yazar"}</span>
        {work.chapterCount > 0 && (
          <>
            <span className="pf-stat-sep">·</span>
            <span>{work.chapterCount} bölüm</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NewWorkCard
══════════════════════════════════════════════════════════════════════════════ */
function NewWorkCard() {
  const navigate = useNavigate();
  return (
    <div className="pf-new-card" onClick={() => navigate("/studio")}>
      <div className="pf-new-cover">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        <span className="pf-new-cover-label">Yeni Eser</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ReadingListCard
══════════════════════════════════════════════════════════════════════════════ */
function ReadingListCard({ list, index, isOwner, onEdit, onDelete, onRemoveWork, onAdd, onNavigate }) {
  const [expanded,     setExpanded]     = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const workCount = list.works?.length ?? 0;
  const covers    = list.works?.slice(0, 4) || [];

  const alreadyInIds = (list.works || [])
    .map(item => String(item.work?._id || item.work || ""))
    .filter(Boolean);

  return (
    <>
      <div className="pf-list-card pf-list-card--full" style={{ animationDelay: `${index * 0.05}s` }}>

        <div className="pf-list-card-header" onClick={() => setExpanded(e => !e)}>

          <div className={`pf-list-covers ${covers.length <= 1 ? "pf-list-covers--single" : ""}`}>
            {covers.length === 0 ? (
              <div className="pf-list-cover-empty">✦</div>
            ) : (
              covers.map((item, i) => {
                const w = item.work ?? item;
                return w?.coverImage
                  ? <img key={i} src={w.coverImage} alt="" className="pf-list-cover-thumb" />
                  : <div key={i} className="pf-list-cover-empty">{w?.title?.slice(0, 1) ?? "?"}</div>;
              })
            )}
          </div>

          <div className="pf-list-info">
            <p className="pf-list-name">{list.name}</p>
            {list.description && <p className="pf-list-desc">{list.description}</p>}
            <div className="pf-list-meta">
              <span>{workCount} eser</span>
              <span className="pf-stat-sep">·</span>
              <span className="pf-list-privacy">{list.isPrivate ? "🔒 Gizli" : "🌐 Herkese açık"}</span>
            </div>
          </div>

          {isOwner && (
            <div className="pf-list-actions" onClick={e => e.stopPropagation()}>
              <button
                className="pf-list-action-btn pf-list-action-btn--add"
                onClick={() => setShowAddModal(true)}
                title="Kütüphaneden eser ekle"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button className="pf-list-action-btn" onClick={onEdit} title="Listeyi düzenle">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button className="pf-list-action-btn pf-list-action-btn--danger" onClick={onDelete} title="Listeyi sil">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          )}

          <div
            className="pf-list-expand-icon"
            style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {expanded && workCount > 0 && (
          <div className="pf-list-works">
            {list.works.map((item) => {
              const w   = item.work ?? item;
              const wId = w?._id || w?.id;
              return (
                <div key={wId} className="pf-list-work-row">
                  <div className="pf-list-work-cover-sm" onClick={() => onNavigate(`/story/${wId}`)}>
                    {w?.coverImage
                      ? <img src={w.coverImage} alt={w?.title} />
                      : <div className="pf-list-work-cover-sm-placeholder">{w?.title?.slice(0, 1) ?? "?"}</div>
                    }
                  </div>
                  <div className="pf-list-work-info" onClick={() => onNavigate(`/story/${wId}`)}>
                    <span className="pf-list-work-title">{w?.title ?? "Eser"}</span>
                    {w?.author && (
                      <span className="pf-list-work-author">{getUsername(w.author)}</span>
                    )}
                    {item.note && <span className="pf-list-work-note">"{item.note}"</span>}
                  </div>
                  {isOwner && (
                    <button
                      className="pf-list-work-remove"
                      onClick={() => onRemoveWork(wId)}
                      title="Listeden çıkar"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {expanded && workCount === 0 && (
          <div className="pf-list-empty-works">
            <p>Bu listede henüz eser yok.</p>
            {isOwner && (
              <button className="pf-list-empty-add-btn" onClick={() => setShowAddModal(true)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Kütüphaneden ekle
              </button>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddFromLibraryModal
          listId={list._id}
          listName={list.name}
          alreadyIn={alreadyInIds}
          onAdd={(workId, workObj) => {
            onAdd?.(list._id, workId, workObj);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ListFormModal
══════════════════════════════════════════════════════════════════════════════ */
function ListFormModal({ title, initial, onSubmit, onClose }) {
  const [name,      setName]      = useState(initial?.name        ?? "");
  const [desc,      setDesc]      = useState(initial?.description ?? "");
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate   ?? false);
  const [saving,    setSaving]    = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    await onSubmit(name.trim(), desc.trim(), isPrivate);
    setSaving(false);
  }

  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div className="pf-modal" onClick={e => e.stopPropagation()} style={{ minWidth: 360 }}>
        <h4 style={{ margin: "0 0 1.25rem", fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem" }}>
          {title}
        </h4>

        <div className="pf-form-group">
          <label className="pf-form-label">Liste Adı *</label>
          <input
            className="pf-form-input"
            type="text"
            placeholder="örn. Okumak İstediklerim"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="pf-form-group">
          <label className="pf-form-label">
            Açıklama{" "}
            <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>(opsiyonel)</span>
          </label>
          <textarea
            className="pf-form-textarea"
            placeholder="Bu liste ne için?"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <p className="pf-form-hint">{desc.length} / 500</p>
        </div>

        <div className="pf-form-group">
          <label className="pf-form-label">Gizlilik</label>
          <div className="pf-privacy-toggle">
            <button
              type="button"
              className={`pf-privacy-btn ${!isPrivate ? "pf-privacy-btn--active" : ""}`}
              onClick={() => setIsPrivate(false)}
            >
              🌐 Herkese Açık
            </button>
            <button
              type="button"
              className={`pf-privacy-btn ${isPrivate ? "pf-privacy-btn--active" : ""}`}
              onClick={() => setIsPrivate(true)}
            >
              🔒 Gizli
            </button>
          </div>
          <p className="pf-form-hint">
            {isPrivate ? "Yalnızca sen görebilirsin." : "Profiline gelen herkes görebilir."}
          </p>
        </div>

        <div className="pf-modal-actions">
          <button className="pf-btn pf-btn--ghost" onClick={onClose} disabled={saving}>
            Vazgeç
          </button>
          <button
            className="pf-btn pf-btn--primary"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? "Kaydediliyor…" : initial ? "Güncelle" : "Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QuoteCard
══════════════════════════════════════════════════════════════════════════════ */
const GENRE_COLORS = {
  "roman":       { bg: "#EAF0FB", fg: "#2553A0" },
  "hikaye":      { bg: "#F0EDFB", fg: "#5B35B0" },
  "şiir":        { bg: "#FBF0EA", fg: "#A05525" },
  "deneme":      { bg: "#EAFBF0", fg: "#1A7A3C" },
  "fantastik":   { bg: "#FBF0F5", fg: "#A0255A" },
  "bilim kurgu": { bg: "#EAF5FB", fg: "#155A8A" },
};

function QuoteCard({ quote, isOwner, onDelete }) {
  const navigate  = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [confirm,  setConfirm]  = useState(false);

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return; }
    setDeleting(true);
    try {
      await apiDelete(`/quotes/${quote._id}`);
      onDelete(quote._id);
    } catch {
      alert("Silinemedi.");
      setDeleting(false);
      setConfirm(false);
    }
  }

  const gc = GENRE_COLORS[quote.genre?.toLowerCase()] || { bg: "#F2EDEA", fg: "#5A4A3A" };

  return (
    <div className="pf-quote-card">
      <blockquote className="pf-quote-text">
        <svg className="pf-quote-mark" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
        {quote.text}
      </blockquote>

      <div className="pf-quote-source">
        <button
          className="pf-quote-work-link"
          onClick={() => quote.work && navigate(`/story/${quote.work}`)}
        >
          {quote.workTitle}
        </button>
        <span className="pf-quote-author">— {quote.authorName}</span>
      </div>

      <div className="pf-quote-footer">
        {quote.genre && quote.genre !== "belirtilmemiş" && (
          <span className="pf-quote-genre" style={{ background: gc.bg, color: gc.fg }}>
            {quote.genre}
          </span>
        )}
        {quote.tags?.map(tag => (
          <span key={tag} className="pf-quote-tag">#{tag}</span>
        ))}
        <span className="pf-quote-date">{timeAgo(quote.createdAt)}</span>
        {isOwner && (
          <button
            className={`pf-quote-delete ${confirm ? "pf-quote-delete--confirm" : ""}`}
            onClick={handleDelete}
            disabled={deleting}
            title={confirm ? "Emin misin? Tekrar tıkla." : "Alıntıyı kaldır"}
          >
            {deleting ? "…" : confirm ? "Evet, kaldır" : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QuotesTab
══════════════════════════════════════════════════════════════════════════════ */
function QuotesTab({ isOwner, userId }) {
  const [quotes,  setQuotes]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total,   setTotal]   = useState(0);
  const [filter,  setFilter]  = useState("");
  const LIMIT = 12;

  const load = useCallback(async (p = 1, reset = false, genreFilter = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (genreFilter) params.set("genre", genreFilter);
      const endpoint = isOwner
        ? `/quotes/my?${params}`
        : `/quotes/user/${userId}?${params}`;
      const res   = await apiGet(endpoint);
      const items = res.items ?? [];
      setQuotes(prev => reset ? items : [...prev, ...items]);
      setTotal(res.total ?? 0);
      setHasMore(items.length === LIMIT);
      setPage(p);
    } catch {
      // sessiz hata
    } finally {
      setLoading(false);
    }
  }, [isOwner, userId]);

  useEffect(() => {
    load(1, true, filter);
  }, [load, filter]);

  function handleDelete(id) {
    setQuotes(prev => prev.filter(q => q._id !== id));
    setTotal(t => t - 1);
  }

  const GENRE_FILTERS = ["", "roman", "hikaye", "şiir", "deneme", "fantastik", "bilim kurgu"];

  return (
    <div className="pf-quotes-section">
      {total >= 6 ? (
        <div className="pf-quotes-filters">
          {GENRE_FILTERS.map(g => (
            <button
              key={g || "all"}
              className={`pf-quotes-filter-btn ${filter === g ? "pf-quotes-filter-btn--active" : ""}`}
              onClick={() => setFilter(g)}
            >
              {g || "Tümü"}
            </button>
          ))}
          <span className="pf-quotes-total">{total} alıntı</span>
        </div>
      ) : total > 0 ? (
        <p className="pf-quotes-count-small">{total} alıntı</p>
      ) : null}

      {loading && quotes.length === 0 ? (
        <div className="pf-empty">
          <div className="pf-splash-ring" style={{ width: 28, height: 28, borderWidth: 2 }} />
        </div>
      ) : quotes.length === 0 ? (
        <div className="pf-empty">
          <span className="pf-empty-icon">❝</span>
          <p>
            {filter
              ? `"${filter}" türünde kayıtlı alıntı yok.`
              : isOwner
                ? "Henüz alıntı kaydetmedin. Okurken beğendiğin satırı seç, \"Alıntıla ✦\" butonuna tıkla."
                : "Bu kullanıcının henüz paylaşılan alıntısı yok."
            }
          </p>
        </div>
      ) : (
        <>
          <div className="pf-quotes-grid">
            {quotes.map(q => (
              <QuoteCard key={q._id} quote={q} isOwner={isOwner} onDelete={handleDelete} />
            ))}
          </div>
          {hasMore && (
            <button
              className="pf-load-more"
              onClick={() => load(page + 1, false, filter)}
              disabled={loading}
            >
              {loading ? "Yükleniyor…" : "Daha fazla göster"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AvatarModal
══════════════════════════════════════════════════════════════════════════════ */
function AvatarModal({ hasAvatar, uploading, onUpload, onDelete, onClose }) {
  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div className="pf-modal pf-modal--sm" onClick={e => e.stopPropagation()}>
        <h4>Profil Fotoğrafı</h4>
        <div className="pf-avatar-modal-actions">
          <label className="pf-avatar-modal-btn">
            <input type="file" accept="image/*" hidden onChange={onUpload} disabled={uploading} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploading ? "Yükleniyor…" : "Fotoğraf Yükle"}
          </label>
          {hasAvatar && (
            <button className="pf-avatar-modal-btn pf-avatar-modal-btn--danger" onClick={onDelete}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Fotoğrafı Kaldır
            </button>
          )}
          <button className="pf-avatar-modal-btn pf-avatar-modal-btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FollowModal
══════════════════════════════════════════════════════════════════════════════ */
function FollowModal({ title, userIds, onClose }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userIds?.length) { setLoading(false); return; }
    const ids = userIds.map(u => u?._id || u?.id || u);
    Promise.all(ids.map(id => apiGet(`/public/profile/${id}`)))
      .then(results => setUsers(results.map(r => r.user).filter(Boolean)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userIds]);

  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div
        className="pf-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "70vh", overflowY: "auto", minWidth: 320 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h4 style={{ margin: 0 }}>{title}</h4>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--ink-3)" }}
          >
            ✕
          </button>
        </div>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--ink-4)", fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem" }}>
            Yükleniyor…
          </p>
        ) : users.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--ink-4)", fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem" }}>
            Henüz kimse yok.
          </p>
        ) : (
          users.map(u => (
            <div
              key={u._id}
              onClick={() => { navigate(`/profile/${u._id}`); onClose(); }}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.6rem 0", borderBottom: "1px solid var(--border)", cursor: "pointer",
              }}
            >
              {u.avatarUrl
                ? <img src={u.avatarUrl} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                : (
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", background: "var(--bg-2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700,
                    color: "var(--ink-3)", flexShrink: 0,
                  }}>
                    {(getUsername(u) || "?")[0].toUpperCase()}
                  </div>
                )
              }
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", color: "var(--ink)" }}>
                {getUsername(u)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ConfirmModal
══════════════════════════════════════════════════════════════════════════════ */
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="pf-modal-overlay" onClick={onCancel}>
      <div className="pf-modal" onClick={e => e.stopPropagation()}>
        <h4>{title}</h4>
        <p>{message}</p>
        <div className="pf-modal-actions">
          <button className="pf-btn pf-btn--ghost" onClick={onCancel}>Vazgeç</button>
          <button
            className={`pf-btn ${danger ? "pf-btn--danger" : "pf-btn--primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANA SAYFA
══════════════════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const { id: routeId } = useParams();
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();

  const currentUser = getCurrentUser();
  const myId        = currentUser?._id || currentUser?.id;
  const viewingOwn  = !routeId || routeId === "me" || String(routeId) === String(myId);
  const targetId    = viewingOwn ? myId : routeId;

  const bannerInputRef = useRef(null);

  /* Veri */
  const [profile,      setProfile]      = useState(null);
  const [works,        setWorks]        = useState([]);
  const [library,      setLibrary]      = useState([]);
  const [readingLists, setReadingLists] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  /* UI */
  const [activeTab,     setActiveTab]     = useState("log");
  const [isOwner,       setIsOwner]       = useState(false);
  const [isFollowing,   setIsFollowing]   = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [modal,         setModal]         = useState(null);
  const [followModal,   setFollowModal]   = useState(null);
  const [avatarModal,   setAvatarModal]   = useState(false);
  const [listModal,     setListModal]     = useState(null);
  const [reportModal,   setReportModal]   = useState(null);

  /* Profil düzenleme */
  const [editUsername,  setEditUsername]  = useState("");
  const [editBio,       setEditBio]       = useState("");
  const [editLocation,  setEditLocation]  = useState("");
  const [editWebsite,   setEditWebsite]   = useState("");
  const [editSaving,    setEditSaving]    = useState(false);
  const [editMsg,       setEditMsg]       = useState(null);

  /* Upload */
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  /* ── Veri yükle ── */
  useEffect(() => {
    if (!targetId) { setError("Kullanıcı bulunamadı."); setLoading(false); return; }

    (async () => {
      try {
        setLoading(true);
        setError("");

        if (viewingOwn) {
          setIsOwner(true);
          const [profileRes, worksRes, libRes, listRes] = await Promise.allSettled([
            apiGet("/user/profile"),
            apiGet("/user/works"),
            apiGet("/library"),
            apiGet("/user/reading-lists"),
          ]);

          if (profileRes.status === "fulfilled") setProfile(profileRes.value.user);
          if (worksRes.status   === "fulfilled") setWorks(worksRes.value.items || []);
          if (libRes.status     === "fulfilled") setLibrary(libRes.value.items || libRes.value.works || []);
          if (listRes.status    === "fulfilled") setReadingLists(listRes.value.items || []);
        } else {
          const [profileRes, worksRes, listRes] = await Promise.all([
            apiGet(`/public/profile/${targetId}`),
            apiGet(`/public/profile/${targetId}/works`),
            apiGet(`/public/profile/${targetId}/reading-lists`).catch(() => ({ items: [] })),
          ]);
          setProfile(profileRes.user);
          setWorks(worksRes.items || []);
          setReadingLists((listRes.items || []).filter(l => !l.isPrivate));
          setIsOwner(false);
          setIsFollowing(profileRes.user?.isFollowedByMe || false);
        }
      } catch (e) {
        console.error("Profil yükleme hatası:", e);
        setError("Profil yüklenemedi veya böyle bir kullanıcı yok.");
      } finally {
        setLoading(false);
      }
    })();
  }, [viewingOwn, targetId]);

  useEffect(() => {
    if (!profile) return;
    setEditUsername(getUsername(profile));
    setEditBio(profile.bio         ?? "");
    setEditLocation(profile.location ?? "");
    setEditWebsite(profile.website   ?? "");
  }, [profile]);

  function handleLogout() {
    clearAuth();
    window.location.href = "/login";
  }

  async function handleFollow() {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const profileId = profile._id || profile.id;
      const res = await apiPost(`/public/profile/${profileId}/follow`);
      setIsFollowing(res.following);
      setProfile(prev => ({
        ...prev,
        followerCount: res.followerCount,
        followers: res.followers ?? prev.followers,
      }));
    } catch { alert("İşlem başarısız."); }
    finally { setFollowLoading(false); }
  }

  function handleDeleteWork(workId) { setModal({ type: "deleteWork", id: workId }); }
  async function confirmDeleteWork() {
    const workId = modal.id;
    setModal(null);
    try {
      await apiDelete(`/works/${workId}`);
      setWorks(prev => prev.filter(w => (w._id || w.id) !== workId));
    } catch { alert("Silinemedi."); }
  }

  async function handleCreateList(name, description, isPrivate) {
    try {
      const res = await apiPost("/reading-lists", { name, description, isPrivate });
      setReadingLists(prev => [res.list, ...prev]);
      setListModal(null);
    } catch (e) { alert(e.message || "Liste oluşturulamadı."); }
  }

  async function handleUpdateList(listId, data) {
    try {
      const res = await apiPatch(`/reading-lists/${listId}`, data);
      setReadingLists(prev => prev.map(l => l._id === listId ? res.list : l));
      setListModal(null);
    } catch (e) { alert(e.message || "Güncellenemedi."); }
  }

  async function handleDeleteList(listId) {
    try {
      await apiDelete(`/reading-lists/${listId}`);
      setReadingLists(prev => prev.filter(l => l._id !== listId));
      setListModal(null);
    } catch (e) { alert(e.message || "Silinemedi."); }
  }

  async function handleAddToList(listId, workId, workObj) {
    try {
      await apiPost(`/reading-lists/${listId}/works`, { workId });
      setReadingLists(prev => prev.map(l => {
        if (l._id !== listId) return l;
        const already = (l.works || []).some(
          w => String(w.work?._id || w.work) === String(workId)
        );
        if (already) return l;
        const resolved = workObj
          || library.find(w => String(w._id || w.id) === String(workId))
          || { _id: workId };
        const newEntry = { work: resolved, addedAt: new Date().toISOString(), note: "" };
        return { ...l, works: [...(l.works || []), newEntry] };
      }));
    } catch (e) { alert(e.message || "Eser eklenemedi."); }
  }

  async function handleRemoveFromList(listId, workId) {
    try {
      await apiDelete(`/reading-lists/${listId}/works/${workId}`);
      setReadingLists(prev => prev.map(l => {
        if (l._id !== listId) return l;
        return {
          ...l,
          works: l.works.filter(w => String(w.work?._id || w.work) !== String(workId)),
        };
      }));
    } catch (e) { alert(e.message || "Çıkarılamadı."); }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Dosya 5 MB'dan küçük olmalı."); return; }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch(`${API_BASE}/user/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Yükleme başarısız.");
      const data = await res.json();
      setProfile(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      setAvatarModal(false);
    } catch (err) { alert(err.message); }
    finally { setAvatarUploading(false); }
  }

  async function handleDeleteAvatar() {
    try {
      await apiDelete("/user/avatar");
      setProfile(prev => ({ ...prev, avatarUrl: "" }));
      setAvatarModal(false);
    } catch (err) { alert("Silinemedi: " + err.message); }
  }

  async function handleBannerUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Banner 10 MB'dan küçük olmalı."); return; }
    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append("banner", file);
      const res = await fetch(`${API_BASE}/user/banner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Yükleme başarısız.");
      const data = await res.json();
      setProfile(prev => ({ ...prev, bannerImage: data.bannerImage }));
    } catch (err) { alert(err.message); }
    finally { setBannerUploading(false); }
  }

  async function handleDeleteBanner() {
    if (!window.confirm("Kapak fotoğrafını kaldırmak istiyor musun?")) return;
    try {
      await apiDelete("/user/banner");
      setProfile(prev => ({ ...prev, bannerImage: "" }));
    } catch (err) { alert("Silinemedi: " + err.message); }
  }

  async function handleSaveProfile() {
    if (!editUsername.trim()) {
      setEditMsg({ ok: false, text: "Kullanıcı adı boş olamaz." }); return;
    }
    if (/[^a-zA-Z0-9_çÇğĞıİöÖşŞüÜ]/.test(editUsername)) {
      setEditMsg({ ok: false, text: "Kullanıcı adında geçersiz karakter var." }); return;
    }

    setEditSaving(true);
    setEditMsg(null);

    const payload = {
      kullaniciAdi: editUsername.trim(),
      username:     editUsername.trim(),
      bio:          editBio.trim(),
      location:     editLocation.trim(),
      website:      editWebsite.trim(),
    };

    try {
      const res = await apiPatch("/user/profile", payload);
      const serverUser = res?.user || res?.data || (res?.kullaniciAdi || res?.username ? res : null);
      const newUsername = getUsername(serverUser) || editUsername.trim();

      setProfile(prev => ({
        ...prev,
        kullaniciAdi: newUsername,
        username:     newUsername,
        bio:          serverUser?.bio      ?? editBio.trim(),
        location:     serverUser?.location ?? editLocation.trim(),
        website:      serverUser?.website  ?? editWebsite.trim(),
      }));

      setEditUsername(newUsername);
      setEditBio(serverUser?.bio           ?? editBio.trim());
      setEditLocation(serverUser?.location ?? editLocation.trim());
      setEditWebsite(serverUser?.website   ?? editWebsite.trim());

      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem("user", JSON.stringify({
            ...parsed,
            kullaniciAdi: newUsername,
            username:     newUsername,
          }));
        }
      } catch { /* kritik değil */ }

      setEditMsg({ ok: true, text: "Kaydedildi ✓" });
    } catch (e) {
      setEditMsg({ ok: false, text: e.message || "Kaydedilemedi." });
    } finally {
      setEditSaving(false);
      setTimeout(() => setEditMsg(null), 3000);
    }
  }

  /* ─── Türetilmiş değerler ─── */
  const published  = works.filter(w => w.status === "published");
  const drafts     = works.filter(w => w.status !== "published");
  const totalWords = works.reduce((s, w) => s + (w.totalWords || 0), 0);
  const totalViews = works.reduce((s, w) => s + (w.stats?.views || 0), 0);

  const displayWorks = isOwner ? works : published;

  const displayName = profile
    ? (getUsername(profile) || "?")
    : "?";

  const followerCount  = profile?.followers?.length  ?? profile?.followerCount  ?? 0;
  const followingCount = profile?.following?.length  ?? profile?.followingCount ?? 0;

  const visibleReadingLists = isOwner
    ? readingLists
    : readingLists.filter(l => !l.isPrivate);

  if (loading) return (
    <div className="pf-splash"><div className="pf-splash-ring" /><span>Yükleniyor…</span></div>
  );
  if (error) return (
    <div className="pf-splash pf-splash--err">
      <span>⚠ {error}</span>
      <button onClick={() => navigate("/")}>Ana Sayfaya Dön</button>
    </div>
  );

  return (
    <div className="pf-root">
      <TopBar />

      {/* ── Banner ── */}
      <div className="pf-banner-wrap">
        {profile?.bannerImage
          ? <img src={profile.bannerImage} alt="" className="pf-banner-img" />
          : <div className="pf-banner-placeholder" />
        }
        {isOwner && (
          <div className="pf-banner-actions">
            {profile?.bannerImage && (
              <button className="pf-banner-btn pf-banner-btn--danger" onClick={handleDeleteBanner} title="Kaldır">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
            <label className="pf-banner-btn">
              <input
                type="file"
                accept="image/*"
                hidden
                ref={bannerInputRef}
                onChange={handleBannerUpload}
                disabled={bannerUploading}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {bannerUploading ? "…" : "Kapak Değiştir"}
            </label>
          </div>
        )}
      </div>

      {/* ── Kimlik satırı ── */}
      <div className="pf-identity">
        <div className="pf-avatar-wrap">
          {profile?.avatarUrl
            ? <img src={profile.avatarUrl} alt={displayName} className="pf-avatar" />
            : <div className="pf-avatar-placeholder">{displayName.slice(0, 1).toUpperCase()}</div>
          }
          {isOwner && (
            <button
              className="pf-avatar-edit-btn"
              onClick={() => setAvatarModal(true)}
              title="Fotoğrafı düzenle"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>

        <div className="pf-name-block">
          <h1 className="pf-username" data-tour="profil-baslik">{displayName}</h1>
          <p className="pf-handle">@{displayName.toLowerCase()}</p>
        </div>

        <div className="pf-header-actions">
          {isOwner ? (
            <>
              <button className="pf-btn pf-btn--ghost" onClick={() => setActiveTab("edit")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Düzenle
              </button>
              <button className="pf-btn pf-btn--ghost" onClick={() => navigate("/ayarlar")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Ayarlar
              </button>
              <button className="pf-btn pf-btn--logout" onClick={() => setModal({ type: "logout" })}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Çıkış
              </button>
            </>
          ) : (
            <>
              <button
                className={`pf-btn ${isFollowing ? "pf-btn--follow-active" : "pf-btn--primary"}`}
                onClick={handleFollow}
                disabled={followLoading}
              >
                {isFollowing ? "Takip Ediliyor" : "Takip Et"}
              </button>
              <button
                className="pf-btn pf-btn--ghost"
                onClick={() => setReportModal({
                  targetType: "user",
                  targetId:   profile._id || profile.id,
                  targetName: displayName,
                })}
                title="Bu kullanıcıyı şikayet et"
                style={{ color: "var(--ink-4)", fontSize: ".78rem" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                Şikayet Et
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Ana İçerik ── */}
      <main className="pf-main">

        <div className="pf-info-row">
          <div className="pf-bio">
            <p className={!profile?.bio ? "pf-bio-empty" : ""}>
              {profile?.bio || "Henüz bir biyografi eklenmemiş."}
            </p>
            <div className="pf-bio-meta">
              {profile?.location && (
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {profile.location}
                </span>
              )}
              {profile?.website && (
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                  >
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                </span>
              )}
              {profile?.createdAt && (
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {joinDate(profile.createdAt)} tarihinden beri
                </span>
              )}
            </div>
          </div>

          <div className="pf-stats-row">
            <div className="pf-stat">
              <span className="pf-stat-num">{published.length}</span>
              <span className="pf-stat-label">Eser</span>
            </div>
            {isOwner && totalWords > 0 && (
              <div className="pf-stat">
                <span className="pf-stat-num">{fmtNum(totalWords)}</span>
                <span className="pf-stat-label">Kelime</span>
              </div>
            )}
            {isOwner && totalViews > 0 && (
              <div className="pf-stat">
                <span className="pf-stat-num">{fmtNum(totalViews)}</span>
                <span className="pf-stat-label">Okunma</span>
              </div>
            )}
            <div
              className="pf-stat pf-stat--clickable"
              onClick={() => followerCount > 0 && setFollowModal("followers")}
            >
              <span className="pf-stat-num">{fmtNum(followerCount)}</span>
              <span className="pf-stat-label">Takipçi</span>
            </div>
            <div
              className="pf-stat pf-stat--clickable"
              onClick={() => followingCount > 0 && setFollowModal("following")}
            >
              <span className="pf-stat-num">{fmtNum(followingCount)}</span>
              <span className="pf-stat-label">Takip</span>
            </div>
          </div>
        </div>

        {/* ── Sekmeler ── */}
        <div className="pf-tabs">
          <button
            className={`pf-tab ${activeTab === "log" ? "active" : ""}`}
            onClick={() => setActiveTab("log")}
            data-tour="profil-log-tab"
          >
            Günlük
          </button>
          <button
            className={`pf-tab ${activeTab === "works" ? "active" : ""}`}
            onClick={() => setActiveTab("works")}
          >
            Eserler
          </button>
          {isOwner && (
            <button
              className={`pf-tab ${activeTab === "drafts" ? "active" : ""}`}
              onClick={() => setActiveTab("drafts")}
            >
              Taslaklar
              {drafts.length > 0 && <span className="pf-tab-badge">{drafts.length}</span>}
            </button>
          )}
          {isOwner && (
            <button
              className={`pf-tab ${activeTab === "library" ? "active" : ""}`}
              onClick={() => setActiveTab("library")}
            >
              Kütüphanem
              {library.length > 0 && <span className="pf-tab-badge">{library.length}</span>}
            </button>
          )}
          {(isOwner || visibleReadingLists.length > 0) && (
            <button
              className={`pf-tab ${activeTab === "lists" ? "active" : ""}`}
              onClick={() => setActiveTab("lists")}
              data-tour="profil-okuma-tab"
            >
              Okuma Listeleri
              {visibleReadingLists.length > 0 && (
                <span className="pf-tab-badge">{visibleReadingLists.length}</span>
              )}
            </button>
          )}
          <button
            className={`pf-tab ${activeTab === "quotes" ? "active" : ""}`}
            onClick={() => setActiveTab("quotes")}
            data-tour="profil-alinti-tab"
          >
            {isOwner ? "Alıntılarım" : "Alıntılar"}
          </button>
          <button
            className={`pf-tab ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
          >
            {isOwner ? "Profili Düzenle" : "Hakkında"}
          </button>
        </div>

        {activeTab === "log" && (
          <LogTab userId={targetId} isOwner={isOwner} works={works} />
        )}

        {activeTab === "works" && (
          displayWorks.length === 0 && !isOwner ? (
            <div className="pf-empty">
              <span className="pf-empty-icon">📖</span>
              <p>Bu yazar henüz bir eser yayınlamamış.</p>
            </div>
          ) : (
            <div className="pf-grid">
              {isOwner && <NewWorkCard />}
              {displayWorks.map((w, i) => (
                <WorkCard
                  key={w._id || w.id}
                  work={w}
                  isOwner={isOwner}
                  index={i}
                  onDelete={handleDeleteWork}
                  onReport={(data) => setReportModal(data)}
                />
              ))}
            </div>
          )
        )}

        {activeTab === "drafts" && isOwner && (
          drafts.length === 0 ? (
            <div className="pf-empty">
              <span className="pf-empty-icon">✏️</span>
              <p>Henüz taslak yok.</p>
            </div>
          ) : (
            <div className="pf-grid">
              {drafts.map((w, i) => (
                <WorkCard
                  key={w._id || w.id}
                  work={w}
                  isOwner={true}
                  index={i}
                  onDelete={handleDeleteWork}
                />
              ))}
            </div>
          )
        )}

        {activeTab === "library" && isOwner && (
          library.length === 0 ? (
            <div className="pf-empty">
              <span className="pf-empty-icon">📚</span>
              <p>Kütüphanene henüz eser eklemedin.</p>
            </div>
          ) : (
            <div className="pf-grid">
              {library.map((w, i) => (
                <LibraryCard key={w._id || w.id} work={w} index={i} />
              ))}
            </div>
          )
        )}

        {activeTab === "lists" && (
          <>
            <div className="pf-lists-header">
              <h3>{isOwner ? "Okuma Listelerim" : "Okuma Listeleri"}</h3>
              {isOwner && (
                <button className="pf-btn pf-btn--ghost" onClick={() => setListModal("create")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  Yeni Liste
                </button>
              )}
            </div>
            {visibleReadingLists.length === 0 ? (
              <div className="pf-empty">
                <span className="pf-empty-icon">📚</span>
                <p>
                  {isOwner
                    ? "Henüz bir okuma listesi oluşturmadın."
                    : "Görüntülenecek okuma listesi yok."}
                </p>
              </div>
            ) : (
              <div className="pf-reading-lists">
                {visibleReadingLists.map((l, i) => (
                  <ReadingListCard
                    key={l._id}
                    list={l}
                    index={i}
                    isOwner={isOwner}
                    onEdit={() => setListModal({ type: "edit", list: l })}
                    onDelete={() => setListModal({ type: "delete", list: l })}
                    onAdd={(listId, workId, workObj) => handleAddToList(listId, workId, workObj)}
                    onRemoveWork={(workId) => handleRemoveFromList(l._id, workId)}
                    onNavigate={navigate}
                  />
                ))}
              </div>
            )}
            {listModal === "create" && (
              <ListFormModal
                title="Yeni Okuma Listesi"
                onSubmit={handleCreateList}
                onClose={() => setListModal(null)}
              />
            )}
            {listModal?.type === "edit" && (
              <ListFormModal
                title="Listeyi Düzenle"
                initial={listModal.list}
                onSubmit={(name, desc, priv) =>
                  handleUpdateList(listModal.list._id, { name, description: desc, isPrivate: priv })
                }
                onClose={() => setListModal(null)}
              />
            )}
            {listModal?.type === "delete" && (
              <ConfirmModal
                title="Listeyi Sil"
                message={`"${listModal.list.name}" listesini kalıcı olarak silmek istediğine emin misin?`}
                confirmLabel="Evet, Sil"
                danger
                onConfirm={() => handleDeleteList(listModal.list._id)}
                onCancel={() => setListModal(null)}
                   />
            )}
          </>
        )}

        {activeTab === "quotes" && (
          <QuotesTab isOwner={isOwner} userId={targetId} />
        )}

        {activeTab === "edit" && (
          isOwner ? (
            <div className="pf-edit-section">
              <h3>Profil Bilgileri</h3>
              <div className="pf-form-group">
                <label className="pf-form-label">Kullanıcı Adı</label>
                <input
                  className="pf-form-input"
                  type="text"
                  placeholder="yazaradi"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                />
                <p className="pf-form-hint">Harf, rakam, _ ve Türkçe karakter kullanılabilir.</p>
              </div>
              <div className="pf-form-group">
                <label className="pf-form-label">Biyografi</label>
                <textarea
                  className="pf-form-textarea"
                  placeholder="Kendinizi kısaca tanıtın…"
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  maxLength={300}
                />
                <p className="pf-form-hint">{editBio.length} / 300</p>
              </div>
              <div className="pf-form-group">
                <label className="pf-form-label">Şehir / Konum</label>
                <input
                  className="pf-form-input"
                  type="text"
                  placeholder="İstanbul, Türkiye"
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                />
              </div>
              <div className="pf-form-group">
                <label className="pf-form-label">Web Sitesi</label>
                <input
                  className="pf-form-input"
                  type="url"
                  placeholder="https://örnek.com"
                  value={editWebsite}
                  onChange={e => setEditWebsite(e.target.value)}
                />
              </div>
              <div className="pf-form-actions">
                <button
                  className="pf-btn pf-btn--primary"
                  onClick={handleSaveProfile}
                  disabled={editSaving}
                >
                  {editSaving ? "Kaydediliyor…" : "Kaydet"}
                </button>
                {editMsg && (
                  <span className={`pf-save-msg ${editMsg.ok ? "pf-save-msg--ok" : "pf-save-msg--err"}`}>
                    {editMsg.text}
                  </span>
                )}
              </div>
              <div className="pf-edit-settings-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Şifre, e-posta ve hesap güvenliği için{" "}
                <button className="pf-link-btn" onClick={() => navigate("/ayarlar")}>
                  Ayarlar sayfasına git
                </button>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 520 }}>
              <p style={{
                fontFamily: "'Lora', serif", fontSize: ".93rem",
                color: "var(--ink-2)", fontStyle: "italic", lineHeight: 1.7,
              }}>
                {profile?.bio || "Bu yazar hakkında henüz bir bilgi yok."}
              </p>
            </div>
          )
        )}

        <div className="pf-page-footer"><p>Her kalem bir hikâye taşır.</p></div>
      </main>

      <Footer />

      {/* ════ MODALLER ════ */}
      {avatarModal && (
        <AvatarModal
          hasAvatar={!!profile?.avatarUrl}
          uploading={avatarUploading}
          onUpload={handleAvatarUpload}
          onDelete={() => { setAvatarModal(false); setModal({ type: "deleteAvatar" }); }}
          onClose={() => setAvatarModal(false)}
        />
      )}

      {followModal && (
        <FollowModal
          title={followModal === "followers" ? "Takipçiler" : "Takip Edilenler"}
          userIds={followModal === "followers" ? profile?.followers : profile?.following}
          onClose={() => setFollowModal(null)}
        />
      )}

      {reportModal && (
        <ReportModal
          targetType={reportModal.targetType}
          targetId={reportModal.targetId}
          targetName={reportModal.targetName}
          onClose={() => setReportModal(null)}
        />
      )}

      {modal?.type === "logout" && (
        <ConfirmModal
          title="Çıkış Yapılıyor"
          message="Hesabından çıkmak istediğine emin misin?"
          confirmLabel="Çıkış Yap"
          onConfirm={handleLogout}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "deleteWork" && (
        <ConfirmModal
          title="Eseri Sil"
          message="Bu eseri kalıcı olarak silmek istediğine emin misin? Tüm bölümler de silinecek."
          confirmLabel="Evet, Sil"
          danger
          onConfirm={confirmDeleteWork}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "deleteAvatar" && (
        <ConfirmModal
          title="Fotoğrafı Kaldır"
          message="Profil fotoğrafını kaldırmak istediğine emin misin?"
          confirmLabel="Kaldır"
          danger
          onConfirm={handleDeleteAvatar}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}