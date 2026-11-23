import { describe, expect, it } from 'vitest';
import { DomUtils, parseDocument } from 'htmlparser2';
import { readerBlocks, readerHtml, readerPayload, readerPreviewPayload, previewContent, resolveInlineComment } from '../services/readerContent.js';
describe('reader content contract', () => {
  it('keeps preview anchors on text after omitted images and scales a partial paragraph', () => {
    const chapter = { content: '<img src="https://example.test/a.jpg"><p>' + 'Öykü '.repeat(1200) + '</p>' };
    const full = readerPayload(chapter), preview = readerPreviewPayload(chapter);
    expect(preview.blocks[0].id).toBe(full.blocks.find(b => b.text).id);
    expect(preview.blocks[0].anchorScale).toBeGreaterThan(0);
    expect(preview.blocks[0].anchorScale).toBeLessThan(1);
    expect(preview.content).not.toContain('<img');
  });
  it('sanitizes executable content while preserving typography and safe images', () => {
    const html = readerHtml('<h2>Başlık</h2><p onclick="bad()">Bir <em>şiir</em><br>İkinci satır</p><blockquote style="text-align:center">Alıntı</blockquote><ul><li>Liste</li></ul><img src="https://example.test/a.jpg" onerror="bad()"><script>secret()</script><a href="javascript:bad()">Bağ</a>');
    expect(html).not.toMatch(/onclick|onerror|secret|javascript:/); expect(html).toContain('<em>şiir</em>'); expect(html).toContain('<br'); expect(html).toContain('text-align:center'); expect(html).toContain('https://example.test/a.jpg');
  });
  it('clips on the server, including encoded characters, without later prose or media', () => {
    const content = '<p>A &amp; B 😀 C</p><p>SECRET LATER TEXT</p><img src="https://example.test/secret.jpg">';
    const preview = previewContent(content, 9);
    expect(Array.from(DomUtils.textContent(parseDocument(preview)))).toHaveLength(9);
    expect(preview).not.toMatch(/SECRET|secret.jpg|\ud83d(?!\ude00)/);
    expect(readerBlocks(preview)).toHaveLength(1);
  });
  it('never links legacy or changed paragraphs by index; uniquely unchanged paragraphs can move', () => {
    const old = readerPayload({ content: '<p>Bir</p><p>İki</p>' });
    const comment = { paragraphIndex: 0, blockId: old.blocks[0].id, content: 'Yorum' };
    const reordered = readerBlocks('<p>İki</p><p>Bir</p>');
    expect(resolveInlineComment(comment, reordered)).toMatchObject({ paragraphIndex: 1, attached: true });
    expect(resolveInlineComment(comment, readerBlocks('<p>Başka</p><p>İki</p>'))).toMatchObject({ paragraphIndex: -1, attached: false });
    expect(resolveInlineComment({ paragraphIndex: 0 }, old.blocks).attached).toBe(false);
    expect(resolveInlineComment(comment, readerBlocks('<p>Bir</p><p>Bir</p>')).attached).toBe(false);
  });
  it('does not expose a working draft through the published block contract', () => {
    const result = readerPayload({ content: '<p>Yayın</p>', draftContent: { content: '<p>PRIVATE</p>' } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(result).toEqual(readerPayload({ content: '<p>Yayın</p>' }));
  });
  it('numbers narrative blocks consistently without blank paragraphs or editor wrappers', () => {
    const blocks = readerBlocks('<div><p><br></p><h2>Başlık</h2><p>Metin</p><blockquote>Alıntı</blockquote><ol><li>Bir</li><li>İki</li></ol><p>Şiir<br>İkinci dize</p></div>');
    expect(blocks.map(b => b.index)).toEqual([-1, 0, 1, 2, 3, 4, 5]);
    expect(blocks[5].html).toContain('start="2"');
    expect(blocks[6].text).toContain('İkinci dize');
    const centered = readerBlocks('<div style="text-align:center"><p>Şiir</p><p>İkinci dize</p></div>');
    expect(centered).toHaveLength(2);
    expect(centered.every(b => b.html.includes('text-align:center'))).toBe(true);
  });
  it('anchors repeated paragraphs only within the proven publication', () => {
    const old = readerPayload({ content: '<p>Aynı</p><p>Aynı</p>' });
    const comment = { paragraphIndex: 1, blockId: old.blocks[1].id, contentVersion: old.contentVersion };
    expect(resolveInlineComment(comment, old.blocks)).toMatchObject({ attached: true, paragraphIndex: 1 });
    expect(resolveInlineComment(comment, readerBlocks('<p>Aynı</p><p>Yeni</p><p>Aynı</p>')).attached).toBe(false);
  });
});
