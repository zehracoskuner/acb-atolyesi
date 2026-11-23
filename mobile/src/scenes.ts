import type { Scene } from './types';
export type Act = { id: string; label: string };
export function sceneIndex(scenes: Scene[]) {
  const byId = new Map(scenes.map(scene => [scene._id, scene]));
  const groups = new Map<string, Scene[]>();
  for (const scene of scenes) {
    const group = groups.get(scene.act) || []; group.push(scene); groups.set(scene.act, group);
  }
  const bounds = new Map<string, { first: boolean; last: boolean }>();
  for (const group of groups.values()) group.forEach((scene, index) => bounds.set(scene._id, { first: index === 0, last: index === group.length - 1 }));
  return { byId, bounds };
}
export function sceneActs(defined: Act[] | undefined, scenes: Scene[], draftAct?: string): Act[] {
  const acts = defined?.length ? [...defined] : [{ id: 'giris', label: 'Giriş' }, { id: 'gelisme', label: 'Gelişme' }, { id: 'sonuc', label: 'Sonuç' }];
  let extra = 0;
  for (const id of [...scenes.map(scene => scene.act), draftAct]) {
    if (id && !acts.some(act => act.id === id)) acts.push({ id, label: `Diğer perde ${++extra}` });
  }
  return acts;
}
export function connectionTargets(scenes: Scene[], source: Scene, query: string, mode: 'add' | 'existing') {
  const connected = new Set(source.connections?.map(connection => connection.target));
  const search = query.trim().toLocaleLowerCase('tr');
  return scenes.filter(scene => scene._id !== source._id && (mode === 'existing' ? connected.has(scene._id) : !connected.has(scene._id))
    && (!search || `${scene.title} ${scene.description} ${scene.goal}`.toLocaleLowerCase('tr').includes(search)));
}
