#!/usr/bin/env node
import { createInterface } from "node:readline";
import { Shell, HELP } from "./commands.js";
import { Store } from "./storage.js";
import { print, stream, approve, prompt, banner } from "./ui.js";
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    print(
      HELP +
        '\nCLI: agent-shell [--command "slash command"]... [--help] [--version]',
    );
    return;
  }
  if (args.includes("--version")) {
    print("0.1.0");
    return;
  }
  const commands: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== "--command" || !args[i + 1])
      throw new Error('Usage: agent-shell [--command "..."]...');
    commands.push(args[++i]);
  }
  const shell = new Shell(new Store(), {
    print,
    stream,
    approve,
    clear: () => {
      if (process.stdout.isTTY) console.clear();
    },
  });
  let busy = false;
  const interrupt = () => {
    if (shell.controller) {
      shell.controller.abort();
      print("\nCancelling…");
    } else if (busy) {
      print("\nOperation in progress.");
    } else {
      shell.exiting = true;
      void shell.close();
    }
  };
  process.on("SIGINT", interrupt);
  try {
    await shell.init();
    const dispatch = async (text: string) => {
      busy = true;
      try {
        await shell.route(text);
      } catch (e) {
        if ((e as Error).name === "ExitPromptError") {
          print("Cancelled");
        } else print(`Error: ${(e as Error).message}`);
      } finally {
        busy = false;
      }
    };
    if (commands.length) {
      let failed = false;
      for (const text of commands) {
        if (shell.exiting) break;
        try {
          await shell.route(text);
        } catch (e) {
          failed = true;
          print(`Error: ${(e as Error).message}`);
        }
      }
      if (failed) process.exitCode = 1;
      return;
    }
    if (!process.stdin.isTTY) {
      const lines = createInterface({
        input: process.stdin,
        crlfDelay: Infinity,
      });
      try {
        for await (const line of lines) {
          await dispatch(line);
          if (shell.exiting) break;
        }
      } finally {
        lines.close();
      }
      return;
    }
    banner();
    while (!shell.exiting) {
      const chat = await shell.current();
      try {
        const text = await prompt(`${chat.title} ›`);
        await dispatch(text);
      } catch (e) {
        if ((e as Error).name === "ExitPromptError") {
          shell.exiting = true;
        } else throw e;
      }
    }
  } finally {
    process.off("SIGINT", interrupt);
    await shell.close();
  }
}
main().catch((e) => {
  print(`Error: ${(e as Error).message}`);
  process.exitCode = 1;
});
