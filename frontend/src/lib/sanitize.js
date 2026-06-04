// src/lib/sanitize.js
import DOMPurify from "dompurify";

const CONFIG = {
  ALLOWED_TAGS: [
    "p", "div", "br", "span",
    "b", "strong", "i", "em", "u", "s", "strike", "del",
    "h1", "h2", "h3",
    "ul", "ol", "li", "blockquote",
  ],
  ALLOWED_ATTR: ["style"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "href", "src"],
};

export function cleanHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, CONFIG);
}