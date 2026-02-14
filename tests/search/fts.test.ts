import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createDatabase } from "../../src/storage/db.js";
import type { KontextDatabase } from "../../src/storage/db.js";
import { ftsSearch } from "../../src/search/fts.js";

// ── Test helpers ─────────────────────────────────────────────────────────────

let db: KontextDatabase;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kontext-fts-"));
  db = createDatabase(path.join(tmpDir, "index.db"));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function seedTestData(): void {
  const fileId1 = db.upsertFile({
    path: "src/auth.ts",
    language: "typescript",
    hash: "h1",
    size: 500,
  });
  const fileId2 = db.upsertFile({
    path: "src/pool.py",
    language: "python",
    hash: "h2",
    size: 300,
  });
  const fileId3 = db.upsertFile({
    path: "src/handler.ts",
    language: "typescript",
    hash: "h3",
    size: 400,
  });

  db.insertChunks(fileId1, [
    {
      lineStart: 1,
      lineEnd: 10,
      type: "function",
      name: "validateToken",
      parent: "AuthService",
      text: "function validateToken(token: string): boolean { return jwt.verify(token); }",
      imports: ["jsonwebtoken"],
      exports: true,
      hash: "c1",
    },
    {
      lineStart: 12,
      lineEnd: 20,
      type: "function",
      name: "refreshToken",
      parent: "AuthService",
      text: "function refreshToken(oldToken: string): string { return jwt.sign(decode(oldToken)); }",
      imports: ["jsonwebtoken"],
      exports: true,
      hash: "c1b",
    },
  ]);

  db.insertChunks(fileId2, [
    {
      lineStart: 1,
      lineEnd: 8,
      type: "function",
      name: "create_pool",
      parent: null,
      text: "def create_pool(url: str) -> Pool: return Pool(url, max_size=10)",
      imports: [],
      exports: false,
      hash: "c2",
    },
  ]);

  db.insertChunks(fileId3, [
    {
      lineStart: 1,
      lineEnd: 12,
      type: "method",
      name: "handleRequest",
      parent: "RequestHandler",
      text: "async handleRequest(req: Request, res: Response) { res.json(await this.service.process(req)); }",
      imports: [],
      exports: true,
      hash: "c3",
    },
  ]);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ftsSearch", () => {
  it("finds exact keyword match", () => {
    seedTestData();

    const results = ftsSearch(db, "validateToken", 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("validateToken");
    expect(results[0].filePath).toBe("src/auth.ts");
  });

  it("returns full metadata in results", () => {
    seedTestData();

    const results = ftsSearch(db, "validateToken", 10);

    const first = results[0];
    expect(first.chunkId).toBeDefined();
    expect(first.filePath).toBe("src/auth.ts");
    expect(first.lineStart).toBe(1);
    expect(first.lineEnd).toBe(10);
    expect(first.name).toBe("validateToken");
    expect(first.type).toBe("function");
    expect(first.text).toContain("validateToken");
    expect(first.language).toBe("typescript");
    expect(typeof first.score).toBe("number");
  });

  it("searches by text content", () => {
    seedTestData();

    const results = ftsSearch(db, "Pool", 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("create_pool");
  });

  it("searches by parent class name", () => {
    seedTestData();

    const results = ftsSearch(db, "RequestHandler", 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("handleRequest");
  });

  it("prefix search works", () => {
    seedTestData();

    const results = ftsSearch(db, "auth*", 10);

    // Should match AuthService parent
    expect(results.length).toBeGreaterThan(0);
  });

  it("BM25 scores rank results in descending order", () => {
    seedTestData();

    // "jwt" appears in both auth chunks' text
    const results = ftsSearch(db, "jwt", 10);

    expect(results.length).toBeGreaterThanOrEqual(2);

    // Scores should be sorted descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("score is in 0-1 range", () => {
    seedTestData();

    const results = ftsSearch(db, "token", 10);

    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it("filters by language", () => {
    seedTestData();

    const results = ftsSearch(db, "Pool", 10, { language: "python" });

    for (const r of results) {
      expect(r.language).toBe("python");
    }
  });

  it("language filter can exclude all results", () => {
    seedTestData();

    const results = ftsSearch(db, "token", 10, { language: "rust" });

    expect(results).toEqual([]);
  });

  it("returns empty for no matches", () => {
    seedTestData();

    const results = ftsSearch(db, "xyzzyNonexistent12345", 10);

    expect(results).toEqual([]);
  });

  it("returns empty on empty DB", () => {
    const results = ftsSearch(db, "anything", 10);

    expect(results).toEqual([]);
  });

  it("respects limit parameter", () => {
    seedTestData();

    const results = ftsSearch(db, "token", 1);

    expect(results).toHaveLength(1);
  });
});
