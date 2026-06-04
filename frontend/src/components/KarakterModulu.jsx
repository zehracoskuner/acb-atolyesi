// src/components/KarakterModulu.jsx
import React, { useState } from 'react';

export default function KarakterModulu({ karakterler, setKurguVerisi }) {
  const [yeniKarakterAdi, setYeniKarakterAdi] = useState('');

  const handleAddCharacter = () => {
    const ad = yeniKarakterAdi.trim();
    if (!ad) return;

    const yeniKarakter = {
      id: crypto.randomUUID(),
      ad: ad,
      kusurlar: "Henüz tanımlanmadı",
      motivasyon: "Henüz tanımlanmadı",
    };

    setKurguVerisi(prev => ({
      ...prev,
      karakterler: [...prev.karakterler, yeniKarakter],
    }));
    setYeniKarakterAdi('');
  };

  const handleRemoveCharacter = (id) => {
    setKurguVerisi(prev => ({
      ...prev,
      karakterler: prev.karakterler.filter(k => k.id !== id),
    }));
  };

  return (
    <div className="kurgu-modulu">
      <h4>Karakterler</h4>
      <p className="muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 12 }}>
        Hikayenizin kahramanlarını ve kötülerini burada yönetin.
      </p>

      <div className="karakter-listesi">
        {karakterler.length === 0 && <div className="muted">Henüz karakter eklenmedi.</div>}
        {karakterler.map(k => (
          <div key={k.id} className="karakter-karti">
            <strong>{k.ad}</strong>
            <button onClick={() => handleRemoveCharacter(k.id)} className="btn-sil">✕</button>
          </div>
        ))}
      </div>

      <div className="yeni-ekleme-formu" style={{ marginTop: 16 }}>
        <input
          type="text"
          className="input"
          value={yeniKarakterAdi}
          onChange={(e) => setYeniKarakterAdi(e.target.value)}
          placeholder="Yeni karakter adı..."
        />
        <button className="btn primary" onClick={handleAddCharacter} style={{ marginTop: 8, width: '100%' }}>
          Ekle
        </button>
      </div>
    </div>
  );
}

