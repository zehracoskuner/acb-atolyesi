import { useLike } from "../../hooks/useLike";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, ArrowUpRight, BookOpen, LockKeyhole } from "lucide-react";
import { useMembership } from "../../lib/membershipContext";
import { apiGet, apiPost, apiDelete } from "../../lib/api";
import WriterShelf from "./WriterShelf";
import { BookCover } from "./WriterShelf";
import { timeAgo } from "./feedPresentation";

/* ─── Yardımcılar ─── */
export function Avatar({ user, size = 36 }) {
  const name = user?.kullaniciAdi || user?.username || "?";
  const init = name[0].toUpperCase();
  if (user?.avatarUrl) {
    return (
      <img src={user.avatarUrl} alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "#e8e2d8",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Playfair Display', serif", fontSize: size * 0.38,
      fontWeight: 700, color: "#7a6e5f", flexShrink: 0,
    }}>{init}</div>
  );
}

/* ── Akış yorumları ── */
function InlineComments({ logId, isLoggedIn, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [text,     setText]     = useState("");
  const [posting,  setPosting]  = useState(false);
  const [error,    setError]    = useState("");
  const { user: currentUser, requireMember } = useMembership();
  const myId = currentUser?._id || currentUser?.id;
  useEffect(() => {
    let active = true;
    apiGet(`/logs/${logId}/comments`)
      .then(res => {
        if (!active) return;
        setComments(res.items || []);
        onCountChange((res.items || []).length);
        setLoaded(true);
      })
      .catch(() => { if (active) setError("Yorumlar yüklenemedi. Kapatıp yeniden deneyebilirsin."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [logId, onCountChange]);

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim() || posting || !loaded) return;
    setPosting(true);
    setError("");
    try {
      const res = await apiPost(`/logs/${logId}/comments`, { content: text.trim() });
      setComments(prev => [...prev, res.item]);
      onCountChange(count => count + 1);
      setText("");
    } catch (err) {
      setError(err.status === 403 ? "Yorum yapma yetkiniz kısıtlanmış." : "Yorum gönderilemedi.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId) {
    try {
      await apiDelete(`/logs/${logId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c._id !== commentId));
      onCountChange(count => Math.max(0, count - 1));
    } catch {
      setError("Yorum silinemedi. Yeniden deneyebilirsin.");
    }
  }

  return (
    <section className="feed-comments-wrap" aria-label="Günlük yorumları">
      <div className="feed-comments-heading"><MessageCircle size={16} aria-hidden="true" /><h3>Satır arası sohbet</h3>{loaded && <span>{comments.length} yorum</span>}</div>
      {loading ? (
        <p className="feed-comments-muted">Yükleniyor…</p>
      ) : loaded && comments.length === 0 ? (
        <p className="feed-comments-muted">Henüz yorum yok.</p>
      ) : (
        <div className="feed-comments-list">
          {comments.map(c => {
            const isOwn = myId && (c.author?._id === myId || c.author?._id?.toString() === myId);
            return (
              <div key={c._id} className="feed-comments-item">
                <Avatar user={c.author} size={32} />
                <div className="feed-comments-body">
                  <div className="feed-comments-meta">
                    <span className="feed-comments-author">{c.author?.kullaniciAdi}</span>
                    <span className="feed-comments-time">{timeAgo(c.createdAt)}</span>
                    {isOwn && (
                      <button
                        className="feed-comments-delBtn"
                        onClick={() => handleDelete(c._id)}
                        aria-label="Yorumu sil"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="feed-comments-text">{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoggedIn ? (
        <form className="feed-comments-form" onSubmit={handlePost}>
          <textarea
            className="feed-comments-input"
            rows={2}
            placeholder="Yorum yaz…"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={500}
            disabled={posting || !loaded}
            aria-label="Yorum yaz"
          />
          <button
            className="feed-comments-send"
            type="submit"
            disabled={!text.trim() || posting || !loaded}
            aria-label="Yorumu gönder"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      ) : (
        <button type="button"
          className="feed-comments-login"
          onClick={() => requireMember()}
        >
          Yorum yapmak için giriş yap →
        </button>
      )}
      {error && <p className="feed-comments-error" role="alert">{error}</p>}
    </section>
  );
}

function AuthorLine({ item, shelf }) {
  const name = item.author?.kullaniciAdi || "Atölyeden bir yazar";
  const identity = <><Avatar user={item.author} size={34} /><span><strong>{name}</strong><time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time></span></>;
  return <header className="feed-card-header">
    {item.author?._id ? <Link className="feed-author" to={`/profile/${item.author._id}`}>{identity}</Link> : <span className="feed-author">{identity}</span>}
    <div className="feed-header-meta">
      <span className={`feed-kind${item.type === "chapter" ? " feed-kind-chapter" : ""}`}>{item.type === "chapter" ? "Yeni bölüm" : "Günlük"}</span>
      {shelf && <WriterShelf shelf={shelf} author={item.author} />}
    </div>
  </header>;
}

export function LogCard({ item, initiallyShowComments = false }) {
  const { status, requireMember } = useMembership();
  const { liked, likeCount, busy: liking, error, toggle } = useLike({
    path: `/logs/${item._id}/like`, initialLiked: item.likedByMe, initialCount: item.likeCount,
  });
  const [showComments, setShowComments] = useState(initiallyShowComments);
  const [commentCount, setCommentCount] = useState(item.commentCount ?? 0);
  async function handleLike() {
    if (!requireMember()) return;
    await toggle();
  }
  return <article className="feed-card">
    <div className="feed-card-main">
      <AuthorLine item={item} shelf={item.authorShelf} />
      <p className="feed-log-text">{item.content}</p>
      {item.relatedWork && <Link className="feed-related-work" to={`/story/${item.relatedWork._id}`}>
        <BookCover work={item.relatedWork} /><span><small>BU ESERİN SATIR ARASINDAN</small><strong>{item.relatedWork.title}</strong><span>Eseri keşfet</span></span><ArrowUpRight size={17} aria-hidden="true" />
      </Link>}
      <footer className="feed-card-actions">
        <button type="button" aria-pressed={liked} aria-label={liked ? "Beğeniyi kaldır" : "Beğen"} disabled={liking} onClick={handleLike} className={liked ? "is-liked" : ""}><Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" /><span>{likeCount || "Beğen"}</span></button>
        <button type="button" className={`feed-comment-toggle${commentCount > 0 ? " has-comments" : ""}`} aria-expanded={showComments} aria-controls={`feed-comments-${item._id}`} onClick={() => setShowComments(value => !value)}><MessageCircle size={16} aria-hidden="true" /><span>{showComments ? "Yorumları kapat" : commentCount > 0 ? "Yorumlar" : "Henüz yorum yok"}</span>{commentCount > 0 && <span className="feed-comment-count">{commentCount}</span>}</button>
        {item.visibility === "followers" && <span className="feed-visibility"><LockKeyhole size={11} aria-hidden="true" />Takipçilere özel</span>}
      </footer>
      {error && <p className="feed-error" role="alert">{error}</p>}
      {showComments && <div id={`feed-comments-${item._id}`}><InlineComments logId={item._id} isLoggedIn={status === "authenticated"} onCountChange={setCommentCount} /></div>}
    </div>
  </article>;
}

export function ChapterCard({ item }) {
  const { requireMember } = useMembership();
  const { liked, likeCount, busy, error, toggle } = useLike({
    path: `/chapters/${item.chapter._id}/like`, initialLiked: item.likedByMe, initialCount: item.likeCount,
  });
  async function handleLike() {
    if (!requireMember()) return;
    await toggle();
  }
  return <article className="feed-card feed-chapter-card"><div className="feed-card-main">
    <AuthorLine item={item} />
    <Link className="feed-chapter-link" to={`/read/${item.work._id}?chapter=${item.chapter._id}`}>
      <BookCover work={item.work} /><span><small>{item.work.title}</small><strong>{item.chapter.title || `Bölüm ${item.chapter.order}`}</strong><span>Bölümü oku <ArrowUpRight size={14} aria-hidden="true" /></span></span><BookOpen size={22} aria-hidden="true" />
    </Link>
    <footer className="feed-card-actions"><button type="button" aria-label={liked ? "Beğeniyi kaldır" : "Beğen"} aria-pressed={liked} disabled={busy} onClick={handleLike}><Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" />{likeCount || "Beğen"}</button><Link to={`/story/${item.work._id}`}>Eserin tamamı <ArrowUpRight size={13} aria-hidden="true" /></Link></footer>
    {error && <p className="feed-error" role="alert">{error}</p>}
  </div></article>;
}
