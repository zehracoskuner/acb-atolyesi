import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import React from '../../frontend/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../frontend/node_modules/react-dom/server.node.js';
import { MemoryRouter } from '../../frontend/node_modules/react-router-dom/dist/index.mjs';
const state = vi.hoisted(() => ({ session: { status: 'authenticated', user: { role: 'admin', kullaniciAdi: 'Yazar' } } }));
vi.mock('../../frontend/src/lib/session', () => ({ useSession: () => state.session, refreshSession: vi.fn(), logoutSession: vi.fn() }));
vi.mock('../../frontend/src/lib/membershipContext', () => ({ useMembership: () => ({ requireMember: () => true }) }));
vi.mock('../../frontend/src/components/tour/TourManager', () => ({ TourHelpButton: () => null }));
vi.mock('../../frontend/src/lib/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiPut: vi.fn(), apiDelete: vi.fn(), adminGet: vi.fn(), adminPut: vi.fn(), adminPatch: vi.fn(), adminDelete: vi.fn() }));
import ReportActions from '../../frontend/src/components/ReportActions.jsx';
import TopBar from '../../frontend/src/components/TopBar.jsx';
import AdminPanel from '../../frontend/src/pages/AdminPanel.jsx';
import ReportsPage from '../../frontend/src/pages/ReportsPage.jsx';
import FeedbackForm from '../../frontend/src/components/FeedbackForm.jsx';
const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
beforeEach(() => { vi.stubGlobal('React', React); state.session = { status: 'authenticated', user: { role: 'admin', kullaniciAdi: 'Yazar' } }; });
afterEach(() => vi.unstubAllGlobals());
describe('Report and support navigation', () => {
  it('keeps reporting actions behind a labelled collapsed icon', () => {
    const html = render(<ReportActions targetId="work-id" targetLabel="Eser" image={{ kind: 'cover', url: '/cover.jpg' }} />);
    expect(html).toContain('aria-expanded="false"'); expect(html).toContain('report-actions-trigger');
    expect(html).not.toContain('Telif hakkı ihlali bildir'); expect(html).not.toContain('Görseli şikâyet et');
    state.session = { status: 'guest', user: null };
    expect(render(<ReportActions targetId="work-id" />)).toBe('');
  });
  it('hides work, chapter and cover reporting for the owner, including populated IDs', () => {
    state.session = { status: 'authenticated', user: { _id: 'owner', role: 'admin' } };
    for (const targetType of ['work', 'chapter', 'cover']) {
      expect(render(<ReportActions targetType={targetType} targetId="target" targetOwner={{ _id: 'owner' }} image={{ kind: 'cover', url: '/cover.jpg' }} />)).toBe('');
      expect(render(<ReportActions targetType={targetType} targetId="target" isOwner />)).toBe('');
      expect(render(<ReportActions targetType={targetType} targetId="target" targetOwner="other" />)).toContain('report-actions-trigger');
    }
  });
  it('simplifies only the account dropdown and preserves the main navigation', () => {
    const html = render(<TopBar />);
    const dropdown = html.split('class="dropdown-section"')[1].split('</div>')[0];
    expect(dropdown).toContain('Başvurularım'); expect(dropdown).toContain('Öneri veya şikâyetler');
    for (const label of ['Profilim', 'Atölyem', 'Notlarım', 'Kütüphane', 'Başvurularım ve kararlar']) expect(dropdown).not.toContain(label);
    expect(html).toContain('Kütüphanem'); expect(html).toContain('Atölyem');
  });
  it('opens administration on copyright and places inappropriate content second', () => {
    const html = render(<AdminPanel />);
    expect(html).toMatch(/adm-nav-item--active[^>]*aria-current="page"[^>]*>[\s\S]*?Telif hakkı/);
    expect(html.indexOf('Telif hakkı')).toBeLessThan(html.indexOf('Uygunsuz içerik'));
    expect(html.indexOf('Uygunsuz içerik')).toBeLessThan(html.indexOf('Diğer bildirimler'));
    expect(html).toContain('Öneri veya şikâyetler');
  });
  it('uses the shared page shell and a clearly labelled feedback form', () => {
    const reports = render(<ReportsPage />);
    expect(reports).toContain('<h1>Başvurularım</h1>'); expect(reports).not.toContain('Başvurularım ve kararlar'); expect(reports).toContain('support-page');
    const form = render(<FeedbackForm />);
    expect(form).toContain('value="suggestion"'); expect(form).toContain('value="complaint"');
    expect(form).toContain('maxLength="4000"'); expect(form).toContain('type="submit" disabled=""');
  });
});
