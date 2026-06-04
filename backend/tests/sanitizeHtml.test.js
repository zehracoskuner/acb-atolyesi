// backend/tests/sanitizeHtml.test.js
import { describe, it, expect } from "vitest";
import { sanitizeChapterHtml } from "../utils/sanitizeHtml.js";

describe("sanitizeChapterHtml — XSS koruması", () => {
  it("<script> etiketini ve içeriğini atar", () => {
    const out = sanitizeChapterHtml('<p>merhaba</p><script>alert("xss")</script>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain("alert");
    expect(out).toContain("merhaba");
  });

  it("onerror taşıyan <img> etiketini atar", () => {
    const out = sanitizeChapterHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toMatch(/<img/i);
  });

  it("izinli etikette bile olay yöneticisini (onclick) temizler", () => {
    const out = sanitizeChapterHtml('<div onclick="evil()">tıkla</div>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("tıkla"); // metin korunur, öznitelik atılır
  });

  it("javascript: bağlantısını ve <a> etiketini atar, metni korur", () => {
    const out = sanitizeChapterHtml('<a href="javascript:alert(1)">bağlantı</a>');
    expect(out).not.toContain("javascript:");
    expect(out).not.toMatch(/<a[ >]/i);
    expect(out).toContain("bağlantı");
  });

  it("<iframe> gibi gömülü içeriği atar", () => {
    const out = sanitizeChapterHtml('<iframe src="http://evil.com"></iframe><p>metin</p>');
    expect(out).not.toMatch(/<iframe/i);
    expect(out).toContain("metin");
  });
});

describe("sanitizeChapterHtml — meşru biçimlendirme korunur", () => {
  it("kalın, italik ve başlık etiketlerini korur", () => {
    const out = sanitizeChapterHtml("<h1>Başlık</h1><p><b>kalın</b> ve <i>italik</i></p>");
    expect(out).toMatch(/<h1/i);
    expect(out).toMatch(/<b>/i);
    expect(out).toMatch(/<i>/i);
  });

  it("güvenli metin hizalama stilini korur", () => {
    const out = sanitizeChapterHtml('<div style="text-align:center">orta</div>');
    expect(out).toContain("text-align");
    expect(out).toContain("center");
  });

  it("liste etiketlerini korur", () => {
    const out = sanitizeChapterHtml("<ul><li>bir</li><li>iki</li></ul>");
    expect(out).toMatch(/<ul>/i);
    expect(out).toMatch(/<li>/i);
  });

  it("boş veya geçersiz girdide boş dize döndürür", () => {
    expect(sanitizeChapterHtml("")).toBe("");
    expect(sanitizeChapterHtml(null)).toBe("");
    expect(sanitizeChapterHtml(undefined)).toBe("");
  });
});