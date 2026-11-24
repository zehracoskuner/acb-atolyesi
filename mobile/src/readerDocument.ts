import type { ReaderBlock, ReaderLocation, ReaderPalette, ReaderPrefs } from './readerModel';
export type ReaderDocumentData = { title: string; author: string; authorLink?: boolean; media?: { type: string; url: string; caption?: string }[]; number: string; blocks: ReaderBlock[]; preview: boolean; previous: boolean; next: boolean; preface?: string };
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');
const paragraphMarker = (block: ReaderBlock) => block.index < 0 || !block.text ? '' :
  `<button class="marker" type="button" data-paragraph="${block.index}" data-passage="${escape(block.paragraphId || '')}" aria-label="${block.index + 1}. paragrafa yorum yaz" aria-expanded="false"><span class="marker-bubble" aria-hidden="true">+</span></button>`;
export function readerDocument(data: ReaderDocumentData, prefs: ReaderPrefs, palette: ReaderPalette, scale: number, location: ReaderLocation) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"><style>
*{box-sizing:border-box}html{overflow-anchor:none;background:${palette.paper};color:${palette.ink};scroll-behavior:auto}body{margin:0;font-family:Georgia,serif;-webkit-text-size-adjust:100%}main{max-width:740px;margin:auto;padding:30px 22px 40px}header{padding:8px 0 28px}h1{font-size:1.65em;line-height:1.3;font-weight:500;margin:12px 0}header p{font:calc(14px * var(--scale,1)) system-ui;color:var(--muted);letter-spacing:.08em}button{font:inherit;color:var(--accent);background:transparent;border:1px solid var(--line);border-radius:12px;min-height:48px;padding:10px 16px;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.author{border:0;padding:4px 0;text-align:left;font:calc(15px * var(--scale,1)) system-ui}.block{position:relative}p,div{overflow-wrap:anywhere}article p{margin:0 0 1.05em}article{line-height:var(--spacing);text-align:left}.prose{display:flow-root;white-space:pre-wrap}.prose p:empty,.prose div:empty{min-height:1em}.prose p[style*="justify"],.prose div[style*="justify"]{text-align:left!important}article h1,article h2,article h3{line-height:1.4}img{display:block;width:100%;max-width:100%;height:auto;aspect-ratio:4/3;object-fit:contain}.media{font:14px/1.6 system-ui;color:var(--muted)}.media figure{margin:24px 0}.media a{display:block;min-height:48px;padding:12px}blockquote{border-left:2px solid var(--accent);padding-left:20px;margin:1em 0;color:var(--muted)}pre{white-space:pre-wrap;font-family:inherit}a{color:var(--accent)}hr{border:0;border-top:1px solid var(--line);margin:2em 25%}
article{padding-inline-end:26px}
.marker{position:absolute;inset-inline-end:-46px;inset-block-end:0;display:flex;justify-content:center;align-items:flex-end;width:44px;height:44px;max-height:100%;min-height:0;padding:0 0 3px;border:0;border-radius:8px;color:var(--muted);touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.marker-bubble{display:grid;place-items:center;position:relative;min-width:21px;height:19px;padding-inline:3px;border:1px solid var(--line);border-radius:6px;color:inherit;background:var(--paper);font:600 12px/1 system-ui;font-variant-numeric:tabular-nums;pointer-events:none}
.marker-bubble::after{content:'';position:absolute;inset-inline-start:4px;bottom:-3px;width:4px;height:4px;background:inherit;border:inherit;border-width:0 0 1px 1px;transform:skewY(-35deg)}
.marker.has-comments,.marker[aria-expanded="true"]{color:var(--accent)}
.marker.has-comments .marker-bubble,.marker[aria-expanded="true"] .marker-bubble{background:var(--soft);border-color:currentColor}
.marker:active .marker-bubble{background:var(--soft);border-color:currentColor}
.marker:focus-visible{outline:none}
.marker:focus-visible .marker-bubble{outline:2px solid var(--accent);outline-offset:3px}
.markers-off article{padding-inline-end:0}
.markers-off .marker{display:none}
footer{border-top:1px solid var(--line);margin-top:32px;padding-top:28px;display:grid;gap:12px;font:calc(16px * var(--scale,1))/1.6 system-ui}footer p{text-align:center;color:var(--muted)}.primary{background:var(--accent);color:var(--onAccent);border-color:var(--accent)}.copyright{font-size:12px}
</style></head><body${prefs.markers ? '' : ' class="markers-off"'}><main><header><p>${escape(data.number)}</p><h1>${escape(data.title)}</h1>${data.authorLink ? `<button class="author" data-action="author">${escape(data.author)}</button>` : `<span class="author">${escape(data.author)}</span>`}</header><article id="text">${data.blocks.map(b => `<section class="block" data-block="${escape(b.id)}" data-index="${b.index}"><div class="prose">${b.html}</div>${paragraphMarker(b)}</section>`).join('')}</article>${!data.preview && data.media?.length ? `<section class="media" aria-label="Yazarın paylaştığı medya">${data.media.filter(m => /^https:\/\//.test(m.url)).map(m => `<figure>${m.type === "image" ? `<img src="${escape(m.url)}" alt="${escape(m.caption || "Yazarın paylaştığı görsel")}">` : `<a href="${escape(m.url)}">${m.type === "spotify" ? "Spotify’da dinle" : "YouTube’da aç"} ↗</a>`}<figcaption>${escape(m.caption || "")}</figcaption></figure>`).join("")}</section>` : ""}<footer>${data.preview ? '<p>Hikâyenin devamı için aramıza katıl :)</p><button class="primary" data-action="register">Kayıt ol</button><button data-action="login">Giriş yap</button>' : `${data.next ? '<button class="primary" data-action="next">Sonraki bölüm →</button>' : '<p>Yayınlanan son bölüme geldin</p>'}`}${data.previous ? '<button data-action="previous">Önceki bölüm</button>' : ''}<button data-action="like" id="like" aria-label="Bölümü beğen">♡ Bölümü beğen</button><button data-action="info">Eser bilgisi</button><button data-action="comments" id="comments">Bölüm yorumları</button><p class="copyright">Bu eserin hakları yazarına aittir.</p></footer></main><script>
(function(){
const send=data=>{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else parent.postMessage({reader:true,...data},'*')};
const article=document.getElementById('text'), blocks=[...article.querySelectorAll('.block')], markers=[...article.querySelectorAll('.marker')];
let ready=false, restoring=false, lastY=0, saved=${json(location)}, frame=0;
let activeMarker=null, markerOrigin=null;
function top(el){return el.getBoundingClientRect().top+window.scrollY}
let layoutCache=null;
function metrics(){if(layoutCache)return layoutCache;return layoutCache=blocks.map(b=>{const prose=b.querySelector('.prose');return {block:b,top:top(prose),height:prose.offsetHeight}})}
function textOffset(y,m){return m.reduce((sum,b)=>sum+Math.max(0,Math.min(b.height,y-b.top)),0)}
function capture(){const m=metrics(),total=m.reduce((n,b)=>n+b.height,0),last=m[m.length-1];const endY=last?last.top+last.height-innerHeight:0;const range=Math.max(1,textOffset(endY,m));const y=scrollY;const b=m.find(b=>b.top+b.height>y)||last;return {scrollPosition:Math.max(0,Math.min(100,textOffset(y,m)/range*100)),anchor:y<=top(article)?undefined:b?{id:b.block.dataset.block,fraction:Math.max(0,Math.min(1,(y-b.top)/Math.max(1,b.height)))}:undefined}}
function restore(p){restoring=true;const m=metrics();const matches=p.anchor?m.filter(b=>b.block.dataset.block===p.anchor.id):[];const b=matches.length===1?matches[0]:null;let y=0;if(b)y=b.top+b.height*p.anchor.fraction;else if(p.scrollPosition>0&&m.length){const last=m[m.length-1],range=Math.max(1,textOffset(last.top+last.height-innerHeight,m));let wanted=range*p.scrollPosition/100;for(const item of m){if(wanted<=item.height){y=item.top+wanted;break}wanted-=item.height}}window.scrollTo(0,y);lastY=scrollY;requestAnimationFrame(()=>{saved=capture();restoring=false})}
window.readerPrefs=function(p,c,scale){const anchor=ready?capture():saved;restoring=true;layoutCache=null;for(const key of ['paper','ink','muted','accent','line','soft','onAccent'])document.documentElement.style.setProperty('--'+key,c[key]);document.documentElement.style.background=c.paper;document.documentElement.style.color=c.ink;document.body.style.fontSize=p.size*scale+'px';document.body.style.fontFamily=p.serif?'Georgia, serif':'system-ui, sans-serif';document.documentElement.style.setProperty('--spacing',p.spacing);document.documentElement.style.setProperty('--scale',scale);document.body.classList.toggle('markers-off',!p.markers);requestAnimationFrame(()=>restore(anchor))};
window.readerCounts=function(counts){
  for(const button of markers){
    const index=Number(button.dataset.paragraph), count=counts[index]||0;
    button.classList.toggle('has-comments',count>0);
    button.firstElementChild.textContent=count>99?'99+':count>0?String(count):'+';
    button.setAttribute('aria-label',count>0?(index+1)+'. paragraf, '+count+' yorum':(index+1)+'. paragrafa yorum yaz');
  }
};
function findMarker(passage){
  return markers.find(button=>passage.paragraphId?button.dataset.passage===passage.paragraphId:Number(button.dataset.paragraph)===passage.index);
}
window.readerDiscussion=function(passage){
  const previous=activeMarker;
  activeMarker=passage?findMarker(passage):null;
  if(previous && previous!==activeMarker)previous.setAttribute('aria-expanded','false');
  if(activeMarker)activeMarker.setAttribute('aria-expanded','true');
  if(passage || !previous || !markerOrigin)return;
  const origin=markerOrigin;
  markerOrigin=null;
  requestAnimationFrame(()=>{
    const button=findMarker(origin);
    if(!button || activeMarker || !button.getClientRects().length)return;
    restoring=true;
    scrollTo(0,top(button.parentElement.querySelector('.prose'))+origin.offset);
    button.focus({preventScroll:true});
    lastY=scrollY;
    saved=capture();
    restoring=false;
  });
};
window.readerLike=function(liked,count,busy){const b=document.getElementById('like');if(b){b.textContent=(liked?'♥ Beğenildi':'♡ Bölümü beğen')+(count===null?'':' · '+Math.max(0,count));b.disabled=!!busy;b.setAttribute('aria-label',liked?'Beğeniyi geri al':'Bölümü beğen');b.setAttribute('aria-pressed',liked)}};
window.readerTotal=function(total){const b=document.getElementById('comments');if(b)b.textContent='Bölüm yorumları'+(total===null?'':' ('+total+')')};
document.querySelectorAll('img').forEach(img=>{const w=Number(img.getAttribute('width')),h=Number(img.getAttribute('height'));if(w>0&&h>0)img.style.aspectRatio=w+'/'+h});
window.readerPrefs(${json(prefs)},${json(palette)},${scale});
document.addEventListener('click',e=>{
  const button=e.target.closest('button');
  if(button?.matches('.marker')){
    const index=Number(button.dataset.paragraph), paragraphId=button.dataset.passage||undefined;
    markerOrigin={index,paragraphId,offset:scrollY-top(button.parentElement.querySelector('.prose'))};
    send({paragraph:index,paragraphId,position:capture()});
  }else if(button?.dataset.action)send({action:button.dataset.action});
  const link=e.target.closest('a');if(link){e.preventDefault();send({link:link.href})}
});
let selectionTimer;document.addEventListener('selectionchange',()=>{clearTimeout(selectionTimer);selectionTimer=setTimeout(()=>{const s=getSelection();send({selection:s&&!s.isCollapsed&&article.contains(s.anchorNode)&&article.contains(s.focusNode)?s.toString():''})},180)});
let lastSent=0;addEventListener('scroll',()=>{if(!ready||restoring||frame)return;frame=requestAnimationFrame(()=>{frame=0;const y=scrollY;const direction=y-lastY;lastY=y;saved=capture();if(Date.now()-lastSent>180){lastSent=Date.now();send({position:saved,direction})}})},{passive:true});
addEventListener('scrollend',()=>{if(ready&&!restoring){saved=capture();send({position:saved,direction:0})}});
let resizeFrame;new ResizeObserver(()=>{if(!ready||restoring)return;cancelAnimationFrame(resizeFrame);const anchor=saved;layoutCache=null;resizeFrame=requestAnimationFrame(()=>restore(anchor))}).observe(article);
addEventListener('resize',()=>{layoutCache=null;if(ready)restore(saved)});
Promise.resolve(document.fonts.ready).then(()=>requestAnimationFrame(()=>{restore(saved);requestAnimationFrame(()=>{ready=true;send({ready:true})})}));
})();</script></body></html>`;
}
