import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
let session;
let values;
const reply = (status, body = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
beforeEach(async () => {
  vi.resetModules();
  values = new Map();
  vi.stubGlobal("localStorage", { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  vi.stubGlobal("fetch", vi.fn());
  session = await import("../../frontend/src/lib/session.js");
});
afterEach(() => vi.unstubAllGlobals());
describe("Shared server-validated session", () => {
  it("does not infer membership from a token while verification is pending", async () => {
    values.set("token", "stale");
    let finish;
    fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const checking = session.refreshSession();
    expect(session.getSession().status).toBe("checking");
    finish(reply(401));
    await checking;
    expect(session.getSession()).toMatchObject({ status: "guest", user: null });
    expect(values.has("token")).toBe(false);
  });
  it("recognizes a cookie-only member and deduplicates checks", async () => {
    fetch.mockResolvedValue(reply(200, { user: { _id: "member", role: "admin" } }));
    await Promise.all([session.refreshSession(), session.refreshSession()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "include", headers: {} });
    expect(session.getSession()).toMatchObject({ status: "authenticated", user: { _id: "member", role: "admin" } });
  });
  it.each([403, 429, 500, 503, "network"])("preserves identity and credentials on %s and allows retry", async status => {
    values.set("token", "valid");
    fetch.mockResolvedValueOnce(reply(200, { user: { _id: "member" } }));
    await session.refreshSession();
    if (status === "network") fetch.mockRejectedValueOnce(new Error("offline"));
    else fetch.mockResolvedValueOnce(reply(status));
    await session.refreshSession();
    expect(session.getSession()).toMatchObject({ status: "error", user: { _id: "member" } });
    expect(values.get("token")).toBe("valid");
    fetch.mockResolvedValueOnce(reply(200, { user: { _id: "member" } }));
    await session.refreshSession();
    expect(session.getSession().status).toBe("authenticated");
  });
  it("expires only on a confirmed 401", async () => {
    fetch.mockResolvedValueOnce(reply(200, { user: { _id: "member" } })).mockResolvedValueOnce(reply(401));
    await session.refreshSession();
    await session.refreshSession();
    expect(session.getSession()).toMatchObject({ status: "guest", user: null });
  });
  it("a stale request cannot restore identity after logout", async () => {
    let finish;
    fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const checking = session.refreshSession();
    fetch.mockResolvedValueOnce(reply(200));
    await session.logoutSession();
    finish(reply(200, { user: { _id: "old" } }));
    await checking;
    expect(session.getSession().status).toBe("guest");
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include" });
  });
  it("a failed logout does not pretend the cookie was cleared", async () => {
    fetch.mockResolvedValueOnce(reply(200, { user: { _id: "member" } })).mockResolvedValueOnce(reply(503));
    await session.refreshSession();
    await expect(session.logoutSession()).rejects.toThrow();
    expect(session.getSession().status).toBe("authenticated");
  });
});

it('forget-session waits for server revocation before clearing identity and sends a stored Bearer credential', async () => {
  values.set('token', 'credential');
  fetch.mockResolvedValueOnce(reply(200, { user: { _id: 'member' } })); await session.refreshSession();
  let finish; fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const forgetting = session.forgetSession();
  expect(session.getSession().status).toBe('authenticated');
  expect(values.get('token')).toBe('credential');
  expect(fetch.mock.calls[1]).toEqual([expect.stringContaining('/auth/logout'), expect.objectContaining({ method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer credential' } })]);
  finish(reply(200)); await forgetting;
  expect(session.getSession().status).toBe('guest'); expect(values.has('token')).toBe(false);
});
it('failed forget-session preserves credentials and can retry', async () => {
  values.set('token', 'credential'); fetch.mockResolvedValueOnce(reply(503));
  await expect(session.forgetSession()).rejects.toThrow(); expect(values.get('token')).toBe('credential');
  fetch.mockResolvedValueOnce(reply(200)); await session.forgetSession(); expect(values.has('token')).toBe(false);
});
