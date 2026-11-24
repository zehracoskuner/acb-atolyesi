import { paragraphAttribute, paragraphIdPattern, paragraphTags } from './chapterParagraphs.js';

// This factory also runs inside the isolated mobile editor document.
// Keep it self-contained after Metro's transforms, including array access.
function paragraphTracker(attribute, validId, tags) {
  'show source'; // Preserve Function#toString when Expo compiles this function to Hermes bytecode.
  const selector = tags.join(',');
  const boundaries = selector + ',ul,ol,h4,h5,h6,hr,img,pre';
  let previous = [];
  let pending;
  let cut;
  let moved;

  function newId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function paragraphs(editor) {
    const result = [];
    function visit(element) {
      if (element.matches('ul,ol')) result.push(...Array.from(element.children).filter(child => child.matches('li')));
      else if (element.matches('div') && Array.from(element.children).some(child => child.matches(boundaries))) {
        Array.from(element.children).forEach(visit);
      } else if (element.matches(selector)) result.push(element);
    }
    Array.from(editor.children).forEach(visit);
    return result;
  }

  function snapshot(editor) {
    return paragraphs(editor).map(node => ({ node, id: node.getAttribute(attribute), text: node.textContent.trim() }));
  }

  function wrapInlineRuns(editor) {
    const selection = editor.ownerDocument.getSelection();
    const positions = [selection?.anchorNode, selection?.focusNode].map((node, index) => {
      const offset = index ? selection?.focusOffset : selection?.anchorOffset;
      return node === editor ? { node, offset, next: editor.childNodes[offset] } : { node, offset };
    });
    let wrapped = false;
    function visit(parent) {
      let run = [];
      function flush() {
        if (run.some(node => node.textContent.trim())) {
          const block = editor.ownerDocument.createElement('div');
          run[0].before(block);
          block.append(...run);
          wrapped = true;
        }
        run = [];
      }
      for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType === 1 && child.matches(boundaries)) {
          flush();
          if (child.matches('div') && Array.from(child.children).some(block => block.matches(boundaries))) visit(child);
        } else run.push(child);
      }
      flush();
    }
    visit(editor);
    if (!wrapped || !positions.every(({ node }) => node && editor.contains(node))) return;
    function point({ node, offset, next }) {
      if (node !== editor) return [node, offset];
      if (!next) return [editor, editor.childNodes.length];
      return [next.parentNode, Array.from(next.parentNode.childNodes).indexOf(next)];
    }
    const endpoints = positions.map(point);
    selection.setBaseAndExtent(...endpoints[0], ...endpoints[1]);
  }

  function capture(editor, type) {
    const blocks = snapshot(editor);
    pending = { blocks, type };
    const selection = editor.ownerDocument.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!/^(delete|insertParagraph|insertText|insertReplacementText|insertFromPaste|insertFromDrop)/.test(type || '')) return;
    if (range.collapsed && !['deleteContentBackward', 'deleteContentForward', 'insertParagraph', 'insertFromPaste', 'insertFromDrop'].includes(type)) return;
    const selected = range.collapsed ? [] : blocks.filter(block => range.intersectsNode(block.node));
    const start = blocks.find(block => block.node.contains(range.startContainer)) || selected[0];
    const end = blocks.find(block => block.node.contains(range.endContainer)) || selected[selected.length - 1];
    if (!start || !end) return;
    function outsideSelection(block, container, offset, prefix) {
      if (!block.node.contains(container)) return '';
      const part = range.cloneRange();
      part.selectNodeContents(block.node);
      if (prefix) part.setEnd(container, offset);
      else part.setStart(container, offset);
      return part.toString().trim();
    }
    Object.assign(pending, { start, end,
      prefix: outsideSelection(start, range.startContainer, range.startOffset, true),
      suffix: outsideSelection(end, range.endContainer, range.endOffset, false),
    });
  }

  function reset(editor) {
    pending = undefined;
    previous = snapshot(editor);
  }

  function update(editor, type) {
    const change = pending || { blocks: previous, type };
    pending = undefined;
    wrapInlineRuns(editor);
    const after = snapshot(editor);
    const oldById = new Map(change.blocks.filter(block => validId.test(block.id)).map(block => [block.id, block]));
    const oldByNode = new Map(change.blocks.map(block => [block.node, block]));
    const formatted = change.type === 'format' && change.blocks.length === after.length
      && after.every((block, index) => block.text === change.blocks[index].text);
    const uncut = change.cutIds && change.blocks.filter(block => block.text && !change.cutIds.includes(block.id));
    const visible = after.filter(block => block.text);
    if (formatted) {
      after.forEach((block, index) => { block.id = change.blocks[index].id; });
    } else if (uncut && visible.length === uncut.length && visible.every((block, index) => block.text === uncut[index].text)) {
      visible.forEach((block, index) => { block.id = uncut[index].id; });
    } else {
      for (const block of after) block.id ||= oldByNode.get(block.node)?.id;
    }
    const { start, end, prefix, suffix } = change;
    const canSplit = ['insertParagraph', 'insertFromPaste', 'insertFromDrop'].includes(change.type);
    if (start?.id && start === end && canSplit && after.length > change.blocks.length) {
      const index = change.blocks.indexOf(start);
      const parts = after.slice(index, index + 1 + after.length - change.blocks.length);
      const unchanged = parts.filter(block => block.text === start.text && (!block.id || block.id === start.id));
      if (prefix && suffix) {
        const intact = parts.some(block => block.text.startsWith(prefix) && block.text.endsWith(suffix));
        if (change.type === 'insertParagraph' || !intact) {
          for (const block of parts) if (block.id === start.id) block.id = null;
        }
      } else if (unchanged.length === 1) unchanged[0].id = start.id;
    }
    if (start && end && start !== end && !change.cutIds && /^(delete|insertText|insertReplacementText|insertFromPaste)/.test(change.type || '')) {
      if (!prefix && !suffix) {
        const replaced = new Set(change.blocks.slice(change.blocks.indexOf(start), change.blocks.indexOf(end) + 1).map(block => block.id));
        for (const block of after) if (replaced.has(block.id)) block.id = null;
      } else if (!prefix || !suffix) {
        const retained = !prefix ? end : start;
        if ((prefix || suffix) === retained.text) {
          const candidate = after.filter(block => block.text === retained.text
            && (block.id === start.id || block.id === end.id || block.node === start.node || block.node === end.node));
          if (candidate.length === 1) candidate[0].id = retained.id;
        }
      }
    }
    const byId = new Map();
    for (const block of after) {
      if (!validId.test(block.id)) continue;
      if (!byId.has(block.id)) byId.set(block.id, []);
      byId.get(block.id).push(block);
    }

    for (const entry of byId) {
      const id = entry[0], matches = entry[1];
      if (matches.length < 2) continue;
      const original = oldById.get(id);
      const unchanged = original ? matches.filter(block => block.text === original.text) : [];
      const keep = unchanged.find(block => block.node === original.node) || (unchanged.length === 1 ? unchanged[0] : null);
      for (const block of matches) if (block !== keep) block.id = null;
    }

    if (/^(delete|insertText|insertReplacementText|insertFromPaste)/.test(change.type || '')) {
      const surviving = new Map(after.filter(block => block.id && block.text).map(block => [block.id, block]));
      function archiveJoined(first, second, prefix, suffix) {
        if (!first?.id || !second?.id || !prefix || !suffix) return;
        const left = surviving.get(first.id), right = surviving.get(second.id);
        if (!!left === !!right) return;
        const joined = left || right;
        if (joined.text.startsWith(prefix) && joined.text.endsWith(suffix)
            && joined.text.length >= prefix.length + suffix.length) {
          for (const block of after) if (block.id === first.id || block.id === second.id) block.id = null;
        }
      }
      if (start && end && start !== end) archiveJoined(start, end, prefix, suffix);
      if (start && start === end) {
        const index = change.blocks.indexOf(start);
        if (change.type === 'deleteContentBackward' && !prefix) {
          const left = change.blocks[index - 1];
          archiveJoined(left, start, left?.text, start.text);
        } else if (change.type === 'deleteContentForward' && !suffix) {
          const right = change.blocks[index + 1];
          archiveJoined(start, right, start.text, right?.text);
        }
      }
    }

    const kept = new Set(after.map(block => block.node));
    for (const node of editor.querySelectorAll('[' + attribute + ']')) {
      if (!kept.has(node)) node.removeAttribute(attribute);
    }
    for (const block of after) {
      if (block.text && !validId.test(block.id)) block.id = newId();
      if (validId.test(block.id)) block.node.setAttribute(attribute, block.id);
      else block.node.removeAttribute(attribute);
    }
    previous = after;
  }

  function copyForMove(editor, event) {
    const selection = editor.ownerDocument.getSelection();
    if (!event.clipboardData || !selection?.rangeCount || selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    const chosen = snapshot(editor).filter(block => block.text && range.intersectsNode(block.node));
    if (!chosen.length || chosen.some(block => !validId.test(block.id))) return false;
    const plain = selection.toString();
    const normalize = text => text.replace(/\s+/g, '');
    if (normalize(plain) !== normalize(chosen.map(block => block.text).join(''))) return false;
    const fragment = editor.ownerDocument.createElement('div');
    let lastList;
    for (const { node } of chosen) {
      if (!node.matches('li')) {
        fragment.append(node.cloneNode(true));
        lastList = undefined;
      } else {
        if (node.parentNode !== lastList) fragment.append(node.parentNode.cloneNode(false));
        fragment.lastChild.append(node.cloneNode(true));
        lastList = node.parentNode;
      }
    }
    const markup = fragment.innerHTML;
    const ids = chosen.map(block => block.id);
    const token = newId();
    const before = editor.innerHTML;
    event.clipboardData.setData('text/plain', plain);
    event.clipboardData.setData('text/html', markup);
    try { event.clipboardData.setData('application/x-acb-passage-cut', token); }
    catch { /* Some platforms only expose the two standard Clipboard formats. */ }
    event.preventDefault();
    capture(editor, 'deleteByCut');
    pending.cutIds = ids;
    editor.ownerDocument.execCommand('delete');
    cut = { token, markup, ids, before, after: editor.innerHTML };
    return true;
  }

  function pasteForMove(editor, clipboard) {
    if (!cut) return false;
    const token = clipboard.getData('application/x-acb-passage-cut');
    if (token !== cut.token && (token || clipboard.getData('text/html') !== cut.markup)) return false;
    const selection = editor.ownerDocument.getSelection();
    if (!selection?.isCollapsed || !editor.contains(selection.anchorNode)) return false;
    const blocks = snapshot(editor);
    if (blocks.some(block => block.text && cut.ids.includes(block.id))) return false;
    const target = blocks.find(block => block.node.contains(selection.anchorNode));
    let placeBefore = false;
    if (target?.text) {
      const range = selection.getRangeAt(0).cloneRange();
      range.selectNodeContents(target.node);
      range.setEnd(selection.anchorNode, selection.anchorOffset);
      const prefix = range.toString().trim();
      if (prefix && prefix !== target.text) return false;
      placeBefore = !prefix;
    } else if (!target && selection.anchorNode !== editor) return false;

    const before = editor.innerHTML === cut.after ? cut.before : editor.innerHTML;
    const template = editor.ownerDocument.createElement('template');
    template.innerHTML = cut.markup;
    const fragment = template.content;
    if (target?.node.matches('li')) {
      for (const node of Array.from(fragment.children)) {
        if (node.matches('ul,ol')) node.replaceWith(...node.children);
        else {
          const item = editor.ownerDocument.createElement('li');
          for (const { name, value } of node.attributes) item.setAttribute(name, value);
          item.append(...node.childNodes);
          node.replaceWith(item);
        }
      }
    }
    const end = fragment.lastElementChild;
    if (!target) editor.insertBefore(fragment, editor.childNodes[selection.anchorOffset] || null);
    else if (!target.text) target.node.replaceWith(fragment);
    else if (placeBefore) target.node.before(fragment);
    else target.node.after(fragment);
    for (const block of blocks) if (!block.text && cut.ids.includes(block.id)) block.node.remove();
    selection.selectAllChildren(end);
    selection.collapseToEnd();
    cut = undefined;
    update(editor);
    moved = { before, after: editor.innerHTML };
    return true;
  }

  function moveHistory(editor, type) {
    if (!moved) return false;
    const undo = type === 'historyUndo';
    if (editor.innerHTML !== (undo ? moved.after : moved.before)) return false;
    editor.innerHTML = undo ? moved.before : moved.after;
    const selection = editor.ownerDocument.getSelection();
    selection.selectAllChildren(editor);
    selection.collapseToEnd();
    reset(editor);
    return true;
  }

  return { capture, update, reset, copyForMove, pasteForMove, moveHistory };
}

export function createParagraphTracker() {
  return paragraphTracker(paragraphAttribute, paragraphIdPattern, paragraphTags);
}

export const paragraphTrackerScript = '(' + paragraphTracker.toString() + ')('
  + JSON.stringify(paragraphAttribute) + ',' + paragraphIdPattern + ',' + JSON.stringify(paragraphTags) + ')';
