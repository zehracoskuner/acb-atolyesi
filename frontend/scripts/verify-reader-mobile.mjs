import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const vite = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'reader-fixture', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    if (req.url !== '/__reader-test') return next();
    res.setHeader('Content-Type', 'text/html');
    res.end(await server.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/reader-fixture.jsx"></script></body></html>'));
  });
} }] });
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [360, 390, 760, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width <= 760, hasTouch: true });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const chapter = { _id: 'chapter1', work: 'work1', title: 'Deneme', status: 'published', order: 1, content: '<div>Birinci paragraf.</div><div><br></div><div><br></div><div>Son paragraf.</div>' };
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/api')[1];
      let body = { items: [] };
      if (path === '/public/works/work1') body = { item: { _id: 'work1', title: 'Kitap', author: { username: 'Yazar' } } };
      else if (path === '/public/works/work1/chapters') body = { items: [chapter] };
      else if (path === '/public/works/work1/chapters/chapter1') body = { item: chapter };
      else if (path === '/inline-comments') body = { items: [{ _id: 'comment1', paragraphIndex: 1, content: 'Son paragraf yorumu', user: { _id: 'reader1', username: 'Okur' }, createdAt: new Date().toISOString() }] };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__reader-test`);
    const bubble = page.getByRole('button', { name: '1 paragraf yorumunu aç' });
    await bubble.waitFor({ timeout: 10000 }).catch(async error => { console.log(errors, await page.locator("body").innerText()); throw error; });
    await bubble.scrollIntoViewIfNeeded();
    const box = await bubble.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= width, `comment button within viewport ${width}`);
    assert.equal(await bubble.evaluate(el => getComputedStyle(el.parentElement).opacity), '1');
    if (width <= 760) assert(box.width >= 44 && box.height >= 44);
    assert.equal(await page.locator('.rd-body .rd-paragraph').count(), 4);
    assert.equal(await page.locator('.rd-body .rd-paragraph').nth(1).evaluate(el => el.offsetHeight > 0), true);
    await bubble.tap();
    const drawer = page.locator('.rdic-drawer--open');
    await drawer.waitFor();
    assert.equal(await drawer.locator('.rdic-quote').textContent(), 'Son paragraf.');
    assert((await drawer.innerText()).includes('Son paragraf yorumu'));
    await drawer.getByRole('button', { name: 'Kapat', exact: true }).tap();
    await page.getByRole('button', { name: 'Paragrafa yorum ekle', exact: true }).tap();
    await drawer.waitFor();
    assert.equal(await drawer.locator('.rdic-quote').textContent(), 'Birinci paragraf.');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: mobile/tablet comment visibility, touch access, viewport fit, existing comment anchors and intentional blank paragraphs');
} finally { await browser?.close(); await vite.close(); }
