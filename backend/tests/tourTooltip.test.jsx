import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const h=vi.hoisted(()=>({effects:[],layout:[],refs:[],states:[]}));
vi.mock('../../frontend/node_modules/react/index.js',async original=>{
 const actual=await original();globalThis.React=actual;
 return {...actual,useEffect:fn=>h.effects.push(fn),useLayoutEffect:fn=>h.layout.push(fn),useRef:value=>{const ref={current:value};h.refs.push(ref);return ref;},useState:value=>[value,v=>h.states.push(typeof v==='function'?v(null):v)]};
});
vi.mock('../../frontend/node_modules/react-dom/index.js',()=>({createPortal:value=>value}));
import TourTooltip from '../../frontend/src/components/tour/TourTooltip';
import {clippedRect} from '../../frontend/src/components/tour/tourRuntime';
let windowEvents,docEvents,card,buttons,previous,cleanup,close,lost;
function mount(target=null){
 const tree=TourTooltip({target,title:'Tur',children:'Metin',onClose:close,onTargetLost:lost,stepKey:'a'});
 h.refs[0].current=card;cleanup=[...h.effects,...h.layout].map(fn=>fn());return tree;
}
function key(key,shiftKey=false){const e={key,shiftKey,preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()};windowEvents.get('keydown')(e);return e;}
beforeEach(()=>{
 vi.useFakeTimers();h.effects=[];h.layout=[];h.refs=[];h.states=[];cleanup=[];close=vi.fn();lost=vi.fn();windowEvents=new Map();docEvents=new Map();
 buttons=[{focus:vi.fn()},{focus:vi.fn()},{focus:vi.fn()}];previous={isConnected:true,focus:vi.fn()};
 card={focus:vi.fn(),contains:el=>el===card||buttons.includes(el),querySelectorAll:()=>buttons,getBoundingClientRect:()=>({width:366,height:280})};
 vi.stubGlobal('window',{innerWidth:390,innerHeight:844,addEventListener:(key,fn)=>windowEvents.set(key,fn),removeEventListener:key=>windowEvents.delete(key)});
 vi.stubGlobal('document',{body:{style:{}},activeElement:previous,querySelector:()=>null,addEventListener:(key,fn)=>docEvents.set(key,fn),removeEventListener:key=>docEvents.delete(key),querySelectorAll:()=>[]});
 vi.stubGlobal('requestAnimationFrame',fn=>setTimeout(fn,16));vi.stubGlobal('cancelAnimationFrame',clearTimeout);
});
afterEach(()=>{cleanup.forEach(fn=>fn?.());vi.useRealTimers();vi.unstubAllGlobals();});
describe('tour keyboard and overlay lifecycle',()=>{
 it('focuses the dialog, traps both tab directions and closes on Escape',()=>{
  mount();expect(card.focus).toHaveBeenCalled();document.activeElement=card;key('Tab',true);expect(buttons[2].focus).toHaveBeenCalled();document.activeElement=buttons[2];key('Tab');expect(buttons[0].focus).toHaveBeenCalled();key('Escape');expect(close).toHaveBeenCalledOnce();
 });
 it('blocks underlying destructive clicks and editor shortcuts but leaves wheel scrolling unlocked',()=>{
  mount();const event={target:{},preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()};docEvents.get('click')(event);expect(event.preventDefault).toHaveBeenCalled();expect(key('Delete').stopImmediatePropagation).toHaveBeenCalled();expect(docEvents.has('wheel')).toBe(false);expect(document.body.style).toEqual({});
 });
 it('releases every handler and animation frame and restores focus on close',()=>{
  mount();cleanup.forEach(fn=>fn?.());cleanup=[];expect(windowEvents.size).toBe(0);expect(docEvents.size).toBe(0);expect(vi.getTimerCount()).toBe(0);expect(previous.focus).toHaveBeenCalledWith({preventScroll:true});
 });
 it('never draws a phantom highlight after the target is removed',()=>{
  mount({isConnected:false});expect(lost).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
 });
 it('clamps geometry to a 390px viewport and scroll-container bounds',()=>{
  vi.stubGlobal('getComputedStyle',()=>({overflowX:'hidden',overflowY:'auto'}));
  const parent={parentElement:null,getBoundingClientRect:()=>({left:0,top:50,right:390,bottom:250})};
  const target={parentElement:parent,getBoundingClientRect:()=>({left:-20,top:30,right:420,bottom:300})};
  expect(clippedRect(target)).toEqual({left:0,top:50,width:390,height:200});
  mount();expect(h.states[0].left).toBe(12);expect(h.states[0].top).toBeGreaterThanOrEqual(12);
 });
});
