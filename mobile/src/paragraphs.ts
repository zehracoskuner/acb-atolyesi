import { parseDOM, DomUtils } from 'htmlparser2';
const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'hr', 'img']);
// Match frontend Read.jsx's top-level block indexing so comments attach to the same passages.
export function paragraphs(html: string) {
  const result: string[] = []; let buffer = '';
  const flush = () => { if (buffer.trim()) result.push(`<p>${buffer.trim()}</p>`); buffer = ''; };
  for (const node of parseDOM(html)) {
    if (node.type === 'text') { buffer += DomUtils.getOuterHTML(node); continue; }
    if (!('name' in node) || node.type === 'script' || node.type === 'style') continue;
    if (blockTags.has(String(node.name))) { flush(); const rendered = DomUtils.getOuterHTML(node);
      if (DomUtils.textContent(node).trim() || /<(hr|img)\b/i.test(rendered)) result.push(rendered);
    } else buffer += DomUtils.getOuterHTML(node);
  }
  flush(); return result.map((html, index) => ({ html, index, text: DomUtils.textContent(parseDOM(html)) }));
}
