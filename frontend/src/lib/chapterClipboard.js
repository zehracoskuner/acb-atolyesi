import DOMPurify from "dompurify";

// Match the formatting accepted by backend/utils/sanitizeHtml.js. Clipboard
// fonts, colours, dimensions and margins must never enter the live editor.
const styles = {
  "text-align": /^(left|right|center|justify)$/,
  "text-decoration": /^(underline|line-through|none)$/,
  "font-weight": /^(normal|bold|[1-9]00)$/,
  "font-style": /^(normal|italic)$/,
};
const tags = ["p", "div", "br", "span", "b", "strong", "i", "em", "u", "s", "strike", "del",
  "h1", "h2", "h3", "ul", "ol", "li", "blockquote"];

export function chapterClipboardHtml(clipboard) {
  const html = clipboard.getData("text/html");
  const text = clipboard.getData("text/plain");
  if (!html) return plainTextHtml(text);

  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...tags, "h4", "h5", "h6", "section", "article", "pre"],
    ALLOWED_ATTR: ["style"], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const original of [...fragment.querySelectorAll("*")]) {
    let element = original;
    // Use the same paragraph blocks as typing in the editor. Empty paragraphs
    // need a break to retain intentional blank lines after their margins go.
    if (/^(P|SECTION|ARTICLE|PRE|H[4-6])$/.test(element.tagName)) {
      const replacement = document.createElement(/^H/.test(element.tagName) ? "h3" : "div");
      replacement.style.cssText = element.style.cssText;
      replacement.append(...element.childNodes);
      element.replaceWith(replacement);
      element = replacement;
    }
    const kept = Object.entries(styles).flatMap(([property, pattern]) => {
      const value = element.style.getPropertyValue(property).trim();
      return pattern.test(value) ? [`${property}:${value}`] : [];
    });
    element.removeAttribute("style");
    if (kept.length) element.setAttribute("style", kept.join(";"));
    if (/^(DIV|H[1-3]|LI|BLOCKQUOTE)$/.test(element.tagName) && !element.hasChildNodes()) {
      element.append(document.createElement("br"));
    }
  }
  // HTML source indentation is not a paragraph break. With pre-wrap it would
  // otherwise add blank lines between Word/Docs blocks.
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  const indentation = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (/^[\t\r\n ]+$/.test(node.data) && /[\r\n]/.test(node.data)
        && (isBlock(node.previousSibling) || isBlock(node.nextSibling))) indentation.push(node);
  }
  indentation.forEach(node => node.remove());
  const container = document.createElement("div");
  container.append(fragment);
  // Browsers wrap a copied sentence in its source paragraph. Inserting that
  // wrapper mid-sentence splits the destination paragraph. Only unwrap when
  // plain text confirms there are no selected line breaks; keep intentional
  // blank lines and structural formatting (headings, lists, quotes) intact.
  const paragraphWrappers = [...container.querySelectorAll("div")];
  // A single-line plain-text flavour is not proof that HTML has one paragraph:
  // some clipboard producers omit separators. Only unwrap a single wrapper chain.
  const singleParagraph = paragraphWrappers.every(block =>
    block.textContent === container.textContent
    && paragraphWrappers.every(other => block === other || block.contains(other) || other.contains(block)));
  if (text && !/[\r\n]/.test(text) && singleParagraph && !container.querySelector("br,h1,h2,h3,ul,ol,li,blockquote")) {
    for (const block of paragraphWrappers.reverse()) {
      const inline = document.createElement("span");
      inline.style.cssText = block.style.cssText;
      inline.append(...block.childNodes);
      block.replaceWith(inline);
    }
  }
  return container.textContent || container.querySelector("br") ? container.innerHTML : plainTextHtml(text);
}

function isBlock(node) {
  return /^(DIV|H[1-3]|UL|OL|LI|BLOCKQUOTE)$/.test(node?.nodeName || "");
}

function plainTextHtml(text) {
  const container = document.createElement("div");
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((line, index) => {
    if (index) container.append(document.createElement("br"));
    container.append(document.createTextNode(line));
  });
  return container.innerHTML;
}

export function insertChapterHtml(editor, html) {
  if (!html) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
  // Keep native undo and selection handling where the browser supports it.
  if (document.execCommand("insertHTML", false, html)) return;
  const range = selection.getRangeAt(0);
  const fragment = range.createContextualFragment(html);
  const last = fragment.lastChild;
  range.deleteContents();
  range.insertNode(fragment);
  range.setStartAfter(last);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
