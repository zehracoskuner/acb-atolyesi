import { parseDocument } from "htmlparser2";
const blockTags = new Set(["p", "div", "h1", "h2", "h3", "blockquote", "li"]);

export function notePlainText(html) {
  let text = "";
  let atBlockEnd = false;
  const visit = node => {
    if (node.type === "text" || node.name === "br") {
      text += node.type === "text" ? node.data : "\n";
      atBlockEnd = false;
      return;
    }
    const children = node.children || [];
    const block = blockTags.has(node.name);
    if (block && text && !text.endsWith("\n")) text += "\n";
    const start = text.length;
    // Chromium uses a single break to keep an empty editable line visible.
    if (!(node.name === "div" && children.length === 1 && children[0].name === "br")) children.forEach(visit);
    if (block && (text.length === start || !atBlockEnd)) {
      text += "\n";
      atBlockEnd = true;
    }
  };
  parseDocument(html).children.forEach(visit);
  return atBlockEnd ? text.slice(0, -1) : text;
}
