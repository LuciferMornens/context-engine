/**
 * Kontext — Context Engine for AI Coding Agents
 *
 * Library entry point. Exports core types and functions for programmatic usage.
 */

// ── Core types ───────────────────────────────────────────────────────────────

export type { SearchResult, SearchFilters } from "./search/types.js";
export type { KontextDatabase } from "./storage/db.js";
export type { Embedder } from "./indexer/embedder.js";
export type { KontextConfig } from "./cli/commands/config.js";
export type { DiscoveredFile, DiscoverOptions } from "./indexer/discovery.js";
export type { ASTNode } from "./indexer/parser.js";
export type { Chunk } from "./indexer/chunker.js";
export type { StrategyName, StrategyResult } from "./search/fusion.js";
export type { LLMProvider, SteeringResult } from "./steering/llm.js";
export type { FileChange, WatcherHandle } from "./watcher/watcher.js";

// ── Indexing ─────────────────────────────────────────────────────────────────

export { discoverFiles, LANGUAGE_MAP } from "./indexer/discovery.js";
export { initParser, parseFile } from "./indexer/parser.js";
export { chunkFile, estimateTokens } from "./indexer/chunker.js";
export {
  createLocalEmbedder,
  createVoyageEmbedder,
  createOpenAIEmbedder,
  prepareChunkText,
} from "./indexer/embedder.js";
export { computeChanges } from "./indexer/incremental.js";

// ── Storage ──────────────────────────────────────────────────────────────────

export { createDatabase } from "./storage/db.js";

// ── Search ───────────────────────────────────────────────────────────────────

export { vectorSearch } from "./search/vector.js";
export { ftsSearch } from "./search/fts.js";
export { astSearch } from "./search/ast.js";
export { pathSearch, dependencyTrace } from "./search/path.js";
export { fusionMerge } from "./search/fusion.js";

// ── Steering ─────────────────────────────────────────────────────────────────

export { steer, planSearch } from "./steering/llm.js";

// ── CLI pipelines ────────────────────────────────────────────────────────────

export { runInit } from "./cli/commands/init.js";
export { runQuery } from "./cli/commands/query.js";
export { runAsk } from "./cli/commands/ask.js";
export { runStatus } from "./cli/commands/status.js";

// ── Errors ───────────────────────────────────────────────────────────────────

export {
  KontextError,
  IndexError,
  SearchError,
  ConfigError,
  DatabaseError,
  ErrorCode,
} from "./utils/errors.js";
export { createLogger, LogLevel } from "./utils/logger.js";
export type { Logger } from "./utils/logger.js";
