import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { health } from "../src/health.js";
import { Store } from "../src/storage.js";
import { defaultConfig } from "../src/types.js";
test("health checks storage and missing provider key without inference", async () => {
  const c = defaultConfig();
  c.provider = {
    kind: "anthropic",
    model: "test",
    keyEnv: "AGENT_SHELL_TEST_MISSING_KEY",
    maxOutputTokens: 100,
  };
  delete process.env.AGENT_SHELL_TEST_MISSING_KEY;
  const report = await health(
    new Store(await mkdtemp(join(tmpdir(), "health-"))),
    c,
    [],
  );
  assert.equal(report.storage.ok, true);
  assert.equal(report.provider.ok, false);
  assert.match(report.provider.detail, /AGENT_SHELL_TEST_MISSING_KEY/);
});
