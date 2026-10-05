// Real Atelier + Chapters + Tour components; isolated API fixtures, no live account.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const artifacts = await mkdtemp(join(tmpdir(), "acb-atelier-"));
const root = fileURLToPath(new URL("../", import.meta.url));
const vite = await createServer({ root, server: { host: "127.0.0.1", port: 0 }, plugins: [{ name: "atelier-test", configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    if (!req.url.startsWith("/__atelier-test")) return next();
    res.setHeader("Content-Type", "text/html");
    res.end(await server.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/scripts/writing-fixture.jsx"></script></body></html>'));
  });
} }] });
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", err => errors.push(err.message));
  let userId = "writer1", failSave = false, delaySave = false, releaseSave;
  const notes = new Map(); let noteCount = 0;
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.split("/api")[1];
    const method = request.method(), body = ["POST", "PATCH", "PUT"].includes(method) ? request.postDataJSON() : {};
    assert(!path.startsWith("/ai/"), "Atelier must not call AI");
    let result = {}, status = 200;
    if (path === "/auth/me") result = { user: { _id: userId } };
    else if (path === "/chapters") result = { items: [{ _id: "chapter1", title: "Bölüm 1", order: 1 }] };
    else if (path === "/chapters/chapter1") result = { item: { _id: "chapter1", title: "Bölüm 1", content: "<p>Dokunulmayan bölüm metni.</p>", revision: 0, status: "draft", savedAt: new Date().toISOString() } };
    else if (path.startsWith("/chapters/development/")) result = { eligibleForDevelopmentReview: false };
    else if (path === "/user/tour-complete") result = {};
    else if (path === "/notes" || path.startsWith("/notes/")) {
      assert(["POST", "PATCH"].includes(method));
      if (delaySave) await new Promise(resolve => { releaseSave = resolve; });
      if (failSave) { status = 500; result = { message: "Not kaydedilemedi. Tekrar dene." }; }
      else {
        const id = method === "POST" ? "note" + ++noteCount : path.split("/").at(-1);
        const item = { ...body, _id: id, user: userId }; notes.set(id, item); result = { item };
      }
    } else throw Error("Unexpected API: " + method + " " + path);
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(result) });
  });
  const url = work => "http://127.0.0.1:" + vite.httpServer.address().port + "/__atelier-test?work=" + work;
  const openAtelier = async () => {
    await page.locator(".chapter-document").waitFor();
    await page.getByRole("button", { name: "✍️ Atölye", exact: true }).click();
    await page.getByLabel("Egzersiz metni").waitFor();
  };
  await page.goto(url("work1")); await openAtelier();
  const title = page.getByLabel("Egzersiz başlığı"), text = page.getByLabel("Egzersiz metni");
  assert(!/AI Yorumla|Sert Eleştirmen|Destekleyici|Yazar Koçu|AI Yorum/.test(await page.locator(".atelier-layout").innerText()));
  assert.equal(await page.locator(".atelier-layout select").count(), 0);
  await title.fill("Egzersiz başlığı"); await text.fill("deniz deniz deniz. Bir an bir an.");
  await page.locator(".antrenman-cat").nth(1).click();
  await page.getByRole("button", { name: "↧ Editöre Aktar", exact: true }).click();
  assert(await page.locator(".atelier-task-banner").isVisible());
  assert.equal(await text.inputValue(), "deniz deniz deniz. Bir an bir an.");
  await page.getByRole("button", { name: "▶ Sprint (10 dk)", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".routine-time")?.textContent !== "10:00");
  await page.getByRole("button", { name: "❚❚ Duraklat", exact: true }).click();
  const paused = await page.locator(".routine-time").innerText();
  await page.getByRole("button", { name: "▶ Devam et", exact: true }).click();
  assert.equal(await page.locator(".routine-time").innerText(), paused);
  await page.getByRole("button", { name: "↺ Sıfırla", exact: true }).click();
  assert.equal(await page.locator(".routine-time").innerText(), "10:00");
  await page.getByRole("tab", { name: "🎒 Kelime Çantası" }).click();
  await page.locator(".bag-row").filter({ has: page.getByText("deniz", { exact: true }) }).getByRole("button", { name: "Değnek" }).click();
  await page.getByRole("tab", { name: "🧭 Pusula" }).click();
  assert(await page.locator(".pusula-box").isVisible());
  await page.getByRole("button", { name: "📖 Bölümler" }).click(); await openAtelier();
  assert.equal(await title.inputValue(), "Egzersiz başlığı");
  assert.equal(await text.inputValue(), "deniz deniz deniz. Bir an bir an.");
  await page.reload(); await openAtelier();
  assert.equal(await title.inputValue(), "Egzersiz başlığı");
  assert.equal(await text.inputValue(), "deniz deniz deniz. Bir an bir an.");

  failSave = true;
  await page.getByRole("button", { name: "Nota Kaydet", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Not kaydedilemedi" }).waitFor();
  assert.equal(notes.size, 0);
  assert(!await page.getByText("Eserine bağlı nota kaydedildi", { exact: true }).isVisible());
  failSave = false; delaySave = true;
  await page.getByRole("button", { name: "Nota Kaydet", exact: true }).click();
  await page.getByText("Nota kaydediliyor…", { exact: true }).waitFor();
  await text.fill("Kayıt sırasında yazılan yeni metin.");
  while (!releaseSave) await new Promise(resolve => setTimeout(resolve, 10));
  releaseSave(); delaySave = false;
  await page.getByText("Önceki metin kaydedildi; yeni değişiklikleri de kaydet.", { exact: true }).waitFor();
  assert.equal(await text.inputValue(), "Kayıt sırasında yazılan yeni metin.");
  await page.reload(); await openAtelier();
  assert.equal(await text.inputValue(), "Kayıt sırasında yazılan yeni metin.");
  await page.getByRole("button", { name: "Nota Kaydet", exact: true }).click();
  await page.getByText("Eserine bağlı nota kaydedildi", { exact: true }).waitFor();
  assert.equal(notes.size, 1);
  assert.equal(notes.get("note1").workId, "work1"); assert.equal(notes.get("note1").content, await text.inputValue());
  assert.equal(await page.evaluate(() => localStorage.getItem("acb:atelier:v1:writer1:work1")), null);
  await page.reload(); await openAtelier();
  assert.equal(await text.inputValue(), "Kayıt sırasında yazılan yeni metin.");
  await page.goto(url("work2")); await openAtelier(); assert.equal(await text.inputValue(), "");
  await title.fill("Diğer eser"); await text.fill("Ayrı taslak.");
  userId = "writer2"; await page.reload(); await openAtelier(); assert.equal(await text.inputValue(), "");
  userId = "writer1"; await page.goto(url("work1")); await openAtelier();
  assert.equal(await text.inputValue(), "Kayıt sırasında yazılan yeni metin.");

  await page.evaluate(() => { localStorage.setItem("acb_pusula", "null"); localStorage.setItem("acb_kelime_cantasi_prefs", "null"); });
  await page.reload(); await openAtelier();
  await page.getByRole("tab", { name: "🧭 Pusula" }).click();
  await page.getByRole("tab", { name: "🎒 Kelime Çantası" }).click();
  await page.getByRole("button", { name: "📖 Bölümler" }).click();
  await page.getByRole("button", { name: "Yardım ve tanıtım turları" }).click();
  await page.getByRole("button", { name: "Atölye rehberi" }).click();
  await page.locator(".acb-tour-tooltip").waitFor();
  assert(await text.isVisible());
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "İleri", exact: true }).click();
  await page.getByText("Yerel yazım ipuçlarını bir araya getirir", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Turu bitir" }).click();
  await page.screenshot({ path: join(artifacts, "atelier-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350); // wait for the existing sidebar transition
  assert(await page.locator(".cp-sidebar").evaluate(el => el.getBoundingClientRect().right <= 1));
  assert(await text.isVisible());
  const mobileRects = await page.locator(".atelier-layout, .atelier-editor-wrap, .atelier-textarea, .atelier-tools").evaluateAll(nodes => nodes.map(n => ({ className: n.className, right: n.getBoundingClientRect().right, width: n.getBoundingClientRect().width })));
  assert(mobileRects.every(r => r.right <= 391), JSON.stringify(mobileRects));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(artifacts, "atelier-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException("quota", "QuotaExceededError"); }; });
  await text.fill("Depolama kapalıyken de yazabiliyorum.");
  await page.getByRole("alert").filter({ hasText: "Yerel taslak saklanamadı" }).waitFor();
  assert.equal(await text.inputValue(), "Depolama kapalıyken de yazabiliyorum.");
  assert.deepEqual(errors, []);
  console.log("PASS Atelier tools/routine/persistence/isolation/save failure/in-flight edits/clean acknowledgement/tour/corrupt storage/mobile/no AI");
  console.log("Screenshots:", artifacts);
} finally { await browser?.close(); await vite.close(); }
