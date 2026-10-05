import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { tourKey, readTour, writeTour, waitForTarget, visibleTarget, transitionGate } from '../../frontend/src/components/tour/tourRuntime';
import { contextTour, TOUR_STEPS } from '../../frontend/src/components/tour/TourSteps';
let elements, observers;
const element = (visible=true) => ({ getBoundingClientRect:()=>({width:100,height:40}), checkVisibility:()=>visible });
beforeEach(()=>{
 vi.useFakeTimers(); elements=[]; observers=[];
 vi.stubGlobal('document',{body:{},querySelectorAll:()=>elements});
 vi.stubGlobal('requestAnimationFrame',fn=>setTimeout(fn,16));
 vi.stubGlobal('cancelAnimationFrame',clearTimeout);
 vi.stubGlobal('MutationObserver',class { constructor(fn){this.fn=fn;this.disconnect=vi.fn();observers.push(this);} observe(){} });
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('tour target lifecycle',()=>{
 it('waits for slow content and releases all resources on success',async()=>{
  const pending=waitForTarget('slow'); await vi.advanceTimersByTimeAsync(3200); const el=element(); elements=[el]; observers[0].fn();
  expect(await pending).toBe(el); expect(observers[0].disconnect).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
 });
 it('never accepts hidden or ambiguous targets',()=>{
  elements=[element(false)]; expect(visibleTarget('x')).toBeNull(); elements=[element(),element()]; expect(visibleTarget('x')).toBeNull();
 });
 it('times out without pretending a missing target was found',async()=>{
  const pending=waitForTarget('missing',{timeout:100}); await vi.advanceTimersByTimeAsync(100); expect(await pending).toBeNull(); expect(vi.getTimerCount()).toBe(0); expect(observers[0].disconnect).toHaveBeenCalled();
 });
 it('cancels old work even if content arrives later',async()=>{
  const abort=new AbortController(); const pending=waitForTarget('old',{signal:abort.signal}); abort.abort(); elements=[element()]; observers[0].fn();
  expect(await pending).toBeNull(); expect(vi.getTimerCount()).toBe(0);
 });
 it('does not allocate resources for an already aborted run',async()=>{
  const abort=new AbortController();abort.abort();expect(await waitForTarget('x',{signal:abort.signal})).toBeNull();expect(observers).toHaveLength(0);
 });
 it('prevents double transitions until the next target is ready',()=>{
  const gate=transitionGate();expect(gate.take()).toBe(false);gate.ready();expect(gate.take()).toBe(true);expect(gate.take()).toBe(false);gate.ready();expect(gate.take()).toBe(true);
 });
});
describe('account and version state',()=>{
 it('separates users, tour kinds and versions without clearing any other data',()=>{
  const data=new Map([['draft','keep']]); const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  writeTour('alice-runtime','general','completed',storage);
  expect(readTour('alice-runtime','general',storage)).toBe('completed');expect(readTour('bob-runtime','general',storage)).toBeUndefined();expect(readTour('alice-runtime','plot',storage)).toBeUndefined();
  expect(tourKey('alice','general','v1')).not.toBe(tourKey('alice','general','v2')); expect(data.get('draft')).toBe('keep');
 });
 it('keeps dismissal in memory when browser storage is unavailable',()=>{
  const storage={getItem:()=>{throw Error();},setItem:()=>{throw Error();}};writeTour('private-runtime','general','skipped',storage);expect(readTour('private-runtime','general',storage)).toBe('skipped');
 });
 it('chooses only current work screens, without requiring a first work ID',()=>{
  expect(contextTour('/studio')).toBe('studio');expect(contextTour('/work/a/chapters')).toBe('chapters');expect(contextTour('/work/b/plot')).toBe('plot');expect(contextTour('/keşfet')).toBeNull();
  for(const steps of Object.values(TOUR_STEPS)) for(const s of steps) { expect(s).not.toHaveProperty('route');expect(s.target).not.toMatch(/yayinla|delete|sil/); }
 });
});
