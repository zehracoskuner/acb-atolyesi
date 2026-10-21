import { useState } from "react";
import { mediaEmbedUrl, normalizeMediaItem } from "../../../shared/chapterMedia.js";
import "../styles/ChapterMedia.css";

export function MediaCard({ item }) {
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);
  let media;
  try { media = normalizeMediaItem(item); } catch { return <p>Bu medya kullanılamıyor.</p>; }
  const label = media.type === "spotify" ? "Spotify’da dinle" : "YouTube’da izle / dinle";
  return <figure className="chapter-media-card">
    {media.type === "image" ? <>
      {!failed && <a href={media.url} target="_blank" rel="noopener noreferrer">
        <img src={media.url} alt={media.caption || "Yazarın paylaştığı görsel"} loading="lazy" onError={() => setFailed(true)} />
      </a>}
      {failed && <p>Görsel şu anda yüklenemiyor.</p>}
    </> : <>
      {opened ? <iframe className={`chapter-media-player chapter-media-player--${media.type}`}
        src={mediaEmbedUrl(media)} title={media.caption || label} loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        : <button type="button" className="chapter-media-play" onClick={() => setOpened(true)}>
          <span aria-hidden="true">{media.type === "spotify" ? "♫" : "▶"}</span>
          <span>{media.caption || (media.type === "spotify" ? "Bölümün müziği" : "Bölümün videosu / müziği")}<small>Oynatıcıyı aç · {media.type === "spotify" ? "Spotify" : "YouTube"}</small></span>
        </button>}
      <a className="chapter-media-source" href={media.url} target="_blank" rel="noopener noreferrer">{label} ↗</a>
    </>}
    {media.caption && <figcaption>{media.caption}</figcaption>}
  </figure>;
}

export default function ChapterMedia({ media = [] }) {
  if (!media.length) return null;
  return <section className="chapter-media" aria-label="Yazarın paylaştığı medya">
    <div className="chapter-media-heading"><span aria-hidden="true">✦</span><h2>Yazarın paylaştığı medya</h2></div>
    <p className="chapter-media-hint">Bu bölüme eşlik eden görseller ve müzikler.</p>
    <div className="chapter-media-list">{media.map((item, index) => <MediaCard key={`${index}:${item.url}`} item={item} />)}</div>
  </section>;
}
