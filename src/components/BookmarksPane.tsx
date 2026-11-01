import React from "react";
import { Bookmark, FileText, LayoutGrid, X, Star } from "lucide-react";
import { BookmarkItem } from "../types";

interface BookmarksPaneProps {
  bookmarks: BookmarkItem[];
  onToggleBookmark: (path: string, title?: string, type?: "note" | "canvas") => void;
  onNavigateToNote: (path: string) => void;
  activePath: string | null;
}

export const BookmarksPane: React.FC<BookmarksPaneProps> = ({
  bookmarks,
  onToggleBookmark,
  onNavigateToNote,
  activePath,
}) => {
  const isCurrentBookmarked = activePath ? bookmarks.some((b) => b.path === activePath) : false;

  const currentTitle = activePath
    ? activePath.split(/[\\/]/).pop()?.replace(/\.(md|canvas)$/, "") || "Untitled"
    : "";
  const currentType = activePath?.endsWith(".canvas") ? "canvas" : "note";

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none">
      {/* Header */}
      <div className="p-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bookmark className="w-4 h-4 text-accent-purple" />
          <span className="text-xs font-semibold text-text-primary">Bookmarks</span>
          <span className="px-1.5 py-0.2 rounded-full bg-accent-purple/15 text-accent-purple font-mono text-[10px]">
            {bookmarks.length}
          </span>
        </div>

        {activePath && (
          <button
            onClick={() => onToggleBookmark(activePath, currentTitle, currentType)}
            className={`p-1 rounded text-xs flex items-center gap-1 transition-colors ${
              isCurrentBookmarked
                ? "text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title={isCurrentBookmarked ? "Remove Bookmark" : "Bookmark Current Note"}
          >
            <Star className={`w-3.5 h-3.5 ${isCurrentBookmarked ? "fill-yellow-400" : ""}`} />
            <span className="text-[10px]">{isCurrentBookmarked ? "Pinned" : "Pin"}</span>
          </button>
        )}
      </div>

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {bookmarks.length === 0 ? (
          <div className="py-12 text-center text-text-faint text-xs space-y-2 px-4">
            <Star className="w-6 h-6 mx-auto opacity-30 text-yellow-400" />
            <p>No bookmarked notes yet.</p>
            <p className="text-[11px] text-text-faint">
              Pin your most important notes and visual canvases here for instant 1-click access.
            </p>
          </div>
        ) : (
          bookmarks.map((bm) => {
            const isActive = bm.path === activePath;
            return (
              <div
                key={bm.path}
                onClick={() => onNavigateToNote(bm.path)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer group transition-all ${
                  isActive
                    ? "bg-bg-card border border-accent-purple/40 text-text-primary font-medium"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                  {bm.type === "canvas" ? (
                    <LayoutGrid className="w-3.5 h-3.5 text-accent-blue shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-accent-purple shrink-0" />
                  )}
                  <span className="truncate">{bm.title}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark(bm.path);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-text-faint hover:text-accent-orange rounded transition-opacity"
                  title="Remove bookmark"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
