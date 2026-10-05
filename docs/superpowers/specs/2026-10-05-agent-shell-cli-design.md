# Agent Shell CLI — specification

## Purpose and scope

Build a public, MIT-licensed TypeScript/Node.js CLI foundation named `agent-shell-cli` in the GitHub account `carapuzland`. The experience resembles Claude Code: interactive conversations, slash commands, extensible tools and explicit permissions. No AI provider is selected, credentials supplied, or AI request sent by default. Provider adapters are available for later user configuration.

## Architecture

Use separate modules for the interactive UI, command router, persistent configuration, chats, provider adapters, skills, MCP connections, tools, permissions and usage accounting. Use the official MCP SDK for stdio and Streamable HTTP transports. Keep provider requests behind a common streaming interface with text, usage and error events. Support Windows, macOS and Linux on a documented supported Node.js release.

## Providers

Provide configuration and adapters for Codex CLI, Anthropic CLI, Anthropic API and a custom OpenAI-compatible API endpoint (including local services). CLI integrations use installed executables and their existing authentication; the shell does not extract their credentials. API integrations read keys from explicitly configured environment variables, never committed configuration. Selecting a provider and model is explicit. CLI availability and unsupported integration capabilities are reported honestly. No account is connected automatically.

Provider errors leave the shell and chat usable. Requests support cancellation. API adapters normalize reported input/output usage. Delegated CLI processes can have their own internal tools and permissions; document this boundary clearly and use their restrictive execution modes when available. Shell permission guarantees apply to tools dispatched by this shell.

## Chats

Persist multiple chats with stable IDs, titles, creation/update timestamps, ordered messages and per-response metrics. `/new [title]` creates and selects a chat; `/chats` lists chats; `/chat <id>` switches; `/rename <title>` renames the current chat; `/history` displays its messages. Switching chats preserves independent context. Save completed messages atomically; interrupted or failed generations must not become successful assistant messages. No simultaneous background generations are required for this foundation.

## Response metrics and limits

Print a footer after each assistant response with generated output tokens, generation speed in tokens/second and total elapsed time. Measure elapsed time with a monotonic clock from request start to completion. Compute speed from output tokens and generation duration, documenting the time window used. Use provider output token usage when supplied; otherwise label an estimate explicitly. Unknown values display as unavailable. Store metrics alongside messages so history retains them.

`/limits` shows the active provider/model, session and current-chat API token usage, and configured token budgets or reported provider limits. Do not invent account quotas, reset times or prices. CLI adapters show reported limits only when a supported source exists; otherwise display unavailable. Distinguish configured local budgets from provider account limits. A configured token budget blocks subsequent requests once known accumulated usage reaches it; an in-flight response may exceed it. Persist usage so restarting cannot reset the budget silently.

## Permissions and local tools

Provide read, write and terminal tools with Allow, Deny and Always allow choices. Display the concrete absolute path or command and working directory before approval. Show a write preview/diff before modifying a file. Denial executes no action. Always allow persists only a narrowly scoped rule for that operation and resource, not an unrestricted global grant. `/permissions` lists rules and permits revocation/reset.

Resolve paths consistently, including symlinks where relevant, and avoid matching rules by loose string prefix. Bound terminal execution time and output, support cancellation, and report exit status. Tool results are treated as data, not authorization. MCP connection startup also requires approval because stdio launches executable code; each MCP tool invocation passes through the permission gate. Permissions are an approval mechanism, not an OS sandbox.

## Skills

`/skills` lists discovered skills. `/skills create <name>` scaffolds a local SKILL.md; `/skills add <path>` connects an existing local skill directory; `/skills show <name>` displays its instructions. Validate names, paths and metadata; report duplicate names and missing files. Skill instructions can enter the active conversation context when explicitly selected. They cannot bypass permission checks. Automatic remote downloads are outside initial scope.

## MCP

`/mcp` lists configured connections and status. Provide add, connect, disconnect and tool-list operations for stdio and Streamable HTTP servers. Store server configuration without secret values, support environment-variable references, report handshake failures and close processes/connections on exit. Use the official SDK rather than implementing a partial protocol. Remote servers and local tools share the dispatcher and approval UI.

## Commands and health

Include `/help`, `/health`, `/doctor`, `/limits`, `/status`, `/config`, `/permissions`, `/skills`, `/mcp`, `/provider`, `/chats`, `/new`, `/chat`, `/rename`, `/history`, `/clear` and `/exit`. `/clear` clears the screen without deleting history. `/health` reports runtime, storage accessibility, provider configuration/availability and MCP state without sending a paid inference request. `/doctor` provides actionable diagnostics for missing executables, environment variables and invalid configuration. Unknown commands show an error and a help hint.

## Persistence and distribution

Separate project source from runtime user data. Store runtime data under a platform-appropriate user configuration/data directory, with an override for testing. Use atomic writes and validate loaded JSON; report corruption without silently destroying data. Exclude keys, runtime histories, dependency folders and build outputs from Git. Provide an npm executable, README with setup and command examples, example configuration, MIT license and GitHub CI.

## Verification

Run TypeScript checks, build and automated tests for permission denial/scope/revocation, write approval, chat isolation and persistence, metrics/usage accounting, command routing and provider normalization. Use mocked API streams and a local test MCP server; no live AI credentials or paid calls are needed. Smoke-test startup, help, health, offline messaging and exit. Publish the verified source to a public GitHub repository and report the repository URL plus any actual limitations.

## Explicit exclusions

No default AI connection, bundled API keys, model training, web UI, multi-user hosting, background concurrent chat execution or claimed OS sandbox. The requested deliverable is a usable CLI foundation with documented extension points.
