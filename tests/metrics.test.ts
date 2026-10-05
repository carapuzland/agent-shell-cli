import { test } from "node:test";
import assert from "node:assert/strict";
import { ResponseMeter } from "../src/metrics.js";
test("footer uses reported output tokens and monotonic durations", () => {
  let now = 0;
  const m = new ResponseMeter(() => now);
  now = 100;
  m.text("hello");
  now = 1100;
  const r = m.finish({ input: 12, output: 20, estimated: false });
  assert.equal(r.output, 20);
  assert.equal(r.elapsedMs, 1100);
  assert.equal(r.generationMs, 1000);
  assert.equal(r.tokensPerSecond, 20);
  assert.equal(r.estimated, false);
});
test("missing usage is explicitly estimated", () => {
  let now = 1;
  const m = new ResponseMeter(() => now);
  m.text("abcdefgh");
  now = 1001;
  assert.equal(m.finish().estimated, true);
  assert.equal(m.finish().output, 2);
});
