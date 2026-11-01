import React from "react";
import {
  Search,
  Share2,
  Calendar,
  Terminal,
  FolderOpen,
  Settings,
  LayoutGrid,
  FileText,
  AlignRight,
  BarChart3,
} from "lucide-react";
import { Translations, TextDirection } from "../i18n";
import { FeatureFlags } from "../types";

interface RibbonProps {
  activeView: "editor" | "graph" | "canvas";
  onToggleView: (view: "editor" | "graph" | "canvas") => void;
  onToggleSidebar?: () => void;
  onOpenQuickSwitcher: () => void;
  onOpenDailyNote: () => void;
  onOpenCanvas?: () => void;
  onOpenVaultDialog: () => void;
  onOpenSettings: () => void;
  onOpenStats?: () => void;
  t?: Translations["ribbon"];
  textDirection?: TextDirection;
  onToggleTextDirection?: () => void;
  features?: FeatureFlags;
  hasUpdateAvailable?: boolean;
}

export const Ribbon: React.FC<RibbonProps> = ({
  activeView,
  onToggleView,
  onToggleSidebar,
  onOpenQuickSwitcher,
  onOpenDailyNote,
  onOpenCanvas,
  onOpenVaultDialog,
  onOpenSettings,
  onOpenStats,
  t,
  textDirection = "auto",
  onToggleTextDirection,
  features,
  hasUpdateAvailable = false,
}) => {
  return (
    <div className="w-[42px] bg-bg-secondary border-r border-border-subtle flex flex-col justify-between py-2 select-none z-20">
      {/* Top Action Icons */}
      <div className="flex flex-col items-center gap-1.5">
        {/* Shard Brand Mark */}
        <div className="w-6 h-6 mb-1.5 flex items-center justify-center" title="Shard">
          <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]">
            <polygon points="12,2 19,8 17,17 12,22 7,17 5,8" fill="#7b6cd9" stroke="#ffffff" strokeWidth="0.8" />
            <polygon points="12,2 12,22 17,17 19,8" fill="#5848c2" opacity="0.8" />
            <line x1="12" y1="2" x2="12" y2="22" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.8" />
          </svg>
        </div>

        <button
          onClick={() => {
            if (activeView === "editor" && onToggleSidebar) {
              onToggleSidebar();
            } else {
              onToggleView("editor");
            }
          }}
          className={`p-2 rounded-md transition-colors ${
            activeView === "editor"
              ? "bg-bg-card text-accent-purple border-l-2 border-accent-purple rounded-l-none"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
          title={t?.editor || "Document Editor"}
        >
          <FileText className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenQuickSwitcher}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
          title={t?.quickSwitcher || "Quick Switcher (Ctrl+O / Ctrl+P)"}
        >
          <Search className="w-4 h-4" />
        </button>

        {features?.graphView !== false && (
          <button
            onClick={() => onToggleView("graph")}
            className={`p-2 rounded-md transition-colors ${
              activeView === "graph"
                ? "bg-bg-card text-accent-purple border-l-2 border-accent-purple rounded-l-none"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title={t?.graph || "Graph View (Ctrl+G)"}
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}

        {features?.canvasView !== false && (
          <button
            onClick={() => {
              if (onOpenCanvas) onOpenCanvas();
              else onToggleView("canvas");
            }}
            className={`p-2 rounded-md transition-colors ${
              activeView === "canvas"
                ? "bg-bg-card text-accent-purple border-l-2 border-accent-purple rounded-l-none"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title={t?.canvas || "Visual Canvas"}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        )}

        {features?.dailyNotes !== false && (
          <button
            onClick={onOpenDailyNote}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
            title={t?.dailyNote || "Today's Daily Note"}
          >
            <Calendar className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenQuickSwitcher}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
          title="Command Palette (Ctrl+P)"
        >
          <Terminal className="w-4 h-4" />
        </button>

        {features?.vaultStats !== false && onOpenStats && (
          <button
            onClick={onOpenStats}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
            title="Vault Analytics & Heatmap"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bottom Pinned Icons */}
      <div className="flex flex-col items-center gap-1.5">
        {onToggleTextDirection && (
          <button
            onClick={onToggleTextDirection}
            className={`p-2 rounded-md transition-colors ${
              textDirection === "rtl"
                ? "bg-bg-card text-accent-purple"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title={`${t?.directionToggle || "Text Direction"}: ${textDirection.toUpperCase()}`}
          >
            <AlignRight className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenVaultDialog}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
          title={t?.openVault || "Open Vault Folder"}
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors relative"
          title={hasUpdateAvailable ? "Settings (Update Available!)" : (t?.settings || "Settings (Ctrl+,)")}
        >
          <Settings className="w-4 h-4" />
          {hasUpdateAvailable && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-purple ring-2 ring-bg-secondary animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );
};
