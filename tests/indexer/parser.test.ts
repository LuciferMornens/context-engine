import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { parseFile, initParser } from "../../src/indexer/parser.js";

const FIXTURES = path.resolve(__dirname, "../fixtures/parser");

beforeAll(async () => {
  await initParser();
});

describe("parseFile — TypeScript", () => {
  it("extracts functions with correct line ranges", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const validateToken = nodes.find(
      (n) => n.type === "function" && n.name === "validateToken",
    );

    expect(validateToken).toBeDefined();
    if (!validateToken) return;
    expect(validateToken.lineStart).toBe(12);
    expect(validateToken.lineEnd).toBe(15);
    expect(validateToken.language).toBe("typescript");
    expect(validateToken.exports).toBe(true);
    expect(validateToken.parent).toBeNull();
  });

  it("extracts function parameters and return types", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const validateToken = nodes.find(
      (n) => n.type === "function" && n.name === "validateToken",
    );

    expect(validateToken).toBeDefined();
    if (!validateToken) return;
    expect(validateToken.params).toContain("token: string");
    expect(validateToken.returnType).toBe("User | null");
  });

  it("extracts class with methods and their parent class name", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const authService = nodes.find(
      (n) => n.type === "class" && n.name === "AuthService",
    );

    expect(authService).toBeDefined();
    if (!authService) return;
    expect(authService.lineStart).toBe(17);
    expect(authService.exports).toBe(true);

    // Methods should reference their parent class
    const signToken = nodes.find(
      (n) => n.type === "method" && n.name === "signToken",
    );
    expect(signToken).toBeDefined();
    if (!signToken) return;
    expect(signToken.parent).toBe("AuthService");
    expect(signToken.params).toContain("user: User");
    expect(signToken.returnType).toBe("Promise<string>");
  });

  it("extracts imports", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const imports = nodes.filter((n) => n.type === "import");

    expect(imports.length).toBeGreaterThanOrEqual(2);
    const sources = imports.map((i) => i.text);
    expect(sources.some((s) => s.includes("express"))).toBe(true);
  });

  it("extracts export statements", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const exported = nodes.filter((n) => n.exports === true);

    // validateToken, AuthService, AUTH_TIMEOUT, createRouter, their methods
    expect(exported.length).toBeGreaterThanOrEqual(3);
    const names = exported.map((n) => n.name);
    expect(names).toContain("validateToken");
    expect(names).toContain("AuthService");
    expect(names).toContain("AUTH_TIMEOUT");
  });

  it("extracts type definitions and interfaces", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const types = nodes.filter((n) => n.type === "type");

    const names = types.map((t) => t.name);
    expect(names).toContain("User");
    expect(names).toContain("AuthResult");
  });

  it("extracts constants (top-level lexical declarations)", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const authTimeout = nodes.find(
      (n) => n.type === "constant" && n.name === "AUTH_TIMEOUT",
    );

    expect(authTimeout).toBeDefined();
    if (!authTimeout) return;
    expect(authTimeout.exports).toBe(true);
  });

  it("handles JSDoc/docstrings", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const validateToken = nodes.find(
      (n) => n.type === "function" && n.name === "validateToken",
    );

    expect(validateToken).toBeDefined();
    if (!validateToken) return;
    expect(validateToken.docstring).toBeDefined();
    expect(validateToken.docstring).toContain("Validate a JWT token");
  });

  it("includes raw source text for each node", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");
    const validateToken = nodes.find(
      (n) => n.type === "function" && n.name === "validateToken",
    );

    expect(validateToken).toBeDefined();
    if (!validateToken) return;
    expect(validateToken.text).toContain("function validateToken");
    expect(validateToken.text).toContain("return decode(token)");
  });
});

describe("parseFile — Python", () => {
  it("extracts functions and classes", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.py"), "python");

    const createPool = nodes.find(
      (n) => n.type === "function" && n.name === "create_pool",
    );
    expect(createPool).toBeDefined();
    if (!createPool) return;
    expect(createPool.params).toContain("url: str");

    const dbService = nodes.find(
      (n) => n.type === "class" && n.name === "DatabaseService",
    );
    expect(dbService).toBeDefined();
  });

  it("extracts class methods with parent class name", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.py"), "python");
    const connect = nodes.find(
      (n) => n.type === "method" && n.name === "connect",
    );

    expect(connect).toBeDefined();
    if (!connect) return;
    expect(connect.parent).toBe("DatabaseService");
    expect(connect.returnType).toBe("bool");
  });

  it("extracts Python docstrings", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.py"), "python");
    const dbService = nodes.find(
      (n) => n.type === "class" && n.name === "DatabaseService",
    );

    expect(dbService).toBeDefined();
    if (!dbService) return;
    expect(dbService.docstring).toContain("managing database connections");
  });

  it("extracts imports", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.py"), "python");
    const imports = nodes.filter((n) => n.type === "import");

    expect(imports.length).toBeGreaterThanOrEqual(2);
    const texts = imports.map((i) => i.text);
    expect(texts.some((t) => t.includes("os"))).toBe(true);
    expect(texts.some((t) => t.includes("pathlib"))).toBe(true);
  });

  it("extracts top-level constants", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.py"), "python");
    const maxConn = nodes.find(
      (n) => n.type === "constant" && n.name === "MAX_CONNECTIONS",
    );
    expect(maxConn).toBeDefined();
  });
});

describe("parseFile — JavaScript", () => {
  it("extracts functions and classes", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.js"), "javascript");

    const createApp = nodes.find(
      (n) => n.type === "function" && n.name === "createApp",
    );
    expect(createApp).toBeDefined();

    const handler = nodes.find(
      (n) => n.type === "class" && n.name === "RequestHandler",
    );
    expect(handler).toBeDefined();
  });

  it("extracts class methods with parent", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.js"), "javascript");
    const handleGet = nodes.find(
      (n) => n.type === "method" && n.name === "handleGet",
    );

    expect(handleGet).toBeDefined();
    if (!handleGet) return;
    expect(handleGet.parent).toBe("RequestHandler");
  });
});

describe("parseFile — edge cases", () => {
  it("handles syntax errors gracefully with partial parse", async () => {
    const nodes = await parseFile(
      path.join(FIXTURES, "syntax-error.ts"),
      "typescript",
    );

    // Should still extract the valid function before the error
    const valid = nodes.find(
      (n) => n.type === "function" && n.name === "validFunction",
    );
    expect(valid).toBeDefined();
  });

  it("returns empty array for unsupported language", async () => {
    const nodes = await parseFile(
      path.join(FIXTURES, "sample.ts"),
      "haskell",
    );
    expect(nodes).toEqual([]);
  });

  it("returns empty array for non-existent file", async () => {
    const nodes = await parseFile("/nonexistent/file.ts", "typescript");
    expect(nodes).toEqual([]);
  });

  it("every node has required fields", async () => {
    const nodes = await parseFile(path.join(FIXTURES, "sample.ts"), "typescript");

    for (const node of nodes) {
      expect(node.type).toBeDefined();
      expect(typeof node.lineStart).toBe("number");
      expect(typeof node.lineEnd).toBe("number");
      expect(node.lineStart).toBeGreaterThan(0);
      expect(node.lineEnd).toBeGreaterThanOrEqual(node.lineStart);
      expect(node.language).toBe("typescript");
      expect(typeof node.text).toBe("string");
      expect(node.text.length).toBeGreaterThan(0);
    }
  });
});
