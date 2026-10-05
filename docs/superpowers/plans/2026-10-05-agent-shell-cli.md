# Agent Shell CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver a tested public CLI foundation with independent chats, tools, permissions, skills, MCP and optional providers.

**Architecture:** A TypeScript CLI routes slash commands into services. A single tool dispatcher enforces permission decisions; provider adapters expose normalized streaming events. Persistent chat messages include response metrics and usage.

**Tech Stack:** Node.js 22+, TypeScript, official MCP SDK, terminal prompt library, Node test runner.

**Spec:** ../specs/2026-10-05-agent-shell-cli-design.md

## Global Constraints

- No AI provider is selected, credentials supplied, or AI request sent by default.
- Support Windows, macOS and Linux.
- Read keys from explicitly configured environment variables, never committed configuration.
- Permissions are an approval mechanism, not an OS sandbox.
- Public MIT-licensed repository: carapuzland/agent-shell-cli.
- No paid calls are needed for verification.

## Review Focus

- Corrupt runtime JSON must produce an actionable error without overwriting the original.
- Paths containing spaces and symlink aliases must preserve exact permission scope.
- Cancellation and provider errors must preserve earlier chat history.
- Missing usage must produce marked estimates rather than false exact counts.
- MCP disconnect and process termination must release resources.

### Task 1: Offline shell and durable chats

**Files:** package.json, tsconfig.json, .gitignore, src/cli.ts, src/ui.ts, src/commands.ts, src/storage.ts, src/chats.ts, src/types.ts, tests/chats.test.ts, tests/commands.test.ts.

**Interfaces:** `Store.read<T>(name: string, fallback: T): Promise<T>`; `Store.write<T>(name: string, value: T): Promise<void>`; `Chats.create(title?: string): Promise<Chat>`; `Chats.select(id: string): Promise<Chat>`; `Chats.append(id: string, message: Message): Promise<void>`; `route(input: string, context: CommandContext): Promise<void>`. Message has role, content, timestamp and optional metrics.

- [ ] Write tests asserting two chats preserve separate messages after reopening; unknown chat IDs throw; corrupt JSON is preserved; `/clear` preserves messages; unknown commands show help hints.
- [ ] Run `npm test` and confirm the new assertions fail before implementation.
- [ ] Implement atomic JSON storage, validation, platform data directory override, interactive startup, offline message handling, chat commands, status/help/clear/exit and cancellation lifecycle.
- [ ] Run `npm test` and `npm run typecheck`; expect all current tests to pass.
- [ ] Commit `feat: add offline shell and persistent chats`.

### Task 2: Approved file and terminal tools

**Files:** src/permissions.ts, src/tools.ts, tests/permissions.test.ts, tests/tools.test.ts.

**Interfaces:** `Permissions.authorize(request: PermissionRequest): Promise<boolean>` with injected prompt returning allow/deny/always; `Permissions.revoke(id: string): Promise<void>`; `Tools.execute(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>`.

- [ ] Write tests asserting denied writes and commands execute nothing; always rules match only the approved operation/resource; revocation restores prompting; spaces and symlink aliases use canonical paths; write preview appears before approval.
- [ ] Run `npm test`; expect these cases to fail before implementation.
- [ ] Implement permission persistence, readable preview, canonical paths, read/write/run tools, timeout/output bounds and cancellation. Add `/permissions` and explicit manual tool commands so offline capabilities can be exercised.
- [ ] Run tests and typecheck; expect pass.
- [ ] Commit `feat: gate local tools with scoped permissions`.

### Task 3: Skills and MCP connections

**Files:** src/skills.ts, src/mcp.ts, tests/skills.test.ts, tests/mcp.test.ts, tests/fixtures/mcp-server.ts, examples/skills/example/SKILL.md, examples/config.json.

**Interfaces:** `Skills.create(name: string): Promise<string>`; `Skills.add(path: string): Promise<void>`; `Skills.list(): Promise<Skill[]>`; `Mcp.connect(name: string): Promise<void>`; `Mcp.listTools(name: string): Promise<McpTool[]>`; `Mcp.call(name: string, tool: string, args: Record<string, unknown>): Promise<ToolResult>`; `Mcp.close(): Promise<void>`.

- [ ] Write tests for invalid/duplicate skill names and missing files, denied MCP startup/tool invocation, SDK handshake/tool listing against a local fixture and cleanup after disconnect.
- [ ] Run tests; confirm failure before implementation.
- [ ] Implement SKILL.md discovery/metadata, selected instruction context, stdio/Streamable HTTP connection configuration with environment references, SDK lifecycle and permission-gated tool calls. Add `/skills` and `/mcp` commands.
- [ ] Run tests/typecheck; expect pass without remote servers.
- [ ] Commit `feat: add skill management and MCP connections`.

### Task 4: Optional providers, metrics and limits

**Files:** src/providers/types.ts, src/providers/index.ts, src/providers/openai.ts, src/providers/anthropic.ts, src/providers/cli.ts, src/metrics.ts, src/usage.ts, tests/providers.test.ts, tests/metrics.test.ts, tests/usage.test.ts.

**Interfaces:** `Provider.generate(request: GenerateRequest): AsyncIterable<ProviderEvent>`; events represent text, tool calls, usage and completion. `Usage.record(chatId: string, usage: TokenUsage): Promise<void>`; `Usage.checkBudget(): Promise<void>`; `measureResponse(events: AsyncIterable<ProviderEvent>): Promise<ResponseMetrics>`.

- [ ] Write mocked streaming tests asserting provider/model stays disabled by default; keys are read from environment; normalized usage is persisted; absent output usage is marked estimated; elapsed time and speed use a monotonic clock; exhausted local budgets block later requests; failed/cancelled responses do not append successful assistant messages.
- [ ] Run tests; confirm failure before implementation.
- [ ] Verify supported provider API/CLI interfaces in primary documentation before coding adapters. Implement custom OpenAI-compatible and Anthropic API streams, optional Codex/Anthropic CLI adapters, model/provider configuration, permission-gated shell tool dispatch where supported and response footer. Make CLI delegation permission boundaries explicit.
- [ ] Implement `/limits` with session/chat usage, persistent budgets and unavailable markers for unsupported account quota sources.
- [ ] Run mocked tests/typecheck; expect pass with no live AI requests.
- [ ] Commit `feat: add optional providers and response accounting`.

### Task 5: Diagnostics, documentation and publication

**Files:** src/health.ts, tests/health.test.ts, README.md, LICENSE, .github/workflows/ci.yml.

**Interfaces:** `health(context: HealthContext): Promise<HealthReport>` checks runtime, storage, selected provider requirements and MCP state without inference.

- [ ] Write tests asserting missing CLI/key/config yields actionable diagnostics and health sends no paid request.
- [ ] Run tests; confirm failure before implementation.
- [ ] Implement `/health`, `/doctor`, `/config` with redacted settings and all documented help examples. Document install/build/start, chats, metrics definitions, skills, MCP, API setup, CLI delegation and security limits. Add MIT license and Windows/Linux CI.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, then scripted CLI startup/help/health/offline message/exit smoke tests. Inspect git diff for credentials and unwanted runtime data.
- [ ] Perform whole-project review against the spec, correct findings and rerun affected checks.
- [ ] Commit verified source, create public repository with `gh repo create carapuzland/agent-shell-cli --public --source . --push`, verify visibility/default branch and report URL and actual limitations.
