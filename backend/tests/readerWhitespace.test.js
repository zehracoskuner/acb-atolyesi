import { describe, expect, it } from 'vitest';
import { readerBlocks, readerPayload } from '../services/readerContent.js';
import { sanitizeChapterHtml } from '../utils/sanitizeHtml.js';

describe('author whitespace in the reader', () => {
  it('retains leading, consecutive and trailing empty paragraphs after saving', () => {
    const content = '<div><br></div><div>Bir  cümle.</div><div><br></div><div></div><div>Son.</div><div><br></div>';
    const blocks = readerBlocks(sanitizeChapterHtml(content));
    expect(blocks).toHaveLength(6);
    expect(blocks.map(b => b.html).join('')).toBe(content.replace('ü', '&#xfc;'));
    expect(blocks[1].text).toBe('Bir  cümle.');
    expect(blocks.map(b => b.index)).toEqual([-1, 0, -1, -1, 1, -1]);
  });
  it('preserves plain text newlines, spaces and literal markup characters', () => {
    expect(readerBlocks('  Bir & iki\n\n\nSon  ')[0].html)
      .toBe('<p>  Bir &amp; iki<br><br><br>Son  </p>');
  });
  it('keeps inline spacing and supported author formatting', () => {
    const content = '  <span style="text-decoration:underline">Bir</span>  ';
    expect(readerBlocks(content)[0].html).toBe(`<p>${content}</p>`);
  });
  it('changes the content version when a blank paragraph is added', () => {
    expect(readerPayload({ content: '<div>Bir</div>' }).contentVersion)
      .not.toBe(readerPayload({ content: '<div>Bir</div><div><br></div>' }).contentVersion);
  });
});
