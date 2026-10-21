import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ slots: [], cursor: 0 }));
vi.mock("react", async original => ({
  ...await original(),
  useState(initial) {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = initial;
    return [h.slots[index], value => { h.slots[index] = typeof value === "function" ? value(h.slots[index]) : value; }];
  },
  useRef(initial) { const index = h.cursor++; return h.slots[index] ??= { current: initial }; },
}));
import React from "react";
import ChapterMedia, { MediaCard } from "../../frontend/src/components/ChapterMedia.jsx";
import ChapterMediaEditor from "../../frontend/src/components/ChapterMediaEditor.jsx";
const song = { type: "spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", caption: "Şarkı" };
const video = { type: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", caption: "Video" };
function render(Component, props) { h.cursor = 0; return Component(props); }
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const text = tree => Array.isArray(tree) ? tree.map(text).join("") : tree && typeof tree === "object" ? text(tree.props?.children) : String(tree ?? "");
const button = (tree, label) => find(tree, n => n.type === "button" && (text(n) === label || n.props["aria-label"] === label));
function editor(initial = []) {
  let media = initial;
  const uploading = vi.fn();
  const props = () => ({ media, onChange: update => { media = update(media); }, onUploading: uploading });
  return { tree: () => render(ChapterMediaEditor, props()), media: () => media, uploading };
}
beforeEach(() => {
  h.slots = []; h.cursor = 0;
  vi.stubGlobal("React", React);
  vi.stubGlobal("localStorage", { getItem: () => "test-token" });
});
afterEach(() => vi.unstubAllGlobals());
describe("chapter media author and reader interactions", () => {
  it("adds a song, edits its caption, reorders and removes it while retaining other media", () => {
    const e = editor([video]);
    find(e.tree(), n => n.type === "input" && n.props.type === "url").props.onChange({ target: { value: song.url } });
    find(e.tree(), n => n.type === "input" && n.props.placeholder?.startsWith("Bu bölümü")).props.onChange({ target: { value: song.caption } });
    button(e.tree(), "＋ Müzik ekle").props.onClick();
    expect(e.media()).toEqual([video, song]);
    find(e.tree(), n => n.type === "input" && n.props.value === song.caption).props.onChange({ target: { value: "Yeni açıklama" } });
    button(e.tree(), "2. medyayı yukarı taşı").props.onClick();
    expect(e.media()).toEqual([{ ...song, caption: "Yeni açıklama" }, video]);
    button(e.tree(), "Kaldır").props.onClick();
    expect(e.media()).toEqual([video]);
  });
  it("shows invalid-link errors and preserves the draft for correction", () => {
    const e = editor([video]);
    const url = "https://example.com/track/test";
    find(e.tree(), n => n.type === "input" && n.props.type === "url").props.onChange({ target: { value: url } });
    button(e.tree(), "＋ Müzik ekle").props.onClick();
    expect(find(e.tree(), n => n.props.role === "alert")).toBeDefined();
    expect(find(e.tree(), n => n.type === "input" && n.props.type === "url").props.value).toBe(url);
    expect(e.media()).toEqual([video]);
  });
  it("disables additions at the chapter limit while retaining removal controls", () => {
    const e = editor(Array(12).fill(song));
    expect(button(e.tree(), "＋ Görsel yükle").props.disabled).toBe(true);
    expect(button(e.tree(), "＋ Müzik ekle").props.disabled).toBe(true);
    expect(button(e.tree(), "Kaldır").props.disabled).not.toBe(true);
  });
  it("shows upload progress, appends a successful image and releases the publish lock", async () => {
    let finish;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const e = editor([song]);
    const input = find(e.tree(), n => n.type === "input" && n.props.type === "file");
    input.props.onChange({ target: { files: [new File(["image"], "image.png", { type: "image/png" })], value: "image.png" } });
    expect(find(e.tree(), n => n.props.role === "status")).toBeDefined();
    expect(e.uploading).toHaveBeenLastCalledWith(true);
    finish(new Response(JSON.stringify({ url: "https://res.cloudinary.com/test/image/upload/v1/image.png" }), { status: 200 }));
    await vi.waitFor(() => expect(e.uploading).toHaveBeenLastCalledWith(false));
    expect(e.media()).toHaveLength(2);
    expect(e.media()[0]).toEqual(song);
    expect(e.media()[1].type).toBe("image");
  });
  it("keeps existing media on upload failure and makes retry available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Yükleme başarısız" }), { status: 503 })));
    const e = editor([song]);
    find(e.tree(), n => n.type === "input" && n.props.type === "file").props.onChange({ target: { files: [new File(["image"], "image.png", { type: "image/png" })], value: "image.png" } });
    await vi.waitFor(() => expect(e.uploading).toHaveBeenLastCalledWith(false));
    expect(e.media()).toEqual([song]);
    expect(text(find(e.tree(), n => n.props.role === "alert"))).toBe("Yükleme başarısız");
    expect(find(e.tree(), n => n.type === "fieldset").props.disabled).toBeFalsy();
  });
  it("hides empty reader sections and loads the player only when the reader opens it", () => {
    expect(render(ChapterMedia, { media: [] })).toBeNull();
    let tree = render(MediaCard, { item: song });
    expect(find(tree, n => n.type === "iframe")).toBeUndefined();
    find(tree, n => n.type === "button").props.onClick();
    tree = render(MediaCard, { item: song });
    expect(find(tree, n => n.type === "iframe").props.src).toBe("https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(find(tree, n => n.type === "a").props).toMatchObject({ href: song.url, target: "_blank", rel: "noopener noreferrer" });
  });
});
