import { performance } from "node:perf_hooks";
import type { ResponseMetrics, TokenUsage } from "./types.js";
export class ResponseMeter {
  private started: number;
  private first?: number;
  private content = "";
  constructor(private clock = () => performance.now()) {
    this.started = clock();
  }
  text(text: string) {
    this.first ??= this.clock();
    this.content += text;
  }
  finish(usage?: TokenUsage): ResponseMetrics {
    const now = this.clock(),
      elapsedMs = Math.max(0, now - this.started),
      generationMs = Math.max(0, now - (this.first ?? this.started));
    const tokens = usage ?? {
      input: 0,
      output: Math.ceil(this.content.length / 4),
      estimated: true,
    };
    return {
      ...tokens,
      elapsedMs,
      generationMs,
      tokensPerSecond:
        generationMs > 0 ? tokens.output / (generationMs / 1000) : 0,
    };
  }
}
export function footer(m: ResponseMetrics): string {
  return `${m.estimated ? "~" : ""}${m.output} tokens${m.estimated ? " (estimated)" : ""} · ${m.tokensPerSecond.toFixed(1)} tok/s · ${(m.elapsedMs / 1000).toFixed(2)}s`;
}
