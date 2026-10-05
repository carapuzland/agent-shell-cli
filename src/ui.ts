import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import type { PermissionRequest, Decision } from "./permissions.js";
// Prevent untrusted tool/model strings from controlling the terminal.
export function safeText(text: string) {
  return text
    .replace(
      /\x1b(?:\][^\x07]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~]|[\s\S])/g,
      "",
    )
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}
export const print = (text: string) => console.log(safeText(text));
export const stream = (text: string) => process.stdout.write(safeText(text));
export async function approve(request: PermissionRequest): Promise<Decision> {
  console.log(chalk.yellow("\nPermission required"));
  print(request.description);
  if (!process.stdin.isTTY) return "deny";
  return select({
    message: "Permission",
    choices: [
      { name: "Deny", value: "deny" as const },
      { name: "Allow once", value: "allow" as const },
      {
        name: "Always allow this exact operation/resource",
        value: "always" as const,
      },
    ],
  });
}
export async function prompt(title: string) {
  return input({ message: chalk.cyan(title) });
}
export function banner() {
  console.log(
    chalk.cyan.bold("\n  ◆ Agent Shell") +
      chalk.dim(
        "  v0.1.0\n  Chats · Skills · MCP · Permission-gated tools\n  /help for commands · AI disabled until configured\n",
      ),
  );
}
