import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import React from "../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../frontend/node_modules/react-dom/server.node.js";
import { MemoryRouter, Routes, Route } from "../../frontend/node_modules/react-router-dom/dist/index.mjs";
const data = vi.hoisted(() => ({ session: {}, mounted: 0 }));
vi.mock("../../frontend/src/lib/session", () => ({ useSession: () => data.session, refreshSession: vi.fn(), logoutSession: vi.fn() }));
vi.mock("../../frontend/src/lib/membershipContext", () => ({ useMembership: () => ({ ...data.session, requireMember: vi.fn() }) }));
vi.mock("../../frontend/src/components/tour/TourManager", () => ({ TourHelpButton: () => null }));
vi.mock("../../frontend/src/lib/api", () => ({ apiGet: vi.fn(), apiPatch: vi.fn(), adminGet: vi.fn() }));
import MembershipGate from "../../frontend/src/components/MembershipGate.jsx";
import TopBar from "../../frontend/src/components/TopBar.jsx";

beforeEach(() => { vi.stubGlobal("React", React); data.mounted = 0; data.session = { status: "guest", user: null }; });
afterEach(() => vi.unstubAllGlobals());
function PrivatePage() { data.mounted++; return <p>Personal page</p>; }
function renderGate(path) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><Routes><Route element={<MembershipGate />}><Route path="*" element={<PrivatePage />} /></Route></Routes></MemoryRouter>);
}
describe("Guest and member page rendering", () => {
  it.each(["guest", "checking", "error"])("does not mount personal pages while %s", status => {
    data.session = { status, user: null, error: status === "error" ? "Offline" : null };
    const html = renderGate("/notes");
    expect(data.mounted).toBe(0);
    expect(html).not.toContain("Personal page");
    if (status === "guest") expect(html).toContain("Aramıza katıl");
    if (status === "error") expect(html).toContain("Tekrar dene");
  });
  it("allows guest story previews", () => {
    renderGate("/story/book");
    expect(data.mounted).toBe(1);
  });
  it("mounts member pages without an invitation", () => {
    data.session = { status: "authenticated", user: { _id: "member", birthYear: 2000, profileComplete: true, birthYear: 1990, requiresTermsAcceptance: false } };
    const html = renderGate("/notes");
    expect(data.mounted).toBe(1);
    expect(html).not.toContain("Aramıza katıl");
  });
  it("does not bypass profile or terms steps", () => {
    data.session = { status: "authenticated", user: { profileComplete: false, requiresTermsAcceptance: true } };
    renderGate("/notes");
    expect(data.mounted).toBe(0);
  });
  it('does not mount a private page for a restored legacy member missing birthYear', () => {
    data.session = { status: 'authenticated', user: { _id: 'legacy', profileComplete: true, requiresTermsAcceptance: false } };
    renderGate('/notes');
    expect(data.mounted).toBe(0);
  });
  it("guest navigation has all three public choices and no personal menu", () => {
    const html = renderToStaticMarkup(<MemoryRouter><TopBar /></MemoryRouter>);
    for (const label of ["Keşfet", "Giriş Yap", "Aramıza Katıl"]) expect(html).toContain(label);
    for (const label of ["Kütüphanem", "Atölyem", "Notlarım", "Bildirimler", "Çıkış Yap", "Hesap Menüsü"]) expect(html).not.toContain(label);
  });
  it("checking navigation does not offer guest sign-in", () => {
    data.session = { status: "checking", user: null };
    const html = renderToStaticMarkup(<MemoryRouter><TopBar /></MemoryRouter>);
    expect(html).toContain("Oturum kontrol ediliyor");
    expect(html).not.toContain("Giriş Yap");
  });
  it("member navigation retains personal links and role permissions", () => {
    data.session = { status: "authenticated", user: { role: "admin", kullaniciAdi: "Yazar" } };
    const html = renderToStaticMarkup(<MemoryRouter><TopBar /></MemoryRouter>);
    for (const label of ["Kütüphanem", "Atölyem", "Notlarım", "Bildirimler", "Çıkış Yap", "Yönetim Paneli"]) expect(html).toContain(label);
    expect(html).not.toContain("Giriş Yap");
  });
});
