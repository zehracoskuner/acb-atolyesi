import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Isolated loopback replica sets; never use the application's configured database.
const cwd = fileURLToPath(new URL("../", import.meta.url));
const downloadDir = fileURLToPath(new URL("../node_modules/.cache/mongodb-binaries", import.meta.url));
let replica;
try {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14", downloadDir } });
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...process.argv.slice(2)], {
      cwd, stdio: "inherit", windowsHide: true,
      env: { ...process.env, CHAPTER_TEST_MONGO_URI: replica.getUri(), BOOK_DB_TEST: "1", MONGOMS_DOWNLOAD_DIR: downloadDir },
    });
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally {
  await replica?.stop();
}
