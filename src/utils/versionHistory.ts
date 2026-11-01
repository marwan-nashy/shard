import { NoteRevision } from "../types";

const MAX_REVISIONS_PER_NOTE = 25;
const MIN_SNAPSHOT_INTERVAL_MS = 15000; // 15 seconds

function getStorageKey(path: string): string {
  return `shard_revs_${encodeURIComponent(path)}`;
}

export function getNoteRevisions(path: string): NoteRevision[] {
  if (!path) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(path));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveNoteSnapshot(path: string, content: string): void {
  if (!path || !content.trim()) return;
  try {
    const revisions = getNoteRevisions(path);
    const now = Date.now();

    // Avoid duplicate snapshots if identical or too rapid
    if (revisions.length > 0) {
      const latest = revisions[0];
      if (latest.content === content) return;
      if (now - latest.timestamp < MIN_SNAPSHOT_INTERVAL_MS) {
        // Update latest revision content instead of appending
        latest.content = content;
        latest.timestamp = now;
        latest.wordCount = content.trim().split(/\s+/).filter(Boolean).length;
        latest.dateStr = new Date(now).toLocaleTimeString();
        localStorage.setItem(getStorageKey(path), JSON.stringify(revisions));
        return;
      }
    }

    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const newRev: NoteRevision = {
      id: `rev-${now}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: now,
      dateStr: new Date(now).toLocaleString(),
      content,
      wordCount: words,
    };

    const updated = [newRev, ...revisions].slice(0, MAX_REVISIONS_PER_NOTE);
    localStorage.setItem(getStorageKey(path), JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save note snapshot:", err);
  }
}

export function deleteNoteHistory(path: string): void {
  if (!path) return;
  try {
    localStorage.removeItem(getStorageKey(path));
  } catch {}
}
