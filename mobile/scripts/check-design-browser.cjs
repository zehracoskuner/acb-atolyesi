// Visual/layout acceptance checks against the isolated React Native Web QA renderer.
// Fixtures are never included in the native app. Does not replace an Android/iOS device test.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const routes = [['feed', '/', 'Bir günlük paylaş…'], ['explore', '/explore', 'Keşfet'], ['library', '/library', 'Kütüphane'], ['studio', '/studio', 'Atölye'], ['profile', '/profile', 'deniz_yazar'], ['welcome', '/auth/welcome', 'Keşfetmeye başla'], ['login', '/auth/login', 'Yeniden hoş geldin.'], ['register', '/auth/register', 'Hikâyen burada başlasın.'], ['complete', '/auth/complete', 'Atölyeye hazırlan.'], ['work', '/work/visual-1', 'Açıklama'], ['studio-work', '/studio/visual-1', 'Yeni bölüm yaz'], ['writer', '/write/visual-chapter', 'Kaydet'], ['reader', '/read/visual-1/visual-chapter', 'Sokağın Sonundaki Işık'], ['writer-profile', '/profile/other', 'Takip et'], ['notifications', '/notifications', 'Bildirimler']];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const out = path.resolve('artifacts/design'); fs.mkdirSync(out, { recursive: true });
  const errors = [];
  try {
    const page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.route('https://visual-qa.invalid/**', route => route.abort());
    routes.push(['profile-edit', '/profile-edit', 'Değişiklikleri kaydet']);
    for (const width of [390, 320, 430, 1024]) {
      await page.setViewportSize({ width, height: width === 320 ? 700 : 844 });
      for (const [name, route, text] of routes) {
        await page.goto(`${process.env.DESIGN_TEST_URL || 'http://127.0.0.1:5186'}/#${route}`);
        await page.getByText(text, { exact: true }).first().waitFor(); await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth > innerWidth + 1,
          controls: [...document.querySelectorAll('[role=button], input, textarea, [role=tab]')].filter(el => {
            const rect = el.getBoundingClientRect(); if (!rect.width || rect.top >= innerHeight || rect.bottom <= 0) return false;
            let parent = el.parentElement;
            while (parent && parent !== document.body) { const css = getComputedStyle(parent); if (css.overflowX === 'auto' || css.overflowX === 'scroll') return false; parent = parent.parentElement; }
            return rect.left < -1 || rect.right > innerWidth + 1;
          }).map(el => el.getAttribute('aria-label') || el.textContent) }));
        assert.equal(overflow.document, false, `${name} ${width}: page overflow`);
        assert.deepEqual(overflow.controls, [], `${name} ${width}: controls outside viewport`);
        await page.screenshot({ path: path.join(out, `${name}-${width}.png`) });
        console.log(`PASS ${width}px ${name}`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:5186/#/explore');
    await page.getByLabel('Eser adı veya yazar ara…').fill('Gökyüzü');
    await page.getByText('Şehrin Unuttuğu Sesler', { exact: true }).first().waitFor({ state: 'hidden' });
    assert.ok(await page.getByText('Bir Başka Gökyüzü', { exact: true }).count());
    await page.getByRole('button', { name: 'Aramayı temizle' }).click();
    await page.getByText('Şehrin Unuttuğu Sesler', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Fantastik', exact: true }).click();
    await page.getByText('Şehrin Unuttuğu Sesler', { exact: true }).first().waitFor({ state: 'hidden' });
    console.log('PASS search / clear / genre selection');
    await page.getByRole('button', { name: 'Sırala', exact: true }).click();
    await page.getByRole('button', { name: 'Sevilen', exact: true }).click();
    await page.getByText('Sevilen eserler', { exact: true }).waitFor();
    await page.goto('http://127.0.0.1:5186/#/studio');
    await page.getByRole('button', { name: 'Taslaklar', exact: true }).click();
    await page.getByText('Bu filtrede eser yok', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Yayında', exact: true }).click();
    await page.getByRole('button', { name: 'Bölümü aç', exact: true }).click();
    await page.getByRole('button', { name: 'Kaydet', exact: true }).waitFor();
    await page.goto('http://127.0.0.1:5186/#/profile');
    await page.getByRole('button', { name: 'Profili düzenle', exact: true }).click();
    await page.getByRole('textbox', { name: 'Hakkımda', exact: true }).fill('İstanbul’dan öyküler.');
    let payload;
    await page.route('https://visual-qa.invalid/api/user/profile', async route => { payload = route.request().postDataJSON(); await route.fulfill({ json: { user: { kullaniciAdi: 'deniz_yazar' } } }); });
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click();
    await page.getByText('Profilin kaydedildi.', { exact: true }).waitFor();
    assert.equal(payload.bio, 'İstanbul’dan öyküler.');
    console.log('PASS sort / studio filters / direct chapter entry / profile edit API payload (controlled response)');
    await page.goto('http://127.0.0.1:5186/#/write/visual-chapter');
    await page.getByRole('button', { name: 'Kaydet', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Yazı araçlarını aç veya kapat' }).click();
    await page.getByRole('button', { name: 'Notlar / karakterler' }).waitFor();
    const frame = page.frameLocator('iframe'); const editor = frame.getByRole('textbox');
    await editor.click(); await page.keyboard.press('Control+End'); await page.keyboard.type(' Yeni bir cümle.');
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await page.getByText('Sunucuya kaydedildi', { exact: true }).waitFor();
    assert.ok((await editor.innerText()).includes('Yeni bir cümle.'));
    console.log('PASS writer panels / real local editor / save with controlled transport');
    await page.goto('http://127.0.0.1:5186/#/read/visual-1/visual-chapter');
    await page.getByRole('button', { name: 'Okuma tercihleri', exact: true }).click();
    await page.getByRole('button', { name: 'Gece', exact: true }).click();
    await page.getByRole('button', { name: 'Aydınlık', exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, 'reader-night-390.png') });
    console.log('PASS reader preferences / night mode');
    await page.goto('http://127.0.0.1:5186/?long=1#/profile');
    await page.getByText('uzun_bir_kullanici_adi_12345', { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => [...document.querySelectorAll('[dir=auto]')].map(el => {
      const css = getComputedStyle(el); return { el, font: css.fontFamily, size: parseFloat(css.fontSize), line: parseFloat(css.lineHeight) };
    }).filter(x => !/Ionicons|Feather/.test(x.font)).forEach(x => { x.el.style.fontSize = `${x.size * 1.6}px`; if (x.line) x.el.style.lineHeight = `${x.line * 1.6}px`; }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await page.getByText('uzun_bir_kullanici_adi_12345', { exact: true }).evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), true, 'Long heading stays within the screen');
    await page.screenshot({ path: path.join(out, 'profile-long-large-text-390.png') });
    console.log('PASS long username / 1.6x browser text (native font scaling still needs device acceptance)');
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
