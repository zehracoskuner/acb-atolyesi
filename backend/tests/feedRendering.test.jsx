import { beforeEach, afterEach, it, expect, vi } from "vitest";
import React from "../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../frontend/node_modules/react-dom/server.node.js";
import { MemoryRouter } from "../../frontend/node_modules/react-router-dom/dist/index.mjs";
vi.mock("../../frontend/src/lib/membershipContext", () => ({ useMembership: () => ({ status: "authenticated", requireMember: () => true }) }));
vi.mock("../../frontend/src/components/TopBar", () => ({ default: () => null }));
vi.mock("../../frontend/src/components/Footer", () => ({ default: () => null }));
vi.mock("../../frontend/src/lib/api", () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn() }));
import ExplorePage, { SpotlightHero } from "../../frontend/src/pages/ExplorePage.jsx";
import WriterShelf from "../../frontend/src/components/feed/WriterShelf.jsx";
import { LogCard, ChapterCard } from "../../frontend/src/components/feed/FeedCards.jsx";
import { questionForDate } from "../../frontend/src/components/feed/feedPresentation.js";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
const render = (element, path = "/keşfet") => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
const author = { _id: "writer", kullaniciAdi: "Kalem" };
const work = { _id: "book", title: "Fısıltı", author, description: "Gecenin içinden bir ses.", chapterCount: 3, universe: { genres: ["Gizem"] } };

it("feed deep link includes both scopes and the writing desk with the requested first quote", () => {
  const html = render(<ExplorePage />, "/keşfet?view=feed");
  expect(html).toContain("Herkese Açık"); expect(html).toContain("Takip Ettiklerim");
  expect(html).toContain("ATÖLYEDE BUGÜN"); expect(html).toContain("GÜNÜN SORUSU");
  expect(html).toContain("Ben buradayım sevgili okuyucum, sen neredesin acaba?"); expect(html).toContain("Oğuz Atay");
  expect(html).toContain('aria-label="Akış yükleniyor"');
});
it("log profile, related work, shelf and social actions are independent links/controls", () => {
  const html = render(<LogCard item={{ _id: "log", type: "log", author, content: "Bir cümle daha.", createdAt: new Date().toISOString(), visibility: "followers", relatedWork: work, authorShelf: { works: [{ _id: "other", title: "Diğer Kitap" }], total: 1 } }} />);
  for (const href of ["/profile/writer", "/story/book", "/story/other"]) expect(html).toContain(`href="${href}"`);
  expect(html).toContain("Takipçilere özel"); expect(html).toContain("Beğen"); expect(html).toContain("Yorum");
  expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<(?:a|button)\b/);
});
it("unlinked logs and writers with no books remain readable without broken routes", () => {
  const html = render(<LogCard item={{ _id: "log", type: "log", content: "Yalnız bir not.", author: null }} />);
  expect(html).toContain("Yalnız bir not."); expect(html).not.toContain("undefined"); expect(html).not.toContain("/story/");
  expect(render(<WriterShelf shelf={{ works: [], total: 0 }} author={author} />)).toBe("");
});
it("shelf shows three books, accessible tap control and a link to remaining works", () => {
  const works = Array.from({ length: 5 }, (_, i) => ({ _id: `work-${i}`, title: `Kitap ${i}` }));
  const html = render(<WriterShelf shelf={{ works, total: 5 }} author={author} />);
  expect(html).toContain('aria-expanded="false"'); expect(html).toContain("aria-controls=");
  expect(html).toContain('href="/story/work-2"'); expect(html).not.toContain('href="/story/work-3"');
  expect(html).toContain("+2"); expect(html).toContain('href="/profile/writer"');
});
it("chapter card links directly to the existing reader chapter query", () => {
  const html = render(<ChapterCard item={{ _id: "chapter", type: "chapter", author, work, chapter: { _id: "chapter", title: "İlk gece" }, likedByMe: true, likeCount: 4 }} />);
  expect(html).toContain('href="/read/book?chapter=chapter"'); expect(html).toContain('aria-pressed="true"');
});
it("daily question stays the same through refresh and changes with the calendar day", () => {
  expect(questionForDate(new Date(2026, 8, 29, 0, 1))).toBe(questionForDate(new Date(2026, 8, 29, 23, 59)));
  expect(questionForDate(new Date(2026, 8, 29))).not.toBe(questionForDate(new Date(2026, 8, 30)));
});
it("spotlight gives members a reader link and guests a public story preview", () => {
  const member = render(<SpotlightHero work={work} isLoggedIn />);
  expect(member).toContain('href="/read/book"'); expect(member).toContain("Okumaya başla");
  expect(member).toContain("ATÖLYENİN IŞIĞINDA"); expect(member).toContain("Gecenin içinden bir ses.");
  expect(member).toContain('href="/profile/writer"');
  const guest = render(<SpotlightHero work={work} showJoin />);
  expect(guest).toContain('href="/story/book"'); expect(guest).not.toContain('href="/read/'); expect(guest).toContain("Aramıza katıl");
});
it("spotlight retains anonymous authorship and a usable cover fallback", () => {
  const html = render(<SpotlightHero work={{ ...work, isAnonymous: true }} isLoggedIn />);
  expect(html).toContain("Anonim Yazar"); expect(html).not.toContain("writer"); expect(html).not.toContain("Kalem");
  expect(html).toContain("explore-cover-fallback"); expect(html).toContain("Fısıltı");
});
