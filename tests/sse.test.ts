import { test } from "node:test";
import assert from "node:assert/strict";
import { sse } from "../src/providers/sse.js";
test("SSE preserves UTF-8 text across chunk and CRLF boundaries", async () => {
  const bytes = new TextEncoder().encode(
    'data: {"text":"Привет"}\r\n\r\ndata: [DONE]\r\n\r\n',
  );
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i++) c.enqueue(bytes.slice(i, i + 1));
      c.close();
    },
  });
  const result = [];
  for await (const e of sse(new Response(body))) result.push(e);
  assert.deepEqual(result, [{ text: "Привет" }, { _done: true }]);
});
test("truncated provider streams fail visibly", async () => {
  await assert.rejects(async () => {
    for await (const e of sse(new Response('data: {"partial":true}'))) void e;
  }, /Incomplete/);
});
