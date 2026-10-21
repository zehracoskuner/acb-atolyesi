import { describe, it, expect } from "vitest";
import { normalizeChapterMedia, normalizeMediaItem, mediaEmbedUrl } from "../../shared/chapterMedia.js";
import { ownerChapter, applyChapterDraft } from "../services/chapterPublication.js";
import { chapterVersion } from "../services/contentModeration.js";

const song = { type: "spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", caption: "Bölüm müziği" };
describe("chapter media", () => {
  it("canonicalizes supported links and builds embeds without arbitrary markup or autoplay", () => {
    expect(normalizeMediaItem({ ...song, url: song.url + "?si=tracking" })).toEqual(song);
    expect(normalizeMediaItem({ ...song, url: song.url.replace("/track", "/intl-tr/track") })).toEqual(song);
    expect(mediaEmbedUrl(song)).toBe("https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
    for (const url of ["https://youtu.be/dQw4w9WgXcQ?si=tracking", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1", "https://music.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ"])
      expect(mediaEmbedUrl({ type: "youtube", url })).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });
  it.each(["javascript:alert(1)", "http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "https://open.spotify.com.evil.test/track/4uLU6hMCjMI75M1A2tKUQC", "https://user:pass@open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "<iframe src='https://open.spotify.com'></iframe>"])("rejects unsafe source %s", url => {
    expect(() => normalizeMediaItem({ ...song, url })).toThrow();
  });
  it("limits count, captions and image sources", () => {
    expect(() => normalizeChapterMedia(Array(13).fill(song))).toThrow();
    expect(() => normalizeChapterMedia(null)).toThrow();
    expect(() => normalizeMediaItem({ ...song, caption: "a".repeat(241) })).toThrow();
    expect(() => normalizeMediaItem({ type: "image", url: "https://example.com/image.svg" })).toThrow();
    expect(normalizeChapterMedia([])).toEqual([]);
  });
  it("keeps private media separate until publication, supports removals and legacy drafts", () => {
    const chapter = { title: "Published", content: "text", media: [song], draftContent: { title: "Draft", content: "edited", media: [] }, hasUnpublishedChanges: true };
    expect(ownerChapter(chapter).media).toEqual([]);
    expect(chapter.media).toEqual([song]);
    applyChapterDraft(chapter);
    expect(chapter.media).toEqual([]);
    expect(chapter.hasUnpublishedChanges).toBe(false);
    expect(ownerChapter({ media: [song], draftContent: { title: "Legacy", content: "old" } }).media).toEqual([song]);
  });
  it("includes media in report versions while preserving existing text-only report identifiers", () => {
    const chapter = { title: "test", content: "text", revision: 1 };
    expect(chapterVersion(chapter)).toBe(chapterVersion({ ...chapter, media: [] }));
    expect(chapterVersion(chapter)).not.toBe(chapterVersion({ ...chapter, media: [song] }));
  });
});
