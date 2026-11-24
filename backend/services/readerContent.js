import { createHash } from 'node:crypto';
import { parseDocument, DomUtils } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';
import { paragraphAttribute, paragraphIdPattern, paragraphTags } from '../../shared/chapterParagraphs.js';

// One server-owned block contract for web, native, comments and local anchors.
const tags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'hr', 'img', 'pre']);
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const digest = text => createHash('sha256').update(text).digest('hex');
const chapterSource = content => /<\/?[a-z][\s\S]*>/i.test(content) ? content : `<p>${escape(content).replace(/\r?\n/g, '<br>')}</p>`;

export function readerHtml(content = '') {
  return sanitizeHtml(chapterSource(content), {
    allowedTags: [...tags, 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'li', 'a', 'code'],
    allowedAttributes: {
      '*': ['style'], a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'],
      ...Object.fromEntries(paragraphTags.map(tag => [tag, [paragraphAttribute]])),
    },
    allowedSchemes: ['https', 'http', 'mailto'], allowedSchemesByTag: { img: ['https'] },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/], 'text-decoration': [/^(underline|line-through|none)$/], 'font-style': [/^(normal|italic)$/], 'font-weight': [/^(normal|bold|[1-9]00)$/], 'white-space': [/^(pre-wrap|pre-line)$/] } },
  });
}
function collectBlocks(tree) {
  const result = []; let buffer = [], paragraphIndex = 0;
  const push = (html, sourceNodes) => {
    const text = DomUtils.textContent(parseDocument(html)).trim();
    // Preserve visual whitespace, but never number it as a discussion paragraph.
    result.push({ index: text ? paragraphIndex++ : -1, html, text, sourceNodes });
  };
  const flush = () => {
    const html = buffer.map(node => DomUtils.getOuterHTML(node)).join('');
    if (html.trim()) push(`<p>${html}</p>`, buffer);
    buffer = [];
  };
  const visit = node => {
    // Editor-only div wrappers do not turn a whole chapter into one paragraph.
    if (node.name === 'div' && node.children?.some(child => tags.has(child.name))) {
      flush(); const start = result.length; node.children.forEach(visit); flush();
      if (node.attribs?.style) for (const block of result.slice(start)) {
        block.html = `<div style="${node.attribs.style.replaceAll('"', '&quot;')}">${block.html}</div>`;
      }
    } else if (['ul', 'ol'].includes(node.name)) {
      flush();
      let number = 0;
      for (const child of node.children || []) if (child.name === 'li') {
        number++;
        push(`<${node.name}${node.name === 'ol' ? ` start="${number}"` : ''}>${DomUtils.getOuterHTML(child)}</${node.name}>`, [child]);
      }
    } else if (tags.has(node.name)) { flush(); push(DomUtils.getOuterHTML(node), [node]); }
    else buffer.push(node);
  };
  tree.children.forEach(visit);
  flush(); return result;
}

function blockCounts(values) {
  const counts = new Map();
  for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
}

const htmlVersion = blocks => digest(blocks.map(b => b.html).join(''));
const legacyParagraphId = (block, version, counts) =>
  digest(`paragraph:${counts.get(block.id) === 1 ? block.id : `${version}:${block.index}`}`).slice(0, 32);

export function readerBlocks(content) {
  const tree = parseDocument(readerHtml(content));
  const ids = new Map();
  for (const node of DomUtils.findAll(node => paragraphAttribute in node.attribs, tree.children)) {
    const id = node.attribs[paragraphAttribute];
    if (paragraphIdPattern.test(id)) ids.set(node, id);
    delete node.attribs[paragraphAttribute];
  }
  const candidates = collectBlocks(tree).map(({ sourceNodes, ...block }) => ({
    ...block, id: digest(block.html), storedId: ids.get(sourceNodes[0]),
  }));
  const hashes = blockCounts(candidates.filter(block => block.text).map(block => block.id));
  const storedIds = blockCounts(candidates.filter(block => block.text).map(block => block.storedId));
  const version = htmlVersion(candidates);
  return candidates.map(({ storedId, ...block }) => {
    if (!block.text) return block;
    const legacyId = legacyParagraphId(block, version, hashes);
    const persisted = storedIds.get(storedId) === 1;
    return { ...block, paragraphId: persisted ? storedId : legacyId, paragraphPersisted: persisted };
  });
}

// Seed editor identities without rewriting the published text or changing its revision.
function withParagraphIds(content, getId) {
  if (!content) return content;
  const tree = parseDocument(chapterSource(content));
  const sources = collectBlocks(tree).filter(block => block.text);
  const blocks = readerBlocks(content).filter(block => block.text);
  if (sources.length !== blocks.length || sources.some((source, index) => source.text !== blocks[index].text)) return content;
  let changed = false;
  for (const block of blocks) {
    const { index } = block;
    const paragraphId = getId(block);
    if (!paragraphId) continue;
    const nodes = sources[index].sourceNodes;
    let node = nodes[0];
    if (nodes.length !== 1 || !paragraphTags.includes(node.name)) {
      // Only wrap inline runs. Unsupported legacy block tags keep their original markup.
      if (nodes.length === 1 && tags.has(node.name)) continue;
      const wrapper = parseDocument('<p></p>').children[0];
      DomUtils.replaceElement(node, wrapper);
      node.parent = node.prev = node.next = null;
      nodes.forEach(child => DomUtils.appendChild(wrapper, child));
      node = wrapper;
    }
    if (node.attribs[paragraphAttribute] !== paragraphId) {
      node.attribs[paragraphAttribute] = paragraphId;
      changed = true;
    }
  }
  return changed ? DomUtils.getInnerHTML(tree) : content;
}

export function chapterEditorContent(content) {
  return withParagraphIds(content, block => block.paragraphId);
}

export function stripChapterParagraphIds(content) {
  if (!content?.includes(paragraphAttribute)) return content;
  const tree = parseDocument(content);
  const nodes = DomUtils.findAll(node => paragraphAttribute in node.attribs, tree.children);
  if (!nodes.length) return content;
  for (const node of nodes) delete node.attribs[paragraphAttribute];
  return DomUtils.getInnerHTML(tree);
}

export function preserveLegacyClientParagraphIds(content, previous) {
  if (!previous?.includes(paragraphAttribute) || content.includes(paragraphAttribute)) return content;
  const before = readerBlocks(previous).filter(block => block.text);
  const after = readerBlocks(content).filter(block => block.text);
  const beforeCounts = blockCounts(before.map(block => block.id));
  const afterCounts = blockCounts(after.map(block => block.id));
  const unchanged = new Map(before.filter(block => block.paragraphPersisted && beforeCounts.get(block.id) === 1)
    .map(block => [block.id, block.paragraphId]));
  const sameOrder = before.length === after.length && before.every((block, index) => block.id === after[index].id);
  return withParagraphIds(content, block => sameOrder ? before[block.index].paragraphId
    : afterCounts.get(block.id) === 1 ? unchanged.get(block.id) : undefined);
}

function readerVersion(blocks) {
  if (!blocks.some(block => block.paragraphPersisted)) return htmlVersion(blocks);
  return digest(JSON.stringify(blocks.map(block => [block.html, block.paragraphId])));
}

export function readerPayload(chapter) {
  const blocks = readerBlocks(chapter.content || '');
  return { blocks, contentVersion: readerVersion(blocks) };
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
    return { ...block, id: original.id, index: original.index, paragraphId: original.paragraphId,
      anchorScale: original.text.length ? Math.min(1, block.text.length / original.text.length) : 1 };
  });
  return { content: stripChapterParagraphIds(content), blocks, contentVersion: full.contentVersion };
}
export function inlineCommentAnchors(blocks, contentVersion = readerVersion(blocks)) {
  const passages = blocks.filter(block => block.text);
  const ids = blockCounts(passages.map(block => block.paragraphId));
  const hashes = blockCounts(passages.map(block => block.id));
  const byId = new Map(passages.filter(block => ids.get(block.paragraphId) === 1).map(block => [block.paragraphId, block]));
  const byHash = new Map(passages.filter(block => hashes.get(block.id) === 1 && !block.paragraphPersisted).map(block => [block.id, block]));
  const byIndex = new Map(passages.map(block => [block.index, block]));

  function legacyFilter(block) {
    if (block.paragraphPersisted) return null;
    return {
      paragraphId: null, blockId: block.id,
      ...(hashes.get(block.id) === 1 ? {} : { contentVersion, paragraphIndex: block.index }),
    };
  }

  function filters(block) {
    const legacy = legacyFilter(block);
    return [
      ...(byId.has(block.paragraphId) ? [{ paragraphId: block.paragraphId }] : []),
      ...(legacy ? [legacy] : []),
    ];
  }

  function resolve(comment) {
    let block;
    if (comment.paragraphId) {
      block = byId.get(comment.paragraphId);
    } else if (comment.blockId) {
      const exact = comment.contentVersion === contentVersion ? byIndex.get(comment.paragraphIndex) : null;
      block = exact?.id === comment.blockId && !exact.paragraphPersisted ? exact : byHash.get(comment.blockId);
    }
    const safe = { ...comment }; delete safe.reviewNote;
    return {
      ...safe, paragraphIndex: block?.index ?? -1, attached: !!block,
      previousPassage: !!(block && comment.paragraphText && comment.paragraphText !== block.text),
    };
  }

  return { passages, byIndex, filters, legacyFilter, resolve };
}

export function resolveInlineComment(comment, blocks, contentVersion) {
  return inlineCommentAnchors(blocks, contentVersion).resolve(comment);
}
