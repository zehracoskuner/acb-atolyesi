import { describe, it, expect } from "vitest";
import { isPublicPage, EXPLORE_PATH } from "../../frontend/src/lib/routes.js";

describe("Guest route boundary", () => {
  it.each([EXPLORE_PATH, "/ke%C5%9Ffet", "/kesfet", "/story/book", "/profile/author", "/landing"])("allows preview route %s", path => {
    expect(isPublicPage(path)).toBe(true);
  });
  it.each(["/library", "/studio", "/profile/me", "/profile/me/", "/profile/%6de", "/notes", "/ayarlar", "/bildirimler", "/work/id", "/read/id", "/admin", "/moderator", "/basvurular", "/broken%"])("requires membership before mounting %s", path => {
    expect(isPublicPage(path)).toBe(false);
  });
});
