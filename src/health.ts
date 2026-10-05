import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join } from "node:path";
import type { Config } from "./types.js";
import { Store } from "./storage.js";
export async function executableAvailable(name: string): Promise<boolean> {
  for (const directory of (process.env.PATH || "").split(delimiter)) {
    for (const suffix of process.platform === "win32"
      ? [".exe", ".cmd", ".bat", ""]
      : [""]) {
      try {
        await access(
          join(directory, name + suffix),
          process.platform === "win32" ? constants.F_OK : constants.X_OK,
        );
        return true;
      } catch {}
    }
  }
  return false;
}
export async function health(
  store: Store,
  config: Config,
  connected: string[],
) {
  let storage = { ok: true, detail: store.directory };
  try {
    await mkdir(store.directory, { recursive: true });
    await access(store.directory, constants.R_OK | constants.W_OK);
  } catch (e) {
    storage = { ok: false, detail: (e as Error).message };
  }
  const c = config.provider;
  let provider = {
    ok: true,
    detail:
      c.kind === "disabled"
        ? "AI disabled; /provider set explicitly enables it"
        : `${c.kind} / ${c.model || "default"}`,
  };
  if (c.kind === "codex" || c.kind === "claude") {
    if (!(await executableAvailable(c.kind)))
      provider = {
        ok: false,
        detail: `Install ${c.kind} CLI and authenticate separately; executable missing from PATH`,
      };
  } else if (c.kind !== "disabled") {
    if (!c.model)
      provider = { ok: false, detail: "Set a model using /provider set" };
    if (c.keyEnv && !process.env[c.keyEnv])
      provider = {
        ok: false,
        detail: `Set environment variable ${c.keyEnv} before starting the shell`,
      };
    if (
      !c.keyEnv &&
      !(
        c.baseUrl &&
        new URL(c.baseUrl).hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/)
      )
    )
      provider = {
        ok: false,
        detail:
          "Configure keyEnv for a hosted API, or baseUrl for a local keyless server",
      };
  }
  return {
    runtime: {
      ok: Number(process.versions.node.split(".")[0]) >= 22,
      detail: `Node ${process.version} / ${process.platform}`,
    },
    storage,
    provider,
    mcp: { configured: Object.keys(config.mcp), connected },
    note: "No inference request or MCP connection was made by this check.",
  };
}
