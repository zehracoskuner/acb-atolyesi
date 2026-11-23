// Explicit, isolated QA fixtures. This file is never imported by the native app.
import React, { useState } from 'react';
import { SceneMap } from '../../src/components/SceneMap';
import { RelationshipMap } from '../../src/components/RelationshipMap';
import { Button, Page, TextAction } from '../../src/ui';
const acts = [{ id: 'giris', label: 'Giriş' }, { id: 'gelisme', label: 'Gelişme' }, { id: 'sonuc', label: 'Sonuç' }];
const characters = [{ _id: 'ada', name: 'Ada', role: 'Başkarakter', tagline: 'Geride kalan bir mektubun peşinde.' }, { _id: 'deniz', name: 'Deniz', role: 'Yol arkadaşı' }, { _id: 'meryem', name: 'Meryem', role: 'Tanık' }];
const initial = ['Kayıp mektup', 'İstasyondaki yabancı', 'Yarım kalan söz', 'Kapının ardında', 'Son vapur', 'Eve dönüş'].map((title, i) => ({ _id: String(i), title, act: acts[Math.floor(i / 2)].id, order: i % 2, status: i < 2 ? 'done' : 'idea', description: 'Eski bir mektup, birbirinden uzaklaşmış iki hayatı yeniden kesiştirir.', goal: i === 0 ? 'Ada, babasının sakladığı gerçeği öğrenir.' : 'Karakterin kararının sonuçlarını göster.', characters: [characters[0]], connections: i < 5 ? [{ target: String(i + 1), edgeType: 'sonuc' }] : [] }));
export default function PlotPreview() {
  const [scenes, setScenes] = useState(initial); const [open, setOpen] = useState(true); const [edited, setEdited] = useState('');
  const [relations, setRelations] = useState([{ _id: 'r1', from: 'ada', to: 'deniz', type: 'Dostluk', label: '', directed: false }]);
  const isCharacters = location.hash.includes('relationship-map');
  return <Page><Button title="Haritayı aç" onPress={() => setOpen(true)}/><TextAction title={edited || 'Düzenlenen sahne yok'} onPress={() => {}}/>{open && (isCharacters ? <RelationshipMap characters={characters} relationships={relations} onClose={() => setOpen(false)} onDelete={id => setRelations(previous => previous.filter(r => r._id !== id))} onCreate={async (from, to, type, directed) => { setRelations(previous => [...previous, { _id: String(Date.now()), from, to, type, directed, label: '' }]); }}/> : <SceneMap scenes={scenes} acts={acts} onClose={() => setOpen(false)} onEdit={scene => setEdited(scene.title)} onConnection={async (from, to, remove, type) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    if (window.__failPlotSave) throw new Error('Bağlantı kaydedilemedi. Yeniden dene.');
    window.__lastPlotWrite = { from, to, remove, type };
    setScenes(previous => previous.map(scene => scene._id !== from ? scene : { ...scene, connections: remove ? scene.connections.filter(link => link.target !== to) : [...scene.connections, { target: to, edgeType: type }] }));
  }}/> )}</Page>;
}
