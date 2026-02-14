import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  computeChanges,
  hashFileContent,
} from "../../src/indexer/incremental.js";
import type { DiscoveredFile } from "../../src/indexer/discovery.js";
import type { FileRecord } from "../../src/storage/db.js";

// ── Mock DB ──────────────────────────────────────────────────────────────────

function createMockDb(files: Map<string, FileRecord>) {
  return {
    getFile(filePath: string): FileRecord | null {
      return files.get(filePath) ?? null;
    },
    getAllFilePaths(): string[] {
      return [...files.keys()];
    },
  };
}

function makeFileRecord(
  filePath: string,
  hash: string,
  id = 1,
): FileRecord {
  return {
    id,
    path: filePath,
    language: "typescript",
    hash,
    lastIndexed: Date.now(),
    size: 100,
  };
}

// ── Temp directory for real file hashing ──────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kontext-incr-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name: string, content: string): DiscoveredFile {
  const absPath = path.join(tmpDir, name);
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(absPath, content, "utf-8");
  return {
    path: name,
    absolutePath: absPath,
    language: "typescript",
    size: Buffer.byteLength(content),
    lastModified: Date.now(),
  };
}

// ── hashFileContent ──────────────────────────────────────────────────────────

describe("hashFileContent", () => {
  it("produces consistent SHA-256 hex hash", async () => {
    writeFile("test.ts", "const x = 42;");
    const hash1 = await hashFileContent(path.join(tmpDir, "test.ts"));
    const hash2 = await hashFileContent(path.join(tmpDir, "test.ts"));
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different content", async () => {
    writeFile("a.ts", "const a = 1;");
    writeFile("b.ts", "const b = 2;");
    const h1 = await hashFileContent(path.join(tmpDir, "a.ts"));
    const h2 = await hashFileContent(path.join(tmpDir, "b.ts"));
    expect(h1).not.toBe(h2);
  });
});

// ── computeChanges ───────────────────────────────────────────────────────────

describe("computeChanges", () => {
  it("detects new files (not in DB)", async () => {
    const discovered = [writeFile("src/new.ts", "export const x = 1;")];
    const db = createMockDb(new Map());

    const result = await computeChanges(discovered, db);

    expect(result.added).toEqual(["src/new.ts"]);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.unchanged).toEqual([]);
  });

  it("detects modified files (different hash)", async () => {
    const discovered = [writeFile("src/mod.ts", "const updated = true;")];
    const db = createMockDb(
      new Map([["src/mod.ts", makeFileRecord("src/mod.ts", "old-hash")]]),
    );

    const result = await computeChanges(discovered, db);

    expect(result.added).toEqual([]);
    expect(result.modified).toEqual(["src/mod.ts"]);
    expect(result.deleted).toEqual([]);
    expect(result.unchanged).toEqual([]);
  });

  it("detects deleted files (in DB but not discovered)", async () => {
    const discovered: DiscoveredFile[] = [];
    const db = createMockDb(
      new Map([
        ["src/gone.ts", makeFileRecord("src/gone.ts", "some-hash")],
      ]),
    );

    const result = await computeChanges(discovered, db);

    expect(result.added).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual(["src/gone.ts"]);
    expect(result.unchanged).toEqual([]);
  });

  it("skips unchanged files (same hash)", async () => {
    const file = writeFile("src/same.ts", "const same = true;");
    const hash = await hashFileContent(file.absolutePath);
    const db = createMockDb(
      new Map([["src/same.ts", makeFileRecord("src/same.ts", hash)]]),
    );

    const result = await computeChanges([file], db);

    expect(result.added).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.unchanged).toEqual(["src/same.ts"]);
  });

  it("handles mixed: new + modified + deleted + unchanged", async () => {
    const newFile = writeFile("src/new.ts", "new file");
    const modFile = writeFile("src/mod.ts", "modified content");
    const sameFile = writeFile("src/same.ts", "unchanged");
    const sameHash = await hashFileContent(sameFile.absolutePath);

    const db = createMockDb(
      new Map([
        ["src/mod.ts", makeFileRecord("src/mod.ts", "old-hash", 2)],
        ["src/same.ts", makeFileRecord("src/same.ts", sameHash, 3)],
        ["src/gone.ts", makeFileRecord("src/gone.ts", "gone-hash", 4)],
      ]),
    );

    const result = await computeChanges(
      [newFile, modFile, sameFile],
      db,
    );

    expect(result.added).toEqual(["src/new.ts"]);
    expect(result.modified).toEqual(["src/mod.ts"]);
    expect(result.deleted).toEqual(["src/gone.ts"]);
    expect(result.unchanged).toEqual(["src/same.ts"]);
  });

  it("includes duration in result", async () => {
    const db = createMockDb(new Map());
    const result = await computeChanges([], db);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe("number");
  });

  it("includes file hashes in result for added/modified files", async () => {
    const newFile = writeFile("src/new.ts", "new");
    const modFile = writeFile("src/mod.ts", "modified");
    const db = createMockDb(
      new Map([["src/mod.ts", makeFileRecord("src/mod.ts", "old")]]),
    );

    const result = await computeChanges([newFile, modFile], db);

    expect(result.hashes.has("src/new.ts")).toBe(true);
    expect(result.hashes.has("src/mod.ts")).toBe(true);
    expect(result.hashes.get("src/new.ts")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles empty discovered set with populated DB", async () => {
    const db = createMockDb(
      new Map([
        ["a.ts", makeFileRecord("a.ts", "h1", 1)],
        ["b.ts", makeFileRecord("b.ts", "h2", 2)],
      ]),
    );

    const result = await computeChanges([], db);

    expect(result.deleted.sort()).toEqual(["a.ts", "b.ts"]);
    expect(result.added).toEqual([]);
  });

  it("handles empty DB with discovered files", async () => {
    const files = [
      writeFile("a.ts", "a"),
      writeFile("b.ts", "b"),
    ];
    const db = createMockDb(new Map());

    const result = await computeChanges(files, db);

    expect(result.added.sort()).toEqual(["a.ts", "b.ts"]);
    expect(result.deleted).toEqual([]);
  });
});

// ── Git-based fast change detection ──────────────────────────────────────────

describe("computeChanges with git optimization", () => {
  it("still produces correct results (categories match hash-based)", async () => {
    // Git optimization is an internal detail — the output should be the same.
    // We test by providing discovered files and a DB, and the result should match.
    const file = writeFile("src/new.ts", "export const x = 1;");
    const db = createMockDb(new Map());

    const result = await computeChanges([file], db);

    expect(result.added).toEqual(["src/new.ts"]);
  });
});
