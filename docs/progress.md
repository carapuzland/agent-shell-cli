# Implementation ledger

Plan: docs/superpowers/plans/2026-10-05-agent-shell-cli.md

Ruling: Implement in the newly created dedicated repository on feat/cli-foundation; this checkout has no pre-existing user project state to isolate.
Ruling: Use MCP SDK v1.32 rather than unreleased v2 import paths; npm release and official v1 SDK interfaces verified.
Pre-flight: Store/Chats supply persistence for permissions, skills and usage; ProviderEvent supplies normalized streams for metrics; tool dispatcher is shared by manual commands and API tools.
Task 1: tests first ran red because storage/chat modules did not exist. Implementing offline core.

Task 1: complete — atomic storage, isolated durable chats and offline command routing verified.
Task 2: complete — denial, exact scope, revocation, diff preview, alias canonicalization and process timeout/cancellation verified.
Task 3: complete — skill scaffolding and official SDK MCP handshake, tool calls and disconnect verified with a local server.
Task 4: complete — optional adapters, API tool loop, cumulative usage, estimates, persistent budgets and response footers verified.
Task 5: complete locally — diagnostics, documentation, license, CI and CLI smoke test prepared; publication verification follows.

Review: independent reviewer identified delayed usage emission and dropped MCP cancellation. Both reproduced with failing tests and fixed; full suite green.
Ruling: CLI providers delegate text; autonomous shell tool bridging is available through API adapters. CLI-specific boundaries and current-version flags are documented rather than claiming an OS sandbox.
Ruling: CLI throughput uses full request duration because responses are buffered; API throughput uses first text through completion per round. Footers persist this measurement.
Verification incident: a new CLI-denial test initially launched the installed Codex before the delegation gate existed. Reported to the user. The regression test now removes PATH while exercising denial, and the shell gates CLI delegation before startup. No further external model requests are part of the test suite.
Final local checks: 30 tests pass, typecheck/build pass, npm package contents inspected. Smoke run used isolated work/smoke-data, not the default user's data directory.
