# Agent Shell CLI

A small, provider-neutral agent shell inspired by Claude Code. **AI is disabled by default.** You can use chats, skills, MCP and permission-gated local tools without connecting a model.

[Инструкция на русском](README.ru.md)

## Quick start

Requires Node.js 22 or newer and npm. Works with Windows, macOS and Linux.

```sh
git clone https://github.com/carapuzland/agent-shell-cli.git
cd agent-shell-cli
npm ci
npm run build
node dist/cli.js
```

Optional: `npm link` installs the local `agent-shell` command. This repository is the distribution source; no npm registry release is required.

```text
  ◆ Agent Shell  v0.1.0
  Chats · Skills · MCP · Permission-gated tools

New chat › /new Refactor parser
Refactor parser › /health
Refactor parser › /chats
```

For scripts, use `node dist/cli.js --command "/health" --command "/limits"`. Noninteractive permission prompts default to **Deny**; already saved exact-scope approvals still apply. `--help` and `--version` need no runtime storage.

## Commands

| Command | Purpose |
| --- | --- |
| `/help` | Full command reference and examples |
| `/health`, `/doctor` | Runtime, writable storage, missing CLI/key and MCP diagnostics; no inference request |
| `/status`, `/config` | Current chat/provider, working directory and configuration location |
| `/limits` | Session, chat and persistent provider token usage; configured local budget; account-limit availability |
| `/new [title]`, `/chats`, `/chat <id>` | Create, list and switch persistent chats; unique ID prefixes accepted |
| `/rename <title>`, `/history` | Rename current chat; inspect messages and metrics |
| `/clear`, `/exit` | Clear screen without deleting history; close connections and quit |
| `/provider`, `/provider set <JSON>`, `/provider disable` | Inspect, configure or disable AI |
| `/provider budget <N\|off>` | Set or remove a persistent token budget for the selected provider/model |
| `/permissions`, `/permissions revoke <id>`, `/permissions reset` | List and revoke saved approvals |
| `/skills` | List connected skills |
| `/skills create <name>`, `/skills add <path>`, `/skills show <name>` | Scaffold, connect and inspect SKILL.md |
| `/skills use <name>`, `/skills unuse <name>` | Select instructions independently for the current chat |
| `/mcp` | Configured servers and live connections |
| `/mcp add <name> <JSON>`, `/mcp remove <name>` | Configure or remove a server |
| `/mcp connect <name>`, `/mcp disconnect <name>`, `/mcp tools <name>` | Manage connections and list tools |
| `/mcp call <name> <tool> <JSON>` | Invoke an MCP tool after approval |
| `/read <path>`, `/write <JSON>`, `/run <command>` | Approved local tools, usable offline |
| `/tool <name> <JSON>` | Invoke `read_file`, `write_file` or `terminal` |

## Providers

Configuration stores **environment variable names**, never API key values. Set keys before starting the shell:

```powershell
# Windows PowerShell, current terminal only
$env:ANTHROPIC_API_KEY = 'your-key'
node dist/cli.js
```

```sh
# macOS/Linux, current terminal only
export ANTHROPIC_API_KEY='your-key'
node dist/cli.js
```

Inside the shell, select the adapter explicitly. Replace model placeholders with a model your provider supports.

```text
/provider set {"kind":"anthropic","model":"YOUR_CLAUDE_MODEL","keyEnv":"ANTHROPIC_API_KEY","maxOutputTokens":4096}
/provider set {"kind":"openai","model":"YOUR_MODEL","keyEnv":"OPENAI_API_KEY"}
```

### Custom and local services

Use an **OpenAI-compatible Chat Completions endpoint**, for example a local service exposed by Unsloth Studio, LM Studio or another compatible server. Include `/v1` when required by the server. A hosted service can use any environment variable name for its key:

```text
/provider set {"kind":"openai","model":"local-model","baseUrl":"http://localhost:1234/v1"}
/provider set {"kind":"openai","model":"custom-model","baseUrl":"https://your-provider.example/v1","keyEnv":"CUSTOM_API_KEY"}
```

The adapter uses SSE, `stream_options.include_usage`, `max_tokens` and standard function tool calls. A service that lacks one of these capabilities may reject the request; unsupported usage is estimated when omitted. This is a compatibility adapter, not an implementation of Unsloth Studio's UI or private API.

### Codex and Claude CLI

Install and authenticate the external CLI separately; the shell reuses its normal authentication without reading credentials.

```text
/provider set {"kind":"codex"}
/provider set {"kind":"claude","model":"sonnet"}
```

The foundation delegates **text responses** to these CLIs after an explicit Allow/Deny/Always allow decision, and passes the selected chat transcript each time. Codex uses read-only sandbox, ephemeral execution and ignored user configuration/rules. Claude disables built-in tools, inherited MCP connections, hooks and slash commands while retaining normal authentication. Managed external CLI policies may still apply. Use a current CLI supporting these flags; flag errors are surfaced, never retried with weaker settings.

API adapters use the shell's file/terminal/MCP tool loop. CLI adapters do not bridge these tools into the external CLI; use `/read`, `/write`, `/run` and `/mcp call` manually, or an API adapter for autonomous permission-gated tool calls. External CLI execution has its own security boundary: Codex read-only execution can read files and perform permitted read-only commands without individual shell prompts. The shell's approvals are not an OS sandbox.

## Response metrics and limits

Every completed assistant answer has a persisted footer:

```text
256 tokens · 42.7 tok/s · 6.82s
~256 tokens (estimated) · 42.7 tok/s · 6.82s
```

- **Tokens:** reported output tokens across all model rounds, including tool-generation or internal tokens when the provider includes them.
- **Speed:** output tokens divided by accumulated time from first text chunk to the end of each API round. A round without text uses its full request duration. CLI responses are buffered, so their speed uses the full CLI request duration, including startup. This is measured response throughput, not a hardware benchmark.
- **Time:** total turn duration, including tool execution and time spent answering approval prompts.
- **Estimates:** approximately one token per four text characters; input estimates use the textual transcript. These are rough and do not reliably count tool schemas, reasoning or partial failed requests.

`/limits` separates current session, current chat and all saved usage for the configured provider/model/endpoint/key-variable identity. Usage is persisted across restarts. CLI-reported usage describes its model calls; it is not proof of API billing. Cached Anthropic input tokens are included in input totals.

`/provider budget 100000` prevents a new model request after known accumulated input + output reaches the local budget. An in-flight request can exceed it. Changing provider/model selects a separate ledger. Failed calls retain reported usage when available; an interrupted request without usage cannot reveal the exact bill. `/limits` marks account quotas/reset times **unavailable** instead of inventing them. No prices or currency costs are assumed.

## Permissions

Every shell file read/write, terminal execution, MCP connection and MCP tool call goes through **Deny / Allow once / Always allow**. Deny is the default selection. File writes show a unified diff first. Always allow is scoped to the exact operation and canonical path, exact command + working directory, or exact MCP server configuration/tool/arguments. Revoke it with `/permissions` commands.

```text
/read "C:\Projects\My App\README.md"
/write {"path":"notes.txt","content":"hello\n"}
/run git status
/permissions reset
```

Files and command output are bounded to 1 MiB; terminal commands have a two-minute timeout. Ctrl+C cancels model, terminal or MCP requests. Remote MCP cancellation is cooperative: the server may already have performed side effects or may ignore cancellation. API requests and CLI provider calls have a five-minute bound; MCP handshakes and tool calls have their own timeouts. Filesystem paths are resolved before approval and checked again before writes; concurrent hostile filesystem manipulation is not a supported sandbox threat model.

## Skills

```text
/skills create review
/skills add "C:\my-skills\code-review"
/skills show review
/skills use review
```

Skills are ordinary local directories with a `SKILL.md` file and simple frontmatter:

```markdown
---
name: review
description: Review changes for correctness
---

Explain the intended behavior, inspect relevant files and report actionable bugs.
```

Names use lowercase letters, digits and hyphens. The foundation supports plain single-line `name` and `description` metadata rather than a full YAML parser. Selected instructions are included in a chat's model context and cannot grant tool permission. Edit the file with any editor or an approved `/write` call; changes are loaded for subsequent requests.

## MCP

Uses the official MCP TypeScript SDK, supporting **stdio** and **Streamable HTTP**. Configuration alone launches nothing:

```text
/mcp add files {"transport":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","C:/Projects"]}
/mcp connect files
/mcp tools files
/mcp call files list_directory {"path":"C:/Projects"}
/mcp disconnect files
```

HTTP and secret references:

```text
/mcp add remote {"transport":"http","url":"http://localhost:3000/mcp","headerEnv":{"Authorization":"MCP_AUTHORIZATION"}}
/mcp add service {"transport":"stdio","command":"service-mcp","env":{"SERVICE_KEY":"SERVICE_API_KEY"}}
```

`env` maps child variable names to parent environment variable names. `headerEnv` maps header names to environment variable names containing the full header value (for example `Bearer ...`). MCP children receive SDK standard environment variables plus explicitly mapped variables, not the shell's entire environment. OAuth setup, legacy SSE transport, resources/prompts UI and elicitation UI are outside this foundation.

Connected MCP tools are offered to API providers. Every invocation requires its own permission decision. Server configuration is part of saved permission scope; changing a connection invalidates prior matching grants. Closing the shell closes connections.

## Storage and development

Runtime data is outside the repository:

- Windows: `%LOCALAPPDATA%/agent-shell`
- macOS: `~/Library/Application Support/agent-shell`
- Linux: `$XDG_DATA_HOME/agent-shell` or `~/.local/share/agent-shell`
- Override: `AGENT_SHELL_HOME` (use a separate directory for tests).

JSON writes use a temporary file and rename. Invalid configuration/chat/usage/permission files produce errors and are preserved for repair. Chat histories contain your prompts and answers; API keys are never stored by this application. Run one shell instance per data directory; background parallel generations and multi-process data synchronization are outside v0.1.

```sh
npm test
npm run typecheck
npm run build
```

Tests use mocked provider streams and a real local MCP fixture, with no paid inference. CI runs Windows and Linux. The live hosted API authentication, external CLI authentication and arbitrary remote MCP services require your own configuration and have not been exercised with live credentials.

Source modules: `commands.ts` routes CLI input; `agent.ts` runs API tool rounds; `providers/` normalizes provider events; `permissions.ts` gates actions; `chats.ts`, `storage.ts` and `usage.ts` persist state; `skills.ts` and `mcp.ts` manage extensions.

Adapter references: [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [Codex noninteractive mode](https://developers.openai.com/codex/noninteractive), [Claude CLI reference](https://code.claude.com/docs/en/cli-reference).

MIT licensed. This is an independent project, not an official OpenAI or Anthropic product.
