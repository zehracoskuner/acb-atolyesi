// Real profile, resource and API code on React Native Web; only local fixture responses and platform adapters.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="200"><rect width="900" height="200" fill="#657d6e"/><path d="M0 160 Q220 30 450 145 T900 50 V200 H0Z" fill="#4c6559"/></svg>');
  let user = { _id: 'owner', kullaniciAdi: 'deniz_yazar', profileComplete: true, bio: 'Kelimelerin peşinde. Biraz şehir, biraz düş, biraz da yol.', location: 'İstanbul', website: 'https://example.com', avatarUrl: image, bannerImage: image, followers: ['visitor'], following: ['visitor'], followerCount: 1, followingCount: 1 };
  const works = [{ _id: 'w1', title: 'Şehrin Unuttuğu Sesler', status: 'published', chapterCount: 8, genres: ['Öykü'], pendingReviewCount: 1, unpublishedChangesCount: 1, author: user }, { _id: 'w2', title: 'Kıyıda Kalanlar', status: 'published', chapterCount: 4, genres: ['Roman'], author: user }, { _id: 'draft', title: 'Yarım Kalan Mektup', status: 'draft', updatedAt: '2026-10-28T10:00:00Z', chapterCount: 0 }];
  let logs = Array.from({ length: 5 }, (_, i) => ({ _id: 'log' + i, type: 'log', author: user, content: i ? 'Bir hikâye bazen tek bir cümleyle başlar. Bugün o cümleyi aradım.' : 'Bugün bir karakterimin sesini ilk kez gerçekten duydum. '.repeat(11), visibility: 'public', createdAt: '2026-10-28T12:00:00Z', likeCount: 3, likedByMe: false, commentCount: 2 }));
  let lists = [{ _id: 'list1', name: 'Yol arkadaşlarım', description: 'Dönüp dönüp okuduklarım.', isPrivate: true, works: [{ work: works[0] }, { work: null }] }];
  let empty = false, followError = false, imageError = false, quoteError = false, following = false, followCalls = 0, imageCalls = 0;
  const reads = []; const writes = [];
  await page.route('https://profile-qa.invalid/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname.replace('/api', ''), method = req.method();
    if (method === 'GET') reads.push(p); else writes.push({ p, method, body: req.postDataJSON() });
    let data;
    if (p.endsWith('/follow')) { followCalls++; await pause(180); if (followError) return route.fulfill({ status: 500, json: { message: 'Takip denemesi başarısız' } }); following = !following; data = { following, followerCount: following ? 43 : 42 }; }
    else if (p === '/user/avatar' || p === '/user/banner') { imageCalls++; if (imageError) return route.fulfill({ status: 500, json: { message: 'Görsel yüklenemedi' } }); data = { avatarUrl: image, bannerImage: image }; }
    else if (p === '/auth/me') data = { user };
    else if (p === '/user/profile') { if (method === 'PATCH') Object.assign(user, req.postDataJSON()); data = { user: empty ? { ...user, bio: '', website: '', location: '', avatarUrl: '', bannerImage: '', followers: [], following: [], followerCount: 0, followingCount: 0 } : user, stats: { totalWorks: empty ? 0 : 3, totalWords: 18420, totalViews: 1240 } }; }
    else if (p.startsWith('/public/profile/')) { const id = p.split('/')[3]; data = p.endsWith('/works') ? { items: works.filter(w => w.status === 'published').map(({ pendingReviewCount, unpublishedChangesCount, ...w }) => w) } : { user: { ...user, _id: id, kullaniciAdi: id === 'other' ? 'Başka Yazar' : 'ece_kalem', workCount: 2, isFollowedByMe: following, followerCount: following ? 43 : 42, followers: [] } }; }
    else if (p === '/user/works') data = { items: empty ? [] : works };
    else if (p.startsWith('/logs/')) { if (p.endsWith('/detail')) data = { item: logs.find(l => l._id === p.split('/')[2]) }; else if (p.endsWith('/like')) { const log = logs.find(l => l._id === p.split('/')[2]); log.likedByMe = !log.likedByMe; log.likeCount += log.likedByMe ? 1 : -1; data = { likedByMe: log.likedByMe, likeCount: log.likeCount }; } else data = { items: empty ? [] : logs, hasMore: false }; }
    else if (p.startsWith('/quotes/')) { if (quoteError) return route.fulfill({ status: 403, json: { message: 'Bu alıntılara erişilemiyor.' } }); data = { items: empty ? [] : [{ _id: 'quote', text: 'İnsan bazen kendi sesini duymak için yürür.', workTitle: 'Kıyıda Kalanlar', authorName: 'Deniz' }], totalPages: 1 }; }
    else if (p === '/reading-progress') data = { items: [{ story: works[0], chapter: { _id: 'c1', title: 'Sokağın Sonu' }, scrollPosition: 38 }] };
    else if (p === '/library') data = { items: works.filter(w => w.status === 'published') };
    else if (p.startsWith('/reading-lists')) { if (method === 'PATCH') Object.assign(lists[0], req.postDataJSON()); data = { items: empty ? [] : lists }; }
    else return route.fulfill({ status: 404, json: { message: 'Unknown fixture: ' + p } });
    await route.fulfill({ json: data });
  });
  let visit = 0;
  const go = (path = '/profile', theme = 'light') => page.goto(`http://127.0.0.1:5189/?theme=${theme}&visit=${++visit}#${path}`);
  const tab = name => page.getByRole('tab', { name, exact: true });
  try {
    fs.mkdirSync('artifacts/profile', { recursive: true });
    await go(); await page.getByRole('button', { name: 'Günlüğüne yaz', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Devamını oku', exact: true }).first().click(); await page.getByRole('button', { name: 'Daha az göster', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Beğen · 3 beğeni', exact: true }).first().click(); await page.getByRole('button', { name: 'Beğeniyi kaldır · 4 beğeni', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Geri dön', exact: true }).count(), 0);
    const headers = reads.filter(p => p === '/user/profile').length;
    assert.equal(reads.includes('/user/works'), false); assert.equal(reads.includes('/library'), false);
    await tab('Eserler').click(); await page.getByRole('button', { name: 'Şehrin Unuttuğu Sesler, eseri aç' }).waitFor();
    const worksReads = reads.filter(p => p === '/user/works').length;
    await tab('Günlük').click(); await tab('Eserler').click(); assert.equal(reads.filter(p => p === '/user/works').length, worksReads); assert.equal(reads.filter(p => p === '/user/profile').length, headers);
    await tab('Günlük').click(); const scroller = page.getByTestId('profile-scroll'); await scroller.evaluate(el => { el.scrollTop = 750; }); await pause(100); const previous = await scroller.evaluate(el => el.scrollTop);
    await tab('Alıntılar').evaluate(el => el.click()); await page.getByText('İnsan bazen kendi sesini', { exact: false }).waitFor(); await tab('Günlük').evaluate(el => el.click()); await pause(120); assert.ok(Math.abs(await scroller.evaluate(el => el.scrollTop) - previous) < 4, 'per-tab scroll restoration');
    await go('/profile?tab=library'); await page.getByRole('button', { name: 'Devam et', exact: true }).waitFor(); assert.equal(await tab('Kütüphane').getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: 'Devam et', exact: true }).click(); assert.match(page.url(), /mode=resume/);
    await go('/profile/visitor?tab=drafts'); await page.getByRole('button', { name: 'Takip et', exact: true }).waitFor(); assert.equal(await tab('Taslaklar').count(), 0); assert.equal(await tab('Kütüphane').count(), 0); assert.equal(await tab('Günlük').getAttribute('aria-selected'), 'true');
    followError = true; await page.getByRole('button', { name: 'Takip et', exact: true }).click(); await page.getByText('Takip denemesi başarısız').waitFor(); assert.equal(await page.getByRole('button', { name: '42 takipçi' }).count(), 1);
    followError = false; const before = followCalls; await page.getByRole('button', { name: 'Takip et', exact: true }).evaluate(el => { el.click(); el.click(); }); await page.getByRole('button', { name: 'Takip ediliyor' }).waitFor(); assert.equal(followCalls, before + 1); await page.getByRole('button', { name: '43 takipçi' }).waitFor();
    quoteError = true; await tab('Alıntılar').click(); await page.getByText('Erişim kısıtlı', { exact: true }).waitFor(); await tab('Eserler').click(); await page.getByRole('button', { name: 'Şehrin Unuttuğu Sesler, eseri aç' }).waitFor(); quoteError = false;
    await go('/profile'); await page.getByRole('button', { name: 'Günlüğüne yaz', exact: true }).waitFor(); await page.getByRole('button', { name: '1 takipçi', exact: true }).click(); await page.getByText('Takipçiler', { exact: true }).waitFor(); await page.getByRole('button', { name: 'ece_kalem', exact: true }).waitFor(); await page.getByRole('button', { name: 'Profile dön', exact: true }).click();
    user.bio = 'İstanbul’un sokaklarında hikâyeler topluyorum. '.repeat(16); await go(); await page.getByRole('button', { name: 'Devamını göster' }).click(); await page.getByRole('button', { name: 'Daha az göster' }).waitFor();
    await page.screenshot({ path: 'artifacts/profile/long-bio.png' }); user.bio = 'Kelimelerin peşinde. Biraz şehir, biraz düş, biraz da yol.';
    empty = true; await go(); await page.getByText('Bu günlük henüz boş').waitFor(); await page.screenshot({ path: 'artifacts/profile/empty.png' }); empty = false;
    await go('/profile-edit'); await page.getByLabel('Kullanıcı adı', { exact: true }).waitFor(); imageError = true; const beforeImage = await page.getByLabel('Mevcut banner').getAttribute('style'); await page.getByRole('button', { name: 'Bannerı değiştir' }).click(); await page.getByText('Görsel yüklenemedi').waitFor(); assert.equal(await page.getByLabel('Mevcut banner').getAttribute('style'), beforeImage); assert.equal(imageCalls, 1); imageError = false;
    await page.getByLabel('Kullanıcı adı', { exact: true }).fill('yeni_yazar'); assert.equal(await page.evaluate(() => !!window.profileGuard), true);
    page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Profile dön', exact: true }).click(); assert.match(page.url(), /profile-edit/);
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click(); await page.getByText('Profilin kaydedildi.').waitFor(); assert.equal(user.kullaniciAdi, 'yeni_yazar'); await page.waitForFunction(() => !window.profileGuard);
    await go('/lists?listId=list1'); await page.getByText('Bu eser artık erişilebilir değil.').waitFor(); await page.getByRole('button', { name: 'Adı, açıklamayı ve gizliliği düzenle' }).click(); await page.getByLabel('Liste adı', { exact: true }).fill('Yeni liste adı'); await page.getByRole('button', { name: 'Liste değişikliklerini kaydet' }).click(); await page.getByText('Yeni liste adı', { exact: true }).first().waitFor(); assert.equal(lists[0].name, 'Yeni liste adı');
    user.kullaniciAdi = 'deniz_yazar';
    for (const width of [320, 390, 1024]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 }); await go('/profile', theme); await page.getByRole('button', { name: 'Günlüğüne yaz', exact: true }).waitFor(); await page.evaluate(() => document.fonts.ready); await pause(100);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({ path: `artifacts/profile/owner-${theme}-${width}.png` });
      await tab('Eserler').click(); await page.getByRole('button', { name: 'Şehrin Unuttuğu Sesler, eseri aç' }).waitFor(); await page.screenshot({ path: `artifacts/profile/works-${theme}-${width}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 }); await go('/profile/visitor', 'dark'); await page.getByRole('button', { name: 'Takip ediliyor' }).waitFor(); await page.screenshot({ path: 'artifacts/profile/visitor-dark.png' });
    const privateBefore = reads.filter(p => ['/user/works', '/library', '/reading-lists'].includes(p)).length;
    await go('/profile/other?tab=library'); await page.getByRole('heading', { name: 'Başka Yazar' }).waitFor(); assert.equal(reads.filter(p => ['/user/works', '/library', '/reading-lists'].includes(p)).length, privateBefore);
    following = false; await page.evaluate(() => window.profileAccount(null)); await page.getByRole('button', { name: 'Takip et', exact: true }).waitFor(); assert.equal(await tab('Kütüphane').count(), 0);
    await page.evaluate(() => { location.hash = '/profile'; }); await page.getByRole('button', { name: 'Aramıza katıl :)', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Profili düzenle' }).count(), 0);
    assert.deepEqual(errors, []); console.log('PASS profile: lazy tabs/header stability, scroll restoration, deep links, owner/visitor privacy, follow failure/double press, restricted tab, follower list, long bio, empty account, failed image, dirty exit/save, list edit/deleted work; 15 screenshots.');
  } catch (error) { console.error(errors); console.error((await page.locator('body').innerText()).slice(0, 3500)); await page.screenshot({ path: 'artifacts/profile/failure.png' }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
