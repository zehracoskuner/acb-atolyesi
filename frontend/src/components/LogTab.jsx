import { loadLogTarget } from "../lib/loadLogTarget";
import { useLike } from "../hooks/useLike";
import { useMembership } from "../lib/membershipContext";
// src/components/LogTab.jsx

import { useCallback, useState, useEffect, useRef } from "react";
import { apiGet, apiPost, apiDelete } from "../lib/api";

const MAX_CHARS = 800;

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)     return "az önce";
  if (diff < 3600)   return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}


const VIS = {
  public:    { icon: "🌐", label: "Herkese açık" },
  followers: { icon: "🔒", label: "Takipçiler" },
  private:   { icon: "👁",  label: "Sadece ben" },
};

/* ── Yorum bölümü ── */
export function CommentSection({ logId, isLoggedIn, logAuthorId, initialCount = 0, initiallyOpen = false }) {
  const [loaded, setLoaded] = useState(false);
  const [comments,  setComments]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [open,      setOpen]      = useState(initiallyOpen);
  const [text,      setText]      = useState("");
  const [posting,   setPosting]   = useState(false);
  const [error,     setError]     = useState("");
  const { user: currentUser, requireMember } = useMembership();
  const myId = currentUser?._id || currentUser?.id;

  useEffect(() => {
    if (!initiallyOpen) return;
    let active = true;
    setOpen(true); setLoading(true);
    apiGet(`/logs/${logId}/comments`).then(res => {
      if (active) { setComments(res.items || []); setLoaded(true); setError(""); }
    }).catch(() => { if (active) setError("Yorumlar yüklenemedi. Kapatıp yeniden deneyebilirsin."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initiallyOpen, logId]);

  async function loadComments() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiGet(`/logs/${logId}/comments`);
      setComments(res.items || []);
      setLoaded(true);
      setError("");
    } catch { setError("Yorumlar yüklenemedi. Kapatıp yeniden deneyebilirsin."); }
    finally { setLoading(false); }
  }

  function handleToggle() {
    if (!open && !loaded) loadComments();
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

  const count = loaded ? comments.length : initialCount;
  return (
    <div className="log-comments">
      <button type="button" className={`log-comment-toggle${count > 0 ? " has-comments" : ""}`} onClick={handleToggle} aria-expanded={open} aria-controls={`log-comments-${logId}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>{open ? "Yorumları gizle" : count > 0 ? "Yorumlar" : "Henüz yorum yok"}</span>
        {count > 0 && <span className="log-comment-count">{count}</span>}
      </button>

      {open && (
        <div className="log-comment-section" id={`log-comments-${logId}`}>
          {error && <p className="log-comment-error" role="alert">{error}</p>}
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
                  disabled={posting || loading || !loaded}
                />
                <button className="log-comment-submit" type="submit" disabled={!text.trim() || posting || loading || !loaded}>
                  {posting ? "…" : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <p className="log-comment-login-hint">Yorum yapmak için <button onClick={() => requireMember()}>aramıza katıl</button></p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tek girdi ── */
function LogEntry({ log, isOwner, onDelete, isLoggedIn, highlighted }) {
  const { requireMember } = useMembership();
  const { likeCount, liked: likedByMe, busy: liking, error: likeError, toggle } = useLike({
    path: `/logs/${log._id}/like`, initialLiked: log.likedByMe, initialCount: log.likeCount,
  });
  async function handleLike() {
    if (!requireMember()) return;
    await toggle();
  }

  const vis = VIS[log.visibility] ?? VIS.public;

  return (
    <div id={`log-${log._id}`} tabIndex={-1} className={`log-entry${highlighted ? " log-entry--highlighted" : ""}`}>
      {likeError && <p role="alert">{likeError}</p>}
      <div className="log-entry-dot" />
      <div className="log-entry-card">
        {highlighted && <span className="log-notification-label">Bildirimdeki günlük girdisi</span>}
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
            aria-pressed={likedByMe}
            disabled={liking}
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
          initialCount={log.commentCount}
          initiallyOpen={highlighted}
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
        maxLength={MAX_CHARS}
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
export default function LogTab({ userId, isOwner, works, targetLogId }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page,    setPage]    = useState(1);
  const [error, setError] = useState("");
  const [targetMissing, setTargetMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const scrolledTarget = useRef(null);

  const isLoggedIn = useMembership().status === "authenticated";

  const loadLogs = useCallback(async (p = 1, reset = false) => {
    const version = requestVersion.current;
    try {
      setError("");
      setLoading(true);
      const res = await apiGet(`/logs/${userId}?page=${p}&limit=10`);
      if (version !== requestVersion.current) return;
      setLogs(prev => reset ? res.items : [...new Map([...prev, ...res.items].map(log => [log._id, log])).values()]);
      setHasMore(res.hasMore);
      setPage(p);
    } catch { if (version === requestVersion.current) setError("Günlük yüklenemedi. Lütfen yeniden dene."); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [userId]);

  useEffect(() => {
    scrolledTarget.current = null;
    const version = ++requestVersion.current;
    const active = () => requestVersion.current === version;
    setLogs([]); setPage(1); setLoading(true); setError(""); setTargetMissing(false); setHasMore(false);
    loadLogTarget(p => apiGet(`/logs/${userId}?page=${p}&limit=10`), targetLogId, active)
      .then(result => {
        if (!active() || !result) return;
        setLogs(result.items); setPage(result.page); setHasMore(result.hasMore);
        setTargetMissing(!result.found);
      })
      .catch(() => { if (active()) setError("Günlük yüklenemedi. Lütfen yeniden dene."); })
      .finally(() => { if (active()) setLoading(false); });
    return () => { requestVersion.current = version + 1; };
  }, [userId, targetLogId, retry]);

  useEffect(() => {
    if (loading || !targetLogId || targetMissing || error || scrolledTarget.current === targetLogId) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`log-${targetLogId}`);
      if (!element) return;
      scrolledTarget.current = targetLogId;
      element.scrollIntoView({ block: "center", behavior: "auto" });
      element?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, targetLogId, targetMissing, error]);

  async function handleDelete(logId) {
    if (!window.confirm("Bu girdiyi silmek istiyor musun?")) return;
    try {
      await apiDelete(`/logs/${logId}`);
      setLogs(p => p.filter(l => l._id !== logId));
      if (String(logId) === targetLogId) setTargetMissing(true);
    } catch (e) { alert("Silinemedi: " + e.message); }
  }

  return (
    <div className="log-tab">
      {isOwner && <LogComposer works={works} onPost={log => setLogs(p => [log, ...p])} />}

      {error && <p role="alert" className="log-error">{error} <button onClick={() => setRetry(v => v + 1)}>Yeniden dene</button></p>}
      {targetMissing && <p role="status" className="log-target-notice">Bildirimdeki girdi bu günlükte bulunamadı. Silinmiş veya görünürlüğü değişmiş olabilir. Diğer girdilerini aşağıda görebilirsin.</p>}
      {loading && logs.length === 0 ? (
        <div className="log-empty">
          <div className="pf-splash-ring" style={{ width: 26, height: 26, borderWidth: 2 }} />
        </div>
      ) : error ? null : logs.length === 0 ? (
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
                highlighted={String(log._id) === targetLogId}
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
