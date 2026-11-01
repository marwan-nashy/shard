import React, { useState, useEffect } from "react";
import { X, History, RotateCcw, Clock } from "lucide-react";
import { NoteRevision } from "../types";
import { getNoteRevisions } from "../utils/versionHistory";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePath: string | null;
  currentContent: string;
  onRestoreContent: (restoredContent: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  activePath,
  currentContent,
  onRestoreContent,
}) => {
  const [revisions, setRevisions] = useState<NoteRevision[]>([]);
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activePath) {
      const list = getNoteRevisions(activePath);
      setRevisions(list);
      if (list.length > 0) {
        setSelectedRevId(list[0].id);
      } else {
        setSelectedRevId(null);
      }
    }
  }, [isOpen, activePath]);

  if (!isOpen) return null;

  const selectedRev = revisions.find((r) => r.id === selectedRevId);
  const currentWords = currentContent.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[75vh] bg-bg-card border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-secondary/50">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-accent-purple" />
            <h3 className="text-xs font-semibold text-text-primary tracking-wide">
              Note Revision History
            </h3>
            <span className="text-[11px] text-text-muted font-mono">
              ({revisions.length} snapshots)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Revisions List */}
          <div className="w-72 border-r border-border-subtle overflow-y-auto p-2 space-y-1 bg-bg-secondary/20">
            {revisions.length === 0 ? (
              <div className="p-6 text-center text-text-faint text-xs">
                No previous snapshots yet for this note.
              </div>
            ) : (
              revisions.map((rev, index) => {
                const isSelected = rev.id === selectedRevId;
                const diffWords = rev.wordCount - currentWords;
                return (
                  <div
                    key={rev.id}
                    onClick={() => setSelectedRevId(rev.id)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-bg-secondary border-accent-purple/60 text-text-primary shadow-sm"
                        : "border-transparent text-text-muted hover:bg-bg-hover hover:text-text-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <Clock className="w-3 h-3 text-accent-purple" />
                        <span>{index === 0 ? "Latest Snapshot" : `Revision #${revisions.length - index}`}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono ${
                          diffWords > 0
                            ? "text-accent-emerald"
                            : diffWords < 0
                            ? "text-accent-orange"
                            : "text-text-faint"
                        }`}
                      >
                        {diffWords > 0 ? `+${diffWords}w` : `${diffWords}w`}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-faint mt-1 flex justify-between">
                      <span>{rev.dateStr}</span>
                      <span>{rev.wordCount} words</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Revision Content Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary/50">
            {selectedRev ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg-secondary/30">
                  <div className="text-xs text-text-muted">
                    Viewing snapshot from <strong className="text-text-primary">{selectedRev.dateStr}</strong>
                  </div>
                  <button
                    onClick={() => {
                      onRestoreContent(selectedRev.content);
                      onClose();
                    }}
                    className="px-3 py-1 rounded bg-accent-purple hover:bg-accent-purpleHover text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore Version</span>
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed select-text">
                  {selectedRev.content}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-faint text-xs">
                Select a revision on the left to preview its contents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
