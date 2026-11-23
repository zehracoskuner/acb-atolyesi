// Isolated QA server responses; production components and API client, no user data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  let people = [{ _id: 'a', work: 'w1', name: 'Ada', role: 'Tanık', color: '#7dd3fc', notes: 'Uzun not. '.repeat(100), x: 900, faction: 'Kuzey' }, { _id: 'b', work: 'w1', name: 'İpek', notes: '' }, { _id: 'c', work: 'w2', name: 'Diğer eser', notes: '' }];
  let relations = [{ _id: 'r', work: 'w1', from: 'b', to: 'a', type: 'custom_web_key', directed: true, strength: 5, label: 'Gizli anlaşma' }];
  const writes = []; let fail = false; let readFailure = false; const errors = []; const dialogs = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', dialog => { dialogs.push(dialog.message()); return dialog.accept(); });
    await page.route('https://visual-qa.invalid/api/**', async route => {
      const req = route.request(); const url = new URL(req.url()); const p = url.pathname.replace('/api', ''); const method = req.method(); let data; const body = req.postDataJSON();
      if (method !== 'GET') { writes.push({ p, method, body }); if (fail) return route.fulfill({ status: 500, json: { message: 'Deneme kayıt hatası' } }); }
      if (readFailure && p === '/characters' && method === 'GET') return route.fulfill({ status: 500, json: { message: 'Karakter listesi alınamadı' } });
      if (p.startsWith('/works/')) data = { item: { _id: p.split('/')[2], title: 'Karakterlerin Eseri' } };
      else if (p === '/characters' && method === 'GET') data = { items: people.filter(c => c.work === url.searchParams.get('workId')) };
      else if (p === '/characters' && method === 'POST') { const item = { _id: 'created-' + people.length, work: body.workId, ...body }; people.push(item); data = { item }; }
      else if (p.startsWith('/characters/') && method === 'PATCH') { const item = people.find(c => c._id === p.split('/')[2]); Object.assign(item, body); data = { item }; }
      else if (p.startsWith('/characters/') && method === 'DELETE') { people = people.filter(c => c._id !== p.split('/')[2]); data = { ok: true }; }
      else if (p === '/relationships' && method === 'GET') data = { items: relations.filter(r => r.work === url.searchParams.get('workId')) };
      else if (p === '/relationships' && method === 'POST') { const item = { _id: 'new-r', work: body.workId, ...body }; relations.push(item); data = { item }; }
      else if (p.startsWith('/relationships/') && method === 'DELETE') { relations = relations.filter(r => r._id !== p.split('/')[2]); data = { ok: true }; }
      else throw new Error(`Unexpected ${method} ${p}`);
      await route.fulfill({ json: data });
    });
    const go = route => page.goto('http://127.0.0.1:5186/#' + route);
    await go('/characters/w1'); await page.getByRole('button', { name: 'Ada, karakter detayını aç' }).waitFor();
    await page.getByLabel('Karakter adı ara…').fill('olmayan'); await page.getByText('Arama sonucu yok.').waitFor();
    await page.getByLabel('Karakter adı ara…').fill('');
    await page.getByRole('button', { name: 'Yeni karakter ekle' }).click(); await page.getByLabel('Ad *').fill('Yeni kişi');
    assert.equal(writes.length, 0); fail = true;
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Deneme kayıt hatası').waitFor(); assert.equal(await page.getByLabel('Ad *').inputValue(), 'Yeni kişi');
    fail = false; await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Karakter kaydedildi.').waitFor();
    await page.getByRole('button', { name: 'Karakter detayına git' }).click(); await page.getByText('Yeni kişi', { exact: true }).waitFor();
    await go('/characters/w1/a/edit'); await page.getByLabel('Notlar', { exact: true }).fill('Yeni not');
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Karakter kaydedildi.').waitFor();
    assert.deepEqual(writes.at(-1).body, { workId: 'w1', notes: 'Yeni not' }); assert.equal(people[0].x, 900);
    await page.getByRole('button', { name: 'Karakter detayına git' }).click(); await page.getByText('Gelen ilişki · Güç 5/5').waitFor(); await page.getByText('custom_web_key', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'İlişki ekle', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Ada', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'İpek', exact: true }).click(); await page.getByRole('button', { name: 'İttifak', exact: true }).click(); await page.getByRole('button', { name: 'Karşılıklı ↔' }).click(); await page.getByRole('button', { name: '4', exact: true }).click(); await page.getByLabel('Açıklama', { exact: true }).fill('Birlikte');
    await page.getByRole('button', { name: 'İlişkiyi kaydet' }).click(); await page.getByText('İlişki kaydedildi.').waitFor();
    assert.deepEqual(writes.at(-1).body, { workId: 'w1', from: 'a', to: 'b', type: 'alliance', directed: false, strength: 4, label: 'Birlikte' });
    await page.getByRole('button', { name: 'Karaktere dön' }).click(); await page.getByText('Karşılıklı · Güç 4/5').waitFor();
    await page.getByRole('button', { name: 'İlişkiyi sil', exact: true }).last().click(); await page.getByText('Karşılıklı · Güç 4/5').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'İpek', exact: true }).click(); await page.getByText('Giden ilişki · Güç 5/5').waitFor();
    await go('/characters/w1/new'); await page.getByLabel('Ad *').fill('Kaydedilmemiş'); const beforeLeave = writes.length;
    await page.getByRole('button', { name: 'Geri dön', exact: true }).click(); assert.equal(writes.length, beforeLeave); assert.ok(dialogs.some(message => message.includes('Değişiklikler kaydedilmedi')));
    await go('/characters/w1/new'); await page.getByLabel('Ad *').fill('Çift gönderim');
    await page.getByRole('button', { name: 'Kaydet', exact: true }).evaluate(el => { el.click(); el.click(); }); await page.getByText('Karakter kaydedildi.').waitFor(); assert.equal(writes.filter(w => w.body?.name === 'Çift gönderim').length, 1);
    await go('/characters/w1/a'); await page.getByRole('button', { name: 'Karakter işlemleri' }).click(); await page.getByRole('button', { name: 'Karakteri sil', exact: true }).click(); await page.getByRole('button', { name: 'İpek, karakter detayını aç' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Ada, karakter detayını aç' }).count(), 0);
    await go('/characters/w2'); await page.getByRole('button', { name: 'Diğer eser, karakter detayını aç' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'İpek, karakter detayını aç' }).count(), 0);
    await go('/characters/empty'); await page.getByText('Henüz karakter yok.').waitFor();
    readFailure = true; await go('/characters/w1'); await page.getByText('Karakter listesi alınamadı').waitFor();
    readFailure = false; await page.getByRole('button', { name: 'Tekrar dene' }).click(); await page.getByRole('button', { name: 'İpek, karakter detayını aç' }).waitFor();
    fs.mkdirSync('artifacts/design', { recursive: true });
    people.find(c => c._id === 'b').name = 'İpek ve çok uzun bir karakter adı '.repeat(3);
    for (const width of [320, 430, 1024]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 844 }); await page.goto(`http://127.0.0.1:5186/?theme=${theme}#/characters/w1`); await page.getByLabel('Karakter adı ara…').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/design/characters-${theme}-${width}.png` });
    }
    people.find(c => c._id === 'b').notes = 'İstanbul üzerine çok uzun bir not.\n'.repeat(150);
    for (const suffix of ['/b', '/b/edit', '/b/relation', '/new']) {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto('http://127.0.0.1:5186/?theme=dark#/characters/w1' + suffix);
      await page.getByText('Karakterlerin Eseri', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: 'artifacts/design/characters-' + suffix.replaceAll('/', '-') + '.png' });
    }
    assert.deepEqual(errors, []); console.log('PASS character CRUD, failed save/retry, patch fields, incoming/mutual relations, delete, double submit, back guard, work isolation and six layouts');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
