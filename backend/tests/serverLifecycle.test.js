import { afterEach, expect, it, vi } from "vitest";
import { createLifecycle } from "../services/serverLifecycle.js";
const response = () => ({ set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() });
const setup = () => {
  const ping = vi.fn().mockResolvedValue({ ok: 1 });
  const database = { connection: { readyState: 1, db: { admin: () => ({ ping }) } }, disconnect: vi.fn().mockResolvedValue() };
  const stopWorker = vi.fn().mockResolvedValue(), exit = vi.fn();
  return { database, stopWorker, exit, ping, ...createLifecycle({ database, stopWorker, exit, timeoutMs: 100 }) };
};
afterEach(() => vi.useRealTimers());
it('readiness probes MongoDB and returns no connection details', async () => {
  const context = setup(), res = response(); await context.ready({}, res);
  expect(context.ping).toHaveBeenCalledWith({ maxTimeMS: 1000 });
  expect(res.status).toHaveBeenCalledWith(200); expect(res.json).toHaveBeenCalledWith({ ready: true });
  expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
});
it.each([0, 2, 3])('readiness rejects DB state %s', async state => {
  const context = setup(), res = response(); context.database.connection.readyState = state;
  await context.ready({}, res); expect(res.status).toHaveBeenCalledWith(503); expect(context.ping).not.toHaveBeenCalled();
});
it('does not leak database errors through readiness', async () => {
  const context = setup(), res = response(); context.ping.mockRejectedValue(new Error('sensitive connection details'));
  await context.ready({}, res); expect(res.status).toHaveBeenCalledWith(503); expect(res.json).toHaveBeenCalledWith({ ready: false });
});
it('bounds a hung readiness probe', async () => {
  vi.useFakeTimers(); const context = setup(), res = response(); context.ping.mockReturnValue(new Promise(() => {}));
  const ready = context.ready({}, res); await vi.advanceTimersByTimeAsync(1500); await ready;
  expect(res.status).toHaveBeenCalledWith(503);
});
it('shutdown drains HTTP and the worker before disconnecting, and runs once', async () => {
  const context = setup(); let close, stop;
  const server = { close: vi.fn(callback => { close = callback; }) };
  context.stopWorker.mockReturnValue(new Promise(resolve => { stop = resolve; }));
  const task = context.shutdown(server); expect(context.shutdown(server)).toBe(task);
  const res = response(); await context.ready({}, res); expect(res.status).toHaveBeenCalledWith(503);
  close(); await Promise.resolve(); expect(context.database.disconnect).not.toHaveBeenCalled();
  stop(); expect(await task).toBe(0); expect(context.database.disconnect).toHaveBeenCalledOnce();
  expect(server.close).toHaveBeenCalledOnce(); expect(context.exit).toHaveBeenCalledWith(0);
});
it('forces hung connections closed when the shutdown deadline expires', async () => {
  vi.useFakeTimers(); const context = setup(), server = { close: vi.fn(), closeAllConnections: vi.fn() };
  const task = context.shutdown(server); await vi.advanceTimersByTimeAsync(100);
  expect(await task).toBe(1); expect(server.closeAllConnections).toHaveBeenCalledOnce(); expect(context.exit).toHaveBeenCalledWith(1);
});
it('reports failed database shutdown as an unsuccessful exit', async () => {
  const context = setup(); context.database.disconnect.mockRejectedValue(new Error('database close failed'));
  expect(await context.shutdown({ close: callback => callback() })).toBe(1);
});
