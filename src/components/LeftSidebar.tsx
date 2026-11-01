import React, { useState, useMemo } from "react";
import { FileNode, SearchResult, SidebarTab, OutlineItem, BookmarkItem, FeatureFlags } from "../types";
import { Translations } from "../i18n";
import { FileTree } from "./FileTree";
import { CalendarPane } from "./CalendarPane";
import { TasksPane } from "./TasksPane";
import { BookmarksPane } from "./BookmarksPane";
import {
  Folder,
  Search,
  Tag,
  ListTree,
  Calendar as CalendarIcon,
  CheckSquare,
  Bookmark as BookmarkIcon,
  FileText,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

interface LeftSidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  // FileTree props
  nodes: FileNode[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
  onCreateNote: (parentFolder?: string) => void;
  onCreateFolder: (parentFolder?: string) => void;
  onCreateCanvas?: (parentFolder?: string) => void;
  onRenameItem: (path: string, currentName: string) => void;
  onDeleteItem: (path: string, name: string) => void;
  // Search props
  onSearchVault: (query: string) => Promise<SearchResult[]>;
  allNotes: { title: string; path: string }[];
  // Tags props
  allTags: { tag: string; count: number; paths: string[] }[];
  onNavigateToNote: (path: string) => void;
  // Outline props
  activeContent: string;
  onJumpToHeading: (headingTitle: string) => void;
  onCreateDailyNote?: (dateStr: string) => void;
  bookmarks?: BookmarkItem[];
  onToggleBookmark?: (path: string, title?: string, type?: "note" | "canvas") => void;
  onUpdateNoteContent?: (path: string, newContent: string) => void;
  t?: Translations["sidebar"];
  features?: FeatureFlags;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeTab,
  onTabChange,
  nodes,
  activePath,
  onSelectFile,
  onCreateNote,
  onCreateFolder,
  onCreateCanvas,
  onRenameItem,
  onDeleteItem,
  onSearchVault,
  allNotes,
  allTags,
  onNavigateToNote,
  activeContent,
  onJumpToHeading,
  onCreateDailyNote,
  bookmarks = [],
  onToggleBookmark,
  onUpdateNoteContent,
  t,
  features,
}) => {
  // Search View State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Tag View State
  const [tagQuery, setTagQuery] = useState("");
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  // Handle Search Input Change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await onSearchVault(query);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  };

  // Filtered Tags
  const filteredTags = useMemo(() => {
    if (!tagQuery.trim()) return allTags;
    const q = tagQuery.toLowerCase().replace(/^#/, "");
    return allTags.filter((t) => t.tag.toLowerCase().includes(q));
  }, [allTags, tagQuery]);

  // Parse Outline (Headings from active note content)
  const outlineItems = useMemo<OutlineItem[]>(() => {
    if (!activeContent.trim()) return [];
    const items: OutlineItem[] = [];
    const lines = activeContent.split("\n");

    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        items.push({
          level: match[1].length,
          title: match[2].trim(),
          line: idx + 1,
        });
      }
    });

    return items;
  }, [activeContent]);

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none text-xs">
      {/* Top Sidebar Tab Navigation Bar */}
      <div className="flex items-center border-b border-border-subtle bg-bg-secondary/80 px-2 py-1 gap-1">
        <button
          onClick={() => onTabChange("files")}
          className={`p-1.5 rounded transition-colors ${
            activeTab === "files"
              ? "bg-bg-card text-accent-purple font-medium"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
          title={t?.files || "Files"}
        >
          <Folder className="w-3.5 h-3.5" />
        </button>

        {features?.sidebarSearch !== false && (
          <button
            onClick={() => onTabChange("search")}
            className={`p-1.5 rounded transition-colors ${
              activeTab === "search"
                ? "bg-bg-card text-accent-purple font-medium"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title={t?.search || "Search"}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {features?.sidebarTags !== false && (
          <button
            onClick={() => onTabChange("tags")}
            className={`p-1.5 rounded transition-colors ${
              activeTab === "tags"
                ? "bg-bg-card text-accent-purple font-medium"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title={t?.tags || "Tags"}
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
        )}

        {features?.sidebarCalendar !== false && (
          <button
            onClick={() => onTabChange("calendar")}
            className={`p-1.5 rounded transition-colors ${
              activeTab === "calendar"
                ? "bg-bg-card text-accent-purple font-medium"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="Daily Notes Calendar"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
          </button>
        )}

        {features?.sidebarTasks !== false && (
          <button
            onClick={() => onTabChange("tasks")}
            className={`p-1.5 rounded transition-colors ${
              activeTab === "tasks"
                ? "bg-bg-card text-accent-purple font-medium"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="Vault Tasks"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
        )}

        {features?.sidebarBookmarks !== false && (
          <button
            onClick={() => onTabChange("bookmarks")}
            className={`p-1.5 rounded transition-colors ${
              activeTab === "bookmarks"
                ? "bg-bg-card text-accent-purple font-medium"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="Bookmarks"
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => onTabChange("outline")}
          className={`p-1.5 rounded transition-colors ${
            activeTab === "outline"
              ? "bg-bg-card text-accent-purple font-medium"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
          title={t?.outline || "Outline"}
        >
          <ListTree className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* TAB 1: FILES (File Explorer) */}
        {activeTab === "files" && (
          <FileTree
            nodes={nodes}
            activePath={activePath}
            onSelectFile={onSelectFile}
            onCreateNote={onCreateNote}
            onCreateFolder={onCreateFolder}
            onCreateCanvas={onCreateCanvas}
            onRenameItem={onRenameItem}
            onDeleteItem={onDeleteItem}
            t={t}
          />
        )}

        {/* TAB 2: SEARCH */}
        {activeTab === "search" && (
          <div className="flex flex-col h-full p-2 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t?.searchPlaceholder || "Search vault notes..."}
                className="w-full bg-bg-card border border-border-subtle rounded px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent-purple"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute right-2 top-2 text-text-faint hover:text-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {isSearching ? (
                <div className="text-center text-text-faint text-[11px] py-4">
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectFile(result.path)}
                    className="p-2 rounded bg-bg-card/40 hover:bg-bg-hover border border-border-subtle/50 cursor-pointer space-y-1 transition-colors"
                  >
                    <div className="font-semibold text-text-primary truncate">
                      {result.title}
                    </div>
                    <div className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                      {result.snippet}
                    </div>
                  </div>
                ))
              ) : searchQuery ? (
                <div className="text-center text-text-faint text-[11px] py-4">
                  {t?.noResults || "No matching notes found."}
                </div>
              ) : (
                <div className="text-center text-text-faint text-[11px] py-4">
                  Type to search note contents.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TAGS */}
        {activeTab === "tags" && (
          <div className="flex flex-col h-full p-2 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Filter #tags..."
                className="w-full bg-bg-card border border-border-subtle rounded px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent-purple"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredTags.length === 0 ? (
                <div className="text-center text-text-faint text-[11px] py-4">
                  {t?.noTags || "No tags found in vault."}
                </div>
              ) : (
                filteredTags.map((item) => {
                  const isExpanded = expandedTag === item.tag;
                  return (
                    <div key={item.tag} className="space-y-0.5">
                      <div
                        onClick={() =>
                          setExpandedTag(isExpanded ? null : item.tag)
                        }
                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-text-faint" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-text-faint" />
                          )}
                          <span className="font-medium text-accent-purple">
                            #{item.tag}
                          </span>
                        </div>
                        <span className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded text-text-faint font-mono">
                          {item.count}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="pl-5 space-y-0.5">
                          {item.paths.map((path) => {
                            const title =
                              allNotes.find((n) => n.path === path)?.title ||
                              path.split(/[\\/]/).pop()?.replace(/\.md$/, "") ||
                              "Untitled";
                            return (
                              <div
                                key={path}
                                onClick={() => onNavigateToNote(path)}
                                className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary cursor-pointer text-[11px]"
                              >
                                <FileText className="w-3 h-3 text-text-faint" />
                                <span className="truncate" dir="auto">{title}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CALENDAR (Daily Notes) */}
        {activeTab === "calendar" && (
          <CalendarPane
            allNotes={allNotes}
            onOpenNote={onSelectFile}
            onCreateDailyNote={(dateStr) => {
              if (onCreateDailyNote) {
                onCreateDailyNote(dateStr);
              } else {
                onCreateNote(undefined);
              }
            }}
          />
        )}

        {/* TAB 5: OUTLINE (Document Headings) */}
        {activeTab === "outline" && (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-text-faint uppercase">
                {t?.outline || "Outline"}
              </span>
              <span className="text-[10px] text-text-faint font-mono">
                {outlineItems.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {outlineItems.length === 0 ? (
                <div className="text-center text-text-faint text-[11px] py-8">
                  {t?.noHeadings || "No headings found in active note."}
                </div>
              ) : (
                outlineItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onJumpToHeading(item.title)}
                    style={{ paddingLeft: `${(item.level - 1) * 12 + 6}px` }}
                    className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors text-xs"
                    title={`Jump to line ${item.line}`}
                  >
                    <span className="text-[10px] font-mono text-accent-purple font-semibold">
                      H{item.level}
                    </span>
                    <span className="truncate flex-1" dir="auto">{item.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: TASKS (Vault Tasks Aggregator) */}
        {activeTab === "tasks" && (
          <TasksPane
            allNotes={allNotes}
            onNavigateToNote={onNavigateToNote}
            activePath={activePath}
            activeContent={activeContent}
            onUpdateNoteContent={onUpdateNoteContent}
          />
        )}

        {/* TAB 7: BOOKMARKS (Pinned Items) */}
        {activeTab === "bookmarks" && (
          <BookmarksPane
            bookmarks={bookmarks}
            onToggleBookmark={onToggleBookmark || (() => {})}
            onNavigateToNote={onNavigateToNote}
            activePath={activePath}
          />
        )}
      </div>
    </div>
  );
};
