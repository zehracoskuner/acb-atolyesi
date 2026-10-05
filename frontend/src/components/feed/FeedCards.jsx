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
const cmnt = {
  wrap:    { borderTop: "1px solid rgba(0,0,0,.05)", marginTop: 10, paddingTop: 10 },
  muted:   { fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", color: "#756958", fontStyle: "italic", margin: "0 0 8px" },
  item:    { display: "flex", gap: 8, alignItems: "flex-start" },
  author:  { fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", fontWeight: 500, color: "#1a1209" },
  time:    { fontFamily: "'DM Sans',sans-serif", fontSize: ".62rem", color: "#756958" },
  delBtn:  { marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#756958", padding: 0, display: "flex", alignItems: "center", transition: "color .15s" },
  text:    { fontFamily: "'Lora',serif", fontSize: ".82rem", color: "#44403c", lineHeight: 1.6, margin: 0 },
  error:   { fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", color: "#c0392b", margin: "6px 0 0" },
  form:    { display: "flex", gap: 6, alignItems: "center", marginTop: 6 },
  input:   { flex: 1, minWidth: 0, padding: "6px 12px", border: "1px solid #e2ddd6", borderRadius: 20, fontFamily: "'DM Sans',sans-serif", fontSize: ".82rem", color: "#1a1209", background: "#faf8f4" },
  sendBtn: { width: 30, height: 30, borderRadius: "50%", background: "#1a1209", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 },
};

/* ── Inline yorum bölümü ── */
function InlineComments({ logId, isLoggedIn }) {
  const [comments, setComments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState("");
  const [posting,  setPosting]  = useState(false);
  const [error,    setError]    = useState("");
  const { user: currentUser, requireMember } = useMembership();
  const myId = currentUser?._id || currentUser?.id;
  useEffect(() => {
    apiGet(`/logs/${logId}/comments`)
      .then(res => setComments(res.items || []))
      .catch(() => setError("Yorumlar yüklenemedi. Kapatıp yeniden deneyebilirsin."))
      .finally(() => setLoading(false));
  }, [logId]);

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    setError("");
    try {
      const res = await apiPost(`/logs/${logId}/comments`, { content: text.trim() });
      setComments(prev => [...prev, res.item]);
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
    } catch {
      setError("Yorum silinemedi. Yeniden deneyebilirsin.");
    }
  }

  return (
    <div style={cmnt.wrap}>
      {loading ? (
        <p style={cmnt.muted}>Yükleniyor…</p>
      ) : comments.length === 0 ? (
        <p style={cmnt.muted}>Henüz yorum yok.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {comments.map(c => {
            const isOwn = myId && (c.author?._id === myId || c.author?._id?.toString() === myId);
            return (
              <div key={c._id} style={cmnt.item}>
                <Avatar user={c.author} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={cmnt.author}>{c.author?.kullaniciAdi}</span>
                    <span style={cmnt.time}>{timeAgo(c.createdAt)}</span>
                    {isOwn && (
                      <button
                        style={cmnt.delBtn}
                        onClick={() => handleDelete(c._id)}
                        aria-label="Yorumu sil"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <p style={cmnt.text}>{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoggedIn ? (
        <form style={cmnt.form} onSubmit={handlePost}>
          <input
            style={cmnt.input}
            type="text"
            placeholder="Yorum yaz…"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={500}
            disabled={posting}
            aria-label="Yorum yaz"
          />
          <button
            style={{ ...cmnt.sendBtn, opacity: !text.trim() || posting ? .4 : 1 }}
            type="submit"
            disabled={!text.trim() || posting}
            aria-label="Yorumu gönder"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      ) : (
        <button type="button"
          style={{ ...cmnt.muted, background: "none", border: 0, cursor: "pointer", color: "#8b2500" }}
          onClick={() => requireMember()}
        >
          Yorum yapmak için giriş yap →
        </button>
      )}
      {error && <p style={cmnt.error} role="alert">{error}</p>}
    </div>
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

export function LogCard({ item }) {
  const { status, requireMember } = useMembership();
  const [liked, setLiked] = useState(item.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(item.likeCount ?? 0);
  const [liking, setLiking] = useState(false);
  const [error, setError] = useState("");
  const [showComments, setShowComments] = useState(false);
  async function handleLike() {
    if (liking || !requireMember()) return;
    setLiking(true); setError("");
    const previous = { liked, likeCount };
    setLiked(!liked); setLikeCount(Math.max(0, likeCount + (liked ? -1 : 1)));
    try {
      const res = await apiPost(`/logs/${item._id}/like`);
      setLiked(res.likedByMe); setLikeCount(res.likeCount);
    } catch {
      setLiked(previous.liked); setLikeCount(previous.likeCount);
      setError("Beğeni kaydedilemedi. Yeniden deneyebilirsin.");
    } finally { setLiking(false); }
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
        <button type="button" aria-expanded={showComments} onClick={() => setShowComments(value => !value)}><MessageCircle size={16} aria-hidden="true" />{showComments ? "Yorumları kapat" : "Yorum"}</button>
        {item.visibility === "followers" && <span className="feed-visibility"><LockKeyhole size={11} aria-hidden="true" />Takipçilere özel</span>}
      </footer>
      {error && <p className="feed-error" role="alert">{error}</p>}
      {showComments && <InlineComments logId={item._id} isLoggedIn={status === "authenticated"} />}
    </div>
  </article>;
}

export function ChapterCard({ item }) {
  const { requireMember } = useMembership();
  const [like, setLike] = useState({ liked: item.likedByMe ?? false, count: item.likeCount ?? 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handleLike() {
    if (busy || !requireMember()) return;
    setBusy(true); setError("");
    try {
      const res = await apiPost(`/chapters/${item.chapter._id}/like`, { workId: item.work._id });
      setLike({ liked: res.liked, count: res.likeCount });
    } catch { setError("Beğeni kaydedilemedi."); }
    finally { setBusy(false); }
  }
  return <article className="feed-card feed-chapter-card"><div className="feed-card-main">
    <AuthorLine item={item} />
    <Link className="feed-chapter-link" to={`/read/${item.work._id}?chapter=${item.chapter._id}`}>
      <BookCover work={item.work} /><span><small>{item.work.title}</small><strong>{item.chapter.title || `Bölüm ${item.chapter.order}`}</strong><span>Bölümü oku <ArrowUpRight size={14} aria-hidden="true" /></span></span><BookOpen size={22} aria-hidden="true" />
    </Link>
    <footer className="feed-card-actions"><button type="button" aria-label={like.liked ? "Beğeniyi kaldır" : "Beğen"} aria-pressed={like.liked} disabled={busy} onClick={handleLike}><Heart size={16} fill={like.liked ? "currentColor" : "none"} aria-hidden="true" />{like.count || "Beğen"}</button><Link to={`/story/${item.work._id}`}>Eserin tamamı <ArrowUpRight size={13} aria-hidden="true" /></Link></footer>
    {error && <p className="feed-error" role="alert">{error}</p>}
  </div></article>;
}
