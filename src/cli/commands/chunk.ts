import type { Command } from "commander";

export function registerChunkCommand(program: Command): void {
  program
    .command("chunk <location>")
    .description("Show the chunk containing a file:line location")
    .action((_location: string) => {
      console.log("ctx chunk — not yet implemented");
    });
}
