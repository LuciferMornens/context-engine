import type { Command } from "commander";

export function registerWatchCommand(program: Command): void {
  program
    .command("watch")
    .description("Watch mode — re-index on file changes")
    .action(() => {
      console.log("ctx watch — not yet implemented");
    });
}
