// Liveness is separate from readiness. No connection strings/errors in responses.
export function createLifecycle({ database, stopWorker, exit, timeoutMs = 10000 }) {
  let draining = false;
  let shutdownTask;
  async function ready(_req, res) {
    res.set("Cache-Control", "no-store");
    if (draining || database.connection.readyState !== 1) return res.status(503).json({ ready: false });
    let timer;
    try {
      await Promise.race([
        database.connection.db.admin().ping({ maxTimeMS: 1000 }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Readiness timeout")), 1500); }),
      ]);
      const available = !draining && database.connection.readyState === 1;
      return res.status(available ? 200 : 503).json({ ready: available });
    } catch { return res.status(503).json({ ready: false }); }
    finally { clearTimeout(timer); }
  }
  function shutdown(server) {
    if (shutdownTask) return shutdownTask;
    draining = true;
    shutdownTask = new Promise(resolve => {
      let finished = false;
      const finish = code => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        exit(code);
        resolve(code);
      };
      const deadline = setTimeout(() => { server.closeAllConnections?.(); finish(1); }, timeoutMs);
      (async () => {
        const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        // Stop scheduling immediately, then drain active requests/worker before DB.
        await Promise.all([closed, stopWorker()]);
        await database.disconnect();
        finish(0);
      })().catch(() => finish(1));
    });
    return shutdownTask;
  }
  return { ready, shutdown };
}
