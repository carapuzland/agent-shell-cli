import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Store } from "../src/storage.js";
import { Permissions } from "../src/permissions.js";
import { Mcp } from "../src/mcp.js";
test("MCP call propagates cancellation immediately", async () => {
  const d = await mkdtemp(join(tmpdir(), "mcp-"));
  const m = new Mcp(new Permissions(new Store(d), async () => "allow"));
  try {
    await m.connect("test", {
      transport: "stdio",
      command: process.execPath,
      args: [resolve("tests/fixtures/mcp-server.mjs")],
    });
    const controller = new AbortController();
    const started = Date.now();
    const pending = m.call("test", "slow", {}, controller.signal);
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(pending);
    assert.ok(
      Date.now() - started < 1000,
      "cancellation should not wait for tool completion",
    );
  } finally {
    await m.close();
  }
});
test("denied MCP startup does not launch a process", async () => {
  const d = await mkdtemp(join(tmpdir(), "mcp-"));
  const m = new Mcp(new Permissions(new Store(d), async () => "deny"));
  await assert.rejects(
    m.connect("test", { transport: "stdio", command: "does-not-exist" }),
    /Denied/,
  );
  assert.deepEqual(m.status(), []);
});
test("official SDK handshake, tools, approval and disconnect", async () => {
  const d = await mkdtemp(join(tmpdir(), "mcp-"));
  let decision: "allow" | "deny" = "allow";
  const m = new Mcp(new Permissions(new Store(d), async () => decision));
  try {
    await m.connect("test", {
      transport: "stdio",
      command: process.execPath,
      args: [resolve("tests/fixtures/mcp-server.mjs")],
    });
    assert.equal((await m.listTools("test"))[0].name, "echo");
    decision = "deny";
    await assert.rejects(m.call("test", "echo", { text: "hi" }), /Denied/);
    decision = "allow";
    assert.match(await m.call("test", "echo", { text: "hi" }), /hi/);
  } finally {
    await m.close();
  }
  assert.deepEqual(m.status(), []);
});
