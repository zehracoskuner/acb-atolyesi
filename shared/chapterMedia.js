export const MAX_CHAPTER_MEDIA = 12;

// Store canonical URLs only; never accept author-supplied iframe markup.
export function normalizeMediaItem(item) {
  const invalid = () => { throw new Error("Geçerli bir görsel, YouTube veya Spotify bağlantısı ekleyin."); };
  if (!item || typeof item !== "object" || typeof item.url !== "string" || item.url.length > 2048) invalid();
  if (item.caption !== undefined && (typeof item.caption !== "string" || item.caption.length > 240))
    throw new Error("Medya açıklaması en fazla 240 karakter olabilir.");
  let url;
  try { url = new URL(item.url.trim()); } catch { invalid(); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) invalid();
  const caption = (item.caption || "").trim();
  if (item.type === "image") {
    if (url.hostname !== "res.cloudinary.com" || !/^\/[^/]+\/image\/upload\//.test(url.pathname)) invalid();
    return { type: "image", url: url.href, caption };
  }
  if (item.type === "youtube") {
    let id;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(url.hostname)) {
      id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
    }
    if (!/^[\w-]{11}$/.test(id || "")) invalid();
    return { type: "youtube", url: `https://www.youtube.com/watch?v=${id}`, caption };
  }
  if (item.type === "spotify") {
    const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist)\/([a-zA-Z0-9]{22})\/?$/);
    if (url.hostname !== "open.spotify.com" || !match) invalid();
    return { type: "spotify", url: `https://open.spotify.com/${match[1]}/${match[2]}`, caption };
  }
  invalid();
}

export function normalizeChapterMedia(media) {
  if (!Array.isArray(media) || media.length > MAX_CHAPTER_MEDIA)
    throw new Error(`Bir bölüme en fazla ${MAX_CHAPTER_MEDIA} medya eklenebilir.`);
  return media.map(normalizeMediaItem);
}

export function mediaEmbedUrl(item) {
  const media = normalizeMediaItem(item);
  if (media.type === "youtube") return `https://www.youtube.com/embed/${new URL(media.url).searchParams.get("v")}`;
  if (media.type === "spotify") return media.url.replace("open.spotify.com/", "open.spotify.com/embed/");
  return null;
}
