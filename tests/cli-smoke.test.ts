import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
test("real CLI streams a local fixture answer, persists metrics and reports limits", async () => {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    let raw = "";
    req.on("data", (b) => (raw += b));
    req.on("end", () => {
      const body = JSON.parse(raw);
      assert.equal(req.url, "/v1/chat/completions");
      assert.equal(body.model, "fixture");
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(
        'data: {"choices":[{"delta":{"content":"fixture answer"}}]}\n\n',
      );
      setTimeout(
        () =>
          res.end(
            'data: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":4}}\n\ndata: [DONE]\n\n',
          ),
        15,
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port,
    dir = await mkdtemp(join(tmpdir(), "cli-smoke-"));
  try {
    const config = JSON.stringify({
      kind: "openai",
      model: "fixture",
      baseUrl: `http://127.0.0.1:${port}/v1`,
    });
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("src/cli.ts"),
        "--command",
        `/provider set ${config}`,
        "--command",
        "hello",
        "--command",
        "/history",
        "--command",
        "/limits",
        "--command",
        "/exit",
      ],
      { env: { ...process.env, AGENT_SHELL_HOME: dir }, windowsHide: true },
    );
    let output = "",
      errors = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (errors += b));
    const exit = await new Promise<number | null>((r, j) => {
      child.on("error", j);
      child.on("close", r);
    });
    assert.equal(exit, 0, errors + output);
    assert.equal(requests, 1);
    assert.match(output, /fixture answer/);
    assert.match(output, /4 tokens · [\d.]+ tok\/s · [\d.]+s/);
    assert.match(output, /"output": 4/);
    assert.match(output, /ASSISTANT/);
  } finally {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  }
});
