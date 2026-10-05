# Implementation ledger

Plan: docs/superpowers/plans/2026-10-05-agent-shell-cli.md

Ruling: Implement in the newly created dedicated repository on feat/cli-foundation; this checkout has no pre-existing user project state to isolate.
Ruling: Use MCP SDK v1.32 rather than unreleased v2 import paths; npm release and official v1 SDK interfaces verified.
Pre-flight: Store/Chats supply persistence for permissions, skills and usage; ProviderEvent supplies normalized streams for metrics; tool dispatcher is shared by manual commands and API tools.
Task 1: tests first ran red because storage/chat modules did not exist. Implementing offline core.
