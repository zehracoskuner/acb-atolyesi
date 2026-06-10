import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import "../styles/StoryDetailsPage.css";
import { apiGet, apiPost, apiDelete } from "../lib/api";
import { getProgressForStory, clearProgressForStory } from "../services/readingProgressService";

// clearProgressForStory serviste tanımlı değilse güvenli fallback
const safeClearProgress = typeof clearProgressForStory === "function"
  ? clearProgressForStory
  : () => Promise.resolve();
import "../styles/StoryDetailPageComments.css";
import ReportModal from "../components/ReportModal";

const API_BASE = import.meta.env?.VITE_API_URL ?? "/api";

/* ════════════════════════════
   HELPERS
════════════════════════════ */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

function getInitials(user) {
  const name = user?.kullaniciAdi || user?.username || "U";
  return name.slice(0, 2).toUpperCase();
}

function wordCount(text = "") {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/* ════════════════════════════
   SKELETON
════════════════════════════ */
function SkeletonHero() {
  return (
    <div className="sh-skeleton-hero">
      <div className="sh-skeleton-cover" />
      <div className="sh-skeleton-info">
        <div className="sh-skeleton-line sh-skeleton-badge" />
        <div className="sh-skeleton-line sh-skeleton-title" />
        <div className="sh-skeleton-line sh-skeleton-meta" />
        <div className="sh-skeleton-line sh-skeleton-btn" />
      </div>
    </div>
  );
}

/* ════════════════════════════
   AVATAR
════════════════════════════ */
const AVATAR_PALETTES = [
  { bg: "#F0E9FF", fg: "#5B21B6" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#ECFDF5", fg: "#065F46" },
  { bg: "#FFF1F2", fg: "#9F1239" },
  { bg: "#EFF6FF", fg: "#1E40AF" },
  { bg: "#FDF2F8", fg: "#86198F" },
];

function Avatar({ user, size = "md" }) {
  const init  = getInitials(user);
  const idx   = (init.charCodeAt(0) || 0) % AVATAR_PALETTES.length;
  const { bg, fg } = AVATAR_PALETTES[idx];
  const cls   = `sdp-avatar sdp-avatar--${size}`;

  if (user?.avatarUrl) {
    return (
      <div className={cls}>
        <img src={user.avatarUrl} alt={init} />
      </div>
    );
  }
  return (
    <div className={cls} style={{ background: bg, color: fg }}>
      {init}
    </div>
  );
}

/* ════════════════════════════
   COMMENT ITEM
════════════════════════════ */
function CommentItem({ comment, workId, currentUser, isReply = false, onReplyAdded, onDeleted }) {
  const [liked, setLiked] = useState(comment.isLiked ?? false);
  const [likeCount,  setLikeCount]  = useState(comment.likeCount ?? 0);
  const [replyOpen,  setReplyOpen]  = useState(false);
  const [collapsed,  setCollapsed]  = useState(true);
  const [replyText,  setReplyText]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");

  // Düzenle
  const [editOpen,   setEditOpen]   = useState(false);
  const [editText,   setEditText]   = useState(comment.content ?? "");
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState("");
  const editRef    = useRef(null);
  const textareaRef = useRef(null);

  // Sil
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // Şikayet
  const [reportOpen,   setReportOpen]   = useState(false);

  const [displayContent, setDisplayContent] = useState(comment.content ?? "");
  const [deleted,        setDeleted]        = useState(false);

  const isLoggedIn = !!currentUser;
  const isOwner    = isLoggedIn && (
    currentUser?.id  === comment.author?._id?.toString() ||
    currentUser?._id === comment.author?._id?.toString()
  );

  useEffect(() => {
    if (replyOpen && textareaRef.current) textareaRef.current.focus();
  }, [replyOpen]);

  useEffect(() => {
    if (editOpen) setTimeout(() => editRef.current?.focus(), 60);
  }, [editOpen]);

  /* ── Beğeni ── */
  async function handleLike() {
    if (!isLoggedIn) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => c + (wasLiked ? -1 : 1));
    try {
      const res = await apiPost(`/comments/${comment._id}/like`);
      if (typeof res.likeCount === "number") setLikeCount(res.likeCount);
      if (typeof res.liked    === "boolean") setLiked(res.liked);
    } catch {
      setLiked(wasLiked);
      setLikeCount(c => c + (wasLiked ? 1 : -1));
    }
  }

  /* ── Yanıt ── */
  async function submitReply() {
    if (!replyText.trim() || submitting) return;
    setReplyError("");
    setSubmitting(true);
    try {
      const res = await apiPost(`/comments/${workId}`, {
        content: replyText.trim(), workId, parentId: comment._id,
      });
      onReplyAdded?.(comment._id, res.item);
      setReplyText("");
      setReplyOpen(false);
      setCollapsed(false);
    } catch (err) {
      setReplyError(err.status === 403 ? "Yorum yapma yetkiniz kısıtlanmış." : "Yanıt gönderilemedi. Lütfen tekrar dene.");
    } finally { setSubmitting(false); }
  }

  /* ── Düzenle ── */
  async function saveEdit() {
    if (!editText.trim() || editSaving) return;
    if (editText.trim() === displayContent) { setEditOpen(false); return; }
    setEditError(""); setEditSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/comments/${comment._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDisplayContent(data.item?.content ?? editText.trim());
      setEditOpen(false);
    } catch {
      setEditError("Kaydedilemedi, tekrar dene.");
    } finally {
      setEditSaving(false);
    }
  }

  /* ── Sil ── */
  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/comments/${comment._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setDeleted(true);
      onDeleted?.(comment._id);
    } catch { setDeleteConfirm(false); } finally { setDeleting(false); }
  }

  /* ── Şikayet ── */

  if (deleted) return null;

  const replyCount = comment.replies?.length ?? 0;
  const authorName = comment.author?.kullaniciAdi || comment.author?.username || "Okuyucu";

  if (comment.isDeleted) {
  return (
    <div className={isReply ? "sdp-comment sdp-comment--reply" : "sdp-comment"}>
      <div className="sdp-comment-right">
        <p
          className="sdp-comment-text"
          style={{ opacity: .5, fontStyle: "italic" }}
        >
          [Bu yorum kaldırıldı]
        </p>

        {!isReply && !collapsed && replyCount > 0 && (
          <div className="sdp-replies">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply._id}
                comment={reply}
                workId={workId}
                currentUser={currentUser}
                isReply
                onDeleted={id => {
                  comment.replies = comment.replies.filter(r => r._id !== id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

  return (
    <div className={isReply ? "sdp-comment sdp-comment--reply" : "sdp-comment"}>
      <div className="sdp-comment-left">
        {comment.author?._id ? (
          <Link
            to={`/profile/${comment.author._id}`}
            className="sdp-comment-name sdp-comment-name--link"
          >
            <Avatar user={comment.author} size={isReply ? "sm" : "md"} />
          </Link>
        ) : (
          <Avatar user={comment.author} size={isReply ? "sm" : "md"} />
        )}
        {!isReply && replyCount > 0 && !collapsed && (
          <div className="sdp-comment-thread-line" />
        )}
      </div>

      <div className="sdp-comment-right">
        {/* ── Başlık ── */}
        <div className="sdp-comment-header">
          <span className="sdp-comment-name">{authorName}</span>
          <span className="sdp-comment-dot" aria-hidden="true">·</span>
          <time className="sdp-comment-time">{timeAgo(comment.createdAt)}</time>
          {comment.isEdited && <span className="sdp-comment-edited">(düzenlendi)</span>}

          {isLoggedIn && (
            <div className="sdp-comment-menu">
              <button
                className="sdp-action-btn sdp-menu-trigger"
                aria-label="Yorum seçenekleri"
                onClick={e => {
                  e.currentTarget.nextSibling.classList.toggle("sdp-menu-dropdown--open");
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                </svg>
              </button>
              <div className="sdp-menu-dropdown">
                {isOwner && (
                  <>
                    <button className="sdp-menu-item" onClick={() => {
                      setEditText(displayContent); setEditOpen(true); setEditError("");
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Düzenle
                    </button>
                    <button className="sdp-menu-item sdp-menu-item--danger"
                      onClick={() => setDeleteConfirm(true)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                      Sil
                    </button>
                  </>
                )}
                {!isOwner && (
                  <button className="sdp-menu-item sdp-menu-item--warn"
                    onClick={() => setReportOpen(true)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                      <line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                    Şikayet Et
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── İçerik veya düzenleme formu ── */}
        {editOpen ? (
          <div className="sdp-edit-form">
            <textarea
              ref={editRef}
              className="sdp-textarea sdp-textarea--sm"
              value={editText}
              onChange={e => setEditText(e.target.value.slice(0, 2000))}
              rows={3}
              onKeyDown={e => {
                if (e.key === "Enter" && e.ctrlKey) saveEdit();
                if (e.key === "Escape") setEditOpen(false);
              }}
            />
            {editError && <p className="sdp-form-error">{editError}</p>}
            <div className="sdp-form-actions" style={{ justifyContent: "flex-end", marginTop: 6 }}>
              <span style={{ fontSize: ".7rem", color: "var(--sdp-ink-faint)", marginRight: "auto" }}>
                {editText.length}/2000
              </span>
              <button className="sdp-btn sdp-btn--ghost"
                onClick={() => { setEditOpen(false); setEditError(""); }}>İptal</button>
              <button className="sdp-btn sdp-btn--primary sdp-btn--sm"
                onClick={saveEdit} disabled={editSaving || !editText.trim()}>
                {editSaving ? <span className="sdp-spinner sdp-spinner--sm" /> : "Kaydet"}
              </button>
            </div>
          </div>
        ) : (
          <p className="sdp-comment-text">{displayContent}</p>
        )}

        {/* ── Silme onayı ── */}
        {deleteConfirm && (
          <div className="sdp-confirm-bar">
            <span>Bu yorumu silmek istediğine emin misin?</span>
            <button className="sdp-btn sdp-btn--ghost" onClick={() => setDeleteConfirm(false)}>Vazgeç</button>
            <button className="sdp-btn sdp-btn--danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <span className="sdp-spinner sdp-spinner--sm" /> : "Evet, Sil"}
            </button>
          </div>
        )}

        {/* ── Şikayet formu ── */}
        {reportOpen && (
          <ReportModal
            isOpen={reportOpen}
            targetType="comment"
            targetId={comment._id}
            targetLabel={displayContent.slice(0, 60)}
            onClose={() => setReportOpen(false)}
          />
        )}
        
        {/* ── Aksiyon butonları ── */}
        {!editOpen && !deleteConfirm && !reportOpen && (
          <div className="sdp-comment-actions">
            <button
              className={`sdp-action-btn sdp-like-btn ${liked ? "sdp-like-btn--active" : ""}`}
              onClick={handleLike} disabled={!isLoggedIn}
              aria-label={liked ? "Beğeniyi geri al" : "Beğen"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24"
                fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span>{likeCount > 0 ? likeCount : "Beğen"}</span>
            </button>

            {!isReply && isLoggedIn && (
              <button className="sdp-action-btn" onClick={() => setReplyOpen(v => !v)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Cevapla</span>
              </button>
            )}

            {!isReply && replyCount > 0 && (
              <button className="sdp-action-btn sdp-expand-btn"
                onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform .2s" }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
                <span>{collapsed ? `${replyCount} yanıt` : "Yanıtları gizle"}</span>
              </button>
            )}
          </div>
        )}

        {/* ── Yanıt formu ── */}
        {replyOpen && (
          <div className="sdp-reply-form">
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={`${authorName}'e cevap ver…`}
              className="sdp-textarea sdp-textarea--sm"
              rows={2}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) submitReply(); }}
            />
            {replyError && <p className="sdp-form-error">{replyError}</p>}
            <div className="sdp-reply-form-actions">
              <button className="sdp-btn sdp-btn--ghost"
                onClick={() => { setReplyOpen(false); setReplyText(""); setReplyError(""); }}>İptal</button>
              <button className="sdp-btn sdp-btn--primary sdp-btn--sm"
                onClick={submitReply} disabled={submitting || !replyText.trim()}>
                {submitting ? <span className="sdp-spinner" aria-hidden="true" /> : "Gönder"}
              </button>
            </div>
          </div>
        )}

        {/* ── Yanıtlar ── */}
        {!isReply && !collapsed && replyCount > 0 && (
          <div className="sdp-replies">
            {comment.replies.map(reply => (
              <CommentItem key={reply._id} comment={reply} workId={workId}
                currentUser={currentUser} isReply
                onDeleted={id => {
                  // parent'ın replies listesinden çıkar
                  comment.replies = comment.replies.filter(r => r._id !== id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* ════════════════════════════
   COMMENT SECTION
════════════════════════════ */
function CommentSection({ workId, currentUser }) {
  const isLoggedIn                  = !!currentUser;
  const [comments,   setComments]   = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [hasMore,    setHasMore]    = useState(false);
  const [text,       setText]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const textareaRef                 = useRef(null);
  const LIMIT                       = 20;

  const load = useCallback(async (p = 1, reset = false) => {
    setLoading(true);
    try {
      const res   = await apiGet(`/comments/${workId}?page=${p}&limit=${LIMIT}`);
      const items = res.items ?? [];
      setComments(prev => reset ? items : [...prev, ...items]);
      setTotal(res.total ?? 0);
      setHasMore(items.length === LIMIT);
      setPage(p);
    } catch {
      // sessiz hata
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => { load(1, true); }, [load]);

  async function submitComment() {
    if (!text.trim() || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await apiPost(`/comments/${workId}`, { content: text.trim(), workId });
      setComments(prev => [res.item, ...prev]);
      setTotal(t => t + 1);
      setText("");
    } catch (err) {
      setError(err.status === 403 ? "Yorum yapma yetkiniz kısıtlanmış." : "Yorum gönderilemedi. Lütfen tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReplyAdded(parentId, newReply) {
    setComments(prev => prev.map(c =>
      c._id === parentId ? { ...c, replies: [...(c.replies ?? []), newReply] } : c
    ));
  }

  const remaining = 2000 - text.length;

  return (
    <section className="sdp-comments-section">
      <div className="sdp-comments-header">
        <h3 className="sdp-section-title">
          Yorumlar
          {total > 0 && <span className="sdp-count-badge">{total}</span>}
        </h3>
      </div>

      {isLoggedIn ? (
        <div className="sdp-composer">
          <Avatar user={currentUser} size="md" />
          <div className="sdp-composer-inner">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value.slice(0, 2000))}
              placeholder="Bu eser hakkında ne düşünüyorsun?"
              className="sdp-textarea"
              rows={3}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) submitComment(); }}
            />
            {error && <p className="sdp-form-error">{error}</p>}
            {text.length > 0 && (
              <div className="sdp-composer-footer">
                <span className={`sdp-char-hint ${remaining < 100 ? "sdp-char-hint--warn" : ""}`}>
                  {remaining} karakter kaldı · Ctrl+Enter
                </span>
                <div className="sdp-form-actions">
                  <button
                    className="sdp-btn sdp-btn--ghost"
                    onClick={() => { setText(""); setError(""); }}
                  >
                    Temizle
                  </button>
                  <button
                    className="sdp-btn sdp-btn--primary"
                    onClick={submitComment}
                    disabled={submitting || !text.trim()}
                  >
                    {submitting ? <span className="sdp-spinner" aria-hidden="true" /> : "Yorum Yap"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="sdp-login-prompt">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Yorum yapmak için <Link to="/login" className="sdp-login-link">giriş yap</Link></span>
        </div>
      )}

      <div className="sdp-comments-list">
        {loading && comments.length === 0 ? (
          <div className="sdp-comments-loading">
            {[1,2,3].map(i => (
              <div key={i} className="sdp-comment-skeleton">
                <div className="sdp-sk sdp-sk-avatar" />
                <div className="sdp-sk-lines">
                  <div className="sdp-sk sdp-sk-name" />
                  <div className="sdp-sk sdp-sk-text" />
                  <div className="sdp-sk sdp-sk-text sdp-sk-text--short" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="sdp-comments-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>Henüz yorum yok. İlk yorumu sen yaz!</p>
          </div>
        ) : (
          <>
            {comments.map(c => (
              
              <CommentItem
                key={c._id}
                comment={c}
                workId={workId}
                currentUser={currentUser}
                onReplyAdded={handleReplyAdded}
                onDeleted={id => {
                  setComments(prev => prev.filter(x => x._id !== id));
                  setTotal(t => t - 1);
                }}
              />
            ))}
            {hasMore && (
              <button
                className="sdp-load-more"
                onClick={() => load(page + 1)}
                disabled={loading}
              >
                {loading ? <span className="sdp-spinner" /> : "Daha fazla yorum"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ════════════════════════════
   COVER PLACEHOLDER
════════════════════════════ */
function CoverPlaceholder({ title }) {
  const initials = title?.slice(0, 2).toUpperCase() || "??";
  return (
    <div className="sdp-cover-placeholder">
      <span>{initials}</span>
    </div>
  );
}

/* ════════════════════════════
   CHAPTER ITEM
════════════════════════════ */
function ChapterItem({ chapter, index, workId, isCurrent, onClick }) {
  return (
    <div
      className={`sdp-chapter-item ${isCurrent ? "sdp-chapter-item--current" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={`${index + 1}. bölüm: ${chapter.title}`}
    >
      <span className="sdp-ch-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="sdp-ch-title">{chapter.title}</span>
      {isCurrent ? (
        <span className="sdp-ch-badge sdp-ch-badge--current">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Devam
        </span>
      ) : (
        <span className="sdp-ch-badge">Oku</span>
      )}
    </div>
  );
}

/* ════════════════════════════
   MAIN PAGE
════════════════════════════ */
export default function StoryDetailsPage() {
  const { workId }  = useParams();
  const navigate    = useNavigate();
  const currentUser = getCurrentUser();
  const userId      = currentUser?.id || currentUser?._id;
  const token       = localStorage.getItem("token");

  const [work,            setWork]            = useState(null);
  const [chapters,        setChapters]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [myWorkIds,       setMyWorkIds]       = useState(new Set());
  const [inLibrary,       setInLibrary]       = useState(false);
  const [libraryStatus,   setLibraryStatus]   = useState("idle");
  const [likeCount,       setLikeCount]       = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeStatus,      setLikeStatus]      = useState("idle");
  const [readingProgress, setReadingProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [heroImgLoaded,   setHeroImgLoaded]   = useState(false);

  // Eser + bölümler
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/public/works/${workId}`),
          fetch(`${API_BASE}/public/works/${workId}/chapters`),
        ]);
        if (!wRes.ok) throw new Error("Eser bulunamadı");
        const [wData, cData] = await Promise.all([wRes.json(), cRes.json()]);
        setWork(wData.item);
        setChapters(cData.items || []);
        setLikeCount(wData.item?.likeCount ?? 0);
      } catch {
        // hata: loading false
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workId]);

  // Okuma ilerlemesi
  useEffect(() => {
    if (!workId) return;
    setProgressLoading(true);
    getProgressForStory(workId, currentUser)
      .then(prog => {
        if (!prog) { setReadingProgress(null); return; }
        const chapterId = prog.chapterId || prog.chapter?._id || prog.chapter;
        if (chapterId) {
          setReadingProgress({
            chapterId:     String(chapterId),
            chapterTitle:  prog.chapterTitle  || prog.chapter?.title || null,
            chapterNumber: prog.chapterNumber || prog.chapter?.order || null,
            scrollPosition: prog.scrollPosition ?? 0,
          });
        } else {
          setReadingProgress(null);
        }
      })
      .catch(() => setReadingProgress(null))
      .finally(() => setProgressLoading(false));
  }, [workId]);

  // Kütüphane kontrolü
  useEffect(() => {
    if (!token || !workId) return;
    apiGet(`/library/check/${workId}`)
      .then(res => setInLibrary(res.inLibrary))
      .catch(() => {});
  }, [workId, token]);

  // Kendi eserleri
  useEffect(() => {
    if (!token) return;
    apiGet("/works")
      .then(res => {
        const ids = (res.items || []).map(w => String(w._id || w.id));
        setMyWorkIds(new Set(ids));
      })
      .catch(() => {});
  }, [workId, token]);

  // Beğeni durumu
  useEffect(() => {
    if (!token || !workId) return;
    apiGet(`/likes/check/${workId}`)
      .then(res => {
        setLiked(res.liked ?? false);
        if (typeof res.likeCount === "number") setLikeCount(res.likeCount);
      })
      .catch(() => {});
  }, [workId, token]);

  const handleToggleLibrary = async () => {
    if (!token) { navigate("/login"); return; }
    if (libraryStatus === "loading") return;
    setLibraryStatus("loading");
    try {
      if (inLibrary) {
        await apiDelete(`/library/${workId}`);
        setInLibrary(false);
      } else {
        await apiPost("/library", { workId });
        setInLibrary(true);
      }
    } catch {
      // sessiz hata
    } finally {
      setLibraryStatus("idle");
    }
  };

  const handleToggleLike = async () => {
    if (!token) { navigate("/login"); return; }
    if (likeStatus === "loading") return;
    setLikeStatus("loading");
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => c + (wasLiked ? -1 : 1));
    try {
      const res = wasLiked
        ? await apiDelete(`/likes/${workId}`)
        : await apiPost("/likes", { workId });
      if (typeof res.likeCount === "number") setLikeCount(res.likeCount);
      if (typeof res.liked    === "boolean") setLiked(res.liked);
    } catch {
      setLiked(wasLiked);
      setLikeCount(c => c + (wasLiked ? 1 : -1));
    } finally {
      setLikeStatus("idle");
    }
  };

  // — Baştan başla —
  const handleRestart = async () => {
    try {
      // Önce localStorage'dan sil (guest + giriş yapmış)
      const lsKey = `reading_progress_${workId}`;
      localStorage.removeItem(lsKey);
      // Backend'den de sil (giriş yapmışsa)
      if (token) {
        await safeClearProgress(workId, currentUser).catch(() => {});
      }
    } catch {
      // sessiz — navigate'i engelleme
    }
    // İlk bölüme git
    const firstChapterId = chapters[0]?._id;
    if (firstChapterId) {
      navigate(`/read/${workId}?chapter=${firstChapterId}`);
    } else {
      navigate(`/read/${workId}`);
    }
    setReadingProgress(null);
  };

  if (loading) {
    return (
      <div className="sh-root">
        <TopBar />
        <div className="sh-loading-state">
          <SkeletonHero />
        </div>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="sh-root">
        <TopBar />
        <div className="sh-error-state">
          <p>Eser bulunamadı.</p>
          <button className="sdp-btn sdp-btn--primary" onClick={() => navigate(-1)}>
            Geri Dön
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const isOwner = !!(
    userId && (
      myWorkIds.has(String(work._id || workId)) ||
      (work.author?._id && String(work.author._id) === String(userId))
    )
  );

  const genreLabel = Array.isArray(work.universe?.genres)
    ? work.universe.genres[0]
    : (work.universe?.genre || "Genel");

  const progressLabel = (() => {
    if (!readingProgress) return null;
    const { chapterTitle, chapterNumber, scrollPosition } = readingProgress;
    const bölümAdı = chapterTitle || (chapterNumber ? `Bölüm ${chapterNumber}` : "");
    const pct = scrollPosition > 0 ? ` · %${scrollPosition}` : "";
    return bölümAdı ? `${bölümAdı}${pct}` : null;
  })();

  const descWordCount = wordCount(work.preface || work.description || "");

  return (
    <div className="sh-root">
      <TopBar />

      {/* ── HERO ── */}
      <header className="sh-hero">
        {/* Blurry background */}
        <div className="sh-hero-backdrop">
          {work.coverImage && (
            <img
              src={work.coverImage}
              alt=""
              aria-hidden="true"
              className="sh-hero-backdrop-img"
            />
          )}
          <div className="sh-hero-backdrop-overlay" />
        </div>

        <div className="sh-hero-content">
          {/* Cover */}
          <div className="sh-cover-wrap">
            <div className={`sh-cover-shadow ${heroImgLoaded ? "sh-cover-shadow--visible" : ""}`} />
            {work.coverImage ? (
              <img
                src={work.coverImage}
                alt={work.title}
                className="sh-cover-img"
                onLoad={() => setHeroImgLoaded(true)}
              />
            ) : (
              <div className="sh-cover-img sh-cover-img--placeholder">
                <CoverPlaceholder title={work.title} />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="sh-info">
            <div className="sh-info-top">
              <span className="sh-genre-badge">{genreLabel}</span>
              {work.isAnonymous && (
                <span className="sh-anon-badge">Anonim</span>
              )}
            </div>

            <h1 className="sh-title">{work.title}</h1>

            <div className="sh-meta-row">
              {work.isAnonymous ? (
                <span className="sh-author-name">Anonim Yazar</span>
              ) : work.author?._id ? (
                <Link to={`/profile/${work.author._id}`} className="sh-author-chip">
                  <div className="sh-author-avatar">
                    {work.author.avatarUrl ? (
                      <img src={work.author.avatarUrl} alt={work.author.kullaniciAdi || work.author.username} />
                    ) : (
                      <span>{getInitials(work.author)}</span>
                    )}
                  </div>
                  <span className="sh-author-chip-name">
                    {work.author.kullaniciAdi || work.author.username || "Yazar"}
                  </span>
                </Link>
              ) : (
                <span className="sh-author-name">Bilinmeyen Yazar</span>
              )}
              <span className="sh-meta-sep" aria-hidden="true" />
              <span className="sh-meta-stat">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                {chapters.length} bölüm
              </span>
              <span className="sh-meta-sep" aria-hidden="true" />
              <span className="sh-meta-stat">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                {new Date(work.updatedAt).toLocaleDateString("tr-TR")}
              </span>
              {likeCount > 0 && (
                <>
                  <span className="sh-meta-sep" aria-hidden="true" />
                  <span className="sh-meta-stat">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    {likeCount.toLocaleString("tr-TR")}
                  </span>
                </>
              )}
            </div>

            {/* CTA Buttons */}
            <div className="sh-actions">
              {progressLoading ? (
                <div className="sh-btn-skeleton" aria-hidden="true" />
              ) : readingProgress ? (
                <div className="sh-continue-group">
                  <button
                    className="sh-btn-primary"
                    onClick={() => navigate(`/read/${workId}`)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Kaldığın Yerden Devam Et
                  </button>
                  {progressLabel && (
                    <span className="sh-continue-hint">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      </svg>
                      {progressLabel}
                    </span>
                  )}
                  <button
                    className="sh-btn-ghost-sm"
                    onClick={handleRestart}
                  >
                    Baştan Başla
                  </button>
                </div>
              ) : (
                <button
                  className="sh-btn-primary"
                  onClick={() => navigate(`/read/${workId}`)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  Okumaya Başla
                </button>
              )}

              {!isOwner && (
                <div className="sh-secondary-actions">
                  <button
                    className={`sh-icon-btn ${liked ? "sh-icon-btn--liked" : ""}`}
                    onClick={handleToggleLike}
                    disabled={likeStatus === "loading"}
                    aria-label={liked ? "Beğeniyi geri al" : "Beğen"}
                    title={liked ? "Beğeniyi geri al" : "Beğen"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24"
                      fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    {likeStatus === "loading" ? <span className="sdp-spinner sdp-spinner--sm" /> : likeCount > 0 ? likeCount : null}
                  </button>

                  <button
                    className={`sh-btn-secondary ${inLibrary ? "sh-btn-secondary--active" : ""}`}
                    onClick={handleToggleLibrary}
                    disabled={libraryStatus === "loading"}
                  >
                    {libraryStatus === "loading" ? (
                      <span className="sdp-spinner sdp-spinner--sm" aria-hidden="true" />
                    ) : inLibrary ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        Kütüphanede
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        Kütüphaneye Ekle
                      </>
                    )}
                  </button>
                </div>
              )}

              {isOwner && (
                <button
                  className="sh-btn-edit"
                  onClick={() => navigate(`/work/${workId}`)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Atölyede Düzenle
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="sh-main">
        <div className="sh-layout">

          {/* Sol kolon */}
          <div className="sh-col-left">
            <section className="sh-section">
              <div className="sh-section-head">
                <h2 className="sh-section-title">Tanıtım</h2>
                {descWordCount > 0 && (
                  <span className="sh-section-meta">{descWordCount} kelime</span>
                )}
              </div>
              <p className="sh-desc">
                {work.preface || work.description || (
                  <em style={{ opacity: 0.45 }}>Bu eser için henüz bir tanıtım yazısı girilmemiş.</em>
                )}
              </p>
            </section>

            <CommentSection workId={workId} currentUser={currentUser} />
          </div>

          {/* Sağ kolon */}
          <div className="sh-col-right">
            <section className="sh-section sh-section--toc">
              <div className="sh-section-head">
                <h2 className="sh-section-title">İçindekiler</h2>
                <span className="sh-section-meta">{chapters.length} bölüm</span>
              </div>

              {chapters.length === 0 ? (
                <div className="sh-toc-empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p>Henüz yayınlanmış bölüm yok.</p>
                </div>
              ) : (
                <div className="sh-chapter-list">
                  {chapters.map((ch, idx) => (
                    <ChapterItem
                      key={ch._id}
                      chapter={{ ...ch, title: work.customChapterTitles?.[ch._id] || ch.title }}
                      index={idx}
                      workId={workId}
                      isCurrent={readingProgress?.chapterId === String(ch._id)}
                      onClick={() => navigate(`/read/${workId}?chapter=${ch._id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}