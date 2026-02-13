import type { Command } from "commander";

export function registerConfigCommand(program: Command): void {
  const cmd = program
    .command("config")
    .description("Show or modify configuration");

  cmd
    .command("show")
    .description("Show current configuration")
    .action(() => {
      console.log("ctx config show — not yet implemented");
    });

  cmd
    .command("set <key> <value>")
    .description("Set a configuration value")
    .action((_key: string, _value: string) => {
      console.log("ctx config set — not yet implemented");
    });
}
