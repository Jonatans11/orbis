import { defineConfig } from "vitest/config";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Give every test run a fresh SQLite database so tests never see state
// from previous runs (unique DID constraints, accumulated usage logs, ...).
const testDbPath = join(mkdtempSync(join(tmpdir(), "orbis-test-")), "team.db");

export default defineConfig({
  test: {
    env: {
      TEAM_DB_PATH: testDbPath,
    },
    // The three suites share one SQLite file; run them sequentially to
    // avoid cross-file write races on the shared team-db.
    fileParallelism: false,
  },
});
