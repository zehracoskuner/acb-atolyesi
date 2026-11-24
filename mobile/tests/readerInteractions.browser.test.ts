import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { mkdir } from 'node:fs/promises';

// Actual ReaderScreen/ReaderComments rendered through RN Web adapters. No device claims.
vi.setConfig({ testTimeout: 30000 });
describe.skipIf(!process.env.MOBILE_READER_BROWSER)('reader interaction components in Chromium', () => {
  let browser: Browser, preview: ChildProcess, context: BrowserContext, page: Page;
  let calls: { path: string; method: string; body: any }[], roots: any[], likeFailure: boolean, sendFailure: boolean, likeDelay: number, checkDelay: number;
  const owner = { _id: 'visual-author', kullaniciAdi: 'deniz_yazar' }, other = { _id: 'other', kullaniciAdi: 'okur' };
  type PassageComment = { _id: string; content: string; author: typeof owner; previousPassage?: boolean; paragraphText?: string };
  let inlineComments: Record<number, PassageComment[]>;
  const blocks = Array.from({ length: 35 }, (_, index) => ({ id: `b${index}`, paragraphId: `passage-${index}`, index, text: `Paragraf ${index} İstanbul ışıkları. `.repeat(8), html: `<p>Paragraf ${index} ${'İstanbul ışıkları. '.repeat(18)}</p>` }));
  const chapter = (id: string) => ({ _id: id, title: id === 'c2' ? 'İkinci bölüm' : 'İlk bölüm', blocks, contentVersion: 'published-v1', content: '', revision: 1 });
  beforeAll(async () => {
    preview = spawn(process.execPath, ['scripts/design-preview.mjs'], { cwd: fileURLToPath(new NodeURL('../', import.meta.url)), windowsHide: true, env: { ...process.env, MOBILE_QA_PORT: process.env.MOBILE_READER_TEST_PORT || '5197' }, stdio: 'pipe' });
    let output = ''; preview.stdout?.on('data', chunk => { output += chunk; }); preview.stderr?.on('data', chunk => { output += chunk; });
    await new Promise<void>((resolve, reject) => {
      const timer = setInterval(() => { if (output.includes('Visual QA:')) { clearInterval(timer); resolve(); } else if (preview.exitCode !== null) { clearInterval(timer); reject(Error(output)); } }, 100);
      setTimeout(() => { clearInterval(timer); if (!output.includes('Visual QA:')) reject(Error(output || 'Preview startup timeout')); }, 25000).unref();
    });
    browser = await chromium.launch({ executablePath: process.env.MOBILE_READER_BROWSER, headless: true });
  }, 30000);
  afterAll(async () => { await browser?.close(); preview?.kill(); });
  beforeEach(async () => {
    calls = []; likeFailure = false; sendFailure = false; likeDelay = 0; checkDelay = 0;
    inlineComments = { 2: [{ _id: 'inline1', content: 'Bu paragrafa özel', author: owner, previousPassage: true, paragraphText: 'Pasajın eski metni' }] };
    roots = [
      { _id: 'root1', content: 'Ana yorum', author: owner, createdAt: '2026-10-20T10:00:00Z', likeCount: 0, isLiked: false, replies: [{ _id: 'reply1', content: 'İlk yanıt', author: other, createdAt: '2026-10-20T11:00:00Z', likeCount: 0 }] },
      { _id: 'root2', content: '<img src=x onerror=alert(1)> düz metin', author: other, createdAt: '2026-10-19T10:00:00Z', likeCount: 0, replies: [] },
      { _id: 'root3', content: 'Sonraki sayfadaki yorum', author: other, createdAt: '2026-10-18T10:00:00Z', likeCount: 0, replies: [] },
    ];
    context = await browser.newContext({ viewport: { width: 390, height: 844 } }); page = await context.newPage();
    page.setDefaultTimeout(12000); page.on('pageerror', error => console.error('Reader browser:', error.message));
    await page.route('https://visual-qa.invalid/api/**', async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname.replace('/api', ''), method = req.method(), body = req.postDataJSON(); calls.push({ path: path + url.search, method, body });
      let status = 200, data: any = { ok: true };
      if (path === '/public/works/w') data = { item: { _id: 'w', title: 'Test eseri', author: owner } };
      else if (path === '/public/works/w/chapters') data = { items: [chapter('c1'), chapter('c2')] };
      else if (path.startsWith('/public/works/w/chapters/')) data = { item: chapter(path.split('/').at(-1)!) };
      else if (path === '/public/works/w/preview') data = { preview: true, item: chapter('c1') };
      else if (path.endsWith('/like/check')) { const delay = checkDelay; checkDelay = 0; if (delay) await new Promise(resolve => setTimeout(resolve, delay)); data = { liked: false, likeCount: path.includes('c2') ? 2 : 0 }; }
      else if (path.startsWith('/chapters/') && method === 'POST') { if (likeDelay) await new Promise(resolve => setTimeout(resolve, likeDelay)); status = likeFailure ? 503 : 200; data = likeFailure ? { message: 'Beğeni kaydedilemedi.' } : { liked: body.liked, likeCount: body.liked ? 1 : 0 }; }
      else if (path === '/inline-comments') {
        if (method === 'POST') {
          const item = { _id: `new-inline-${calls.length}`, content: body.content, author: owner };
          (inlineComments[body.paragraphIndex] ||= []).push(item);
          data = { item };
        } else if (url.searchParams.has('summary')) {
          data = { counts: Object.fromEntries(Object.entries(inlineComments).map(([index, items]) => [index, items.length])), detachedCount: 0 };
        } else {
          const items = inlineComments[Number(url.searchParams.get('paragraphIndex'))] || [];
          data = { items, total: items.length, page: 1, pages: items.length ? 1 : 0 };
        }
      }
      else if (path.startsWith('/comments/chapter/')) {
        if (method === 'POST') {
          if (sendFailure) { status = 503; data = { message: 'Yorum gönderilemedi.' }; }
          else { const item = { _id: 'created-' + calls.length, content: body.content, author: owner, createdAt: new Date().toISOString(), status: 'published', replies: [] }; if (body.parentId) roots.find(r => r._id === body.parentId).replies.push(item); else roots.unshift(item); data = { item }; }
        } else data = url.searchParams.has('summary') ? { total: roots.length } : { items: url.searchParams.get('page') === '2' ? roots.slice(1) : roots.slice(0, 2), total: roots.length, pages: 2, page: Number(url.searchParams.get('page')) || 1 };
      } else if (path.startsWith('/comments/')) {
        const id = path.split('/')[2], item = roots.flatMap(r => [r, ...r.replies]).find(r => r._id === id);
        if (path.endsWith('/like')) { item.isLiked = body.liked; item.likeCount = body.liked ? 1 : 0; data = { liked: item.isLiked, likeCount: item.likeCount }; }
        else if (method === 'PATCH') { item.content = body.content; item.isEdited = true; data = { item }; }
        else if (method === 'DELETE') { if (item.replies.length) { item.isDeleted = true; item.content = null; } else roots = roots.filter(r => r._id !== id); data = { tombstone: !!item.replies.length }; }
      } else if (path === '/reports/reasons') data = { reasons: { spam: 'Spam', taciz: 'Taciz', telif_ihlali: 'Telif İhlali' } };
      else if (path === '/reports') { status = 201; data = { message: 'Alındı' }; }
      if (method === 'GET' && page.url().includes('guest=1') && (path.startsWith('/comments/') || path === '/inline-comments')) { status = 401; data = { message: 'Yorumları okumak için giriş yap.' }; }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
  });
  afterEach(async () => { await context?.close(); });
  const load = async (query = '') => { await page.goto(`http://127.0.0.1:${process.env.MOBILE_READER_TEST_PORT || '5197'}/${query}#/read/w/c1?mode=start`); await page.frameLocator('iframe').locator('#like').waitFor().catch(async error => { throw new Error((await page.locator('body').innerText()).slice(0, 2500) + '\n' + error.message); }); if (!query.includes('guest=1')) await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.getElementById('comments')?.textContent?.includes('(3)')); };
  const panel = async () => { await page.getByRole('button', { name: 'Bölüm yorumları', exact: true }).click(); await page.getByText('Ana yorum', { exact: true }).waitFor(); };

  it('serializes double likes, keeps failures unchanged and ignores a response from the previous chapter', async () => {
    checkDelay = 800; await load(); const surface = page.frameLocator('iframe');
    await surface.locator('#like').evaluate((el: HTMLButtonElement) => { el.click(); el.click(); });
    await surface.getByRole('button', { name: 'Beğeniyi geri al' }).waitFor();
    expect(calls.filter(c => c.path === '/chapters/c1/like')).toHaveLength(1);
    await page.waitForTimeout(850); expect(await surface.locator('#like').innerText()).toBe('♥ Beğenildi · 1');
    await surface.locator('#like').click(); await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.getElementById('like')?.textContent === '♡ Bölümü beğen · 0');
    likeFailure = true; await surface.locator('#like').click(); await page.getByText('Beğeni kaydedilemedi.', { exact: true }).waitFor(); expect(await surface.locator('#like').innerText()).toBe('♡ Bölümü beğen · 0');
    likeFailure = false; likeDelay = 400; await surface.locator('#like').click(); await surface.getByRole('button', { name: 'Sonraki bölüm →' }).click();
    await page.frameLocator('iframe').getByRole('heading', { name: 'İkinci bölüm' }).waitFor(); await page.waitForTimeout(600);
    expect(await page.frameLocator('iframe').locator('#like').innerText()).toBe('♡ Bölümü beğen · 2');
  });
  it('preserves the reading anchor and drafts on close, validates length, retains failed text and sends one root', async () => {
    await load(); await page.frameLocator('iframe').locator('[data-index="15"]').evaluate(el => el.scrollIntoView());
    const y = await page.frameLocator('iframe').locator('body').evaluate(() => scrollY);
    await panel(); await page.getByRole('button', { name: 'Bu bölüm hakkında düşüncelerini yaz…', exact: true }).click();
    const field = page.getByRole('textbox', { name: 'Bu bölüm hakkında düşüncelerini yaz…' });
    await field.fill('x'.repeat(2001)); expect(await field.inputValue()).toHaveLength(2001); expect(await page.getByRole('button', { name: 'Gönder', exact: true }).isDisabled()).toBe(true);
    await field.fill('Korunacak taslak'); await page.getByRole('button', { name: 'Kapat', exact: true }).click();
    expect(Math.abs(await page.frameLocator('iframe').locator('body').evaluate(() => scrollY) - y)).toBeLessThan(2);
    await panel(); expect(await field.inputValue()).toBe('Korunacak taslak');
    sendFailure = true; await page.getByRole('button', { name: 'Gönder', exact: true }).click(); await page.getByText('Yorum gönderilemedi.', { exact: true }).waitFor(); expect(await field.inputValue()).toBe('Korunacak taslak');
    sendFailure = false; const before = calls.filter(c => c.method === 'POST' && c.path.startsWith('/comments/chapter')).length;
    await page.getByRole('button', { name: 'Gönder', exact: true }).evaluate((el: HTMLElement) => { el.click(); el.click(); });
    await page.getByText('Yorumun kaydedildi.', { exact: true }).waitFor(); expect(calls.filter(c => c.method === 'POST' && c.path.startsWith('/comments/chapter')).length - before).toBe(1);
    expect(await page.getByText('Korunacak taslak', { exact: true }).count()).toBe(1);
    await page.getByRole('button', { name: 'Daha fazla yorum', exact: true }).click(); await page.getByText('Sonraki sayfadaki yorum', { exact: true }).waitFor();
    expect(await page.getByText('Ana yorum', { exact: true }).count()).toBe(1);
  });
  it('replies to the root, edits in place, keeps tombstone replies and uses the general report endpoint', async () => {
    await load(); await panel(); await page.getByRole('button', { name: '1 yanıtı göster' }).click();
    await page.getByRole('button', { name: 'Yanıtla', exact: true }).nth(1).click();
    await page.getByRole('textbox', { name: 'Bu bölüm hakkında düşüncelerini yaz…' }).fill('Yanıta yanıt'); await page.getByRole('button', { name: 'Gönder', exact: true }).click();
    await page.getByText('Yanıta yanıt', { exact: true }).waitFor(); expect(calls.find(c => c.body?.content === 'Yanıta yanıt')?.body.parentId).toBe('root1');
    await page.getByRole('button', { name: 'Yorum menüsü', exact: true }).first().click(); await page.getByRole('button', { name: 'Düzenle', exact: true }).click();
    await page.getByRole('textbox', { name: 'Yorumunu düzenle', exact: true }).fill('Yeni metin'); await page.getByRole('button', { name: 'Değişikliği kaydet' }).click();
    await page.getByText('Yeni metin', { exact: true }).waitFor(); expect(calls.find(c => c.method === 'PATCH')?.path).toBe('/comments/root1');
    await page.getByRole('button', { name: 'Yorum menüsü', exact: true }).first().click(); await page.getByRole('button', { name: 'Sil', exact: true }).click();
    await page.getByText('Yanıtlar korunacak, yorumun kaldırıldığı bilgisi görünecek.').waitFor(); await page.getByRole('button', { name: 'Sil', exact: true }).click();
    await page.getByText('[Bu yorum kaldırıldı]', { exact: true }).waitFor(); await page.getByText('Yanıta yanıt', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Yorum menüsü', exact: true }).last().click(); await page.getByRole('button', { name: 'Şikâyet et', exact: true }).click();
    const spam = page.getByRole('button', { name: 'Spam', exact: true });
    await spam.waitFor();
    expect(await page.getByRole('button', { name: 'Telif İhlali', exact: true }).count()).toBe(0);
    await spam.click(); await page.getByRole('button', { name: 'Şikâyeti gönder', exact: true }).click();
    await page.getByText('Şikâyetin incelemeye alındı.', { exact: true }).waitFor(); expect(calls.find(c => c.path === '/reports' && c.method === 'POST')?.body).toMatchObject({ targetType: 'comment', targetId: 'root2', reason: 'spam' });
    expect(calls.some(c => c.path.endsWith('/report'))).toBe(false);
  });
  it('asks guests to log in for discussion text without silently liking', async () => {
    await load('?guest=1'); await page.getByRole('button', { name: 'Bölüm yorumları', exact: true }).click(); await page.getByText('Yorumlar yüklenemedi. Yorumları okumak için giriş yap.', { exact: true }).waitFor(); expect(await page.getByText('Ana yorum', { exact: true }).count()).toBe(0); await page.getByRole('button', { name: 'Yorum yapmak için giriş yap', exact: true }).click();
    await page.waitForURL(/#\/auth\/login$/); expect(calls.some(c => c.method === 'POST' && c.path.endsWith('/like'))).toBe(false);
  });
  it('posts a chapter-wide comment from the footer and keeps paragraph actions beside the text', async () => {
    await load();
    await page.getByRole('button', { name: 'Okuma menüsü', exact: true }).click();
    await page.getByRole('heading', { name: 'Okuma menüsü', exact: true }).waitFor();
    expect(await page.getByRole('button', { name: 'Paragraf yorumları', exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: 'Kapat', exact: true }).click();
    await page.frameLocator('iframe').locator('footer').getByRole('button', { name: 'Bölüm yorumları (3)', exact: true }).click();
    await page.getByRole('heading', { name: 'Bölüm yorumları', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Bu bölüm hakkında düşüncelerini yaz…', exact: true }).click();
    await page.getByRole('textbox', { name: 'Bu bölüm hakkında düşüncelerini yaz…' }).fill('Bölümün tamamı için yorum.');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();
    await page.getByText('Yorumun kaydedildi.', { exact: true }).waitFor();
    expect(calls.find(c => c.method === 'POST' && c.path === '/comments/chapter/c1')?.body).toEqual({
      content: 'Bölümün tamamı için yorum.', workId: 'w', chapterId: 'c1',
    });
  });
  it('opens the chosen paragraph separately and captures readable panels in all themes', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    await load();
    const surface = page.frameLocator('iframe');
    const marker = surface.getByRole('button', { name: '3. paragraf, 1 yorum', exact: true });
    await marker.scrollIntoViewIfNeeded();
    const top = await marker.evaluate(() => scrollY);
    await marker.click();
    const heading = page.getByRole('heading', { name: 'Paragraf yorumları', exact: true });
    await heading.waitFor();
    await page.getByText('Bu paragrafa özel', { exact: true }).waitFor();
    expect(await heading.evaluate(el => el.parentElement!.parentElement!.getBoundingClientRect().height / innerHeight)).toBeCloseTo(0.58, 1);
    const oldPassage = page.getByText('Pasajın eski metni', { exact: true });
    expect(await oldPassage.count()).toBe(0);
    await page.getByRole('button', { name: 'Önceki sürüme yazıldı', exact: true }).click();
    await oldPassage.waitFor();
    await mkdir('artifacts/reader-interactions', { recursive: true });
    await page.screenshot({ path: 'artifacts/reader-interactions/paragraph-compact.png' });
    await page.getByRole('button', { name: 'Bu paragrafa yorum yaz…', exact: true }).click();
    await page.getByRole('textbox', { name: 'Bu paragraf hakkında düşüncelerini yaz…' }).fill('Paragrafı okurken yazdım.');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();
    await page.getByText('Yorumun kaydedildi.', { exact: true }).waitFor();
    expect(calls.find(c => c.method === 'POST' && c.path === '/inline-comments')?.body).toMatchObject({ chapterId: 'c1', paragraphIndex: 2, blockId: 'b2' });
    await page.getByRole('button', { name: 'Kapat', exact: true }).click();
    const updated = surface.getByRole('button', { name: '3. paragraf, 2 yorum', exact: true });
    await updated.waitFor();
    await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.activeElement?.matches('[data-passage="passage-2"]'));
    expect(await updated.getAttribute('aria-expanded')).toBe('false');
    expect(Math.abs(await updated.evaluate(() => scrollY) - top)).toBeLessThan(2);
    await page.screenshot({ path: 'artifacts/reader-interactions/paragraph-marker.png' });
    expect(calls.some(c => c.path.includes('paragraphIndex=2'))).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ['light', 'sepia', 'dark']) {
      await page.evaluate(theme => localStorage.setItem('reader.preferences.v2:visual-author', JSON.stringify({ theme })), theme);
      await page.reload(); await page.getByRole('button', { name: 'Bölüm yorumları', exact: true }).waitFor(); await panel(); await page.waitForTimeout(350);
      await page.screenshot({ path: `artifacts/reader-interactions/phone-${theme}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(150);
    await page.screenshot({ path: 'artifacts/reader-interactions/tablet-dark.png' });
    expect(await page.getByRole('heading', { name: 'Bölüm yorumları', exact: true }).evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(680);
  });
});
