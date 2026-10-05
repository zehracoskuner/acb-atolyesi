import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../../frontend/src/', import.meta.url);
function sources(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(new URL(`${entry.name}/`, dir)) : /\.[jt]sx?$/.test(entry.name) ? [readFileSync(new URL(entry.name, dir), 'utf8')] : []); }
describe('Logical back navigation', () => {
  it('has no history-dependent back actions anywhere in the app', () => {
    for (const source of sources(root)) expect(source).not.toMatch(/navigate\(\s*-\d|history\.(?:back|go)\(/);
  });
  it('returns readers to their work details and characters to their work studio', () => {
    expect(readFileSync(new URL('pages/Read.jsx', root), 'utf8')).toContain('onClick={() => navigate(`/story/${workId}`)}');
    expect(readFileSync(new URL('pages/CharactersPage.jsx', root), 'utf8')).toContain('onClick={() => navigate(`/work/${workId}`)}');
    expect(readFileSync(new URL('pages/StoryDetailsPage.jsx', root), 'utf8')).toContain('onClick={() => navigate("/kesfet")}');
  });
});
