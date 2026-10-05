import type { ProviderConfig, TokenUsage } from "../types.js";
import type {
  GenerateRequest,
  Provider,
  ProviderEvent,
  ToolCall,
} from "./types.js";
import { sse } from "./sse.js";
function parseArgs(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Tool arguments must be an object");
  return value;
}
export class ApiProvider implements Provider {
  constructor(
    private config: ProviderConfig,
    private fetcher: typeof fetch = fetch,
  ) {}
  async *generate(request: GenerateRequest): AsyncGenerator<ProviderEvent> {
    const c = this.config;
    if (!c.model) throw new Error("Set a model with /provider set");
    const key = c.keyEnv ? process.env[c.keyEnv] : undefined;
    if (c.keyEnv && !key)
      throw new Error(`Missing environment variable ${c.keyEnv}`);
    const anthropic = c.kind === "anthropic";
    const base = (
      c.baseUrl ||
      (anthropic ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1")
    ).replace(/\/$/, "");
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    let body: Record<string, unknown>;
    if (anthropic) {
      headers["anthropic-version"] = "2023-06-01";
      if (key) headers["x-api-key"] = key;
      const system = request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const messages = request.messages
        .filter((m) => m.role !== "system")
        .map((m) =>
          m.role === "tool"
            ? {
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: m.toolCallId,
                    content: m.content,
                  },
                ],
              }
            : m.toolCalls
              ? {
                  role: m.role,
                  content: [
                    ...(m.content ? [{ type: "text", text: m.content }] : []),
                    ...m.toolCalls.map((t) => ({
                      type: "tool_use",
                      id: t.id,
                      name: t.name,
                      input: t.arguments,
                    })),
                  ],
                }
              : { role: m.role, content: m.content },
        );
      body = {
        model: c.model,
        max_tokens: c.maxOutputTokens,
        stream: true,
        messages,
        ...(system ? { system } : {}),
        ...(request.tools.length
          ? {
              tools: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters,
              })),
            }
          : {}),
      };
    } else {
      if (key) headers.authorization = `Bearer ${key}`;
      body = {
        model: c.model,
        max_tokens: c.maxOutputTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content || null,
          ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
          ...(m.toolCalls
            ? {
                tool_calls: m.toolCalls.map((t) => ({
                  id: t.id,
                  type: "function",
                  function: {
                    name: t.name,
                    arguments: JSON.stringify(t.arguments),
                  },
                })),
              }
            : {}),
        })),
        ...(request.tools.length
          ? {
              tools: request.tools.map((t) => ({
                type: "function",
                function: t,
              })),
            }
          : {}),
      };
    }
    const response = await this.fetcher(
      `${base}/${anthropic ? "messages" : "chat/completions"}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(300000)]),
      },
    );
    const calls = new Map<
      number,
      {
        id: string;
        name: string;
        raw: string;
        initial?: Record<string, unknown>;
      }
    >();
    let usage: TokenUsage | undefined;
    let completed = false;
    let input = 0;
    for await (const event of sse(response)) {
      if (request.signal.aborted) throw new Error("Cancelled");
      const previousUsage = usage;
      if (anthropic) {
        if (event.type === "message_start") {
          input =
            (event.message?.usage?.input_tokens ?? 0) +
            (event.message?.usage?.cache_creation_input_tokens ?? 0) +
            (event.message?.usage?.cache_read_input_tokens ?? 0);
          usage = {
            input,
            output: event.message?.usage?.output_tokens ?? 0,
            estimated: false,
          };
        }
        if (
          event.type === "content_block_start" &&
          event.content_block?.type === "tool_use"
        ) {
          calls.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            raw: "",
            initial: event.content_block.input,
          });
        }
        if (event.type === "content_block_delta") {
          if (event.delta?.type === "text_delta")
            yield { type: "text", text: event.delta.text };
          if (event.delta?.type === "input_json_delta") {
            const call = calls.get(event.index);
            if (call) call.raw += event.delta.partial_json;
          }
        }
        if (
          event.type === "message_delta" &&
          event.usage?.output_tokens !== undefined
        )
          usage = {
            input,
            output: event.usage.output_tokens,
            estimated: false,
          };
        if (event.type === "message_stop") completed = true;
      } else {
        if (event._done) completed = true;
        const choice = event.choices?.[0];
        if (choice?.delta?.content)
          yield { type: "text", text: choice.delta.content };
        for (const part of choice?.delta?.tool_calls ?? []) {
          const call = calls.get(part.index) ?? { id: "", name: "", raw: "" };
          if (part.id) call.id = part.id;
          if (part.function?.name) call.name += part.function.name;
          if (part.function?.arguments) call.raw += part.function.arguments;
          calls.set(part.index, call);
        }
        if (event.usage)
          usage = {
            input: event.usage.prompt_tokens ?? 0,
            output: event.usage.completion_tokens ?? 0,
            estimated: false,
          };
      }
      if (usage && usage !== previousUsage) yield { type: "usage", usage };
    }
    if (!completed) throw new Error("Provider stream ended without completion");
    for (const call of calls.values()) {
      if (!call.id || !call.name) throw new Error("Incomplete tool call");
      yield {
        type: "tool",
        call: {
          id: call.id,
          name: call.name,
          arguments: call.raw ? parseArgs(call.raw) : (call.initial ?? {}),
        },
      };
    }
    yield { type: "done" };
  }
}
