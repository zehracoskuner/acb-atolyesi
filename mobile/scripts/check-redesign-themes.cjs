const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.route('https://visual-qa.invalid/**', r => r.abort());
    for (const width of [320, 430, 1024]) {
      await page.setViewportSize({ width, height: 860 });
      for (const [name, route, label] of [['profile','/profile','deniz_yazar'], ['explore','/explore','Keşfet'], ['studio','/studio','Atölye'], ['writer','/write/visual-chapter','Kaydet'], ['login','/auth/login','Yeniden hoş geldin.'], ['profile-edit','/profile-edit','Değişiklikleri kaydet']]) {
        await page.goto(`http://127.0.0.1:5186/?theme=dark#${route}`);
        await page.getByText(label, { exact: true }).first().waitFor();
        await page.waitForFunction(() => localStorage.getItem('acb.appearance') === 'dark');
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name} dark ${width} overflow`);
        await page.screenshot({ path: path.resolve(`artifacts/design/${name}-dark-${width}.png`) });
      }
    }
    await page.goto('http://127.0.0.1:5186/#/profile');
    await page.getByText('deniz_yazar', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle([...document.querySelectorAll('[dir=auto]')].find(el => el.textContent === 'deniz_yazar')).color), 'rgb(240, 239, 229)');
    for (const label of ['Eserler','Taslaklar','Kütüphane','Okuma Listeleri','Alıntılar','Günlük']) await page.getByRole('button', { name: label, exact: true }).click();
    await page.goto('http://127.0.0.1:5186/?theme=system#/profile');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => localStorage.getItem('acb.appearance') === 'system');
    await page.waitForFunction(() => getComputedStyle([...document.querySelectorAll('[dir=auto]')].find(el => el.textContent === 'deniz_yazar')).color === 'rgb(36, 44, 41)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => getComputedStyle([...document.querySelectorAll('[dir=auto]')].find(el => el.textContent === 'deniz_yazar')).color === 'rgb(240, 239, 229)');
    await page.goto('http://127.0.0.1:5186/#/compose');
    const input = page.getByRole('textbox', { name: 'Paylaşımın', exact: true });
    await input.fill('İstanbul, çığ, öykü: yeniden açılış taslağı.');
    await page.getByRole('button', { name: 'Yalnızca ben', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('acb.log-draft:visual-author') || '{}').visibility === 'private');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('yeniden açılış taslağı'));
    assert.equal(await page.getByRole('button', { name: 'Yalnızca ben', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(41, 63, 52)');
    assert.equal(await input.inputValue(), 'İstanbul, çığ, öykü: yeniden açılış taslağı.');
    assert.deepEqual(errors, []);
    console.log('PASS 18 dark layouts, six profile sections, persistent appearance, system-theme changes and composer draft reopen');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
