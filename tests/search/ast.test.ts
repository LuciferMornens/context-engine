import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createDatabase } from "../../src/storage/db.js";
import type { KontextDatabase } from "../../src/storage/db.js";
import { astSearch } from "../../src/search/ast.js";

// ── Test helpers ─────────────────────────────────────────────────────────────

let db: KontextDatabase;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kontext-ast-"));
  db = createDatabase(path.join(tmpDir, "index.db"));
  seedTestData();
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
    path: "src/handler.ts",
    language: "typescript",
    hash: "h2",
    size: 400,
  });
  const fileId3 = db.upsertFile({
    path: "src/pool.py",
    language: "python",
    hash: "h3",
    size: 300,
  });

  db.insertChunks(fileId1, [
    {
      lineStart: 1,
      lineEnd: 5,
      type: "class",
      name: "AuthService",
      parent: null,
      text: "class AuthService { ... }",
      imports: [],
      exports: true,
      hash: "c1",
    },
    {
      lineStart: 6,
      lineEnd: 15,
      type: "method",
      name: "validateToken",
      parent: "AuthService",
      text: "validateToken(token: string): boolean { return jwt.verify(token); }",
      imports: ["jsonwebtoken"],
      exports: true,
      hash: "c2",
    },
    {
      lineStart: 16,
      lineEnd: 25,
      type: "method",
      name: "refreshToken",
      parent: "AuthService",
      text: "refreshToken(old: string): string { return jwt.sign(decode(old)); }",
      imports: ["jsonwebtoken"],
      exports: true,
      hash: "c3",
    },
    {
      lineStart: 26,
      lineEnd: 30,
      type: "constant",
      name: "AUTH_SECRET",
      parent: null,
      text: "const AUTH_SECRET = process.env.SECRET;",
      imports: [],
      exports: true,
      hash: "c4",
    },
    {
      lineStart: 31,
      lineEnd: 35,
      type: "type",
      name: "AuthConfig",
      parent: null,
      text: "interface AuthConfig { secret: string; ttl: number; }",
      imports: [],
      exports: true,
      hash: "c5",
    },
  ]);

  db.insertChunks(fileId2, [
    {
      lineStart: 1,
      lineEnd: 10,
      type: "function",
      name: "handleRequest",
      parent: null,
      text: "function handleRequest(req, res) { res.json(data); }",
      imports: [],
      exports: true,
      hash: "c6",
    },
    {
      lineStart: 11,
      lineEnd: 20,
      type: "function",
      name: "handleAuth",
      parent: null,
      text: "function handleAuth(req, res) { validateToken(req.token); }",
      imports: [],
      exports: true,
      hash: "c7",
    },
  ]);

  db.insertChunks(fileId3, [
    {
      lineStart: 1,
      lineEnd: 8,
      type: "function",
      name: "create_pool",
      parent: null,
      text: "def create_pool(url: str) -> Pool: return Pool(url)",
      imports: [],
      exports: false,
      hash: "c8",
    },
    {
      lineStart: 9,
      lineEnd: 16,
      type: "class",
      name: "ConnectionManager",
      parent: null,
      text: "class ConnectionManager: ...",
      imports: [],
      exports: false,
      hash: "c9",
    },
  ]);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("astSearch", () => {
  describe("exact name match", () => {
    it("finds a symbol by exact name", () => {
      const results = astSearch(db, { name: "validateToken", matchMode: "exact" }, 10);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("validateToken");
      expect(results[0].filePath).toBe("src/auth.ts");
      expect(results[0].score).toBe(1.0);
    });

    it("is case-sensitive for exact match", () => {
      const results = astSearch(db, { name: "validatetoken", matchMode: "exact" }, 10);

      expect(results).toHaveLength(0);
    });
  });

  describe("prefix match", () => {
    it("finds multiple symbols by prefix", () => {
      const results = astSearch(db, { name: "handle", matchMode: "prefix" }, 10);

      expect(results).toHaveLength(2);
      const names = results.map((r) => r.name);
      expect(names).toContain("handleRequest");
      expect(names).toContain("handleAuth");
    });

    it("assigns prefix match score of 0.8", () => {
      const results = astSearch(db, { name: "handle", matchMode: "prefix" }, 10);

      for (const r of results) {
        expect(r.score).toBe(0.8);
      }
    });
  });

  describe("fuzzy match (default)", () => {
    it("finds symbols containing the query", () => {
      const results = astSearch(db, { name: "Token" }, 10);

      expect(results.length).toBeGreaterThanOrEqual(2);
      const names = results.map((r) => r.name);
      expect(names).toContain("validateToken");
      expect(names).toContain("refreshToken");
    });

    it("assigns fuzzy match score of 0.5", () => {
      const results = astSearch(db, { name: "Token" }, 10);

      for (const r of results) {
        expect(r.score).toBe(0.5);
      }
    });

    it("defaults to fuzzy when matchMode is not specified", () => {
      const results = astSearch(db, { name: "Token" }, 10);

      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("type filter", () => {
    it("filters by chunk type: function", () => {
      const results = astSearch(db, { type: "function" }, 10);

      expect(results.length).toBeGreaterThanOrEqual(3);
      for (const r of results) {
        expect(r.type).toBe("function");
      }
    });

    it("filters by chunk type: class", () => {
      const results = astSearch(db, { type: "class" }, 10);

      expect(results).toHaveLength(2);
      const names = results.map((r) => r.name);
      expect(names).toContain("AuthService");
      expect(names).toContain("ConnectionManager");
    });

    it("filters by chunk type: method", () => {
      const results = astSearch(db, { type: "method" }, 10);

      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.type).toBe("method");
      }
    });

    it("filters by chunk type: constant", () => {
      const results = astSearch(db, { type: "constant" }, 10);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("AUTH_SECRET");
    });

    it("filters by chunk type: type", () => {
      const results = astSearch(db, { type: "type" }, 10);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("AuthConfig");
    });
  });

  describe("parent filter", () => {
    it("finds methods of a specific class", () => {
      const results = astSearch(db, { parent: "AuthService" }, 10);

      expect(results).toHaveLength(2);
      const names = results.map((r) => r.name);
      expect(names).toContain("validateToken");
      expect(names).toContain("refreshToken");
    });
  });

  describe("language filter", () => {
    it("filters by language", () => {
      const results = astSearch(db, { type: "function", language: "python" }, 10);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("create_pool");
      expect(results[0].language).toBe("python");
    });
  });

  describe("combined filters", () => {
    it("name + type narrows results", () => {
      const results = astSearch(
        db,
        { name: "Auth", type: "class" },
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("AuthService");
      expect(results[0].type).toBe("class");
    });

    it("name + parent narrows results", () => {
      const results = astSearch(
        db,
        { name: "validate", parent: "AuthService" },
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("validateToken");
    });

    it("type + language narrows results", () => {
      const results = astSearch(
        db,
        { type: "class", language: "python" },
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("ConnectionManager");
    });
  });

  describe("edge cases", () => {
    it("returns empty for no matches", () => {
      const results = astSearch(db, { name: "nonexistentXYZ" }, 10);

      expect(results).toEqual([]);
    });

    it("respects limit parameter", () => {
      const results = astSearch(db, { type: "function" }, 1);

      expect(results).toHaveLength(1);
    });

    it("returns full metadata in results", () => {
      const results = astSearch(db, { name: "handleRequest", matchMode: "exact" }, 10);

      const r = results[0];
      expect(r.chunkId).toBeDefined();
      expect(r.filePath).toBe("src/handler.ts");
      expect(r.lineStart).toBe(1);
      expect(r.lineEnd).toBe(10);
      expect(r.name).toBe("handleRequest");
      expect(r.type).toBe("function");
      expect(r.text).toContain("handleRequest");
      expect(r.language).toBe("typescript");
    });
  });
});
