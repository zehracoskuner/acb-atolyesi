import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { consumeLoginReturn, loginForReturn, rememberLoginReturn, safeReturnPath } from "../../frontend/src/lib/loginReturn.js";

beforeEach(() => {
  const values = new Map();
  vi.stubGlobal("window", { location: { origin: "https://example.test" } });
  vi.stubGlobal("sessionStorage", {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

it("keeps the requested chapter across login and OAuth redirects", () => {
  const destination = "/read/work-id?chapter=chapter-id";
  const login = loginForReturn(destination);
  expect(new URL(login, window.location.origin).searchParams.get("returnTo")).toBe(destination);
  // Google callback/profile setup has no returnTo query; session storage retains it.
  rememberLoginReturn(null);
  expect(consumeLoginReturn()).toBe(destination);
  expect(consumeLoginReturn()).toBe("/keşfet");
});

it.each(["https://other.test", "//other.test", "/\\other.test", "javascript:alert(1)", "/\n/other.test", null])(
  "rejects unsafe return destinations: %s", value => {
    expect(safeReturnPath(value)).toBeNull();
    rememberLoginReturn(value);
    expect(consumeLoginReturn()).toBe("/keşfet");
  }
);

it.each(["/login", "/register?returnTo=/story/a", "/auth/callback", "/sozlesme-kabul", "/profili-tamamla", "/x/../login"])("rejects return loops through membership entry points: %s", path => {
  expect(safeReturnPath(path)).toBeNull();
});
it("keeps an internal story and its fragment", () => {
  rememberLoginReturn("/story/book?tab=comments#comment-1");
  expect(consumeLoginReturn()).toBe("/story/book?tab=comments#comment-1");
});
