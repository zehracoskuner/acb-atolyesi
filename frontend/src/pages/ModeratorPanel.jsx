// src/pages/ModeratorPanel.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut } from "../lib/api";

const API_BASE = import.meta.env?.VITE_API_URL ?? "/api";

/* ══════════════════════════════════════════════
   CSS
══════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --mod-bg: #0f100f; --mod-surface: #151715; --mod-surface2: #1c1f1c;
    --mod-surface3: #232623; --mod-border: rgba(255,255,255,0.06);
    --mod-border-hi: rgba(255,255,255,0.13); --mod-ink: #e5ebe5;
    --mod-ink-dim: #8aa38a; --mod-ink-ghost: #4a5e4a;
    --mod-green: #4a7c59; --mod-red: #b83232; --mod-orange: #c8832a;
    --mod-teal: #3a8080; --mod-t: 0.16s ease;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .mod-root { display: flex; min-height: 100vh; background: var(--mod-bg); font-family: 'DM Sans', sans-serif; color: var(--mod-ink); }
  .mod-sidebar { width: 220px; flex-shrink: 0; background: var(--mod-surface); border-right: 1px solid var(--mod-border); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .mod-logo { padding: 1.5rem 1.3rem 1.1rem; border-bottom: 1px solid var(--mod-border); }
  .mod-logo-eyebrow { font-size: .56rem; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: var(--mod-teal); display: block; margin-bottom: .25rem; }
  .mod-logo-title { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; font-weight: 300; font-style: italic; color: var(--mod-ink); display: block; }
  .mod-nav { padding: .8rem 0; flex: 1; }
  .mod-nav-label { font-size: .54rem; font-weight: 600; letter-spacing: .28em; text-transform: uppercase; color: var(--mod-ink-ghost); padding: 0 1.1rem; margin: .8rem 0 .25rem; display: block; }
  .mod-nav-item { display: flex; align-items: center; gap: .6rem; padding: .52rem 1.1rem; font-size: .77rem; color: var(--mod-ink-dim); background: none; border: none; width: 100%; text-align: left; cursor: pointer; transition: all var(--mod-t); position: relative; }
  .mod-nav-item:hover { color: var(--mod-ink); background: var(--mod-surface2); }
  .mod-nav-item--active { color: var(--mod-ink); background: var(--mod-surface2); }
  .mod-nav-item--active::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--mod-teal); }
  .mod-nav-badge { margin-left: auto; font-size: .58rem; font-weight: 600; padding: .1rem .4rem; border-radius: 99px; background: rgba(184,50,50,.2); color: #e07060; border: 1px solid rgba(184,50,50,.3); }
  .mod-nav-badge--teal { background: rgba(58,128,128,.15); color: #5ab5b5; border-color: rgba(58,128,128,.3); }
  .mod-nav-badge--orange { background: rgba(200,131,42,.15); color: #d4922e; border-color: rgba(200,131,42,.3); }
  .mod-sidebar-foot { padding: .9rem 1.1rem; border-top: 1px solid var(--mod-border); }
  .mod-back-btn { display: flex; align-items: center; gap: .45rem; font-size: .7rem; color: var(--mod-ink-ghost); background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: color var(--mod-t); }
  .mod-back-btn:hover { color: var(--mod-ink-dim); }
  .mod-main { flex: 1; overflow-y: auto; }
  .mod-topbar { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.8rem; border-bottom: 1px solid var(--mod-border); background: var(--mod-surface); position: sticky; top: 0; z-index: 10; }
  .mod-page-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; font-weight: 300; font-style: italic; color: var(--mod-ink); }
  .mod-topbar-meta { font-size: .68rem; color: var(--mod-ink-ghost); }
  .mod-content { padding: 1.8rem; }
  .mod-stat-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: .9rem; margin-bottom: 1.6rem; }
  .mod-stat-card { background: var(--mod-surface2); border: 1px solid var(--mod-border); border-radius: 6px; padding: 1rem 1.1rem; }
  .mod-stat-label { font-size: .58rem; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: var(--mod-ink-ghost); margin-bottom: .4rem; }
  .mod-stat-value { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 300; line-height: 1; }
  .mod-stat-value--orange { color: var(--mod-orange); }
  .mod-stat-value--teal { color: var(--mod-teal); }
  .mod-filter-row { display: flex; gap: .6rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
  .mod-filter-select { background: var(--mod-surface2); border: 1px solid var(--mod-border); border-radius: 4px; padding: .48rem .7rem; font-family: 'DM Sans', sans-serif; font-size: .74rem; color: var(--mod-ink-dim); outline: none; cursor: pointer; }
  .mod-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .9rem; }
  .mod-section-title { font-family: 'Cormorant Garamond', serif; font-size: 1.15rem; font-weight: 300; font-style: italic; color: var(--mod-ink); }
  .mod-section-meta { font-size: .68rem; color: var(--mod-ink-ghost); }
  .mod-card-list { display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1.2rem; }
  .mod-item-card { background: var(--mod-surface2); border: 1px solid var(--mod-border); border-radius: 7px; padding: 1rem 1.15rem; transition: border-color var(--mod-t); }
  .mod-item-card:hover { border-color: var(--mod-border-hi); }
  .mod-item-header { display: flex; align-items: flex-start; gap: .75rem; margin-bottom: .65rem; }
  .mod-item-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: var(--mod-surface3); border: 1px solid var(--mod-border); display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 600; color: var(--mod-ink-ghost); }
  .mod-item-meta { flex: 1; min-width: 0; }
  .mod-item-title { font-size: .88rem; font-weight: 500; color: var(--mod-ink); margin-bottom: .18rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mod-item-sub { font-size: .68rem; color: var(--mod-ink-ghost); display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
  .mod-item-date { margin-left: auto; font-size: .64rem; color: var(--mod-ink-ghost); flex-shrink: 0; }
  .mod-ai-note { font-size: .7rem; color: var(--mod-orange); background: rgba(200,131,42,.07); border: 1px solid rgba(200,131,42,.18); border-radius: 4px; padding: .35rem .6rem; margin-bottom: .6rem; display: flex; align-items: flex-start; gap: .4rem; }
  .mod-preview { font-family: 'Cormorant Garamond', serif; font-size: .92rem; line-height: 1.7; color: var(--mod-ink-dim); background: var(--mod-surface3); border: 1px solid var(--mod-border); border-radius: 4px; padding: .7rem .9rem; margin-bottom: .75rem; max-height: 120px; overflow: hidden; position: relative; white-space: pre-wrap; word-break: break-word; cursor: pointer; transition: max-height .25s ease; }
  .mod-preview--expanded { max-height: 600px; }
  .mod-preview-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 36px; background: linear-gradient(transparent, var(--mod-surface3)); pointer-events: none; }
  .mod-actions { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; }
  .mod-btn { font-family: 'DM Sans', sans-serif; font-size: .64rem; font-weight: 500; padding: .33rem .72rem; border-radius: 4px; border: 1px solid var(--mod-border); background: var(--mod-surface3); color: var(--mod-ink-dim); cursor: pointer; transition: all var(--mod-t); white-space: nowrap; }
  .mod-btn:hover { border-color: var(--mod-border-hi); color: var(--mod-ink); }
  .mod-btn:disabled { opacity: .35; cursor: not-allowed; }
  .mod-btn--approve { color: var(--mod-green); border-color: rgba(74,124,89,.3); background: rgba(74,124,89,.06); }
  .mod-btn--approve:hover { background: rgba(74,124,89,.14); border-color: rgba(74,124,89,.5); }
  .mod-btn--reject { color: var(--mod-red); border-color: rgba(184,50,50,.3); background: rgba(184,50,50,.05); }
  .mod-btn--reject:hover { background: rgba(184,50,50,.12); border-color: rgba(184,50,50,.5); }
  .mod-btn--delete { color: #e07060; border-color: rgba(224,112,96,.3); background: rgba(224,112,96,.05); }
  .mod-btn--delete:hover { background: rgba(224,112,96,.12); border-color: rgba(224,112,96,.5); }
  .mod-btn--ghost { color: var(--mod-ink-ghost); }
  .mod-ban-badge { font-size: .56rem; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; padding: .1rem .4rem; border-radius: 99px; }
  .mod-ban-badge--comment { color: var(--mod-orange); background: rgba(200,131,42,.1); border: 1px solid rgba(200,131,42,.25); }
  .mod-ban-badge--content { color: var(--mod-red); background: rgba(184,50,50,.1); border: 1px solid rgba(184,50,50,.25); }
  .mod-badge { display: inline-flex; align-items: center; gap: .3rem; font-size: .6rem; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; padding: .15rem .5rem; border-radius: 99px; }
  .mod-badge--orange { color: var(--mod-orange); background: rgba(200,131,42,.1); border: 1px solid rgba(200,131,42,.25); }
  .mod-badge--red { color: var(--mod-red); background: rgba(184,50,50,.1); border: 1px solid rgba(184,50,50,.25); }
  .mod-badge--ghost { color: var(--mod-ink-ghost); background: var(--mod-surface3); border: 1px solid var(--mod-border); }
  .mod-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

  /* Şikayet detay kutusu */
  .mod-report-box { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin-bottom: .8rem; }
  .mod-report-party { background: var(--mod-surface3); border: 1px solid var(--mod-border); border-radius: 5px; padding: .7rem .9rem; }
  .mod-report-party-label { font-size: .54rem; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--mod-ink-ghost); margin-bottom: .5rem; }
  .mod-report-user { display: flex; align-items: center; gap: .55rem; }
  .mod-report-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: var(--mod-surface2); border: 1px solid var(--mod-border); display: flex; align-items: center; justify-content: center; font-size: .65rem; font-weight: 600; color: var(--mod-ink-ghost); overflow: hidden; }
  .mod-report-name { font-size: .78rem; color: var(--mod-ink); font-weight: 500; }
  .mod-report-email { font-size: .66rem; color: var(--mod-ink-ghost); margin-top: 1px; }
  .mod-comment-box { background: var(--mod-surface3); border: 1px solid var(--mod-border); border-left: 2px solid var(--mod-orange); border-radius: 0 4px 4px 0; padding: .65rem .9rem; font-family: 'Cormorant Garamond', serif; font-size: .95rem; line-height: 1.65; color: var(--mod-ink-dim); margin-bottom: .75rem; word-break: break-word; }
  .mod-comment-deleted { background: rgba(184,50,50,.06); border-color: var(--mod-red); color: var(--mod-ink-ghost); font-style: italic; font-size: .8rem; }
  .mod-work-ref { font-size: .7rem; color: var(--mod-ink-ghost); margin-bottom: .8rem; display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
  .mod-work-ref span { color: var(--mod-teal); }
  .mod-pager { display: flex; align-items: center; gap: .45rem; margin-top: .8rem; }
  .mod-pager-btn { font-size: .7rem; padding: .3rem .75rem; background: var(--mod-surface2); border: 1px solid var(--mod-border); border-radius: 4px; color: var(--mod-ink-dim); cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all var(--mod-t); }
  .mod-pager-btn:hover:not(:disabled) { border-color: var(--mod-border-hi); color: var(--mod-ink); }
  .mod-pager-btn:disabled { opacity: .3; cursor: not-allowed; }
  .mod-pager-info { font-size: .68rem; color: var(--mod-ink-ghost); }
  .mod-loading { display: flex; align-items: center; justify-content: center; gap: .55rem; padding: 2.5rem; color: var(--mod-ink-ghost); font-size: .76rem; }
  .mod-spinner { width: 13px; height: 13px; border: 1.5px solid var(--mod-border-hi); border-top-color: var(--mod-teal); border-radius: 50%; animation: mod-spin .6s linear infinite; }
  @keyframes mod-spin { to { transform: rotate(360deg); } }
  .mod-empty { text-align: center; padding: 3rem 1rem; color: var(--mod-ink-ghost); font-size: .78rem; font-style: italic; }
  .mod-empty-icon { font-size: 1.8rem; display: block; margin-bottom: .6rem; opacity: .4; }
  .mod-modal-veil { position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem; }
  .mod-modal-box { background: var(--mod-surface); border: 1px solid var(--mod-border-hi); border-radius: 8px; padding: 1.6rem; width: 100%; max-width: 400px; animation: mod-up .22s cubic-bezier(.22,1,.36,1); }
  .mod-modal-box--wide { max-width: 520px; }
  @keyframes mod-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  .mod-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 300; font-style: italic; color: var(--mod-ink); margin: 0 0 .35rem; }
  .mod-modal-sub { font-size: .7rem; color: var(--mod-ink-ghost); margin: 0 0 1rem; }
  .mod-modal-textarea { width: 100%; background: var(--mod-surface2); border: 1px solid var(--mod-border); border-radius: 4px; padding: .65rem .85rem; font-family: 'DM Sans', sans-serif; font-size: .76rem; color: var(--mod-ink); resize: vertical; min-height: 80px; outline: none; transition: border-color var(--mod-t); }
  .mod-modal-textarea:focus { border-color: var(--mod-border-hi); }
  .mod-modal-foot { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .9rem; }
  .mod-confirm-bar { background: rgba(184,50,50,.08); border: 1px solid rgba(184,50,50,.2); border-radius: 5px; padding: .6rem .85rem; font-size: .74rem; color: #e07060; display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; margin-bottom: .5rem; }
  .mod-confirm-bar span { flex: 1; }
  @media (max-width: 768px) { .mod-sidebar { display: none; } .mod-content { padding: 1.1rem; } .mod-report-box { grid-template-columns: 1fr; } }
`;

/* ── Yardımcılar ── */
const Spinner = () => <div className="mod-loading"><div className="mod-spinner" /> Yükleniyor…</div>;
const Empty = ({ icon = "✓", msg = "Kuyruk boş." }) => (
  <div className="mod-empty"><span className="mod-empty-icon">{icon}</span>{msg}</div>
);
function Pager({ page, total, onPage }) {
  if (total <= 1) return null;
  return (
    <div className="mod-pager">
      <button className="mod-pager-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Önceki</button>
      <span className="mod-pager-info">{page} / {total}</span>
      <button className="mod-pager-btn" disabled={page >= total} onClick={() => onPage(page + 1)}>Sonraki →</button>
    </div>
  );
}
function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60)    return "az önce";
  if (d < 3600)  return `${Math.floor(d / 60)} dk önce`;
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

const REASON_LABELS = {
  spam: "Spam", uygunsuz_icerik: "Uygunsuz İçerik",
  telif_ihlali: "Telif İhlali", taciz: "Taciz / Zorbalık",
  nefret_soylemi: "Nefret Söylemi", diger: "Diğer",
};

function UserChip({ user }) {
  if (!user) return <span style={{ color: "var(--mod-ink-ghost)", fontSize: ".72rem" }}>Silinmiş kullanıcı</span>;
  return (
    <div className="mod-report-user">
      <div className="mod-report-avatar">
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : (user.kullaniciAdi || "?")[0].toUpperCase()
        }
      </div>
      <div>
        <div className="mod-report-name">{user.kullaniciAdi || "—"}</div>
        <div className="mod-report-email">{user.email || ""}</div>
      </div>
    </div>
  );
}

/* ── Red Modal ── */
function RejectModal({ title, onConfirm, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!note.trim()) return;
    setBusy(true); await onConfirm(note.trim()); setBusy(false);
  }
  return (
    <div className="mod-modal-veil" onClick={onClose}>
      <div className="mod-modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="mod-modal-title">Reddet</h3>
        <p className="mod-modal-sub">"{title}" — red sebebini yaz. Yazara iletilecek.</p>
        <textarea className="mod-modal-textarea" placeholder="Örn: Uygunsuz içerik, topluluk kurallarına aykırı."
          value={note} onChange={e => setNote(e.target.value)} autoFocus />
        <div className="mod-modal-foot">
          <button className="mod-btn mod-btn--ghost" onClick={onClose}>Vazgeç</button>
          <button className="mod-btn mod-btn--reject" onClick={go} disabled={!note.trim() || busy}>
            {busy ? "Gönderiliyor…" : "Reddet"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Dashboard
════════════════════════════════════════════════ */
function Dashboard({ stats, onNav }) {
  if (!stats) return <Spinner />;
  const { bekleyenBolum = 0, bekleyenYorum = 0, bekleyenSikayet = 0 } = stats;
  const toplamBekleyen = bekleyenBolum + bekleyenYorum + bekleyenSikayet;

  return (
    <>
      <div className="mod-stat-row">
        <div className="mod-stat-card">
          <div className="mod-stat-label">Bekleyen Bölüm</div>
          <div className={`mod-stat-value ${bekleyenBolum > 0 ? "mod-stat-value--orange" : ""}`}>{bekleyenBolum}</div>
        </div>
        <div className="mod-stat-card">
          <div className="mod-stat-label">Bekleyen Yorum</div>
          <div className={`mod-stat-value ${bekleyenYorum > 0 ? "mod-stat-value--teal" : ""}`}>{bekleyenYorum}</div>
        </div>
        <div className="mod-stat-card">
          <div className="mod-stat-label">Yorum Şikayeti</div>
          <div className={`mod-stat-value ${bekleyenSikayet > 0 ? "mod-stat-value--orange" : ""}`}>{bekleyenSikayet}</div>
        </div>
        <div className="mod-stat-card">
          <div className="mod-stat-label">Toplam Kuyruk</div>
          <div className="mod-stat-value">{toplamBekleyen}</div>
        </div>
      </div>

      {toplamBekleyen === 0 ? (
        <div style={{ padding: "1.4rem", background: "rgba(74,124,89,.07)", border: "1px solid rgba(74,124,89,.2)", borderRadius: 6 }}>
          <span style={{ fontSize: ".76rem", color: "var(--mod-green)" }}>✓ Kuyruk temiz — bekleyen içerik yok.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
          {[
            { count: bekleyenBolum,  icon: "◎", color: "var(--mod-orange)", label: "Onay bekleyen bölüm",   nav: "chapters" },
            { count: bekleyenYorum,  icon: "✦", color: "var(--mod-teal)",   label: "Onay bekleyen yorum",   nav: "comments" },
            { count: bekleyenSikayet,icon: "⚑", color: "var(--mod-orange)", label: "Bekleyen yorum şikayeti",nav: "reports" },
          ].filter(x => x.count > 0).map(x => (
            <button key={x.nav}
              style={{ display: "flex", alignItems: "center", gap: ".9rem", padding: "1rem 1.2rem", background: "var(--mod-surface2)", border: "1px solid var(--mod-border)", borderRadius: 6, cursor: "pointer", textAlign: "left" }}
              onClick={() => onNav(x.nav)}>
              <span style={{ fontSize: "1.2rem", opacity: .7 }}>{x.icon}</span>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", fontWeight: 300, color: x.color, lineHeight: 1 }}>{x.count}</div>
                <div style={{ fontSize: ".7rem", color: "var(--mod-ink-dim)", marginTop: ".15rem" }}>{x.label}</div>
              </div>
              <span style={{ marginLeft: "auto", color: "var(--mod-ink-ghost)" }}>→</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════
   Bölüm Kuyruğu
════════════════════════════════════════════════ */
function ChapterQueue({ onRefresh }) {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [meta, setMeta]             = useState({});
  const [neden, setNeden]           = useState("all");
  const [expanded, setExpanded]     = useState({});
  const [rejectModal, setRejectModal] = useState(null);
  const [busy, setBusy]             = useState({});

  const load = useCallback(async (p = 1, n = "all") => {
    setLoading(true);
    try {
      const res = await apiGet(`/moderator/chapters?sayfa=${p}&limit=12&neden=${n}`);
      setItems(res.bolumler || []); setMeta(res.meta || {}); setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1, neden); }, [neden]);

  async function approve(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try { await apiPut(`/moderator/chapters/${id}/approve`); setItems(p => p.filter(i => i._id !== id)); onRefresh(); }
    catch (err) { alert(err.message || "Hata."); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  async function reject(id, note) {
    setBusy(b => ({ ...b, [id]: true }));
    try { await apiPut(`/moderator/chapters/${id}/reject`, { reviewNote: note }); setItems(p => p.filter(i => i._id !== id)); setRejectModal(null); onRefresh(); }
    catch (err) { alert(err.message || "Hata."); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  return (
    <>
      <div className="mod-section-head">
        <h2 className="mod-section-title">Bölüm Kuyruğu</h2>
        <span className="mod-section-meta">{meta.toplam || 0} bekliyor</span>
      </div>
      <div className="mod-filter-row">
        <select className="mod-filter-select" value={neden} onChange={e => setNeden(e.target.value)}>
          <option value="all">Tümü</option>
          <option value="ai_flag">AI İşaretledi</option>
          <option value="content_ban">İçerik Kısıtlaması</option>
        </select>
      </div>

      {loading ? <Spinner /> : items.length === 0 ? (
        <Empty icon="◎" msg="Bekleyen bölüm yok. ✓" />
      ) : (
        <div className="mod-card-list">
          {items.map(item => {
            const yazar = item.work?.user;
            const isExp = expanded[item._id];
            return (
              <div key={item._id} className="mod-item-card">
                <div className="mod-item-header">
                  {yazar?.avatarUrl
                    ? <img src={yazar.avatarUrl} className="mod-item-avatar" alt="" />
                    : <div className="mod-item-avatar">{(yazar?.kullaniciAdi || "?")[0].toUpperCase()}</div>
                  }
                  <div className="mod-item-meta">
                    <div className="mod-item-title">{item.title}</div>
                    <div className="mod-item-sub">
                      <span>{item.work?.title || "—"}</span>
                      <span style={{ color: "var(--mod-border-hi)" }}>·</span>
                      <span>{yazar?.kullaniciAdi || "—"}</span>
                      {yazar?.contentBanned && <span className="mod-ban-badge mod-ban-badge--content">İçerik Kısıtlı</span>}
                    </div>
                  </div>
                  <span className="mod-item-date">{timeAgo(item.createdAt)}</span>
                </div>
                {item.reviewNote && (
                  <div className="mod-ai-note"><span>⚠</span><span>AI notu: {item.reviewNote}</span></div>
                )}
                {item.content && (
                  <div className={`mod-preview ${isExp ? "mod-preview--expanded" : ""}`}
                    onClick={() => setExpanded(e => ({ ...e, [item._id]: !e[item._id] }))}>
                    {item.content}
                    {!isExp && <div className="mod-preview-fade" />}
                  </div>
                )}
                <div className="mod-actions">
                  <button className="mod-btn mod-btn--approve" disabled={busy[item._id]} onClick={() => approve(item._id)}>
                    {busy[item._id] ? "…" : "Onayla"}
                  </button>
                  <button className="mod-btn mod-btn--reject" disabled={busy[item._id]}
                    onClick={() => setRejectModal({ id: item._id, title: item.title })}>Reddet</button>
                  {item.work?._id && (
                    <button className="mod-btn" onClick={() => window.open(`/story/${item.work._id}`, "_blank")}>Esere Git ↗</button>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: ".65rem", color: "var(--mod-ink-ghost)" }}>
                    {item.content ? `${item.content.trim().split(/\s+/).length} kelime` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pager page={page} total={meta.toplamSayfa || 1} onPage={p => load(p, neden)} />
      {rejectModal && (
        <RejectModal title={rejectModal.title}
          onConfirm={note => reject(rejectModal.id, note)}
          onClose={() => setRejectModal(null)} />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════
   Yorum Kuyruğu (onay bekleyen)
════════════════════════════════════════════════ */
function CommentQueue({ onRefresh }) {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [meta, setMeta]             = useState({});
  const [rejectModal, setRejectModal] = useState(null);
  const [busy, setBusy]             = useState({});

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet(`/moderator/comments?sayfa=${p}&limit=20`);
      setItems(res.yorumlar || []); setMeta(res.meta || {}); setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  async function approve(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try { await apiPut(`/moderator/comments/${id}/approve`); setItems(p => p.filter(i => i._id !== id)); onRefresh(); }
    catch (err) { alert(err.message || "Hata."); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  async function reject(id, reason) {
    setBusy(b => ({ ...b, [id]: true }));
    try { await apiPut(`/moderator/comments/${id}/reject`, { reason }); setItems(p => p.filter(i => i._id !== id)); setRejectModal(null); onRefresh(); }
    catch (err) { alert(err.message || "Hata."); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  return (
    <>
      <div className="mod-section-head">
        <h2 className="mod-section-title">Yorum Kuyruğu</h2>
        <span className="mod-section-meta">{meta.toplam || 0} bekliyor</span>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? (
        <Empty icon="✦" msg="Bekleyen yorum yok. ✓" />
      ) : (
        <div className="mod-card-list">
          {items.map(item => {
            const yazar = item.author;
            return (
              <div key={item._id} className="mod-item-card">
                <div className="mod-item-header">
                  {yazar?.avatarUrl
                    ? <img src={yazar.avatarUrl} className="mod-item-avatar" alt="" />
                    : <div className="mod-item-avatar">{(yazar?.kullaniciAdi || "?")[0].toUpperCase()}</div>
                  }
                  <div className="mod-item-meta">
                    <div className="mod-item-sub" style={{ marginBottom: ".1rem" }}>
                      <span style={{ color: "var(--mod-ink)", fontWeight: 500 }}>{yazar?.kullaniciAdi || "—"}</span>
                      {yazar?.commentBanned && <span className="mod-ban-badge mod-ban-badge--comment">Yorum Kısıtlı</span>}
                    </div>
                    <div className="mod-item-sub">
                      <span>{item.chapter?.work?.title || "—"}</span>
                      <span style={{ color: "var(--mod-border-hi)" }}>·</span>
                      <span>{item.chapter?.title || "—"}</span>
                    </div>
                  </div>
                  <span className="mod-item-date">{timeAgo(item.createdAt)}</span>
                </div>
                <div className="mod-comment-box">{item.content || item.text}</div>
                <div className="mod-actions">
                  <button className="mod-btn mod-btn--approve" disabled={busy[item._id]} onClick={() => approve(item._id)}>
                    {busy[item._id] ? "…" : "Onayla"}
                  </button>
                  <button className="mod-btn mod-btn--reject" disabled={busy[item._id]}
                    onClick={() => setRejectModal({ id: item._id, title: `${yazar?.kullaniciAdi || "?"} yorumu` })}>
                    Reddet
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pager page={page} total={meta.toplamSayfa || 1} onPage={load} />
      {rejectModal && (
        <RejectModal title={rejectModal.title}
          onConfirm={reason => reject(rejectModal.id, reason)}
          onClose={() => setRejectModal(null)} />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════
   Yorum Şikayetleri (moderatör görünümü)
   Sadece targetType=comment şikayetleri
════════════════════════════════════════════════ */
function CommentReports({ onRefresh }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [meta, setMeta]         = useState({});
  const [statusFilter, setStatus] = useState("pending");
  const [busy, setBusy]         = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null); // report._id

  const load = useCallback(async (p = 1, sf = "pending") => {
    setLoading(true);
    try {
      const res = await apiGet(`/admin/reports?sayfa=${p}&limit=15&status=${sf}&targetType=comment`);
      setItems(res.sikayetler || []); setMeta(res.meta || {}); setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1, statusFilter); }, [statusFilter]);

  async function resolve(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try { await apiPut(`/admin/reports/${id}/resolve`); setItems(p => p.map(i => i._id === id ? { ...i, status: "resolved" } : i)); onRefresh(); }
    catch (err) { alert(err.message || "Hata."); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  async function dismiss(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try { await apiPut(`/admin/reports/${id}/dismiss`); setItems(p => p.map(i => i._id === id ? { ...i, status: "dismissed" } : i)); onRefresh(); }
    catch (err) { alert(err.message || "Hata."); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  async function deleteComment(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE.replace("/api", "")}/api/admin/reports/${id}/comment`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      // Yorumu sil → şikayet resolved olur, kartı güncelle
      setItems(p => p.map(i => i._id === id
        ? { ...i, status: "resolved", targetObj: null }
        : i
      ));
      setDeleteConfirm(null);
      onRefresh();
    } catch (err) { alert("Yorum silinemedi."); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  return (
    <>
      <div className="mod-section-head">
        <h2 className="mod-section-title">Yorum Şikayetleri</h2>
        <span className="mod-section-meta">{meta.toplam || 0} şikayet</span>
      </div>

      <div className="mod-filter-row">
        <select className="mod-filter-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="pending">Bekleyen</option>
          <option value="resolved">Çözüldü</option>
          <option value="dismissed">Geçersiz</option>
          <option value="all">Tüm Durumlar</option>
        </select>
      </div>

      {loading ? <Spinner /> : items.length === 0 ? (
        <Empty icon="⚑" msg="Yorum şikayeti yok. ✓" />
      ) : (
        <div className="mod-card-list">
          {items.map(item => {
            const comment    = item.targetObj;
            const reporter   = item.reporter;
            const commenter  = comment?.author;
            const workTitle  = comment?.work?.title || "—";
            const chapTitle  = comment?.chapter?.title || null;

            return (
              <div key={item._id} className="mod-item-card">
                {/* ── Üst bilgi: sebep + tarih ── */}
                <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".6rem" }}>
                  <span className="mod-badge mod-badge--orange">{REASON_LABELS[item.reason] || item.reason}</span>
                  {item.status === "resolved"  && <span className="mod-badge" style={{ color: "var(--mod-green)", background: "rgba(74,124,89,.1)", border: "1px solid rgba(74,124,89,.25)" }}>Çözüldü</span>}
                  {item.status === "dismissed" && <span className="mod-badge mod-badge--ghost">Geçersiz</span>}
                  <span style={{ marginLeft: "auto", fontSize: ".64rem", color: "var(--mod-ink-ghost)" }}>{timeAgo(item.createdAt)}</span>
                </div>

                {/* ── Taraflar ── */}
                <div className="mod-report-box">
                  <div className="mod-report-party">
                    <div className="mod-report-party-label">Şikayet Eden</div>
                    <UserChip user={reporter} />
                  </div>
                  <div className="mod-report-party">
                    <div className="mod-report-party-label">Yorum Yazan</div>
                    <UserChip user={commenter} />
                  </div>
                </div>

                {/* ── Yorum referansı ── */}
                <div className="mod-work-ref">
                  <span>📖</span>
                  <span style={{ color: "var(--mod-ink-dim)" }}>{workTitle}</span>
                  {chapTitle && <><span style={{ opacity: .4 }}>›</span><span style={{ color: "var(--mod-ink-dim)" }}>{chapTitle}</span></>}
                </div>

                {/* ── Yorum içeriği ── */}
                {comment ? (
                  <div className="mod-comment-box">{comment.content}</div>
                ) : (
                  <div className="mod-comment-box mod-comment-deleted">
                    Bu yorum silinmiş veya bulunamadı.
                  </div>
                )}

                {/* ── Şikayet açıklaması ── */}
                {item.description && (
                  <div style={{ fontSize: ".7rem", color: "var(--mod-ink-ghost)", fontStyle: "italic", marginBottom: ".6rem", paddingLeft: ".5rem", borderLeft: "2px solid var(--mod-border-hi)" }}>
                    "{item.description}"
                  </div>
                )}

                {/* ── Silme onayı ── */}
                {deleteConfirm === item._id && (
                  <div className="mod-confirm-bar">
                    <span>Yorumu kalıcı olarak silmek istediğine emin misin?</span>
                    <button className="mod-btn mod-btn--ghost" onClick={() => setDeleteConfirm(null)}>Vazgeç</button>
                    <button className="mod-btn mod-btn--delete" onClick={() => deleteComment(item._id)} disabled={busy[item._id]}>
                      {busy[item._id] ? "…" : "Evet, Sil"}
                    </button>
                  </div>
                )}

                {/* ── Aksiyonlar ── */}
                {item.status === "pending" && deleteConfirm !== item._id && (
                  <div className="mod-actions">
                    {comment && (
                      <button className="mod-btn mod-btn--delete" disabled={busy[item._id]}
                        onClick={() => setDeleteConfirm(item._id)}>
                        Yorumu Sil
                      </button>
                    )}
                    <button className="mod-btn mod-btn--approve" disabled={busy[item._id]}
                      onClick={() => resolve(item._id)}>
                      {busy[item._id] ? "…" : "Çözüldü İşaretle"}
                    </button>
                    <button className="mod-btn mod-btn--ghost" disabled={busy[item._id]}
                      onClick={() => dismiss(item._id)}>
                      Geçersiz Say
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Pager page={page} total={meta.toplamSayfa || 1} onPage={p => load(p, statusFilter)} />
    </>
  );
}

/* ════════════════════════════════════════════════
   ANA PANEL
════════════════════════════════════════════════ */
export default function ModeratorPanel() {
  const navigate = useNavigate();
  const [page, setPage]   = useState("dashboard");
  const [stats, setStats] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const [modRes, repRes] = await Promise.all([
        apiGet("/moderator/stats"),
        apiGet("/admin/reports?sayfa=1&limit=1&status=pending&targetType=comment").catch(() => ({ meta: { toplam: 0 } })),
      ]);
      setStats({ ...modRes, bekleyenSikayet: repRes.meta?.toplam ?? 0 });
    } catch {}
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const id = "mod-styles-v2";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id; tag.textContent = CSS;
      document.head.appendChild(tag);
    }
  }, []);

  const bekleyenBolum   = stats?.bekleyenBolum   || 0;
  const bekleyenYorum   = stats?.bekleyenYorum   || 0;
  const bekleyenSikayet = stats?.bekleyenSikayet || 0;

  const pageTitle = {
    dashboard: "Genel Bakış",
    chapters:  "Bölüm Kuyruğu",
    comments:  "Yorum Kuyruğu",
    reports:   "Yorum Şikayetleri",
  }[page];

  return (
    <div className="mod-root">
      <aside className="mod-sidebar">
        <div className="mod-logo">
          <span className="mod-logo-eyebrow">ACB Atölyesi</span>
          <span className="mod-logo-title">Moderatör Paneli</span>
        </div>
        <nav className="mod-nav">
          <span className="mod-nav-label">Genel</span>
          <button className={`mod-nav-item ${page === "dashboard" ? "mod-nav-item--active" : ""}`} onClick={() => setPage("dashboard")}>
            <span style={{ opacity: .65 }}>◈</span> Dashboard
          </button>

          <span className="mod-nav-label" style={{ marginTop: ".6rem" }}>Kuyruklar</span>
          <button className={`mod-nav-item ${page === "chapters" ? "mod-nav-item--active" : ""}`} onClick={() => setPage("chapters")}>
            <span style={{ opacity: .65 }}>◎</span> Bölümler
            {bekleyenBolum > 0 && <span className="mod-nav-badge mod-nav-badge--teal">{bekleyenBolum}</span>}
          </button>
          <button className={`mod-nav-item ${page === "comments" ? "mod-nav-item--active" : ""}`} onClick={() => setPage("comments")}>
            <span style={{ opacity: .65 }}>✦</span> Yorumlar
            {bekleyenYorum > 0 && <span className="mod-nav-badge">{bekleyenYorum}</span>}
          </button>
          <button className={`mod-nav-item ${page === "reports" ? "mod-nav-item--active" : ""}`} onClick={() => setPage("reports")}>
            <span style={{ opacity: .65 }}>⚑</span> Şikayetler
            {bekleyenSikayet > 0 && <span className="mod-nav-badge mod-nav-badge--orange">{bekleyenSikayet}</span>}
          </button>
        </nav>
        <div className="mod-sidebar-foot">
          <button className="mod-back-btn" onClick={() => navigate("/studio")}>← Atölyeye Dön</button>
        </div>
      </aside>

      <main className="mod-main">
        <div className="mod-topbar">
          <h1 className="mod-page-title">{pageTitle}</h1>
          <span className="mod-topbar-meta">
            {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        <div className="mod-content">
          {page === "dashboard" && <Dashboard stats={stats} onNav={setPage} />}
          {page === "chapters"  && <ChapterQueue onRefresh={fetchStats} />}
          {page === "comments"  && <CommentQueue onRefresh={fetchStats} />}
          {page === "reports"   && <CommentReports onRefresh={fetchStats} />}
        </div>
      </main>
    </div>
  );
}