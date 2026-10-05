import { test } from "node:test";
import assert from "node:assert/strict";
import { runProcess } from "../src/process.js";
test("terminal process returns exit status and bounded timeout", async () => {
  const r = await runProcess(process.execPath, [
    "-e",
    'process.stdout.write("hello");process.exitCode=3',
  ]);
  assert.equal(r.stdout, "hello");
  assert.equal(r.exitCode, 3);
  const started = Date.now();
  await assert.rejects(
    runProcess(process.execPath, ["-e", "setTimeout(()=>{},10000)"], {
      timeoutMs: 50,
    }),
    /timed out/,
  );
  assert.ok(Date.now() - started < 3000);
});
test("pre-cancelled process is rejected before execution", async () => {
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    runProcess("missing-command", [], { signal: c.signal }),
    /Cancelled/,
  );
});
