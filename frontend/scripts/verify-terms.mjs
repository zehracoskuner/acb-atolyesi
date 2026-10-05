// Run with: node scripts/verify-terms.mjs
// Renders the actual React pages; no browser, DB or external service is required.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

const root = fileURLToPath(new URL("../", import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: "custom" });
const render = Component => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Component)));
try {
  const { default: Register } = await vite.ssrLoadModule("/src/pages/Register.jsx");
  const { default: ProfilTamamla } = await vite.ssrLoadModule("/src/pages/ProfilTamamla.jsx");
  const { default: SozlesmeKabul } = await vite.ssrLoadModule("/src/pages/SozlesmeKabul.jsx");
  const { default: TermsAcceptance } = await vite.ssrLoadModule("/src/components/TermsAcceptance.jsx");
  const { TERMS_VERSION } = await vite.ssrLoadModule("/src/lib/terms.js");
  for (const Component of [Register, ProfilTamamla, SozlesmeKabul]) {
    const html = render(Component);
    const checkbox = html.match(/<input\b[^>]*name="termsAccepted"[^>]*>/)?.[0];
    assert.ok(checkbox, `${Component.name}: acceptance checkbox exists`);
    assert.match(checkbox, /type="checkbox"/);
    assert.match(checkbox, /required=""/);
    assert.doesNotMatch(checkbox, /\bchecked(?:=|\s|>)/);
    assert.match(html, /<button\b[^>]*type="submit"[^>]*disabled=""/);
    assert.ok(html.includes(TERMS_VERSION));
    assert.ok(html.includes("Bu kabul reklam veya pazarlama iletisi izni değildir."));
    console.log(`PASS ${Component.name}: unchecked required consent, disabled submit, separate marketing notice`);
  }

  const consentHtml = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(TermsAcceptance, { checked: false, onChange() {} })));
  const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  const expectations = new Map([
    ["/kullanim-sartlari", "Kullanıcı Sözleşmesi"],
    ["/etik-kurallar", "Etik Kurallar"],
    ["/gizlilik", "Gizlilik Politikası"],
  ]);
  for (const [path, heading] of expectations) {
    assert.match(consentHtml, new RegExp(`href="${path}"`));
    const route = main.match(new RegExp(`<Route path="${path}"\\s+element=\\{<(\\w+)`));
    assert.ok(route, `${path}: registered route`);
    assert.ok(main.indexOf(route[0]) < main.indexOf("<Route element={<MembershipGate"), `${path}: readable before consent`);
    const lazyImport = main.match(new RegExp(`const ${route[1]}\\s*= lazy\\(\\(\\) => import\\("([^\"]+)"\\)`));
    assert.ok(lazyImport, `${path}: page import`);
    const { default: Page } = await vite.ssrLoadModule(`/src/${lazyImport[1].replace(/^\.\//, "")}.jsx`);
    const html = render(Page);
    assert.match(html, new RegExp(`<h1[^>]*>${heading}</h1>`));
    if (path !== "/gizlilik") {
      assert.ok(html.includes("hukuk onayı almamıştır"));
      assert.ok(html.includes("https://telifhaklari.ktb.gov.tr/TR-332375/telif-hakki-nedir.html"));
    }
    if (path === "/kullanim-sartlari") assert.ok(html.includes('id="eser-sahipligi-ek"'));
    console.log(`PASS ${path}: consent link resolves to ${route[1]}, correct heading, public route`);
  }
} finally {
  await vite.close();
}
