# Kontext — Context Engine for AI Coding Agents

> Your AI agent is only as good as its context. Stop feeding it garbage.

## What Is This

A CLI tool that sits alongside any AI coding agent (Codex, Claude Code, Cursor, lxt, Aider) and gives it the ability to search a codebase semantically. The agent asks a natural language question, `ctx` returns the exact files and line ranges with explanations.

No MCP. No plugins. Just a CLI that any agent can call via bash.

---

## The Problem

AI coding agents are blind. They either:
- Read the whole codebase (slow, blows context window)
- Rely on grep/find (misses semantic meaning)
- Need hand-crafted AGENTS.md / .cursorrules (doesn't scale)

Developers waste time manually pointing agents at the right files. The agent asks "where is auth?", the dev manually pastes 5 file paths. Every. Single. Time.

## The Solution

```bash
$ ctx find "where is authentication handled"

src/middleware/auth.ts  L14-L89
  JWT validation, session checking, role-based access control

src/routes/api/login.ts  L45-L112
  Login endpoint: password hashing, token generation, refresh flow

src/db/models/user.ts  L1-L34
  User schema: email, hashed password, roles, sessions relation

3 results · 4ms index lookup · 320ms LLM steering · $0.0008
```

Any agent that can run bash can use this. Zero integration required.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                         ctx CLI                          │
├──────────┬──────────────┬───────────────┬───────────────┤
│  Indexer  │  Search Engine │  Steering LLM  │  Output Layer │
├──────────┴──────────────┴───────────────┴───────────────┤
│                    Storage (SQLite)                       │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
                    INDEXING (once + incremental)
                    ═══════════════════════════
                    
Source Files ──► Tree-sitter AST ──► Logical Chunks ──► Embeddings ──► SQLite
                     │                     │                              │
                     ├── functions          ├── chunk text                 ├── vectors (sqlite-vec)
                     ├── classes            ├── file path                  ├── metadata
                     ├── imports            ├── line range                 ├── AST index
                     └── exports            ├── language                   └── file hashes (for incremental)
                                            └── dependencies


                    QUERYING (per request)
                    ══════════════════════
                    
User Query ──► Steering LLM ──► Multi-Strategy Search ──► Re-rank ──► Output
                    │                    │
                    ├── decompose         ├── vector similarity (semantic)
                    ├── pick strategy     ├── AST lookup (structural)
                    ├── expand terms      ├── path/name match (lexical)
                    └── set weights       └── dependency trace (graph)
```

---

## Components

### 1. Indexer

Parses the codebase into searchable chunks. Runs once on `ctx init`, then incrementally on changes.

#### 1.1 File Discovery

```
Input:  Project root directory
Filter: .gitignore rules, .ctxignore (custom), binary detection
Output: List of source files to index
```

- Respect `.gitignore` automatically
- Support `.ctxignore` for additional exclusions (node_modules, dist, etc.)
- Skip binary files, lockfiles, generated code
- Follow symlinks optionally

#### 1.2 AST Parsing (Tree-sitter)

```
Input:  Source file
Output: AST nodes with types, names, line ranges, relationships
```

Tree-sitter provides language-agnostic AST parsing. We extract:

| Node Type | What We Get |
|---|---|
| Functions/Methods | Name, params, return type, line range, docstring |
| Classes/Structs | Name, methods, properties, inheritance |
| Imports/Exports | Dependencies, what's public |
| Constants/Config | Top-level values, env vars |
| Types/Interfaces | Shape definitions |

Supported languages (Tree-sitter has parsers for all of these):
- TypeScript/JavaScript, Python, Go, Rust, Java, C/C++, Ruby, PHP, Swift, Kotlin
- Config: JSON, YAML, TOML, .env
- Docs: Markdown

#### 1.3 Chunking Strategy

**NOT arbitrary line windows.** Chunks follow code structure:

```
Chunk = one logical unit:
  - A function/method (with docstring if present)
  - A class (short) or class method (long classes)
  - A config block
  - A type definition
  - A group of related imports
```

Rules:
- Max chunk size: ~500 tokens (tunable)
- Large functions split at logical boundaries (if/else blocks, loops)
- Always include context: file path, surrounding class name, imports used
- Overlapping context: each chunk knows what's above and below it

Chunk metadata:
```json
{
  "id": "uuid",
  "file": "src/middleware/auth.ts",
  "line_start": 14,
  "line_end": 89,
  "language": "typescript",
  "type": "function",
  "name": "validateSession",
  "parent": "AuthMiddleware",
  "imports": ["jsonwebtoken", "../db/user"],
  "exports": true,
  "hash": "sha256:...",
  "text": "async function validateSession(req, res, next) { ... }"
}
```

#### 1.4 Embedding Generation

Two tiers:

**Local (free tier):**
- Model: **CodeRankEmbed** (137M params, MIT license, 8K context)
- Runtime: ONNX via `@xenova/transformers` (runs in Node.js, no Python needed)
- Speed: ~50-100 chunks/sec on CPU
- Dimensions: 768

**API (pro tier):**
- Model: **VoyageCode3** (32K context, best-in-class)
- Cost: ~$0.06 per 1M tokens
- Batch embedding endpoint for speed
- Fallback: OpenAI text-embedding-3-large

#### 1.5 Storage

**SQLite + sqlite-vec** — single file, zero infra.

```sql
-- Core tables
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  language TEXT,
  hash TEXT NOT NULL,           -- for incremental updates
  last_indexed INTEGER NOT NULL
);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  type TEXT NOT NULL,            -- function, class, type, config, etc.
  name TEXT,                     -- symbol name if applicable
  parent TEXT,                   -- enclosing class/module
  text TEXT NOT NULL,            -- raw source code
  metadata JSON,                -- imports, exports, params, etc.
  hash TEXT NOT NULL
);

-- Vector index (sqlite-vec)
CREATE VIRTUAL TABLE chunk_vectors USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding float[768]
);

-- AST relationships
CREATE TABLE dependencies (
  source_chunk_id INTEGER REFERENCES chunks(id),
  target_chunk_id INTEGER REFERENCES chunks(id),
  type TEXT NOT NULL             -- imports, calls, extends, implements
);

-- Full-text search (FTS5) for lexical matching
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  name, text, parent,
  content='chunks',
  content_rowid='id'
);
```

#### 1.6 Incremental Updates

On `ctx update` or `ctx watch`:

1. Scan files, compare hashes to `files.hash`
2. Changed files → re-parse AST, re-chunk, re-embed
3. Deleted files → cascade delete chunks + vectors
4. New files → full index
5. Unchanged files → skip

Git-aware: use `git diff --name-only HEAD~1` for fast change detection.

---

### 2. Steering LLM

The brain that turns vague human questions into precise search operations. This is what makes `ctx` 10x better than raw vector search.

#### 2.1 Model Selection

| Priority | Model | Cost/1M tokens | Why |
|---|---|---|---|
| 1 | Gemini 2.0 Flash | $0.10 in / $0.40 out | Cheapest, fast, good at structured output |
| 2 | GPT-4o-mini | $0.15 in / $0.60 out | Reliable fallback |
| 3 | Local (Llama 3.3 via Ollama) | Free | Offline mode |

Estimated cost per query: **$0.0005 - $0.002** (steering uses ~200-500 tokens in, ~200 out)

#### 2.2 Query Decomposition

The steering LLM receives the user's question and returns a structured search plan:

```
Input:  "how does payment processing work in this app"

LLM Output (JSON):
{
  "sub_queries": [
    {
      "query": "payment gateway integration stripe",
      "strategy": "vector",
      "weight": 1.0
    },
    {
      "query": "checkout flow cart order",
      "strategy": "vector",
      "weight": 0.8
    },
    {
      "query": "price calculation tax discount",
      "strategy": "vector",
      "weight": 0.6
    }
  ],
  "structural_hints": {
    "ast_grep": ["*payment*", "*stripe*", "*checkout*", "*billing*"],
    "path_patterns": ["**/payment/**", "**/billing/**", "**/checkout/**"]
  },
  "max_results": 8
}
```

#### 2.3 Steering Prompt

```
You are a code search query optimizer. Given a natural language question about
a codebase, decompose it into precise search operations.

Return JSON with:
- sub_queries: array of {query, strategy, weight}
  - strategy: "vector" (semantic) | "ast" (structural) | "path" (file names) | "fts" (keyword)
  - weight: 0.0-1.0 importance
- structural_hints: optional AST symbol patterns and file path globs
- max_results: suggested result count (3-15)

Be specific. Turn vague questions into concrete code concepts.
```

#### 2.4 Result Summarization

After search results are collected, the steering LLM:

1. Reads the top N code chunks
2. Filters out irrelevant results (vector search noise)
3. Generates a one-line summary for each result explaining WHAT and WHY
4. Orders by relevance to the original question

```
Steering LLM Input:
  Original question: "how does auth work"
  Result chunks: [chunk1, chunk2, chunk3, ...]

Steering LLM Output:
  [
    { "chunk_id": 42, "relevant": true, "summary": "JWT validation and session checking — core auth middleware" },
    { "chunk_id": 17, "relevant": true, "summary": "Login endpoint with password hashing and token generation" },
    { "chunk_id": 88, "relevant": false, "reason": "Only mentions 'auth' in a comment, not actual auth logic" }
  ]
```

---

### 3. Search Engine

Multi-strategy search that combines results from different approaches.

#### 3.1 Vector Search (Semantic)

```sql
SELECT c.*, cv.distance
FROM chunk_vectors cv
JOIN chunks c ON c.id = cv.chunk_id
WHERE cv.embedding MATCH ?query_vector
  AND k = ?limit
ORDER BY cv.distance ASC
```

Best for: natural language questions, conceptual queries, "how does X work"

#### 3.2 AST Lookup (Structural)

Direct symbol search using the AST index:

```sql
SELECT * FROM chunks
WHERE name LIKE ?pattern
  OR parent LIKE ?pattern
  AND type IN ('function', 'class', 'method')
```

Best for: "find the User class", "where is validateToken defined"

#### 3.3 Full-Text Search (Lexical)

```sql
SELECT * FROM chunks_fts
WHERE chunks_fts MATCH ?query
ORDER BY rank
```

Best for: specific keywords, error messages, config values

#### 3.4 Path Match

```sql
SELECT * FROM files
WHERE path GLOB ?pattern
```

Best for: "anything in the auth folder", "find config files"

#### 3.5 Dependency Trace

```sql
-- Find everything that imports from a given chunk
SELECT c2.* FROM dependencies d
JOIN chunks c2 ON c2.id = d.source_chunk_id
WHERE d.target_chunk_id = ?chunk_id
  AND d.type = 'imports'
```

Best for: "what uses the User model", "what calls this function"

#### 3.6 Result Merging (Reciprocal Rank Fusion)

Combine results from multiple strategies using RRF:

```
For each result appearing in any strategy's results:
  score = Σ (weight_i / (k + rank_i))
  
  where:
    weight_i = strategy weight from steering LLM
    rank_i   = position in that strategy's results
    k        = 60 (standard RRF constant)
```

This naturally handles results appearing in multiple strategies (boosted) vs single strategies.

---

### 4. CLI Interface

#### 4.1 Commands

```bash
# ── Indexing ──────────────────────────────────────────────
ctx init                          # Index current directory
ctx init /path/to/project         # Index specific directory
ctx update                        # Incremental re-index
ctx watch                         # Watch mode, re-index on changes
ctx status                        # Show index stats

# ── Searching ─────────────────────────────────────────────
ctx find "query"                  # Natural language search
ctx find "query" --full           # Include source code in output
ctx find "query" --json           # Machine-readable JSON output
ctx find "query" --no-llm         # Skip steering LLM, raw vector search only
ctx find "query" --limit 10       # Max results
ctx find "query" --language ts    # Filter by language

# ── Inspection ────────────────────────────────────────────
ctx symbols                       # List all indexed symbols
ctx symbols --type function       # Filter by type
ctx deps src/auth.ts              # Show dependency graph for a file
ctx chunk src/auth.ts:45          # Show the chunk containing line 45

# ── Configuration ─────────────────────────────────────────
ctx config                        # Show current config
ctx config set llm gemini-flash   # Set steering LLM
ctx config set embedder local     # Use local embeddings
ctx config set embedder voyage    # Use Voyage API
ctx auth                          # Set API keys
```

#### 4.2 Output Formats

**Default (human-readable):**
```
$ ctx find "database connection pooling"

src/db/pool.ts  L8-L45
  Connection pool setup: max 20 connections, idle timeout 30s, retry logic

src/db/index.ts  L1-L23
  Database client initialization, pool config from environment variables

src/config/database.ts  L12-L34
  Database configuration schema: host, port, pool size, SSL settings

3 results · 12ms search · 280ms steering · $0.0006
```

**Full (with code):**
```
$ ctx find "database connection pooling" --full

━━ src/db/pool.ts  L8-L45 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Connection pool setup: max 20 connections, idle timeout 30s, retry logic

  8 │ import { Pool } from 'pg';
  9 │ import { dbConfig } from '../config/database';
 10 │
 11 │ export const pool = new Pool({
 12 │   host: dbConfig.host,
 13 │   port: dbConfig.port,
    │   ...
 45 │ });

━━ src/db/index.ts  L1-L23 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...
```

**JSON (for agents):**
```json
{
  "query": "database connection pooling",
  "results": [
    {
      "file": "src/db/pool.ts",
      "line_start": 8,
      "line_end": 45,
      "summary": "Connection pool setup: max 20 connections, idle timeout 30s, retry logic",
      "type": "function",
      "name": "createPool",
      "language": "typescript",
      "score": 0.94,
      "code": "import { Pool } from 'pg';\n..."
    }
  ],
  "stats": {
    "search_ms": 12,
    "steering_ms": 280,
    "cost_usd": 0.0006,
    "strategies_used": ["vector", "path"]
  }
}
```

---

### 5. Configuration

Stored in `.ctx/config.json` in the project root (or `~/.ctx/config.json` global).

```json
{
  "embedder": {
    "type": "local",
    "model": "coderank-embed",
    "dimensions": 768
  },
  "llm": {
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "api_key_env": "GEMINI_API_KEY"
  },
  "index": {
    "max_chunk_tokens": 500,
    "languages": "auto",
    "ignore": ["node_modules", "dist", ".git", "*.lock"]
  },
  "search": {
    "default_limit": 5,
    "strategies": ["vector", "fts", "ast", "path"],
    "rrf_k": 60
  }
}
```

---

## Tech Stack

| Component | Technology | Why |
|---|---|---|
| Language | TypeScript | Ecosystem, npm distribution, fast to ship |
| Runtime | Node.js | Universal, no Python dependency for users |
| CLI Framework | Commander.js or yargs | Lightweight, well-tested |
| AST Parsing | tree-sitter (WASM) | Language-agnostic, runs in Node via WASM |
| Local Embeddings | @xenova/transformers (ONNX) | Runs CodeRankEmbed in Node, no Python |
| API Embeddings | VoyageCode3 / OpenAI | HTTP calls, simple |
| Steering LLM | Gemini Flash / GPT-4o-mini | HTTP calls, structured JSON output |
| Vector DB | sqlite-vec | Zero infra, single file, fast KNN |
| Full-Text Search | SQLite FTS5 | Built into SQLite |
| Database | better-sqlite3 | Sync SQLite for Node, fast, reliable |
| File Watching | chokidar | Battle-tested file watcher |
| Git Integration | simple-git | Gitignore parsing, change detection |

---

## Monetization

### Free Tier
- Local embeddings (CodeRankEmbed via ONNX)
- No steering LLM (raw vector search only, `--no-llm` mode)
- 1 project
- All CLI features
- Community support

### Pro — $15/month
- Steering LLM (Gemini Flash) — user's own API key OR bundled credits
- VoyageCode3 embeddings (higher quality)
- Unlimited projects
- `ctx watch` (live re-indexing)
- Dependency graph search
- Priority support

### Team — $50/month
- Everything in Pro
- Shared index across team (sync via cloud)
- Onboarding context for new devs
- Usage analytics
- Custom embedding models

### Revenue Model

Option A: **API key passthrough** — user provides their own Gemini/Voyage keys, we charge for the tool.

Option B: **Bundled credits** — we proxy API calls, mark up slightly. Simpler UX, better margin.

Option C: **Hybrid** — free with own keys, or pay us for convenience + extra features.

**Recommendation:** Start with Option A (user brings keys). Lower barrier, faster adoption. Add Option B later when there's demand for "just works" simplicity.

---

## MVP Scope (2 Weeks)

### Week 1: Core Engine

- [ ] Project scaffolding (TypeScript, npm package)
- [ ] File discovery + .gitignore parsing
- [ ] Tree-sitter WASM integration (TypeScript, Python, JavaScript)
- [ ] Chunking engine (function-level, class-level)
- [ ] Local embedding pipeline (CodeRankEmbed via ONNX)
- [ ] SQLite storage (better-sqlite3 + sqlite-vec)
- [ ] Basic vector search (KNN)
- [ ] FTS5 full-text search
- [ ] `ctx init` and `ctx find` (--no-llm mode)
- [ ] Human-readable and JSON output

### Week 2: Steering + Polish

- [ ] Steering LLM integration (Gemini Flash)
- [ ] Query decomposition prompt
- [ ] Result summarization prompt
- [ ] Multi-strategy search (vector + FTS + path + AST)
- [ ] Reciprocal Rank Fusion merging
- [ ] Incremental updates (`ctx update`)
- [ ] `ctx watch` mode
- [ ] `ctx status`, `ctx config`, `ctx auth`
- [ ] README, landing page
- [ ] npm publish

### Post-MVP
- [ ] More languages (Go, Rust, Java, etc.)
- [ ] Dependency graph tracing
- [ ] VoyageCode3 API integration
- [ ] Pro tier licensing
- [ ] VS Code extension (optional, drives adoption)
- [ ] GitHub Action for auto-indexing on push

---

## File Structure

```
ctx/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE                     (MIT)
├── src/
│   ├── cli/
│   │   ├── index.ts            # Entry point, command routing
│   │   ├── commands/
│   │   │   ├── init.ts         # ctx init
│   │   │   ├── find.ts         # ctx find
│   │   │   ├── update.ts       # ctx update
│   │   │   ├── watch.ts        # ctx watch
│   │   │   ├── status.ts       # ctx status
│   │   │   ├── config.ts       # ctx config
│   │   │   └── auth.ts         # ctx auth
│   │   └── output/
│   │       ├── human.ts        # Human-readable formatter
│   │       └── json.ts         # JSON formatter
│   ├── indexer/
│   │   ├── discovery.ts        # File discovery + gitignore
│   │   ├── parser.ts           # Tree-sitter AST parsing
│   │   ├── chunker.ts          # Logical chunking engine
│   │   ├── embedder.ts         # Embedding generation (local + API)
│   │   └── incremental.ts      # Change detection + partial re-index
│   ├── search/
│   │   ├── engine.ts           # Search orchestrator
│   │   ├── vector.ts           # Vector similarity search
│   │   ├── fts.ts              # Full-text search
│   │   ├── ast.ts              # AST symbol lookup
│   │   ├── path.ts             # File path matching
│   │   ├── deps.ts             # Dependency graph traversal
│   │   └── fusion.ts           # Reciprocal Rank Fusion
│   ├── steering/
│   │   ├── llm.ts              # LLM client (Gemini, OpenAI, local)
│   │   ├── decompose.ts        # Query decomposition
│   │   ├── summarize.ts        # Result summarization
│   │   └── prompts.ts          # System prompts
│   ├── storage/
│   │   ├── db.ts               # SQLite connection + migrations
│   │   ├── schema.ts           # Table definitions
│   │   └── vectors.ts          # sqlite-vec operations
│   └── config/
│       ├── loader.ts           # Config file loading
│       └── defaults.ts         # Default configuration
├── tree-sitter-wasm/           # Pre-built WASM parsers
│   ├── typescript.wasm
│   ├── python.wasm
│   └── javascript.wasm
└── tests/
    ├── indexer/
    ├── search/
    ├── steering/
    └── fixtures/               # Sample codebases for testing
```

---

## Competitive Landscape

| Tool | What It Does | How ctx Differs |
|---|---|---|
| grep/ripgrep | Keyword search | No semantic understanding |
| GitHub code search | Keyword + some semantic | Requires GitHub, not local, no line ranges |
| Sourcegraph | Enterprise code search | Heavy, expensive, server-based |
| Cursor/Windsurf | IDE-integrated context | Locked to their editor |
| Greptile | API for code search | API-only, not local, expensive |
| aider /map | Repo map for context | Limited to file-level, no search |

**ctx's moat:** Local-first, works with ANY agent, semantic + structural + LLM steering combined, dirt cheap to run.

---

## Name Ideas

- `ctx` — short, memorable, unix-y ✓
- `contextor` — more descriptive
- `codebase` — taken probably
- `codex` — taken (OpenAI)
- `srcfind` — descriptive but boring
- `deepgrep` — catchy
- `codefind` — straightforward

**Recommendation:** `ctx` — it's clean, short, and describes exactly what it does.

---

## Success Metrics (Month 1)

- [ ] Ship MVP on npm
- [ ] Landing page live
- [ ] Post on HN, Reddit, Twitter
- [ ] 500+ npm installs
- [ ] 100+ GitHub stars
- [ ] 10+ Pro signups ($150/mo MRR)
- [ ] Featured in at least 1 newsletter/blog

---

*Last updated: 2026-02-13*
*Author: Bogdan Alexe + Jarv*
