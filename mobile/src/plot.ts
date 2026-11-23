import type { Scene, World } from './types';
import type { Act } from './scenes';
export const sceneStatuses: Record<string, string> = { idea: 'Fikir', drafting: 'Taslak', writing: 'Yazılıyor', done: 'Tamam' };
export const structures = [
  { templateId: 'klasik', label: 'Klasik · 3 perde', acts: [{ id: 'giris', label: 'Giriş' }, { id: 'gelisme', label: 'Gelişme' }, { id: 'sonuc', label: 'Sonuç' }] },
  { templateId: 'epik', label: 'Epik · 5 aşama', acts: [{ id: 'dunya', label: 'Sıradan Dünya' }, { id: 'cagri', label: 'Çağrı & Sınav' }, { id: 'donusum', label: 'Dönüşüm' }, { id: 'donum', label: 'Kritik Dönüm' }, { id: 'donus', label: 'Dönüş' }] },
  { templateId: 'serbest', label: 'Serbest', acts: [{ id: 'perde1', label: 'I. Perde' }, { id: 'perde2', label: 'II. Perde' }] },
];
export const sceneOrder = (a: Scene, b: Scene) => a.order - b.order || a._id.localeCompare(b._id);
export function plotActs(structure: World['structure'], scenes: Scene[]): Act[] {
  const acts = [...(structure?.acts || [])];
  for (const scene of scenes) if (!acts.some(a => a.id === scene.act)) acts.push({ id: scene.act, label: structures.flatMap(s => s.acts).find(a => a.id === scene.act)?.label || scene.act });
  return acts;
}
export function filterScenes(scenes: Scene[], query: string, act: string, status: string, character: string) {
  const search = query.trim().toLocaleLowerCase('tr');
  return scenes.filter(s => (!search || `${s.title} ${s.description}`.toLocaleLowerCase('tr').includes(search)) && (!act || s.act === act) && (!status || s.status === status) && (!character || s.characters?.some(c => c._id === character)));
}
export function sceneLinks(scenes: Scene[], id: string) {
  return scenes.flatMap(source => (source.connections || []).flatMap(link => {
    const target = scenes.find(s => s._id === link.target);
    return target && (source._id === id || target._id === id) ? [{ source, target, type: link.edgeType, outgoing: source._id === id }] : [];
  }));
}
