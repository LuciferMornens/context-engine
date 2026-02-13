import type { Command } from "commander";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Incremental re-index of changed files")
    .action(() => {
      console.log("ctx update — not yet implemented");
    });
}
