import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const h=vi.hoisted(()=>({slots:[],cursor:0,effects:[],dirty:false}));
vi.mock('../../frontend/node_modules/react/index.js',async original=>{
 const actual=await original(); globalThis.React=actual;
 const depsChanged=(a,b)=>!a||!b||a.length!==b.length||a.some((v,i)=>v!==b[i]);
 return {...actual,
  useState:initial=>{const i=h.cursor++;if(!h.slots[i])h.slots[i]={value:typeof initial==='function'?initial():initial};return [h.slots[i].value,v=>{const next=typeof v==='function'?v(h.slots[i].value):v;if(next!==h.slots[i].value){h.slots[i].value=next;h.dirty=true;}}];},
  useRef:initial=>{const i=h.cursor++;return h.slots[i]??(h.slots[i]={current:initial});},
  useCallback:(fn,deps)=>{const i=h.cursor++;if(depsChanged(h.slots[i]?.deps,deps))h.slots[i]={value:fn,deps};return h.slots[i].value;},
  useEffect:(fn,deps)=>{const i=h.cursor++;if(depsChanged(h.slots[i]?.deps,deps)){const prev=h.slots[i];h.slots[i]={deps,cleanup:prev?.cleanup};h.effects.push(()=>{h.slots[i].cleanup?.();h.slots[i].cleanup=fn();});}},
 };
});
vi.mock('../../frontend/src/lib/api',()=>({apiPatch:vi.fn(()=>Promise.resolve({}))}));
vi.mock('../../frontend/src/components/tour/TourTooltip',()=>({default:()=>null}));
import { apiPatch } from '../../frontend/src/lib/api';
import { TourManager } from '../../frontend/src/components/tour/TourManager';
import { readTour } from '../../frontend/src/components/tour/tourRuntime';
let props, targets, listeners, store, tree, userNumber=0;
const all=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(all):[n,...all(n.props?.children)];
const button=label=>all(tree).find(n=>n.type==='button'&&n.props.children===label);
function render(){let count=0;do{h.dirty=false;h.cursor=0;tree=TourManager(props);const effects=h.effects.splice(0);effects.forEach(fn=>fn());if(++count>30)throw Error('render loop');}while(h.dirty);return tree;}
async function flush(){await Promise.resolve();render();await Promise.resolve();render();}
function unmount(){for(const slot of h.slots)slot?.cleanup?.();h.slots=[];h.effects=[];}
function target(name){targets.set(name,[{dataset:{tour:name},getBoundingClientRect:()=>({width:100,height:40,left:20,top:20,right:120,bottom:60}),checkVisibility:()=>true,scrollIntoView:vi.fn()}]);}
function help(){listeners.get('acb-tour-help')();render();}
async function start(){help();button('Genel tanıtım').props.onClick();render();await flush();}
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();h.slots=[];h.effects=[];h.cursor=0;h.dirty=false;targets=new Map();listeners=new Map();store=new Map();
 props={userId:`test-${++userNumber}`,currentPath:'/studio',routeKey:'a',legacyCompleted:false};
 vi.stubGlobal('window',{innerWidth:390,innerHeight:844,addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:(n)=>listeners.delete(n)});
 vi.stubGlobal('document',{body:{},querySelectorAll:s=>targets.get(s.match(/"([^"]+)"/)[1])||[],querySelector:()=>({})});
 vi.stubGlobal('localStorage',{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)});
 vi.stubGlobal('requestAnimationFrame',fn=>setTimeout(fn,16));vi.stubGlobal('cancelAnimationFrame',clearTimeout);
 vi.stubGlobal('MutationObserver',class{observe(){}disconnect(){}});
 for(const name of ['tour-page-ready','topbar-kesfet','topbar-library','topbar-atolyem','tour-help'])target(name);
});
afterEach(()=>{unmount();vi.useRealTimers();vi.unstubAllGlobals();});
describe('tour manager',()=>{
 it('opens Atelier from chapters, waits for late content and skips a missing optional tool',async()=>{
  props.currentPath='/work/book/chapters';props.legacyCompleted=true;
  window.__acbTourTrigger={openAtelier:vi.fn(),prepareAtelierTool:vi.fn()};
  render();help();button('Atölye rehberi').props.onClick();render();await flush();
  expect(window.__acbTourTrigger.openAtelier).toHaveBeenCalled();expect(tree.props.target).toBeNull();
  target('atelier-intro');await vi.advanceTimersByTimeAsync(16);await flush();expect(tree.props.title).toBe('Atölye');expect(tree.props.target).toBeTruthy();
  target('atelier-routine');button('İleri').props.onClick();render();await flush();
  await vi.advanceTimersByTimeAsync(5000);await flush();expect(tree.props.title).toBe('Sprint ve rutin');expect(tree.props.target).toBeTruthy();
 });
 it('uses the visible Atelier tab for the contextual help action',async()=>{
  props.currentPath='/work/book/chapters';props.legacyCompleted=true;target('atelier-intro');
  window.__acbTourTrigger={openAtelier:vi.fn(),openChapters:vi.fn()};
  render();help();button('Bu ekranın rehberi').props.onClick();render();await flush();
  expect(tree.props.title).toBe('Atölye');expect(window.__acbTourTrigger.openAtelier).toHaveBeenCalled();expect(window.__acbTourTrigger.openChapters).not.toHaveBeenCalled();
 });
 it('offers an optional invitation after page readiness and does not repeat after skipping',async()=>{
  targets.delete('tour-page-ready');render();await flush();expect(tree).toBeNull();target('tour-page-ready');await vi.advanceTimersByTimeAsync(16);await flush();expect(tree.props.title).toContain('birlikte');button('Şimdi değil').props.onClick();render();expect(tree).toBeNull();unmount();render();await flush();expect(tree).toBeNull();
 });
 it('keeps legacy completed accounts quiet but permits restart',async()=>{
  props.legacyCompleted=true;render();await flush();expect(tree).toBeNull();await start();expect(tree.props.title).toBe('Keşfet');
 });
 it('finishes the short tour without navigation or data requests',async()=>{
  props.legacyCompleted=true;const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render();await start();
  for(let i=0;i<3;i++){button('İleri').props.onClick();render();await flush();}
  expect(tree.props.title).toBe('Yardım hep burada');button('Turu bitir').props.onClick();render();expect(tree).toBeNull();expect(readTour(props.userId,'general')).toBe('completed');expect(fetch).not.toHaveBeenCalled();expect(apiPatch.mock.calls.every(call=>call[0]==='/user/tour-complete')).toBe(true);expect(props.currentPath).toBe('/studio');
 });
 it('locks rapid next/back transitions and retains the correct target',async()=>{
  props.legacyCompleted=true;render();await start();const next=button('İleri').props.onClick;next();next();render();await flush();expect(tree.props.title).toBe('Kütüphanem');button('Geri').props.onClick();render();await flush();expect(tree.props.title).toBe('Keşfet');
 });
 it('shows retry instead of a floating explanation for a missing required target',async()=>{
  props.legacyCompleted=true;targets.delete('topbar-kesfet');render();await start();await vi.advanceTimersByTimeAsync(5000);await flush();expect(tree.props.target).toBeNull();expect(button('Yeniden dene')).toBeTruthy();target('topbar-kesfet');button('Yeniden dene').props.onClick();render();await flush();expect(tree.props.target).toBeTruthy();
 });
 it('cancels a pending step on close and ignores its late target',async()=>{
  props.legacyCompleted=true;targets.delete('topbar-kesfet');render();await start();tree.props.onClose();render();target('topbar-kesfet');await vi.advanceTimersByTimeAsync(6000);await flush();expect(tree).toBeNull();expect(vi.getTimerCount()).toBe(0);
 });
 it('closes on route changes and releases pending work on logout/unmount',async()=>{
  props.legacyCompleted=true;targets.delete('topbar-kesfet');render();await start();props={...props,currentPath:'/library',routeKey:'b'};render();await flush();expect(tree).toBeNull();expect(vi.getTimerCount()).toBe(0);await start();unmount();expect(listeners.size).toBe(0);expect(vi.getTimerCount()).toBe(0);
 });
 it('does not let one account inherit another account dismissal',async()=>{
  render();await flush();button('Şimdi değil').props.onClick();render();unmount();props={...props,userId:'different-account'};render();await flush();expect(tree.props.title).toContain('birlikte');
 });
 it('honors choices saved on the account in another browser',async()=>{
  props.serverProgress={'2026-09-24_general':'skipped'};render();await flush();expect(tree).toBeNull();
 });
 it('aborts preference writes when the account unmounts',async()=>{
  apiPatch.mockImplementationOnce(()=>new Promise(()=>{}));render();await flush();const signal=apiPatch.mock.calls[0][2].signal;unmount();expect(signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
 });
 it('skips a missing optional editor and restores sidebar preparation',async()=>{
  props.currentPath='/work/book/chapters';props.legacyCompleted=true;target('write-save-status');target('write-chapters');
  const restore=vi.fn();window.__acbTourTrigger={openChapterSidebar:vi.fn(()=>restore)};render();help();button('Bu ekranın rehberi').props.onClick();render();await flush();
  button('İleri').props.onClick();render();await flush();expect(window.__acbTourTrigger.openChapterSidebar).toHaveBeenCalledOnce();button('İleri').props.onClick();render();await flush();expect(restore).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(5000);await flush();expect(tree.props.floating).toBe(true);
 });
 it('does not interrupt an existing work with an unsolicited invitation',async()=>{
  props.currentPath='/work/book/chapters';render();await flush();expect(tree.props.floating).toBe(true);expect(button('Başlayalım')).toBeUndefined();
 });
});
