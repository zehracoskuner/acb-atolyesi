import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({effects:[],states:[],editor:null}));
vi.mock('../../frontend/node_modules/react/index.js',async original=>{
  const actual=await original(); globalThis.React=actual;
  return {...actual,useEffect:fn=>h.effects.push(fn),useRef:()=>({current:null}),useState:initial=>[initial,value=>h.states.push(value)]};
});
vi.mock('../../frontend/node_modules/tldraw/dist-esm/index.mjs',()=>({useEditor:()=>h.editor,getSnapshot:vi.fn(()=>({document:{schema:{},store:{}}})),loadSnapshot:vi.fn()}));
vi.mock('../../frontend/src/lib/api',()=>({apiGet:vi.fn(),apiPatch:vi.fn()}));
import {apiGet,apiPatch} from '../../frontend/src/lib/api';
import {loadSnapshot} from '../../frontend/node_modules/tldraw/dist-esm/index.mjs';
import DrawingController from '../../frontend/src/components/plotworld/DrawingController.jsx';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let cleanup;
beforeEach(()=>{
  vi.clearAllMocks();h.effects=[];h.states=[];
  h.editor={updateInstanceState:vi.fn(),store:{listen:vi.fn(()=>vi.fn()),_flushHistory:vi.fn()}};
  vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()});
  vi.stubGlobal('document',{addEventListener:vi.fn(),removeEventListener:vi.fn()});
  vi.stubGlobal('localStorage',{getItem:vi.fn(()=>null),setItem:vi.fn(),removeItem:vi.fn()});
});
afterEach(()=>{cleanup?.();cleanup=null;vi.unstubAllGlobals();});
function mount(workId='a'){const editorRef={current:null};DrawingController({workId,editorRef});cleanup=h.effects.at(-1)();return editorRef;}
describe('drawing load gate and lifecycle',()=>{
  it('never listens for writes when metadata loading fails',async()=>{
    apiGet.mockRejectedValueOnce(new Error('offline'));const ref=mount();await tick();
    expect(h.editor.store.listen).not.toHaveBeenCalled();expect(ref.current).toBeNull();expect(apiPatch).not.toHaveBeenCalled();
    expect(h.states.at(-1)).toMatchObject({loadError:true,status:'Kaydedilemedi'});
  });
  it('never enables editing when the stored file cannot be loaded',async()=>{
    apiGet.mockResolvedValueOnce({snapshotUrl:'https://test/snapshot',userId:'u',revision:2});vi.stubGlobal('fetch',vi.fn(async()=>({ok:false})));
    const ref=mount();await tick();expect(ref.current).toBeNull();expect(h.editor.store.listen).not.toHaveBeenCalled();expect(loadSnapshot).not.toHaveBeenCalled();
  });
  it('enables empty new drawings only after a successful metadata response',async()=>{
    apiGet.mockResolvedValueOnce({snapshotUrl:null,userId:'u',revision:0});const ref=mount();expect(ref.current).toBeNull();await tick();
    expect(ref.current).toBe(h.editor);expect(h.editor.store.listen).toHaveBeenCalledWith(expect.any(Function),{source:'user',scope:'document'});
  });
  it('ignores a previous work response after unmount and loads the next work',async()=>{
    let release;apiGet.mockImplementationOnce(()=>new Promise(r=>release=r));mount('a');await tick();cleanup();cleanup=null;
    apiGet.mockResolvedValueOnce({snapshotUrl:null,userId:'u',revision:0});const ref=mount('b');await tick();
    const data={document:{store:{},schema:{}}};vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>data})));
    release({snapshotUrl:'https://test/old',userId:'u',revision:1});await tick();
    expect(loadSnapshot).not.toHaveBeenCalled();expect(ref.current).toBe(h.editor);
  });
});
