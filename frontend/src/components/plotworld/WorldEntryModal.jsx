// src/components/plotworld/WorldEntryModal.jsx
import { useState } from "react";
import "./WorldEntryModal.css"; // CSS dosyamızı bağladık

export default function WorldEntryModal({ category, onClose, onSave, saving }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const isRule = category === "rules";

  const handleSubmit = () => {
  if (!name.trim()) return;
  onSave({ category, name, description });
};

  return (
    <div className="pww-modal-backdrop" onClick={onClose}>
      <div className="pww-modal-content" onClick={e => e.stopPropagation()}>
        <div className="pww-modal-header">
          <h2>Yeni {isRule ? "Evren Kuralı" : "Not"} Ekle</h2>
          <button className="pww-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="pww-modal-body">
          <div className="pww-form-group">
            <label>Başlık *</label>
            <input 
              autoFocus
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={isRule ? "Örn: Işık hızında seyahat, Toplum hiyerarşisi..." : "Örn: 2. Perde için alternatif son"}
              required
            />
          </div>
          <div className="pww-form-group">
            <label>Açıklama (İsteğe bağlı)</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder={isRule ? "Bu kuralın detayları neler?" : "Aklındaki fikirleri buraya dök..."}
              rows={5}
            />
          </div>
          <div className="pww-modal-actions">
            <button type="button" onClick={onClose} className="pww-btn-ghost" disabled={saving}>
              İptal
            </button>
            <button type="button" onClick={handleSubmit}className="pww-btn-primary" disabled={saving || !name.trim()}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}