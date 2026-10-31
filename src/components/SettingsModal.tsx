import React, { useState } from "react";
import { X, Sliders, Palette, Zap, Keyboard, Info } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    "general" | "appearance" | "plugins" | "hotkeys" | "about"
  >("hotkeys");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-[520px] bg-bg-card border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-secondary/40">
          <span className="text-sm font-semibold text-text-primary">Settings</span>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Navigation */}
          <div className="w-44 bg-bg-secondary/70 border-r border-border-subtle p-2 space-y-1">
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "general"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Sliders className="w-4 h-4" /> General
            </button>
            <button
              onClick={() => setActiveTab("appearance")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "appearance"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Palette className="w-4 h-4" /> Appearance
            </button>
            <button
              onClick={() => setActiveTab("plugins")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "plugins"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Zap className="w-4 h-4" /> Core plugins
            </button>
            <button
              onClick={() => setActiveTab("hotkeys")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "hotkeys"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Keyboard className="w-4 h-4" /> Hotkeys
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "about"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Info className="w-4 h-4" /> About
            </button>
          </div>

          {/* Right Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === "hotkeys" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Keyboard Shortcuts
                  </h3>
                  <p className="text-text-faint text-[11px] mt-0.5">
                    Modifiers strictly appear before letters.
                  </p>
                </div>

                <div className="space-y-2 divide-y divide-border-subtle/50">
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-text-primary">Quick Switcher / Search</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono text-[11px]">
                      Ctrl + O
                    </span>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-text-primary">Command Palette</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono text-[11px]">
                      Ctrl + P
                    </span>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-text-primary">Save Active Note</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono text-[11px]">
                      Ctrl + S
                    </span>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-text-primary">Open 2D Graph View</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono text-[11px]">
                      Ctrl + G
                    </span>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-text-primary">Open Settings</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono text-[11px]">
                      Ctrl + ,
                    </span>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-text-primary">Close Dialog or Overlay</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono text-[11px]">
                      Escape
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">Appearance</h3>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle space-y-2">
                  <span className="text-text-primary font-medium">Base Color Theme</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="px-3 py-1.5 rounded bg-bg-card border border-accent-purple text-accent-purple font-medium">
                      Obsidian Dark (#1e1e1e)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "plugins" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">Core Plugins</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 bg-bg-secondary rounded-lg border border-border-subtle">
                    <div>
                      <div className="font-medium text-text-primary">Backlinks</div>
                      <div className="text-[11px] text-text-faint">
                        Display linked and unlinked mentions.
                      </div>
                    </div>
                    <span className="text-accent-green font-semibold">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-bg-secondary rounded-lg border border-border-subtle">
                    <div>
                      <div className="font-medium text-text-primary">Graph View</div>
                      <div className="text-[11px] text-text-faint">
                        Force-directed graph view of note links.
                      </div>
                    </div>
                    <span className="text-accent-green font-semibold">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-bg-secondary rounded-lg border border-border-subtle">
                    <div>
                      <div className="font-medium text-text-primary">Visual Canvas</div>
                      <div className="text-[11px] text-text-faint">
                        Infinite 2D whiteboard for ideas.
                      </div>
                    </div>
                    <span className="text-accent-green font-semibold">Enabled</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "general" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">General</h3>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle space-y-1">
                  <div className="font-medium text-text-primary">Auto Save</div>
                  <div className="text-[11px] text-text-faint">
                    Notes are automatically saved on edit and debounced safely to local disk.
                  </div>
                </div>
              </div>
            )}

            {activeTab === "about" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center border border-border-subtle shadow-md">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]">
                      <polygon points="12,2 19,8 17,17 12,22 7,17 5,8" fill="#7b6cd9" stroke="#ffffff" strokeWidth="0.8" />
                      <polygon points="12,2 12,22 17,17 19,8" fill="#5848c2" opacity="0.8" />
                      <line x1="12" y1="2" x2="12" y2="22" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.8" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">About Shard</h3>
                    <div className="text-[11px] text-accent-purple font-medium">v0.1.0 (Native Release)</div>
                  </div>
                </div>
                <p className="text-text-muted leading-relaxed">
                  Shard is a high-performance, zero-bloat local knowledge base and markdown editor
                  designed to run flawlessly on potato PCs without Electron overhead.
                </p>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle text-text-faint text-[11px] space-y-1 font-mono">
                  <div>Engine: Tauri v2 + OS WebView2 (Edge Evergreen)</div>
                  <div>Editor: CodeMirror 6 (Virtualized line rendering)</div>
                  <div>Styling: Tailwind CSS</div>
                  <div>Idle Memory: &lt; 35 MB RAM</div>
                  <div>Startup Time: &lt; 50 ms</div>
                </div>

                <div className="p-3 bg-bg-secondary/60 rounded-lg border border-border-subtle/80 text-text-faint text-[11px] leading-relaxed">
                  <span className="font-semibold text-text-muted">Legal Disclaimer:</span> Shard is an independent open-source project developed for local-first knowledge management. It is not affiliated with, associated with, sponsored by, or endorsed by Dynalist Inc. or Obsidian. All product and company names are trademarks™ or registered® trademarks of their respective holders.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
