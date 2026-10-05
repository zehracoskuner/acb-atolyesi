import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const state=vi.hoisted(()=>({user:{id:'a'}}));
vi.mock('../../frontend/src/lib/session',()=>({getSession:()=>({user:state.user})}));
vi.mock('../../frontend/src/lib/api',()=>({apiDelete:vi.fn(async()=>({ok:true}))}));
import { trackReadingProgress as track, getProgressForStory as get, clearProgressForStory as clear, syncLocalProgressToServer as sync } from '../../frontend/src/services/readingProgressService.js';
import { apiDelete } from '../../frontend/src/lib/api';
import { resolveReadingResume } from '../../frontend/src/services/readingProgressService.js';
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
beforeEach(()=>{state.user={id:'a'};vi.stubGlobal('localStorage',storage());vi.stubGlobal('sessionStorage',storage());vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({found:false})})));});
afterEach(()=>vi.unstubAllGlobals());
describe('Reading progress isolation and persistence',()=>{
 it('does not upload an older offline position over newer server progress during login', async () => {
   fetch.mockRejectedValueOnce(new Error('offline'));
   await track('w', 'old', 1, 'Old', 20, state.user);
   fetch.mockClear();
   fetch.mockResolvedValue({ ok: true, json: async () => ({ found: true, chapterId: 'new', updatedAt: new Date(Date.now() + 10000).toISOString() }) });
   await sync();
   expect(fetch).toHaveBeenCalledTimes(1);
   expect(fetch.mock.calls[0][1].method).toBeUndefined();
 });
 it('restores the saved chapter and position both directly and through a chapter link', () => {
   const chapters = [{ _id: 'first' }, { _id: 'second' }];
   const saved = { chapterId: 'second', scrollPosition: 67 };
   expect(resolveReadingResume(chapters, saved)).toEqual({ index: 1, scrollPosition: 67, resume: true });
   expect(resolveReadingResume(chapters, saved, { chapterId: 'second' }).scrollPosition).toBe(67);
   expect(resolveReadingResume(chapters, saved, { chapterId: 'first' }).scrollPosition).toBe(0);
   expect(resolveReadingResume(chapters, saved, { chapterId: 'first', restart: true })).toEqual({ index: 0, scrollPosition: 0, resume: false });
   expect(resolveReadingResume(chapters, { chapterId: 'another-work', scrollPosition: 90 }).resume).toBe(false);
   expect(() => resolveReadingResume(chapters, saved, { chapterId: 'removed' })).toThrow();
 });
 it('separates works, users and guests while offline',async()=>{fetch.mockRejectedValue(new Error('offline'));await track('w1','c1',1,'First',37,state.user);await track('w2','c2',2,'Second',80,state.user);expect((await get('w1',state.user)).scrollPosition).toBe(37);expect((await get('w2',state.user)).chapterId).toBe('c2');expect(await get('w1',{id:'b'})).toBeNull();expect(await get('w1',null)).toBeNull();});
 it('does not import legacy or guest data into an account',async()=>{localStorage.setItem('acb_reading_progress','{"work":{"chapterId":"legacy"}}');await track('w','guest',1,'Guest',50,null);await sync();expect(fetch).not.toHaveBeenCalled();});
 it('serializes chapter saves',async()=>{let release;fetch.mockImplementationOnce(()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({ok:true})});}));const first=track('w','c1',1,'First',80,state.user);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));const second=track('w','c2',2,'Second',0,state.user);expect(fetch).toHaveBeenCalledTimes(1);release();await Promise.all([first,second]);expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({chapterId:'c2',scrollPosition:0});});
 it('clears the actual local key and scopes server deletion',async()=>{await track('w','c',1,'Chapter',40,null);await clear('w',null);expect(await get('w',null)).toBeNull();await clear('w',state.user);expect(apiDelete).toHaveBeenCalledWith('/reading-progress/w');});
 it('uses newer server progress over an old offline copy',async()=>{fetch.mockRejectedValueOnce(new Error('offline'));await track('w','old',1,'Old',20,state.user);fetch.mockResolvedValueOnce({ok:true,json:async()=>({found:true,chapterId:'new',updatedAt:new Date(Date.now()+10000).toISOString()})});expect((await get('w',state.user)).chapterId).toBe('new');});
});
