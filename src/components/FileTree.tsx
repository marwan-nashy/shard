import React, { useState } from "react";
import { FileNode } from "../types";
import { Translations } from "../i18n";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  ChevronsLeftRight,
  Trash2,
  Edit2,
  LayoutGrid,
} from "lucide-react";

interface FileTreeProps {
  nodes: FileNode[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
  onCreateNote: (parentFolder?: string) => void;
  onCreateFolder: (parentFolder?: string) => void;
  onCreateCanvas?: (parentFolder?: string) => void;
  onRenameItem: (path: string, currentName: string) => void;
  onDeleteItem: (path: string, name: string) => void;
  t?: Translations["sidebar"];
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  activePath,
  onSelectFile,
  onCreateNote,
  onCreateFolder,
  onCreateCanvas,
  onRenameItem,
  onDeleteItem,
  t,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode;
  } | null>(null);

  const toggleFolder = (path: string) => {
    setCollapsed((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    const walk = (items: FileNode[]) => {
      items.forEach((item) => {
        if (item.is_dir) {
          all[item.path] = true;
          walk(item.children);
        }
      });
    };
    walk(nodes);
    setCollapsed(all);
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const renderNode = (node: FileNode, level = 0) => {
    const isDir = node.is_dir;
    const isExpanded = !collapsed[node.path];
    const isActive = activePath === node.path;
    const isCanvas = node.name.endsWith(".canvas");

    return (
      <div key={node.path} className="select-none">
        <div
          onClick={() => (isDir ? toggleFolder(node.path) : onSelectFile(node.path))}
          onContextMenu={(e) => handleContextMenu(e, node)}
          style={{ paddingLeft: `${level * 14 + 10}px` }}
          className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer text-xs group transition-colors ${
            isActive
              ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
              : "text-text-muted hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          {isDir ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-text-faint group-hover:text-text-muted" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-text-faint group-hover:text-text-muted" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-accent-purple" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-text-muted" />
              )}
              <span className="truncate flex-1" dir="auto">
                {node.name}
              </span>
            </>
          ) : (
            <>
              <div className="w-3.5" />
              {isCanvas ? (
                <LayoutGrid className="w-3.5 h-3.5 text-accent-purple" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-text-faint group-hover:text-accent-purple" />
              )}
              <span className="truncate flex-1" dir="auto">
                {node.name.replace(/\.md$/, "").replace(/\.canvas$/, "")}
              </span>
            </>
          )}

          {isCanvas && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-accent-purple/20 text-accent-purple font-mono">
              canvas
            </span>
          )}
        </div>

        {isDir && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col h-full bg-bg-secondary select-none"
      onClick={() => setContextMenu(null)}
    >
      {/* Pane Toolbar (Obsidian icons: New Note, New Canvas, New Folder, Collapse) */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <span className="text-[11px] font-semibold tracking-wider text-text-faint uppercase">
          {t?.files || "Files"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCreateNote()}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
            title={t?.newNote || "New note"}
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          {onCreateCanvas && (
            <button
              onClick={() => onCreateCanvas()}
              className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
              title={t?.newCanvas || "New canvas"}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onCreateFolder()}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
            title={t?.newFolder || "New folder"}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={collapseAll}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
            title={t?.collapseAll || "Collapse all"}
          >
            <ChevronsLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto px-1 py-1.5 space-y-0.5">
        {nodes.length === 0 ? (
          <div className="p-4 text-center text-xs text-text-faint">
            {t?.noNotes || "No notes in this vault. Click + to create one!"}
          </div>
        ) : (
          nodes.map((node) => renderNode(node))
        )}
      </div>

      {/* Context Menu for Files and Folders */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-bg-card border border-border-subtle rounded-lg shadow-2xl py-1 text-xs w-48 font-sans"
        >
          {contextMenu.node.is_dir && (
            <>
              <button
                onClick={() => {
                  const p = contextMenu.node.path;
                  setContextMenu(null);
                  onCreateNote(p);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-text-primary flex items-center gap-2"
              >
                <FilePlus className="w-3.5 h-3.5 text-accent-purple" />
                <span>{t?.newNote || "New note here"}</span>
              </button>
              {onCreateCanvas && (
                <button
                  onClick={() => {
                    const p = contextMenu.node.path;
                    setContextMenu(null);
                    onCreateCanvas(p);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-text-primary flex items-center gap-2"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-accent-purple" />
                  <span>{t?.newCanvas || "New canvas here"}</span>
                </button>
              )}
              <button
                onClick={() => {
                  const p = contextMenu.node.path;
                  setContextMenu(null);
                  onCreateFolder(p);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-text-primary flex items-center gap-2"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{t?.newFolder || "New folder here"}</span>
              </button>
              <div className="my-1 border-t border-border-subtle" />
            </>
          )}

          {!contextMenu.node.is_dir && (
            <button
              onClick={() => {
                const node = contextMenu.node;
                setContextMenu(null);
                onRenameItem(node.path, node.name);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-text-primary flex items-center gap-2"
            >
              <Edit2 className="w-3.5 h-3.5 text-accent-blue" />
              <span>{t?.rename || "Rename"}</span>
            </button>
          )}

          <button
            onClick={() => {
              const node = contextMenu.node;
              setContextMenu(null);
              onDeleteItem(node.path, node.name);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-accent-red flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t?.delete || "Delete"}</span>
          </button>
        </div>
      )}
    </div>
  );
};
