// src/pages/ExplorePage.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import { apiGet, apiPost, apiDelete } from "../lib/api";

/* ─── Yardımcılar ─── */
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)     return "az önce";
  if (diff < 3600)   return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}
function fmtNum(n = 0) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

const GENRE_COLOR = {
  "Fantastik":          "#7c5cbf",
  "Bilim Kurgu":        "#5cbfbf",
  "Distopya / Ütopya":  "#5c7cbf",
  "Tarihi Kurgu":       "#8a7a5c",
  "Mitolojik Kurgu":    "#bf9a5c",
  "Alternatif Tarih":   "#7abf5c",
  "Polisiye":           "#bf6e5c",
  "Psikolojik Gerilim": "#bf5c7c",
  "Suç Kurgu":          "#a05c7c",
  "Korku & Karanlık":   "#5c5cbf",
  "Gotik":              "#7c5c8a",
  "Gizem":              "#5c8a7c",
  "Romantizm":          "#bf5c7c",
  "Aile & Nesil":       "#bf8a5c",
  "Büyüme Romanı":      "#7abf7c",
  "Trajedi":            "#8a5c5c",
  "Dram":               "#5c8abf",
  "Mizah & Yergi":      "#bfbf5c",
  "Lirik Şiir":         "#9a7cbf",
  "Epik Şiir":          "#7c9abf",
  "Deneme":             "#9abf7c",
  "Anı & Otobiyografi": "#bf9a7c",
  "Günlük":             "#7cbfbf",
  "Macera":             "#bf9a5c",
  "Seyahat Yazını":     "#5cbf8a",
  "Destansı Fantezi":   "#8a5cbf",
  "Açık Dünya":         "#5c8a5c",
};

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
}

/* ── Avatar ── */
function Avatar({ user, size = 36 }) {
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

/* ── Tür chip'leri ── */
function GenreChips({ work, max = 2 }) {
  const genres = work.universe?.genres;
  if (!genres || genres.length === 0) return null;
  const visible = genres.slice(0, max);
  const extra   = genres.length - max;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {visible.map(g => (
        <span key={g} style={{
          display: "inline-block", padding: "1px 7px", borderRadius: 20,
          fontSize: ".6rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
          background: (GENRE_COLOR[g] || "#888") + "18", color: GENRE_COLOR[g] || "#888",
        }}>{g}</span>
      ))}
      {extra > 0 && (
        <span style={{ fontSize: ".6rem", fontFamily: "'DM Sans',sans-serif", color: "#b0a898" }}>+{extra}</span>
      )}
    </div>
  );
}

/* ── Inline yorum stilleri ── */
const cmnt = {
  wrap:    { borderTop: "1px solid rgba(0,0,0,.05)", marginTop: 10, paddingTop: 10 },
  muted:   { fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", color: "#b0a898", fontStyle: "italic", margin: "0 0 8px" },
  item:    { display: "flex", gap: 8, alignItems: "flex-start" },
  author:  { fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", fontWeight: 500, color: "#1a1209" },
  time:    { fontFamily: "'DM Sans',sans-serif", fontSize: ".62rem", color: "#b0a898" },
  delBtn:  { marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#c4bdb2", padding: 0, display: "flex", alignItems: "center", transition: "color .15s" },
  text:    { fontFamily: "'Lora',serif", fontSize: ".82rem", color: "#44403c", lineHeight: 1.6, margin: 0 },
  form:    { display: "flex", gap: 6, alignItems: "center", marginTop: 6 },
  input:   { flex: 1, padding: "6px 12px", border: "1px solid #e2ddd6", borderRadius: 20, fontFamily: "'DM Sans',sans-serif", fontSize: ".82rem", color: "#1a1209", background: "#faf8f4", outline: "none" },
  sendBtn: { width: 30, height: 30, borderRadius: "50%", background: "#1a1209", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 },
};

/* ── Inline yorum bölümü ── */
function InlineComments({ logId, isLoggedIn }) {
  const [comments, setComments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState("");
  const [posting,  setPosting]  = useState(false);
  const currentUser = getCurrentUser();
  const myId = currentUser?._id || currentUser?.id;
  const navigate = useNavigate();

  useEffect(() => {
    apiGet(`/logs/${logId}/comments`)
      .then(res => setComments(res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [logId]);

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const res = await apiPost(`/logs/${logId}/comments`, { content: text.trim() });
      setComments(prev => [...prev, res.item]);
      setText("");
    } catch {
      // sessiz hata
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId) {
    try {
      await apiDelete(`/logs/${logId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch {
      // sessiz hata
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
        <p
          style={{ ...cmnt.muted, cursor: "pointer", color: "#8b2500" }}
          onClick={() => navigate("/login")}
        >
          Yorum yapmak için giriş yap →
        </p>
      )}
    </div>
  );
}

/* ── Günlük kartı ── */
function LogCard({ item }) {
  const navigate   = useNavigate();
  const isLoggedIn = !!localStorage.getItem("token");
  const [liked,        setLiked]        = useState(item.likedByMe);
  const [likeCount,    setLikeCount]    = useState(item.likeCount);
  const [showComments, setShowComments] = useState(false);

  async function handleLike(e) {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    const was = liked;
    setLiked(!was);
    setLikeCount(c => was ? c - 1 : c + 1);
    try {
      const res = await apiPost(`/logs/${item._id}/like`);
      setLiked(res.likedByMe);
      setLikeCount(res.likeCount);
    } catch {
      setLiked(was);
      setLikeCount(c => was ? c + 1 : c - 1);
    }
  }

  return (
    <div style={card.wrap}>
      <div style={card.top}>
        <button
          style={card.authorBtn}
          onClick={() => navigate(`/profile/${item.author?._id}`)}
          aria-label={`${item.author?.kullaniciAdi} profiline git`}
        >
          <Avatar user={item.author} size={36} />
          <div>
            <span style={card.authorName}>{item.author?.kullaniciAdi}</span>
            <span style={card.time}>{timeAgo(item.createdAt)}</span>
          </div>
        </button>
        <span style={card.badgeLog}>✒ Günlük</span>
      </div>

      <p style={card.logText}>{item.content}</p>

      {item.relatedWork && (
        <button
          style={card.workTag}
          onClick={() => navigate(`/story/${item.relatedWork._id}`)}
          aria-label={`${item.relatedWork.title} eserine git`}
        >
          {item.relatedWork.coverImage && (
            <img src={item.relatedWork.coverImage} alt="" style={card.workTagImg} />
          )}
          <span>{item.relatedWork.title}</span>
        </button>
      )}

      <div style={card.footer}>
        <button
          style={{ ...card.actionBtn, color: liked ? "#e24b4a" : "#b0a898" }}
          onClick={handleLike}
          aria-label={liked ? "Beğeniyi kaldır" : "Beğen"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24"
            fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
        <button
          style={{ ...card.actionBtn, color: showComments ? "#8b2500" : "#b0a898" }}
          onClick={() => setShowComments(v => !v)}
          aria-label={showComments ? "Yorumları gizle" : "Yorumları göster"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>{showComments ? "Gizle" : "Yorum"}</span>
        </button>
      </div>

      {showComments && <InlineComments logId={item._id} isLoggedIn={isLoggedIn} />}
    </div>
  );
}

/* ── Yeni bölüm kartı ── */
function ChapterCard({ item }) {
  const navigate   = useNavigate();
  const isLoggedIn = !!localStorage.getItem("token");
  const [liked,     setLiked]     = useState(item.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(item.likeCount ?? 0);

  async function handleLike(e) {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    const was = liked;
    setLiked(!was);
    setLikeCount(c => was ? c - 1 : c + 1);
    try {
      const res = await apiPost(`/chapters/${item.chapter._id}/like`);
      setLiked(res.likedByMe);
      setLikeCount(res.likeCount);
    } catch {
      setLiked(was);
      setLikeCount(c => was ? c + 1 : c - 1);
    }
  }

  return (
    <div style={card.wrap}>
      <div style={card.top}>
        <button
          style={card.authorBtn}
          onClick={() => navigate(`/profile/${item.author?._id}`)}
          aria-label={`${item.author?.kullaniciAdi} profiline git`}
        >
          <Avatar user={item.author} size={36} />
          <div>
            <span style={card.authorName}>{item.author?.kullaniciAdi}</span>
            <span style={card.time}>{timeAgo(item.createdAt)}</span>
          </div>
        </button>
        <span style={card.badgeChapter}>📖 Yeni Bölüm</span>
      </div>

      <button
        style={card.chapterBtn}
        onClick={() => navigate(`/story/${item.work._id}`)}
        aria-label={`${item.work.title} eserine git`}
      >
        {item.work.coverImage ? (
          <img src={item.work.coverImage} alt="" style={card.chCover} />
        ) : (
          <div style={card.chCoverPh}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: ".8rem", fontWeight: 700, color: "rgba(0,0,0,.2)" }}>
              {item.work.title?.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
          <p style={card.chWorkTitle}>{item.work.title}</p>
          <p style={card.chTitle}>
            {item.chapter?.order ? `Bölüm ${item.chapter.order}` : ""}
            {item.chapter?.title ? ` · ${item.chapter.title}` : ""}
          </p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8bfad" strokeWidth="2" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>

      <div style={{ ...card.footer, marginTop: 10 }}>
        <button
          style={{ ...card.actionBtn, color: liked ? "#e24b4a" : "#b0a898" }}
          onClick={handleLike}
          aria-label={liked ? "Beğeniyi kaldır" : "Beğen"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24"
            fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
      </div>
    </div>
  );
}

/* ── Keşfet eser kartı (sidebar) ── */
function WorkCard({ work }) {
  const navigate = useNavigate();
  return (
    <button
      style={side.workCard}
      onClick={() => navigate(`/story/${work._id}`)}
      aria-label={`${work.title} eserine git`}
    >
      {work.coverImage ? (
        <img src={work.coverImage} alt={work.title} style={side.cover} />
      ) : (
        <div style={side.coverPh}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: ".75rem", fontWeight: 700, color: "rgba(0,0,0,.2)" }}>
            {work.title?.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={side.workTitle}>{work.title}</p>
        <p style={side.workMeta}>{work.isAnonymous ? "Anonim Yazar" : (work.author?.kullaniciAdi || work.author?.username || "Yazar")}</p>
        <div style={{ marginTop: 3 }}><GenreChips work={work} max={1} /></div>
        <span style={side.chCount}>{work.chapterCount} bölüm</span>
      </div>
    </button>
  );
}

/* ── Keşfet yazar kartı (sidebar) ── */
function WriterCard({ writer }) {
  const navigate = useNavigate();
  return (
    <button
      style={side.writerCard}
      onClick={() => navigate(`/profile/${writer._id}`)}
      aria-label={`${writer.kullaniciAdi} profiline git`}
    >
      <Avatar user={writer} size={38} />
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={side.writerName}>{writer.kullaniciAdi}</p>
        {writer.bio && (
          <p style={side.writerBio}>{writer.bio.slice(0, 55)}{writer.bio.length > 55 ? "…" : ""}</p>
        )}
      </div>
    </button>
  );
}

/* ── Günün Günlükleri kartı (sidebar) ── */
function TopLogCard({ log, navigate }) {
  return (
    <button
      style={side.topLogCard}
      onClick={() => navigate(`/profile/${log.author?._id}`)}
      aria-label={`${log.author?.kullaniciAdi} profiline git`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Avatar user={log.author} size={24} />
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", fontWeight: 500, color: "#1a1209", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {log.author?.kullaniciAdi}
        </span>
        {(log.likeCount > 0 || log.commentCount > 0) && (
          <span style={{ marginLeft: "auto", fontFamily: "'DM Sans',sans-serif", fontSize: ".62rem", color: "#b0a898", whiteSpace: "nowrap", flexShrink: 0 }}>
            {log.likeCount > 0 && `❤ ${log.likeCount}`}
            {log.likeCount > 0 && log.commentCount > 0 && " · "}
            {log.commentCount > 0 && `💬 ${log.commentCount}`}
          </span>
        )}
      </div>
      <p style={{ fontFamily: "'Lora',serif", fontStyle: "italic", fontSize: ".78rem", color: "#5c5248", lineHeight: 1.55, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {log.content}
      </p>
    </button>
  );
}

/* ── Geri Bildirim Bekleyenler (sidebar) ── */
function NeedsReviewCard({ work, navigate }) {
  return (
    <button
      style={side.reviewCard}
      onClick={() => navigate(`/story/${work._id}`)}
      aria-label={`${work.title} eserine git`}
    >
      {work.coverImage ? (
        <img src={work.coverImage} alt={work.title} style={{ width: 30, height: 44, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 30, height: 44, borderRadius: 4, background: "linear-gradient(145deg,#ede9e0,#ddd5c4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: ".65rem", fontWeight: 700, color: "rgba(0,0,0,.2)" }}>
            {work.title?.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={{ fontFamily: "'Playfair Display',serif", fontSize: ".8rem", fontWeight: 700, color: "#1a1209", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {work.title}
        </p>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".65rem", color: "#9a8e80", margin: "0 0 3px" }}>
          {work.isAnonymous ? "Anonim Yazar" : (work.author?.kullaniciAdi || work.author?.username || "Yazar")}
        </p>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".6rem", background: "rgba(184,134,11,.12)", color: "#7a5c00", padding: "1px 7px", borderRadius: 20, fontWeight: 500 }}>
          {work.commentCount === 0 ? "İlk yorum senden" : `${work.commentCount} yorum`}
        </span>
      </div>
    </button>
  );
}

/* ── Arama sonuç kartları ── */
function SearchWorkCard({ work, index }) {
  const navigate = useNavigate();
  return (
    <button
      style={{ ...srch.card, animationDelay: `${index * 0.04}s` }}
      onClick={() => navigate(`/story/${work._id}`)}
      aria-label={`${work.title} eserine git`}
    >
      {work.coverImage ? (
        <img src={work.coverImage} alt={work.title} style={srch.cover} />
      ) : (
        <div style={srch.coverPh}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: "rgba(0,0,0,.2)", fontSize: "1rem" }}>
            {work.title?.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={srch.title}>{work.title}</p>
        <p style={srch.author}>{work.isAnonymous ? "Anonim Yazar" : (work.author?.kullaniciAdi || work.author?.username || "Yazar")}</p>
        {work.description && (
          <p style={srch.desc}>{work.description.slice(0, 100)}{work.description.length > 100 ? "…" : ""}</p>
        )}
        <div style={{ marginTop: 5 }}><GenreChips work={work} max={3} /></div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8bfad" strokeWidth="2" style={{ flexShrink: 0 }} aria-hidden="true">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </button>
  );
}

function SearchUserCard({ user, index }) {
  const navigate = useNavigate();
  return (
    <button
      style={{ ...srch.card, animationDelay: `${index * 0.04}s` }}
      onClick={() => navigate(`/profile/${user._id}`)}
      aria-label={`${user.kullaniciAdi} profiline git`}
    >
      <Avatar user={user} size={44} />
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={srch.title}>{user.kullaniciAdi}</p>
        {user.bio && <p style={srch.desc}>{user.bio.slice(0, 100)}{user.bio.length > 100 ? "…" : ""}</p>}
        <p style={side.chCount}>{fmtNum(user.followerCount || 0)} takipçi</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8bfad" strokeWidth="2" style={{ flexShrink: 0 }} aria-hidden="true">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </button>
  );
}

/* ── Misafir hero banner ── */
function GuestHeroBanner() {
  const navigate = useNavigate();
  return (
    <div style={guest.banner}>
      <div style={guest.bannerInner}>
        <div style={guest.bannerLeft}>
          <div style={guest.rule} />
          <h2 style={guest.title}>
            Yazarların buluştuğu<br />
            <em style={guest.titleEm}>atölye</em>
          </h2>
          <p style={guest.sub}>
            Hikâyeni paylaş, eserleri keşfet, yazarlarla tanış.
            Acemi kalemler için güvenli bir alan.
          </p>
          <div style={guest.btns}>
            <button style={guest.btnPri} onClick={() => navigate("/register")}>
              Ücretsiz Katıl
            </button>
            <button style={guest.btnGhost} onClick={() => navigate("/login")}>
              Giriş Yap
            </button>
          </div>
        </div>
        <div style={guest.stats}>
          <div style={guest.statItem}>
            <span style={guest.statNum}>✒</span>
            <span style={guest.statLabel}>Yazar günlükleri</span>
          </div>
          <div style={guest.statDivider} />
          <div style={guest.statItem}>
            <span style={guest.statNum}>📖</span>
            <span style={guest.statLabel}>Yeni bölümler</span>
          </div>
          <div style={guest.statDivider} />
          <div style={guest.statItem}>
            <span style={guest.statNum}>💬</span>
            <span style={guest.statLabel}>Topluluk yorumları</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ANA SAYFA
══════════════════════════════════════════════ */
export default function ExplorePage() {
  const navigate   = useNavigate();
  const isLoggedIn = !!localStorage.getItem("token");
  const searchRef  = useRef(null);

  const [feedItems,  setFeedItems]  = useState([]);
  const [feedLoad,   setFeedLoad]   = useState(true);
  const [feedMore,   setFeedMore]   = useState(false);
  const [feedPage,   setFeedPage]   = useState(1);
  const [feedEmpty,  setFeedEmpty]  = useState(false);

  const [discWorks,   setDiscWorks]   = useState([]);
  const [discWriters, setDiscWriters] = useState([]);
  const [discLoad,    setDiscLoad]    = useState(true);

  const [topLogs,     setTopLogs]     = useState([]);
  const [topLogsLoad, setTopLogsLoad] = useState(true);
  const [needsReview, setNeedsReview] = useState([]);
  const [reviewLoad,  setReviewLoad]  = useState(true);

  const [genreList,     setGenreList]     = useState([]);
  const [genresLoading, setGenresLoading] = useState(true);

  const [query,       setQuery]       = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [searchWorks, setSearchWorks] = useState([]);
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchLoad,  setSearchLoad]  = useState(false);
  const [searchTab,   setSearchTab]   = useState("works");

  const [mode, setMode] = useState(isLoggedIn ? "feed" : "explore");

  useEffect(() => {
    document.title = "Keşfet · ACB Atölyesi";
    loadGenres();
    loadDiscover();
    loadTopLogs();
    loadNeedsReview();
    if (isLoggedIn) loadFeed(1, true);
    else setFeedLoad(false);
  }, [isLoggedIn]);

  // Tür filtresi değişince discover yenile
  useEffect(() => {
    loadDiscover();
  }, [genreFilter]);

  // Arama debounce — query temizlenince filtre sıfırlanmıyor intentionally,
  // ama activeQuery sıfırlanıyor yani sonuç listesi kapanıyor.
  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 2) {
        doSearch(query.trim(), genreFilter);
      } else {
        setSearchWorks([]);
        setSearchUsers([]);
        setActiveQuery("");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, genreFilter]);

  async function loadGenres() {
    try {
      const res = await apiGet("/works/genres");
      const list = (res.genres || []).filter(g => g.count > 0);
      setGenreList(list.length > 0 ? list : (res.genres || []));
    } catch {
      // boş kalır, sadece "Tümü" görünür
    } finally {
      setGenresLoading(false);
    }
  }

  async function loadFeed(p = 1, reset = false) {
    try {
      setFeedLoad(true);
      const res = await apiGet(`/feed?page=${p}`);
      setFeedItems(prev => reset ? (res.items || []) : [...prev, ...(res.items || [])]);
      setFeedMore(res.hasMore);
      setFeedEmpty(res.isEmpty || (res.items?.length === 0 && p === 1));
      setFeedPage(p);
    } catch {
      // sessiz hata
    } finally {
      setFeedLoad(false);
    }
  }

  async function loadDiscover() {
    try {
      setDiscLoad(true);
      const params = genreFilter !== "all" ? `?genres=${encodeURIComponent(genreFilter)}` : "";
      const res = await apiGet(`/feed/discover${params}`);
      setDiscWorks(res.works   || []);
      setDiscWriters(res.writers || []);
    } catch {
      // sessiz hata
    } finally {
      setDiscLoad(false);
    }
  }

  async function loadTopLogs() {
    try {
      const res = await apiGet("/feed/top-logs");
      setTopLogs(res.items || []);
    } catch {
      // sessiz hata
    } finally {
      setTopLogsLoad(false);
    }
  }

  async function loadNeedsReview() {
    try {
      const res = await apiGet("/feed/needs-review");
      setNeedsReview(res.items || []);
    } catch {
      // sessiz hata
    } finally {
      setReviewLoad(false);
    }
  }

  async function doSearch(q, genre) {
    setSearchLoad(true);
    setActiveQuery(q);
    try {
      const params = new URLSearchParams({ q });
      if (genre !== "all") params.set("genre", genre);
      const [worksRes, usersRes] = await Promise.allSettled([
        apiGet(`/search/works?${params}`),
        apiGet(`/search/users?q=${encodeURIComponent(q)}`),
      ]);
      setSearchWorks(worksRes.status === "fulfilled" ? worksRes.value.items || [] : []);
      setSearchUsers(usersRes.status === "fulfilled" ? usersRes.value.items || [] : []);
    } catch {
      // sessiz hata
    } finally {
      setSearchLoad(false);
    }
  }

  const isSearching = activeQuery.length >= 2;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'DM Sans', sans-serif" }}>
      <TopBar />

      {/* ── Misafir hero ── */}
      {!isLoggedIn && !isSearching && <GuestHeroBanner />}

      {/* ── Başlık + Arama + Tür filtreleri ── */}
      <div style={hero.wrap}>
        <div style={hero.inner}>
          {/* Başlık: arama yapılıyorsa sorguyu göster */}
          <div style={hero.left}>
            <h1 style={hero.title}>
              {isSearching ? `"${activeQuery}"` : (isLoggedIn ? "Keşfet" : "Eserler")}
            </h1>
            {!isSearching && isLoggedIn && (
              <p style={hero.sub}>Yazarları takip et, eserleri keşfet, topluluğa katıl.</p>
            )}
          </div>

          {/* Arama */}
          <div style={hero.searchWrap}>
            <svg style={hero.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref={searchRef}
              style={hero.searchInput}
              type="text"
              placeholder="Eser, yazar veya tür ara…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Eser, yazar veya tür ara"
            />
            {query && (
              <button
                style={hero.clearBtn}
                onClick={() => { setQuery(""); setActiveQuery(""); }}
                aria-label="Aramayı temizle"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tür filtreleri */}
          <div style={hero.genres} role="group" aria-label="Tür filtresi">
            <button
              style={{ ...hero.genreBtn, ...(genreFilter === "all" ? hero.genreBtnActive : {}) }}
              onClick={() => setGenreFilter("all")}
            >
              Tümü
            </button>
            {!genresLoading && genreList.map(({ genre, count }) => {
              const color  = GENRE_COLOR[genre] || "#888";
              const active = genreFilter === genre;
              return (
                <button
                  key={genre}
                  style={{
                    ...hero.genreBtn,
                    ...(active ? {
                      background:  color + "18",
                      color:       color,
                      borderColor: color + "40",
                      fontWeight:  500,
                    } : {}),
                  }}
                  onClick={() => setGenreFilter(active ? "all" : genre)}
                  title={`${count} eser`}
                  aria-pressed={active}
                >
                  {genre}
                  {count > 0 && (
                    <span style={{ marginLeft: 4, fontSize: ".58rem", opacity: .65, fontWeight: 400 }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            {genresLoading && (
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", color: "#b0a898", fontStyle: "italic" }}>
                Yükleniyor…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Ana içerik ── */}
      <main style={layout.main} className="ex-main-grid">

        {/* ── Sol: Feed / Keşfet / Arama ── */}
        <section style={layout.feed}>

          {/* Arama sonuçları */}
          {isSearching ? (
            <>
              <div style={layout.tabRow}>
                <button
                  style={{ ...layout.tab, ...(searchTab === "works" ? layout.tabActive : {}) }}
                  onClick={() => setSearchTab("works")}
                >
                  Eserler
                  {searchWorks.length > 0 && <span style={layout.tabCount}>{searchWorks.length}</span>}
                </button>
                <button
                  style={{ ...layout.tab, ...(searchTab === "users" ? layout.tabActive : {}) }}
                  onClick={() => setSearchTab("users")}
                >
                  Yazarlar
                  {searchUsers.length > 0 && <span style={layout.tabCount}>{searchUsers.length}</span>}
                </button>
              </div>

              {searchLoad ? (
                <div style={layout.spinnerWrap}><div style={layout.spinner} /></div>
              ) : searchTab === "works" ? (
                searchWorks.length === 0 ? (
                  <div style={layout.empty}>
                    <span style={{ fontSize: "2rem", opacity: .3 }}>📭</span>
                    <p style={layout.emptyText}>Eser bulunamadı.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {searchWorks.map((w, i) => <SearchWorkCard key={w._id} work={w} index={i} />)}
                  </div>
                )
              ) : (
                searchUsers.length === 0 ? (
                  <div style={layout.empty}>
                    <span style={{ fontSize: "2rem", opacity: .3 }}>👤</span>
                    <p style={layout.emptyText}>Yazar bulunamadı.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {searchUsers.map((u, i) => <SearchUserCard key={u._id} user={u} index={i} />)}
                  </div>
                )
              )}
            </>
          ) : (
            <>
              {/* Sekmeler — sadece üyeye göster */}
              {isLoggedIn && (
                <div style={layout.tabRow}>
                  <button
                    style={{ ...layout.tab, ...(mode === "feed" ? layout.tabActive : {}) }}
                    onClick={() => setMode("feed")}
                  >
                    Akış
                  </button>
                  <button
                    style={{ ...layout.tab, ...(mode === "explore" ? layout.tabActive : {}) }}
                    onClick={() => setMode("explore")}
                  >
                    Keşfet
                  </button>
                </div>
              )}

              {/* AKIŞ — sadece üyelere */}
              {mode === "feed" && isLoggedIn && (
                feedLoad && feedItems.length === 0 ? (
                  <div style={layout.spinnerWrap}><div style={layout.spinner} /></div>
                ) : feedEmpty || feedItems.length === 0 ? (
                  <div style={layout.empty}>
                    <span style={{ fontSize: "2.5rem", opacity: .25 }}>✦</span>
                    <p style={{ ...layout.emptyText, fontFamily: "'Playfair Display',serif", fontStyle: "italic" }}>
                      Akış henüz boş.
                    </p>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".8rem", color: "#b0a898", margin: "4px 0 1rem" }}>
                      Yazar takip etmeye başlayınca günlük girdileri ve yeni bölümler burada görünecek.
                    </p>
                    <button
                      style={{ padding: ".6rem 1.4rem", background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: ".8rem", cursor: "pointer" }}
                      onClick={() => setMode("explore")}
                    >
                      Yazarları Keşfet
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {feedItems.map(item =>
                        item.type === "log"
                          ? <LogCard     key={`log-${item._id}`} item={item} />
                          : <ChapterCard key={`ch-${item._id}`}  item={item} />
                      )}
                    </div>
                    {feedMore && (
                      <button style={layout.loadMore} onClick={() => loadFeed(feedPage + 1)} disabled={feedLoad}>
                        {feedLoad ? "Yükleniyor…" : "Daha fazla göster"}
                      </button>
                    )}
                  </>
                )
              )}

              {/* KEŞFET — hem misafir hem üye */}
              {(mode === "explore" || !isLoggedIn) && (
                discLoad ? (
                  <div style={layout.spinnerWrap}><div style={layout.spinner} /></div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {discWorks.length === 0 ? (
                      <div style={layout.empty}>
                        <span style={{ fontSize: "2rem", opacity: .3 }}>📚</span>
                        <p style={layout.emptyText}>
                          {genreFilter !== "all"
                            ? `"${genreFilter}" türünde yayınlanmış eser yok.`
                            : "Henüz yayınlanmış eser yok."}
                        </p>
                      </div>
                    ) : (
                      discWorks.map((w, i) => <SearchWorkCard key={w._id} work={w} index={i} />)
                    )}
                  </div>
                )
              )}
            </>
          )}
        </section>

        {/* ── Sağ: Sidebar ── */}
        <aside style={layout.sidebar} className="ex-sidebar">

          {/* Öne çıkan eserler */}
          <div style={side.box}>
            <h3 style={side.boxTitle}><span aria-hidden="true">📚</span> Öne Çıkan</h3>
            {discLoad ? (
              <p style={side.muted}>Yükleniyor…</p>
            ) : discWorks.slice(0, 5).length === 0 ? (
              <p style={side.muted}>Henüz eser yok.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {discWorks.slice(0, 5).map(w => <WorkCard key={w._id} work={w} />)}
              </div>
            )}
          </div>

          {/* Aktif yazarlar */}
          {discWriters.length > 0 && (
            <div style={{ ...side.box, marginTop: 14 }}>
              <h3 style={side.boxTitle}><span aria-hidden="true">✒</span> Aktif Yazarlar</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {discWriters.map(w => <WriterCard key={w._id} writer={w} />)}
              </div>
            </div>
          )}

          {/* Günün Günlükleri */}
          <div style={{ ...side.box, marginTop: 14 }}>
            <h3 style={side.boxTitle}><span aria-hidden="true">✨</span> Günün Günlükleri</h3>
            {topLogsLoad ? (
              <p style={side.muted}>Yükleniyor…</p>
            ) : topLogs.length === 0 ? (
              <p style={side.muted}>Henüz günlük girdi yok.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topLogs.map(log => (
                  <TopLogCard key={log._id} log={log} navigate={navigate} />
                ))}
              </div>
            )}
          </div>

          {/* Geri Bildirim Bekleyenler */}
          {needsReview.length > 0 && (
            <div style={{ ...side.box, marginTop: 14, border: "1px solid rgba(184,134,11,.2)", background: "rgba(184,134,11,.02)" }}>
              <h3 style={{ ...side.boxTitle, color: "#7a5c00" }}>
                <span aria-hidden="true">🔍</span> İlk Yorumu Sen Yap
              </h3>
              <p style={{ ...side.muted, marginBottom: 10, lineHeight: 1.55 }}>
                Az yorum almış, aktif yazarların yeni eserleri.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {needsReview.map(w => <NeedsReviewCard key={w._id} work={w} navigate={navigate} />)}
              </div>
            </div>
          )}

          {/* Misafir CTA — sidebar (login yapmış kullanıcıya gösterilmez) */}
          {!isLoggedIn && (
            <div style={guest.sideBox}>
              <p style={guest.sideTitle}>Sen de yaz.</p>
              <p style={guest.sideSub}>Hikâyeni paylaş, yazarlarla tanış.</p>
              <button style={guest.sideBtnPri} onClick={() => navigate("/register")}>
                Ücretsiz Katıl
              </button>
              <button style={guest.sideBtnGhost} onClick={() => navigate("/login")}>
                Giriş Yap
              </button>
            </div>
          )}
        </aside>
      </main>

      <Footer />

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 768px) {
          .ex-main-grid { grid-template-columns: 1fr !important; }
          .ex-sidebar   { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════ STİLLER ═══════════ */
const hero = {
  wrap:           { background: "#fff", borderBottom: "1px solid rgba(0,0,0,.06)", padding: "1.5rem 0 1.1rem" },
  inner:          { maxWidth: 1060, margin: "0 auto", padding: "0 1.5rem" },
  left:           { marginBottom: ".85rem" },
  title:          { fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 700, color: "#1a1209", margin: "0 0 .2rem" },
  sub:            { fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", color: "#9a8e80", margin: 0 },
  searchWrap:     { position: "relative", marginBottom: ".85rem" },
  searchIcon:     { position: "absolute", left: ".85rem", top: "50%", transform: "translateY(-50%)", color: "#b0a898", pointerEvents: "none" },
  searchInput:    { width: "100%", padding: ".65rem .85rem .65rem 2.5rem", border: "1.5px solid #e2ddd6", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: "#1a1209", background: "#faf8f4", outline: "none", boxSizing: "border-box" },
  clearBtn:       { position: "absolute", right: ".85rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#b0a898", fontSize: ".8rem", padding: 0 },
  genres:         { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" },
  genreBtn:       { padding: "4px 10px", background: "transparent", border: "1px solid #e2ddd6", borderRadius: 20, fontFamily: "'DM Sans', sans-serif", fontSize: ".72rem", color: "#9a8e80", cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" },
  genreBtnActive: { background: "#1a120912", color: "#1a1209", borderColor: "#c8bfad", fontWeight: 500 },
};

const layout = {
  main:        { maxWidth: 1060, margin: "0 auto", padding: "1.5rem 1.5rem 4rem", display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" },
  feed:        { minWidth: 0 },
  sidebar:     { position: "sticky", top: 76 },
  tabRow:      { display: "flex", gap: 0, borderBottom: "1px solid #e8e2d8", marginBottom: "1.25rem" },
  tab:         { padding: ".5rem 1rem", background: "none", border: "none", borderBottom: "2px solid transparent", marginBottom: -1, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 500, color: "#9a8e80", cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: 6 },
  tabActive:   { color: "#1a1209", borderBottomColor: "#b8860b" },
  tabCount:    { background: "#b8860b", color: "#fff", borderRadius: 20, fontSize: ".6rem", padding: "1px 6px", fontWeight: 700 },
  spinnerWrap: { display: "flex", justifyContent: "center", padding: "3rem 0" },
  spinner:     { width: 26, height: 26, border: "2px solid #e2ddd6", borderTop: "2px solid #b8860b", borderRadius: "50%", animation: "spin .9s linear infinite" },
  loadMore:    { display: "block", width: "100%", marginTop: 14, padding: "10px", background: "transparent", border: "1px solid #e2ddd6", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", color: "#7a6e5f", cursor: "pointer" },
  empty:       { textAlign: "center", padding: "3.5rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  emptyText:   { fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: ".88rem", color: "#9a8e80", margin: 0 },
};

const card = {
  wrap:         { background: "#fff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 10, padding: "14px 16px", animation: "fadeUp .3s ease both" },
  top:          { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  authorBtn:    { display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0 },
  authorName:   { display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", fontWeight: 500, color: "#1a1209" },
  time:         { display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: ".65rem", color: "#a8a29e", marginTop: 1 },
  badgeLog:     { fontSize: ".63rem", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, background: "rgba(139,37,0,.06)", color: "#8b2500", padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" },
  badgeChapter: { fontSize: ".63rem", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, background: "rgba(15,110,86,.07)", color: "#0f6e56", padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" },
  logText:      { fontFamily: "'Lora', serif", fontSize: ".9rem", color: "#44403c", lineHeight: 1.7, margin: "0 0 10px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  workTag:      { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(184,134,11,.07)", border: "1px solid rgba(184,134,11,.18)", borderRadius: 6, marginBottom: 10, fontFamily: "'DM Sans',sans-serif", fontSize: ".7rem", color: "#7a5c00", fontWeight: 500, cursor: "pointer" },
  workTagImg:   { width: 14, height: 20, borderRadius: 2, objectFit: "cover" },
  footer:       { display: "flex", gap: 12, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,.04)" },
  actionBtn:    { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: ".7rem", padding: "2px 0", transition: "color .15s" },
  chapterBtn:   { display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,.02)", border: "1px solid rgba(0,0,0,.05)", borderRadius: 8, padding: "10px 12px", cursor: "pointer", width: "100%", transition: "background .15s" },
  chCover:      { width: 34, height: 48, borderRadius: 4, objectFit: "cover", flexShrink: 0 },
  chCoverPh:    { width: 34, height: 48, borderRadius: 4, background: "linear-gradient(145deg,#ede9e0,#ddd5c4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chWorkTitle:  { fontFamily: "'Playfair Display',serif", fontSize: ".88rem", fontWeight: 700, color: "#1a1209", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chTitle:      { fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", color: "#9a8e80", margin: 0 },
};

const side = {
  box:         { background: "#fff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 10, padding: "14px" },
  boxTitle:    { fontFamily: "'Playfair Display',serif", fontSize: ".95rem", fontWeight: 700, color: "#1a1209", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 },
  muted:       { fontFamily: "'DM Sans',sans-serif", fontSize: ".75rem", color: "#a8a29e", fontStyle: "italic", margin: 0 },
  workCard:    { display: "flex", alignItems: "center", gap: 9, padding: "7px 4px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, width: "100%", transition: "background .15s" },
  cover:       { width: 32, height: 46, borderRadius: 4, objectFit: "cover", flexShrink: 0 },
  coverPh:     { width: 32, height: 46, borderRadius: 4, background: "linear-gradient(145deg,#ede9e0,#ddd5c4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  workTitle:   { fontFamily: "'Playfair Display',serif", fontSize: ".82rem", fontWeight: 700, color: "#1a1209", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  workMeta:    { fontFamily: "'DM Sans',sans-serif", fontSize: ".65rem", color: "#9a8e80", margin: "0 0 3px" },
  chCount:     { fontFamily: "'DM Sans',sans-serif", fontSize: ".62rem", color: "#b0a898" },
  writerCard:  { display: "flex", alignItems: "center", gap: 9, padding: "7px 4px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, width: "100%", transition: "background .15s" },
  writerName:  { fontFamily: "'DM Sans',sans-serif", fontSize: ".83rem", fontWeight: 500, color: "#1a1209", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  writerBio:   { fontFamily: "'Lora',serif", fontStyle: "italic", fontSize: ".7rem", color: "#9a8e80", margin: 0, lineHeight: 1.4 },
  topLogCard:  { display: "flex", flexDirection: "column", gap: 4, padding: "9px 6px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, width: "100%", textAlign: "left", transition: "background .15s" },
  reviewCard:  { display: "flex", alignItems: "center", gap: 9, padding: "8px 4px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, width: "100%", transition: "background .15s" },
};

const srch = {
  card:    { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#fff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 10, cursor: "pointer", width: "100%", transition: "border-color .15s", animation: "fadeUp .3s ease both" },
  cover:   { width: 40, height: 58, borderRadius: 5, objectFit: "cover", flexShrink: 0 },
  coverPh: { width: 40, height: 58, borderRadius: 5, background: "linear-gradient(145deg,#ede9e0,#ddd5c4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title:   { fontFamily: "'Playfair Display',serif", fontSize: ".9rem", fontWeight: 700, color: "#1a1209", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  author:  { fontFamily: "'DM Sans',sans-serif", fontSize: ".72rem", color: "#9a8e80", margin: "0 0 3px" },
  desc:    { fontFamily: "'Lora',serif", fontStyle: "italic", fontSize: ".78rem", color: "#7a6e5f", margin: 0, lineHeight: 1.5 },
};

/* Misafir hero stilleri */
const guest = {
  banner:      { background: "#1a1209", padding: "3rem 0 2.5rem", borderBottom: "1px solid rgba(255,255,255,.06)" },
  bannerInner: { maxWidth: 1060, margin: "0 auto", padding: "0 1.5rem", display: "grid", gridTemplateColumns: "1fr auto", gap: 48, alignItems: "center" },
  bannerLeft:  {},
  rule:        { width: 36, height: 3, background: "#8b2500", marginBottom: "1.2rem" },
  title:       { fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, color: "#f5f0e8", lineHeight: 1.15, margin: "0 0 .85rem" },
  titleEm:     { fontStyle: "italic", color: "#d4a853", fontWeight: 400 },
  sub:         { fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: ".95rem", color: "rgba(245,240,232,.6)", lineHeight: 1.7, margin: "0 0 1.75rem", maxWidth: 400 },
  btns:        { display: "flex", gap: 10, flexWrap: "wrap" },
  btnPri:      { padding: ".75rem 1.75rem", background: "#8b2500", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", fontWeight: 500, cursor: "pointer", letterSpacing: ".03em" },
  btnGhost:    { padding: ".75rem 1.75rem", background: "transparent", color: "rgba(245,240,232,.7)", border: "1px solid rgba(245,240,232,.2)", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", cursor: "pointer" },
  stats:       { display: "flex", gap: 0, alignItems: "center" },
  statItem:    { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 1.5rem" },
  statNum:     { fontSize: "1.5rem" },
  statLabel:   { fontFamily: "'DM Sans', sans-serif", fontSize: ".7rem", color: "rgba(245,240,232,.5)", whiteSpace: "nowrap" },
  statDivider: { width: 1, height: 36, background: "rgba(255,255,255,.1)" },
  // Sidebar CTA
  sideBox:     { marginTop: 14, background: "#1a1209", border: "none", borderRadius: 10, padding: "18px 16px", textAlign: "center" },
  sideTitle:   { fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: "1rem", color: "#f5f0e8", margin: "0 0 .35rem" },
  sideSub:     { fontFamily: "'DM Sans',sans-serif", fontSize: ".73rem", color: "rgba(245,240,232,.45)", margin: "0 0 1rem", lineHeight: 1.55 },
  sideBtnPri:  { display: "block", width: "100%", padding: ".65rem", background: "#8b2500", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: ".8rem", fontWeight: 500, cursor: "pointer", marginBottom: 6 },
  sideBtnGhost:{ display: "block", width: "100%", padding: ".55rem", background: "transparent", color: "rgba(245,240,232,.5)", border: "1px solid rgba(245,240,232,.15)", borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: ".75rem", cursor: "pointer" },
};