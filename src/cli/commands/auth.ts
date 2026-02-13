import type { Command } from "commander";

export function registerAuthCommand(program: Command): void {
  program
    .command("auth")
    .description("Set API keys for LLM and embedding providers")
    .action(() => {
      console.log("ctx auth — not yet implemented");
    });
}
