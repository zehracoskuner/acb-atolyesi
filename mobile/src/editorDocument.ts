import { paragraphTrackerScript } from '../../shared/chapterParagraphEditor.js';
import { paragraphAttribute, paragraphIdPattern, paragraphTags } from '../../shared/chapterParagraphs.js';

// The isolated editor uses the same tag/style whitelist as backend/utils/sanitizeHtml.js.
export function editorDocument(initial: string, scale = 1, title?: string, position?: { scroll: number; start?: number; end?: number }) {
  const serialized = JSON.stringify(initial).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
  <style>body{margin:0;background:#fffdf8;color:#281f18;font-family:Georgia,serif;font-size:${19 * scale}px;line-height:1.85}#editor{outline:none;min-height:65vh;padding:12px 22px 100px;overflow-wrap:anywhere}#title{outline:none;font-size:1.5em;line-height:1.35;margin:0;padding:26px 22px 12px;overflow-wrap:anywhere}#title,#editor{max-width:720px;margin-inline:auto;box-sizing:border-box}p{margin:0 0 1em}h1,h2,h3{font-weight:500;line-height:1.35}blockquote{border-left:2px solid var(--accent,#236455);padding-left:18px;color:var(--muted,#64716b)}#editor:empty:before{content:'İlk cümlene yer aç…';color:var(--muted,#64716b);pointer-events:none}</style></head>
  <body>${title === undefined ? '' : '<header id="title" contenteditable="plaintext-only" role="textbox" aria-label="Bölüm başlığı" spellcheck="true"></header>'}<main id="editor" contenteditable="true" role="textbox" aria-label="Bölüm metni" aria-multiline="true" spellcheck="true"></main><script>
  const post=data=>window.ReactNativeWebView.postMessage(JSON.stringify(data));
  const paragraphs=${title === undefined ? 'null' : paragraphTrackerScript};
  const paragraphAttribute=${JSON.stringify(paragraphAttribute)}, paragraphIdPattern=${paragraphIdPattern}, paragraphTags=new Set(${JSON.stringify(paragraphTags)});
  function cleanHtml(html,keepParagraphIds=!!paragraphs){const template=document.createElement('template');template.innerHTML=html;const root=template.content;
    root.querySelectorAll('script,style,iframe,object,embed,svg,math').forEach(n=>n.remove());
    const tags=new Set(['P','DIV','BR','SPAN','B','STRONG','I','EM','U','S','STRIKE','DEL','H1','H2','H3','UL','OL','LI','BLOCKQUOTE']);
    root.querySelectorAll('*').forEach(n=>{if(!tags.has(n.tagName)){n.replaceWith(...n.childNodes);return}const align=n.style.textAlign,decor=n.style.textDecoration,weight=n.style.fontWeight,italic=n.style.fontStyle,id=n.getAttribute(paragraphAttribute);
      Array.from(n.attributes).forEach(a=>n.removeAttribute(a.name));if(/^(left|right|center|justify)$/.test(align))n.style.textAlign=align;if(/^(underline|line-through|none)$/.test(decor))n.style.textDecoration=decor;if(/^(normal|bold|[1-9]00)$/.test(weight))n.style.fontWeight=weight;if(/^(normal|italic)$/.test(italic))n.style.fontStyle=italic;if(keepParagraphIds&&paragraphTags.has(n.localName)&&paragraphIdPattern.test(id))n.setAttribute(paragraphAttribute,id);});return template.innerHTML}
  function unsupported(html){const t=document.createElement('template');t.innerHTML=html;const safe=document.createElement('template');safe.innerHTML=cleanHtml(html);
    // Compare CSS semantically: browsers normalize whitespace, property order and semicolons.
    [t,safe].forEach(root=>root.content.querySelectorAll('[style]').forEach(n=>{const rules=Array.from(n.style).sort().map(k=>k+':'+n.style.getPropertyValue(k).trim()+(n.style.getPropertyPriority(k)?'!important':'')).join(';');if(rules)n.setAttribute('style',rules);else n.removeAttribute('style')}));return !t.content.isEqualNode(safe.content)}
  const el=document.getElementById('editor'),heading=document.getElementById('title');const original=${serialized};el.innerHTML=cleanHtml(original);paragraphs?.reset(el);let selection=null;let organic=true,composing=false,bodyChanged=false,commandRunning=false;
  const locked=unsupported(original);if(locked){el.contentEditable='false';post({unsupported:true})}
  if(heading)heading.textContent=${JSON.stringify(title || '').replace(/</g, '\\u003c')};
  function emit(){if(composing)return;post({content:locked||!bodyChanged?original:el.innerHTML,title:heading?.textContent,organic});organic=true}
  window.flush=token=>{if(composing){post({flushed:token,error:'Klavye önerisini tamamlayıp tekrar dene.'});return}emit();post({flushed:token})};
  function insideEditor(range){return range&&el.contains(range.startContainer)&&el.contains(range.endContainer)}
  function currentRange(){const s=window.getSelection();if(!s||!s.rangeCount)return null;const range=s.getRangeAt(0);return insideEditor(range)?range.cloneRange():null}
  function rememberSelection(){const range=currentRange();if(range)selection=range}
  document.addEventListener('selectionchange',()=>{if(document.activeElement===el)rememberSelection()});
  function restore(){
    // Read the live selection before focus can change it. selectionchange is
    // asynchronous, so the saved range may still refer to the previous word.
    const live=document.activeElement===el?currentRange():null;
    const target=live||(insideEditor(selection)?selection.cloneRange():null);
    el.focus();
    if(target){const s=window.getSelection();s.removeAllRanges();s.addRange(target)}
  }
  function bodyEdited(type){bodyChanged=true;if(!composing)paragraphs?.update(el,type);emit()}
  function moveHistory(type){if(!paragraphs?.moveHistory(el,type))return false;rememberSelection();organic=false;bodyChanged=true;emit();return true}
  window.command=(name,value)=>{if(locked)return;restore();if((name==='undo'||name==='redo')&&moveHistory(name==='undo'?'historyUndo':'historyRedo'))return;const before=el.innerHTML;paragraphs?.capture(el,'format');commandRunning=true;try{document.execCommand(name,false,value||null)}finally{commandRunning=false}if(el.innerHTML!==before)bodyEdited('format');rememberSelection()};
  window.replaceContent=html=>{el.innerHTML=cleanHtml(html);paragraphs?.reset(el);selection=null};
  el.addEventListener('beforeinput',e=>{if(!commandRunning){
    if(e.cancelable&&['historyUndo','historyRedo'].includes(e.inputType)&&moveHistory(e.inputType)){e.preventDefault();return}
    organic=!['insertFromPaste','insertFromDrop'].includes(e.inputType);paragraphs?.capture(el,e.inputType)}});
  [el,heading].filter(Boolean).forEach(n=>{n.addEventListener('compositionstart',()=>composing=true);n.addEventListener('compositionend',()=>{composing=false;if(n===el&&bodyChanged)paragraphs?.update(el,'insertCompositionText');emit()})});
  if(heading){heading.addEventListener('input',emit);heading.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.focus()}})}
  el.addEventListener('input',e=>{if(!commandRunning)bodyEdited(e.inputType)});el.addEventListener('blur',()=>{rememberSelection();window.ReactNativeWebView.postMessage(JSON.stringify({blur:true}))});
  el.addEventListener('cut',e=>{if(!locked)paragraphs?.copyForMove(el,e)});
  el.addEventListener('paste',e=>{e.preventDefault();organic=false;const data=e.clipboardData;const html=data.getData('text/html');
    if(paragraphs?.pasteForMove(el,data)){bodyChanged=true;emit();return}
    if(html&&unsupported(html)){post({pasteBlocked:true});return}
    paragraphs?.capture(el,'insertFromPaste');const before=el.innerHTML;commandRunning=true;
    try{document.execCommand(html?'insertHTML':'insertText',false,html?cleanHtml(html,false):data.getData('text/plain'))}finally{commandRunning=false}
    if(el.innerHTML!==before)bodyEdited('insertFromPaste');});
  el.addEventListener('drop',e=>e.preventDefault());
  function caretVisible(){if(composing||document.activeElement!==el)return;const r=currentRange();if(!r||!r.collapsed)return;const rect=r.getBoundingClientRect();const bottom=window.visualViewport?.height||innerHeight;if(rect.bottom>bottom-24)window.scrollBy(0,rect.bottom-bottom+48);else if(rect.top<0)window.scrollBy(0,rect.top-24)}
  window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(caretVisible));
  el.addEventListener('input',()=>requestAnimationFrame(caretVisible));
  let positionTimer;function savePosition(){clearTimeout(positionTimer);positionTimer=setTimeout(()=>{const r=currentRange()||selection;let start,end;if(insideEditor(r)){const pre=document.createRange();pre.selectNodeContents(el);pre.setEnd(r.startContainer,r.startOffset);start=pre.toString().length;pre.setEnd(r.endContainer,r.endOffset);end=pre.toString().length}post({position:{scroll:scrollY,start,end}})},180)}
  document.addEventListener('selectionchange',savePosition);window.addEventListener('scroll',savePosition);
  const position=${JSON.stringify(position || null)};if(position)requestAnimationFrame(()=>{if(position.start!==undefined){const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n,offset=0,startNode,endNode,startOffset,endOffset;while(n=walker.nextNode()){const end=offset+n.textContent.length;if(!startNode&&position.start<=end){startNode=n;startOffset=Math.max(0,position.start-offset)}if(position.end<=end){endNode=n;endOffset=Math.max(0,position.end-offset);break}offset=end}if(startNode&&endNode){selection=document.createRange();selection.setStart(startNode,startOffset);selection.setEnd(endNode,endOffset)}}window.scrollTo(0,position.scroll||0)});
  </script></body></html>`;
}
