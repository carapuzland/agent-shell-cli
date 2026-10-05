import { Store } from "./storage.js";
import { Chats } from "./chats.js";
import {
  Permissions,
  type Decision,
  type PermissionRequest,
} from "./permissions.js";
import { Tools, localToolDefinitions } from "./tools.js";
import { Skills } from "./skills.js";
import { Mcp } from "./mcp.js";
import { Usage } from "./usage.js";
import { Agent } from "./agent.js";
import { loadConfig, saveConfig, mcpSchema } from "./config.js";
import { health } from "./health.js";
import { footer } from "./metrics.js";
import { providerId } from "./providers/index.js";
import type { Config } from "./types.js";
import type { ToolDefinition } from "./providers/types.js";
export interface ShellUI {
  print: (text: string) => void;
  stream: (text: string) => void;
  approve: (request: PermissionRequest) => Promise<Decision>;
  clear: () => void;
}
export const HELP = `Agent Shell · commands
 /help                         Show commands
 /health · /doctor             Runtime, storage, provider and MCP diagnostics
 /status · /config             Current chat, provider and settings
 /limits                       Token usage, local budget and available limits
 /new [title] · /chats          Create or list persistent chats
 /chat <id> · /rename <title>   Switch or rename chat (ID prefixes accepted)
 /history · /clear · /exit      History, clear screen, quit
 /provider                     Show provider settings
 /provider set <JSON>          Set kind/model/baseUrl/keyEnv/maxOutputTokens
 /provider disable             Disable AI
 /provider budget <N|off>      Persistent local token budget per provider/model
 /permissions                  List saved exact-scope approvals
 /permissions reset            Revoke all approvals
 /permissions revoke <id>      Revoke one approval
 /skills                       List connected SKILL.md directories
 /skills create <name>         Create a local skill
 /skills add <path>            Connect a local skill directory
 /skills show <name>           Display instructions
 /skills use <name>            Include skill in current chat context
 /skills unuse <name>          Remove skill from current chat context
 /mcp                         List configured and connected MCP servers
 /mcp add <name> <JSON>        Configure stdio or HTTP server
 /mcp connect <name>           Connect after approval
 /mcp disconnect <name>        Close connection
 /mcp remove <name>            Remove configuration
 /mcp tools <name>             List available tools
 /mcp call <name> <tool> <JSON> Invoke tool after approval
 /read <path>                  Read file after approval
 /write <JSON>                 Write {"path":"...","content":"..."} after diff
 /run <command>                Run terminal command after approval
 /tool <name> <JSON>           Invoke a local tool

AI is disabled until configured. Ctrl+C cancels a request; /exit quits.
Example: /provider set {"kind":"openai","model":"local-model","baseUrl":"http://localhost:1234/v1"}`;
function head(text: string): [string, string] {
  const match = text.trim().match(/^(\S+)(?:\s+([\s\S]*))?$/);
  return match ? [match[1], match[2] || ""] : ["", ""];
}
function object(text: string): Record<string, unknown> {
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected JSON object");
  return value;
}
function pathArg(text: string) {
  return text.replace(/^"([\s\S]*)"$/, "$1").replace(/^'([\s\S]*)'$/, "$1");
}
export class Shell {
  readonly chats: Chats;
  readonly permissions: Permissions;
  readonly tools: Tools;
  readonly skills: Skills;
  readonly mcp: Mcp;
  readonly usage: Usage;
  readonly agent: Agent;
  private chatId = "";
  exiting = false;
  controller?: AbortController;
  constructor(
    readonly store: Store,
    private ui: ShellUI,
  ) {
    this.chats = new Chats(store);
    this.permissions = new Permissions(store, ui.approve);
    this.tools = new Tools(this.permissions);
    this.skills = new Skills(store);
    this.mcp = new Mcp(this.permissions);
    this.usage = new Usage(store);
    this.agent = new Agent(
      this.chats,
      this.usage,
      async (names) => Promise.all(names.map((n) => this.skills.show(n))),
      () => this.definitions(),
      (n, a, s) => this.execute(n, a, s),
      ui.stream,
    );
  }
  async init() {
    await loadConfig(this.store);
    const all = await this.chats.list();
    const state = await this.store.read("state", { chatId: "" });
    const chat =
      all.find((c) => c.id === state.chatId) ||
      all.at(-1) ||
      (await this.chats.create());
    await this.select(chat.id);
  }
  async current() {
    return this.chats.select(this.chatId);
  }
  private async select(id: string) {
    const chat = await this.chats.select(id);
    this.chatId = chat.id;
    await this.store.write("state", { chatId: chat.id });
    return chat;
  }
  async config() {
    return loadConfig(this.store);
  }
  private print(value: unknown) {
    this.ui.print(
      typeof value === "string" ? value : JSON.stringify(value, null, 2),
    );
  }
  async definitions(): Promise<ToolDefinition[]> {
    const result: ToolDefinition[] = [...localToolDefinitions];
    for (const server of this.mcp.status()) {
      const tools = await this.mcp.listTools(server);
      tools.forEach((tool, index) =>
        result.push({
          name: `mcp_${Buffer.from(server).toString("hex")}_${index}`,
          description: `MCP ${server}/${tool.name}: ${tool.description || ""}`,
          parameters: tool.inputSchema,
        }),
      );
    }
    return result;
  }
  private async execute(
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ) {
    if (name.startsWith("mcp_")) {
      const match = name.match(/^mcp_([a-f0-9]+)_(\d+)$/);
      if (!match) throw new Error("Invalid MCP tool name");
      const server = Buffer.from(match[1], "hex").toString(),
        tools = await this.mcp.listTools(server),
        tool = tools[Number(match[2])];
      if (!tool) throw new Error("Unknown MCP tool");
      return this.mcp.call(server, tool.name, args);
    }
    return this.tools.execute(name, args, signal);
  }
  async route(input: string) {
    if (!input.trim()) return;
    const [command, rest] = head(input);
    if (!command.startsWith("/")) {
      const config = await this.config();
      if (config.provider.kind === "disabled") {
        await this.chats.append(this.chatId, {
          role: "user",
          content: input,
          timestamp: new Date().toISOString(),
        });
        this.print(
          "Message saved. AI is disabled; configure /provider to generate responses.",
        );
        return;
      }
      this.controller = new AbortController();
      try {
        const result = await this.agent.respond(
          this.chatId,
          input,
          config,
          this.controller.signal,
        );
        this.print("\n" + footer(result));
      } finally {
        this.controller = undefined;
      }
      return;
    }
    switch (command) {
      case "/help":
        this.print(HELP);
        return;
      case "/exit":
        this.exiting = true;
        return;
      case "/clear":
        this.ui.clear();
        return;
      case "/status": {
        const c = await this.current();
        this.print({
          chat: c.id,
          title: c.title,
          messages: c.messages.length,
          skills: c.skills,
          provider: (await this.config()).provider.kind,
          cwd: process.cwd(),
        });
        return;
      }
      case "/config":
        this.print({
          directory: this.store.directory,
          ...(await this.config()),
        });
        return;
      case "/health":
      case "/doctor":
        this.print(
          await health(this.store, await this.config(), this.mcp.status()),
        );
        return;
      case "/chats": {
        const all = await this.chats.list();
        this.print(
          all
            .map(
              (c) =>
                `${c.id === this.chatId ? "●" : " "} ${c.id}  ${c.title}  (${c.messages.length} messages)`,
            )
            .join("\n"),
        );
        return;
      }
      case "/new": {
        const c = await this.chats.create(rest);
        await this.select(c.id);
        this.print(`Chat ${c.id}: ${c.title}`);
        return;
      }
      case "/chat": {
        const c = await this.select(rest);
        this.print(`Chat ${c.id}: ${c.title}`);
        return;
      }
      case "/rename":
        if (!rest.trim()) throw new Error("Usage: /rename <title>");
        await this.chats.update(this.chatId, (c) => {
          c.title = rest;
        });
        this.print("Renamed");
        return;
      case "/history": {
        const c = await this.current();
        this.print(
          c.messages
            .map(
              (m) =>
                `${m.role.toUpperCase()}\n${m.content}${m.metrics ? "\n" + footer(m.metrics) : ""}`,
            )
            .join("\n\n") || "No messages",
        );
        return;
      }
      case "/provider":
        await this.provider(rest);
        return;
      case "/limits": {
        const c = (await this.config()).provider;
        this.print({
          provider: c.kind,
          model: c.model || "default",
          ...(await this.usage.summary(providerId(c), this.chatId)),
          localBudget: c.budget ?? "not configured",
          accountLimits:
            "unavailable (provider does not expose a supported account quota source)",
          note: "Usage is tokens, not currency. Estimates are marked. Local budgets are distinct from account limits.",
        });
        return;
      }
      case "/permissions": {
        const [verb, arg] = head(rest);
        if (verb === "reset") {
          await this.permissions.reset();
          this.print("All approvals revoked");
        } else if (verb === "revoke") {
          await this.permissions.revoke(arg);
          this.print("Approval revoked");
        } else if (!verb) this.print(await this.permissions.list());
        else throw new Error("Usage: /permissions [reset|revoke <id>]");
        return;
      }
      case "/skills":
        await this.skillCommand(rest);
        return;
      case "/mcp":
        await this.mcpCommand(rest);
        return;
      case "/read":
        this.print(
          await this.tools.execute("read_file", { path: pathArg(rest) }),
        );
        return;
      case "/write":
        this.print(await this.tools.execute("write_file", object(rest)));
        return;
      case "/run":
        this.controller = new AbortController();
        try {
          this.print(
            await this.tools.execute(
              "terminal",
              { command: rest },
              this.controller.signal,
            ),
          );
        } finally {
          this.controller = undefined;
        }
        return;
      case "/tool": {
        const [name, args] = head(rest);
        this.controller = new AbortController();
        try {
          this.print(
            await this.tools.execute(
              name,
              object(args),
              this.controller.signal,
            ),
          );
        } finally {
          this.controller = undefined;
        }
        return;
      }
      default:
        this.print(`Unknown command: ${command}. Use /help.`);
    }
  }
  private async provider(rest: string) {
    const [verb, arg] = head(rest);
    const config = await this.config();
    if (!verb) {
      this.print(config.provider);
      return;
    }
    if (verb === "disable") config.provider.kind = "disabled";
    else if (verb === "set") {
      const value = object(arg);
      if (!value.kind) throw new Error("provider set requires kind");
      config.provider = {
        maxOutputTokens: 4096,
        ...value,
      } as Config["provider"];
    } else if (verb === "budget") {
      if (arg === "off") delete config.provider.budget;
      else {
        const budget = Number(arg);
        if (!Number.isSafeInteger(budget) || budget <= 0)
          throw new Error("Budget must be a positive integer or off");
        config.provider.budget = budget;
      }
    } else
      throw new Error("Usage: /provider [set <JSON>|disable|budget <N|off>]");
    await saveConfig(this.store, config);
    this.print("Provider settings saved. No AI request sent.");
  }
  private async skillCommand(rest: string) {
    const [verb, arg] = head(rest);
    if (!verb) {
      this.print((await this.skills.list()).map(({ instructions, ...s }) => s));
      return;
    }
    if (verb === "create") this.print(await this.skills.create(arg));
    else if (verb === "add") {
      await this.skills.add(pathArg(arg));
      this.print("Skill connected");
    } else if (verb === "show") this.print(await this.skills.show(arg));
    else if (verb === "use") {
      await this.skills.show(arg);
      await this.chats.update(this.chatId, (c) => {
        if (!c.skills.includes(arg)) c.skills.push(arg);
      });
      this.print("Skill selected for current chat");
    } else if (verb === "unuse") {
      await this.chats.update(this.chatId, (c) => {
        c.skills = c.skills.filter((s) => s !== arg);
      });
      this.print("Skill removed from current context");
    } else
      throw new Error("Usage: /skills [create|add|show|use|unuse] <argument>");
  }
  private async mcpCommand(rest: string) {
    const [verb, arg] = head(rest),
      [name, tail] = head(arg),
      config = await this.config();
    if (!verb) {
      this.print({ configured: config.mcp, connected: this.mcp.status() });
      return;
    }
    if (!name) throw new Error("MCP server name required");
    if (verb === "add") {
      if (!/^[a-z][a-z0-9-]{0,23}$/.test(name))
        throw new Error(
          "MCP name must be 1-24 lowercase letters/digits/hyphens",
        );
      if (this.mcp.status().includes(name))
        throw new Error("Disconnect before changing configuration");
      config.mcp[name] = mcpSchema.parse(object(tail));
      await saveConfig(this.store, config);
      this.print("MCP configuration saved; use /mcp connect");
    } else if (verb === "connect") {
      if (!config.mcp[name]) throw new Error("Unknown MCP server");
      await this.mcp.connect(name, config.mcp[name]);
      this.print("Connected");
    } else if (verb === "disconnect") {
      await this.mcp.disconnect(name);
      this.print("Disconnected");
    } else if (verb === "remove") {
      if (this.mcp.status().includes(name)) await this.mcp.disconnect(name);
      delete config.mcp[name];
      await saveConfig(this.store, config);
      this.print("Removed");
    } else if (verb === "tools") this.print(await this.mcp.listTools(name));
    else if (verb === "call") {
      const [tool, args] = head(tail);
      this.print(await this.mcp.call(name, tool, object(args)));
    } else
      throw new Error("Usage: /mcp [add|connect|disconnect|remove|tools|call]");
  }
  async close() {
    this.controller?.abort();
    await this.mcp.close();
  }
}
