import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Permissions } from "./permissions.js";
import { envReferences, mcpSchema } from "./config.js";
import type { McpConfig } from "./types.js";
export class Mcp {
  private connections = new Map<
    string,
    { client: Client; config: McpConfig }
  >();
  constructor(private permissions: Permissions) {}
  status() {
    return [...this.connections.keys()];
  }
  async connect(name: string, input: McpConfig) {
    if (this.connections.has(name)) throw new Error("Already connected");
    const config = mcpSchema.parse(input);
    if (
      !(await this.permissions.authorize({
        operation: "mcp-connect",
        resource: JSON.stringify([name, config]),
        description: `Connect MCP ${name}\n${JSON.stringify(config, null, 2)}\nstdio starts an executable; HTTP contacts a server.`,
      }))
    )
      throw new Error("Denied");
    const client = new Client({ name: "agent-shell-cli", version: "0.1.0" });
    const transport =
      config.transport === "stdio"
        ? new StdioClientTransport({
            command: config.command!,
            args: config.args,
            env: envReferences(config.env),
            stderr: "ignore",
          })
        : new StreamableHTTPClientTransport(new URL(config.url!), {
            requestInit: { headers: envReferences(config.headerEnv) },
          });
    try {
      await client.connect(transport, { timeout: 15000 });
      this.connections.set(name, { client, config });
    } catch (e) {
      await transport.close().catch(() => {});
      throw e;
    }
  }
  private connection(name: string) {
    const c = this.connections.get(name);
    if (!c) throw new Error(`MCP ${name} is not connected`);
    return c;
  }
  async listTools(name: string) {
    const { client } = this.connection(name);
    let cursor: string | undefined;
    const tools = [];
    do {
      const page = await client.listTools({ cursor });
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    return tools;
  }
  async call(
    name: string,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const c = this.connection(name);
    if (
      !(await this.permissions.authorize({
        operation: "mcp-tool",
        resource: JSON.stringify([name, c.config, tool, args]),
        description: `MCP ${name}/${tool}\n${JSON.stringify(args, null, 2)}`,
      }))
    )
      throw new Error("Denied");
    return JSON.stringify(
      await c.client.callTool({ name: tool, arguments: args }, undefined, {
        timeout: 60000,
      }),
    );
  }
  async disconnect(name: string) {
    const c = this.connection(name);
    try {
      await c.client.close();
    } finally {
      this.connections.delete(name);
    }
  }
  async close() {
    await Promise.allSettled(
      [...this.connections.keys()].map((n) => this.disconnect(n)),
    );
  }
}
