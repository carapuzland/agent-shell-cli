import { readFile, writeFile, realpath, stat } from "node:fs/promises";
import { resolve, dirname, basename, join } from "node:path";
import { createTwoFilesPatch } from "diff";
import { Permissions } from "./permissions.js";
import { runProcess } from "./process.js";
export async function canonicalPath(
  path: string,
  cwd = process.cwd(),
): Promise<string> {
  const absolute = resolve(cwd, path);
  try {
    return await realpath(absolute);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return join(await realpath(dirname(absolute)), basename(absolute));
  }
}
export class Tools {
  constructor(
    private permissions: Permissions,
    private cwd = process.cwd(),
  ) {}
  async execute(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<string> {
    if (name === "terminal") {
      if (typeof args.command !== "string" || !args.command.trim())
        throw new Error("command must be non-empty");
      const cwd = await realpath(
        typeof args.cwd === "string" ? resolve(this.cwd, args.cwd) : this.cwd,
      );
      if (
        !(await this.permissions.authorize({
          operation: "terminal",
          resource: JSON.stringify([cwd, args.command]),
          description: `Terminal in ${cwd}\n${args.command}`,
        }))
      )
        throw new Error("Denied");
      const result = await runProcess(args.command, [], {
        cwd,
        shell: true,
        signal,
      });
      return JSON.stringify(result);
    }
    if (name !== "read_file" && name !== "write_file")
      throw new Error(`Unknown tool: ${name}`);
    if (typeof args.path !== "string" || !args.path)
      throw new Error("path must be non-empty");
    const path = await canonicalPath(args.path, this.cwd);
    if (name === "read_file") {
      if (
        !(await this.permissions.authorize({
          operation: "read",
          resource: path,
          description: `Read ${path}`,
        }))
      )
        throw new Error("Denied");
      if ((await stat(path)).size > 1024 * 1024)
        throw new Error("File exceeds 1 MiB");
      return readFile(path, "utf8");
    }
    if (typeof args.content !== "string")
      throw new Error("content must be a string");
    if (Buffer.byteLength(args.content) > 1024 * 1024)
      throw new Error("Write exceeds 1 MiB");
    let previous = "";
    try {
      if ((await stat(path)).size > 1024 * 1024)
        throw new Error("File exceeds 1 MiB");
      previous = await readFile(path, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const diff = createTwoFilesPatch(path, path, previous, args.content);
    if (
      !(await this.permissions.authorize({
        operation: "write",
        resource: path,
        description: `Write ${path}\n${diff}`,
      }))
    )
      throw new Error("Denied");
    if ((await canonicalPath(args.path, this.cwd)) !== path)
      throw new Error("Path changed during approval");
    let current = "";
    try {
      current = await readFile(path, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (current !== previous)
      throw new Error("File changed during approval; retry to review new diff");
    await writeFile(path, args.content, "utf8");
    return `Written ${path}`;
  }
}
export const localToolDefinitions = [
  {
    name: "read_file",
    description: "Read a UTF-8 file after permission",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write a UTF-8 file after diff review and permission",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "terminal",
    description: "Run a shell command with explicit permission",
    parameters: {
      type: "object",
      properties: { command: { type: "string" }, cwd: { type: "string" } },
      required: ["command"],
    },
  },
];
