import React from "react";
import { TabItem, ViewMode } from "../types";
import { X, Plus, Eye, Edit3, Columns, LayoutGrid, FileText, PanelRight } from "lucide-react";

interface TabBarProps {
  tabs: TabItem[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onNewTab: () => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  onToggleSplit: () => void;
  onToggleRightSidebar: () => void;
  rightSidebarOpen: boolean;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activePath,
  onSelectTab,
  onCloseTab,
  onNewTab,
  viewMode,
  onToggleViewMode,
  onToggleSplit,
  onToggleRightSidebar,
  rightSidebarOpen,
}) => {
  return (
    <div className="h-9 bg-bg-secondary border-b border-border-subtle flex items-center justify-between px-2 select-none">
      {/* Tabs list */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 h-full pt-1">
        {tabs.map((tab) => {
          const isActive = tab.path === activePath;
          const isCanvas = tab.path.endsWith(".canvas");
          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab.path)}
              className={`flex items-center gap-1.5 px-3 h-8 text-xs rounded-t-md cursor-pointer border-t border-x transition-colors group ${
                isActive
                  ? "bg-bg-primary text-text-primary border-border-subtle border-b-bg-primary font-medium"
                  : "bg-bg-secondary/60 text-text-muted border-transparent hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              {isCanvas ? (
                <LayoutGrid className="w-3.5 h-3.5 text-accent-purple shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-text-faint group-hover:text-text-muted shrink-0" />
              )}
              <span className="truncate max-w-[120px]">{tab.title}</span>
              {tab.isDirty && (
                <div className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.path);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded text-text-faint hover:text-text-primary transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        <button
          onClick={onNewTab}
          className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover ml-1"
          title="New note"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Action Icons (Live preview toggle, Split, Right sidebar) */}
      <div className="flex items-center gap-1 pl-2">
        <button
          onClick={onToggleViewMode}
          className={`p-1.5 rounded transition-colors ${
            viewMode === "live"
              ? "text-accent-purple bg-accent-purple/15"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
          title={
            viewMode === "live"
              ? "Switch to Source Mode"
              : "Switch to Live Preview"
          }
        >
          {viewMode === "live" ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <Edit3 className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onClick={onToggleSplit}
          className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
          title="Toggle Split View"
        >
          <Columns className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleRightSidebar}
          className={`p-1.5 rounded transition-colors ${
            rightSidebarOpen
              ? "text-accent-purple bg-accent-purple/15"
              : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
          }`}
          title="Toggle Right Sidebar (Backlinks)"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
