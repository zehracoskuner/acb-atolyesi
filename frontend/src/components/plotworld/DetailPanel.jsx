// components/plotworld/DetailPanel.jsx
// Fix: ACT_META artık prop olarak geliyor — dinamik perde yapısıyla uyumlu.
// PlotWorldPage'de <DetailPanel actMeta={actMeta} ... /> olarak çağır.

import { useState }      from "react";
import { useNavigate }   from "react-router-dom";
import { STATUS_META }   from "./constants";
import ConfirmDialog     from "./ConfirmDialog";

export default function DetailPanel({
  node,
  counts,
  actMeta = {},
  onClose,
  onConnect,
  onEdit,
  onDelete,
  onButterfly,
  workId,
}) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);

  const status  = STATUS_META[node.data.status] || STATUS_META.idea;
  const actInfo = actMeta[node.data.act] || { label: node.data.act || "—", color: "#888" };

  /* Karakter listesi */
  const chars = node.data.chars || [];

  return (
    <div className="pw-detail" role="complementary" aria-label="Sahne detayı">

      {/* Perde renk şeridi */}
      <div
        className="pw-detail-stripe"
        style={{ background: actInfo.color }}
        aria-hidden="true"
      />

      <div className="pw-detail-inner">

        {/* ── Üst ── */}
        <div className="pw-detail-top">
          <span
            className="pw-detail-act-badge"
            style={{
              color:       actInfo.color,
              background:  actInfo.color + "14",
              borderColor: actInfo.color + "40",
            }}
          >
            {actInfo.roman ? `${actInfo.roman}. Perde — ` : ""}{actInfo.label}
          </span>
          <button
            className="pw-detail-close"
            onClick={onClose}
            aria-label="Paneli kapat"
          >
            ×
          </button>
        </div>

        {/* Başlık */}
        <div className="pw-detail-title">{node.data.label}</div>

        <div className="pw-divider" aria-hidden="true" />

        {/* Açıklama */}
        {node.data.desc && (
          <div className="pw-detail-section">
            <div className="pw-detail-label">Açıklama</div>
            <div className="pw-detail-value">{node.data.desc}</div>
          </div>
        )}

        {/* Amaç */}
        {node.data.goal && (
          <div className="pw-detail-section">
            <div className="pw-detail-label">Sahne Amacı</div>
            <div className="pw-detail-value pw-detail-goal">
              <span aria-hidden="true">◎</span> {node.data.goal}
            </div>
          </div>
        )}

        {/* Karakterler */}
        {chars.length > 0 && (
          <div className="pw-detail-section">
            <div className="pw-detail-label">Karakterler</div>
            <div className="pw-detail-chips" role="list">
              {chars.map(c => (
                <span key={c} className="pw-detail-chip" role="listitem">{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Durum + Bağlantılar */}
        <div className="pw-detail-row">
          <div className="pw-detail-section">
            <div className="pw-detail-label">Durum</div>
            <div className="pw-detail-value pw-detail-status">
              <span
                className="pw-status-dot"
                style={{ background: status.color }}
                aria-hidden="true"
              />
              {status.label}
            </div>
          </div>
          <div className="pw-detail-section">
            <div className="pw-detail-label">Bağlantılar</div>
            <div className="pw-detail-value">
              <span aria-label={`${counts.out} çıkan bağlantı`}>→ {counts.out}</span>
              {" · "}
              <span aria-label={`${counts.in} giren bağlantı`}>← {counts.in}</span>
            </div>
          </div>
        </div>

        {/* AI davet kartı */}
        <div className="pw-ai-card" aria-label="AI önerileri">
          <div className="pw-ai-header">
            <span className="pw-ai-icon" aria-hidden="true">✦</span>
            <span className="pw-ai-label">Kelebek Etkisi</span>
          </div>
          <div className="pw-ai-text">
            Bu sahne farklı bitseydi hikâye nereye giderdi?
            Karakter kararları ve duygusal ton nasıl değişirdi?
          </div>
        </div>

        {/* Aksiyonlar */}
        <div className="pw-detail-actions">
          <button
            className="pw-btn pw-btn--detail"
            onClick={() => navigate(`/work/${workId}/scene/${node.id}`)}
            aria-label="Sahne detay sayfasına git"
          >
            📄 Sahne Detayı →
          </button>
          <button
            className="pw-btn pw-btn--ghost"
            onClick={onConnect}
          >
            ⇢ Bağlantı Ekle
          </button>
          <button
            className="pw-btn pw-btn--ghost"
            onClick={onEdit}
          >
            ✎ Düzenle
          </button>
          <button
            className="pw-btn pw-btn--ai"
            onClick={onButterfly}
          >
            🦋 Kelebek Etkisi
          </button>
          <button
            className="pw-btn pw-btn--danger-ghost"
            onClick={() => setConfirm(true)}
          >
            Sahneyi Sil
          </button>
        </div>

      </div>

      {/* Silme onayı */}
      {confirm && (
        <ConfirmDialog
          message="Bu sahneyi ve tüm bağlantılarını silmek istediğinden emin misin?"
          onConfirm={() => { setConfirm(false); onDelete(); }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}