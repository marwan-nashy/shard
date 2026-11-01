import { SearchResult } from "../types";
import { Bm25Index } from "./bm25";

export interface SearchFilterTokens {
  tags: string[];
  pathPrefix: string | null;
  taskFilter: "todo" | "done" | "any" | null;
  fileFilter: string | null;
  exactPhrases: string[];
  terms: string[];
}

export function parseSearchQuery(query: string): SearchFilterTokens {
  const tokens: SearchFilterTokens = {
    tags: [],
    pathPrefix: null,
    taskFilter: null,
    fileFilter: null,
    exactPhrases: [],
    terms: [],
  };

  // 1. Extract exact phrases in quotes "..."
  const remaining = query.replace(/"([^"]+)"/g, (_, phrase) => {
    tokens.exactPhrases.push(phrase.toLowerCase().trim());
    return "";
  });

  // 2. Extract operator tokens
  const words = remaining.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (word.startsWith("tag:") || word.startsWith("#")) {
      const tg = word.replace(/^(tag:|#)/, "").toLowerCase().trim();
      if (tg) tokens.tags.push(tg);
    } else if (word.startsWith("path:")) {
      tokens.pathPrefix = word.replace(/^path:/, "").toLowerCase().trim();
    } else if (word.startsWith("task:")) {
      const val = word.replace(/^task:/, "").toLowerCase().trim();
      if (val === "todo" || val === "done" || val === "any") {
        tokens.taskFilter = val;
      }
    } else if (word.startsWith("file:")) {
      tokens.fileFilter = word.replace(/^file:/, "").toLowerCase().trim();
    } else {
      tokens.terms.push(word.toLowerCase().trim());
    }
  }

  return tokens;
}

export interface NoteSearchIndexItem {
  title: string;
  path: string;
  content?: string;
  tags?: string[];
  modified?: number;
}

export function executeAdvancedSearch(
  query: string,
  notes: NoteSearchIndexItem[],
  sortBy: "relevance" | "title" | "date" = "relevance"
): SearchResult[] {
  if (!query.trim()) return [];

  const tokens = parseSearchQuery(query);
  const results: { item: NoteSearchIndexItem; score: number; snippet: string }[] = [];

  // Initialize BM25 Index over note collection
  const bm25Docs = notes.map((n) => ({
    id: n.path,
    title: n.title,
    content: n.content || "",
  }));
  const bm25 = new Bm25Index(bm25Docs);

  for (const note of notes) {
    const titleLower = note.title.toLowerCase();
    const pathLower = note.path.toLowerCase();
    const content = note.content || "";
    const contentLower = content.toLowerCase();
    let bonusScore = 0;

    // Filter by path
    if (tokens.pathPrefix && !pathLower.includes(tokens.pathPrefix)) {
      continue;
    }

    // Filter by file name
    if (tokens.fileFilter && !titleLower.includes(tokens.fileFilter)) {
      continue;
    }

    // Filter by tags
    if (tokens.tags.length > 0) {
      const noteTags = (note.tags || []).map((t) => t.toLowerCase());
      const hasAllTags = tokens.tags.every(
        (t) => noteTags.includes(t) || contentLower.includes(`#${t}`)
      );
      if (!hasAllTags) continue;
      bonusScore += tokens.tags.length * 15;
    }

    // Filter by tasks
    if (tokens.taskFilter) {
      const hasTodo = /- \[\s\]/.test(content);
      const hasDone = /- \[[xX]\]/.test(content);
      if (tokens.taskFilter === "todo" && !hasTodo) continue;
      if (tokens.taskFilter === "done" && !hasDone) continue;
      if (tokens.taskFilter === "any" && !hasTodo && !hasDone) continue;
      bonusScore += 5;
    }

    // Filter by exact phrases
    let passedExact = true;
    for (const phrase of tokens.exactPhrases) {
      if (!contentLower.includes(phrase) && !titleLower.includes(phrase)) {
        passedExact = false;
        break;
      }
      bonusScore += 25;
    }
    if (!passedExact) continue;

    // Filter by query terms
    let passedTerms = true;
    for (const term of tokens.terms) {
      const inTitle = titleLower.includes(term);
      const inContent = contentLower.includes(term);
      if (!inTitle && !inContent) {
        passedTerms = false;
        break;
      }
    }
    if (!passedTerms) continue;

    // Compute Okapi BM25 score
    const bm25Score = tokens.terms.length > 0 ? bm25.scoreDocument(note.path, tokens.terms) : 1;
    const finalScore = bm25Score * 10 + bonusScore;

    // Extract best snippet
    let snippet = "Note in vault";
    if (tokens.terms.length > 0 || tokens.exactPhrases.length > 0) {
      const target = tokens.terms[0] || tokens.exactPhrases[0];
      const matchIdx = contentLower.indexOf(target);
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 40);
        const end = Math.min(content.length, matchIdx + target.length + 60);
        snippet = (start > 0 ? "..." : "") + content.slice(start, end).replace(/\n+/g, " ") + (end < content.length ? "..." : "");
      }
    } else if (content.trim()) {
      snippet = content.slice(0, 100).replace(/\n+/g, " ") + "...";
    }

    results.push({ item: note, score: finalScore, snippet });
  }

  // Sort results
  if (sortBy === "title") {
    results.sort((a, b) => a.item.title.localeCompare(b.item.title));
  } else if (sortBy === "date") {
    results.sort((a, b) => (b.item.modified || 0) - (a.item.modified || 0));
  } else {
    results.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  }

  return results.map((r) => ({
    title: r.item.title,
    path: r.item.path,
    snippet: r.snippet,
  }));
}
