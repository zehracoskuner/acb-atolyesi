// src/components/OlayOrgusuModulu.jsx
import React, { useState, useCallback, useMemo } from 'react';
import { WORK_TABS } from '../constants/constants';

// Hikaye Yapı Kartı Tanımı
const STORY_PARTS = {
    ACT_I: 'Perde I (Başlangıç)',
    ACT_II: 'Perde II (Gelişme)',
    ACT_III: 'Perde III (Sonuç)',
};

// Mock Olay Örgüsü Verisi
const MOCK_PLOT_POINTS = [
    { id: 'p1', act: STORY_PARTS.ACT_I, description: 'Giriş: Ana karakterin sıradan dünyası tanıtılır.', word_perc: 0.10 },
    { id: 'p2', act: STORY_PARTS.ACT_I, description: 'Kanca (Inciting Incident): Kayıp mektup bulunur.', word_perc: 0.15 },
    { id: 'p3', act: STORY_PARTS.ACT_II, description: 'Birinci Dönüm Noktası: Elif, Zeynep\'i ikna eder ve tren istasyonuna giderler.', word_perc: 0.25 },
    { id: 'p4', act: STORY_PARTS.ACT_II, description: 'Orta Nokta: Mektuptaki şifre çözülür; asıl tehlike anlaşılır.', word_perc: 0.50 },
    { id: 'p5', act: STORY_PARTS.ACT_III, description: 'Doruk Noktası (Climax): Gölge ile yüzleşme ve büyük hata.', word_perc: 0.75 },
    { id: 'p6', act: STORY_PARTS.ACT_III, description: 'Çözüm: Karakterlerin yeni hayatı ve son mektup.', word_perc: 0.90 },
];

// Olay Kartı Bileşeni
function PlotCard({ plot, onDelete }) {
    const isClimax = plot.description.includes('Doruk Noktası');
    const color = isClimax ? 'var(--accent)' : 'var(--muted)';

    return (
        <div className="card" style={{ padding: 10, margin: '8px 0', borderLeft: `4px solid ${color}`, background: 'var(--panel)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>{plot.description}</strong>
                <button 
                    style={{ fontSize: 10, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => onDelete(plot.id)}
                >
                    ✕
                </button>
            </div>
            <div style={{ fontSize: 11, color: color, marginTop: 4 }}>
                {Math.round(plot.word_perc * 100)}% işaretinde gerçekleşecek.
            </div>
        </div>
    );
}

// Ana Modül
export default function OlayOrgusuModulu() {
    const [plotPoints, setPlotPoints] = useState(MOCK_PLOT_POINTS);

    // Olay kartlarını perdelere göre grupla
    const groupedPlots = useMemo(() => {
        return Object.values(STORY_PARTS).reduce((acc, act) => {
            acc[act] = plotPoints.filter(p => p.act === act).sort((a, b) => a.word_perc - b.word_perc);
            return acc;
        }, {});
    }, [plotPoints]);

    const handleAddPlot = useCallback((act) => {
        // NOT: alert/prompt yerine modal UI kullanılması gerekmektedir
        const description = prompt(`Yeni olay için kısa açıklama girin (${act}):`); 
        if (description) {
            setPlotPoints(prev => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    act: act,
                    description: description.slice(0, 80),
                    // Yeni olay varsayılan olarak ilgili perdenin ortasına yerleştirilir
                    word_perc: act === STORY_PARTS.ACT_I ? 0.18 : act === STORY_PARTS.ACT_II ? 0.40 : 0.85
                }
            ]);
        }
    }, []);

    const handleDeletePlot = useCallback((id) => {
        // NOT: alert/prompt yerine modal UI kullanılması gerekmektedir
        if (window.confirm("Bu olay kartını silmek istediğinizden emin misiniz?")) {
            setPlotPoints(prev => prev.filter(p => p.id !== id));
        }
    }, []);

    // Yüksek Mühendislik Kanıtı: Hikaye Ritmi Haritası Simülasyonu
    const StoryRhythmMap = () => {
        const climaxPoint = plotPoints.find(p => p.description.includes('Doruk Noktası'));
        const targetPercent = 75; // Doruk Noktası için ideal hedef

        return (
            <div style={{ margin: '20px 0', padding: 15, border: '1px solid var(--border)', borderRadius: 12 }}>
                <h5 style={{ marginTop: 0, marginBottom: 15 }}>📈 Hikaye Ritmi Haritası</h5>
                <div style={{ height: 10, background: 'var(--panel)', borderRadius: 5, position: 'relative' }}>
                    
                    {/* İdeal %75 Doruk Noktası İşaretleyici */}
                    <div 
                        style={{ position: 'absolute', left: `${targetPercent}%`, transform: 'translateX(-50%)', 
                                 top: -15, fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}
                    >
                        %75 (İdeal)
                    </div>

                    {/* Tüm Olay Kartları İşaretleyicileri */}
                    {plotPoints.map(p => (
                        <div 
                            key={p.id} 
                            style={{ 
                                position: 'absolute', left: `${p.word_perc * 100}%`, top: -5,
                                width: 12, height: 12, borderRadius: '50%', background: p.description.includes('Doruk') ? 'var(--accent)' : 'var(--brand)',
                                border: '2px solid var(--panel2)', transform: 'translateX(-50%)',
                                cursor: 'pointer'
                            }}
                            title={`${p.description} (${Math.round(p.word_perc * 100)}%)`}
                        />
                    ))}
                </div>
                {climaxPoint && (
                    <div style={{ fontSize: 13, marginTop: 25, textAlign: 'center' }}>
                        {Math.abs(climaxPoint.word_perc * 100 - targetPercent) > 10 ? 
                            <span style={{color: '#dc2626'}}>⚠️ Doruk Noktası ({Math.round(climaxPoint.word_perc * 100)}%) idealden sapıyor. Hikayeyi yeniden yapılandırmalısın!</span> :
                            <span style={{color: 'var(--brand-700)'}}>✅ Ritmin yerinde görünüyor. Doruk Noktası (%75) ideal hedefe yakın.</span>
                        }
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{padding: '10px 15px'}}>
            <h4 style={{marginBottom: 10}}>Olay Örgüsü Mühendisliği ({WORK_TABS.ANAHAT})</h4>
            <div style={{color: 'var(--muted)', fontSize: 13, marginBottom: 15}}>
                Büyük kurgu eserleri için zorunlu olan Üç Perde Yapısı ile hikayeni planla.
            </div>

            <StoryRhythmMap />

            {/* Perde Bölümleri */}
            {Object.entries(groupedPlots).map(([actName, plots]) => (
                <div key={actName} style={{ marginBottom: 20, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h5 style={{ color: 'var(--text)', margin: '5px 0' }}>{actName}</h5>
                        <button 
                            className="btn" 
                            style={{ padding: '4px 10px', height: 'auto', fontSize: 12 }}
                            onClick={() => handleAddPlot(actName)}
                        >
                            + Olay Ekle
                        </button>
                    </div>
                    
                    {plots.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>Bu perdeye olay ekle...</div>
                    ) : (
                        plots.map(plot => <PlotCard key={plot.id} plot={plot} onDelete={handleDeletePlot} />)
                    )}
                </div>
            ))}
        </div>
    );
}
