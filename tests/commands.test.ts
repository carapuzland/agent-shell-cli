import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Shell } from "../src/commands.js";
import { Store } from "../src/storage.js";
test("external CLI delegation needs permission before starting provider", async () => {
  const store = new Store(await mkdtemp(join(tmpdir(), "cli-gate-")));
  let approved = 0;
  const s = new Shell(store, {
    print: () => {},
    stream: () => {},
    approve: async (request) => {
      assert.equal(request.operation, "provider-cli");
      approved++;
      return "deny";
    },
    clear: () => {},
  });
  const previousPath = process.env.PATH;
  process.env.PATH = "";
  try {
    await s.init();
    await s.route('/provider set {"kind":"codex"}');
    await assert.rejects(s.route("hello"), /Denied/);
    assert.equal(approved, 1);
    assert.equal((await s.current()).messages.length, 0);
  } finally {
    process.env.PATH = previousPath;
    await s.close();
  }
});
test("offline routing preserves chats, clears only screen and diagnoses unknown commands", async () => {
  const out: string[] = [];
  const s = new Shell(new Store(await mkdtemp(join(tmpdir(), "shell-"))), {
    print: (t) => out.push(t),
    stream: () => {},
    approve: async () => "deny",
    clear: () => out.push("CLEARED"),
  });
  await s.init();
  await s.route("hello offline");
  assert.match(out.at(-1)!, /disabled/);
  assert.equal((await s.current()).messages.length, 1);
  const id = (await s.current()).id;
  await s.route("/new second");
  assert.equal((await s.current()).messages.length, 0);
  await s.route("/chat " + id);
  await s.route("/clear");
  assert.equal((await s.current()).messages.length, 1);
  await s.route("/what");
  assert.match(out.at(-1)!, /Unknown command/);
  await s.close();
});
test("provider is disabled by default and invalid configuration does not persist", async () => {
  const out: string[] = [];
  const store = new Store(await mkdtemp(join(tmpdir(), "shell-")));
  const s = new Shell(store, {
    print: (t) => out.push(t),
    stream: () => {},
    approve: async () => "deny",
    clear: () => {},
  });
  await s.init();
  await s.route("/provider");
  assert.match(out.at(-1)!, /disabled/);
  await assert.rejects(s.route('/provider set {"kind":"bogus"}'));
  await s.route("/limits");
  assert.match(out.at(-1)!, /unavailable/);
  await s.close();
});
