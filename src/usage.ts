import { z } from "zod";
import { Store } from "./storage.js";
import type { TokenUsage } from "./types.js";
const schema = z.array(
  z.object({
    chatId: z.string(),
    provider: z.string(),
    session: z.string(),
    timestamp: z.string(),
    usage: z.object({
      input: z.number().finite().nonnegative(),
      output: z.number().finite().nonnegative(),
      estimated: z.boolean(),
    }),
  }),
);
type Entry = z.infer<typeof schema>[number];
export class Usage {
  private session = crypto.randomUUID();
  constructor(private store: Store) {}
  private async entries(): Promise<Entry[]> {
    const p = schema.safeParse(await this.store.read("usage", []));
    if (!p.success) throw new Error("Invalid usage data");
    return p.data;
  }
  async record(chatId: string, provider: string, usage: TokenUsage) {
    const all = await this.entries();
    all.push({
      chatId,
      provider,
      session: this.session,
      timestamp: new Date().toISOString(),
      usage,
    });
    await this.store.write("usage", schema.parse(all));
  }
  async summary(provider: string, chatId: string) {
    const entries = (await this.entries()).filter(
      (e) => e.provider === provider,
    );
    const sum = (all: Entry[]) =>
      all.reduce(
        (a, e) => ({
          input: a.input + e.usage.input,
          output: a.output + e.usage.output,
          estimated: a.estimated || e.usage.estimated,
        }),
        { input: 0, output: 0, estimated: false },
      );
    return {
      total: sum(entries),
      session: sum(entries.filter((e) => e.session === this.session)),
      chat: sum(entries.filter((e) => e.chatId === chatId)),
    };
  }
  async checkBudget(provider: string, budget?: number) {
    if (budget === undefined) return;
    const { total } = await this.summary(provider, "");
    if (total.input + total.output >= budget)
      throw new Error(
        `Local token budget (${budget}) exhausted. Adjust /provider budget explicitly.`,
      );
  }
}
