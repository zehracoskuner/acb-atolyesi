import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('../', import.meta.url));
const qa = path.join(root, 'scripts/feed-preview'), adapter = path.join(qa, 'adapters.jsx');
const { createServer } = await import(pathToFileURL(path.join(root, '../frontend/node_modules/vite/dist/node/index.js')).href);
const html = (await readFile(path.join(root, 'scripts/design-preview/index.html'), 'utf8')).replaceAll('Z:/acbAstra/mobile', root.replaceAll('\\', '/').replace(/\/$/, ''));
const server = await createServer({ configFile: false, root: qa, esbuild: { jsx: 'automatic' },
  plugins: [{ name: 'qa-index', configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url === '/' || req.url?.startsWith('/?')) { res.setHeader('Content-Type', 'text/html'); res.end(html); } else next(); }); } }],
  server: { host: '127.0.0.1', port: 5199, strictPort: true, fs: { allow: [root] } },
  resolve: { dedupe: ['react', 'react-dom'], extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'], alias: [
    { find: /^react-native$/, replacement: path.join(qa, 'native.jsx') },
    { find: /^(?:.*\/)?session$/, replacement: adapter },
    { find: /^expo-router$/, replacement: adapter }, { find: /^@react-navigation\/native$/, replacement: adapter },
    { find: /^@expo\/vector-icons$/, replacement: path.join(root, 'scripts/design-preview/icons.jsx') },
    { find: /^react-native-safe-area-context$/, replacement: path.join(root, 'scripts/design-preview/safe-area.jsx') },
  ] }, define: { global: 'globalThis', 'process.env': JSON.stringify({ NODE_ENV: 'development', EXPO_PUBLIC_API_URL: 'https://feed-qa.invalid/api' }) },
});
let browser;
const output = path.join(root, 'artifacts/feed'); await mkdir(output, { recursive: true });
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.MOBILE_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = [];
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: 'development', EXPO_PUBLIC_API_URL: 'https://feed-qa.invalid/api' } }; });
  page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  const author = { _id: 'writer', kullaniciAdi: 'ece_kalem' }, viewer = { _id: 'viewer', kullaniciAdi: 'deniz_yazar' };
  const work = { _id: 'book', title: 'Şehrin Unuttuğu Sesler', status: 'published' };
  const entry = (id, content, extra = {}) => ({ _id: id, type: 'log', content, createdAt: '2026-10-29T10:00:00Z', author, visibility: 'public', likeCount: 12, likedByMe: false, commentCount: 0, ...extra });
  let logs = [entry('one', 'Bugün bir karakterimin sesini ilk kez duydum.\nBazen hikâyeyi ilerletmek için biraz dinlemek gerekiyor.', { relatedWork: work }),
    entry('long', 'Küçük bir not, uzun bir yol. '.repeat(25), { visibility: 'followers' }),
    ...Array.from({ length: 35 }, (_, i) => entry(`log-${i}`, `Günlük ${i}. Bugün defterimde yeni bir sayfa açtım.`))];
  let chapters = [{ _id: 'chapter', type: 'chapter', author, createdAt: '2026-10-29T09:00:00Z', work, chapter: { _id: 'chapter', title: 'Denize Bakan Pencere', order: 4 }, likeCount: 0, likedByMe: false }];
  let postCount = 0, likeCount = 0, failPost = false, failLikeReceipt = false, failComment = false, unavailable = false; const comments = [];
  await page.route('https://feed-qa.invalid/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname.replace('/api', ''), method = req.method();
    const reply = (body, status = 200) => route.fulfill({ json: body, status });
    if (p === '/feed') { const items = [logs[0], ...chapters, ...logs.slice(1)].filter(Boolean), offset = Number(url.searchParams.get('cursor')) || 0; return reply({ items: items.slice(offset, offset + 15), hasMore: items.length > offset + 15, nextCursor: items.length > offset + 15 ? String(offset + 15) : null, followingCount: 1 }); }
    if (p === '/user/works') return reply({ items: [work] });
    if (p === '/logs' && method === 'POST') {
      postCount++; await new Promise(r => setTimeout(r, 150)); if (failPost) return reply({ message: 'Test: paylaşım gönderilemedi.' }, 503);
      const body = req.postDataJSON(), item = entry(`created-${postCount}`, body.content, { author: viewer, visibility: body.visibility, relatedWork: body.relatedWork ? work : null, createdAt: '2026-10-29T12:00:00Z' });
      if (body.visibility !== 'private') logs.unshift(item); return reply({ item }, 201);
    }
    const id = p.split('/')[2], log = logs.find(i => i._id === id);
    if (p.endsWith('/detail')) return reply({ item: log });
    if (p.endsWith('/like')) { likeCount++; log.likedByMe = req.postDataJSON().liked; log.likeCount += log.likedByMe ? 1 : -1; return failLikeReceipt ? reply({ message: 'Test: beğeni yanıtı kayboldu.' }, 503) : reply({ likedByMe: log.likedByMe, likeCount: log.likeCount }); }
    if (p.endsWith('/comments')) {
      if (method === 'POST') { if (failComment) return reply({ message: 'Test: yorum gönderilemedi.' }, 503); comments.push({ _id: 'comment', author: viewer, content: req.postDataJSON().content }); }
      return reply(method === 'POST' ? { item: comments.at(-1) } : { items: comments });
    }
    if (p.startsWith('/logs/')) return reply({ items: logs.filter(i => i.author._id === id), hasMore: false });
    if (p.startsWith('/public/works/')) { if (unavailable) { chapters = []; return reply({ message: 'Bölüm yayında değil' }, 404); } return reply({ item: { _id: 'chapter' } }); }
    return reply({ items: [] });
  });
  const goto = async (query = '') => { await page.goto(`http://127.0.0.1:5199/${query}#/`); await page.getByRole('button', { name: 'Günlüğüne yaz…', exact: true }).waitFor(); await page.getByText('Yeni bölüm yayımladı', { exact: true }).waitFor(); };
  await goto();
  await page.screenshot({ path: path.join(output, 'phone-light.png') });
  await page.getByRole('button', { name: 'Beğen · 12 beğeni', exact: true }).first().dblclick();
  await page.getByRole('button', { name: 'Beğeniyi kaldır · 13 beğeni', exact: true }).first().waitFor(); assert.equal(likeCount, 1);
  failLikeReceipt = true; await page.getByRole('button', { name: 'Beğeniyi kaldır · 13 beğeni', exact: true }).first().click(); await page.getByText('Test: beğeni yanıtı kayboldu.').waitFor();
  failLikeReceipt = false; await page.getByRole('button', { name: 'Beğeniyi kaldır · 13 beğeni', exact: true }).first().click();
  await page.getByRole('button', { name: 'Beğen · 12 beğeni', exact: true }).first().waitFor(); assert.equal(likeCount, 2, 'reconciliation must not replay an applied like intent');
  await page.getByRole('button', { name: 'Yorumlar · 0', exact: true }).first().click();
  await page.getByLabel('Yorumun', { exact: true }).fill('Kaybolmayan yorum'); failComment = true;
  await page.getByRole('button', { name: 'Gönder', exact: true }).click(); await page.getByText('Test: yorum gönderilemedi.').waitFor();
  assert.equal(await page.getByLabel('Yorumun', { exact: true }).inputValue(), 'Kaybolmayan yorum');
  failComment = false; await page.getByRole('button', { name: 'Gönder', exact: true }).click(); await page.getByText('Kaybolmayan yorum', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Geri', exact: true }).click(); await page.getByRole('button', { name: 'Yorumlar · 1', exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Günlüğüne yaz…', exact: true }).click();
  const input = page.getByLabel('Paylaşımın', { exact: true }); await input.fill('Hata olsa da satırlarım burada.\nİkinci satır.');
  await page.getByRole('button', { name: 'Takipçilere açık', exact: true }).click(); await page.getByRole('button', { name: work.title, exact: true }).click();
  failPost = true; await page.getByRole('button', { name: 'Paylaş', exact: true }).click(); await page.getByText('Test: paylaşım gönderilemedi.').waitFor();
  assert.match(await input.inputValue(), /İkinci satır/); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('acb.log-draft:viewer')).visibility), 'followers');
  await page.screenshot({ path: path.join(output, 'composer-error.png') });
  await page.getByRole('button', { name: 'Geri', exact: true }).click(); await page.getByRole('button', { name: 'Günlüğüne yaz…', exact: true }).click();
  assert.match(await input.inputValue(), /İkinci satır/);
  await input.fill('x'.repeat(801)); assert.equal(await input.inputValue(), 'x'.repeat(801)); assert.equal(await page.getByRole('button', { name: 'Paylaş', exact: true }).isDisabled(), true);
  await input.fill('Yeni günlük — satırlar korundu.'); failPost = false;
  await page.getByRole('button', { name: 'Paylaş', exact: true }).dblclick(); await page.getByText('Yeni günlük — satırlar korundu.', { exact: true }).first().waitFor(); assert.equal(postCount, 2);
  // Real FlatList stays mounted while the test navigator stacks a profile above it.
  await page.getByRole('button', { name: 'Günlüğüne yaz…', exact: true }).waitFor();
  const feed = page.getByTestId('community-feed'); await feed.evaluate(el => {
    const scroll = [el, el.parentElement, ...el.querySelectorAll('div')].find(node => ['auto', 'scroll'].includes(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight);
    if (!scroll) throw new Error('No feed scroll surface'); scroll.dataset.qaFeedScroll = 'true'; scroll.scrollTop = 2500; scroll.dispatchEvent(new Event('scroll'));
  });
  const scroll = page.locator('[data-qa-feed-scroll]');
  await page.waitForTimeout(150); const offset = await scroll.evaluate(el => el.scrollTop); assert.ok(offset > 1500);
  await page.evaluate(() => { location.hash = '/profile/writer'; }); await page.getByRole('button', { name: 'Geri', exact: true }).click();
  assert.equal(await scroll.evaluate(el => el.scrollTop), offset);
  for (const [name, viewport, query] of [['phone-dark', { width: 390, height: 844 }, '?theme=dark'], ['tablet-light', { width: 1024, height: 900 }, ''], ['phone-large-text', { width: 390, height: 844 }, '?fontScale=1.7']]) {
    await page.setViewportSize(viewport); await goto(query); await page.screenshot({ path: path.join(output, `${name}.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: horizontal overflow`);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await goto();
  await page.getByRole('button', { name: 'Bölümü oku', exact: true }).click(); await page.waitForURL(/mode=start/); assert.match(page.url(), /chapterId=chapter/);
  await page.getByRole('button', { name: 'Geri', exact: true }).click(); unavailable = true; await page.getByRole('button', { name: 'Bölümü oku', exact: true }).click();
  await page.getByText('Bu bölüm yayından kaldırılmış veya erişime kapatılmış. Akış yenileniyor.').waitFor(); assert.equal(await page.getByRole('button', { name: 'Bölümü oku', exact: true }).count(), 0);
  await page.evaluate(() => window.changeFeedAccount(null)); await page.getByRole('button', { name: 'Giriş yap / Kayıt ol' }).waitFor(); assert.equal(await page.getByTestId('community-feed').count(), 0);
  assert.deepEqual(errors, []); console.log('PASS: phone/tablet themes, simulated large text, like lock, journal comments, draft persistence, limits, visibility, submit failure/duplicate guard, stacked return offset, direct chapter link, unavailable chapter, logout purge.');
  console.log('Screenshots:', output);
} finally { await browser?.close(); await server.close(); }
