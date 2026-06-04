// src/components/LogTab.jsx

import { useState, useEffect, useRef } from "react";
import { apiGet, apiPost, apiDelete } from "../lib/api";

const MAX_CHARS = 400;

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
  try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
}

const VIS = {
  public:    { icon: "🌐", label: "Herkese açık" },
  followers: { icon: "🔒", label: "Takipçiler" },
  private:   { icon: "👁",  label: "Sadece ben" },
};

/* ── Yorum bölümü ── */
function CommentSection({ logId, isLoggedIn, logAuthorId }) {
  const [comments,  setComments]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [open,      setOpen]      = useState(false);
  const [text,      setText]      = useState("");
  const [posting,   setPosting]   = useState(false);
  const [error,     setError]     = useState("");
  const currentUser = getCurrentUser();
  const myId = currentUser?._id || currentUser?.id;

  async function loadComments() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiGet(`/logs/${logId}/comments`);
      setComments(res.items || []);
    } catch { /* sessizce geç */ }
    finally { setLoading(false); }
  }

  function handleToggle() {
    if (!open && comments.length === 0) loadComments();
    setOpen(v => !v);
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    setError("");
    try {
      const res = await apiPost(`/logs/${logId}/comments`, { content: text.trim() });
      setComments(prev => [...prev, res.item]);
      setText("");
    } catch (e) {
      setError(e.message || "Gönderilemedi.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId) {
    try {
      await apiDelete(`/logs/${logId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (e) { alert("Silinemedi: " + e.message); }
  }

  return (
    <div className="log-comments">
      <button className="log-comment-toggle" onClick={handleToggle}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {open ? "Yorumları gizle" : `Yorumlar${comments.length > 0 ? ` (${comments.length})` : ""}`}
      </button>

      {open && (
        <div className="log-comment-section">
          {loading ? (
            <p className="log-comment-loading">Yükleniyor…</p>
          ) : comments.length === 0 ? (
            <p className="log-comment-empty">Henüz yorum yok. İlk yorumu sen yaz!</p>
          ) : (
            <div className="log-comment-list">
              {comments.map(c => {
                const isOwn       = myId && c.author?._id === myId;
                const isLogOwner  = myId && logAuthorId === myId;
                const canDelete   = isOwn || isLogOwner;
                return (
                  <div key={c._id} className="log-comment-item">
                    <div className="log-comment-avatar">
                      {c.author?.avatarUrl
                        ? <img src={c.author.avatarUrl} alt="" />
                        : <span>{(c.author?.kullaniciAdi || "?")[0].toUpperCase()}</span>
                      }
                    </div>
                    <div className="log-comment-body">
                      <div className="log-comment-header">
                        <span className="log-comment-author">{c.author?.kullaniciAdi || "Yazar"}</span>
                        <span className="log-comment-time">{timeAgo(c.createdAt)}</span>
                        {canDelete && (
                          <button className="log-comment-delete" onClick={() => handleDelete(c._id)} title="Sil">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="log-comment-text">{c.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isLoggedIn ? (
            <form className="log-comment-form" onSubmit={handlePost}>
              <div className="log-comment-input-wrap">
                <input
                  className="log-comment-input"
                  type="text"
                  placeholder="Yorum yaz…"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  maxLength={500}
                  disabled={posting}
                />
                <button className="log-comment-submit" type="submit" disabled={!text.trim() || posting}>
                  {posting ? "…" : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
              {error && <p className="log-comment-error">{error}</p>}
            </form>
          ) : (
            <p className="log-comment-login-hint">Yorum yapmak için <a href="/login">giriş yap</a></p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tek girdi ── */
function LogEntry({ log, isOwner, onDelete, isLoggedIn }) {
  const [likeCount, setLikeCount] = useState(log.likeCount ?? 0);
  const [likedByMe, setLikedByMe] = useState(log.likedByMe ?? false);
  const [liking,    setLiking]    = useState(false);

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    const was = likedByMe;
    setLikedByMe(!was);
    setLikeCount(c => was ? c - 1 : c + 1);
    try {
      const res = await apiPost(`/logs/${log._id}/like`);
      setLikeCount(res.likeCount);
      setLikedByMe(res.likedByMe);
    } catch {
      setLikedByMe(was);
      setLikeCount(c => was ? c + 1 : c - 1);
    } finally {
      setLiking(false);
    }
  }

  const vis = VIS[log.visibility] ?? VIS.public;

  return (
    <div className="log-entry">
      <div className="log-entry-dot" />
      <div className="log-entry-card">
        <div className="log-entry-top">
          <span className="log-entry-time">{timeAgo(log.createdAt)}</span>
          <div className="log-entry-actions">
            {log.visibility !== "public" && (
              <span className="log-vis-badge">{vis.icon} {vis.label}</span>
            )}
            {isOwner && (
              <button className="log-delete-btn" onClick={() => onDelete(log._id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <p className="log-entry-content">{log.content}</p>

        {log.relatedWork && (
          <div className="log-work-tag">
            {log.relatedWork.coverImage && (
              <img src={log.relatedWork.coverImage} alt="" className="log-work-cover" />
            )}
            <span>{log.relatedWork.title}</span>
          </div>
        )}

        <div className="log-entry-footer">
          <button
            className={`log-like-btn ${likedByMe ? "log-like-btn--active" : ""}`}
            onClick={handleLike}
            disabled={liking || !isLoggedIn}
            title={!isLoggedIn ? "Beğenmek için giriş yap" : ""}
          >
            <svg width="13" height="13" viewBox="0 0 24 24"
              fill={likedByMe ? "currentColor" : "none"}
              stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
        </div>

        <CommentSection
          logId={log._id}
          isLoggedIn={isLoggedIn}
          logAuthorId={log.author?._id || log.author}
        />
      </div>
    </div>
  );
}

/* ── Composer ── */
function LogComposer({ works, onPost }) {
  const [content,    setContent]    = useState("");
  const [visibility, setVisibility] = useState("public");
  const [workId,     setWorkId]     = useState("");
  const [posting,    setPosting]    = useState(false);
  const [error,      setError]      = useState("");
  const [expanded,   setExpanded]   = useState(false);
  const textareaRef = useRef(null);

  const remaining = MAX_CHARS - content.length;
  const canPost   = content.trim().length > 0 && remaining >= 0;

  async function handlePost() {
    if (!canPost || posting) return;
    setPosting(true);
    setError("");
    try {
      const res = await apiPost("/logs", { content, visibility, relatedWork: workId || undefined });
      onPost(res.item);
      setContent(""); setWorkId(""); setVisibility("public"); setExpanded(false);
    } catch (e) {
      setError(e.message || "Gönderilemedi.");
    } finally {
      setPosting(false);
    }
  }

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [content]);

  return (
    <div className={`log-composer ${expanded ? "log-composer--open" : ""}`}>
      <textarea
        ref={textareaRef}
        className="log-composer-input"
        placeholder="Ne yazıyorsun? Yaratım sürecini paylaş…"
        value={content}
        onChange={e => setContent(e.target.value)}
        onFocus={() => setExpanded(true)}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost(); }}
        maxLength={MAX_CHARS + 10}
        rows={expanded ? 4 : 2}
      />
      {expanded && (
        <div className="log-composer-toolbar">
          <div className="log-toolbar-selects">
            {works?.length > 0 && (
              <select className="log-select" value={workId} onChange={e => setWorkId(e.target.value)}>
                <option value="">Eser etiketle…</option>
                {works.map(w => <option key={w._id||w.id} value={w._id||w.id}>{w.title}</option>)}
              </select>
            )}
            <select className="log-select" value={visibility} onChange={e => setVisibility(e.target.value)}>
              <option value="public">🌐 Herkese açık</option>
              <option value="followers">🔒 Takipçiler</option>
              <option value="private">👁 Sadece ben</option>
            </select>
          </div>
          <div className="log-toolbar-btns">
            <span className={`log-char-count ${remaining < 30 ? "log-char-count--warn" : ""} ${remaining < 0 ? "log-char-count--over" : ""}`}>
              {remaining}
            </span>
            <button className="log-btn-ghost" onClick={() => { setExpanded(false); setContent(""); setWorkId(""); }}>
              Vazgeç
            </button>
            <button className="log-btn-post" onClick={handlePost} disabled={!canPost || posting}>
              {posting ? "…" : "Paylaş"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="log-error">{error}</p>}
    </div>
  );
}

/* ══ Ana bileşen ══ */
export default function LogTab({ userId, isOwner, works }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page,    setPage]    = useState(1);

  const isLoggedIn = !!localStorage.getItem("token");

  useEffect(() => {
    setLogs([]); setPage(1); loadLogs(1, true);
  }, [userId]);

  async function loadLogs(p = 1, reset = false) {
    try {
      setLoading(true);
      const res = await apiGet(`/logs/${userId}?page=${p}&limit=10`);
      setLogs(prev => reset ? res.items : [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(p);
    } catch { /* sessizce geç */ }
    finally { setLoading(false); }
  }

  async function handleDelete(logId) {
    if (!window.confirm("Bu girdiyi silmek istiyor musun?")) return;
    try {
      await apiDelete(`/logs/${logId}`);
      setLogs(p => p.filter(l => l._id !== logId));
    } catch (e) { alert("Silinemedi: " + e.message); }
  }

  return (
    <div className="log-tab">
      {isOwner && <LogComposer works={works} onPost={log => setLogs(p => [log, ...p])} />}

      {loading && logs.length === 0 ? (
        <div className="log-empty">
          <div className="pf-splash-ring" style={{ width: 26, height: 26, borderWidth: 2 }} />
        </div>
      ) : logs.length === 0 ? (
        <div className="log-empty">
          <span className="log-empty-icon">✒</span>
          <p>{isOwner ? "Henüz bir şey paylaşmadın. Yaratım sürecini yazarlarla paylaş!" : "Bu yazar henüz bir günlük girdisi paylaşmamış."}</p>
        </div>
      ) : (
        <>
          <div className="log-timeline">
            {logs.map(log => (
              <LogEntry
                key={log._id}
                log={log}
                isOwner={isOwner}
                isLoggedIn={isLoggedIn}
                onDelete={handleDelete}
              />
            ))}
          </div>
          {hasMore && (
            <button className="log-load-more" onClick={() => loadLogs(page + 1)} disabled={loading}>
              {loading ? "Yükleniyor…" : "Daha fazla"}
            </button>
          )}
        </>
      )}
    </div>
  );
}