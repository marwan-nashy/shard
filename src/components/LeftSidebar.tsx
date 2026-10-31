import React, { useState, useMemo } from "react";
import { FileNode, SearchResult, SidebarTab, OutlineItem } from "../types";
import { FileTree } from "./FileTree";
import {
  Folder,
  Search,
  Tag,
  ListTree,
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
          title="Files"
        >
          <Folder className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onTabChange("search")}
          className={`p-1.5 rounded transition-colors ${
            activeTab === "search"
              ? "bg-bg-card text-accent-purple font-medium"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
          title="Search in vault"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onTabChange("tags")}
          className={`p-1.5 rounded transition-colors ${
            activeTab === "tags"
              ? "bg-bg-card text-accent-purple font-medium"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
          title="Tags"
        >
          <Tag className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onTabChange("outline")}
          className={`p-1.5 rounded transition-colors ${
            activeTab === "outline"
              ? "bg-bg-card text-accent-purple font-medium"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
          title="Document Outline"
        >
          <ListTree className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* TAB 1: FILES TREE */}
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
          />
        )}

        {/* TAB 2: VAULT SEARCH */}
        {activeTab === "search" && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-border-subtle space-y-2">
              <div className="flex items-center gap-1.5 bg-bg-card px-2 py-1.5 rounded border border-border-subtle focus-within:border-accent-purple">
                <Search className="w-3.5 h-3.5 text-text-faint" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search vault..."
                  className="w-full bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-faint"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="text-text-faint hover:text-text-primary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <div className="text-[10px] text-text-faint px-1 flex justify-between">
                  <span>
                    {isSearching
                      ? "Searching..."
                      : `${searchResults.length} file${
                          searchResults.length === 1 ? "" : "s"
                        } found`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {!searchQuery ? (
                <div className="text-center text-text-faint text-[11px] py-8">
                  Type to search note contents and titles across the vault.
                </div>
              ) : searchResults.length === 0 && !isSearching ? (
                <div className="text-center text-text-faint text-[11px] py-8">
                  No matching notes found.
                </div>
              ) : (
                searchResults.map((res) => (
                  <div
                    key={res.path}
                    onClick={() => onNavigateToNote(res.path)}
                    className="p-2 rounded bg-bg-card/40 hover:bg-bg-card cursor-pointer border border-transparent hover:border-border-subtle transition-all"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-text-primary">
                      <FileText className="w-3.5 h-3.5 text-accent-purple shrink-0" />
                      <span className="truncate">{res.title}</span>
                    </div>
                    {res.snippet && (
                      <div className="text-[11px] text-text-muted mt-1 line-clamp-2 italic">
                        {res.snippet}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TAGS EXPLORER */}
        {activeTab === "tags" && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-border-subtle">
              <div className="flex items-center gap-1.5 bg-bg-card px-2 py-1.5 rounded border border-border-subtle focus-within:border-accent-purple">
                <Tag className="w-3.5 h-3.5 text-text-faint" />
                <input
                  type="text"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Filter tags..."
                  className="w-full bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-faint"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredTags.length === 0 ? (
                <div className="text-center text-text-faint text-[11px] py-8">
                  No tags found in this vault. Add `#tag` to any note!
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
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-text-faint" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-text-faint" />
                        )}
                        <span className="text-accent-purple font-mono">
                          #{item.tag}
                        </span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded-full bg-bg-card text-text-faint font-mono">
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
                                <span className="truncate">{title}</span>
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

        {/* TAB 4: OUTLINE (Document Headings) */}
        {activeTab === "outline" && (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-text-faint uppercase">
                Outline
              </span>
              <span className="text-[10px] text-text-faint font-mono">
                {outlineItems.length} headings
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {outlineItems.length === 0 ? (
                <div className="text-center text-text-faint text-[11px] py-8">
                  No headings found in active note. Use `# Heading` to structure your note.
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
                    <span className="truncate flex-1">{item.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
