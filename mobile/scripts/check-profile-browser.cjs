// Browser regression check against a locally running frontend; all API calls are intercepted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.PROFILE_TEST_URL || 'http://127.0.0.1:5174';
const initial = { _id: 'profile-test', email: 'author@example.test', kullaniciAdi: 'google_1234567890', authProvider: 'google',
  profileComplete: false, canChooseUsername: true, birthYear: null, requiresTermsAcceptance: true };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    const page = await browser.newPage(); let user = { ...initial }; let submitted;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/auth/me') return route.fulfill({ json: { user } });
        if (url.pathname === '/api/auth/check-username') return route.fulfill({ json: { available: url.searchParams.get('q') !== 'taken_name' } });
        if (url.pathname === '/api/auth/complete-profile') {
          submitted = route.request().postDataJSON(); user = { ...user, kullaniciAdi: submitted.kullaniciAdi, birthYear: submitted.birthYear, profileComplete: true, canChooseUsername: false, requiresTermsAcceptance: false };
          return route.fulfill({ json: { user } });
        }
        return route.fulfill({ json: { items: [], user, notifications: [], unreadCount: 0 } });
      }
      if (url.origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    await page.goto(`${base}/profili-tamamla`);
    const username = page.getByLabel('Kullanıcı Adı', { exact: true });
    await username.waitFor(); await page.waitForFunction(() => !document.getElementById('profile-username')?.disabled);
    assert.equal(await username.inputValue(), ''); assert.equal(await username.isEnabled(), true);
    await username.fill('taken_name'); await page.getByText('Bu kullanıcı adı alınmış.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Başla →' }).isDisabled(), true);
    await username.fill('benim_hikayem'); await page.getByText('Kullanıcı adı müsait!', { exact: true }).waitFor();
    await page.getByLabel('Doğum yılı').fill('1994'); await page.locator('input[name="termsAccepted"]').check();
    await page.getByRole('button', { name: 'Başla →' }).click();
    await page.waitForURL(url => url.pathname !== '/profili-tamamla');
    assert.equal(submitted.kullaniciAdi, 'benim_hikayem'); assert.equal(submitted.birthYear, 1994);
    console.log('PASS: Google placeholder is editable; taken name blocks; chosen name is submitted.');
    user = { ...initial, authProvider: 'local', kullaniciAdi: 'eski_yazar', canChooseUsername: false };
    await page.goto(`${base}/profili-tamamla`); await username.waitFor();
    await page.waitForFunction(() => document.getElementById('profile-username')?.value === 'eski_yazar');
    assert.equal(await username.isDisabled(), true);
    console.log('PASS: Existing completed account keeps its name while adding birth year.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
