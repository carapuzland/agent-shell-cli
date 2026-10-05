import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiProvider } from "../src/providers/api.js";
test("reported usage is emitted before a subsequent stream error", async () => {
  const fake: typeof fetch = async () =>
    new Response(
      'data: {"choices":[],"usage":{"prompt_tokens":900,"completion_tokens":2}}\n\ndata: {"error":{"message":"broken"}}\n\n',
    );
  const p = new ApiProvider(
    { kind: "openai", model: "test", maxOutputTokens: 100 },
    fake,
  );
  const events = [];
  await assert.rejects(async () => {
    for await (const e of p.generate({
      messages: [],
      tools: [],
      signal: new AbortController().signal,
    }))
      events.push(e);
  }, /broken/);
  assert.deepEqual(events, [
    { type: "usage", usage: { input: 900, output: 2, estimated: false } },
  ]);
});
test("Anthropic initial usage survives interrupted streams", async () => {
  const fake: typeof fetch = async () =>
    new Response(
      'data: {"type":"message_start","message":{"usage":{"input_tokens":50,"output_tokens":1}}}\n\ndata: {"type":"error","error":{"message":"broken"}}\n\n',
    );
  const p = new ApiProvider(
    { kind: "anthropic", model: "test", maxOutputTokens: 100 },
    fake,
  );
  const events = [];
  await assert.rejects(async () => {
    for await (const e of p.generate({
      messages: [],
      tools: [],
      signal: new AbortController().signal,
    }))
      events.push(e);
  }, /broken/);
  assert.deepEqual(events, [
    { type: "usage", usage: { input: 50, output: 1, estimated: false } },
  ]);
});
test("OpenAI compatible stream normalizes split chunks and usage", async () => {
  let body: any;
  const fake: typeof fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2}}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } },
    );
  };
  const provider = new ApiProvider(
    {
      kind: "openai",
      baseUrl: "http://localhost:1234/v1",
      model: "local",
      maxOutputTokens: 100,
    },
    fake,
  );
  const events = [];
  for await (const event of provider.generate({
    messages: [{ role: "user", content: "hi" }],
    tools: [],
    signal: new AbortController().signal,
  }))
    events.push(event);
  assert.equal(body.model, "local");
  assert.deepEqual(events, [
    { type: "text", text: "hi" },
    { type: "usage", usage: { input: 4, output: 2, estimated: false } },
    { type: "done" },
  ]);
});
test("Anthropic cumulative usage is normalized", async () => {
  const fake: typeof fetch = async () =>
    new Response(
      'data: {"type":"message_start","message":{"usage":{"input_tokens":5,"output_tokens":1}}}\n\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"yes"}}\n\ndata: {"type":"message_delta","usage":{"output_tokens":3}}\n\ndata: {"type":"message_stop"}\n\n',
    );
  const provider = new ApiProvider(
    { kind: "anthropic", model: "test", maxOutputTokens: 100 },
    fake,
  );
  const events = [];
  for await (const e of provider.generate({
    messages: [],
    tools: [],
    signal: new AbortController().signal,
  }))
    events.push(e);
  assert.deepEqual(events.filter((e) => e.type === "usage").at(-1), {
    type: "usage",
    usage: { input: 5, output: 3, estimated: false },
  });
});
