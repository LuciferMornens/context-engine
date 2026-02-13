import type { Command } from "commander";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show index statistics")
    .action(() => {
      console.log("ctx status — not yet implemented");
    });
}
