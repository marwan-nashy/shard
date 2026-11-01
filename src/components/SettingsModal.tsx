import React, { useState } from "react";
import { X, Sliders, Palette, Zap, Keyboard, Info, Globe } from "lucide-react";
import { Language, TextDirection, Translations } from "../i18n";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  textDirection: TextDirection;
  onTextDirectionChange: (dir: TextDirection) => void;
  t?: Translations["settings"];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
  onLanguageChange,
  textDirection,
  onTextDirectionChange,
  t,
}) => {
  const [activeTab, setActiveTab] = useState<
    "general" | "language" | "appearance" | "plugins" | "hotkeys" | "about"
  >("language");

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
          <span className="text-sm font-semibold text-text-primary">
            {t?.title || "Settings"}
          </span>
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
          <div className="w-48 bg-bg-secondary/70 border-r border-border-subtle p-2 space-y-1">
            <button
              onClick={() => setActiveTab("language")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "language"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Globe className="w-4 h-4 text-accent-purple" /> {t?.language || "Language & Direction"}
            </button>
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "general"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Sliders className="w-4 h-4" /> {t?.general || "General"}
            </button>
            <button
              onClick={() => setActiveTab("appearance")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "appearance"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Palette className="w-4 h-4" /> {t?.appearance || "Appearance"}
            </button>
            <button
              onClick={() => setActiveTab("plugins")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "plugins"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Zap className="w-4 h-4" /> {t?.plugins || "Core plugins"}
            </button>
            <button
              onClick={() => setActiveTab("hotkeys")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "hotkeys"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Keyboard className="w-4 h-4" /> {t?.hotkeys || "Hotkeys"}
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "about"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Info className="w-4 h-4" /> {t?.about || "About"}
            </button>
          </div>

          {/* Right Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Language & Direction Tab */}
            {activeTab === "language" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t?.language || "Language & Direction"}
                  </h3>
                  <p className="text-text-faint text-[11px] mt-0.5">
                    Shard supports full bidirectional editing, Arabic script, and multilingual UI.
                  </p>
                </div>

                {/* Application Language Selector */}
                <div className="p-3.5 bg-bg-secondary rounded-lg border border-border-subtle space-y-2.5">
                  <span className="text-text-primary font-medium block">
                    {t?.appLanguage || "Application Language"}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => onLanguageChange("en")}
                      className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                        language === "en"
                          ? "bg-accent-purple text-white shadow-md shadow-accent-purple/20"
                          : "bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary"
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => onLanguageChange("ar")}
                      className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                        language === "ar"
                          ? "bg-accent-purple text-white shadow-md shadow-accent-purple/20"
                          : "bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary"
                      }`}
                    >
                      العربية (Arabic)
                    </button>
                  </div>
                </div>

                {/* Default Document Text Direction */}
                <div className="p-3.5 bg-bg-secondary rounded-lg border border-border-subtle space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-text-primary font-medium block">
                      {t?.textDirection || "Default Text Direction"}
                    </span>
                    <span className="text-[10px] text-text-faint font-mono">
                      Shortcut: Ctrl+Shift+X
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => onTextDirectionChange("auto")}
                      className={`p-2 rounded-lg text-left transition-all border ${
                        textDirection === "auto"
                          ? "bg-bg-card border-accent-purple text-white font-medium"
                          : "bg-bg-card/50 border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card"
                      }`}
                    >
                      <div className="font-semibold text-xs">Auto / تلقائي</div>
                      <div className="text-[10px] text-text-faint mt-0.5">
                        Detects each line's direction dynamically.
                      </div>
                    </button>

                    <button
                      onClick={() => onTextDirectionChange("rtl")}
                      className={`p-2 rounded-lg text-left transition-all border ${
                        textDirection === "rtl"
                          ? "bg-bg-card border-accent-purple text-white font-medium"
                          : "bg-bg-card/50 border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card"
                      }`}
                    >
                      <div className="font-semibold text-xs">RTL / يمين لليسار</div>
                      <div className="text-[10px] text-text-faint mt-0.5">
                        Forces right-to-left alignment (Arabic).
                      </div>
                    </button>

                    <button
                      onClick={() => onTextDirectionChange("ltr")}
                      className={`p-2 rounded-lg text-left transition-all border ${
                        textDirection === "ltr"
                          ? "bg-bg-card border-accent-purple text-white font-medium"
                          : "bg-bg-card/50 border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card"
                      }`}
                    >
                      <div className="font-semibold text-xs">LTR / يسار ليمين</div>
                      <div className="text-[10px] text-text-faint mt-0.5">
                        Forces left-to-right alignment (English).
                      </div>
                    </button>
                  </div>
                </div>

                {/* Typography info */}
                <div className="p-3 bg-bg-secondary/60 rounded-lg border border-border-subtle text-text-faint text-[11px] leading-relaxed">
                  <span className="font-semibold text-text-muted">Arabic Typography: </span>
                  {t?.fontHint || "Arabic text renders with optimal Cairo, Segoe UI, and Tahoma typography."}
                </div>
              </div>
            )}

            {/* 2. Hotkeys Tab */}
            {activeTab === "hotkeys" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t?.shortcutsTitle || "Keyboard Shortcuts"}
                  </h3>
                  <p className="text-text-faint text-[11px] mt-0.5">
                    {t?.shortcutsDesc || "Modifiers strictly appear before letters."}
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
                    <span className="text-text-primary">Toggle Text Direction (Auto / RTL / LTR)</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono text-[11px]">
                      Ctrl + Shift + X
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
                    <span className="text-text-primary">Toggle Live Preview / Source</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono text-[11px]">
                      Ctrl + E
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

            {/* 3. Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t?.appearance || "Appearance"}
                </h3>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle space-y-2">
                  <span className="text-text-primary font-medium">{t?.themeTitle || "Base Color Theme"}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="px-3 py-1.5 rounded bg-bg-card border border-accent-purple text-accent-purple font-medium">
                      Neutral Charcoal (#1e1e1e)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Plugins Tab */}
            {activeTab === "plugins" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t?.plugins || "Core Plugins"}
                </h3>
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

            {/* 5. General Tab */}
            {activeTab === "general" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t?.general || "General"}
                </h3>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle space-y-1">
                  <div className="font-medium text-text-primary">Auto Save</div>
                  <div className="text-[11px] text-text-faint">
                    {t?.autoSaveDesc ||
                      "Notes are automatically saved on edit and debounced safely to local disk."}
                  </div>
                </div>
              </div>
            )}

            {/* 6. About Tab */}
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
                    <div className="text-[11px] text-accent-purple font-medium">
                      {t?.aboutVersion || "v0.1.0 (Native Release)"}
                    </div>
                  </div>
                </div>
                <p className="text-text-muted leading-relaxed">
                  {t?.aboutDesc ||
                    "Shard is a high-performance, zero-bloat local knowledge base and markdown editor designed to run flawlessly on potato PCs without Electron overhead."}
                </p>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle text-text-faint text-[11px] space-y-1 font-mono">
                  <div>Engine: Tauri v2 + OS WebView2 (Edge Evergreen)</div>
                  <div>Editor: CodeMirror 6 (Virtualized line rendering)</div>
                  <div>Styling: Tailwind CSS</div>
                  <div>BiDi & RTL: Native Unicode BiDi + CodeMirror perLineTextDirection</div>
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
