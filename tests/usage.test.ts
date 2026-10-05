import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/storage.js";
import { Usage } from "../src/usage.js";
test("usage persists, isolates provider/chat and enforces configured budget", async () => {
  const d = await mkdtemp(join(tmpdir(), "usage-"));
  const u = new Usage(new Store(d));
  await u.record("chat-a", "openai:model", {
    input: 3,
    output: 7,
    estimated: false,
  });
  assert.equal((await u.summary("openai:model", "chat-a")).chat.output, 7);
  assert.equal((await u.summary("openai:model", "chat-b")).chat.output, 0);
  assert.equal((await u.summary("anthropic:model", "chat-a")).total.output, 0);
  const restored = new Usage(new Store(d));
  await assert.rejects(restored.checkBudget("openai:model", 10), /budget/);
  assert.equal(
    (await restored.summary("openai:model", "chat-a")).total.input,
    3,
  );
  assert.equal(
    (await restored.summary("openai:model", "chat-a")).session.output,
    0,
  );
});
