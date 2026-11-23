// Real RN Web screens/hooks with controlled HTTP responses. No production data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('artifacts/explore'); fs.mkdirSync(out, { recursive: true });
const base = process.env.EXPLORE_TEST_URL || 'http://127.0.0.1:5188';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const writers = [{ _id: 'writer', kullaniciAdi: 'deniz_yazar', bio: 'Şehrin sessiz köşelerinden hikâyeler. Kelimelerle bir dünya kuruyorum.' }, { _id: 'poet', kullaniciAdi: 'ece_kalem', bio: 'Biraz düş, biraz yol; defterimde birikenler.' }, { _id: 'reader', kullaniciAdi: 'okur', bio: 'Okuyorum, yazıyorum.' }];
const titles = ['Şehrin Unuttuğu Sesler', 'Bir Başka Gökyüzü', 'Kıyıda Kalanlar', 'Geceye Açılan Kapı', 'Sonbaharın Defteri', 'Rüzgârın Hafızası'];
const works = Array.from({ length: 32 }, (_, i) => ({ _id: `book-${i}`, title: i < 6 ? titles[i] : `Hikâye ${i + 1}`, author: writers[i % 2], description: i % 3 === 0 ? 'Unutulmuş bir sokak, yarım kalmış bir mektup. Her adımda yeniden başlayan bir hikâye.' : '', genres: [i % 2 ? 'Gotik' : 'Fantastik'], chapterCount: 3, status: 'published', coverImage: i === 1 ? 'https://visual-qa.invalid/broken.jpg' : '' }));
const log = { _id: 'log-1', type: 'log', content: 'Bazen bir hikâyenin başladığı yeri fark etmeyiz. Bir ses, bir pencere, masada unutulmuş bir fincan… Bugün defterime bunları yazdım. '.repeat(4), author: writers[0], visibility: 'public', createdAt: '2026-10-28T10:00:00Z', likeCount: 2, likedByMe: false, commentCount: 0 };
const requests = [], followed = new Set(), library = new Set();
let failReview = false, failWriters = false, reviewEmpty = false;
function paged(items, query, fallback) { const limit = Number(query.get('limit')) || fallback, page = Number(query.get('page')) || 1; return { items: items.slice((page - 1) * limit, page * limit), pagination: { page, total: items.length, totalPages: Math.ceil(items.length / limit) } }; }
async function fixture(route) {
  const url = new URL(route.request().url()), p = url.pathname.replace(/^\/api/, ''), q = url.searchParams, method = route.request().method();
  requests.push({ p, q: Object.fromEntries(q), method, body: route.request().postDataJSON() });
  const send = (json, status = 200) => route.fulfill({ status, json });
  if (url.pathname === '/broken.jpg') return route.fulfill({ status: 404, body: '' });
  if (p === '/works/genres') return send({ genres: ['Fantastik', 'Gotik', 'Dram', 'Deneme', 'Gizem', 'Macera', 'Bilim Kurgu', 'Lirik Şiir', 'Tarihi Kurgu'].map(genre => ({ genre, count: 3 })) });
  if (p === '/works/discover' || p === '/search/works') {
    const term = q.get('q'), genre = q.get('genres') || q.get('genre');
    if (term === 'eski') { await pause(1000); return send(paged([{ ...works[0], _id: 'old', title: 'Eski yanıt' }], q, 20)); }
    if (term === 'yeni') return send(paged([{ ...works[0], _id: 'new', title: 'Yeni yanıt' }], q, 20));
    if (term === 'hata') return send({ message: 'Eser araması geçici olarak kullanılamıyor.' }, 503);
    return send(paged(term === 'yok' ? [] : works.filter(w => !genre || w.genres.includes(genre)), q, 20));
  }
  if (p === '/search/users') return send(paged(writers.map(w => ({ ...w, isFollowedByMe: followed.has(w._id) })), q, 15));
  if (p === '/feed/writers') return failWriters ? send({ message: 'Yazar servisi geçici olarak kullanılamıyor.' }, 503) : send({ items: writers.map(w => ({ ...w, isFollowedByMe: followed.has(w._id) })) });
  if (p === '/feed/needs-review') return failReview ? send({ message: 'Katkı rafı şu an yüklenemedi.' }, 503) : send({ items: reviewEmpty ? [] : works.slice(6, 8) });
  if (p === '/feed/top-logs') return send({ items: [log, { ...log, _id: 'private-log', visibility: 'private', content: 'PRIVATE LOG MUST NOT RENDER' }] });
  if (p.startsWith('/public/profile/')) {
    const id = p.split('/')[3];
    if (p.endsWith('/follow')) { followed.has(id) ? followed.delete(id) : followed.add(id); return send({ following: followed.has(id), followerCount: followed.size }); }
    if (p.endsWith('/works')) return send({ items: works });
    return send({ user: { ...writers.find(w => w._id === id), isFollowedByMe: followed.has(id), followers: followed.has(id) ? ['reader'] : [], following: [] } });
  }
  if (p.startsWith('/library/check/')) return send({ inLibrary: library.has(p.split('/').pop()) });
  if (p === '/library' && method === 'POST') { library.add(route.request().postDataJSON().workId); return send({}); }
  if (p.startsWith('/library/') && method === 'DELETE') { library.delete(p.split('/').pop()); return send({}); }
  if (p === '/library') return send({ items: works.filter(w => library.has(w._id)) });
  if (p.startsWith('/public/works/')) { const id = p.split('/')[3]; return send(p.endsWith('/chapters') ? { items: [{ _id: 'chapter', title: 'Yayımlanmış bölüm' }] } : { item: works.find(w => w._id === id) || works[0] }); }
  if (p.startsWith('/likes/check/')) return send({ liked: false, likeCount: 0 });
  if (p.startsWith('/reading-progress')) return send({ found: false, items: [] });
  if (p === '/logs/log-1/detail') return send({ item: log });
  if (p === '/logs/log-1/like') { log.likedByMe = route.request().postDataJSON().liked; log.likeCount = log.likedByMe ? 3 : 2; return send({ likedByMe: log.likedByMe, likeCount: log.likeCount }); }
  if (p === '/logs/log-1/comments' && method === 'POST') return send({ item: { _id: 'comment', content: route.request().postDataJSON().content, author: writers[2] } }, 201);
  if (p.startsWith('/logs/')) return send({ items: [], hasMore: false });
  return send({ items: [] });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('https://visual-qa.invalid/**', fixture);
  const search = () => page.getByRole('textbox', { name: 'Eser veya yazar ara' });
  const discovery = () => page.getByTestId('discovery-scroll');
  const results = () => page.getByTestId('work-results');
  async function open(params = '') { await page.goto(`${base}/?${params}#/explore`); await page.getByRole('button', { name: 'Şehrin Unuttuğu Sesler, eseri aç', exact: true }).waitFor(); await page.evaluate(() => document.fonts.ready); }
  async function scroll(el, y) { await el.evaluate((node, y) => { node.scrollTop = y; node.dispatchEvent(new Event('scroll')); }, y); await pause(100); }
  const passes = [];
  const pass = text => { passes.push(text); console.log('PASS ' + text); };
  try {
    await open();
    const cover = await page.getByTestId('cover-placeholder').first().boundingBox();
    assert.ok(cover && cover.y + cover.height < 844 - 65, 'First covers visible in first viewport');
    assert.ok(Math.abs(cover.height / cover.width - 1.5) < .02);
    assert.ok(await page.getByTestId('cover-placeholder').count() >= 6, 'Missing/broken covers have fallbacks');
    assert.equal(await page.getByText('PRIVATE LOG MUST NOT RENDER').count(), 0);
    pass('compact first view, 2:3 covers, missing/broken covers, public-only selection');
    for (const [name, width, height, theme] of [['phone', 390, 844, 'light'], ['phone-dark', 390, 844, 'dark'], ['tablet', 1024, 900, 'light'], ['tablet-dark', 1024, 900, 'dark'], ['small-phone', 320, 700, 'light']]) {
      await page.setViewportSize({ width, height }); await open(`theme=${theme}`); await pause(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(out, `${name}.png`) });
    }
    pass('phone/tablet/light/dark/narrow layout screenshots');
    await page.setViewportSize({ width: 390, height: 844 }); await open('fontScale=1.8');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok((await discovery().boundingBox()).height > 180, 'Large text leaves a scrollable content area');
    await page.screenshot({ path: path.join(out, 'phone-large-text.png') });
    pass('large-text layout at 180% (browser approximation)');
    await page.setViewportSize({ width: 390, height: 844 }); await open();
    const countBefore = requests.filter(r => ['/feed/needs-review', '/feed/writers', '/feed/top-logs'].includes(r.p)).length;
    await page.getByRole('button', { name: 'Fantastik', exact: true }).click();
    await pause(200);
    assert.equal(requests.filter(r => ['/feed/needs-review', '/feed/writers', '/feed/top-logs'].includes(r.p)).length, countBefore);
    assert.ok(requests.some(r => r.p === '/works/discover' && r.q.genres === 'Fantastik'));
    await scroll(discovery(), 460); const offset = await discovery().evaluate(n => n.scrollTop);
    await search().fill('ses'); await results().getByText('Şehrin Unuttuğu Sesler', { exact: true }).waitFor();
    assert.ok(requests.some(r => r.p === '/search/works' && r.q.genre === 'Fantastik'));
    assert.ok(requests.filter(r => r.p === '/search/users').every(r => !r.q.genre && !r.q.genres));
    await page.getByRole('button', { name: 'Aramayı temizle' }).click();
    await pause(150); assert.ok(Math.abs(await discovery().evaluate(n => n.scrollTop) - offset) < 3);
    await page.getByText('Eser türü · Fantastik', { exact: true }).waitFor();
    pass('genre scope and discovery scroll/genre restoration after clearing search');
    await search().fill('eski'); await pause(420); await search().fill('yeni');
    await results().getByText('Yeni yanıt', { exact: true }).waitFor(); await pause(1100);
    assert.equal(await results().getByText('Eski yanıt', { exact: true }).count(), 0);
    pass('350ms debounce and stale-response suppression');
    await search().fill('yok'); await results().getByText('Eser bulunamadı. Aramayı veya türü değiştirebilirsin.').waitFor();
    assert.equal(await results().getByRole('button', { name: 'Tekrar dene', exact: true }).count(), 0);
    pass('empty results are distinct from connection errors');
    await search().fill('hata'); await results().getByText('Eser araması geçici olarak kullanılamıyor.').waitFor();
    await page.getByRole('tab', { name: 'Yazarlar', exact: true }).click();
    await page.getByTestId('writer-results').getByText('deniz_yazar', { exact: true }).waitFor();
    await page.getByTestId('writer-results').getByRole('button', { name: 'Takip et', exact: true }).first().click();
    await page.getByTestId('writer-results').getByRole('button', { name: 'Takibi bırak', exact: true }).waitFor();
    assert.equal(await page.getByTestId('writer-results').getByRole('button', { name: 'Takip et', exact: true }).count(), 1, 'Self has no follow button');
    await page.getByTestId('writer-results').getByRole('button', { name: 'deniz_yazar, yazar profilini aç', exact: true }).click();
    await page.getByRole('button', { name: 'Takip ediliyor', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Takip ediliyor', exact: true }).click();
    await page.getByRole('button', { name: 'Takip et', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Geri', exact: true }).first().click();
    await page.getByTestId('writer-results').getByRole('button', { name: 'Takip et', exact: true }).first().waitFor();
    assert.equal(await search().inputValue(), 'hata');
    await page.getByText('Yazarlar tüm türlerden gösterilir.', { exact: true }).waitFor();
    pass('independent tab errors, self-follow hidden, profile/follow synchronization, back preserves query/tab');
    await page.getByRole('button', { name: 'Aramayı temizle' }).click();
    await page.getByRole('button', { name: 'Türü temizle' }).click();
    await scroll(discovery(), 0); await page.getByRole('button', { name: 'Tümünü gör', exact: true }).click();
    await results().getByText('Şehrin Unuttuğu Sesler', { exact: true }).waitFor();
    await scroll(results(), 10000); await pause(500);
    assert.ok(requests.some(r => r.p === '/works/discover' && r.q.page === '2' && r.q.limit === '20'));
    await scroll(results(), 250); const listOffset = await results().evaluate(n => n.scrollTop);
    const viewport = await results().boundingBox();
    for (const target of await results().getByRole('button', { name: /, eseri aç$/ }).all()) {
      const box = await target.boundingBox();
      if (box && box.y > viewport.y && box.y + box.height < viewport.y + viewport.height) { await target.click(); break; }
    }
    await page.getByRole('button', { name: 'Okumaya başla', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Yazar profilini aç', exact: true }).click();
    await page.getByRole('button', { name: 'Takip et', exact: true }).click();
    await page.getByRole('button', { name: 'Takip ediliyor', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Geri', exact: true }).first().click();
    await page.getByRole('button', { name: 'Okumaya başla', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Geri', exact: true }).click(); await pause(200);
    assert.ok(Math.abs(await results().evaluate(n => n.scrollTop) - listOffset) < 3);
    pass('real second catalog page and detail-return offset after a profile follow change');
    await page.getByRole('button', { name: 'Keşif raflarına dön' }).click(); await scroll(discovery(), 0);
    await page.getByRole('button', { name: 'Şehrin Unuttuğu Sesler, eser menüsü', exact: true }).click();
    await page.getByRole('button', { name: 'Kütüphaneme ekle', exact: true }).click();
    await page.getByText('Kütüphanende kayıtlı.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Menüyü kapat' }).click();
    await page.getByRole('button', { name: 'Şehrin Unuttuğu Sesler, eseri aç', exact: true }).click();
    await page.getByRole('button', { name: 'Rafımda', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Rafımda', exact: true }).click();
    await page.getByRole('button', { name: 'Rafıma ekle', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Geri', exact: true }).click();
    await page.getByRole('button', { name: 'Şehrin Unuttuğu Sesler, eser menüsü', exact: true }).click();
    await page.getByText('Kütüphanende kayıtlı değil.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Menüyü kapat' }).click();
    pass('library menu persists and revalidates detail-screen changes');
    await scroll(discovery(), 10000); await page.getByRole('button', { name: 'Günlüğü aç', exact: true }).click();
    await page.getByRole('heading', { name: 'Günlük', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Beğen · 2 beğeni', exact: true }).click();
    await page.getByRole('textbox', { name: 'Yorumun', exact: true }).fill('Bir yorum');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click(); await pause(150);
    assert.ok(requests.some(r => r.p === '/logs/log-1/like' && r.method === 'POST'));
    assert.ok(requests.some(r => r.p === '/logs/log-1/comments' && r.method === 'POST'));
    assert.ok(!requests.some(r => r.p.startsWith('/comments/') && r.method === 'POST'));
    pass('journal continuation, likes and comments use log APIs');
    failReview = true; failWriters = true; await open();
    await page.getByText('Katkı rafı şu an yüklenemedi.').waitFor();
    await page.getByText('Yazar servisi geçici olarak kullanılamıyor.').waitFor();
    assert.ok(await page.getByRole('button', { name: 'Şehrin Unuttuğu Sesler, eseri aç', exact: true }).count());
    failReview = false; failWriters = false;
    await page.getByRole('button', { name: 'Tekrar dene', exact: true }).first().click(); await pause(150);
    await page.getByText('Katkı rafı şu an yüklenemedi.').waitFor({ state: 'hidden' });
    pass('partial service failures and inline retry');
    reviewEmpty = true; await open('guest=1');
    await page.getByRole('heading', { name: 'Bir yorumunla katkı ver', exact: true }).waitFor({ state: 'hidden' });
    await scroll(discovery(), 10000); await page.getByRole('button', { name: 'Aramıza katıl :)', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Kapat', exact: true }).click();
    await page.getByRole('button', { name: 'Aramıza katıl :)', exact: true }).waitFor({ state: 'hidden' });
    pass('empty contribution shelf hidden and dismissible guest invitation');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({ passes, pageErrors: errors, note: 'RN Web with controlled HTTP fixtures; not an Android/iOS device test.' }, null, 2));
  } catch (error) { await page.screenshot({ path: path.join(out, 'failure.png') }); fs.writeFileSync(path.join(out, 'failure-requests.json'), JSON.stringify(requests.slice(-30), null, 2)); console.error('Page errors:', errors); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
