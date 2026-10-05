import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../frontend/node_modules/react-dom/server.node.js";
import { MemoryRouter } from "../../frontend/node_modules/react-router-dom/dist/index.mjs";

const data = vi.hoisted(() => ({ status: "guest" }));
vi.mock("../../frontend/src/lib/membershipContext", () => ({ useMembership: () => ({ status: data.status, requireMember: vi.fn() }) }));
vi.mock("../../frontend/src/components/TopBar", () => ({ default: () => null }));
vi.mock("../../frontend/src/components/Footer", () => ({ default: () => null }));
vi.mock("../../frontend/src/lib/api", () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn() }));
import ExplorePage, { ExploreWorkCard } from "../../frontend/src/pages/ExplorePage.jsx";

beforeEach(() => { vi.stubGlobal("React", React); data.status = "guest"; });
afterEach(() => vi.unstubAllGlobals());
const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

describe("Explore content and access links", () => {
  it("offers the guest discovery and shared membership actions", () => {
    const html = render(<ExplorePage />);
    expect(html).toContain("Hikâyeleri keşfet");
    expect(html).toContain("Aramıza katıl");
    expect(html).toContain("Hikâyeler yükleniyor");
    expect(html).not.toContain('href="/register"');
  });
  it("offers the studio without registration invitations to members", () => {
    data.status = "authenticated";
    const html = render(<ExplorePage />);
    expect(html).toContain('href="/studio"');
    expect(html).not.toContain("Aramıza katıl");
    expect(html).not.toContain("Atölyeye katıl");
    expect(html).toContain("Akış");
    expect(html).not.toContain("Takip ettiklerin");
  });
  it("keeps author and story links independent and uses the detail route", () => {
    const title = "Uzun bir hikâye adı ".repeat(12);
    const html = render(<ExploreWorkCard work={{ _id: "story", title, author: { _id: "writer", kullaniciAdi: "Kalem" }, chapterCount: 2, description: "Bir hikâyenin başlangıcı.", universe: { genres: ["Fantastik", "Gizem", "Dram"] } }} />);
    expect(html).toContain('href="/story/story"');
    expect(html).toContain('href="/profile/writer"');
    expect(html).toContain("Eseri incele");
    expect(html).toContain(title);
    expect(html).toContain("2 bölüm");
    expect(html).toContain("Bir hikâyenin başlangıcı.");
    expect(html).not.toContain("Dram");
    expect(html).not.toContain('href="/read/');
    expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/);
    expect(html).not.toContain("<button");
  });
  it("does not reveal anonymous author links and supplies a missing-cover fallback", () => {
    const html = render(<ExploreWorkCard work={{ _id: "story", title: "Adsız", isAnonymous: true, author: { _id: "secret", kullaniciAdi: "Secret" } }} />);
    expect(html).toContain("Anonim Yazar");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("Secret");
    expect(html).toContain("explore-cover-fallback");
    expect(html).not.toContain("<img");
  });
});
