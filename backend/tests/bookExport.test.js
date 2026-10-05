import { describe, it, expect, vi, afterEach } from "vitest";
import mammoth from "mammoth";
import JSZip from "jszip";
import { Packer } from "docx";
import { createBookFile, bookParagraphs } from "../services/bookExport.js";
import { saveBeforeBookDownload } from "../../frontend/src/lib/bookDownload.js";
import { apiDownloadBook } from "../../frontend/src/lib/api.js";

const book = { title: 'İğde & Şüphe <Öykü> "Çığ"', notes: "SECRET_NOTE", user: "SECRET_USER", chapters: [
  { title: "İlk bölüm", reviewNote: "SECRET_AI", content: '<h1>Ara başlık</h1><p style="text-align:center">Türkçe: ıİşŞğĞüÜöÖçÇ 😀 &amp; &lt;metin&gt;</p><p><strong>Kalın</strong> <em>eğik</em> <u>alt</u> <s>üst</s><br>yeni satır</p><div style="text-align:right"><span style="font-weight:700;font-style:italic;text-decoration:underline">Biçim</span></div><ol><li>Bir</li><li>İki</li></ol><ul><li>Madde</li></ul><p>Son paragraf.</p>' },
  { title: "Yayımlanmamış son bölüm", content: "<p>Son söz: eksiksiz.</p>" },
] };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("book files", () => {
  it("exports title, chapter order, Turkish, entities, paragraphs and no private fields or HTML to TXT", async () => {
    const text = (await createBookFile(book, "txt")).toString("utf8");
    expect(text).toContain(book.title);
    expect(text).toContain("Türkçe: ıİşŞğĞüÜöÖçÇ 😀 & <metin>");
    expect(text).toContain("Kalın eğik alt üst\nyeni satır\n\nBiçim");
    expect(text).toContain("1. Bir\n\n2. İki\n\n• Madde");
    expect(text.indexOf("İlk bölüm")).toBeLessThan(text.indexOf("Yayımlanmamış son bölüm"));
    expect(text).not.toMatch(/SECRET_|<p[ >]|<strong>|&amp;/);
  });
  it("opens a real DOCX with an independent reader and preserves every paragraph and basic formatting", async () => {
    const buffer = await createBookFile(book, "docx");
    const opened = await mammoth.extractRawText({ buffer });
    const expected = bookParagraphs(book).map(p => p.runs.map(r => r.text).join("")).join("\n\n") + "\n\n";
    // Mammoth's raw-text reader ignores line breaks; its HTML reader retains them.
    expect(opened.value).toBe(expected.replace("üst\nyeni", "üstyeni"));
    const html = (await mammoth.convertToHtml({ buffer })).value;
    expect(html).toContain("<br />yeni satır");
    expect(html).toContain("<strong>Kalın</strong>");
    expect(html).toContain("<em>eğik</em>");
    expect(html).toContain("<ol>"); expect(html).toContain("<ul>");
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
    const xml = await zip.file("word/document.xml").async("string");
    expect(xml).toContain('w:val="center"'); expect(xml).toContain('w:val="right"');
    expect(xml).toContain("<w:u"); expect(xml).toContain("<w:strike");
    expect(xml).not.toContain("altChunk"); expect(xml).not.toContain("SECRET_");
  });
  it.each(["docx", "txt"])("handles an empty work (%s)", async format => {
    const buffer = await createBookFile({ title: "Boş eser", chapters: [] }, format);
    const text = format === "docx" ? (await mammoth.extractRawText({ buffer })).value : buffer.toString("utf8");
    expect(text.trim()).toBe("Boş eser");
  });
  it("opens a long DOCX and checks all 12000 paragraphs without truncation", async () => {
    const chapters = Array.from({ length: 80 }, (_, chapter) => ({ title: `Bölüm ${chapter}`, content:
      Array.from({ length: 150 }, (_, p) => `<p>${chapter}:${p} — İstanbul, gökyüzü ve çığlık. ${"Uzun metin. ".repeat(10)}</p>`).join("") }));
    const snapshot = { title: "Uzun eser", chapters };
    const buffer = await createBookFile(snapshot, "docx");
    const text = (await mammoth.extractRawText({ buffer })).value;
    const expected = ["Uzun eser", ...chapters.flatMap((ch, chapter) => [ch.title,
      ...Array.from({ length: 150 }, (_, p) => `${chapter}:${p} — İstanbul, gökyüzü ve çığlık. ${"Uzun metin. ".repeat(10)}`),
    ])].join("\n\n") + "\n\n";
    expect(text).toBe(expected);
  }, 30000);
  it("propagates generation errors instead of producing a partial file", async () => {
    vi.spyOn(Packer, "toBuffer").mockRejectedValue(new Error("compression failed"));
    await expect(createBookFile(book, "docx")).rejects.toThrow("compression failed");
  });
});

describe("save before download", () => {
  const initial = () => [{ _id: "a", _edit: 1, _dirty: true }, { _id: "b", _edit: 2, _dirty: true }];
  it("waits for every chapter save", async () => {
    const chapters = initial();
    const save = vi.fn(async id => { chapters.find(ch => ch._id === id)._dirty = false; return true; });
    await saveBeforeBookDownload(() => chapters, save);
    expect(save.mock.calls).toEqual([["a"], ["b"]]);
  });
  it.each(["failure", "typing", "delete", "add", "inflight", "conflict"])("blocks download after %s", async scenario => {
    let chapters = initial();
    const save = async id => {
      const ch = chapters.find(c => c._id === id);
      if (!ch) return false;
      ch._dirty = false;
      if (id === "a") {
        if (scenario === "failure") return false;
        if (scenario === "typing") ch._edit++;
        if (scenario === "delete") chapters = chapters.slice(0, 1);
        if (scenario === "add") chapters.push({ _id: "c", _edit: 0 });
        if (scenario === "inflight") ch._saving = true;
        if (scenario === "conflict") ch._conflict = {};
      }
      return true;
    };
    await expect(saveBeforeBookDownload(() => chapters, save)).rejects.toThrow();
  });
});

describe("binary download client", () => {
  it.each([
    [500, "application/json", '{"message":"Üretilemedi"}'],
    [200, "text/html", "<html>Login</html>"],
    [200, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ""],
  ])("does not create a download on bad response %s %s", async (status, type, body) => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status, headers: { "Content-Type": type } })));
    const create = vi.spyOn(URL, "createObjectURL");
    await expect(apiDownloadBook("work", "docx")).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
