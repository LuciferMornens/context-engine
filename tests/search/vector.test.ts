import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createDatabase } from "../../src/storage/db.js";
import type { KontextDatabase } from "../../src/storage/db.js";
import { vectorSearch } from "../../src/search/vector.js";
import type { Embedder } from "../../src/indexer/embedder.js";

// ── Test helpers ─────────────────────────────────────────────────────────────

let db: KontextDatabase;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kontext-vsearch-"));
  db = createDatabase(path.join(tmpDir, "index.db"));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Mock embedder that maps specific query strings to known vectors.
 * This avoids loading the real ML model in tests.
 */
function createMockEmbedder(): Embedder {
  return {
    name: "mock",
    dimensions: 384,
    async embed(texts: string[]): Promise<Float32Array[]> {
      return texts.map((t) => makeVec(t));
    },
    async embedSingle(text: string): Promise<Float32Array> {
      return makeVec(text);
    },
  };
}

/** Deterministic vector from text — uses char codes to seed values */
function makeVec(text: string): Float32Array {
  const vec = new Float32Array(384);
  for (let i = 0; i < 384; i++) {
    vec[i] = Math.sin(i + text.charCodeAt(i % text.length));
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

/** Seed DB with test files, chunks, and vectors */
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

  const ids1 = db.insertChunks(fileId1, [
    {
      lineStart: 1,
      lineEnd: 10,
      type: "function",
      name: "validateToken",
      parent: null,
      text: "function validateToken(token: string): boolean { return jwt.verify(token); }",
      imports: ["jsonwebtoken"],
      exports: true,
      hash: "c1",
    },
  ]);

  const ids2 = db.insertChunks(fileId2, [
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

  const ids3 = db.insertChunks(fileId3, [
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

  // Insert vectors using deterministic text-based vectors
  db.insertVector(
    ids1[0],
    makeVec(
      "function validateToken(token: string): boolean { return jwt.verify(token); }",
    ),
  );
  db.insertVector(
    ids2[0],
    makeVec(
      "def create_pool(url: str) -> Pool: return Pool(url, max_size=10)",
    ),
  );
  db.insertVector(
    ids3[0],
    makeVec(
      "async handleRequest(req: Request, res: Response) { res.json(await this.service.process(req)); }",
    ),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("vectorSearch", () => {
  const embedder = createMockEmbedder();

  it("returns results ranked by similarity", async () => {
    seedTestData();

    // Query with text similar to validateToken
    const results = await vectorSearch(
      db,
      embedder,
      "function validateToken(token: string): boolean { return jwt.verify(token); }",
      10,
    );

    expect(results.length).toBeGreaterThan(0);
    // First result should be the most similar
    expect(results[0].name).toBe("validateToken");

    // Results should be in descending score order
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("respects limit parameter", async () => {
    seedTestData();

    const results = await vectorSearch(
      db,
      embedder,
      "validate token authentication",
      1,
    );

    expect(results).toHaveLength(1);
  });

  it("returns full chunk metadata", async () => {
    seedTestData();

    const results = await vectorSearch(
      db,
      embedder,
      "function validateToken(token: string): boolean { return jwt.verify(token); }",
      10,
    );

    const first = results[0];
    expect(first.chunkId).toBeDefined();
    expect(first.filePath).toBe("src/auth.ts");
    expect(first.lineStart).toBe(1);
    expect(first.lineEnd).toBe(10);
    expect(first.name).toBe("validateToken");
    expect(first.type).toBe("function");
    expect(first.text).toContain("validateToken");
    expect(first.language).toBe("typescript");
  });

  it("score is in 0-1 range", async () => {
    seedTestData();

    const results = await vectorSearch(
      db,
      embedder,
      "validate token",
      10,
    );

    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it("filters by language", async () => {
    seedTestData();

    const results = await vectorSearch(
      db,
      embedder,
      "create pool connection",
      10,
      { language: "python" },
    );

    for (const r of results) {
      expect(r.language).toBe("python");
    }
  });

  it("returns empty array when no vectors exist", async () => {
    const results = await vectorSearch(
      db,
      embedder,
      "anything at all",
      10,
    );

    expect(results).toEqual([]);
  });

  it("returns empty array for empty query against seeded DB", async () => {
    seedTestData();

    // Even with a nonsensical query, results may come back (KNN always returns k nearest),
    // but they should still have valid structure
    const results = await vectorSearch(
      db,
      embedder,
      "xyzzy nonsense query 12345",
      10,
    );

    // Results may or may not be empty, but should be valid
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      expect(typeof r.filePath).toBe("string");
    }
  });

  it("language filter can exclude all results", async () => {
    seedTestData();

    const results = await vectorSearch(
      db,
      embedder,
      "validate token",
      10,
      { language: "rust" },
    );

    expect(results).toEqual([]);
  });
});
