import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/storage.js";
import { Chats } from "../src/chats.js";
test("chats survive restart with isolated histories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "shell-"));
  const chats = new Chats(new Store(dir));
  const a = await chats.create("A");
  const b = await chats.create("B");
  await chats.append(a.id, {
    role: "user",
    content: "only A",
    timestamp: new Date().toISOString(),
  });
  const restored = new Chats(new Store(dir));
  assert.equal((await restored.select(a.id)).messages[0].content, "only A");
  assert.equal((await restored.select(b.id)).messages.length, 0);
  await assert.rejects(restored.select("../missing"), /Unknown chat/);
});
test("corrupt storage is not overwritten", async () => {
  const dir = await mkdtemp(join(tmpdir(), "shell-"));
  await writeFile(join(dir, "chats.json"), "{broken");
  await assert.rejects(new Chats(new Store(dir)).list(), /Invalid/);
  assert.equal(await readFile(join(dir, "chats.json"), "utf8"), "{broken");
});
