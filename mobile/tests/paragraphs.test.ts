import { describe, it, expect } from 'vitest';
import { paragraphs } from '../src/paragraphs';
describe('shared passage comment indexing', () => {
  it('groups inline fragments, skips empty blocks and treats a list as one top-level block', () => {
    const items = paragraphs('İlk <strong>cümle</strong><div><br></div><h2>Başlık</h2><p>İkinci <em>cümle</em></p><ul><li>bir</li><li>iki</li></ul>Son.');
    expect(items.map(p => p.index)).toEqual([0, 1, 2, 3, 4]); expect(items.map(p => p.text)).toEqual(['İlk cümle', 'Başlık', 'İkinci cümle', 'biriki', 'Son.']);
  });
  it('preserves escaped literal characters and ignores executable blocks', () => {
    expect(paragraphs('A &amp; B &lt; C')[0]?.text).toBe('A & B < C'); expect(paragraphs('<script>bad</script><p>Öykü</p>')[0]?.text).toBe('Öykü');
  });
});
