export interface SearchResult {
  chunkId: number;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  name: string | null;
  type: string;
  text: string;
  score: number;
  language: string;
}

export interface SearchFilters {
  language?: string;
}
