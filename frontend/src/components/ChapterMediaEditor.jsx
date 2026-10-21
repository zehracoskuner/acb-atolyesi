import { useRef, useState } from "react";
import { API_BASE } from "../lib/apiBase";
import { MAX_CHAPTER_MEDIA, normalizeMediaItem } from "../../../shared/chapterMedia.js";
import { MediaCard } from "./ChapterMedia";

export default function ChapterMediaEditor({ media = [], disabled, onChange, onUploading }) {
  const [type, setType] = useState("spotify");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const busyRef = useRef(false);
  const full = media.length >= MAX_CHAPTER_MEDIA;
  function addLink() {
    setError("");
    try {
      const item = normalizeMediaItem({ type, url, caption });
      onChange(items => [...items, item]); setUrl(""); setCaption("");
    } catch (err) { setError(err.message); }
  }
  async function upload(file) {
    if (!file || busyRef.current || disabled || full) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("JPG, PNG, WebP veya GIF seçin (en fazla 5 MB)."); return;
    }
    busyRef.current = true; setUploading(true); onUploading(true);
    try {
      const body = new FormData(); body.append("file", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body, credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Görsel yüklenemedi.");
      const item = normalizeMediaItem({ type: "image", url: data.url, caption: "" });
      onChange(items => [...items, item]);
    } catch (err) { setError(err.message || "Görsel yüklenemedi. Tekrar deneyin."); }
    finally { busyRef.current = false; setUploading(false); onUploading(false); }
  }
  function move(index, offset) {
    onChange(items => { const next = [...items]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; });
  }
  return <section className="chapter-media chapter-media-editor" aria-label="Bölüm medyası">
    <div className="chapter-media-heading"><span aria-hidden="true">✦</span><h2>Yazarın paylaştığı medya</h2><span>{media.length}/{MAX_CHAPTER_MEDIA}</span></div>
    <p className="chapter-media-hint">Bölümüne görsel, video veya şarkı ekle. Okurlar, bölüm yayımlandığında burada görecek.</p>
    <fieldset disabled={disabled || uploading}>
      <legend className="chapter-media-sr">Medya ekle ve düzenle</legend>
      <button type="button" disabled={full} onClick={() => fileRef.current?.click()}>＋ Görsel yükle</button>
      <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      <small className="chapter-media-hint">JPG, PNG, WebP, GIF · en fazla 5 MB</small>
      <div className="chapter-media-form">
        <label>Medya türü<select value={type} onChange={e => { setType(e.target.value); setError(""); }}>
          <option value="spotify">Spotify şarkısı / albümü / listesi</option><option value="youtube">YouTube videosu / şarkısı</option>
        </select></label>
        <label>Bağlantı<input type="url" value={url} maxLength={2048} onChange={e => setUrl(e.target.value)} placeholder={type === "spotify" ? "https://open.spotify.com/track/…" : "https://www.youtube.com/watch?v=…"} /></label>
        <label>Açıklama (isteğe bağlı)<input value={caption} maxLength={240} onChange={e => setCaption(e.target.value)} placeholder="Bu bölümü yazarken dinlediğim şarkı…" /></label>
        <button type="button" onClick={addLink} disabled={full || !url.trim()}>＋ {type === "spotify" ? "Müzik ekle" : "Video / müzik ekle"}</button>
      </div>
      {full && <p>Bölüm başına {MAX_CHAPTER_MEDIA} medya sınırına ulaştın.</p>}
      <div className="chapter-media-list">{media.map((item, index) => <div key={`${index}:${item.url}`}>
        <MediaCard item={item} />
        <label className="chapter-media-caption">{index + 1}. medya açıklaması<input value={item.caption || ""} maxLength={240}
          onChange={e => { const value = e.target.value; onChange(items => items.map((entry, i) => i === index ? { ...entry, caption: value } : entry)); }} /></label>
        <div className="chapter-media-actions">
          <button type="button" disabled={index === 0} aria-label={`${index + 1}. medyayı yukarı taşı`} onClick={() => move(index, -1)}>↑</button>
          <button type="button" disabled={index === media.length - 1} aria-label={`${index + 1}. medyayı aşağı taşı`} onClick={() => move(index, 1)}>↓</button>
          <button type="button" onClick={() => onChange(items => items.filter((_, i) => i !== index))}>Kaldır</button>
        </div>
      </div>)}</div>
    </fieldset>
    {uploading && <p role="status">Görsel yükleniyor…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
