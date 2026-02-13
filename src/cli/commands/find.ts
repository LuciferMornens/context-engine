import type { Command } from "commander";

export function registerFindCommand(program: Command): void {
  program
    .command("find <query>")
    .description("Natural language code search")
    .option("--full", "Include source code in output")
    .option("--json", "Machine-readable JSON output")
    .option("--no-llm", "Skip steering LLM, raw vector search only")
    .option("-l, --limit <n>", "Max results", "5")
    .option("--language <lang>", "Filter by language")
    .action((_query: string, _options: Record<string, unknown>) => {
      console.log("ctx find — not yet implemented");
    });
}
