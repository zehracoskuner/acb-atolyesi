// src/pages/AdminPanel.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminGet, adminPut, adminPatch, adminDelete, apiGet, apiPut, apiPost, apiDelete } from "../lib/api";

/* ══════════════════════════════════════════════
   CSS
══════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  :root {
    --adm-bg:#0d0f0e;--adm-surface:#131614;--adm-surface2:#1a1e1c;--adm-surface3:#222825;
    --adm-border:rgba(255,255,255,0.06);--adm-border-hi:rgba(255,255,255,0.12);
    --adm-ink:#e8ede9;--adm-ink-dim:#8fa68f;--adm-ink-ghost:#4d5e4f;
    --adm-accent:#c0392b;--adm-green:#4a7c59;--adm-orange:#c8832a;
    --adm-red:#b83232;--adm-gold:#b8962a;--adm-t:0.18s ease;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  .adm-root{display:flex;min-height:100vh;background:var(--adm-bg);font-family:'DM Sans',sans-serif;color:var(--adm-ink);}
  .adm-sidebar{width:224px;flex-shrink:0;background:var(--adm-surface);border-right:1px solid var(--adm-border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto;}
  .adm-logo{padding:1.6rem 1.4rem 1.2rem;border-bottom:1px solid var(--adm-border);}
  .adm-logo-eyebrow{font-size:.58rem;font-weight:500;letter-spacing:.3em;text-transform:uppercase;color:var(--adm-accent);opacity:.8;display:block;margin-bottom:.3rem;}
  .adm-logo-title{font-family:'Cormorant Garamond',serif;font-size:1.35rem;font-weight:300;font-style:italic;color:var(--adm-ink);display:block;line-height:1.2;}
  .adm-nav{padding:1rem 0;flex:1;}
  .adm-nav-section{margin-bottom:1.5rem;}
  .adm-nav-label{font-size:.56rem;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:var(--adm-ink-ghost);padding:0 1.2rem;margin-bottom:.3rem;display:block;}
  .adm-nav-item{display:flex;align-items:center;gap:.65rem;padding:.55rem 1.2rem;font-size:.78rem;font-weight:400;color:var(--adm-ink-dim);background:none;border:none;width:100%;text-align:left;cursor:pointer;transition:color var(--adm-t),background var(--adm-t);position:relative;}
  .adm-nav-item:hover{color:var(--adm-ink);background:var(--adm-surface2);}
  .adm-nav-item--active{color:var(--adm-ink);background:var(--adm-surface2);}
  .adm-nav-item--active::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--adm-accent);}
  .adm-nav-badge{margin-left:auto;font-size:.6rem;font-weight:600;padding:.1rem .45rem;border-radius:99px;background:rgba(192,57,43,.2);color:#e07060;border:1px solid rgba(192,57,43,.3);}
  .adm-nav-badge--orange{background:rgba(200,131,42,.15);color:#d4922e;border-color:rgba(200,131,42,.3);}
  .adm-sidebar-foot{padding:1rem 1.2rem;border-top:1px solid var(--adm-border);}
  .adm-back-btn{display:flex;align-items:center;gap:.5rem;font-size:.72rem;color:var(--adm-ink-ghost);background:none;border:none;cursor:pointer;transition:color var(--adm-t);padding:0;font-family:'DM Sans',sans-serif;}
  .adm-back-btn:hover{color:var(--adm-ink-dim);}
  .adm-main{flex:1;overflow-y:auto;}
  .adm-topbar{display:flex;align-items:center;justify-content:space-between;padding:1.2rem 2rem;border-bottom:1px solid var(--adm-border);background:var(--adm-surface);position:sticky;top:0;z-index:10;}
  .adm-page-title{font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:300;font-style:italic;color:var(--adm-ink);}
  .adm-topbar-meta{font-size:.7rem;color:var(--adm-ink-ghost);}
  .adm-content{padding:2rem;}
  .adm-stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-bottom:1.8rem;}
  .adm-stat-card{background:var(--adm-surface2);border:1px solid var(--adm-border);border-radius:6px;padding:1.2rem 1.3rem;transition:border-color var(--adm-t),transform var(--adm-t);cursor:default;}
  .adm-stat-card:hover{border-color:var(--adm-border-hi);transform:translateY(-1px);}
  .adm-stat-label{font-size:.6rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--adm-ink-ghost);margin-bottom:.5rem;}
  .adm-stat-value{font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:300;color:var(--adm-ink);line-height:1;}
  .adm-stat-sub{font-size:.65rem;color:var(--adm-ink-ghost);margin-top:.3rem;}
  .adm-stat-card--alert .adm-stat-value{color:var(--adm-orange);}
  .adm-stat-card--danger .adm-stat-value{color:var(--adm-accent);}
  .adm-pending-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.8rem;}
  .adm-pending-card{background:var(--adm-surface2);border:1px solid var(--adm-border);border-radius:6px;padding:1.2rem 1.4rem;display:flex;align-items:center;gap:1rem;cursor:pointer;transition:border-color var(--adm-t),background var(--adm-t);}
  .adm-pending-card:hover{border-color:var(--adm-border-hi);background:var(--adm-surface3);}
  .adm-pending-icon{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;}
  .adm-pending-icon--orange{background:rgba(200,131,42,.1);border:1px solid rgba(200,131,42,.2);}
  .adm-pending-icon--red{background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.2);}
  .adm-pending-info{flex:1;}
  .adm-pending-count{font-family:'Cormorant Garamond',serif;font-size:1.8rem;font-weight:300;line-height:1;}
  .adm-pending-count--orange{color:var(--adm-orange);}
  .adm-pending-count--red{color:var(--adm-accent);}
  .adm-pending-label{font-size:.72rem;color:var(--adm-ink-dim);margin-top:.2rem;}
  .adm-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;}
  .adm-section-title{font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:300;font-style:italic;color:var(--adm-ink);}
  .adm-section-meta{font-size:.7rem;color:var(--adm-ink-ghost);}
  .adm-table-wrap{background:var(--adm-surface2);border:1px solid var(--adm-border);border-radius:6px;overflow:hidden;margin-bottom:1.5rem;}
  .adm-table{width:100%;border-collapse:collapse;}
  .adm-table th{font-size:.6rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--adm-ink-ghost);padding:.75rem 1.2rem;border-bottom:1px solid var(--adm-border);text-align:left;background:var(--adm-surface);}
  .adm-table td{padding:.85rem 1.2rem;font-size:.78rem;color:var(--adm-ink-dim);border-bottom:1px solid var(--adm-border);vertical-align:middle;}
  .adm-table tr:last-child td{border-bottom:none;}
  .adm-table tr:hover td{background:rgba(255,255,255,.02);}
  .adm-td-main{color:var(--adm-ink);font-weight:400;}
  .adm-td-sub{font-size:.68rem;color:var(--adm-ink-ghost);margin-top:2px;}
  .adm-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.6rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;padding:.15rem .55rem;border-radius:99px;}
  .adm-badge--green{color:#4a7c59;background:rgba(74,124,89,.12);border:1px solid rgba(74,124,89,.25);}
  .adm-badge--orange{color:var(--adm-orange);background:rgba(200,131,42,.1);border:1px solid rgba(200,131,42,.25);}
  .adm-badge--red{color:var(--adm-accent);background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.25);}
  .adm-badge--ghost{color:var(--adm-ink-ghost);background:var(--adm-surface3);border:1px solid var(--adm-border);}
  .adm-badge--gold{color:var(--adm-gold);background:rgba(184,150,42,.1);border:1px solid rgba(184,150,42,.25);}
  .adm-badge--featured{color:#7eb8d4;background:rgba(126,184,212,.1);border:1px solid rgba(126,184,212,.25);}
  .adm-badge-dot{width:5px;height:5px;border-radius:50%;background:currentColor;}
  .adm-btn-row{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;}
  .adm-btn{font-family:'DM Sans',sans-serif;font-size:.66rem;font-weight:500;padding:.35rem .75rem;border-radius:4px;border:1px solid var(--adm-border);background:var(--adm-surface3);color:var(--adm-ink-dim);cursor:pointer;transition:all var(--adm-t);white-space:nowrap;}
  .adm-btn:hover{border-color:var(--adm-border-hi);color:var(--adm-ink);}
  .adm-btn:disabled{opacity:.35;cursor:not-allowed;}
  .adm-btn--approve{color:#4a7c59;border-color:rgba(74,124,89,.3);background:rgba(74,124,89,.06);}
  .adm-btn--approve:hover{background:rgba(74,124,89,.14);border-color:rgba(74,124,89,.5);}
  .adm-btn--reject{color:var(--adm-accent);border-color:rgba(192,57,43,.3);background:rgba(192,57,43,.05);}
  .adm-btn--reject:hover{background:rgba(192,57,43,.12);border-color:rgba(192,57,43,.5);}
  .adm-btn--ban{color:var(--adm-red);border-color:rgba(184,50,50,.3);background:rgba(184,50,50,.05);}
  .adm-btn--unban{color:var(--adm-green);border-color:rgba(74,124,89,.3);background:rgba(74,124,89,.05);}
  .adm-btn--feature{color:#7eb8d4;border-color:rgba(126,184,212,.3);background:rgba(126,184,212,.05);}
  .adm-search-row{display:flex;gap:.75rem;margin-bottom:1rem;align-items:center;flex-wrap:wrap;}
  .adm-search{flex:1;max-width:320px;background:var(--adm-surface2);border:1px solid var(--adm-border);border-radius:4px;padding:.55rem .9rem;font-family:'DM Sans',sans-serif;font-size:.78rem;color:var(--adm-ink);outline:none;transition:border-color var(--adm-t);}
  .adm-search::placeholder{color:var(--adm-ink-ghost);}
  .adm-search:focus{border-color:var(--adm-border-hi);}
  .adm-filter-select{background:var(--adm-surface2);border:1px solid var(--adm-border);border-radius:4px;padding:.55rem .8rem;font-family:'DM Sans',sans-serif;font-size:.75rem;color:var(--adm-ink-dim);outline:none;cursor:pointer;}
  .adm-empty{text-align:center;padding:3rem 1rem;color:var(--adm-ink-ghost);font-size:.8rem;font-style:italic;}
  .adm-loading{display:flex;align-items:center;justify-content:center;gap:.6rem;padding:2.5rem;color:var(--adm-ink-ghost);font-size:.78rem;}
  .adm-spinner{width:14px;height:14px;border:1.5px solid var(--adm-border-hi);border-top-color:var(--adm-accent);border-radius:50%;animation:adm-spin .65s linear infinite;}
  @keyframes adm-spin{to{transform:rotate(360deg);}}
  .adm-modal-veil{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;}
  .adm-modal-box{background:var(--adm-surface);border:1px solid var(--adm-border-hi);border-radius:8px;padding:1.8rem;width:100%;max-width:480px;animation:adm-up .25s cubic-bezier(.22,1,.36,1);}
  .adm-modal-box--wide{max-width:680px;}
  @keyframes adm-up{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
  .adm-modal-title{font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:300;font-style:italic;color:var(--adm-ink);margin:0 0 .4rem;}
  .adm-modal-sub{font-size:.72rem;color:var(--adm-ink-ghost);margin:0 0 1.2rem;}
  .adm-modal-textarea{width:100%;box-sizing:border-box;background:var(--adm-surface2);border:1px solid var(--adm-border);border-radius:4px;padding:.7rem .9rem;font-family:'DM Sans',sans-serif;font-size:.78rem;color:var(--adm-ink);resize:vertical;min-height:80px;outline:none;transition:border-color var(--adm-t);}
  .adm-modal-textarea:focus{border-color:var(--adm-border-hi);}
  .adm-modal-foot{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1rem;}
  .adm-pager{display:flex;align-items:center;gap:.5rem;margin-top:1rem;}
  .adm-pager-btn{font-size:.72rem;padding:.35rem .8rem;background:var(--adm-surface2);border:1px solid var(--adm-border);border-radius:4px;color:var(--adm-ink-dim);cursor:pointer;transition:all var(--adm-t);font-family:'DM Sans',sans-serif;}
  .adm-pager-btn:hover:not(:disabled){border-color:var(--adm-border-hi);color:var(--adm-ink);}
  .adm-pager-btn:disabled{opacity:.3;cursor:not-allowed;}
  .adm-pager-info{font-size:.7rem;color:var(--adm-ink-ghost);}
  .adm-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;}
  .adm-chart-card{background:var(--adm-surface2);border:1px solid var(--adm-border);border-radius:6px;padding:1.2rem;}
  .adm-chart-title{font-size:.62rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--adm-ink-ghost);margin-bottom:1rem;}
  .adm-bar-row{display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;}
  .adm-bar-label{font-size:.7rem;color:var(--adm-ink-dim);min-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .adm-bar-track{flex:1;height:4px;background:var(--adm-surface3);border-radius:2px;overflow:hidden;}
  .adm-bar-fill{height:100%;border-radius:2px;background:var(--adm-accent);transition:width .4s ease;}
  .adm-bar-val{font-size:.68rem;color:var(--adm-ink-ghost);min-width:24px;text-align:right;}
  .adm-top-list{display:flex;flex-direction:column;gap:.5rem;}
  .adm-top-item{display:flex;align-items:center;gap:.75rem;padding:.5rem .6rem;border-radius:4px;background:var(--adm-surface3);}
  .adm-top-rank{font-family:'Cormorant Garamond',serif;font-size:1rem;font-weight:300;color:var(--adm-ink-ghost);min-width:18px;}
  .adm-top-info{flex:1;min-width:0;}
  .adm-top-name{font-size:.76rem;color:var(--adm-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .adm-top-meta{font-size:.65rem;color:var(--adm-ink-ghost);}
  .adm-top-val{font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:300;color:var(--adm-orange);}

  /* ── Şikayet Detay Kartı ── */
  .adm-report-detail{background:var(--adm-surface3);border:1px solid var(--adm-border);border-radius:6px;padding:1rem 1.2rem;display:flex;flex-direction:column;gap:.6rem;}
  .adm-report-detail-row{display:flex;gap:1.2rem;}
  .adm-report-party{flex:1;min-width:0;}
  .adm-report-party-label{font-size:.55rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--adm-ink-ghost);margin-bottom:.4rem;}
  .adm-report-user-row{display:flex;align-items:center;gap:.6rem;}
  .adm-report-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--adm-surface2);border:1px solid var(--adm-border);}
  .adm-report-avatar-placeholder{width:32px;height:32px;border-radius:50%;background:var(--adm-surface2);border:1px solid var(--adm-border);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:600;color:var(--adm-ink-ghost);flex-shrink:0;}
  .adm-report-name{font-size:.8rem;color:var(--adm-ink);font-weight:500;}
  .adm-report-email{font-size:.68rem;color:var(--adm-ink-ghost);}
  .adm-report-work-cover{width:32px;height:44px;border-radius:3px;object-fit:cover;flex-shrink:0;background:var(--adm-surface2);border:1px solid var(--adm-border);}
  .adm-report-work-placeholder{width:32px;height:44px;border-radius:3px;background:var(--adm-surface2);border:1px solid var(--adm-border);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:var(--adm-ink-ghost);flex-shrink:0;}
  .adm-report-divider{width:1px;background:var(--adm-border);align-self:stretch;flex-shrink:0;}
  .adm-report-desc{font-size:.75rem;color:var(--adm-ink-dim);font-style:italic;padding:.5rem .7rem;background:rgba(255,255,255,.02);border-left:2px solid var(--adm-border-hi);border-radius:0 3px 3px 0;}

  /* Şikayet modal detay */
  .adm-rdetail-section{margin-bottom:1rem;}
  .adm-rdetail-label{font-size:.55rem;font-weight:600;letter-spacing:.25em;text-transform:uppercase;color:var(--adm-ink-ghost);margin-bottom:.4rem;}
  .adm-rdetail-val{font-size:.82rem;color:var(--adm-ink-dim);}
  .adm-rdetail-name{font-size:.95rem;color:var(--adm-ink);font-weight:500;}
  .adm-rdetail-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;}

  @media(max-width:768px){
    .adm-sidebar{display:none;}
    .adm-pending-grid,.adm-chart-grid,.adm-rdetail-grid{grid-template-columns:1fr;}
    .adm-content{padding:1.2rem;}
  }
`;

/* ── Yardımcı ── */
const Spinner = () => <div className="adm-loading"><div className="adm-spinner" /> Yükleniyor…</div>;
const Empty   = ({ msg = "Kayıt bulunamadı." }) => <div className="adm-empty">{msg}</div>;

function Pager({ page, total, onPage }) {
  if (total <= 1) return null;
  return (
    <div className="adm-pager">
      <button className="adm-pager-btn" disabled={page <= 1}  onClick={() => onPage(page - 1)}>← Önceki</button>
      <span   className="adm-pager-info">{page} / {total}</span>
      <button className="adm-pager-btn" disabled={page >= total} onClick={() => onPage(page + 1)}>Sonraki →</button>
    </div>
  );
}

/* ── Sabitler ── */
const REASON_LABELS = {
  spam:"Spam", uygunsuz_icerik:"Uygunsuz İçerik", telif_ihlali:"Telif İhlali",
  taciz:"Taciz / Zorbalık", nefret_soylemi:"Nefret Söylemi", diger:"Diğer",
};
const TARGET_LABELS = { work:"Eser", chapter:"Bölüm", user:"Kullanıcı", comment:"Yorum" };

/* ════════════════════════════════════════════════════════════
   RejectModal — bölüm reddi
════════════════════════════════════════════════════════════ */
function RejectModal({ title, onConfirm, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!note.trim()) return;
    setBusy(true);
    await onConfirm(note.trim());
    setBusy(false);
  }

  return (
    <div className="adm-modal-veil" onClick={onClose}>
      <div className="adm-modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="adm-modal-title">Reddet</h3>
        <p className="adm-modal-sub">"{title}" — red sebebini yaz. Yazara mail olarak iletilecek.</p>
        <textarea
          className="adm-modal-textarea"
          placeholder="Örn: İçerik politikamıza aykırı şiddet tasviri içeriyor."
          value={note} onChange={e => setNote(e.target.value)} autoFocus
        />
        <div className="adm-modal-foot">
          <button className="adm-btn" onClick={onClose}>Vazgeç</button>
          <button className="adm-btn adm-btn--reject" onClick={go} disabled={!note.trim() || busy}>
            {busy ? "Gönderiliyor…" : "Reddet"}
          </button>
        </div>
      </div>
    </div>
  );
}
function BanModal({ user, onClose, onBanned }) {
  const [banType,  setBanType]  = useState("comment");
  const [reason,   setReason]   = useState("");
  const [busy,     setBusy]     = useState(false);
  const [sikCount, setSikCount] = useState(null);
 
  useEffect(() => {
    // Şikayet sayısını çek — full ban için göster
    adminGet(`/users/${user._id}/ban-status`)
      .then(res => setSikCount(res.sikayet?.toplam ?? 0))
      .catch(() => {});
  }, [user._id]);
 
  async function handleBan() {
    if (!reason.trim()) return;
    if (banType === "full" && sikCount !== null && sikCount < 50) {
      alert(`Tam ban için en az 50 şikayet gerekli. Mevcut: ${sikCount}`);
      return;
    }
    setBusy(true);
    try {
      await adminPatch(`/users/${user._id}/ban`, { type: banType, reason: reason.trim() });
      onBanned(user._id, banType);
      onClose();
    } catch (err) {
      alert(err.message || "Ban uygulanamadı.");
    } finally {
      setBusy(false);
    }
  }
 
  const BAN_TYPES = [
    {
      value: "comment",
      label: "Yorum Banı",
      desc:  "Yorumları moderatör onayına düşer. İçerik paylaşımı serbest.",
      color: "var(--adm-orange)",
    },
    {
      value: "content",
      label: "İçerik Banı",
      desc:  "Bölüm/eser paylaşımları moderatör onayına düşer. Yorum serbest.",
      color: "#c8832a",
    },
    {
      value: "full",
      label: "Tam Ban",
      desc:  `Platforma erişim tamamen engellenir. Min. 50 şikayet gerekli. ${sikCount !== null ? `(Mevcut: ${sikCount})` : ""}`,
      color: "var(--adm-red)",
    },
  ];
 
  return (
    <div className="adm-modal-veil" onClick={onClose}>
      <div className="adm-modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="adm-modal-title">Ban Uygula</h3>
        <p className="adm-modal-sub">
          <strong style={{ color: "var(--adm-ink)" }}>{user.kullaniciAdi || user.email}</strong> — ban türünü seç
        </p>
 
        {/* Ban türü seçimi */}
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", marginBottom: "1rem" }}>
          {BAN_TYPES.map(bt => (
            <label
              key={bt.value}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: ".6rem",
                cursor: "pointer",
                padding: ".55rem .7rem",
                borderRadius: 5,
                border: `1px solid ${banType === bt.value ? bt.color : "var(--adm-border)"}`,
                background: banType === bt.value ? `${bt.color}10` : "transparent",
                transition: "all .15s",
              }}
            >
              <input
                type="radio"
                name="ban-type"
                value={bt.value}
                checked={banType === bt.value}
                onChange={() => setBanType(bt.value)}
                style={{ marginTop: 2, accentColor: bt.color, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: ".76rem", fontWeight: 500, color: bt.color }}>{bt.label}</div>
                <div style={{ fontSize: ".67rem", color: "var(--adm-ink-ghost)", marginTop: ".15rem", lineHeight: 1.5 }}>
                  {bt.desc}
                </div>
              </div>
            </label>
          ))}
        </div>
 
        {/* Sebep */}
        <div style={{ marginBottom: ".9rem" }}>
          <div style={{ fontSize: ".6rem", fontWeight: 600, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--adm-ink-ghost)", marginBottom: ".4rem" }}>
            Sebep *
          </div>
          <textarea
            className="adm-modal-textarea"
            placeholder="Ban sebebini yaz — kullanıcıya bildirim olarak iletilecek."
            value={reason}
            onChange={e => setReason(e.target.value)}
            autoFocus
          />
        </div>
 
        <div className="adm-modal-foot">
          <button className="adm-btn" onClick={onClose} disabled={busy}>Vazgeç</button>
          <button
            className="adm-btn adm-btn--ban"
            onClick={handleBan}
            disabled={busy || !reason.trim() || (banType === "full" && sikCount !== null && sikCount < 50)}
          >
            {busy ? "Uygulanıyor…" : "Ban Uygula"}
          </button>
        </div>
      </div>
    </div>
  );
}
/* ════════════════════════════════════════════════════════════
   ChapterContentModal
════════════════════════════════════════════════════════════ */
function ChapterContentModal({ item, onClose }) {
  useEffect(() => {
    const esc = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="adm-modal-veil" onClick={onClose}>
      <div className="adm-modal-box adm-modal-box--wide" onClick={e => e.stopPropagation()}
        style={{ maxHeight:"80vh", display:"flex", flexDirection:"column" }}>
        <div style={{ marginBottom:"1rem" }}>
          <h3 className="adm-modal-title">{item.title}</h3>
          <p className="adm-modal-sub">{item.work?.title} · {item.work?.user?.kullaniciAdi || item.work?.user?.email}</p>
          {item.reviewNote && (
            <div style={{ padding:".5rem .8rem", background:"rgba(200,131,42,.08)", border:"1px solid rgba(200,131,42,.2)", borderRadius:4, fontSize:".72rem", color:"var(--adm-orange)", marginTop:".5rem" }}>
              ⚠ AI Notu: {item.reviewNote}
            </div>
          )}
        </div>
        <div style={{ flex:1, overflowY:"auto", background:"var(--adm-surface3)", border:"1px solid var(--adm-border)", borderRadius:4, padding:"1rem 1.2rem", fontFamily:"'Cormorant Garamond',serif", fontSize:"1rem", lineHeight:1.8, color:"var(--adm-ink-dim)", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
          {item.content || <em style={{ color:"var(--adm-ink-ghost)" }}>İçerik yüklenemedi.</em>}
        </div>
        <div className="adm-modal-foot">
          <span style={{ fontSize:".68rem", color:"var(--adm-ink-ghost)" }}>
            {item.content?.trim() ? `${item.content.trim().split(/\s+/).length} kelime` : ""}
          </span>
          <button className="adm-btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}

function WarnModal({ reportId, targetName, onClose, onWarned }) {
  const [message, setMessage] = useState("");
  const [busy,    setBusy]    = useState(false);
 
  async function go() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await apiPost(`/admin/reports/${reportId}/warn`, { message: message.trim() });
      onWarned(reportId);
      onClose();
    } catch (err) {
      alert(err.message || "Uyarı gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }
 
  return (
    <div className="adm-modal-veil" onClick={onClose}>
      <div className="adm-modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="adm-modal-title">Uyarı Gönder</h3>
        <p className="adm-modal-sub">
          <strong style={{ color: "var(--adm-ink)" }}>{targetName}</strong> kullanıcısına
          gönderilecek. Şikayet otomatik kapatılır.
        </p>
        <textarea
          className="adm-modal-textarea"
          placeholder="Uyarı mesajı… (kullanıcıya bildirim olarak iletilir)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          autoFocus
        />
        <div className="adm-modal-foot">
          <button className="adm-btn" onClick={onClose} disabled={busy}>Vazgeç</button>
          <button className="adm-btn adm-btn--approve" onClick={go} disabled={!message.trim() || busy}>
            {busy ? "Gönderiliyor…" : "Uyarı Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ReportDetailModal — şikayet edeni + edileni tam göster
════════════════════════════════════════════════════════════ */
function ReportDetailModal({ report, onClose, onResolve, onDismiss, onCommentDeleted, onWarned }) {
  const navigate = useNavigate();
  const [busy,          setBusy]          = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [warnModal,     setWarnModal]     = useState(false);
  const isAdmin = true; // AdminPanel içinde her zaman admin
 
  const reporter  = report.reporter;
  const targetObj = report.targetObj;
  const isComment = report.targetType === "comment";
  const isUser    = report.targetType === "user";
  const isWork    = report.targetType === "work";
  const isChapter = report.targetType === "chapter";
 
  // Şikayet edilen yorum yazarının adı (warn için)
  const targetAuthorName = isComment
    ? (targetObj?.author?.kullaniciAdi || "Yazar")
    : isUser
      ? (targetObj?.kullaniciAdi || "Kullanıcı")
      : "";
 
  async function act(action) {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }
 
  async function handleDeleteComment() {
    setDeleting(true);
    try {
      await apiDelete(`/admin/reports/${report._id}/comment`);
      onCommentDeleted?.(report._id);
      onClose();
    } catch {
      alert("Yorum silinemedi.");
    } finally {
      setDeleting(false);
    }
  }
 
  return (
    <>
      <div className="adm-modal-veil" onClick={onClose}>
        <div className="adm-modal-box adm-modal-box--wide" style={{ maxHeight: "88vh", overflowY: "auto" }}
          onClick={e => e.stopPropagation()}>
 
          <h3 className="adm-modal-title">Şikayet Detayı</h3>
 
          {/* ── Meta bilgiler ── */}
          <div className="adm-rdetail-grid">
            <div className="adm-rdetail-section">
              <div className="adm-rdetail-label">Sebep</div>
              <span className="adm-badge adm-badge--orange">{REASON_LABELS[report.reason] || report.reason}</span>
            </div>
            <div className="adm-rdetail-section">
              <div className="adm-rdetail-label">Tür</div>
              <span className="adm-badge adm-badge--ghost">{TARGET_LABELS[report.targetType] || report.targetType}</span>
            </div>
            <div className="adm-rdetail-section">
              <div className="adm-rdetail-label">Tarih</div>
              <div className="adm-rdetail-val">{new Date(report.createdAt).toLocaleString("tr-TR")}</div>
            </div>
            <div className="adm-rdetail-section">
              <div className="adm-rdetail-label">Durum</div>
              <div>
                {report.status === "pending"   && <span className="adm-badge adm-badge--orange"><span className="adm-badge-dot"/>Bekliyor</span>}
                {report.status === "resolved"  && <span className="adm-badge adm-badge--green"><span className="adm-badge-dot"/>Çözüldü</span>}
                {report.status === "dismissed" && <span className="adm-badge adm-badge--ghost">Geçersiz</span>}
              </div>
            </div>
          </div>
 
          {report.description && (
            <div className="adm-rdetail-section" style={{ marginBottom: "1rem" }}>
              <div className="adm-rdetail-label">Şikayet Açıklaması</div>
              <div className="adm-report-desc">{report.description}</div>
            </div>
          )}
 
          {/* ── Taraflar ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
 
            {/* Şikayet eden */}
            <div style={{ background: "var(--adm-surface3)", border: "1px solid var(--adm-border)", borderRadius: 6, padding: ".9rem 1rem" }}>
              <div className="adm-rdetail-label" style={{ marginBottom: ".6rem" }}>Şikayet Eden</div>
              {reporter ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                    {reporter.avatarUrl
                      ? <img src={reporter.avatarUrl} className="adm-report-avatar" alt="" />
                      : <div className="adm-report-avatar-placeholder">{(reporter.kullaniciAdi || "?")[0].toUpperCase()}</div>
                    }
                    <div>
                      <div className="adm-report-name">{reporter.kullaniciAdi || "—"}</div>
                      <div className="adm-report-email">{reporter.email}</div>
                    </div>
                  </div>
                  <button className="adm-btn" style={{ marginTop: ".7rem", fontSize: ".63rem" }}
                    onClick={() => { navigate(`/profile/${reporter._id}`); onClose(); }}>
                    Profili Gör →
                  </button>
                </>
              ) : (
                <span style={{ fontSize: ".75rem", color: "var(--adm-ink-ghost)" }}>Silinmiş kullanıcı</span>
              )}
            </div>
 
            {/* Şikayet edilen */}
            <div style={{ background: "var(--adm-surface3)", border: "1px solid rgba(192,57,43,.15)", borderRadius: 6, padding: ".9rem 1rem" }}>
              <div className="adm-rdetail-label" style={{ marginBottom: ".6rem" }}>
                Şikayet Edilen — {TARGET_LABELS[report.targetType]}
              </div>
 
              {/* YORUM */}
              {isComment && (
                !targetObj ? (
                  <span style={{ fontSize: ".75rem", color: "var(--adm-ink-ghost)", fontStyle: "italic" }}>
                    {targetObj?.isDeleted ? "Bu yorum kaldırıldı." : "Yorum bulunamadı."}
                  </span>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".5rem" }}>
                      {targetObj.author?.avatarUrl
                        ? <img src={targetObj.author.avatarUrl} className="adm-report-avatar" alt="" />
                        : <div className="adm-report-avatar-placeholder">{(targetObj.author?.kullaniciAdi || "?")[0].toUpperCase()}</div>
                      }
                      <div>
                        <div className="adm-report-name">{targetObj.author?.kullaniciAdi || "—"}</div>
                        <div className="adm-report-email">{targetObj.author?.email || ""}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: ".68rem", color: "var(--adm-ink-ghost)", display: "flex", gap: ".4rem", flexWrap: "wrap", marginBottom: ".4rem" }}>
                      <span>📖</span>
                      <span style={{ color: "var(--adm-ink-dim)" }}>{targetObj.work?.title || "—"}</span>
                      {targetObj.chapter && (
                        <><span style={{ opacity: .4 }}>›</span>
                        <span style={{ color: "var(--adm-ink-dim)" }}>
                          {targetObj.chapter.title}{targetObj.chapter.order ? ` (Bölüm ${targetObj.chapter.order})` : ""}
                        </span></>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                      {targetObj.work?._id && (
                        <button className="adm-btn" style={{ fontSize: ".63rem" }}
                          onClick={() => window.open(`/story/${targetObj.work._id}`, "_blank")}>
                          Hikayeye Git ↗
                        </button>
                      )}
                      {targetObj.author?._id && (
                        <button className="adm-btn" style={{ fontSize: ".63rem" }}
                          onClick={() => { navigate(`/profile/${targetObj.author._id}`); onClose(); }}>
                          Profil →
                        </button>
                      )}
                    </div>
                  </>
                )
              )}
 
              {/* KULLANICI */}
              {isUser && targetObj && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                    {targetObj.avatarUrl
                      ? <img src={targetObj.avatarUrl} className="adm-report-avatar" alt="" />
                      : <div className="adm-report-avatar-placeholder">{(targetObj.kullaniciAdi || "?")[0].toUpperCase()}</div>
                    }
                    <div>
                      <div className="adm-report-name">{targetObj.kullaniciAdi || "—"}</div>
                      <div className="adm-report-email">{targetObj.email}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: ".4rem", display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
                    {targetObj.role === "banned"  && <span className="adm-badge adm-badge--red">Banlı</span>}
                    {targetObj.commentBanned      && <span className="adm-badge adm-badge--orange">Yorum Kısıtlı</span>}
                    {targetObj.contentBanned      && <span className="adm-badge adm-badge--red">İçerik Kısıtlı</span>}
                  </div>
                  <button className="adm-btn" style={{ marginTop: ".7rem", fontSize: ".63rem" }}
                    onClick={() => { navigate(`/profile/${targetObj._id}`); onClose(); }}>
                    Profili Gör →
                  </button>
                </>
              )}
 
              {/* ESER */}
              {isWork && targetObj && (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: ".6rem" }}>
                    {targetObj.coverImage
                      ? <img src={targetObj.coverImage} className="adm-report-work-cover" alt="" />
                      : <div className="adm-report-work-placeholder">{(targetObj.title || "?").slice(0, 2).toUpperCase()}</div>
                    }
                    <div>
                      <div className="adm-report-name">{targetObj.title}</div>
                      <div className="adm-report-email">{targetObj.user?.kullaniciAdi || targetObj.user?.email}</div>
                      <div style={{ marginTop: ".3rem" }}>
                        {targetObj.status === "published" && <span className="adm-badge adm-badge--green"><span className="adm-badge-dot"/>Yayında</span>}
                        {targetObj.status === "draft"     && <span className="adm-badge adm-badge--ghost">Taslak</span>}
                      </div>
                    </div>
                  </div>
                  <button className="adm-btn" style={{ marginTop: ".7rem", fontSize: ".63rem" }}
                    onClick={() => window.open(`/story/${targetObj._id}`, "_blank")}>
                    Eseri Aç ↗
                  </button>
                </>
              )}
 
              {/* BÖLÜM */}
              {isChapter && targetObj && (
                <>
                  <div>
                    <div className="adm-report-name">
                      {targetObj.title}{targetObj.order ? ` (Bölüm ${targetObj.order})` : ""}
                    </div>
                    <div className="adm-report-email">{targetObj.work?.title}</div>
                    <div className="adm-report-email">{targetObj.work?.user?.kullaniciAdi || targetObj.work?.user?.email}</div>
                  </div>
                  {targetObj.work?._id && (
                    <button className="adm-btn" style={{ marginTop: ".7rem", fontSize: ".63rem" }}
                      onClick={() => window.open(`/story/${targetObj.work._id}`, "_blank")}>
                      Esere Git ↗
                    </button>
                  )}
                </>
              )}

              {!targetObj && !isComment && (
                <span style={{ fontSize: ".75rem", color: "var(--adm-ink-ghost)" }}>İçerik bulunamadı</span>
              )}
            </div>
          </div>
 
          {/* ── Yorum metni (geniş, her zaman göster) ── */}
          {isComment && (
            <div style={{ marginBottom: "1rem" }}>
              <div className="adm-rdetail-label" style={{ marginBottom: ".5rem" }}>
                {targetObj?.isDeleted ? "Yorum Metni (Kaldırılmış)" : "Yorum Metni"}
              </div>
              {targetObj?.isDeleted ? (
                <div style={{ background: "rgba(184,50,50,.06)", border: "1px solid rgba(184,50,50,.2)", borderLeft: "2px solid var(--adm-red)", borderRadius: "0 4px 4px 0", padding: ".75rem 1rem", fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem", lineHeight: 1.7, color: "var(--adm-ink-dim)", wordBreak: "break-word" }}>
                  {targetObj.originalContent || "—"}
                  <div style={{ marginTop: ".5rem", fontSize: ".68rem", color: "var(--adm-ink-ghost)" }}>
                    Kaldırılma: {targetObj.deletedAt ? new Date(targetObj.deletedAt).toLocaleString("tr-TR") : "—"}
                    {targetObj.deletedBy && ` · ${targetObj.deletedBy.kullaniciAdi}`}
                  </div>
                </div>
              ) : targetObj?.content ? (
                <div style={{ background: "var(--adm-surface3)", border: "1px solid var(--adm-border)", borderLeft: "2px solid var(--adm-orange)", borderRadius: "0 4px 4px 0", padding: ".75rem 1rem", fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem", lineHeight: 1.7, color: "var(--adm-ink-dim)", wordBreak: "break-word" }}>
                  {targetObj.content}
                </div>
              ) : (
                <div style={{ fontSize: ".78rem", color: "var(--adm-ink-ghost)", fontStyle: "italic" }}>Yorum bulunamadı.</div>
              )}
            </div>
          )}
 
          {/* ── Silme onayı ── */}
          {deleteConfirm && (
            <div style={{ background: "rgba(184,50,50,.08)", border: "1px solid rgba(184,50,50,.2)", borderRadius: 5, padding: ".65rem .9rem", marginBottom: ".8rem", fontSize: ".76rem", color: "#e07060", display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
              <span style={{ flex: 1 }}>Yorum soft delete yapılacak — metin kayıt altında kalacak, yayından kalkacak.</span>
              <button className="adm-btn" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Vazgeç</button>
              <button className="adm-btn adm-btn--reject" onClick={handleDeleteComment} disabled={deleting}>
                {deleting ? "Siliniyor…" : "Evet, Kaldır"}
              </button>
            </div>
          )}
 
          {/* ── Aksiyon butonları ── */}
          {report.status === "pending" && (
            <div className="adm-modal-foot" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: ".5rem" }}>
              <button className="adm-btn" onClick={onClose} disabled={busy || deleting}>Kapat</button>
              <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                {/* Yorumu kaldır */}
                {isComment && targetObj && !targetObj.isDeleted && !deleteConfirm && (
                  <button className="adm-btn adm-btn--reject" disabled={busy}
                    onClick={() => setDeleteConfirm(true)}>
                    Yorumu Kaldır
                  </button>
                )}
                {/* Uyarı ver — sadece admin, comment veya user şikayetlerinde */}
                {isAdmin && (isComment || isUser) && !deleteConfirm && (
                  <button className="adm-btn adm-btn--feature" disabled={busy}
                    onClick={() => setWarnModal(true)}>
                    Uyarı Ver
                  </button>
                )}
                <button className="adm-btn" disabled={busy} onClick={() => act(onDismiss)}>
                  Geçersiz Say
                </button>
                <button className="adm-btn adm-btn--approve" disabled={busy} onClick={() => act(onResolve)}>
                  {busy ? "…" : "Çözüldü İşaretle"}
                </button>
              </div>
            </div>
          )}
          {report.status !== "pending" && (
            <div className="adm-modal-foot">
              <button className="adm-btn" onClick={onClose}>Kapat</button>
            </div>
          )}
        </div>
      </div>
 
      {/* Warn modal (admin only) */}
      {warnModal && (
        <WarnModal
          reportId={report._id}
          targetName={targetAuthorName}
          onClose={() => setWarnModal(false)}
          onWarned={(id) => {
            onWarned?.(id);
            onClose();
          }}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   STATS HOOK
════════════════════════════════════════════════════════════ */
function useStats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try { setStats(await adminGet("/stats")); }
    catch { /* sessiz */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  return { stats, loading, refetch: fetchStats };
}

/* ════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════ */
function Dashboard({ stats, loading, onNav }) {
  const [detail,  setDetail]  = useState(null);
  const [dLoading, setDL]     = useState(true);

  useEffect(() => {
    adminGet("/stats/detail").then(setDetail).catch(() => {}).finally(() => setDL(false));
  }, []);

  if (loading) return <Spinner />;
  if (!stats)  return <Empty msg="İstatistikler yüklenemedi." />;

  const k = stats.kullanicilar;
  const i = stats.icerik;
  const b = stats.bekleyen;
  const maxBegeni = Math.max(detail?.enCokBegenilenEserler?.[0]?.likeCount ?? 0, 1);

  return (
    <>
      <div className="adm-stat-grid">
        {[
          { label:"Toplam Kullanıcı", val:k.toplam,    sub:`+${k.son30Gun} son 30 gün` },
          { label:"Doğrulanmış",      val:k.dogrulanmis, sub:`${k.dogrulanmamis} bekliyor` },
          { label:"Toplam Eser",      val:i.toplamEser },
          { label:"Toplam Bölüm",     val:i.toplamBolum },
          { label:"Banlı Kullanıcı",  val:k.banlanan, danger:k.banlanan > 0 },
          { label:"Admin",            val:k.admin },
        ].map(c => (
          <div key={c.label} className={`adm-stat-card ${c.danger ? "adm-stat-card--danger" : ""}`}>
            <div className="adm-stat-label">{c.label}</div>
            <div className="adm-stat-value">{(c.val||0).toLocaleString("tr-TR")}</div>
            {c.sub && <div className="adm-stat-sub">{c.sub}</div>}
          </div>
        ))}
      </div>

      {(b.reviewQueue > 0 || b.sikayetler > 0) && (
        <div className="adm-pending-grid">
          {b.reviewQueue > 0 && (
            <div className="adm-pending-card" onClick={() => onNav("review")}>
              <div className="adm-pending-icon adm-pending-icon--orange">◎</div>
              <div className="adm-pending-info">
                <div className="adm-pending-count adm-pending-count--orange">{b.reviewQueue}</div>
                <div className="adm-pending-label">İnceleme bekleyen bölüm</div>
              </div>
              <span style={{ color:"var(--adm-ink-ghost)", fontSize:".8rem" }}>→</span>
            </div>
          )}
          {b.sikayetler > 0 && (
            <div className="adm-pending-card" onClick={() => onNav("reports")}>
              <div className="adm-pending-icon adm-pending-icon--red">⚑</div>
              <div className="adm-pending-info">
                <div className="adm-pending-count adm-pending-count--red">{b.sikayetler}</div>
                <div className="adm-pending-label">Bekleyen şikayet</div>
              </div>
              <span style={{ color:"var(--adm-ink-ghost)", fontSize:".8rem" }}>→</span>
            </div>
          )}
        </div>
      )}

      {b.reviewQueue === 0 && b.sikayetler === 0 && (
        <div style={{ padding:"1.5rem", background:"rgba(74,124,89,0.07)", border:"1px solid rgba(74,124,89,0.2)", borderRadius:6, marginBottom:"1.8rem" }}>
          <span style={{ fontSize:".78rem", color:"#4a7c59" }}>✓ Bekleyen aksiyon yok — her şey temiz.</span>
        </div>
      )}

      {!dLoading && detail && (
        <div className="adm-chart-grid">
          <div className="adm-chart-card">
            <div className="adm-chart-title">En Çok Beğenilen Eserler</div>
            {detail.enCokBegenilenEserler?.length === 0 ? <Empty msg="Veri yok." /> :
              detail.enCokBegenilenEserler?.map((e, idx) => (
                <div key={e._id} className="adm-bar-row">
                  <span className="adm-bar-label" title={e.title}>{idx+1}. {e.title}</span>
                  <div className="adm-bar-track">
                    <div className="adm-bar-fill" style={{ width:`${Math.round((e.likeCount/maxBegeni)*100)}%` }}/>
                  </div>
                  <span className="adm-bar-val">{e.likeCount}</span>
                </div>
              ))
            }
          </div>
          <div className="adm-chart-card">
            <div className="adm-chart-title">En Aktif Yazarlar</div>
            <div className="adm-top-list">
              {detail.aktifYazarlar?.length === 0 ? <Empty msg="Veri yok." /> :
                detail.aktifYazarlar?.map((a, idx) => (
                  <div key={a._id} className="adm-top-item">
                    <span className="adm-top-rank">{idx+1}</span>
                    <div className="adm-top-info">
                      <div className="adm-top-name">{a.user?.kullaniciAdi || a.user?.email || "—"}</div>
                    </div>
                    <span className="adm-top-val">{a.eserSayisi} eser</span>
                  </div>
                ))
              }
            </div>
          </div>
          <div className="adm-chart-card">
            <div className="adm-chart-title">Son 7 Gün — Yeni Kullanıcı</div>
            {detail.gunlukKayit?.length === 0 ? <Empty msg="Bu hafta kayıt yok." /> :
              detail.gunlukKayit?.map(g => {
                const max = Math.max(...detail.gunlukKayit.map(x => x.sayi), 1);
                return (
                  <div key={g._id} className="adm-bar-row">
                    <span className="adm-bar-label">{g._id.slice(5)}</span>
                    <div className="adm-bar-track">
                      <div className="adm-bar-fill" style={{ width:`${Math.round((g.sayi/max)*100)}%`, background:"var(--adm-green)" }}/>
                    </div>
                    <span className="adm-bar-val">{g.sayi}</span>
                  </div>
                );
              })
            }
          </div>
          <div className="adm-chart-card">
            <div className="adm-chart-title">Son 7 Gün — Yeni Yayın</div>
            {detail.gunlukYayin?.length === 0 ? <Empty msg="Bu hafta yayın yok." /> :
              detail.gunlukYayin?.map(g => {
                const max = Math.max(...detail.gunlukYayin.map(x => x.sayi), 1);
                return (
                  <div key={g._id} className="adm-bar-row">
                    <span className="adm-bar-label">{g._id.slice(5)}</span>
                    <div className="adm-bar-track">
                      <div className="adm-bar-fill" style={{ width:`${Math.round((g.sayi/max)*100)}%`, background:"var(--adm-orange)" }}/>
                    </div>
                    <span className="adm-bar-val">{g.sayi}</span>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   REVIEW QUEUE
════════════════════════════════════════════════════════════ */
function ReviewQueue({ onRefresh }) {
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(1);
  const [meta,         setMeta]         = useState({});
  const [rejectModal,  setRejectModal]  = useState(null);
  const [contentModal, setContentModal] = useState(null);
  const [busy,         setBusy]         = useState({});

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await adminGet(`/review-queue?sayfa=${p}&limit=15`);
      setItems(res.bolumler || []); setMeta(res.meta || {}); setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  async function approve(id) {
    setBusy(b => ({ ...b, [id]:true }));
    try { await adminPut(`/review/${id}/approve`); setItems(p => p.filter(i => i._id !== id)); onRefresh(); }
    catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [id]:false })); }
  }

  async function reject(id, note) {
    setBusy(b => ({ ...b, [id]:true }));
    try { await adminPut(`/review/${id}/reject`, { reviewNote:note }); setItems(p => p.filter(i => i._id !== id)); setRejectModal(null); onRefresh(); }
    catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [id]:false })); }
  }

  const closeContent = useCallback(() => setContentModal(null), []);

  return (
    <>
      <div className="adm-section-head">
        <h2 className="adm-section-title">İnceleme Kuyruğu</h2>
        <span className="adm-section-meta">{meta.toplam||0} bekliyor</span>
      </div>

      {loading ? <Spinner /> : items.length === 0 ? <Empty msg="Bekleyen bölüm yok. ✓" /> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr>
              <th>Bölüm</th><th>Hikaye</th><th>Yazar</th><th>Tarih</th><th>İşlem</th>
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item._id}>
                  <td>
                    <div className="adm-td-main">{item.title}</div>
                    {item.reviewNote && <div className="adm-td-sub" style={{ color:"var(--adm-orange)" }}>AI: {item.reviewNote}</div>}
                  </td>
                  <td>{item.work?.title || "—"}</td>
                  <td>
                    <div className="adm-td-main">{item.work?.user?.kullaniciAdi || "—"}</div>
                    <div className="adm-td-sub">{item.work?.user?.email}</div>
                  </td>
                  <td>{new Date(item.createdAt).toLocaleDateString("tr-TR")}</td>
                  <td>
                    <div className="adm-btn-row">
                      <button className="adm-btn" onClick={() => setContentModal(item)}>İçeriği Gör</button>
                      <button className="adm-btn adm-btn--approve" disabled={busy[item._id]} onClick={() => approve(item._id)}>
                        {busy[item._id] ? "…" : "Onayla"}
                      </button>
                      <button className="adm-btn adm-btn--reject" disabled={busy[item._id]} onClick={() => setRejectModal({ id:item._id, title:item.title })}>
                        Reddet
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} total={meta.toplamSayfa||1} onPage={load} />
      {rejectModal && <RejectModal title={rejectModal.title} onConfirm={note => reject(rejectModal.id, note)} onClose={() => setRejectModal(null)} />}
      {contentModal && <ChapterContentModal item={contentModal} onClose={closeContent} />}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   TargetSummary — modül seviyesi (Reports + diğer bileşenler)
════════════════════════════════════════════════════════════ */
function TargetSummary({ item }) {
    const obj = item.targetObj;
    if (!obj) return <span style={{ color: "var(--adm-ink-ghost)", fontSize: ".7rem" }}>Silinmiş</span>;
 
    if (item.targetType === "comment") {
      const isDeleted = obj.isDeleted;
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
            {obj.author?.avatarUrl
              ? <img src={obj.author.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--adm-surface3)", border: "1px solid var(--adm-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".55rem", color: "var(--adm-ink-ghost)" }}>
                  {(obj.author?.kullaniciAdi || "?")[0].toUpperCase()}
                </div>
            }
            <span className="adm-td-main" style={{ fontSize: ".75rem" }}>{obj.author?.kullaniciAdi || "—"}</span>
            {isDeleted && <span className="adm-badge adm-badge--red" style={{ fontSize: ".55rem" }}>Kaldırıldı</span>}
          </div>
          <div style={{ fontSize: ".65rem", color: "var(--adm-ink-ghost)", marginTop: "2px" }}>
            {obj.work?.title || "—"}
          </div>
        </div>
      );
    }
 
    if (item.targetType === "user") return (
      <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
        {obj.avatarUrl
          ? <img src={obj.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
          : <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--adm-surface3)", border: "1px solid var(--adm-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".55rem", color: "var(--adm-ink-ghost)" }}>{(obj.kullaniciAdi||"?")[0].toUpperCase()}</div>
        }
        <div>
          <div className="adm-td-main" style={{ fontSize: ".75rem" }}>{obj.kullaniciAdi||"—"}</div>
          <div className="adm-td-sub">{obj.email}</div>
        </div>
      </div>
    );
 
    if (item.targetType === "work") return (
      <div>
        <div className="adm-td-main" style={{ fontSize: ".75rem" }}>{obj.title}</div>
        <div className="adm-td-sub">{obj.user?.kullaniciAdi || obj.user?.email}</div>
      </div>
    );
 
    return <span className="adm-td-main" style={{ fontSize: ".75rem" }}>#{String(item.targetId).slice(-6)}</span>;
}

/* ════════════════════════════════════════════════════════════
   ŞİKAYETLER  ←  Ana yenilenen bileşen
════════════════════════════════════════════════════════════ */
function Reports({ onRefresh }) {
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [page,         setPage]         = useState(1);
  const [meta,         setMeta]         = useState({});
  const [busy,         setBusy]         = useState({});
  const [detail,       setDetail]       = useState(null);

  const load = useCallback(async (p = 1, sf = "pending", tf = "all") => {
    setLoading(true);
    try {
      const res = await apiGet(`/admin/reports?sayfa=${p}&limit=15&status=${sf}&targetType=${tf}`);
      setItems(res.sikayetler || []); setMeta(res.meta || {}); setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1, statusFilter, typeFilter); }, [statusFilter, typeFilter]);

  async function act(id, action) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await apiPut(`/admin/reports/${id}/${action}`);
      setItems(prev => prev.map(i =>
        i._id === id ? { ...i, status: action === "resolve" ? "resolved" : "dismissed" } : i
      ));
      setDetail(null);
      onRefresh();
    } catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  return (
    <>
      <div className="adm-section-head">
        <h2 className="adm-section-title">Şikayetler</h2>
        <span className="adm-section-meta">{meta.toplam || 0} kayıt</span>
      </div>
 
      <div className="adm-search-row">
        <select className="adm-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="pending">Bekleyen</option>
          <option value="resolved">Çözüldü</option>
          <option value="dismissed">Geçersiz</option>
          <option value="all">Tümü</option>
        </select>
        <select className="adm-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Tüm Türler</option>
          <option value="comment">Yorum</option>
          <option value="user">Kullanıcı</option>
          <option value="work">Eser</option>
          <option value="chapter">Bölüm</option>
        </select>
      </div>
 
      {loading ? <Spinner /> : items.length === 0 ? <Empty msg="Şikayet bulunamadı." /> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr>
              <th>Şikayet Eden</th><th>Şikayet Edilen</th>
              <th>Tür</th><th>Sebep</th><th>Durum</th><th>Tarih</th><th>İşlem</th>
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
                      {item.reporter?.avatarUrl
                        ? <img src={item.reporter.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                        : <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--adm-surface3)", border: "1px solid var(--adm-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".55rem", color: "var(--adm-ink-ghost)" }}>
                            {(item.reporter?.kullaniciAdi||"?")[0].toUpperCase()}
                          </div>
                      }
                      <div>
                        <div className="adm-td-main" style={{ fontSize: ".75rem" }}>{item.reporter?.kullaniciAdi || "—"}</div>
                        <div className="adm-td-sub">{item.reporter?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><TargetSummary item={item} /></td>
                  <td><span className="adm-badge adm-badge--ghost">{TARGET_LABELS[item.targetType] || item.targetType}</span></td>
                  <td><span className="adm-badge adm-badge--orange">{REASON_LABELS[item.reason] || item.reason}</span></td>
                  <td>
                    {item.status === "pending"   && <span className="adm-badge adm-badge--orange"><span className="adm-badge-dot"/>Bekliyor</span>}
                    {item.status === "resolved"  && <span className="adm-badge adm-badge--green"><span className="adm-badge-dot"/>Çözüldü</span>}
                    {item.status === "dismissed" && <span className="adm-badge adm-badge--ghost">Geçersiz</span>}
                  </td>
                  <td>{new Date(item.createdAt).toLocaleDateString("tr-TR")}</td>
                  <td>
                    <div className="adm-btn-row">
                      <button className="adm-btn" onClick={() => setDetail(item)}>Detay</button>
                      {item.status === "pending" && (
                        <>
                          <button className="adm-btn adm-btn--approve" disabled={busy[item._id]}
                            onClick={() => act(item._id, "resolve")}>
                            {busy[item._id] ? "…" : "Çözüldü"}
                          </button>
                          <button className="adm-btn" disabled={busy[item._id]}
                            onClick={() => act(item._id, "dismiss")}>
                            Geçersiz
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
 
      <Pager page={page} total={meta.toplamSayfa || 1} onPage={p => load(p, statusFilter, typeFilter)} />
 
      {detail && (
        <ReportDetailModal
          report={detail}
          onClose={() => setDetail(null)}
          onResolve={() => act(detail._id, "resolve")}
          onDismiss={() => act(detail._id, "dismiss")}
          onCommentDeleted={(reportId) => {
            setItems(prev => prev.filter(i => i._id !== reportId));
            setDetail(null);
            onRefresh();
          }}
          onWarned={(reportId) => {
            setItems(prev => prev.map(i =>
              i._id === reportId ? { ...i, status: "resolved" } : i
            ));
            onRefresh();
          }}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   HİKAYE YÖNETİMİ
════════════════════════════════════════════════════════════ */
function Stories() {
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [query,        setQuery]        = useState("");
  const [page,         setPage]         = useState(1);
  const [meta,         setMeta]         = useState({});
  const [busy,         setBusy]         = useState({});
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async (p = 1, q = "", s = "all") => {
    setLoading(true);
    try {
      const params = `?sayfa=${p}&limit=20&status=${s}${q ? `&ara=${encodeURIComponent(q)}` : ""}`;
      const r = await adminGet(`/stories${params}`);
      setItems(r.eserler||[]); setMeta(r.meta||{}); setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1, query, statusFilter); }, [query, statusFilter]);

  async function feature(id, featured) {
    setBusy(b => ({ ...b, [id]:true }));
    try { await adminPut(`/stories/${id}/feature`, { featured }); setItems(prev => prev.map(i => i._id===id ? {...i,featured} : i)); }
    catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [id]:false })); }
  }

  async function unpublish(id, title) {
    if (!window.confirm(`"${title}" yayından kaldırılacak. Emin misin?`)) return;
    setBusy(b => ({ ...b, [id]:true }));
    try { await adminPut(`/stories/${id}/unpublish`); setItems(prev => prev.map(i => i._id===id ? {...i,status:"draft"} : i)); }
    catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [id]:false })); }
  }

  async function deleteStory(id, title) {
    if (!window.confirm(`"${title}" kalıcı olarak silinecek!`)) return;
    setBusy(b => ({ ...b, [id]:true }));
    try { await adminDelete(`/works/${id}`); setItems(prev => prev.filter(i => i._id!==id)); }
    catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [id]:false })); }
  }

  return (
    <>
      <div className="adm-section-head">
        <h2 className="adm-section-title">Hikaye Yönetimi</h2>
        <span className="adm-section-meta">{meta.toplam||0} eser</span>
      </div>
      <form className="adm-search-row" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); }}>
        <input className="adm-search" placeholder="Hikaye başlığı ara…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="adm-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Tümü</option>
          <option value="published">Yayında</option>
          <option value="draft">Taslak</option>
          <option value="pending_review">İncelemede</option>
          <option value="archived">Arşiv</option>
          <option value="rejected">Reddedildi</option>
        </select>
        <button type="submit" className="adm-btn">Ara</button>
        {query && <button type="button" className="adm-btn" onClick={() => { setSearch(""); setQuery(""); }}>Temizle</button>}
      </form>

      {loading ? <Spinner /> : items.length === 0 ? <Empty /> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr>
              <th>Başlık</th><th>Yazar</th><th>Durum</th>
              <th>Bölüm</th><th>Beğeni</th><th>Tarih</th><th>İşlem</th>
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item._id}>
                  <td>
                    <div className="adm-td-main">{item.title}</div>
                    {item.featured && <span className="adm-badge adm-badge--featured" style={{ marginTop:3 }}>Öne Çıkan</span>}
                  </td>
                  <td>
                    <div className="adm-td-main">{item.user?.kullaniciAdi||"—"}</div>
                    <div className="adm-td-sub">{item.user?.email}</div>
                  </td>
                  <td>
                    {item.status==="published"      && <span className="adm-badge adm-badge--green"><span className="adm-badge-dot"/>Yayında</span>}
                    {item.status==="draft"          && <span className="adm-badge adm-badge--ghost">Taslak</span>}
                    {item.status==="archived"       && <span className="adm-badge adm-badge--ghost">Arşiv</span>}
                    {item.status==="pending_review" && <span className="adm-badge adm-badge--orange"><span className="adm-badge-dot"/>İncelemede</span>}
                    {item.status==="rejected"       && <span className="adm-badge adm-badge--red">Reddedildi</span>}
                  </td>
                  <td>{item.bolumSayisi}</td>
                  <td>{item.likeCount||0}</td>
                  <td>{new Date(item.createdAt).toLocaleDateString("tr-TR")}</td>
                  <td>
                    <div className="adm-btn-row">
                      <button className="adm-btn adm-btn--feature" disabled={busy[item._id]} onClick={() => feature(item._id, !item.featured)}>
                        {item.featured ? "Öne Çıkarmayı Kaldır" : "Öne Çıkar"}
                      </button>
                      {item.status==="published" && (
                        <button className="adm-btn" disabled={busy[item._id]} onClick={() => unpublish(item._id, item.title)}>
                          Yayından Kaldır
                        </button>
                      )}
                      <button className="adm-btn adm-btn--reject" disabled={busy[item._id]} onClick={() => deleteStory(item._id, item.title)}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={meta.toplamSayfa||1} onPage={p => load(p, query, statusFilter)} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   KULLANICI YÖNETİMİ
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   KULLANICI YÖNETİMİ — güncellenmiş versiyon
════════════════════════════════════════════════════════════ */
function Users() {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [query,    setQuery]    = useState("");
  const [page,     setPage]     = useState(1);
  const [meta,     setMeta]     = useState({});
  const [busy,     setBusy]     = useState({});
  const [banModal, setBanModal] = useState(null); // { user }
 
  const load = useCallback(async (p = 1, q = "") => {
    setLoading(true);
    try {
      const params = `?sayfa=${p}&limit=20${q ? `&ara=${encodeURIComponent(q)}` : ""}`;
      const res = await adminGet(`/users${params}`);
      setItems(res.kullanicilar || []); setMeta(res.meta || {}); setPage(p);
    } catch {} finally { setLoading(false); }
  }, []);
 
  useEffect(() => { load(1, query); }, [query]);
 
  async function changeRole(id, rol) {
    if (!window.confirm(`Rol değiştirilecek: ${rol}. Emin misin?`)) return;
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await adminPatch(`/users/${id}/rol`, { rol });
      setItems(prev => prev.map(u => u._id === id ? { ...u, role: rol } : u));
    } catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }
 
  async function unban(id, type) {
    setBusy(b => ({ ...b, [`${id}_unban`]: true }));
    try {
      await adminPatch(`/users/${id}/unban`, { type });
      setItems(prev => prev.map(u => {
        if (u._id !== id) return u;
        const updates = {};
        if (type === "comment") updates.commentBanned = false;
        if (type === "content") updates.contentBanned = false;
        if (type === "full") { updates.role = "user"; updates.commentBanned = false; updates.contentBanned = false; }
        return { ...u, ...updates };
      }));
    } catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [`${id}_unban`]: false })); }
  }
 
  async function deleteUser(id, name) {
    if (!window.confirm(`"${name}" silinecek. Bu işlem geri alınamaz!`)) return;
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await adminDelete(`/users/${id}`);
      setItems(prev => prev.filter(u => u._id !== id));
    } catch (err) { alert(err.message); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }
 
  // Ban modal kapandığında state'i güncelle
  function handleBanned(userId, banType) {
    setItems(prev => prev.map(u => {
      if (u._id !== userId) return u;
      if (banType === "comment") return { ...u, commentBanned: true };
      if (banType === "content") return { ...u, contentBanned: true };
      if (banType === "full")    return { ...u, role: "banned", commentBanned: true, contentBanned: true };
      return u;
    }));
  }
 
  return (
    <>
      <div className="adm-section-head">
        <h2 className="adm-section-title">Kullanıcılar</h2>
        <span className="adm-section-meta">{meta.toplam || 0} kullanıcı</span>
      </div>
 
      <form className="adm-search-row" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); }}>
        <input
          className="adm-search"
          placeholder="Kullanıcı adı veya e-posta ara…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="submit" className="adm-btn">Ara</button>
        {query && <button type="button" className="adm-btn" onClick={() => { setSearch(""); setQuery(""); }}>Temizle</button>}
      </form>
 
      {loading ? <Spinner /> : items.length === 0 ? <Empty msg="Kullanıcı bulunamadı." /> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>Kısıtlamalar</th>
                <th>Kayıt</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map(u => (
                <tr key={u._id}>
                  <td>
                    <div className="adm-td-main">{u.kullaniciAdi || "—"}</div>
                    <div className="adm-td-sub">{u.email}</div>
                  </td>
                  <td>
                    {u.role === "admin"     && <span className="adm-badge adm-badge--gold">Admin</span>}
                    {u.role === "moderator" && <span className="adm-badge" style={{ color:"#3a8080", background:"rgba(58,128,128,.1)", border:"1px solid rgba(58,128,128,.25)" }}>Moderatör</span>}
                    {u.role === "user"      && <span className="adm-badge adm-badge--ghost">Kullanıcı</span>}
                    {u.role === "banned"    && <span className="adm-badge adm-badge--red">Tam Ban</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
                      {u.commentBanned && (
                        <div style={{ display: "flex", alignItems: "center", gap: ".3rem" }}>
                          <span className="adm-badge adm-badge--orange" style={{ fontSize: ".55rem" }}>Yorum Kısıtlı</span>
                          <button
                            className="adm-btn"
                            style={{ fontSize: ".55rem", padding: ".1rem .4rem" }}
                            disabled={busy[`${u._id}_unban`]}
                            onClick={() => unban(u._id, "comment")}
                            title="Yorum kısıtlamasını kaldır"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {u.contentBanned && (
                        <div style={{ display: "flex", alignItems: "center", gap: ".3rem" }}>
                          <span className="adm-badge adm-badge--red" style={{ fontSize: ".55rem" }}>İçerik Kısıtlı</span>
                          <button
                            className="adm-btn"
                            style={{ fontSize: ".55rem", padding: ".1rem .4rem" }}
                            disabled={busy[`${u._id}_unban`]}
                            onClick={() => unban(u._id, "content")}
                            title="İçerik kısıtlamasını kaldır"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {!u.commentBanned && !u.contentBanned && u.role !== "banned" && (
                        <span style={{ fontSize: ".65rem", color: "var(--adm-ink-ghost)", fontStyle: "italic" }}>—</span>
                      )}
                    </div>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString("tr-TR")}</td>
                  <td>
                    {u.emailVerified
                      ? <span className="adm-badge adm-badge--green">Doğrulandı</span>
                      : <span className="adm-badge adm-badge--ghost">Doğrulanmadı</span>}
                  </td>
                  <td>
                    <div className="adm-btn-row">
                      {/* Ban butonu — tam ban değilse göster */}
                      {u.role !== "banned" && u.role !== "admin" && (
                        <button
                          className="adm-btn adm-btn--ban"
                          disabled={busy[u._id]}
                          onClick={() => setBanModal({ user: u })}
                        >
                          Ban
                        </button>
                      )}
                      {/* Tam ban kaldır */}
                      {u.role === "banned" && (
                        <button
                          className="adm-btn adm-btn--unban"
                          disabled={busy[`${u._id}_unban`]}
                          onClick={() => unban(u._id, "full")}
                        >
                          Ban Kaldır
                        </button>
                      )}
                      {/* Rol değiştir */}
                      {u.role === "user" && (
                        <button className="adm-btn" disabled={busy[u._id]} onClick={() => changeRole(u._id, "moderator")}>
                          Moderatör Yap
                        </button>
                      )}
                      {u.role === "user" && (
                        <button className="adm-btn" disabled={busy[u._id]} onClick={() => changeRole(u._id, "admin")}>
                          Admin Yap
                        </button>
                      )}
                      {u.role === "moderator" && (
                        <button className="adm-btn" disabled={busy[u._id]} onClick={() => changeRole(u._id, "user")}>
                          Moderatörden Çıkar
                        </button>
                      )}
                      {u.role === "admin" && (
                        <button className="adm-btn" disabled={busy[u._id]} onClick={() => changeRole(u._id, "user")}>
                          Admin'den Çıkar
                        </button>
                      )}
                      {/* Sil */}
                      <button
                        className="adm-btn adm-btn--reject"
                        disabled={busy[u._id]}
                        onClick={() => deleteUser(u._id, u.kullaniciAdi || u.email)}
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
 
      <Pager page={page} total={meta.toplamSayfa || 1} onPage={p => load(p, query)} />
 
      {banModal && (
        <BanModal
          user={banModal.user}
          onClose={() => setBanModal(null)}
          onBanned={handleBanned}
        />
      )}
    </>
  );
}
/* ════════════════════════════════════════════════════════════
   ANA PANEL
════════════════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { id:"dashboard", icon:"◈", label:"Dashboard",        section:"Genel" },
  { id:"review",    icon:"◎", label:"İnceleme Kuyruğu", section:"Moderasyon", badgeKey:"reviewQueue", badgeColor:"orange" },
  { id:"reports",   icon:"⚑", label:"Şikayetler",       section:"Moderasyon", badgeKey:"sikayetler",  badgeColor:"red" },
  { id:"stories",   icon:"◉", label:"Hikayeler",        section:"İçerik" },
  { id:"users",     icon:"👥", label:"Kullanıcılar",     section:"Yönetim" },
];

export default function AdminPanel() {
  const navigate = useNavigate();
  const [page, setPage] = useState("dashboard");
  const { stats, loading: statsLoading, refetch: refetchStats } = useStats();

  useEffect(() => {
    const id = "adm-styles-v4";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id; tag.textContent = CSS;
      document.head.appendChild(tag);
    }
  }, []);

  const bekleyen = stats?.bekleyen || {};
  const sections = [...new Set(NAV_ITEMS.map(n => n.section))];

  const pageTitle = {
    dashboard:"Dashboard", review:"İnceleme Kuyruğu",
    reports:"Şikayetler",  stories:"Hikaye Yönetimi", users:"Kullanıcılar",
  }[page];

  return (
    <div className="adm-root">
      <aside className="adm-sidebar">
        <div className="adm-logo">
          <span className="adm-logo-eyebrow">ACB Atölyesi</span>
          <span className="adm-logo-title">Yönetim Paneli</span>
        </div>
        <nav className="adm-nav">
          {sections.map(section => (
            <div key={section} className="adm-nav-section">
              <span className="adm-nav-label">{section}</span>
              {NAV_ITEMS.filter(n => n.section === section).map(item => {
                const badge = item.badgeKey ? bekleyen[item.badgeKey] : 0;
                return (
                  <button
                    key={item.id}
                    className={`adm-nav-item ${page===item.id ? "adm-nav-item--active" : ""}`}
                    onClick={() => setPage(item.id)}
                  >
                    <span style={{ fontSize:".9rem", opacity:.7 }}>{item.icon}</span>
                    {item.label}
                    {badge > 0 && (
                      <span className={`adm-nav-badge ${item.badgeColor==="orange" ? "adm-nav-badge--orange" : ""}`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="adm-sidebar-foot">
          <button className="adm-back-btn" onClick={() => navigate("/studio")}>← Atölyeye Dön</button>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-topbar">
          <h1 className="adm-page-title">{pageTitle}</h1>
          <span className="adm-topbar-meta">
            {new Date().toLocaleDateString("tr-TR", { weekday:"long", day:"numeric", month:"long" })}
          </span>
        </div>
        <div className="adm-content">
          {page==="dashboard" && <Dashboard stats={stats} loading={statsLoading} onNav={setPage} />}
          {page==="review"    && <ReviewQueue onRefresh={refetchStats} />}
          {page==="reports"   && <Reports onRefresh={refetchStats} />}
          {page==="stories"   && <Stories />}
          {page==="users"     && <Users />}
        </div>
      </main>
    </div>
  );
}