import React, { useState, useEffect, useRef } from "react";
import { SearchResult, CommandItem, FeatureFlags } from "../types";
import { Translations } from "../i18n";
import {
  Search,
  FileText,
  Terminal,
  FilePlus,
  FolderPlus,
  Share2,
  LayoutGrid,
  Calendar,
  Eye,
  Settings,
  FolderOpen,
  Copy,
  Columns,
  Save,
  Sliders,
  AlignRight,
  Globe,
} from "lucide-react";

interface QuickSwitcherProps {
  isOpen: boolean;
  initialMode?: "notes" | "commands";
  onClose: () => void;
  onSelectResult: (path: string) => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  allNotes: { title: string; path: string }[];
  // Commands execution actions
  onExecuteCommand?: (commandId: string) => void;
  t?: Translations;
  features?: FeatureFlags;
}

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  initialMode = "notes",
  onClose,
  onSelectResult,
  onSearch,
  allNotes,
  onExecuteCommand,
  t,
  features,
}) => {
  const [mode, setMode] = useState<"notes" | "commands">(initialMode);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Available commands list
  const commands: CommandItem[] = [
    {
      id: "new-note",
      title: "New Note",
      description: "Create a new markdown note in vault",
      shortcut: "Ctrl + N",
      category: "File",
      action: () => onExecuteCommand?.("new-note"),
    },
    {
      id: "new-folder",
      title: "New Folder",
      description: "Create a new folder in vault",
      shortcut: "Ctrl + Shift + N",
      category: "File",
      action: () => onExecuteCommand?.("new-folder"),
    },
    {
      id: "new-canvas",
      title: "New Visual Canvas",
      description: "Create a new infinite whiteboard (.canvas)",
      category: "File",
      action: () => onExecuteCommand?.("new-canvas"),
    },
    {
      id: "daily-note",
      title: "Open Today's Daily Note",
      description: "Open or create today's dated journal note",
      category: "Navigation",
      action: () => onExecuteCommand?.("daily-note"),
    },
    {
      id: "open-graph",
      title: "Open 2D Graph View",
      description: "Visualize note connections and tags",
      shortcut: "Ctrl + G",
      category: "View",
      action: () => onExecuteCommand?.("open-graph"),
    },
    {
      id: "open-canvas",
      title: "Open Visual Canvas",
      description: "Switch to infinite card whiteboard",
      category: "View",
      action: () => onExecuteCommand?.("open-canvas"),
    },
    {
      id: "toggle-preview",
      title: "Toggle Live Preview / Source Mode",
      description: "Switch between WYSIWYG and raw markdown",
      shortcut: "Ctrl + E",
      category: "Editor",
      action: () => onExecuteCommand?.("toggle-preview"),
    },
    {
      id: "toggle-split",
      title: "Toggle Split Editor",
      description: "Split editor horizontally side-by-side",
      category: "Editor",
      action: () => onExecuteCommand?.("toggle-split"),
    },
    {
      id: "toggle-zen",
      title: "Toggle Focus / Zen Mode",
      description: "Distraction-free writing mode with hidden chrome",
      shortcut: "F11",
      category: "Editor",
      action: () => onExecuteCommand?.("toggle-zen"),
    },
    {
      id: "toggle-left-sidebar",
      title: "Toggle Left Sidebar",
      description: "Show or hide file tree and search pane",
      shortcut: "Ctrl + \\",
      category: "Layout",
      action: () => onExecuteCommand?.("toggle-left-sidebar"),
    },
    {
      id: "toggle-right-sidebar",
      title: "Toggle Right Sidebar (Backlinks)",
      description: "Show or hide backlinks and mentions pane",
      shortcut: "Ctrl + B",
      category: "Layout",
      action: () => onExecuteCommand?.("toggle-right-sidebar"),
    },
    {
      id: "copy-markdown",
      title: "Copy Note as Markdown",
      description: "Copy full active note text to clipboard",
      category: "Clipboard",
      action: () => onExecuteCommand?.("copy-markdown"),
    },
    {
      id: "switch-vault",
      title: "Switch Vault / Open Vault Picker",
      description: "Open another folder or create a new vault",
      category: "Vault",
      action: () => onExecuteCommand?.("switch-vault"),
    },
    {
      id: "open-templates",
      title: "Insert Template...",
      description: "Insert journal, meeting notes, or custom template",
      category: "Editor",
      action: () => onExecuteCommand?.("open-templates"),
    },
    {
      id: "open-history",
      title: "Note Version History...",
      description: "Browse timeline snapshots and restore previous revisions",
      category: "File",
      action: () => onExecuteCommand?.("open-history"),
    },
    {
      id: "open-stats",
      title: "Vault Analytics & Activity Heatmap",
      description: "View writing consistency, knowledge hubs, and orphan notes",
      category: "View",
      action: () => onExecuteCommand?.("open-stats"),
    },
    {
      id: "export-pdf",
      title: "Print Note / Export to PDF",
      description: "Clean print stylesheet with KaTeX math and callouts",
      shortcut: "Ctrl + P",
      category: "Export",
      action: () => onExecuteCommand?.("export-pdf"),
    },
    {
      id: "export-html",
      title: "Export Note as Standalone HTML",
      description: "Self-contained HTML document with embedded styles",
      category: "Export",
      action: () => onExecuteCommand?.("export-html"),
    },
    {
      id: "open-settings",
      title: "Open Settings",
      description: "Configure appearance, hotkeys, and legal notices",
      shortcut: "Ctrl + ,",
      category: "App",
      action: () => onExecuteCommand?.("open-settings"),
    },
    {
      id: "open-features",
      title: "Customize Features & Modules...",
      description: "Enable or hide features for zero-bloat",
      category: "Settings",
      action: () => onExecuteCommand?.("open-features"),
    },
    {
      id: "check-updates",
      title: "Check for Updates...",
      description: "Check GitHub releases for the latest Shard update",
      category: "App",
      action: () => onExecuteCommand?.("check-updates"),
    },
    {
      id: "save-note",
      title: "Save Note",
      description: "Flush current buffer to local disk",
      shortcut: "Ctrl + S",
      category: "File",
      action: () => onExecuteCommand?.("save-note"),
    },
    {
      id: "cycle-direction",
      title: t?.commands.setDirAuto || "Toggle Text Direction (Auto / RTL / LTR)",
      description: "Cycle editor text direction",
      shortcut: "Ctrl + Shift + X",
      category: "Editor",
      action: () => onExecuteCommand?.("cycle-direction"),
    },
    {
      id: "set-dir-rtl",
      title: t?.commands.setDirRTL || "Text Direction: Right to Left (RTL)",
      description: "Set editor direction to RTL for Arabic writing",
      category: "Editor",
      action: () => onExecuteCommand?.("set-dir-rtl"),
    },
    {
      id: "set-dir-ltr",
      title: t?.commands.setDirLTR || "Text Direction: Left to Right (LTR)",
      description: "Set editor direction to LTR for English writing",
      category: "Editor",
      action: () => onExecuteCommand?.("set-dir-ltr"),
    },
    {
      id: "switch-language",
      title: t?.commands.switchLanguage || "Switch Language (English / العربية)",
      description: "Toggle app UI language between English and Arabic",
      category: "App",
      action: () => onExecuteCommand?.("switch-language"),
    },
  ];

  // Filter commands by active feature flags and search query
  const filteredCommands = commands.filter((c) => {
    if (features) {
      if (features.graphView === false && c.id === "open-graph") return false;
      if (features.canvasView === false && (c.id === "open-canvas" || c.id === "new-canvas")) return false;
      if (features.dailyNotes === false && c.id === "daily-note") return false;
      if (features.vaultStats === false && c.id === "open-stats") return false;
      if (features.templates === false && c.id === "open-templates") return false;
      if (features.versionHistory === false && c.id === "open-history") return false;
      if (features.documentExport === false && (c.id === "export-pdf" || c.id === "export-html")) return false;
    }

    if (!query.trim()) return true;
    const cleanQuery = query.replace(/^>/, "").trim().toLowerCase();
    if (!cleanQuery) return true;
    return (
      c.title.toLowerCase().includes(cleanQuery) ||
      (c.description && c.description.toLowerCase().includes(cleanQuery)) ||
      (c.category && c.category.toLowerCase().includes(cleanQuery))
    );
  });

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setQuery("");
      setSelectedIndex(0);
      // Prepopulate notes with initial vault items
      setResults(
        allNotes.slice(0, 25).map((n) => ({
          title: n.title,
          path: n.path,
          snippet: "Note in vault",
        }))
      );
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialMode, allNotes]);

  // Handle Query Changes & Auto-Switch to Commands if '>' is typed
  useEffect(() => {
    if (!isOpen) return;

    if (query.startsWith(">")) {
      if (mode !== "commands") setMode("commands");
      setSelectedIndex(0);
      return;
    }

    if (mode === "commands") {
      setSelectedIndex(0);
      return;
    }

    if (!query.trim()) {
      setResults(
        allNotes.slice(0, 25).map((n) => ({
          title: n.title,
          path: n.path,
          snippet: "Note in vault",
        }))
      );
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      const q = query.toLowerCase();
      // Fast local title filter first for instant 0ms latency
      const titleMatches: SearchResult[] = allNotes
        .filter((n) => n.title.toLowerCase().includes(q))
        .map((n) => ({
          title: n.title,
          path: n.path,
          snippet: "Title match",
        }));

      // In parallel query Rust backend for deep content search
      const serverResults = await onSearch(query);

      // Merge unique
      const seen = new Set(titleMatches.map((m) => m.path));
      const combined = [...titleMatches];
      for (const res of serverResults) {
        if (!seen.has(res.path)) {
          seen.add(res.path);
          combined.push(res);
        }
      }

      setResults(combined);
      setSelectedIndex(0);
    }, 40);

    return () => clearTimeout(timer);
  }, [query, isOpen, mode, allNotes]);

  const maxItems = mode === "notes" ? results.length : filteredCommands.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(maxItems, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + maxItems) % Math.max(maxItems, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "notes") {
        if (results[selectedIndex]) {
          onSelectResult(results[selectedIndex].path);
          onClose();
        }
      } else {
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      }
    }
  };

  const getCommandIcon = (id: string) => {
    switch (id) {
      case "new-note":
        return <FilePlus className="w-4 h-4 text-accent-purple" />;
      case "new-folder":
        return <FolderPlus className="w-4 h-4 text-accent-purple" />;
      case "new-canvas":
      case "open-canvas":
        return <LayoutGrid className="w-4 h-4 text-accent-purple" />;
      case "daily-note":
        return <Calendar className="w-4 h-4 text-accent-purple" />;
      case "open-graph":
        return <Share2 className="w-4 h-4 text-accent-purple" />;
      case "toggle-preview":
        return <Eye className="w-4 h-4 text-accent-purple" />;
      case "toggle-split":
        return <Columns className="w-4 h-4 text-accent-purple" />;
      case "copy-markdown":
        return <Copy className="w-4 h-4 text-accent-purple" />;
      case "switch-vault":
        return <FolderOpen className="w-4 h-4 text-accent-purple" />;
      case "open-settings":
        return <Settings className="w-4 h-4 text-accent-purple" />;
      case "save-note":
        return <Save className="w-4 h-4 text-accent-purple" />;
      case "cycle-direction":
      case "set-dir-rtl":
      case "set-dir-ltr":
        return <AlignRight className="w-4 h-4 text-accent-purple" />;
      case "switch-language":
        return <Globe className="w-4 h-4 text-accent-purple" />;
      default:
        return <Sliders className="w-4 h-4 text-accent-purple" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-bg-card border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 border-b border-border-subtle bg-bg-secondary/40">
          <button
            onClick={() => {
              setMode("notes");
              if (query.startsWith(">")) setQuery("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              mode === "notes"
                ? "bg-accent-purple text-white shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes (Ctrl + O)</span>
          </button>

          <button
            onClick={() => {
              setMode("commands");
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              mode === "commands"
                ? "bg-accent-purple text-white shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Commands (Ctrl + P)</span>
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          {mode === "notes" ? (
            <Search className="w-5 h-5 text-accent-purple shrink-0" />
          ) : (
            <Terminal className="w-5 h-5 text-accent-purple shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            dir="auto"
            placeholder={
              mode === "notes"
                ? (t?.quickSwitcher.notesPlaceholder || "Type note name or full-text query (type '>' for commands)...")
                : (t?.quickSwitcher.commandsPlaceholder || "Type command name...")
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-faint"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-text-faint font-mono">
            ESC to close
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-84 overflow-y-auto p-1.5 space-y-0.5">
          {mode === "notes" ? (
            results.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-faint">
                {t?.quickSwitcher.noNotesFound || "No matching notes found."}
              </div>
            ) : (
              results.map((res, idx) => (
                <div
                  key={res.path}
                  onClick={() => {
                    onSelectResult(res.path);
                    onClose();
                  }}
                  className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    idx === selectedIndex
                      ? "bg-accent-purple/20 text-white"
                      : "text-text-muted hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  <FileText className="w-4 h-4 text-accent-purple mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate" dir="auto">
                      {res.title}
                    </div>
                    {res.snippet && (
                      <div className="text-[11px] text-text-faint truncate mt-0.5" dir="auto">
                        {res.snippet}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )
          ) : filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-faint">
              {t?.quickSwitcher.noCommandsFound || "No matching commands found."}
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  idx === selectedIndex
                    ? "bg-accent-purple/20 text-white"
                    : "text-text-muted hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <div className="shrink-0">{getCommandIcon(cmd.id)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-text-primary">
                    {cmd.title}
                  </div>
                  {cmd.description && (
                    <div className="text-[11px] text-text-faint truncate">
                      {cmd.description}
                    </div>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="text-[10px] px-2 py-0.5 rounded bg-bg-card border border-border-subtle font-mono text-text-faint">
                    {cmd.shortcut}
                  </kbd>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
