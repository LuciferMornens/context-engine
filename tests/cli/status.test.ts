import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runStatus } from "../../src/cli/commands/status.js";
import { runInit } from "../../src/cli/commands/init.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

function setup(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kontext-status-"));
  const srcDir = path.join(tmpDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(
    path.join(srcDir, "auth.ts"),
    `export function validateToken(token: string): boolean {
  return token.length > 0;
}

export function createToken(userId: string): string {
  return "token-" + userId;
}
`,
  );
  fs.writeFileSync(
    path.join(srcDir, "handler.ts"),
    `export async function handleRequest(req: Request): Promise<Response> {
  return new Response("OK");
}
`,
  );
  fs.writeFileSync(
    path.join(srcDir, "utils.py"),
    `def format_date(date):
    return date.isoformat()

MAX_RETRIES = 3
`,
  );
  return tmpDir;
}

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ctx status", () => {
  it("shows correct stats for initialized project", async () => {
    const root = setup();
    await runInit(root, { log: () => undefined, skipEmbedding: true });

    const output = await runStatus(root);

    expect(output.initialized).toBe(true);
    expect(output.fileCount).toBe(3);
    expect(output.chunkCount).toBeGreaterThan(0);
    expect(output.vectorCount).toBe(0); // skipEmbedding
    expect(output.dbSizeBytes).toBeGreaterThan(0);
    expect(output.lastIndexed).toBeDefined();
  });

  it("shows not initialized for missing .ctx/", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kontext-status-no-"));
    try {
      const output = await runStatus(root);

      expect(output.initialized).toBe(false);
      expect(output.fileCount).toBe(0);
      expect(output.chunkCount).toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("language breakdown is accurate", async () => {
    const root = setup();
    await runInit(root, { log: () => undefined, skipEmbedding: true });

    const output = await runStatus(root);

    expect(output.languages).toBeDefined();
    expect(output.languages.get("typescript")).toBe(2);
    expect(output.languages.get("python")).toBe(1);
  });

  it("DB size is shown", async () => {
    const root = setup();
    await runInit(root, { log: () => undefined, skipEmbedding: true });

    const output = await runStatus(root);

    expect(output.dbSizeBytes).toBeGreaterThan(0);
    expect(typeof output.dbSizeBytes).toBe("number");
  });

  it("config summary is included", async () => {
    const root = setup();
    await runInit(root, { log: () => undefined, skipEmbedding: true });

    const output = await runStatus(root);

    expect(output.config).toBeDefined();
    expect(output.config?.model).toBe("Xenova/all-MiniLM-L6-v2");
    expect(output.config?.dimensions).toBe(384);
  });

  it("text output is formatted correctly", async () => {
    const root = setup();
    await runInit(root, { log: () => undefined, skipEmbedding: true });

    const output = await runStatus(root);

    expect(output.text).toContain("Kontext Status");
    expect(output.text).toContain("Initialized:");
    expect(output.text).toContain("Files:");
    expect(output.text).toContain("Chunks:");
    expect(output.text).toContain("Languages:");
    expect(output.text).toContain("Typescript");
    expect(output.text).toContain("Python");
  });

  it("text output for non-initialized project", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kontext-status-no2-"));
    try {
      const output = await runStatus(root);

      expect(output.text).toContain("Not initialized");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
