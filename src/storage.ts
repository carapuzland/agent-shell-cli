import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
export function dataDirectory(): string {
  return (
    process.env.AGENT_SHELL_HOME ||
    (process.platform === "win32"
      ? join(process.env.LOCALAPPDATA || homedir(), "agent-shell")
      : process.platform === "darwin"
        ? join(homedir(), "Library", "Application Support", "agent-shell")
        : join(
            process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
            "agent-shell",
          ))
  );
}
export class Store {
  constructor(public readonly directory = dataDirectory()) {}
  private path(name: string) {
    if (!/^[a-z-]+$/.test(name)) throw new Error("Invalid storage name");
    return join(this.directory, `${name}.json`);
  }
  async read<T>(name: string, fallback: T): Promise<T> {
    let raw: string;
    try {
      raw = await readFile(this.path(name), "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return structuredClone(fallback);
      throw e;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(
        `Invalid JSON in ${this.path(name)}; original file preserved. Repair or restore it before continuing.`,
      );
    }
  }
  async write<T>(name: string, value: T): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const target = this.path(name),
      temp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(value, null, 2) + "\n", {
        mode: 0o600,
      });
      await rename(temp, target);
    } finally {
      await unlink(temp).catch(() => {});
    }
  }
}
