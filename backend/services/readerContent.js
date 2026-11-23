import { createHash } from 'node:crypto';
import { parseDocument, DomUtils } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';

// One server-owned block contract for web, native, comments and local anchors.
const tags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'hr', 'img', 'pre']);
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const digest = text => createHash('sha256').update(text).digest('hex');
export function readerHtml(content = '') {
  const source = /<\/?[a-z][\s\S]*>/i.test(content) ? content : `<p>${escape(content).replace(/\r?\n/g, '<br>')}</p>`;
  return sanitizeHtml(source, {
    allowedTags: [...tags, 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'li', 'a', 'code'],
    allowedAttributes: { '*': ['style'], a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'] },
    allowedSchemes: ['https', 'http', 'mailto'], allowedSchemesByTag: { img: ['https'] },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/], 'text-decoration': [/^(underline|line-through|none)$/], 'font-style': [/^(normal|italic)$/], 'font-weight': [/^(normal|bold|[1-9]00)$/], 'white-space': [/^(pre-wrap|pre-line)$/] } },
  });
}
export function readerBlocks(content) {
  const result = []; let buffer = '', paragraphIndex = 0;
  const push = html => {
    const text = DomUtils.textContent(parseDocument(html)).trim();
    // Preserve visual whitespace, but never number it as a discussion paragraph.
    result.push({ index: text ? paragraphIndex++ : -1, id: digest(html), html, text });
  };
  const flush = () => { if (buffer.trim()) push(`<p>${buffer}</p>`); buffer = ''; };
  const visit = node => {
    // Editor-only div wrappers do not turn a whole chapter into one paragraph.
    if (node.name === 'div' && node.children?.some(child => tags.has(child.name))) {
      flush(); const start = result.length; node.children.forEach(visit); flush();
      if (node.attribs?.style) for (const block of result.slice(start)) {
        block.html = `<div style="${node.attribs.style.replaceAll('"', '&quot;')}">${block.html}</div>`;
        block.id = digest(block.html);
      }
    } else if (['ul', 'ol'].includes(node.name)) {
      flush();
      let number = 0;
      for (const child of node.children || []) if (child.name === 'li') {
        number++;
        push(`<${node.name}${node.name === 'ol' ? ` start="${number}"` : ''}>${DomUtils.getOuterHTML(child)}</${node.name}>`);
      }
    } else if (tags.has(node.name)) { flush(); push(DomUtils.getOuterHTML(node)); }
    else buffer += DomUtils.getOuterHTML(node);
  };
  parseDocument(readerHtml(content)).children.forEach(visit);
  flush(); return result;
}
export function readerPayload(chapter) {
  const blocks = readerBlocks(chapter.content || '');
  return { blocks, contentVersion: digest(blocks.map(b => b.html).join('')) };
}
// No previous guest excerpt contract existed. First narrative chapter only.
export function previewLimit() { return Math.max(100, Math.min(5000, Number(process.env.READER_PREVIEW_CHARACTERS) || 1500)); }
export function previewContent(content, limit = previewLimit()) {
  let remaining = limit;
  const clip = nodes => {
    const kept = [];
    for (const node of nodes) {
      if (remaining <= 0) break;
      if (node.name === 'img') continue;
      if (node.type === 'text') { node.data = Array.from(node.data).slice(0, remaining).join(''); remaining -= Array.from(node.data).length; }
      if (node.children) node.children = clip(node.children);
      kept.push(node);
    }
    return kept;
  };
  return clip(parseDocument(readerHtml(content)).children).map(node => DomUtils.getOuterHTML(node)).join('');
}
export function readerPreviewPayload(chapter) {
  const content = previewContent(chapter.content), full = readerPayload(chapter), preview = readerPayload({ content });
  let cursor = 0;
  const blocks = preview.blocks.map(block => {
    // Images omitted from previews must not shift paragraph identities.
    const match = full.blocks.findIndex((original, i) => i >= cursor && (original.id === block.id || (block.text && original.text.startsWith(block.text))));
    if (match < 0) return block;
    cursor = match + 1; const original = full.blocks[match];
    return { ...block, id: original.id, index: original.index, anchorScale: original.text.length ? Math.min(1, block.text.length / original.text.length) : 1 };
  });
  return { content, blocks, contentVersion: full.contentVersion };
}
export function resolveInlineComment(comment, blocks, contentVersion = digest(blocks.map(b => b.html).join(''))) {
  const safe = { ...comment }; delete safe.reviewNote;
  const matches = comment.blockId ? blocks.filter(b => b.text && b.id === comment.blockId) : [];
  const sameVersion = comment.contentVersion === contentVersion;
  const exact = sameVersion ? matches.find(b => b.index === comment.paragraphIndex) : null;
  const block = exact || (matches.length === 1 ? matches[0] : null);
  return { ...safe, paragraphIndex: block?.index ?? -1, attached: !!block };
}
