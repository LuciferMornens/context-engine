import type { Command } from "commander";

export function registerDepsCommand(program: Command): void {
  program
    .command("deps <file>")
    .description("Show dependency graph for a file")
    .action((_file: string) => {
      console.log("ctx deps — not yet implemented");
    });
}
