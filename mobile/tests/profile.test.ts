import { describe, expect, it } from 'vitest';
import { profileColumns, profileSection, safeWebsite, workState } from '../src/profile';
describe('profile navigation and presentation boundaries', () => {
  it('only resolves owner-only deep links for the owner', () => {
    for (const tab of ['drafts', 'library']) { expect(profileSection(tab, false)).toBe('logs'); expect(profileSection(tab, true)).toBe(tab); }
    expect(profileSection('quotes', false)).toBe('quotes'); expect(profileSection('edit', true)).toBe('logs'); expect(profileSection(undefined, true)).toBe('logs');
  });
  it('opens only safe web URLs, with no embedded credentials', () => {
    for (const value of ['javascript:alert(1)', 'file:///private', 'data:text/html,test', 'https://user:password@example.com', 'not a url']) expect(safeWebsite(value)).toBeNull();
    expect(safeWebsite('example.com')).toBe('https://example.com/'); expect(safeWebsite('https://example.com/yazar')).toBe('https://example.com/yazar');
  });
  it('keeps a published work published while its working version is in review', () => {
    const text = workState({ status: 'published', pendingReviewCount: 1, unpublishedChangesCount: 2 });
    expect(text).toContain('Yayında'); expect(text).not.toContain('Taslak'); expect(text).toContain('1 bölüm incelemede'); expect(text).toContain('2 bölümde yayınlanmamış');
  });
  it('allows readable covers and titles on narrow screens and enlarged text', () => {
    expect(profileColumns(320, 1)).toBe(1); expect(profileColumns(390, 1)).toBe(2); expect(profileColumns(1024, 1)).toBe(3); expect(profileColumns(1024, 1.8)).toBe(1);
  });
});
