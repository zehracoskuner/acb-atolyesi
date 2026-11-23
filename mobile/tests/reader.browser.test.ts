import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { readerDocument } from '../src/readerDocument';
import { defaultReaderPrefs, readerPalettes } from '../src/readerModel';
// A real browser engine exercises the same local document used by native WebView.
// This is not a VoiceOver, TalkBack, iOS or Android device test.
describe.skipIf(!process.env.MOBILE_READER_BROWSER)('reader document in Chromium', () => {
  let browser: Browser, page: Page;
  const blocks = Array.from({ length: 70 }, (_, index) => ({ id: `block-${index}`, index, text: `Pasaj ${index}. İstanbul sessizliğe bürünürken öykü devam ediyordu. `.repeat(5), html: `<p>Pasaj ${index}. ${'İstanbul sessizliğe bürünürken öykü devam ediyordu. '.repeat(7)}</p>` }));
  const data = { title: 'Sessizliğin Ardından', author: 'Test yazarı', authorLink: true, number: 'BÖLÜM 2', blocks, preview: false, previous: true, next: true };
  beforeAll(async () => { browser = await chromium.launch({ executablePath: process.env.MOBILE_READER_BROWSER, headless: true }); page = await browser.newPage({ viewport: { width: 390, height: 730 } }); }, 30000);
  afterAll(async () => { await browser?.close(); });
  async function load(theme: keyof typeof readerPalettes = 'light', position = 0) {
    await page.goto('about:blank');
    await page.evaluate(() => { const w = window as any; w.messages = []; w.ReactNativeWebView = { postMessage: (s: string) => w.messages.push(JSON.parse(s)) }; });
    await page.setContent(readerDocument(data, { ...defaultReaderPrefs, theme }, readerPalettes[theme], 1, { scrollPosition: position }));
    await page.waitForFunction(() => (window as any).messages.some((m: any) => m.ready));
  }
  async function anchor() { return page.evaluate(() => Array.from(document.querySelectorAll('.prose')).findIndex(el => el.getBoundingClientRect().bottom > 0)); }
  it('restores after measured layout without sending a transient zero progress', async () => {
    await load('light', 63);
    expect(await anchor()).toBeGreaterThan(30);
    expect(await page.evaluate(() => (window as any).messages.filter((m: any) => m.position && m.position.scrollPosition === 0))).toHaveLength(0);
  });
  it('preserves the same passage through font, line spacing, orientation and marker changes', async () => {
    await load('light', 48); const before = await anchor();
    await page.evaluate(({ prefs, palette }) => (window as any).readerPrefs(prefs, palette, 1.7), { prefs: { ...defaultReaderPrefs, size: 25, spacing: 2.1, serif: false, markers: false }, palette: readerPalettes.dark });
    await page.waitForTimeout(100); expect(await anchor()).toBe(before);
    await page.setViewportSize({ width: 1024, height: 680 }); await page.waitForTimeout(120);
    expect(Math.abs(await anchor() - before)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
  it('provides selected text intact and keeps footer outside chapter progress', async () => {
    await page.setViewportSize({ width: 390, height: 730 }); await load();
    await page.evaluate(() => { const s = getSelection()!; const r = document.createRange(); r.selectNodeContents(document.querySelector('.prose p')!); s.removeAllRanges(); s.addRange(r); });
    await page.waitForFunction(() => (window as any).messages.some((m: any) => m.selection?.length > 100));
    expect(await page.evaluate(() => (window as any).messages.find((m: any) => m.selection).selection)).toContain('İstanbul');
    await page.evaluate(() => { getSelection()?.removeAllRanges(); scrollTo(0, document.body.scrollHeight); }); await page.waitForTimeout(250);
    expect(await page.evaluate(() => (window as any).messages.filter((m: any) => m.position).at(-1).position.scrollPosition)).toBe(100);
    const labels = await page.locator('footer button').allTextContents(); expect(labels.slice(0, 4)).toEqual(['Sonraki bölüm →', 'Önceki bölüm', '♡ Bölümü beğen', 'Yorumları aç']);
  });
  it('captures phone/tablet reading surfaces in all three themes', async () => {
    await mkdir('artifacts/reader', { recursive: true });
    for (const [name, viewport] of Object.entries({ phone: { width: 390, height: 730 }, tablet: { width: 1024, height: 900 } })) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'sepia', 'dark'] as const) { await load(theme); await page.screenshot({ path: `artifacts/reader/${name}-${theme}.png` }); }
    }
  });
});
