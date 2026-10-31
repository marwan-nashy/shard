import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FileNode,
  SearchResult,
  GraphData,
  BacklinksData,
  TabItem,
  ViewMode,
  SidebarTab,
  RightSidebarTab,
  OutlineItem,
} from "./types";
import { Ribbon } from "./components/Ribbon";
import { LeftSidebar } from "./components/LeftSidebar";
import { Editor } from "./components/Editor";
import { GraphView } from "./components/GraphView";
import { VisualCanvas } from "./components/VisualCanvas";
import { TabBar } from "./components/TabBar";
import { StatusBar } from "./components/StatusBar";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { BacklinksPane } from "./components/BacklinksPane";
import { SettingsModal } from "./components/SettingsModal";
import { VaultSelectorModal } from "./components/VaultSelectorModal";
import { Link2, ListTree } from "lucide-react";

export default function App() {
  // Vault state
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [fileNodes, setFileNodes] = useState<FileNode[]>([]);
  const [recentVaults, setRecentVaults] = useState<string[]>([]);
  const [defaultVaultPath, setDefaultVaultPath] = useState<string>("");
  const [vaultSelectorOpen, setVaultSelectorOpen] = useState(false);

  // Navigation & tabs
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<string>("");
  const [targetHeading, setTargetHeading] = useState<string | null>(null);

  // Views & panes
  const [activeView, setActiveView] = useState<"editor" | "graph" | "canvas">("editor");
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>("backlinks");
  const [isSplit, setIsSplit] = useState(false);

  // Modals & Overlays
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [quickSwitcherMode, setQuickSwitcherMode] = useState<"notes" | "commands">("notes");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready");

  // Rename Dialog state
  const [renameDialog, setRenameDialog] = useState<{
    isOpen: boolean;
    path: string;
    oldName: string;
    newName: string;
  }>({ isOpen: false, path: "", oldName: "", newName: "" });

  // Graph data & Backlinks
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [backlinks, setBacklinks] = useState<BacklinksData>({
    linked_mentions: [],
    unlinked_mentions: [],
  });

  // Collect all flat notes for instant wikilink suggestions and quick switching
  const allNotes = useMemo(() => {
    const list: { title: string; path: string }[] = [];
    const walk = (nodes: FileNode[]) => {
      nodes.forEach((n) => {
        if (!n.is_dir) {
          const title = n.name.replace(/\.md$/, "").replace(/\.canvas$/, "");
          list.push({ title, path: n.path });
        } else {
          walk(n.children);
        }
      });
    };
    walk(fileNodes);
    return list;
  }, [fileNodes]);

  const allNoteTitles = useMemo(() => allNotes.map((n) => n.title), [allNotes]);

  // Extract all tags across vault with occurrences and paths
  const allTags = useMemo(() => {
    const map = new Map<string, { count: number; paths: Set<string> }>();
    graphData.nodes.forEach((node) => {
      node.tags.forEach((tag) => {
        const cleanTag = tag.replace(/^#/, "");
        const entry = map.get(cleanTag) || { count: 0, paths: new Set<string>() };
        entry.count += 1;
        entry.paths.add(node.path);
        map.set(cleanTag, entry);
      });
    });
    return Array.from(map.entries())
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        paths: Array.from(data.paths),
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [graphData]);

  // Parse Outline from active note content
  const outlineHeadings = useMemo<OutlineItem[]>(() => {
    if (!activeContent.trim()) return [];
    const items: OutlineItem[] = [];
    activeContent.split("\n").forEach((line, idx) => {
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

  // Refresh recent vaults list from Rust backend
  const refreshRecentVaults = async () => {
    try {
      const recents = await invoke<string[]>("get_recent_vaults");
      setRecentVaults(recents);
    } catch (e) {
      console.error(e);
    }
  };

  // Open note or canvas file
  const openNote = async (filePath: string, heading?: string) => {
    try {
      const content = await invoke<string>("read_file_content", { filePath });
      const isCanvas = filePath.endsWith(".canvas");
      const title = filePath.split(/[\\/]/).pop()?.replace(/\.(md|canvas)$/, "") || "Untitled";

      setActivePath(filePath);
      setActiveContent(content);
      setTargetHeading(heading || null);

      if (isCanvas) {
        setActiveView("canvas");
      } else {
        setActiveView("editor");
      }

      // Add to tabs if not already present
      setTabs((prev) => {
        if (prev.some((t) => t.path === filePath)) return prev;
        return [...prev, { path: filePath, title, isDirty: false }];
      });

      // Load backlinks if it's a markdown note
      if (vaultPath && !isCanvas) {
        const bl = await invoke<BacklinksData>("get_note_backlinks", {
          vaultPath,
          noteTitle: title,
        });
        setBacklinks(bl);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(`Failed to read file: ${err}`);
    }
  };

  // Load vault files
  const loadVault = useCallback(async (path: string) => {
    if (!path || path === "." || path.startsWith("./")) {
      setVaultSelectorOpen(true);
      return;
    }

    try {
      const nodes = await invoke<FileNode[]>("scan_vault", { vaultPath: path });
      setVaultPath(path);
      setFileNodes(nodes);
      setStatusMessage(`Opened vault: ${path.split(/[\\/]/).pop()}`);
      setVaultSelectorOpen(false);

      // Persist in Rust backend config (%APPDATA%/Shard/config.json)
      await invoke("set_last_vault", { vaultPath: path });
      refreshRecentVaults();

      // Refresh graph
      const gData = await invoke<GraphData>("get_vault_graph", { vaultPath: path });
      setGraphData(gData);

      // Open first note if no tabs open
      const firstNote = (function findFirst(nList: FileNode[]): FileNode | null {
        for (const item of nList) {
          if (!item.is_dir && (item.name.endsWith(".md") || item.name.endsWith(".canvas")))
            return item;
          if (item.is_dir) {
            const f = findFirst(item.children);
            if (f) return f;
          }
        }
        return null;
      })(nodes);

      if (firstNote) {
        openNote(firstNote.path);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(`Error loading vault: ${err}`);
      setVaultSelectorOpen(true);
    }
  }, []);

  // Open Vault Picker Dialog
  const handleOpenVaultDialog = async () => {
    try {
      const selected = await invoke<string | null>("open_vault_dialog");
      if (selected) {
        loadVault(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Start: Create & Open Default Documents Vault
  const handleCreateDefaultVault = async () => {
    try {
      const def = defaultVaultPath || (await invoke<string>("get_default_vault_path"));
      const created = await invoke<string>("create_vault", { vaultPath: def });
      await loadVault(created);
    } catch (err) {
      alert(`Failed to create vault: ${err}`);
    }
  };

  // Save active note
  const saveActiveNote = async () => {
    if (!activePath) return;
    try {
      await invoke("write_file_content", {
        filePath: activePath,
        content: activeContent,
      });

      setTabs((prev) =>
        prev.map((t) => (t.path === activePath ? { ...t, isDirty: false } : t))
      );
      setStatusMessage("Saved successfully.");

      // Refresh graph and backlinks
      if (vaultPath && !activePath.endsWith(".canvas")) {
        const gData = await invoke<GraphData>("get_vault_graph", { vaultPath });
        setGraphData(gData);
        const title = activePath.split(/[\\/]/).pop()?.replace(/\.md$/, "") || "";
        const bl = await invoke<BacklinksData>("get_note_backlinks", {
          vaultPath,
          noteTitle: title,
        });
        setBacklinks(bl);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(`Save failed: ${err}`);
    }
  };

  // Save canvas
  const handleSaveCanvas = async (json: string) => {
    if (!activePath || !activePath.endsWith(".canvas")) return;
    try {
      await invoke("write_file_content", {
        filePath: activePath,
        content: json,
      });
      setActiveContent(json);
      setTabs((prev) =>
        prev.map((t) => (t.path === activePath ? { ...t, isDirty: false } : t))
      );
      setStatusMessage("Canvas saved.");
    } catch (err) {
      console.error(err);
      setStatusMessage(`Failed to save canvas: ${err}`);
    }
  };

  // Open or switch to Canvas
  const handleOpenCanvasView = async () => {
    if (activePath && activePath.endsWith(".canvas")) {
      setActiveView("canvas");
      return;
    }

    const openCanvasTab = tabs.find((t) => t.path.endsWith(".canvas"));
    if (openCanvasTab) {
      openNote(openCanvasTab.path);
      return;
    }

    const findCanvasInNodes = (nList: FileNode[]): string | null => {
      for (const item of nList) {
        if (!item.is_dir && item.name.endsWith(".canvas")) return item.path;
        if (item.is_dir) {
          const found = findCanvasInNodes(item.children);
          if (found) return found;
        }
      }
      return null;
    };

    const existingCanvasPath = findCanvasInNodes(fileNodes);
    if (existingCanvasPath) {
      openNote(existingCanvasPath);
      return;
    }

    if (vaultPath) {
      try {
        const newPath = await invoke<string>("create_note", {
          vaultPath,
          parentFolder: null,
          name: "Canvas.canvas",
        });
        const initialJson = JSON.stringify(
          {
            nodes: [
              {
                id: "node-1",
                type: "text",
                text: "# Ideas & Thoughts\nDouble-click anywhere to add new cards.\nDrag handles on borders to connect concepts.",
                x: 100,
                y: 100,
                width: 280,
                height: 160,
                color: "purple",
              },
              {
                id: "node-2",
                type: "text",
                text: "### Connected Concept\n- Drag to move cards\n- Drag bottom-right corner to resize\n- Change card colors",
                x: 480,
                y: 120,
                width: 260,
                height: 150,
                color: "blue",
              },
            ],
            edges: [
              {
                id: "edge-1",
                fromNode: "node-1",
                toNode: "node-2",
              },
            ],
          },
          null,
          2
        );
        await invoke("write_file_content", {
          filePath: newPath,
          content: initialJson,
        });
        await loadVault(vaultPath);
        openNote(newPath);
      } catch (e) {
        console.error(e);
        setActiveView("canvas");
      }
    } else {
      setActiveView("canvas");
    }
  };

  // Auto-save debounced for editor
  useEffect(() => {
    if (!activePath || activePath.endsWith(".canvas")) return;
    const timer = setTimeout(() => {
      saveActiveNote();
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeContent]);

  // Create new note
  const handleCreateNote = async (parentFolder?: string) => {
    if (!vaultPath) {
      setVaultSelectorOpen(true);
      return;
    }
    const name = prompt("Enter note name:", "Untitled");
    if (!name?.trim()) return;

    try {
      const newPath = await invoke<string>("create_note", {
        vaultPath,
        parentFolder: parentFolder || null,
        name: name.trim(),
      });
      await loadVault(vaultPath);
      openNote(newPath);
      setStatusMessage(`Created note: ${name}`);
    } catch (err) {
      alert(`Error creating note: ${err}`);
    }
  };

  // Create new visual canvas (.canvas)
  const handleCreateCanvas = async (parentFolder?: string) => {
    if (!vaultPath) {
      setVaultSelectorOpen(true);
      return;
    }
    const name = prompt("Enter canvas name:", "Mindmap");
    if (!name?.trim()) return;

    const canvasFilename = name.trim().endsWith(".canvas")
      ? name.trim()
      : `${name.trim()}.canvas`;

    try {
      const newPath = await invoke<string>("create_note", {
        vaultPath,
        parentFolder: parentFolder || null,
        name: canvasFilename,
      });

      const initialCanvas = JSON.stringify(
        {
          nodes: [
            {
              id: "node-1",
              type: "text",
              text: `# ${name.trim()}\nDouble-click or drag to begin mapping concepts.`,
              x: 100,
              y: 100,
              width: 300,
              height: 180,
            },
          ],
          edges: [],
        },
        null,
        2
      );

      await invoke("write_file_content", {
        filePath: newPath,
        content: initialCanvas,
      });

      await loadVault(vaultPath);
      openNote(newPath);
      setStatusMessage(`Created canvas: ${name}`);
    } catch (err) {
      alert(`Error creating canvas: ${err}`);
    }
  };

  // Create new folder
  const handleCreateFolder = async (parentFolder?: string) => {
    if (!vaultPath) {
      setVaultSelectorOpen(true);
      return;
    }
    const name = prompt("Enter folder name:", "New Folder");
    if (!name?.trim()) return;

    try {
      await invoke<string>("create_folder", {
        vaultPath,
        parentFolder: parentFolder || null,
        name: name.trim(),
      });
      await loadVault(vaultPath);
      setStatusMessage(`Created folder: ${name}`);
    } catch (err) {
      alert(`Error creating folder: ${err}`);
    }
  };

  // Delete item
  const handleDeleteItem = async (path: string, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;
    try {
      await invoke("delete_item", { path });
      setTabs((prev) => prev.filter((t) => t.path !== path));
      if (activePath === path) {
        setActivePath(null);
        setActiveContent("");
      }
      if (vaultPath) await loadVault(vaultPath);
      setStatusMessage(`Deleted: ${name}`);
    } catch (err) {
      alert(`Failed to delete: ${err}`);
    }
  };

  // Rename with automatic link refactoring
  const handleRenameConfirm = async () => {
    if (!vaultPath || !renameDialog.newName.trim()) return;
    try {
      const res = await invoke<{ new_path: string; refactored_files_count: number }>(
        "rename_note_with_refactor",
        {
          vaultPath,
          oldPath: renameDialog.path,
          newTitle: renameDialog.newName.trim(),
        }
      );

      setRenameDialog({ isOpen: false, path: "", oldName: "", newName: "" });
      await loadVault(vaultPath);
      openNote(res.new_path);
      setStatusMessage(
        `Renamed note and refactored ${res.refactored_files_count} references across the vault.`
      );
    } catch (err) {
      alert(`Rename failed: ${err}`);
    }
  };

  // Daily note
  const handleDailyNote = async () => {
    if (!vaultPath) {
      setVaultSelectorOpen(true);
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const dailyTitle = `${today}.md`;
    const existing = allNotes.find((n) => n.title === today);

    if (existing) {
      openNote(existing.path);
    } else {
      try {
        const newPath = await invoke<string>("create_note", {
          vaultPath,
          parentFolder: null,
          name: dailyTitle,
        });
        const initialContent = `# Daily Note: ${today}\n\n## Tasks\n- [ ] Plan today's priorities\n\n## Notes\n\n`;
        await invoke("write_file_content", {
          filePath: newPath,
          content: initialContent,
        });
        await loadVault(vaultPath);
        openNote(newPath);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Copy note content
  const copyActiveNoteContent = () => {
    if (!activeContent) return;
    navigator.clipboard.writeText(activeContent);
    setStatusMessage("Copied note content to clipboard.");
  };

  // Search vault
  const handleSearchVault = async (query: string): Promise<SearchResult[]> => {
    if (!vaultPath) return [];
    try {
      return await invoke<SearchResult[]>("search_vault", { vaultPath, query });
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  // Command execution dispatcher
  const handleExecuteCommand = (cmdId: string) => {
    switch (cmdId) {
      case "new-note":
        handleCreateNote();
        break;
      case "new-folder":
        handleCreateFolder();
        break;
      case "new-canvas":
        handleCreateCanvas();
        break;
      case "daily-note":
        handleDailyNote();
        break;
      case "open-graph":
        setActiveView("graph");
        break;
      case "open-canvas":
        handleOpenCanvasView();
        break;
      case "toggle-preview":
        setViewMode((m) => (m === "live" ? "source" : "live"));
        break;
      case "toggle-split":
        setIsSplit((s) => !s);
        break;
      case "toggle-left-sidebar":
        setLeftSidebarOpen((o) => !o);
        break;
      case "toggle-right-sidebar":
        setRightSidebarOpen((o) => !o);
        break;
      case "copy-markdown":
        copyActiveNoteContent();
        break;
      case "switch-vault":
        setVaultSelectorOpen(true);
        break;
      case "open-settings":
        setSettingsOpen(true);
        break;
      case "save-note":
        saveActiveNote();
        break;
      default:
        break;
    }
  };

  // Keyboard shortcuts (Ctrl+O, Ctrl+P, Ctrl+S, Ctrl+G, Ctrl+E, Ctrl+N, Ctrl+\, Ctrl+B, Ctrl+,)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        setQuickSwitcherMode("notes");
        setQuickSwitcherOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setQuickSwitcherMode("commands");
        setQuickSwitcherOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActiveNote();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        setActiveView((v) => (v === "graph" ? "editor" : "graph"));
      } else if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setViewMode((m) => (m === "live" ? "source" : "live"));
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        handleCreateFolder();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "n") {
        e.preventDefault();
        handleCreateNote();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setLeftSidebarOpen((o) => !o);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setRightSidebarOpen((o) => !o);
      } else if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePath, activeContent, vaultPath]);

  // Initial startup: check last vault from Rust config (%APPDATA%/Shard/config.json)
  useEffect(() => {
    (async () => {
      try {
        const defPath = await invoke<string>("get_default_vault_path");
        setDefaultVaultPath(defPath);

        const recents = await invoke<string[]>("get_recent_vaults");
        setRecentVaults(recents);

        const last = await invoke<string | null>("get_last_vault");
        // Strict validation: Must be an absolute path that exists and is NOT '.'
        if (last && last !== "." && !last.startsWith("./") && !last.startsWith(".\\")) {
          await loadVault(last);
        } else if (recents.length > 0) {
          await loadVault(recents[0]);
        } else {
          // Clean initial start: Show the Vault Selector Welcome modal
          setVaultSelectorOpen(true);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setVaultSelectorOpen(true);
      }
    })();
  }, [loadVault]);

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-primary text-text-primary overflow-hidden font-sans select-none">
      {/* Main Workspace Row */}
      <div className="flex flex-1 overflow-hidden">
        {/* 1. Left Activity Ribbon (42px) */}
        <Ribbon
          activeView={activeView}
          onToggleView={setActiveView}
          onToggleSidebar={() => setLeftSidebarOpen((prev) => !prev)}
          onOpenQuickSwitcher={() => {
            setQuickSwitcherMode("notes");
            setQuickSwitcherOpen(true);
          }}
          onOpenDailyNote={handleDailyNote}
          onOpenCanvas={handleOpenCanvasView}
          onOpenVaultDialog={() => setVaultSelectorOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* 2. Left Multi-Tab Sidebar (Files, Search, Tags, Outline) */}
        {leftSidebarOpen && (
          <div className="w-64 bg-bg-secondary border-r border-border-subtle flex flex-col shrink-0">
            <LeftSidebar
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
              nodes={fileNodes}
              activePath={activePath}
              onSelectFile={openNote}
              onCreateNote={handleCreateNote}
              onCreateFolder={handleCreateFolder}
              onCreateCanvas={handleCreateCanvas}
              onRenameItem={(path, name) =>
                setRenameDialog({
                  isOpen: true,
                  path,
                  oldName: name,
                  newName: name.replace(/\.(md|canvas)$/, ""),
                })
              }
              onDeleteItem={handleDeleteItem}
              onSearchVault={handleSearchVault}
              allNotes={allNotes}
              allTags={allTags}
              onNavigateToNote={openNote}
              activeContent={activeContent}
              onJumpToHeading={(heading) => setTargetHeading(heading)}
            />
          </div>
        )}

        {/* 3. Central Document Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-bg-primary overflow-hidden">
          {/* Document Tab Bar */}
          <TabBar
            tabs={tabs}
            activePath={activePath}
            onSelectTab={openNote}
            onCloseTab={(path) => {
              const remaining = tabs.filter((t) => t.path !== path);
              setTabs(remaining);
              if (activePath === path) {
                if (remaining.length > 0) openNote(remaining[0].path);
                else {
                  setActivePath(null);
                  setActiveContent("");
                }
              }
            }}
            onNewTab={() => handleCreateNote()}
            viewMode={viewMode}
            onToggleViewMode={() =>
              setViewMode((m) => (m === "live" ? "source" : "live"))
            }
            onToggleSplit={() => setIsSplit(!isSplit)}
            onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
            rightSidebarOpen={rightSidebarOpen}
          />

          {/* Active View Container */}
          <div className="flex-1 overflow-hidden relative flex">
            {activeView === "editor" ? (
              activePath ? (
                <div
                  className={`flex-1 flex ${
                    isSplit ? "divide-x divide-border-subtle" : ""
                  }`}
                >
                  <div className="flex-1 h-full overflow-hidden">
                    <Editor
                      content={activeContent}
                      onChange={(newVal) => {
                        setActiveContent(newVal);
                        setTabs((prev) =>
                          prev.map((t) =>
                            t.path === activePath ? { ...t, isDirty: true } : t
                          )
                        );
                      }}
                      onSave={saveActiveNote}
                      viewMode={viewMode}
                      allNoteTitles={allNoteTitles}
                      onNavigateToNote={(title, heading) => {
                        const target = allNotes.find((n) => n.title === title);
                        if (target) openNote(target.path, heading);
                      }}
                      targetHeading={targetHeading}
                    />
                  </div>

                  {isSplit && (
                    <div className="flex-1 h-full overflow-hidden bg-bg-secondary/20">
                      <Editor
                        content={activeContent}
                        onChange={() => {}}
                        onSave={() => {}}
                        viewMode="live"
                        allNoteTitles={allNoteTitles}
                        onNavigateToNote={() => {}}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-text-faint space-y-3">
                  <div className="text-base font-medium text-text-muted">
                    No note open
                  </div>
                  <div className="text-xs">
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-bg-card font-mono text-accent-purple">
                      Ctrl + O
                    </kbd>{" "}
                    to search or create a note
                  </div>
                </div>
              )
            ) : activeView === "graph" ? (
              <GraphView
                data={graphData}
                onSelectNode={(title) => {
                  const target = allNotes.find((n) => n.title === title);
                  if (target) openNote(target.path);
                }}
                onRefresh={async () => {
                  if (vaultPath) {
                    const gData = await invoke<GraphData>("get_vault_graph", {
                      vaultPath,
                    });
                    setGraphData(gData);
                  }
                }}
              />
            ) : (
              <VisualCanvas
                canvasPath={activePath}
                initialContent={activeContent}
                onSave={handleSaveCanvas}
                allNotes={allNotes}
                onOpenNote={(path) => openNote(path)}
              />
            )}
          </div>
        </div>

        {/* 4. Right Sidebar (Backlinks & Outline) */}
        {rightSidebarOpen && (
          <div className="w-72 bg-bg-secondary border-l border-border-subtle flex flex-col shrink-0">
            {/* Right Sidebar Header Tabs */}
            <div className="flex items-center border-b border-border-subtle bg-bg-secondary/80 px-2 py-1 gap-1">
              <button
                onClick={() => setRightSidebarTab("backlinks")}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
                  rightSidebarTab === "backlinks"
                    ? "bg-bg-card text-accent-purple font-medium"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Backlinks</span>
              </button>
              <button
                onClick={() => setRightSidebarTab("outline")}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
                  rightSidebarTab === "outline"
                    ? "bg-bg-card text-accent-purple font-medium"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>Outline</span>
              </button>
            </div>

            {/* Right Sidebar Content */}
            <div className="flex-1 overflow-hidden">
              {rightSidebarTab === "backlinks" ? (
                <BacklinksPane
                  currentTitle={
                    activePath
                      ?.split(/[\\/]/)
                      .pop()
                      ?.replace(/\.(md|canvas)$/, "") || "Untitled"
                  }
                  data={backlinks}
                  onNavigate={(title) => {
                    const target = allNotes.find((n) => n.title === title);
                    if (target) openNote(target.path);
                  }}
                />
              ) : (
                <div className="flex flex-col h-full p-2 space-y-1 overflow-y-auto">
                  {outlineHeadings.length === 0 ? (
                    <div className="text-center text-text-faint text-[11px] py-8">
                      No headings in current note.
                    </div>
                  ) : (
                    outlineHeadings.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setTargetHeading(item.title)}
                        style={{ paddingLeft: `${(item.level - 1) * 12 + 6}px` }}
                        className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors text-xs"
                      >
                        <span className="text-[10px] font-mono text-accent-purple font-semibold">
                          H{item.level}
                        </span>
                        <span className="truncate flex-1">{item.title}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        status={statusMessage}
        activePath={activePath}
        content={activeContent}
      />

      {/* Quick Switcher & Command Palette Modal (Ctrl+O / Ctrl+P) */}
      <QuickSwitcher
        isOpen={quickSwitcherOpen}
        initialMode={quickSwitcherMode}
        onClose={() => setQuickSwitcherOpen(false)}
        onSelectResult={openNote}
        onSearch={handleSearchVault}
        allNotes={allNotes}
        onExecuteCommand={handleExecuteCommand}
      />

      {/* Settings Modal (Ctrl+,) */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Vault Selector / Welcome Modal */}
      <VaultSelectorModal
        isOpen={vaultSelectorOpen}
        canClose={vaultPath !== null}
        onClose={() => setVaultSelectorOpen(false)}
        onOpenExisting={handleOpenVaultDialog}
        onCreateDefault={handleCreateDefaultVault}
        onSelectRecent={loadVault}
        recentVaults={recentVaults}
        defaultPath={defaultVaultPath}
      />

      {/* Rename Dialog with Auto-Refactoring */}
      {renameDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-card border border-border-subtle rounded-xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Rename Note & Refactor Links
            </h3>
            <p className="text-xs text-text-muted">
              All references to{" "}
              <span className="text-accent-purple font-mono">
                [[{renameDialog.oldName.replace(/\.(md|canvas)$/, "")}]]
              </span>{" "}
              across the vault will be automatically and safely updated.
            </p>
            <input
              type="text"
              value={renameDialog.newName}
              onChange={(e) =>
                setRenameDialog((prev) => ({ ...prev, newName: e.target.value }))
              }
              className="w-full bg-bg-secondary border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-purple"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameConfirm();
                if (e.key === "Escape")
                  setRenameDialog({
                    isOpen: false,
                    path: "",
                    oldName: "",
                    newName: "",
                  });
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  setRenameDialog({
                    isOpen: false,
                    path: "",
                    oldName: "",
                    newName: "",
                  })
                }
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameConfirm}
                className="px-4 py-1.5 text-xs text-white bg-accent-purple hover:bg-accent-purpleHover rounded font-medium transition-colors"
              >
                Rename & Refactor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
