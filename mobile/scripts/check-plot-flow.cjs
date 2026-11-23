// Explicit fixtures only in this QA harness; production screens and draft engine are used.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const people = [{ _id: 'c', name: 'İpek' }];
  let scenes = [
    { _id: 'a', title: 'İskelede bir mektup', act: 'giris', description: 'İpek, babasının hiç göndermediği mektubu bulur.', goal: 'Hikâyenin sorusunu aç', order: 0, status: 'idea', characters: people, draftText: 'Yağmurdan sonra, taşlar hâlâ sıcaktı.\n'.repeat(60), connections: [{ target: 'b', edgeType: 'kesif' }], isAlternative: true, time: 'Üç yıl önce', chapter: 'chapter-one', position: { x: 800, y: 200 } },
    { _id: 'b', title: 'Kapının ardındaki ses', act: 'giris', description: 'Eski evde cevap bekleyen bir ses vardır.', goal: '', order: 1, status: 'writing', characters: [], connections: [{ target: 'd', edgeType: 'karar' }] },
    { _id: 'd', title: 'Kıyıya dönüş', act: 'sonuc', description: 'Yolculuğun sonu bir başlangıca dönüşür.', goal: '', order: 0, status: 'done', characters: [], connections: [] },
  ];
  let structure = { templateId: 'klasik', acts: [{ id: 'giris', label: 'Giriş' }, { id: 'gelisme', label: 'Gelişme' }, { id: 'sonuc', label: 'Sonuç' }] };
  let version = 1; let fail = false; const writes = []; const errors = [];
  const data = scene => ({ title: scene.title, description: scene.description || '', goal: scene.goal || '', act: scene.act, status: scene.status, draftText: scene.draftText || '', volume: scene.volume || '', characters: (scene.characters || []).map(c => c._id) });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('https://visual-qa.invalid/api/**', async route => {
      const req = route.request(); const url = new URL(req.url()); const p = url.pathname.replace('/api', ''); const method = req.method(); const body = req.postDataJSON(); let result;
      if (method !== 'GET') { writes.push({ p, method, body }); if (fail) return route.fulfill({ status: 500, json: { message: 'Deneme kayıt hatası' } }); }
      if (p.startsWith('/works/')) result = { item: { _id: 'w1', title: 'Şehrin Unuttuğu Sesler' } };
      else if (p.startsWith('/characters')) result = { items: people };
      else if (p.startsWith('/world/')) { if (method === 'PATCH') structure = body.structure; result = { world: { structure, locations: [], timeline: [], rules: [], notes: [] } }; }
      else if (p === '/plots/w1') result = { plot: { scenes, updatedAt: String(version) }, chapters: [{ _id: 'chapter-one', title: 'Birinci bölüm' }] };
      else if (p.startsWith('/mobile/tools/scenes/') && method === 'GET') { const s = scenes.find(s => s._id === p.split('/').at(-1)); result = { saved: { recordId: s._id, version: String(version), data: data(s) } }; }
      else if (p === '/mobile/tools/scenes' && method === 'POST') {
        let s = scenes.find(s => s._id === body.recordId);
        if (!s) { s = { _id: 'new-' + scenes.length, order: scenes.length, connections: [], characters: [] }; scenes.push(s); }
        Object.assign(s, body.data, body.data.characters ? { characters: body.data.characters.map(id => people.find(c => c._id === id)) } : {});
        result = { saved: { recordId: s._id, version: String(++version), data: data(s) } };
      } else if (p.endsWith('/move')) {
        const s = scenes.find(s => s._id === body.sceneId); s.act = body.act; const group = scenes.filter(x => x.act === body.act && x._id !== s._id).sort((a,b) => a.order-b.order);
        group.splice(body.beforeId ? group.findIndex(x => x._id === body.beforeId) : group.length, 0, s); group.forEach((x,i) => x.order=i); version++; result = { ok: true };
      } else if (p.endsWith('/connect') || p.endsWith('/disconnect')) {
        const s = scenes.find(s => s._id === p.split('/')[4]);
        if (p.endsWith('/disconnect')) s.connections = s.connections.filter(l => l.target !== body.targetId);
        else s.connections.push({ target: body.targetId, edgeType: body.edgeType }); version++; result = { connections: s.connections };
      } else if (method === 'DELETE') { const id = p.split('/').at(-1); scenes = scenes.filter(s => s._id !== id); scenes.forEach(s => s.connections = s.connections.filter(l => l.target !== id)); version++; result = { ok: true }; }
      else throw new Error(`Unexpected ${method} ${p}`);
      await route.fulfill({ json: result });
    });
    let visits = 0;
    const go = (suffix = '', theme = 'light') => page.goto(`http://127.0.0.1:5186/?theme=${theme}&qaVisit=${++visits}#/plot/w1${suffix}`);
    await go(); await page.getByTestId('graph-canvas').waitFor();
    await page.getByRole('button', { name: 'İskelede bir mektup', exact: true }).click(); await page.getByRole('button', { name: 'Sahneyi aç', exact: true }).click();
    await page.getByText('ALTERNATİF DAL', { exact: true }).waitFor(); await page.getByText('Zaman · Üç yıl önce').waitFor(); await page.getByRole('button', { name: 'Bağlı bölümü aç · Birinci bölüm' }).waitFor();
    await page.getByRole('button', { name: '→ Kapının ardındaki ses' }).click(); await page.getByText('Bu sahneye gelir', { exact: false }).waitFor();
    await go('/a/edit'); await page.getByLabel('Sahne metni', { exact: true }).fill('Yeni sahne metni. Türkçe: ıİşŞğĞüÜ.');
    fail = true; await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Deneme kayıt hatası').waitFor();
    assert.equal(await page.getByLabel('Sahne metni', { exact: true }).inputValue(), 'Yeni sahne metni. Türkçe: ıİşŞğĞüÜ.');
    await page.reload(); await page.getByLabel('Sahne metni', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Sahne metni', { exact: true }).inputValue(), 'Yeni sahne metni. Türkçe: ıİşŞğĞüÜ.');
    fail = false; await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Sunucuya kaydedildi · cihaz kopyası hazır').waitFor();
    assert.deepEqual(writes.at(-1).body.data, { draftText: 'Yeni sahne metni. Türkçe: ıİşŞğĞüÜ.' }); assert.deepEqual(scenes[0].position, { x: 800, y: 200 });
    await go('/new?act=sonuc'); await page.getByLabel('Başlık *').fill('Yeni final'); const before = writes.length; assert.equal(writes.length, before);
    await page.getByRole('button', { name: 'Kaydet', exact: true }).evaluate(el => { el.click(); el.click(); }); await page.getByText('Sunucuya kaydedildi · cihaz kopyası hazır').waitFor(); assert.equal(writes.length, before + 1); assert.equal(scenes.at(-1).act, 'sonuc');
    await go('/a/connect'); assert.equal(await page.getByRole('button', { name: 'İskelede bir mektup', exact: true }).count(), 0); assert.equal(await page.getByRole('button', { name: 'Kapının ardındaki ses', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Kıyıya dönüş', exact: true }).click(); await page.getByRole('button', { name: 'Yüzleşme', exact: true }).click(); await page.getByRole('button', { name: 'Bağlantıyı kaydet' }).click(); await page.getByText('Bağlantı kaydedildi.').waitFor();
    await go('/a'); await page.getByRole('button', { name: 'Bağlantıyı kaldır', exact: true }).last().click(); await page.getByRole('button', { name: '→ Kıyıya dönüş' }).waitFor({ state: 'hidden' });
    await go('/a/move'); await page.getByRole('button', { name: 'Sonuç', exact: true }).click(); await page.getByRole('button', { name: 'En başa', exact: true }).click(); await page.getByRole('button', { name: 'Taşımayı kaydet' }).click(); await page.getByText('Sahne taşındı.').waitFor(); assert.equal(scenes.find(s => s._id === 'a').act, 'sonuc');
    await go('/structure'); await page.getByRole('button', { name: 'Epik · 5 aşama', exact: true }).click(); await page.getByText('Perde yapısı kaydedildi.', { exact: false }).waitFor(); assert.equal(scenes.length, 4);
    await go(); await page.getByLabel('Sahne ara…').fill('olmayan'); await page.getByText('Bu aramada sahne yok').waitFor(); await page.getByLabel('Sahne ara…').fill(''); await page.getByRole('button', { name: 'Liste', exact: true }).click(); await page.getByRole('button', { name: 'İskelede bir mektup, sahneyi aç' }).waitFor();
    fs.mkdirSync('artifacts/design', { recursive: true });
    for (const width of [320, 430, 1024]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 844 }); await go('', theme); await page.getByTestId('graph-canvas').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/design/plot-home-${theme}-${width}.png` });
    }
    for (const suffix of ['/a', '/a/edit', '/a/move', '/a/connect', '/new', '/structure']) {
      await page.setViewportSize({ width: 320, height: 700 }); await go(suffix, 'dark'); await page.getByText('Şehrin Unuttuğu Sesler', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({ path: `artifacts/design/plot-${suffix.replaceAll('/', '-')}.png` });
    }
    await page.setViewportSize({ width: 844, height: 390 }); await go(); await page.getByTestId('graph-canvas').waitFor();
    await page.getByRole('button', { name: 'İskelede bir mektup', exact: true }).click(); await page.getByRole('button', { name: 'Sahneyi aç', exact: true }).waitFor();
    const graphBox = await page.getByTestId('graph-canvas').boundingBox(); assert.ok(graphBox.height > 100); assert.ok(graphBox.y + graphBox.height <= 390);
    await page.screenshot({ path: 'artifacts/design/plot-landscape.png' });
    await page.setViewportSize({ width: 320, height: 568 }); await go(); await page.getByLabel('Perde, karakter ve durum filtreleri').click(); await page.getByRole('button', { name: 'Filtreleri temizle' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Haritaya dön' }).click(); await page.getByTestId('graph-canvas').waitFor();
    scenes[0].title = 'Çok uzun bir sahne adı: '.repeat(8); scenes[0].draftText = 'İstanbul üzerine uzun metin.\n'.repeat(1200);
    await go('/a'); await page.getByRole('button', { name: 'Sahneyi düzenle' }).waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'artifacts/design/plot-long-title.png' });
    await page.getByRole('button', { name: 'Sahne işlemleri' }).click(); await page.getByRole('button', { name: 'Sahneyi sil', exact: true }).click(); await page.getByTestId('graph-canvas').waitFor(); assert.equal(scenes.some(s => s._id === 'a'), false);
    structure = { acts: [] }; await go('/new'); await page.getByRole('button', { name: 'Serbest', exact: true }).click(); await page.getByLabel('Başlık *').waitFor(); assert.equal(structure.templateId, 'serbest');
    assert.deepEqual(errors, []); console.log('PASS map → detail, create/save/reopen, failed save/restart recovery, partial patch, links, move, structure, delete and 12 responsive/theme screenshots');
  } catch (error) { console.error(errors); if (page) { console.error((await page.locator('body').innerText()).slice(0,4000)); await page.screenshot({path:'artifacts/design/plot-failure.png'}); } throw error; } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
