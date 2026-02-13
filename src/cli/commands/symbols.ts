import type { Command } from "commander";

export function registerSymbolsCommand(program: Command): void {
  program
    .command("symbols")
    .description("List all indexed symbols")
    .option("--type <type>", "Filter by symbol type (function, class, etc.)")
    .action((_options: Record<string, unknown>) => {
      console.log("ctx symbols — not yet implemented");
    });
}
