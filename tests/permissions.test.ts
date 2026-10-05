import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/storage.js";
import { Permissions } from "../src/permissions.js";
import { Tools } from "../src/tools.js";
test("directory aliases share canonical approval scope", async () => {
  const d = await mkdtemp(join(tmpdir(), "alias-")),
    target = join(d, "target"),
    alias = join(d, "alias");
  await mkdir(target);
  await writeFile(join(target, "file"), "hello");
  await symlink(
    target,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  let count = 0;
  const t = new Tools(
    new Permissions(new Store(d), async () => {
      count++;
      return "always";
    }),
    d,
  );
  assert.equal(
    await t.execute("read_file", { path: join(target, "file") }),
    "hello",
  );
  assert.equal(
    await t.execute("read_file", { path: join(alias, "file") }),
    "hello",
  );
  assert.equal(count, 1);
});
test("denial prevents writes and commands", async () => {
  const d = await mkdtemp(join(tmpdir(), "gate-"));
  const path = join(d, "a file.txt");
  await writeFile(path, "before");
  const p = new Permissions(new Store(d), async () => "deny");
  const t = new Tools(p, d);
  await assert.rejects(
    t.execute("write_file", { path, content: "after" }),
    /Denied/,
  );
  assert.equal(await readFile(path, "utf8"), "before");
  await assert.rejects(
    t.execute("terminal", { command: "echo forbidden" }),
    /Denied/,
  );
});
test("always allow is exact scoped and revocable", async () => {
  const d = await mkdtemp(join(tmpdir(), "gate-"));
  let calls = 0;
  const p = new Permissions(new Store(d), async () => {
    calls++;
    return "always";
  });
  const req = {
    operation: "read",
    resource: join(d, "one"),
    description: "read",
  };
  assert.equal(await p.authorize(req), true);
  assert.equal(await p.authorize(req), true);
  assert.equal(calls, 1);
  await p.authorize({ ...req, resource: join(d, "one-extra") });
  assert.equal(calls, 2);
  await p.reset();
  await p.authorize(req);
  assert.equal(calls, 3);
});
test("write preview is shown before approval", async () => {
  const d = await mkdtemp(join(tmpdir(), "gate-"));
  const path = join(d, "file");
  await writeFile(path, "old\n");
  let preview = "";
  const p = new Permissions(new Store(d), async (r) => {
    preview = r.description;
    assert.equal(await readFile(path, "utf8"), "old\n");
    return "allow";
  });
  await new Tools(p, d).execute("write_file", { path, content: "new\n" });
  assert.match(preview, /-old/);
  assert.match(preview, /\+new/);
  assert.equal(await readFile(path, "utf8"), "new\n");
});
