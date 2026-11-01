/**
 * Okapi BM25 Ranking Algorithm for Shard.
 * 
 * Probabilistic relevance ranking function used by search engines (e.g. Lucene, Elasticsearch).
 * BM25 ranks documents based on the query terms appearing in each document,
 * normalized by document length and penalized by document frequency across the vault.
 * 
 * Formula:
 * score(D, Q) = sum( IDF(qi) * [ (f(qi, D) * (k1 + 1)) / (f(qi, D) + k1 * (1 - b + b * (|D| / avgdl))) ] )
 * 
 * Parameters:
 * k1 = 1.2 (controls term saturation)
 * b = 0.75 (controls document length normalization)
 */

export interface Bm25Document {
  id: string;
  title: string;
  content: string;
}

export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export class Bm25Index {
  private k1: number;
  private b: number;
  private avgDocLength: number = 0;
  private docLengths: Map<string, number> = new Map();
  private docTermFreqs: Map<string, Map<string, number>> = new Map();
  private docTitleTermFreqs: Map<string, Map<string, number>> = new Map();
  private termDocCount: Map<string, number> = new Map();
  private totalDocs: number = 0;

  constructor(docs: Bm25Document[], k1: number = 1.2, b: number = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.indexDocuments(docs);
  }

  private indexDocuments(docs: Bm25Document[]): void {
    this.totalDocs = docs.length;
    if (this.totalDocs === 0) return;

    let totalLength = 0;

    for (const doc of docs) {
      const contentTokens = tokenizeText(doc.content);
      const titleTokens = tokenizeText(doc.title);
      const len = contentTokens.length + titleTokens.length;

      this.docLengths.set(doc.id, len);
      totalLength += len;

      // Frequency map for content
      const contentFreq = new Map<string, number>();
      for (const t of contentTokens) {
        contentFreq.set(t, (contentFreq.get(t) || 0) + 1);
      }
      this.docTermFreqs.set(doc.id, contentFreq);

      // Frequency map for title
      const titleFreq = new Map<string, number>();
      for (const t of titleTokens) {
        titleFreq.set(t, (titleFreq.get(t) || 0) + 1);
      }
      this.docTitleTermFreqs.set(doc.id, titleFreq);

      // Unique terms across this document
      const uniqueTerms = new Set([...contentTokens, ...titleTokens]);
      for (const t of uniqueTerms) {
        this.termDocCount.set(t, (this.termDocCount.get(t) || 0) + 1);
      }
    }

    this.avgDocLength = totalLength / this.totalDocs || 1;
  }

  /**
   * Compute Okapi BM25 score for a document given search terms.
   * Gives a 3.0x multiplier to terms appearing in the document title.
   */
  public scoreDocument(docId: string, queryTerms: string[]): number {
    if (this.totalDocs === 0 || queryTerms.length === 0) return 0;

    const docLen = this.docLengths.get(docId) || 1;
    const contentFreq = this.docTermFreqs.get(docId);
    const titleFreq = this.docTitleTermFreqs.get(docId);
    let totalScore = 0;

    for (const term of queryTerms) {
      const lower = term.toLowerCase();
      const n_q = this.termDocCount.get(lower) || 0;
      if (n_q === 0) continue;

      // Standard Lucene/BM25 IDF with smoothing
      const idf = Math.log(1 + (this.totalDocs - n_q + 0.5) / (n_q + 0.5));

      // Term frequency in doc content and title
      const f_content = contentFreq?.get(lower) || 0;
      const f_title = titleFreq?.get(lower) || 0;

      // Combined frequency with 3x title boost
      const f = f_content + f_title * 3.0;
      if (f === 0) continue;

      const numerator = f * (this.k1 + 1);
      const denominator = f + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));

      totalScore += idf * (numerator / denominator);
    }

    return totalScore;
  }
}
