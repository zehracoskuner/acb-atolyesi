export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="pw-confirm-overlay" onClick={onCancel}>
      <div className="pw-confirm" onClick={e => e.stopPropagation()}>
        <p className="pw-confirm-msg">{message}</p>
        <div className="pw-confirm-actions">
          <button className="pw-btn pw-btn--ghost"  onClick={onCancel}>Vazgeç</button>
          <button className="pw-btn pw-btn--danger" onClick={onConfirm}>Sil</button>
        </div>
      </div>
    </div>
  );
}