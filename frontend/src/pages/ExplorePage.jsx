import { useMembership } from "../lib/membershipContext";
// src/pages/ExplorePage.jsx
import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import { Search, ArrowRight, BookOpen, PenLine, X } from "lucide-react";
import "../styles/ExplorePage.css";
import "../styles/SpotlightHero.css";
import { apiGet } from "../lib/api";
import WorkshopFeed from "../components/feed/WorkshopFeed";
import { Avatar } from "../components/feed/FeedCards";
import { timeAgo } from "../components/feed/feedPresentation";
import useSpotlight from "../hooks/useSpotlight";

function WorkCover({ work }) {
  const [failedSource, setFailedSource] = useState(null);
  return <div className="explore-cover">
    {work.coverImage && failedSource !== work.coverImage
      ? <img src={work.coverImage} alt={`${work.title} eserinin kapağı`} loading="lazy" onError={() => setFailedSource(work.coverImage)} />
      : <div className="explore-cover-fallback"><BookOpen size={26} aria-hidden="true" /><span>{work.title || "İsimsiz eser"}</span><small>ACB ATÖLYESİ</small></div>}
  </div>;
}

function WorkAuthor({ work }) {
  const author = work.isAnonymous ? "Anonim Yazar" : work.author?.kullaniciAdi || work.author?.username || "Yazar";
  return !work.isAnonymous && work.author?._id
    ? <Link className="explore-author" to={`/profile/${work.author._id}`}>{author}</Link>
    : <span className="explore-author">{author}</span>;
}

export function SpotlightHero({ work, isLoggedIn, onDiscover, onJoin, showJoin }) {
  const genres = work?.universe?.genres || [];
  return <section className={`reading-invitation${work ? " has-spotlight" : ""}`} aria-labelledby="explore-title">
    <header className="reading-invitation-header">
      <div><p className="explore-eyebrow">ACB ATÖLYESİ · KEŞFET</p><h1 id="explore-title" data-tour="kesfet-baslik">Bambaşka evrenlerle tanış.<span> Sana hitap eden kitapları keşfet.</span></h1></div>
      <div className="reading-invitation-actions"><button onClick={onDiscover}>Hikâyeleri keşfet <ArrowRight size={15} aria-hidden="true" /></button>{isLoggedIn ? <Link to="/studio">Atölyeme git</Link> : showJoin && <button onClick={onJoin}>Aramıza katıl</button>}</div>
    </header>
    {work ? <article className="reading-spotlight" aria-labelledby="spotlight-work-title">
      <div className="spotlight-stage">
        <span className="spotlight-stage-label">ATÖLYENİN IŞIĞINDA</span>
        <span className="spotlight-beam" aria-hidden="true" />
        <span className="spotlight-halo" aria-hidden="true" />
        <Link className="spotlight-book" to={`/story/${work._id}`} aria-label={`${work.title}: eseri incele`}><WorkCover work={work} /></Link>
        <span className="spotlight-stage-caption">Bir kapak. Başka bir dünya.</span>
      </div>
      <div className="spotlight-story">
        <p className="spotlight-kicker"><span aria-hidden="true" />ŞİMDİ IŞIKLAR ONDA</p>
        <h2 id="spotlight-work-title"><Link to={`/story/${work._id}`}>{work.title || "İsimsiz eser"}</Link></h2>
        <WorkAuthor work={work} />
        <div className="spotlight-book-details">{genres.slice(0, 2).map(genre => <span key={genre}>{genre}</span>)}{work.chapterCount > 0 && <span>{work.chapterCount} bölüm</span>}</div>
        <p className="spotlight-description">{work.description || work.preface || "Bazı dünyalara bir cümleyle girilir. Bu hikâyenin ilk sayfasında seni ne bekliyor?"}</p>
        <div className="spotlight-story-actions"><Link className="spotlight-read" to={isLoggedIn ? `/read/${work._id}` : `/story/${work._id}`}><BookOpen size={17} aria-hidden="true" />{isLoggedIn ? "Okumaya başla" : "Hikâyeyi keşfet"}<ArrowRight size={18} aria-hidden="true" /></Link>{isLoggedIn && <Link className="spotlight-details" to={`/story/${work._id}`}>Eseri incele</Link>}</div>
        <p className="spotlight-postscript">Dışarıdaki dünya biraz bekleyebilir.</p>
      </div>
    </article> : <div className="reading-invitation-empty"><BookOpen size={30} aria-hidden="true" /><p>Her hikâye, başka bir dünyaya açılan kapı.</p><span>Yeni kalemleri keşfet, sevdiğin hikâyelere eşlik et.</span></div>}
  </section>;
}

export function ExploreWorkCard({ work, featured = false }) {
  const genres = work.universe?.genres || [];
  const age = Date.now() - new Date(work.updatedAt).getTime();
  const recentlyUpdated = age >= 0 && age < 7 * 86400000;
  return <article className={`explore-work-card${featured ? " explore-work-featured" : ""}`}>
    <Link to={`/story/${work._id}`} className="explore-cover-link" aria-label={`${work.title}: eseri incele`}><WorkCover work={work} /></Link>
    <div className="explore-work-content">
      {featured && <p className="explore-eyebrow">YAKINDAN BAK</p>}
      <h3><Link to={`/story/${work._id}`}>{work.title || "İsimsiz eser"}</Link></h3>
      <WorkAuthor work={work} />
      {genres.length > 0 && <div className="explore-tags">{genres.slice(0, 2).map(g => <span key={g}>{g}</span>)}</div>}
      {(work.description || work.preface) && <p className="explore-description">{work.description || work.preface}</p>}
      {recentlyUpdated && <p className="explore-activity"><span aria-hidden="true" />Bu hafta güncellendi</p>}
      <div className="explore-card-bottom">
        {work.chapterCount != null && <small>{work.chapterCount} bölüm</small>}
        <Link to={`/story/${work._id}`} aria-label={`${work.title}: eseri incele`}>Eseri incele <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </div>
  </article>;
}

export function DiscoveryShelf({ works, voices = [] }) {
  const firstWorks = works.slice(0, 4);
  const remaining = works.slice(4);
  const darkGenres = ["Gotik", "Korku", "Psikolojik Gerilim", "Distopya", "Gizem"];
  const darkWorks = remaining.filter(work => work.universe?.genres?.some(g => darkGenres.includes(g)));
  const otherWorks = remaining.filter(work => !darkWorks.includes(work));
  return <>
    <div className={`explore-work-grid explore-shelf${works.length <= 2 ? " explore-shelf-small" : ""}`}>
      {firstWorks.map((work, index) => <ExploreWorkCard key={work._id} work={work} featured={index === 0 && works.length <= 2} />)}
    </div>
    {voices.length > 0 && <section className="explore-voices" aria-labelledby="explore-voices-title">
      <div className="explore-voices-heading"><p className="explore-eyebrow">SATIR ARASINDA BULUŞALIM</p><h2 id="explore-voices-title">Atölyeden sesler</h2><p>Günlüklerden, yazanların kendi sesiyle.</p></div>
      <div className="explore-voice-grid">{voices.slice(0, 3).map(log => <figure key={log._id}>
        <blockquote>{log.content}</blockquote>
        <figcaption><Avatar user={log.author} size={28} /><div>{log.author?._id ? <Link to={`/profile/${log.author._id}`}>{log.author.kullaniciAdi || "Yazar"}</Link> : <span>Bir atölye üyesi</span>}<small>Günlüğünden · {timeAgo(log.createdAt)}</small></div></figcaption>
      </figure>)}</div>
    </section>}
    {[["Karanlık köşeler", "Biraz gizem, biraz tedirginlik. Bir sayfa daha.", darkWorks], ["Keşfetmeye devam", "Bir sonraki hikâyen bu rafta olabilir.", otherWorks]].map(([title, description, items]) => items.length > 0 && <section className="explore-collection" key={title} aria-label={title}>
      <div className="explore-collection-heading"><h2>{title}</h2><p>{description}</p></div>
      <div className="explore-work-grid explore-collection-grid">{items.map(work => <ExploreWorkCard key={work._id} work={work} />)}</div>
    </section>)}
  </>;
}

function ResultState({ title, children, action, label }) {
  return <div className="explore-state" role="status"><BookOpen size={28} aria-hidden="true" /><h3>{title}</h3>{children && <p>{children}</p>}{action && <button className="explore-button" onClick={action}>{label}</button>}</div>;
}

export default function ExplorePage() {
  const { status, requireMember } = useMembership();
  const isLoggedIn = status === "authenticated";
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [genres, setGenres] = useState([]);
  const [genreError, setGenreError] = useState(false);
  const [genreRetry, setGenreRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useSearchParams();
  const mode = params.get("view") === "feed" ? "feed" : "explore";
  const setMode = value => setParams(prev => { const next = new URLSearchParams(prev); if (value === "feed") next.set("view", "feed"); else next.delete("view"); return next; }, { replace: true });
  const [searchTab, setSearchTab] = useState("works");
  const [retry, setRetry] = useState(0);
  const [results, setResults] = useState({ works: [], users: [], loading: true, errors: {} });
  const dailyWork = useSpotlight();
  const [voices, setVoices] = useState([]);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const term = query.trim();
  const searching = term.length >= 2;

  useEffect(() => { document.title = "Keşfet · ACB Atölyesi"; }, []);
  useEffect(() => {
    let current = true;
    apiGet("/feed/top-logs").then(res => {
      if (current) setVoices((res.items || []).filter(log => log.visibility === "public" && log.content?.trim()));
    }).catch(() => {});
    return () => { current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    setGenreError(false);
    apiGet("/works/genres").then(res => {
      if (!current) return;
      const used = (res.genres || []).filter(g => g.count > 0);
      setGenres(used.length ? used : res.genres || []);
    }).catch(() => { if (current) setGenreError(true); });
    return () => { current = false; };
  }, [genreRetry]);

  // Ignore late responses when the query/filter changes or the page unmounts.
  useEffect(() => {
    let current = true;
    setResults({ works: [], users: [], loading: true, errors: {} });
    const timer = setTimeout(async () => {
      if (!searching) {
        try {
          const res = await apiGet(`/feed/discover${genre === "all" ? "" : `?genres=${encodeURIComponent(genre)}`}`);
          if (current) {
            setResults({ works: res.works || [], users: res.writers || [], loading: false, errors: {} });
          }
        } catch {
          if (current) setResults({ works: [], users: [], loading: false, errors: { works: true } });
        }
      } else {
        const params = new URLSearchParams({ q: term });
        if (genre !== "all") params.set("genre", genre);
        const [works, users] = await Promise.allSettled([apiGet(`/search/works?${params}`), apiGet(`/search/users?q=${encodeURIComponent(term)}`)]);
        if (current) setResults({ works: works.status === "fulfilled" ? works.value.items || [] : [], users: users.status === "fulfilled" ? users.value.items || [] : [], loading: false, errors: { works: works.status === "rejected", users: users.status === "rejected" } });
      }
    }, searching ? 350 : 0);
    return () => { current = false; clearTimeout(timer); };
  }, [term, genre, searching, retry]);

  function clearFilters() { setQuery(""); setGenre("all"); searchRef.current?.focus(); }
  function discover() { setMode("explore"); listRef.current?.scrollIntoView({ block: "start" }); listRef.current?.focus(); }
  const visibleGenres = expanded ? genres : genres.slice(0, 5);
  const selectedHidden = !expanded && genre !== "all" && !visibleGenres.some(g => g.genre === genre);
  const showingUsers = searching && searchTab === "users";
  const error = results.errors[showingUsers ? "users" : "works"];
  const worksVisible = searching || mode === "explore" || !isLoggedIn;
  const editorial = !searching && genre === "all";

  return <div className="explore-page">
    <TopBar />
    <main className="explore-shell" data-tour={!results.loading ? "tour-page-ready" : undefined}>
      <SpotlightHero work={dailyWork} isLoggedIn={isLoggedIn} onDiscover={discover} onJoin={() => requireMember()} showJoin={status === "guest"} />

      <section className="explore-catalog" id="explore-works" ref={listRef} tabIndex={-1} aria-labelledby="explore-list-title">
        <div className="explore-catalog-head">
          <div><p className="explore-eyebrow"></p><h2 id="explore-list-title">Hikâyeler seni bekliyor</h2></div>
          <div className="explore-search"><Search size={20} aria-hidden="true" /><input ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Eser, yazar veya tür ara…" aria-label="Eser, yazar veya tür ara" aria-describedby="explore-search-help" />{query && <button onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Aramayı temizle"><X size={18} aria-hidden="true" /></button>}</div>
        </div>
        <p className="explore-search-help" id="explore-search-help">{term.length === 1 ? "Aramak için en az 2 karakter yaz." : "Bir hikâye bul veya merak ettiğin türü seç."}</p>
        <div hidden={!worksVisible} className="explore-filters" role="group" aria-label="Tür filtresi" data-tour="kesfet-filtre">
          <button aria-pressed={genre === "all"} onClick={() => setGenre("all")}>Tümü</button>
          {visibleGenres.map(g => <button key={g.genre} aria-pressed={genre === g.genre} onClick={() => setGenre(genre === g.genre ? "all" : g.genre)}>{g.genre}</button>)}
          {selectedHidden && <button aria-pressed="true" onClick={() => setGenre("all")}>{genre} <X size={13} aria-hidden="true" /></button>}
          {genres.length > 5 && <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Daha az tür" : `Diğer türler (${genres.length - 5})`}</button>}
          {genreError && <button onClick={() => setGenreRetry(v => v + 1)}>Türler yüklenemedi · Tekrar dene</button>}
        </div>
        {worksVisible && (query || genre !== "all") && <div className="explore-filter-summary"><span>{genre !== "all" ? `Tür: ${genre}` : "Tüm türler"}{searching ? ` · “${term}”` : ""}</span><button onClick={clearFilters}>Arama ve filtreleri temizle <X size={14} aria-hidden="true" /></button></div>}

        {(searching || isLoggedIn) && <div className="explore-tabs" role="group" aria-label={searching ? "Arama sonuç türü" : "İçerik görünümü"}>
          {(searching ? [["works", "Eserler"], ["users", "Yazarlar"]] : [["explore", "Keşfet"], ["feed", "Akış"]]).map(([value, label]) => <button key={value} aria-pressed={(searching ? searchTab : mode) === value} onClick={() => searching ? setSearchTab(value) : setMode(value)}>{label}</button>)}
        </div>}
        {worksVisible ? <div aria-busy={results.loading}>
          {results.loading ? <ResultState title="Hikâyeler yükleniyor…" /> : error ? <ResultState title="Şu an sonuçları getiremiyoruz." action={() => setRetry(v => v + 1)} label="Yeniden dene">Bir bağlantı sorunu oluştu. Lütfen yeniden dene.</ResultState> : showingUsers ? <>
            {genre !== "all" && <p className="explore-search-help">Tür seçimi eserleri filtreler; yazarlar adına göre aranır.</p>}
            {results.users.length ? <div className="explore-writers">{results.users.map(user => <Link to={`/profile/${user._id}`} className="explore-writer" key={user._id}><Avatar user={user} size={42} /><div><h3>{user.kullaniciAdi || user.username}</h3>{user.bio && <p>{user.bio}</p>}</div><ArrowRight size={18} aria-hidden="true" /></Link>)}</div> : <ResultState title="Yazar bulunamadı." action={clearFilters} label="Arama ve filtreleri temizle">Başka bir adla aramayı deneyebilirsin.</ResultState>}
          </> : results.works.length ? editorial ? <DiscoveryShelf works={results.works} voices={voices} /> : <div className="explore-work-grid explore-results-grid">{results.works.map(work => <ExploreWorkCard key={work._id} work={work} />)}</div> : <ResultState title={searching || genre !== "all" ? "Bu seçimle eşleşen eser yok." : "Henüz yayınlanmış eser yok."} action={searching || genre !== "all" ? clearFilters : undefined} label="Arama ve filtreleri temizle">{searching || genre !== "all" ? "Başka bir tür veya arama sözcüğü deneyebilirsin." : "Yeni hikâyeler yayınlandığında burada yerlerini alacak."}</ResultState>}
        </div> : <WorkshopFeed onDiscover={() => { setMode("explore"); searchRef.current?.focus(); }} />}
      </section>

      <section className="explore-workshop" aria-labelledby="explore-workshop-title"><PenLine size={28} aria-hidden="true" /><div><p className="explore-eyebrow"></p><h2 id="explore-workshop-title">Kendi sesinle yaz. Gelişimini gör.</h2><p>Bölümlerini yaz, evren ve karakter notlarını bir arada tut. AI geri bildirimiyle metnine yeniden bak; hangi önerilerin sesine uyacağına sen karar ver.</p></div>{isLoggedIn ? <Link className="explore-button" to="/studio">Atölyeme git <ArrowRight size={16} aria-hidden="true" /></Link> : status === "guest" && <button className="explore-button" onClick={() => requireMember("/studio")}>Atölyeye katıl</button>}</section>
    </main>
    <Footer />
  </div>;
}
