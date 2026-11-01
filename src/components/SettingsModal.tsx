import React, { useState } from "react";
import {
  X,
  Sliders,
  Palette,
  Zap,
  Keyboard,
  Info,
  Globe,
  Download,
  Archive,
  Check,
} from "lucide-react";
import { Language, TextDirection, Translations } from "../i18n";
import { ThemePreset } from "../types";
import { exportVaultAsZip } from "../utils/vaultBackup";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  textDirection: TextDirection;
  onTextDirectionChange: (dir: TextDirection) => void;
  currentTheme?: ThemePreset;
  onThemeChange?: (theme: ThemePreset) => void;
  vaultPath?: string | null;
  t?: Translations["settings"];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
  onLanguageChange,
  textDirection,
  onTextDirectionChange,
  currentTheme = "shard",
  onThemeChange,
  vaultPath = null,
  t,
}) => {
  const [activeTab, setActiveTab] = useState<
    "general" | "language" | "appearance" | "plugins" | "hotkeys" | "about"
  >("language");
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const themes: { id: ThemePreset; name: string; desc: string; bg: string; accent: string }[] = [
    {
      id: "shard",
      name: "Shard Nebula",
      desc: "Default modern charcoal with purple glow",
      bg: "#1e1e1e",
      accent: "#7b6cd9",
    },
    {
      id: "oled",
      name: "OLED Pure Black",
      desc: "True #000000 for battery saving & high contrast",
      bg: "#000000",
      accent: "#7b6cd9",
    },
    {
      id: "catppuccin",
      name: "Catppuccin Mocha",
      desc: "Soothing pastel dark palette",
      bg: "#1e1e2e",
      accent: "#cba6f7",
    },
    {
      id: "nord",
      name: "Nord",
      desc: "Cool arctic blue-gray aesthetic",
      bg: "#2e3440",
      accent: "#88c0d0",
    },
    {
      id: "paper",
      name: "Warm Paper (Light)",
      desc: "Eye-friendly sepia for daytime reading",
      bg: "#fbfbf9",
      accent: "#6c52b5",
    },
  ];

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      await exportVaultAsZip(vaultPath);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-[530px] bg-bg-card border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs"
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
          <div className="w-48 bg-bg-secondary/70 border-r border-border-subtle p-2 space-y-1 shrink-0">
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
              onClick={() => setActiveTab("appearance")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "appearance"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Palette className="w-4 h-4" /> {t?.appearance || "Appearance & Themes"}
            </button>
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "general"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Sliders className="w-4 h-4" /> {t?.general || "General & Backup"}
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
              <Info className="w-4 h-4" /> {t?.about || "About Shard"}
            </button>
          </div>

          {/* Right Pane Content */}
          <div className="flex-1 p-5 overflow-y-auto">
            {/* 1. Language & Direction Tab */}
            {activeTab === "language" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t?.appLanguage || "Interface Language"}
                  </h3>
                  <p className="text-text-faint text-[11px] mt-0.5">
                    Choose your preferred language for menus and buttons.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <button
                      onClick={() => onLanguageChange("en")}
                      className={`p-3 rounded-lg text-left transition-all border ${
                        language === "en"
                          ? "bg-bg-card border-accent-purple text-white shadow-sm"
                          : "bg-bg-card/40 border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card"
                      }`}
                    >
                      <div className="font-semibold text-xs">English</div>
                      <div className="text-[10px] text-text-faint mt-0.5">Default interface language</div>
                    </button>

                    <button
                      onClick={() => onLanguageChange("ar")}
                      className={`p-3 rounded-lg text-left transition-all border ${
                        language === "ar"
                          ? "bg-bg-card border-accent-purple text-white shadow-sm"
                          : "bg-bg-card/40 border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card"
                      }`}
                    >
                      <div className="font-semibold text-xs font-sans">العربية (Arabic)</div>
                      <div className="text-[10px] text-text-faint mt-0.5">واجهة مستخدم معربة بالكامل مع RTL</div>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t?.textDirection || "Text Direction Behavior"}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      onClick={() => onTextDirectionChange("auto")}
                      className={`p-2 rounded-lg text-left transition-all border ${
                        textDirection === "auto"
                          ? "bg-bg-card border-accent-purple text-white font-medium"
                          : "bg-bg-card/50 border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card"
                      }`}
                    >
                      <div className="font-semibold text-xs">Auto / تلقائي</div>
                      <div className="text-[10px] text-text-faint mt-0.5">Detects per line</div>
                    </button>

                    <button
                      onClick={() => onTextDirectionChange("rtl")}
                      className={`p-2 rounded-lg text-left transition-all border ${
                        textDirection === "rtl"
                          ? "bg-bg-card border-accent-purple text-white font-medium"
                          : "bg-bg-card/50 border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card"
                      }`}
                    >
                      <div className="font-semibold text-xs">RTL / يمين ليسار</div>
                      <div className="text-[10px] text-text-faint mt-0.5">Arabic default</div>
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
                      <div className="text-[10px] text-text-faint mt-0.5">English default</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Appearance & Themes Tab */}
            {activeTab === "appearance" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Theme Presets
                  </h3>
                  <p className="text-text-faint text-[11px] mt-0.5">
                    Select your color theme. Themes apply instantly across all panes and the visual canvas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {themes.map((th) => {
                    const isSelected = currentTheme === th.id;
                    return (
                      <button
                        key={th.id}
                        onClick={() => onThemeChange && onThemeChange(th.id)}
                        className={`p-3 rounded-lg text-left border transition-all flex items-start justify-between ${
                          isSelected
                            ? "border-accent-purple bg-bg-card shadow-md"
                            : "border-border-subtle bg-bg-secondary/40 hover:bg-bg-hover hover:border-text-faint"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
                              style={{ backgroundColor: th.bg }}
                            />
                            <span className="font-semibold text-xs text-text-primary">
                              {th.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-text-faint">
                            {th.desc}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-accent-purple shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. General & Backup Tab */}
            {activeTab === "general" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t?.general || "General"}
                  </h3>
                  <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle mt-2 space-y-1">
                    <div className="font-medium text-text-primary">Auto Save</div>
                    <div className="text-[11px] text-text-faint leading-relaxed">
                      {t?.autoSaveDesc ||
                        "Notes are automatically saved on edit and debounced safely to local disk with zero cloud latency."}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Vault Backup & Portability
                  </h3>
                  <p className="text-text-faint text-[11px] mt-0.5">
                    Export your entire Markdown knowledge base and visual canvas files into a single standalone ZIP archive.
                  </p>

                  <div className="mt-3 p-3 bg-bg-secondary rounded-lg border border-border-subtle flex items-center justify-between">
                    <div>
                      <div className="font-medium text-text-primary flex items-center gap-1.5">
                        <Archive className="w-4 h-4 text-accent-purple" />
                        <span>Export Vault (.zip)</span>
                      </div>
                      <div className="text-[10px] text-text-faint mt-0.5">
                        Download full offline backup with all notes and .canvas files
                      </div>
                    </div>

                    <button
                      onClick={handleExportZip}
                      disabled={isExporting}
                      className="px-3 py-1.5 rounded-md bg-accent-purple hover:bg-accent-purple-hover text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isExporting ? "Exporting..." : exportSuccess ? "Downloaded!" : "Export ZIP"}</span>
                    </button>
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
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 bg-bg-secondary rounded-lg border border-border-subtle">
                    <div>
                      <div className="font-medium text-text-primary">Backlinks & Mentions</div>
                      <div className="text-[11px] text-text-faint">
                        Display linked and unlinked mentions with instant jump.
                      </div>
                    </div>
                    <span className="text-accent-green font-semibold text-[11px]">Active</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-bg-secondary rounded-lg border border-border-subtle">
                    <div>
                      <div className="font-medium text-text-primary">Local Graph & Global Graph</div>
                      <div className="text-[11px] text-text-faint">
                        Interactive force-directed 2D network simulation.
                      </div>
                    </div>
                    <span className="text-accent-green font-semibold text-[11px]">Active</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-bg-secondary rounded-lg border border-border-subtle">
                    <div>
                      <div className="font-medium text-text-primary">Visual Infinite Canvas</div>
                      <div className="text-[11px] text-text-faint">
                        Infinite 2D whiteboard with directional links and card styling.
                      </div>
                    </div>
                    <span className="text-accent-green font-semibold text-[11px]">Active</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-bg-secondary rounded-lg border border-border-subtle">
                    <div>
                      <div className="font-medium text-text-primary">LaTeX Math Equations</div>
                      <div className="text-[11px] text-text-faint">
                        Fast client-side KaTeX rendering for scientific and math notes.
                      </div>
                    </div>
                    <span className="text-accent-green font-semibold text-[11px]">Active</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Hotkeys Tab */}
            {activeTab === "hotkeys" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t?.shortcutsTitle || "Keyboard Shortcuts"}
                </h3>
                <div className="space-y-1.5 divide-y divide-border-subtle/50 text-[11px]">
                  <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-text-primary">Quick Switcher / Search</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono">
                      Ctrl + O
                    </span>
                  </div>
                  <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-text-primary">Command Palette</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono">
                      Ctrl + P
                    </span>
                  </div>
                  <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-text-primary">Toggle Text Direction (Auto / RTL / LTR)</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono">
                      Ctrl + Shift + X
                    </span>
                  </div>
                  <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-text-primary">Distraction-Free Zen Mode</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono">
                      F11
                    </span>
                  </div>
                  <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-text-primary">Save Note</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono">
                      Ctrl + S
                    </span>
                  </div>
                  <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-text-primary">Open Global Graph</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono">
                      Ctrl + G
                    </span>
                  </div>
                  <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-text-primary">Open Settings</span>
                    <span className="px-2 py-0.5 rounded bg-bg-hover text-accent-purple font-mono">
                      Ctrl + ,
                    </span>
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
                      v0.1.0 (Zero-Bloat Release)
                    </div>
                  </div>
                </div>
                <p className="text-text-muted leading-relaxed">
                  Shard is an ultra-fast, local-first personal knowledge base and visual canvas designed to run effortlessly on low-spec PCs, laptops, and mobile devices without Electron overhead.
                </p>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle text-text-faint text-[11px] space-y-1 font-mono">
                  <div>Engine: Tauri v2 + Rust Core</div>
                  <div>Editor: CodeMirror 6 with Live Preview & KaTeX Math</div>
                  <div>Memory: &lt; 35 MB idle RAM</div>
                  <div>Startup: &lt; 50 ms</div>
                  <div>License: GNU GPLv3</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
