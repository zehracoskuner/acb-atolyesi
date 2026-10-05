import { useEffect, useState } from "react";
import { BookOpen, ArrowDown } from "lucide-react";
import { apiGet } from "../../lib/api";
import { LogCard, ChapterCard } from "./FeedCards";
import AtelierToday from "./AtelierToday";
import "../../styles/WorkshopFeed.css";

function FeedSkeleton() {
  return <div className="feed-skeletons" role="status" aria-label="Akış yükleniyor">{[0, 1, 2].map(index => <div className="feed-skeleton" key={index} aria-hidden="true"><i /><span /><span /><span /></div>)}</div>;
}

function FeedStream({ scope, onDiscover }) {
  const [request, setRequest] = useState({ page: 1, retry: 0 });
  const [feed, setFeed] = useState({ items: [], page: 0, loading: true, error: false, hasMore: false });
  useEffect(() => {
    let current = true;
    setFeed(prev => ({ ...prev, loading: true, error: false }));
    apiGet(`/feed?scope=${scope}&page=${request.page}`).then(res => {
      if (!current) return;
      setFeed(prev => {
        const items = request.page === 1 ? res.items || [] : [...prev.items, ...(res.items || [])];
        return { items: [...new Map(items.map(item => [`${item.type}-${item._id}`, item])).values()], page: request.page, hasMore: res.hasMore, loading: false, error: false };
      });
    }).catch(() => { if (current) setFeed(prev => ({ ...prev, loading: false, error: true })); });
    return () => { current = false; };
  }, [scope, request]);
  return <div className="workshop-feed-stream" aria-busy={feed.loading}>
    {feed.items.map(item => item.type === "log" ? <LogCard key={`log-${item._id}`} item={item} /> : <ChapterCard key={`chapter-${item._id}`} item={item} />)}
    {feed.loading ? <FeedSkeleton /> : feed.error ? <div className="feed-state" role="alert"><p>Akış şu an yüklenemedi.</p><button type="button" onClick={() => setRequest(prev => ({ ...prev, retry: prev.retry + 1 }))}>Yeniden dene</button></div>
      : !feed.items.length ? <div className="feed-state"><BookOpen size={26} aria-hidden="true" /><h3>{scope === "following" ? "Sevdiğin kalemlere yer aç." : "Atölye henüz sessiz."}</h3><p>{scope === "following" ? "Takip ettiğin yazarların günlükleri ve yeni bölümleri burada buluşacak." : "Herkese açık ilk günlük paylaşıldığında burada olacak."}</p><button type="button" onClick={onDiscover}>Yazarları keşfet</button></div>
      : feed.hasMore ? <button className="feed-load-more" type="button" onClick={() => { setFeed(prev => ({ ...prev, loading: true })); setRequest({ page: feed.page + 1, retry: 0 }); }}>Biraz daha oku <ArrowDown size={15} aria-hidden="true" /></button>
        : <p className="feed-end">Şimdilik son satır. Belki sıradaki seninkidir.</p>}
  </div>;
}

export default function WorkshopFeed({ onDiscover }) {
  const [scope, setScope] = useState("public");
  return <section className="workshop-feed" aria-label="Atölye akışı">
    <div className="workshop-feed-layout">
      <div className="workshop-feed-column">
        <div className="feed-scope-tabs" role="group" aria-label="Akış kapsamı">{[["public", "Herkese Açık"], ["following", "Takip Ettiklerim"]].map(([value, label]) => <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>)}</div>
        <p className="feed-scope-note">{scope === "public" ? "Atölyenin her köşesinden, herkesle paylaşılan notlar." : "Takip ettiğin kalemlerden günlükler ve yeni bölümler."}</p>
        {/* Remount resets pagination and ignores any response from the previous scope. */}
        <FeedStream key={scope} scope={scope} onDiscover={onDiscover} />
      </div>
      <AtelierToday />
    </div>
  </section>;
}
