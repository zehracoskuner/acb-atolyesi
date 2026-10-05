import { parseDocument } from "htmlparser2";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType } from "docx";
import { sanitizeChapterHtml } from "../utils/sanitizeHtml.js";

export const BOOK_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
};

// Keep legal XML characters (including emoji); remove only invalid control codes.
const clean = text => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "");
const blocks = new Set(["p", "div", "h1", "h2", "h3", "li", "blockquote"]);
const headings = { h1: HeadingLevel.HEADING_2, h2: HeadingLevel.HEADING_3, h3: HeadingLevel.HEADING_4 };

// A shared paragraph representation keeps TXT and DOCX text in agreement.
export function bookParagraphs(snapshot) {
  const paragraphs = [{ heading: HeadingLevel.TITLE, runs: [{ text: clean(snapshot.title) }] }];
  let listId = 0;
  for (const chapter of snapshot.chapters) {
    paragraphs.push({ heading: HeadingLevel.HEADING_1, runs: [{ text: clean(chapter.title) }] });
    let current = null;
    const flush = () => { if (current) paragraphs.push(current); current = null; };
    const ensure = ctx => current ||= { ...ctx.paragraph, runs: [] };
    function walk(node, ctx) {
      if (node.type === "text") {
        const text = clean(node.data.replace(/[\t\r\n ]+/g, " "));
        if (!current && !text.trim()) return;
        ensure(ctx).runs.push({ ...ctx.run, text });
        return;
      }
      if (node.type !== "tag") return;
      const tag = node.name;
      const next = { ...ctx, run: { ...ctx.run }, paragraph: { ...ctx.paragraph } };
      if (["b", "strong"].includes(tag)) next.run.bold = true;
      if (["i", "em"].includes(tag)) next.run.italics = true;
      if (tag === "u") next.run.underline = {};
      if (["s", "strike", "del"].includes(tag)) next.run.strike = true;
      const css = Object.fromEntries((node.attribs.style || "").split(";").filter(Boolean).map(rule => rule.split(":").map(s => s.trim())));
      if (css["font-weight"]) next.run.bold = css["font-weight"] === "bold" || Number(css["font-weight"]) >= 600;
      if (css["font-style"]) next.run.italics = css["font-style"] === "italic";
      if (css["text-decoration"]) {
        next.run.underline = css["text-decoration"] === "underline" ? {} : undefined;
        next.run.strike = css["text-decoration"] === "line-through";
      }
      if (css["text-align"]) next.paragraph.alignment = css["text-align"] === "justify" ? AlignmentType.JUSTIFIED : css["text-align"];
      if (tag === "br") { ensure(next).runs.push({ text: "\n" }); return; }
      if (tag === "ul" || tag === "ol") {
        flush();
        next.list = { id: ++listId, ordered: tag === "ol", index: 0, level: Math.min((ctx.list?.level ?? -1) + 1, 8) };
        for (const child of node.children || []) walk(child, next);
        flush(); return;
      }
      const block = blocks.has(tag);
      if (block) {
        flush();
        next.paragraph.heading = headings[tag];
        if (tag === "blockquote") next.paragraph.indent = { left: 720 };
        if (tag === "li" && ctx.list) {
          next.paragraph.list = { ...ctx.list, index: ++ctx.list.index };
        }
        ensure(next);
      }
      for (const child of node.children || []) walk(child, next);
      if (block) flush();
    }
    const tree = parseDocument(sanitizeChapterHtml(chapter.content));
    for (const node of tree.children) walk(node, { run: {}, paragraph: {} });
    flush();
  }
  return paragraphs;
}

export async function createBookFile(snapshot, format) {
  if (!Object.hasOwn(BOOK_TYPES, format)) throw new Error("Geçersiz dosya biçimi.");
  const paragraphs = bookParagraphs(snapshot);
  if (format === "txt") {
    return Buffer.from(paragraphs.map(p => {
      const prefix = p.list ? `${"  ".repeat(p.list.level)}${p.list.ordered ? p.list.index + "." : "•"} ` : "";
      return prefix + p.runs.map(r => r.text).join("");
    }).join("\n\n") + "\n", "utf8");
  }
  const lists = new Map();
  for (const p of paragraphs) if (p.list) lists.set(p.list.id, p.list);
  const document = new Document({
    creator: "", lastModifiedBy: "", title: snapshot.title,
    styles: { default: { document: { run: { font: "Calibri", size: 24 }, paragraph: { spacing: { after: 160 } } } } },
    numbering: { config: [...lists.values()].map(list => ({
      reference: `list-${list.id}`,
      levels: Array.from({ length: 9 }, (_, level) => ({ level,
        format: list.ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
        text: list.ordered ? `%${level + 1}.` : "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
      })),
    })) },
    sections: [{ children: paragraphs.map(({ runs, list, ...options }) => new Paragraph({
      ...options,
      ...(list ? { numbering: { reference: `list-${list.id}`, level: list.level } } : {}),
      children: runs.flatMap(({ text, ...style }) => text.split("\n").map((part, index) =>
        new TextRun({ ...style, text: part, ...(index ? { break: 1 } : {}) }))),
    })) }],
  });
  return Packer.toBuffer(document);
}
