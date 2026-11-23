import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { editorDocument } from '../src/editorDocument';
// Tests the local editing document only. A desktop browser does not simulate a native keyboard.
describe.skipIf(!process.env.MOBILE_EDITOR_BROWSER)('local editor in a real browser engine', () => {
  let browser: Browser; let page: Page;
  beforeAll(async () => { browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER === 'chromium' ? undefined : process.env.MOBILE_EDITOR_BROWSER, headless: true }); page = await browser.newPage({ viewport: { width: 320, height: 568 } }); }, 30000);
  afterAll(async () => { if (browser) await browser.close(); });
  async function load(html: string, scale = 1, title?: string) {
    await page.addInitScript(() => { (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = { postMessage: () => {} }; });
    await page.goto('about:blank');
    await page.evaluate(() => { (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = { postMessage: (message: string) => { (window as unknown as { lastMessage: string }).lastMessage = message; } }; });
    await page.setContent(editorDocument(html, scale, title));
  }
  it('keeps Turkish characters and the established formatting whitelist', async () => {
    await load('<h2>Çağrı’nın öyküsü</h2><p style="text-align:justify">İstanbul <strong>ışıkları</strong> <em>yağmur</em> <u>üç</u>.</p><ol><li>Şehir</li></ol><blockquote>Öykü</blockquote>');
    expect(await page.locator('#editor h2').innerText()).toBe('Çağrı’nın öyküsü'); expect(await page.locator('#editor strong').innerText()).toBe('ışıkları');
    expect(await page.locator('#editor p').evaluate(e => getComputedStyle(e).textAlign)).toBe('justify'); expect(await page.locator('#editor li').innerText()).toBe('Şehir');
    await page.locator('#editor').press('Control+End'); await page.keyboard.insertText(' Son cümle.');
    expect(await page.locator('#editor').innerText()).toContain('Son cümle.'); expect(await page.locator('#editor strong').count()).toBe(1);
    const message = await page.evaluate(() => (window as unknown as { lastMessage: string }).lastMessage); expect(JSON.parse(message).organic).toBe(true);
  });
  it('applies toolbar formatting and safely removes executable pasted/loaded content', async () => {
    await load('<p onclick="window.hacked=true">Güvenli</p><script>window.hacked=true</script><img src="https://invalid.test/a" onerror="window.hacked=true">');
    expect(await page.locator('#editor script, #editor img, #editor [onclick]').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { hacked?: boolean }).hacked)).toBeUndefined();
    expect(await page.locator('#editor').getAttribute('contenteditable')).toBe('false');
    await load('<p>Güvenli</p>');
    await page.locator('#editor').click(); await page.locator('#editor').press('Control+A');
    await page.evaluate(() => (window as unknown as { command: (name: string) => void }).command('bold'));
    expect(await page.locator('#editor b, #editor strong').count()).toBeGreaterThan(0);
  });
  it('formats the current selection even before its selectionchange event is delivered', async () => {
    await load('<p>Eski seçim. Yeni seçim.</p>');
    await page.evaluate(async () => {
      const editor = document.getElementById('editor')!; editor.focus();
      const text = editor.querySelector('p')!.firstChild!;
      const selection = window.getSelection()!;
      const previous = document.createRange(); previous.setStart(text, 0); previous.setEnd(text, 4);
      await new Promise<void>(resolve => {
        document.addEventListener('selectionchange', () => resolve(), { once: true });
        selection.removeAllRanges(); selection.addRange(previous);
      });
      // The selection and command deliberately share a task: the DOM selection
      // is newer than the asynchronously delivered selectionchange notification.
      const current = document.createRange(); current.setStart(text, 12); current.setEnd(text, 16);
      selection.removeAllRanges(); selection.addRange(current);
      (window as unknown as { command: (name: string) => void }).command('bold');
    });
    expect(await page.locator('#editor b, #editor strong').allTextContents()).toEqual(['Yeni']);
    expect(await page.locator('#editor').innerText()).toBe('Eski seçim. Yeni seçim.');
  });
  it('formats new typing at the current caret instead of a previously selected word', async () => {
    await load('<p>Eski</p>');
    await page.evaluate(async () => {
      const editor = document.getElementById('editor')!; editor.focus();
      const text = editor.querySelector('p')!.firstChild!;
      const selection = window.getSelection()!;
      const previous = document.createRange(); previous.selectNodeContents(text);
      await new Promise<void>(resolve => {
        document.addEventListener('selectionchange', () => resolve(), { once: true });
        selection.removeAllRanges(); selection.addRange(previous);
      });
      selection.collapse(text, text.textContent!.length);
      (window as unknown as { command: (name: string) => void }).command('italic');
      document.execCommand('insertText', false, ' yeni');
    });
    expect((await page.locator('#editor i, #editor em').allTextContents()).map(text => text.trim())).toEqual(['yeni']);
    expect(await page.locator('#editor').innerText()).toBe('Eski yeni');
  });
  it('keeps the editor selection when focus moves to a toolbar and applies consecutive commands', async () => {
    await load('<p>Bir öykü yaz.</p>');
    await page.evaluate(() => {
      const editor = document.getElementById('editor')!; editor.focus();
      const text = editor.querySelector('p')!.firstChild!;
      const range = document.createRange(); range.setStart(text, 4); range.setEnd(text, 8);
      const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
      const toolbar = document.createElement('button'); toolbar.id = 'toolbar'; toolbar.textContent = 'Araç çubuğu'; document.body.append(toolbar);
      toolbar.focus(); // Blur must preserve this new range synchronously, too.
      const outside = document.createRange(); outside.selectNodeContents(toolbar);
      selection.removeAllRanges(); selection.addRange(outside);
    });
    // Let outside selectionchange notifications arrive before the toolbar command.
    await page.locator('#toolbar').press('Tab');
    await page.evaluate(() => {
      const command = (window as unknown as { command: (name: string) => void }).command;
      command('bold');
      document.getElementById('toolbar')!.focus(); window.getSelection()!.removeAllRanges();
      command('italic');
    });
    expect(await page.locator('#editor b, #editor strong').allTextContents()).toEqual(['öykü']);
    expect(await page.locator('#editor i, #editor em').allTextContents()).toEqual(['öykü']);
    expect(await page.locator('#editor').innerText()).toBe('Bir öykü yaz.');
    expect(await page.locator('#toolbar b, #toolbar i').count()).toBe(0);
    const message = await page.evaluate(() => (window as unknown as { lastMessage: string }).lastMessage);
    expect(JSON.parse(message).content).toBe(await page.locator('#editor').innerHTML());
  });
  it('handles long text on a 320px screen with enlarged system typography without horizontal overflow', async () => {
    await load('<p>Türkçe: ğ ü ş ı ö ç İ. ' + 'Bir yazar kendi sesini arıyor. '.repeat(2000) + '</p><p>' + 'uzun'.repeat(300) + '</p>', 1.6);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width); expect(dimensions.height).toBeGreaterThan(568);
    await page.locator('#editor').press('Control+End'); await page.keyboard.insertText(' Bitirdim.'); expect(await page.locator('#editor').innerText()).toContain('Bitirdim.');
  });
  it('keeps original HTML when editing just the title, including unsupported legacy content', async () => {
    const html = '<p style="text-align:justify">— Çağrı <em>konuştu.</em></p>';
    await load(html, 1, 'Başlık');
    await page.locator('#title').fill('Yeni başlık');
    const data = JSON.parse(await page.evaluate(() => (window as any).lastMessage));
    expect(data).toMatchObject({ title: 'Yeni başlık', content: html });
    await load('<table><tr><td>Korunacak metin</td></tr></table>', 1, 'Başlık');
    expect(await page.locator('#editor').getAttribute('contenteditable')).toBe('false');
    await page.locator('#title').fill('Yeni');
    expect(JSON.parse(await page.evaluate(() => (window as any).lastMessage)).content).toContain('<table>');
  });
  it('pastes formatted Turkish dialogue and lists, then undoes and redoes without pagination', async () => {
    await load('<p>Başlangıç.</p>');
    await page.locator('#editor').press('Control+End');
    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/html', '<p>— <em>İyi akşamlar,</em> dedi.</p><ul><li>Çağrı</li><li>Öykü</li></ul>');
      document.getElementById('editor')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    });
    expect(await page.locator('#editor em').innerText()).toBe('İyi akşamlar,'); expect(await page.locator('#editor li').count()).toBe(2);
    const after = await page.locator('#editor').innerHTML();
    await page.evaluate(() => (window as any).command('undo'));
    expect(await page.locator('#editor li').count()).toBe(0);
    await page.evaluate(() => (window as any).command('redo'));
    expect(await page.locator('#editor').innerHTML()).toBe(after);
  });
  it('retains the current selection and scroll when theme colors change and resets undo on a new chapter', async () => {
    await load('<p>İlk bölüm.</p>'.repeat(300));
    await page.locator('#editor').press('Control+End'); await page.keyboard.insertText(' Yeni cümle.');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const before = await page.evaluate(() => ({ text: document.getElementById('editor')!.innerHTML, offset: getSelection()!.anchorOffset, scroll: scrollY }));
    await page.evaluate(() => { document.body.style.backgroundColor = '#141d1a'; document.body.style.color = '#f0efe5'; });
    expect(await page.evaluate(() => ({ text: document.getElementById('editor')!.innerHTML, offset: getSelection()!.anchorOffset, scroll: scrollY }))).toEqual(before);
    await load('<p>İkinci bölüm.</p>'); await page.evaluate(() => (window as any).command('undo'));
    expect(await page.locator('#editor').innerText()).toBe('İkinci bölüm.');
  });
});
