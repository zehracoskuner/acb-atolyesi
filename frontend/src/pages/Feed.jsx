// src/pages/Feed.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import { apiGet, apiPost } from "../lib/api";

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

function GenreChips({ work, max = 2 }) {
  const genres = work.universe?.genres;
  if (!genres || genres.length === 0) return null;
  const visible = genres.slice(0, max);
  const extra   = genres.length - max;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
      {visible.map(g => (
        <span key={g} style={{
          display: "inline-block", padding: "1px 6px", borderRadius: 20,
          fontSize: ".58rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
          background: (GENRE_COLOR[g] || "#888") + "18", color: GENRE_COLOR[g] || "#888",
        }}>{g}</span>
      ))}
      {extra > 0 && (
        <span style={{ fontSize: ".58rem", fontFamily: "'DM Sans',sans-serif", color: "#b0a898" }}>+{extra}</span>
      )}
    </div>
  );
}

function Avatar({ user, size = 38 }) {
  const name = user?.kullaniciAdi || user?.username || "?";
  return user?.avatarUrl ? (
    <img src={user.avatarUrl} alt={name}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "#e2ddd6",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Playfair Display', serif", fontSize: size * 0.38,
      fontWeight: 700, color: "#7a6e5f", flexShrink: 0,
    }}>
      {name[0].toUpperCase()}
    </div>
  );
}

/* ── Günlük girdisi kartı ── */
function LogCard({ item }) {
  const navigate = useNavigate();
  const [liked,     setLiked]     = useState(item.likedByMe);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const isLoggedIn = !!localStorage.getItem("token");

  async function handleLike() {
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
    <div style={c.card}>
      <div style={c.cardTop}>
        <button
          style={c.authorBtn}
          onClick={() => navigate(`/profile/${item.author._id}`)}
          aria-label={`${item.author?.kullaniciAdi} profiline git`}
        >
          <Avatar user={item.author} />
          <div>
            <span style={c.authorName}>{item.author?.kullaniciAdi}</span>
            <span style={c.cardTime}>{timeAgo(item.createdAt)}</span>
          </div>
        </button>
        <span style={c.typeBadgeLog}>✒ Günlük</span>
      </div>

      <p style={c.logContent}>{item.content}</p>

      {item.relatedWork && (
        <button
          style={c.workTag}
          onClick={() => navigate(`/story/${item.relatedWork._id}`)}
          aria-label={`${item.relatedWork.title} eserine git`}
        >
          {item.relatedWork.coverImage && (
            <img src={item.relatedWork.coverImage} alt="" style={c.workTagCover} />
          )}
          <span>{item.relatedWork.title}</span>
        </button>
      )}

      <div style={c.cardFooter}>
        <button
          style={{ ...c.likeBtn, color: liked ? "#e24b4a" : "#a8a29e" }}
          onClick={handleLike}
          aria-label={liked ? "Beğeniyi kaldır" : "Beğen"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
      </div>
    </div>
  );
}

/* ── Yeni bölüm kartı ── */
function ChapterCard({ item }) {
  const navigate  = useNavigate();
  const [liked,     setLiked]     = useState(item.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(item.likeCount ?? 0);
  const isLoggedIn = !!localStorage.getItem("token");

  async function handleLike() {
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
    <div style={c.card}>
      <div style={c.cardTop}>
        <button
          style={c.authorBtn}
          onClick={() => navigate(`/profile/${item.author._id}`)}
          aria-label={`${item.author?.kullaniciAdi} profiline git`}
        >
          <Avatar user={item.author} />
          <div>
            <span style={c.authorName}>{item.author?.kullaniciAdi}</span>
            <span style={c.cardTime}>{timeAgo(item.createdAt)}</span>
          </div>
        </button>
        <span style={c.typeBadgeChapter}>📖 Yeni Bölüm</span>
      </div>

      <button
        style={c.chapterBtn}
        onClick={() => navigate(`/story/${item.work._id}`)}
        aria-label={`${item.work.title} eserine git`}
      >
        <div style={c.chapterBtnInner}>
          {item.work.coverImage ? (
            <img src={item.work.coverImage} alt="" style={c.chapterCover} />
          ) : (
            <div style={c.chapterCoverPlaceholder}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: ".9rem", fontWeight: 700, color: "rgba(0,0,0,.18)" }}>
                {item.work.title?.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div style={c.chapterInfo}>
            <p style={c.chapterWorkTitle}>{item.work.title}</p>
            <p style={c.chapterTitle}>
              {item.chapter.order ? `Bölüm ${item.chapter.order}` : ""}
              {item.chapter.title ? ` · ${item.chapter.title}` : ""}
            </p>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8bfad" strokeWidth="2" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>

      <div style={{ ...c.cardFooter, marginTop: 10 }}>
        <button
          style={{ ...c.likeBtn, color: liked ? "#e24b4a" : "#a8a29e" }}
          onClick={handleLike}
          aria-label={liked ? "Beğeniyi kaldır" : "Beğen"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
      </div>
    </div>
  );
}

/* ── Keşfet: eser kartı ── */
function DiscoverWork({ work }) {
  const navigate = useNavigate();
  return (
    <button
      style={dc.workCard}
      onClick={() => navigate(`/story/${work._id}`)}
      aria-label={`${work.title} eserine git`}
    >
      {work.coverImage ? (
        <img src={work.coverImage} alt={work.title} style={dc.workCover} />
      ) : (
        <div style={dc.workCoverPh}>
          <span style={dc.workInitials}>{work.title?.slice(0, 2).toUpperCase()}</span>
        </div>
      )}
      <div style={dc.workInfo}>
        <p style={dc.workTitle}>{work.title}</p>
        <p style={dc.workMeta}>{work.isAnonymous ? "Anonim Yazar" : (work.author?.kullaniciAdi || work.author?.username || "Yazar")}</p>
        <GenreChips work={work} max={2} />
        <p style={dc.workChapters}>{work.chapterCount} bölüm</p>
      </div>
    </button>
  );
}

/* ── Keşfet: yazar kartı ── */
function DiscoverWriter({ writer }) {
  const navigate = useNavigate();
  return (
    <button
      style={dc.writerCard}
      onClick={() => navigate(`/profile/${writer._id}`)}
      aria-label={`${writer.kullaniciAdi} profiline git`}
    >
      <Avatar user={writer} size={40} />
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={dc.writerName}>{writer.kullaniciAdi}</p>
        {writer.bio && (
          <p style={dc.writerBio}>{writer.bio.slice(0, 60)}{writer.bio.length > 60 ? "…" : ""}</p>
        )}
      </div>
    </button>
  );
}

/* ── Boş feed ── */
function EmptyFeed() {
  const navigate = useNavigate();
  return (
    <div style={c.empty}>
      <div style={c.emptyIcon}>✦</div>
      <h3 style={c.emptyTitle}>Akış henüz boş</h3>
      <p style={c.emptySub}>
        Yazar takip etmeye başlayınca günlük girdileri ve yeni bölümler burada görünecek.
      </p>
      <button style={c.emptyBtn} onClick={() => navigate("/kesfet")}>
        Yazarları Keşfet
      </button>
    </div>
  );
}

/* ── Landing (giriş yapmamış) ── */
function Landing({ discover, discLoading }) {
  const navigate = useNavigate();
  return (
    <div style={land.wrap}>
      <div style={land.hero}>
        <div style={land.heroInner}>
          <div style={land.rule} />
          <h1 style={land.title}>
            Hikâyeni<br />
            <em style={land.titleEm}>yazmaya</em><br />
            hazır mısın?
          </h1>
          <p style={land.sub}>
            Acemi yazarların buluştuğu atölyeye katıl.
            Eserlerini paylaş, yazarları takip et, toplulukla büyü.
          </p>
          <div style={land.btns}>
            <button style={land.btnPri}   onClick={() => navigate("/register")}>Ücretsiz Katıl</button>
            <button style={land.btnGhost} onClick={() => navigate("/login")}>Giriş Yap</button>
          </div>
          <button style={land.discoverLink} onClick={() => navigate("/kesfet")}>
            Eserlere göz at →
          </button>
        </div>

        {/* Sağ: öne çıkan eserler önizlemesi */}
        <div style={land.preview}>
          <p style={land.previewLabel}>Öne Çıkan Eserler</p>
          {discLoading ? (
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".78rem", color: "#b0a898", fontStyle: "italic" }}>
              Yükleniyor…
            </p>
          ) : discover.works.slice(0, 4).map(w => (
            <button
              key={w._id}
              style={land.previewCard}
              onClick={() => navigate(`/story/${w._id}`)}
              aria-label={`${w.title} eserine git`}
            >
              {w.coverImage ? (
                <img src={w.coverImage} alt={w.title} style={land.previewCover} />
              ) : (
                <div style={land.previewCoverPh}>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontSize: ".75rem", fontWeight: 700, color: "rgba(0,0,0,.2)" }}>
                    {w.title?.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <p style={land.previewTitle}>{w.title}</p>
                <p style={land.previewMeta}>{w.isAnonymous ? "Anonim Yazar" : (w.author?.kullaniciAdi || w.author?.username || "Yazar")}</p>
              </div>
            </button>
          ))}
        </div>

        <div style={land.heroPattern} aria-hidden="true" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ANA SAYFA
══════════════════════════════════════════════ */
export default function Feed() {
  const navigate   = useNavigate();
  const isLoggedIn = !!localStorage.getItem("token");

  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [isEmpty,     setIsEmpty]     = useState(false);
  const [discover,    setDiscover]    = useState({ works: [], writers: [] });
  const [discLoading, setDiscLoading] = useState(true);

  useEffect(() => {
    document.title = "Akış · ACB Atölyesi";
    loadDiscover();
    if (isLoggedIn) loadFeed(1, true);
    else setLoading(false);
  }, [isLoggedIn]);

  async function loadFeed(p = 1, reset = false) {
    try {
      setLoading(true);
      const res = await apiGet(`/feed?page=${p}`);
      setItems(prev => reset ? res.items : [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setIsEmpty(res.isEmpty);
      setPage(p);
    } catch {
      // TODO: kullanıcıya hata bildirimi ekle (toast)
    } finally {
      setLoading(false);
    }
  }

  async function loadDiscover() {
    try {
      const res = await apiGet("/feed/discover");
      setDiscover(res);
    } catch {
      // sessiz hata
    } finally {
      setDiscLoading(false);
    }
  }

  if (!isLoggedIn) return (
    <>
      <TopBar />
      <Landing discover={discover} discLoading={discLoading} />
      <Footer />
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'DM Sans', sans-serif" }}>
      <TopBar />

      <main style={layout.main}>
        {/* ── Sol: Feed ── */}
        <section style={layout.feed}>
          <h2 style={layout.feedTitle}>Akış</h2>

          {loading && items.length === 0 ? (
            <div style={c.loadingWrap}><div style={c.spinner} /></div>
          ) : isEmpty || items.length === 0 ? (
            <EmptyFeed />
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {items.map(item =>
                  item.type === "log"
                    ? <LogCard     key={`log-${item._id}`} item={item} />
                    : <ChapterCard key={`ch-${item._id}`}  item={item} />
                )}
              </div>
              {hasMore && (
                <button
                  style={c.loadMore}
                  onClick={() => loadFeed(page + 1)}
                  disabled={loading}
                  aria-label="Daha fazla içerik yükle"
                >
                  {loading ? "Yükleniyor…" : "Daha fazla göster"}
                </button>
              )}
            </>
          )}
        </section>

        {/* ── Sağ: Keşfet ── */}
        <aside style={layout.sidebar}>
          <div style={dc.box}>
            <h3 style={dc.boxTitle}>Öne Çıkan Eserler</h3>
            {discLoading ? (
              <p style={dc.loadingText}>Yükleniyor…</p>
            ) : discover.works.length === 0 ? (
              <p style={dc.emptyText}>Henüz eser yok.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {discover.works.map(w => <DiscoverWork key={w._id} work={w} />)}
              </div>
            )}
            <button style={dc.seeAll} onClick={() => navigate("/kesfet")}>
              Tüm eserleri gör →
            </button>
          </div>

          {discover.writers.length > 0 && (
            <div style={{ ...dc.box, marginTop: 16 }}>
              <h3 style={dc.boxTitle}>Aktif Yazarlar</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {discover.writers.map(w => <DiscoverWriter key={w._id} writer={w} />)}
              </div>
            </div>
          )}
        </aside>
      </main>

      <Footer />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .feed-main {
            grid-template-columns: 1fr !important;
          }
          .feed-sidebar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════
   STİLLER
═══════════════════ */
const layout = {
  main:      {
    maxWidth: 1060, margin: "0 auto", padding: "2rem 1.5rem 4rem",
    display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start",
  },
  feed:      { minWidth: 0 },
  feedTitle: { fontFamily: "'Playfair Display', serif", fontSize: "1.35rem", fontWeight: 700, color: "#1a1209", margin: "0 0 1.25rem" },
  sidebar:   { position: "sticky", top: 80 },
};

const c = {
  card:                    { background: "#fff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 10, padding: "16px 18px" },
  cardTop:                 { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  authorBtn:               { display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 },
  authorName:              { display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 500, color: "#1a1209" },
  cardTime:                { display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: ".68rem", color: "#a8a29e", marginTop: 1 },
  // Tip badge'leri ayrıştırıldı — inline override yok
  typeBadgeLog:            { fontSize: ".65rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, background: "rgba(139,37,0,.06)", color: "#8b2500", padding: "3px 8px", borderRadius: 20, letterSpacing: ".03em", whiteSpace: "nowrap" },
  typeBadgeChapter:        { fontSize: ".65rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, background: "rgba(15,110,86,.08)", color: "#0f6e56", padding: "3px 8px", borderRadius: 20, letterSpacing: ".03em", whiteSpace: "nowrap" },
  logContent:              { fontFamily: "'Lora', serif", fontSize: ".92rem", color: "#44403c", lineHeight: 1.72, margin: "0 0 10px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  workTag:                 { display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px", background: "rgba(184,134,11,.07)", border: "1px solid rgba(184,134,11,.2)", borderRadius: 6, marginBottom: 10, fontFamily: "'DM Sans', sans-serif", fontSize: ".72rem", color: "#7a5c00", fontWeight: 500, cursor: "pointer" },
  workTagCover:            { width: 16, height: 22, borderRadius: 2, objectFit: "cover" },
  cardFooter:              { display: "flex", gap: 12, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,.05)" },
  likeBtn:                 { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: ".72rem", padding: "2px 0", transition: "color .15s" },
  chapterBtn:              { display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,.02)", border: "1px solid rgba(0,0,0,.06)", borderRadius: 8, padding: "10px 14px", cursor: "pointer", width: "100%", transition: "background .15s" },
  chapterBtnInner:         { display: "flex", alignItems: "center", gap: 12 },
  chapterCover:            { width: 36, height: 52, borderRadius: 4, objectFit: "cover", flexShrink: 0 },
  chapterCoverPlaceholder: { width: 36, height: 52, borderRadius: 4, background: "linear-gradient(145deg,#ede9e0,#ddd5c4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chapterInfo:             { textAlign: "left" },
  chapterWorkTitle:        { fontFamily: "'Playfair Display', serif", fontSize: ".9rem", fontWeight: 700, color: "#1a1209", margin: "0 0 3px" },
  chapterTitle:            { fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", color: "#9a8e80", margin: 0 },
  loadMore:                { display: "block", width: "100%", marginTop: 16, padding: "10px", background: "transparent", border: "1px solid #e2ddd6", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", color: "#7a6e5f", cursor: "pointer" },
  loadingWrap:             { display: "flex", justifyContent: "center", padding: "3rem 0" },
  spinner:                 { width: 28, height: 28, border: "2px solid #e2ddd6", borderTop: "2px solid #b8860b", borderRadius: "50%", animation: "spin .9s linear infinite" },
  empty:                   { textAlign: "center", padding: "4rem 1rem" },
  emptyIcon:               { fontSize: "2.5rem", opacity: .3, marginBottom: "1rem" },
  emptyTitle:              { fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 700, color: "#1a1209", margin: "0 0 .5rem" },
  emptySub:                { fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: ".88rem", color: "#9a8e80", margin: "0 0 1.5rem", lineHeight: 1.65 },
  emptyBtn:                { padding: ".65rem 1.5rem", background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 500, cursor: "pointer" },
};

const dc = {
  box:         { background: "#fff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 10, padding: "16px" },
  boxTitle:    { fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "#1a1209", margin: "0 0 12px" },
  loadingText: { fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", color: "#a8a29e", fontStyle: "italic", margin: 0 },
  emptyText:   { fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", color: "#a8a29e", fontStyle: "italic", margin: 0 },
  workCard:    { display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, width: "100%", textAlign: "left" },
  workCover:   { width: 36, height: 52, borderRadius: 5, objectFit: "cover", flexShrink: 0 },
  workCoverPh: { width: 36, height: 52, borderRadius: 5, background: "linear-gradient(145deg,#ede9e0,#ddd5c4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  workInitials:{ fontFamily: "'Playfair Display', serif", fontSize: ".75rem", fontWeight: 700, color: "rgba(0,0,0,.2)" },
  workInfo:    { flex: 1, minWidth: 0 },
  workTitle:   { fontFamily: "'Playfair Display', serif", fontSize: ".85rem", fontWeight: 700, color: "#1a1209", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  workMeta:    { fontFamily: "'DM Sans', sans-serif", fontSize: ".68rem", color: "#9a8e80", margin: "0 0 2px" },
  workChapters:{ fontFamily: "'DM Sans', sans-serif", fontSize: ".65rem", color: "#b0a898", margin: "2px 0 0" },
  seeAll:      { display: "block", width: "100%", marginTop: 10, padding: "7px", background: "transparent", border: "1px solid #e8e2d8", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".72rem", color: "#9a8e80", cursor: "pointer", textAlign: "center" },
  writerCard:  { display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, width: "100%" },
  writerName:  { fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 500, color: "#1a1209", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  writerBio:   { fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: ".72rem", color: "#9a8e80", margin: 0, lineHeight: 1.4 },
};

const land = {
  wrap:          { minHeight: "calc(100vh - 63px)", background: "#f7f5f0" },
  hero:          { maxWidth: 1060, margin: "0 auto", padding: "5rem 1.5rem 4rem", position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" },
  heroInner:     { position: "relative", zIndex: 1 },
  rule:          { width: 40, height: 3, background: "#8b2500", marginBottom: "1.5rem" },
  title:         { fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.2rem, 5vw, 3.6rem)", fontWeight: 700, color: "#1a1209", lineHeight: 1.1, margin: "0 0 1.25rem" },
  titleEm:       { fontStyle: "italic", color: "#8b2500", fontWeight: 400 },
  sub:           { fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: "1rem", color: "#7a6e5f", lineHeight: 1.7, margin: "0 0 2rem", maxWidth: 420 },
  btns:          { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1rem" },
  btnPri:        { padding: ".8rem 2rem", background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", fontWeight: 500, cursor: "pointer", letterSpacing: ".04em" },
  btnGhost:      { padding: ".8rem 2rem", background: "transparent", color: "#1a1209", border: "1.5px solid #c8bfad", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", fontWeight: 500, cursor: "pointer" },
  discoverLink:  { background: "none", border: "none", padding: 0, fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", color: "#8b2500", cursor: "pointer", fontWeight: 500, letterSpacing: ".02em" },
  // Sağ sütun: önizleme
  preview:       { background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 12, padding: "20px", position: "relative", zIndex: 1 },
  previewLabel:  { fontFamily: "'Playfair Display', serif", fontSize: ".95rem", fontWeight: 700, color: "#1a1209", margin: "0 0 12px" },
  previewCard:   { display: "flex", alignItems: "center", gap: 10, padding: "7px 4px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, width: "100%", textAlign: "left", marginBottom: 2 },
  previewCover:  { width: 32, height: 46, borderRadius: 4, objectFit: "cover", flexShrink: 0 },
  previewCoverPh:{ width: 32, height: 46, borderRadius: 4, background: "linear-gradient(145deg,#ede9e0,#ddd5c4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  previewTitle:  { fontFamily: "'Playfair Display', serif", fontSize: ".85rem", fontWeight: 700, color: "#1a1209", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  previewMeta:   { fontFamily: "'DM Sans', sans-serif", fontSize: ".68rem", color: "#9a8e80", margin: 0 },
  heroPattern:   { position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 28px, rgba(0,0,0,.012) 28px, rgba(0,0,0,.012) 29px), repeating-linear-gradient(-45deg, transparent, transparent 28px, rgba(0,0,0,.012) 28px, rgba(0,0,0,.012) 29px)", zIndex: 0, borderRadius: 12 },
};