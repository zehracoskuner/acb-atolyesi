// Run with PLAYWRIGHT_MODULE pointing to an existing Playwright installation.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { sanitizeChapterHtml } from "../../backend/utils/sanitizeHtml.js";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = '<html><body><div id="root"></div><script type="module" src="/scripts/writing-fixture.jsx"></script></body></html>';
const vite = await createServer({ root, server: { host: "127.0.0.1", port: 0 }, plugins: [{
  name: "clipboard-fixture", configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url !== "/__clipboard-test") return next();
      res.setHeader("Content-Type", "text/html");
      res.end(await server.transformIndexHtml(req.url, fixture));
    });
  },
}] });
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let chapter = { _id: "chapter1", work: "work1", title: "Yapıştırma", status: "draft", order: 1,
    revision: 0, content: "<div>Başlangıç son.</div>", savedAt: new Date().toISOString() };
  let saves = 0;
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.split("/api")[1];
    let result = {};
    if (path === "/auth/me") result = { user: { _id: "writer1" } };
    else if (path === "/user/development-coach") result = { preference: "disabled" };
    else if (path === "/chapters") result = { items: [chapter] };
    else if (path === "/chapters/chapter1") {
      if (request.method() === "PUT") {
        const body = request.postDataJSON();
        assert.equal(body.expectedRevision, chapter.revision);
        chapter = { ...chapter, ...body, content: sanitizeChapterHtml(body.content),
          revision: chapter.revision + 1, savedAt: new Date().toISOString() };
        saves++;
      }
      result = { item: chapter, revision: chapter.revision, savedAt: chapter.savedAt };
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__clipboard-test`);
  const editor = page.locator(".chapter-document .rich-content");
  await editor.waitFor();
  const paste = async (target, html, text) => {
    await target.focus();
    await page.evaluate(async ({ html, text }) => {
      const data = { "text/plain": new Blob([text], { type: "text/plain" }) };
      if (html) data["text/html"] = new Blob([html], { type: "text/html" });
      await navigator.clipboard.write([new ClipboardItem(data)]);
    }, { html, text });
    await page.keyboard.press("Control+v");
  };
  await editor.evaluate(el => {
    el.focus();
    const range = document.createRange();
    range.setStart(el.firstChild.firstChild, 10); range.collapse(true);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await paste(editor, '<span style="font-family:Arial;font-size:48px;color:red;background:yellow;font-weight:bold">ORTA</span>', "ORTA");
  await page.waitForFunction(() => document.querySelector(".rich-content").textContent.includes("ORTA"));
  assert.equal(await editor.textContent(), "Başlangıç ORTAson.");
  await page.keyboard.type("!");
  assert.equal(await editor.textContent(), "Başlangıç ORTA!son.");
  assert(!/font-size|font-family|color|background/.test(await editor.innerHTML()));
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  assert.equal(await editor.textContent(), "Başlangıç son.");

  await editor.fill("");
  await paste(editor, `<p style="margin:80px;line-height:8;color:red">Bir <b>kalın</b> ve <i>italik</i></p>
    <p></p>
    <p style="text-align:center"><span style="font-weight:700;font-size:72px">İkinci</span></p>
    <ul><li>Madde</li></ul><img src="invalid" onerror="alert(1)"><script>alert(1)</script>`, "Bir kalın ve italik\n\nİkinci\nMadde");
  await page.waitForFunction(() => document.querySelector(".rich-content").textContent.includes("Madde"));
  const formatted = await editor.innerHTML();
  assert(!/margin|line-height|color|font-size|onerror|<img|<script/.test(formatted));
  assert(formatted.includes("<b>kalın</b>") && formatted.includes("<i>italik</i>"));
  assert(formatted.includes("<div><br></div>"));
  assert(formatted.includes("text-align: center") || formatted.includes("text-align:center"));
  assert.equal(await editor.locator("li").textContent(), "Madde");
  await page.waitForFunction(() => document.querySelector(".cp-save-details summary")?.textContent === "Kaydedildi");
  assert(saves > 0);
  const beforeReload = await editor.evaluate(el => ({ text: el.innerText, height: el.offsetHeight }));
  await page.reload(); await editor.waitFor();
  assert.deepEqual(await editor.evaluate(el => ({ text: el.innerText, height: el.offsetHeight })), beforeReload);

  await editor.fill("");
  await paste(editor, "", "<etiket> & Türkçe\r\nİkinci\r\n\r\nSon");
  await page.waitForFunction(() => document.querySelector(".rich-content").textContent.includes("Son"));
  assert.equal(await editor.innerText(), "<etiket> & Türkçe\nİkinci\n\nSon");
  assert.equal(await editor.locator("etiket").count(), 0);
  await page.getByRole("button", { name: "Odak", exact: true }).click();
  const focus = page.locator(".focus-rich .rich-content");
  await focus.fill("");
  await paste(focus, '<p style="font-size:80px;color:red">Odak <em>metni</em></p>', "Odak metni");
  await page.waitForFunction(() => document.querySelector(".focus-rich .rich-content").textContent === "Odak metni");
  assert(!/font-size|color/.test(await focus.innerHTML()));
  assert.equal(await focus.locator("em").textContent(), "metni");
  assert.deepEqual(errors, []);
  console.log("PASS: rich/plain clipboard, caret, undo, empty paragraphs, lists, save/reload, focus mode");
} finally {
  await browser?.close();
  await vite.close();
}
