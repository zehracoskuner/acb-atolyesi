// backend/utils/sanitizeHtml.js
import sanitizeHtmlLib from "sanitize-html";
import { paragraphAttribute, paragraphTags, paragraphIdPattern } from "../../shared/chapterParagraphs.js";

/*
  Editörün (contentEditable + execCommand) ürettiği HTML'i temizler.
  Whitelist, BubbleToolbar'ın çıkarabileceği etiketlerle hizalı:
  bold/italic/underline/strike, h1/h2, hizalama (style), ul/li, paragraf blokları.
  Bunların dışındaki HER ŞEY (script, on*-handler, iframe, javascript: vb.) atılır.
*/
const ALIGN   = [/^(left|right|center|justify)$/];
const DECOR   = [/^(underline|line-through|none)$/];
const WEIGHT  = [/^(normal|bold|[1-9]00)$/];
const STYLE   = [/^(normal|italic)$/];

const OPTIONS = {
  allowedTags: [
    "p", "div", "br", "span",
    "b", "strong", "i", "em", "u", "s", "strike", "del",
    "h1", "h2", "h3",
    "ul", "ol", "li", "blockquote",
  ],
  // Sadece style attribute'una izin var; href/src/on* hepsi düşer
  allowedAttributes: {
    "*": ["style"],
  },
  // style içinde de sadece güvenli özellikler + güvenli değerler
  allowedStyles: {
    "*": {
      "text-align":      ALIGN,
      "text-decoration": DECOR,
      "font-weight":     WEIGHT,
      "font-style":      STYLE,
    },
  },
  allowedSchemes: [],            // hiçbir url şeması yok (link özelliği yok)
  disallowedTagsMode: "discard", // <script> gibi etiketler içeriğiyle birlikte silinir
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
};

export function sanitizeChapterHtml(html, { paragraphIds = false } = {}) {
  if (!html || typeof html !== "string") return "";
  if (!paragraphIds) return sanitizeHtmlLib(html, OPTIONS);
  return sanitizeHtmlLib(html, {
    ...OPTIONS,
    allowedAttributes: {
      ...OPTIONS.allowedAttributes,
      ...Object.fromEntries(paragraphTags.map(tag => [tag, [paragraphAttribute]])),
    },
    transformTags: {
      "*": (tagName, attribs) => {
        if (!paragraphIdPattern.test(attribs[paragraphAttribute] ?? "")) delete attribs[paragraphAttribute];
        return { tagName, attribs };
      },
    },
  });
}
