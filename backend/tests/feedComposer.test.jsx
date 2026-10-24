import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the actual component handlers with persistent hook state, without
// introducing a second React renderer or a browser dependency into this suite.
const h = vi.hoisted(() => ({ slots: {}, cursor: 0, instance: "", effects: [], cleanups: {}, session: {}, requireMember: vi.fn(), apiPost: vi.fn(), apiGet: vi.fn() }));
vi.mock("react", async original => {
  const actual = await original();
  return {
    ...actual,
    useState(initial) {
      const cells = h.slots[h.instance];
      const index = h.cursor++;
      if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
      return [cells[index], value => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
    },
    useRef(initial) {
      const cells = h.slots[h.instance];
      const index = h.cursor++;
      return cells[index] ??= { current: initial };
    },
    useId: () => "composer-form",
    useEffect(run, deps) {
      const cells = h.slots[h.instance];
      const index = h.cursor++;
      if (!cells[index] || deps.some((dep, i) => dep !== cells[index][i])) {
        cells[index] = deps;
        h.effects.push({ run, instance: h.instance });
      }
    },
  };
});
vi.mock("../../frontend/src/lib/membershipContext", () => ({ useMembership: () => ({ ...h.session, requireMember: h.requireMember }) }));
vi.mock("../../frontend/src/lib/session", () => ({ useSession: () => h.session }));
vi.mock("../../frontend/src/lib/api", () => ({ apiPost: h.apiPost, apiGet: h.apiGet, apiDelete: vi.fn() }));
vi.mock("react-router-dom", async original => ({ ...await original(), useNavigate: () => vi.fn() }));
vi.mock("../../frontend/src/components/TopBar", () => ({ default: () => null }));
vi.mock("../../frontend/src/components/Footer", () => ({ default: () => null }));
import React from "../../frontend/node_modules/react/index.js";
import FeedComposer from "../../frontend/src/components/feed/FeedComposer.jsx";
import WorkshopFeed from "../../frontend/src/components/feed/WorkshopFeed.jsx";
import Feed from "../../frontend/src/pages/Feed.jsx";
import { Avatar, InlineComments } from "../../frontend/src/components/feed/FeedCards.jsx";
import { CommentSection } from "../../frontend/src/components/LogTab.jsx";

function render(Component, props = {}, instance = "composer") {
  h.instance = instance;
  h.cursor = 0;
  h.slots[instance] ||= [];
  return Component(props);
}
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object") return [];
  return [node, ...elements(node.props?.children)];
}
const find = (tree, predicate) => elements(tree).find(predicate);
const text = node => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : String(node ?? "");
const button = (tree, label) => find(tree, node => node.type === "button" && (text(node) === label || node.props["aria-label"] === label));
const form = tree => find(tree, node => node.type === "form");
const textarea = tree => find(tree, node => node.type === "textarea");
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function effects() {
  for (const effect of h.effects.splice(0)) {
    const cleanup = effect.run();
    if (typeof cleanup === "function") (h.cleanups[effect.instance] ||= []).push(cleanup);
  }
}
function open(props) {
  textarea(render(FeedComposer, props)).props.onFocus();
  return render(FeedComposer, props);
}
function write(value, props) {
  textarea(render(FeedComposer, props)).props.onChange({ target: { value } });
  return render(FeedComposer, props);
}
const event = () => ({ preventDefault: vi.fn() });
const posted = { _id: "created", content: "Yeni bir satır.", visibility: "public" };
beforeEach(() => {
  vi.clearAllMocks(); h.apiPost.mockReset(); h.apiGet.mockReset();
  h.slots = {}; h.effects = []; h.cleanups = {};
  h.session = { status: "authenticated", user: { _id: "writer", kullaniciAdi: "Kalem", avatarUrl: "/avatar.png" } };
  h.requireMember.mockImplementation(() => h.session.status === "authenticated");
  h.apiPost.mockResolvedValue({ item: posted });
  vi.stubGlobal("React", React);
  vi.stubGlobal("document", { title: "" });
});
afterEach(() => {
  Object.values(h.cleanups).flat().forEach(cleanup => cleanup());
  vi.unstubAllGlobals();
});

it.each(["feed", "profile"])("%s comments send replies, preserve failed drafts and allow cancellation", async surface => {
  const parent = { _id: "parent", author: { _id: "other", kullaniciAdi: "Yazar" }, content: "Original" };
  h.apiGet.mockResolvedValue({ items: [parent] });
  let Component = CommentSection;
  let props = { logId: "log", isLoggedIn: true, initiallyOpen: true };
  if (surface === "feed") {
    Component = InlineComments;
    props = { logId: "log", isLoggedIn: true, onCountChange: vi.fn() };
  }
  render(Component, props, "comments"); effects(); await tick();
  let tree = render(Component, props, "comments");
  button(tree, "Yanıt ver").props.onClick();
  tree = render(Component, props, "comments");
  expect(text(tree)).toContain("Yazar kişisine yanıt yazıyorsun");
  find(tree, node => node.type === "input" || node.type === "textarea").props.onChange({ target: { value: "My reply" } });
  h.apiPost.mockRejectedValueOnce(new Error("Failed"));
  await form(render(Component, props, "comments")).props.onSubmit(event());
  tree = render(Component, props, "comments");
  expect(find(tree, node => node.type === "input" || node.type === "textarea").props.value).toBe("My reply");
  h.apiPost.mockResolvedValueOnce({ item: { ...parent, _id: "reply", content: "My reply", parentId: "parent" } });
  await form(tree).props.onSubmit(event());
  expect(h.apiPost).toHaveBeenLastCalledWith("/logs/log/comments", { content: "My reply", parentId: "parent" });
  tree = render(Component, props, "comments");
  expect(text(tree)).toContain("Yazar kişisine yanıt");
  expect(text(tree)).not.toContain("yanıt yazıyorsun");
  button(tree, "Yanıt ver").props.onClick();
  button(render(Component, props, "comments"), "Vazgeç").props.onClick();
  expect(text(render(Component, props, "comments"))).not.toContain("yanıt yazıyorsun");
});

describe("Feed sharing through existing logs", () => {
  it("starts collapsed and uses the current session avatar", () => {
    const tree = render(FeedComposer);
    expect(find(tree, node => node.type === Avatar).props.user).toBe(h.session.user);
    expect(textarea(tree).props).toMatchObject({ rows: 2, readOnly: false });
    expect(button(tree, "Paylaş")).toBeUndefined();
  });
  it("sends guests to the existing membership flow without opening a writable form", () => {
    h.session = { status: "guest", user: null };
    const tree = open();
    expect(h.requireMember).toHaveBeenCalledOnce();
    expect(button(tree, "Paylaş")).toBeUndefined();
    expect(textarea(tree).props.readOnly).toBe(true);
    textarea(tree).props.onChange({ target: { value: "Misafir taslağı" } });
    expect(textarea(render(FeedComposer)).props.value).toBe("");
    expect(h.apiPost).not.toHaveBeenCalled();
  });
  it.each(["checking", "error"])("disables sharing while the session is %s", status => {
    h.session.status = status;
    expect(textarea(render(FeedComposer)).props.disabled).toBe(true);
  });
  it("opens a labelled multiline field with the existing character limit and public audience", () => {
    const tree = open();
    expect(textarea(tree).props).toMatchObject({ rows: 4, maxLength: 800, "aria-label": "Paylaşım metni" });
    expect(text(tree)).toContain("Kalem");
    expect(text(tree)).toContain("Herkese açık");
    expect(button(tree, "Paylaş").props.disabled).toBe(true);
  });
  it.each(["", "   ", "\n\t  "])("does not submit blank content %j", async value => {
    open(); const tree = write(value);
    expect(button(tree, "Paylaş").props.disabled).toBe(true);
    await form(tree).props.onSubmit(event());
    expect(h.apiPost).not.toHaveBeenCalled();
  });
  it("rejects content beyond 800 characters even when a handler is invoked directly", async () => {
    open(); const tree = write("a".repeat(801));
    expect(button(tree, "Paylaş").props.disabled).toBe(true);
    await form(tree).props.onSubmit(event());
    expect(h.apiPost).not.toHaveBeenCalled();
  });
  it("posts trimmed multiline content to /logs, clears the box and notifies the feed once", async () => {
    const onPost = vi.fn(); const props = { onPost };
    open(props);
    await form(write("  İlk satır.\nİkinci satır.  ", props)).props.onSubmit(event());
    expect(h.apiPost).toHaveBeenCalledWith("/logs", { content: "İlk satır.\nİkinci satır.", visibility: "public" });
    expect(onPost).toHaveBeenCalledExactlyOnceWith(posted);
    const tree = render(FeedComposer, props);
    expect(button(tree, "Paylaş")).toBeUndefined();
    expect(text(find(tree, node => node.props?.role === "status"))).toContain("kaydedildi");
    expect(textarea(open(props)).props.value).toBe("");
  });
  it("allows exactly 800 characters", async () => {
    open(); await form(write("a".repeat(800))).props.onSubmit(event());
    expect(h.apiPost).toHaveBeenCalledWith("/logs", { content: "a".repeat(800), visibility: "public" });
  });
  it("guards double submits and disables editing and cancellation until the request finishes", async () => {
    const pending = deferred(); const onPost = vi.fn(); const props = { onPost };
    h.apiPost.mockReturnValueOnce(pending.promise);
    open(props); const tree = write("Bir düşünce.", props);
    const first = form(tree).props.onSubmit(event());
    const second = form(tree).props.onSubmit(event());
    let busy = render(FeedComposer, props);
    expect(busy.props["aria-busy"]).toBe(true);
    expect(textarea(busy).props.disabled).toBe(true);
    expect(button(busy, "Vazgeç").props.disabled).toBe(true);
    expect(button(busy, "Paylaşılıyor…").props.disabled).toBe(true);
    button(busy, "Vazgeç").props.onClick();
    busy = render(FeedComposer, props);
    expect(textarea(busy).props.value).toBe("Bir düşünce.");
    expect(h.apiPost).toHaveBeenCalledOnce();
    pending.resolve({ item: posted }); await Promise.all([first, second]);
    expect(onPost).toHaveBeenCalledOnce();
    expect(render(FeedComposer, props).props["aria-busy"]).toBe(false);
  });
  it("preserves the draft and server permission error, then permits a successful retry", async () => {
    const onPost = vi.fn(); const props = { onPost };
    h.apiPost.mockRejectedValueOnce(Object.assign(new Error("Hesabınız askıya alınmış."), { status: 403 }));
    open(props); await form(write("Saklanan taslak.", props)).props.onSubmit(event());
    const failed = render(FeedComposer, props);
    expect(textarea(failed).props.value).toBe("Saklanan taslak.");
    expect(text(find(failed, node => node.props?.role === "alert"))).toBe("Hesabınız askıya alınmış.");
    textarea(failed).props.onFocus();
    expect(text(find(render(FeedComposer, props), node => node.props?.role === "alert"))).toBe("Hesabınız askıya alınmış.");
    expect(button(failed, "Paylaş").props.disabled).toBe(false);
    expect(onPost).not.toHaveBeenCalled();
    await form(failed).props.onSubmit(event());
    expect(h.apiPost).toHaveBeenCalledTimes(2);
    expect(onPost).toHaveBeenCalledOnce();
  });
  it("focuses the textarea on opening and returns focus without reopening on cancellation", () => {
    const composerFocus = vi.fn(); const textareaFocus = vi.fn();
    const closed = render(FeedComposer);
    closed.props.ref.current = { focus: composerFocus };
    textarea(closed).props.onFocus();
    const tree = render(FeedComposer);
    textarea(tree).props.ref.current = { focus: textareaFocus, style: {}, scrollHeight: 52 };
    effects();
    expect(textareaFocus).toHaveBeenCalledOnce();
    button(tree, "Vazgeç").props.onClick(); const collapsed = render(FeedComposer); effects();
    expect(composerFocus).toHaveBeenCalledOnce();
    expect(textarea(collapsed).props.rows).toBe(2);
    expect(button(collapsed, "Paylaş")).toBeUndefined();
  });
  it("cancels without sending and reopens with an empty draft", () => {
    open(); const tree = write("Vazgeçilen taslak.");
    button(tree, "Vazgeç").props.onClick();
    expect(button(render(FeedComposer), "Paylaş")).toBeUndefined();
    expect(textarea(open()).props.value).toBe("");
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe("Feed integration and existing server ordering", () => {
  it("refreshes page one in public scope after publishing from following and ignores the old response", async () => {
    const old = deferred();
    h.apiGet.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ items: [{ ...posted, type: "log" }], hasMore: false });
    let workshop = render(WorkshopFeed, {}, "workshop");
    button(workshop, "Takip Ettiklerim").props.onClick();
    workshop = render(WorkshopFeed, {}, "workshop");
    const previous = find(workshop, node => node.type?.name === "FeedStream");
    render(previous.type, previous.props, "old-stream"); effects();
    expect(h.apiGet).toHaveBeenLastCalledWith("/feed?scope=following&page=1");
    find(workshop, node => node.type === FeedComposer).props.onPost(posted);
    workshop = render(WorkshopFeed, {}, "workshop");
    const fresh = find(workshop, node => node.type?.name === "FeedStream");
    expect(fresh.key).not.toBe(previous.key);
    h.cleanups["old-stream"].forEach(cleanup => cleanup());
    render(fresh.type, fresh.props, "new-stream"); effects(); await tick();
    expect(h.apiGet).toHaveBeenLastCalledWith("/feed?scope=public&page=1");
    expect(button(workshop, "Herkese Açık").props["aria-pressed"]).toBe(true);
    old.resolve({ items: [{ _id: "stale", type: "log" }], hasMore: true }); await tick();
    const stream = render(fresh.type, fresh.props, "new-stream");
    expect(find(stream, node => node.props?.item?._id === "created")).toBeTruthy();
    expect(find(stream, node => node.props?.item?._id === "stale")).toBeUndefined();
  });
  it("refreshes /feed without letting older pagination responses change the new list", async () => {
    const oldPage = deferred(); const freshPage = deferred(); let first = true;
    h.apiGet.mockImplementation(url => {
      if (url === "/feed/discover") return Promise.resolve({ works: [], writers: [] });
      if (url === "/feed?page=2") return oldPage.promise;
      if (first) { first = false; return Promise.resolve({ items: [{ ...posted, _id: "existing", type: "log" }], hasMore: true, isEmpty: false }); }
      return freshPage.promise;
    });
    render(Feed, {}, "legacy"); effects(); await tick();
    let feed = render(Feed, {}, "legacy");
    find(feed, node => node.props?.["aria-label"] === "Daha fazla içerik yükle").props.onClick();
    find(feed, node => node.type === FeedComposer).props.onPost(posted);
    expect(h.apiGet).toHaveBeenLastCalledWith("/feed?page=1");
    freshPage.resolve({ items: [{ ...posted, type: "log" }], hasMore: false, isEmpty: false }); await tick();
    oldPage.resolve({ items: [{ ...posted, _id: "late-page", type: "log" }], hasMore: false, isEmpty: false }); await tick();
    feed = render(Feed, {}, "legacy");
    expect(find(feed, node => node.props?.item?._id === "created")).toBeTruthy();
    expect(find(feed, node => node.props?.item?._id === "late-page")).toBeUndefined();
  });
});
