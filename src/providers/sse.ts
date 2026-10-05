export async function* sse(
  response: Response,
): AsyncGenerator<Record<string, any>> {
  if (!response.ok)
    throw new Error(
      `Provider HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`,
    );
  if (!response.body) throw new Error("Provider returned no stream");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const data = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        if (data === "[DONE]") {
          yield { _done: true };
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          throw new Error("Invalid provider stream JSON");
        }
        if (parsed.error || parsed.type === "error")
          throw new Error(
            `Provider error: ${JSON.stringify(parsed.error || parsed).slice(0, 1000)}`,
          );
        yield parsed;
      }
      if (done) break;
      if (buffer.length > 1024 * 1024)
        throw new Error("Provider stream frame too large");
    }
    if (buffer.trim()) throw new Error("Incomplete provider stream");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
