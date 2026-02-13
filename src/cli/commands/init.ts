import type { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init [path]")
    .description("Index current directory or specified path")
    .action((_path?: string) => {
      console.log("ctx init — not yet implemented");
    });
}
