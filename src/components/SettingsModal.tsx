import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  Palette,
  Keyboard,
  Info,
  Globe,
  Download,
  Archive,
  Check,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Layers,
  Sparkles,
  FileDown,
  Cloud,
  Type as TypeIcon,
  Code as CodeIcon,
  RotateCcw,
} from "lucide-react";
import { SyncConfig } from "../types";
import { loadSyncConfig, saveSyncConfig, testWebDavConnection, performWebDavSync } from "../utils/syncManager";
import {
  loadCustomShortcuts,
  saveCustomShortcuts,
  DEFAULT_SHORTCUTS,
  CustomShortcutDef,
  loadUiFont,
  setUiFont,
  loadCodeFont,
  setCodeFont,
  loadCustomCss,
  saveCustomCss,
  isCustomCssEnabled,
  setCustomCssEnabled,
} from "../utils/customStyles";
import { Language, TextDirection, Translations } from "../i18n";
import { ThemePreset, FeatureFlags } from "../types";
import { exportVaultAsZip } from "../utils/vaultBackup";
import { FEATURE_METADATA } from "../utils/featureFlags";
import { UpdateInfo, CURRENT_VERSION, getLastCheckedTimestamp } from "../utils/updateChecker";

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
  initialTab?: "general" | "language" | "appearance" | "features" | "hotkeys" | "sync" | "about";
  features?: FeatureFlags;
  onToggleFeature?: (key: keyof FeatureFlags) => void;
  onResetFeatures?: () => void;
  updateInfo?: UpdateInfo | null;
  isCheckingUpdate?: boolean;
  onCheckUpdate?: () => void;
  autoCheckEnabled?: boolean;
  onToggleAutoCheck?: (enabled: boolean) => void;
  vaultNotes?: { path: string; content?: string }[];
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
  initialTab = "language",
  features,
  onToggleFeature,
  onResetFeatures,
  updateInfo,
  isCheckingUpdate = false,
  onCheckUpdate,
  autoCheckEnabled = true,
  onToggleAutoCheck,
  vaultNotes = [],
}) => {
  const [activeTab, setActiveTab] = useState<
    "general" | "language" | "appearance" | "features" | "hotkeys" | "sync" | "about"
  >(initialTab);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [featureCategory, setFeatureCategory] = useState<"all" | "views" | "sidebar" | "editor" | "tools">("all");

  // Sync state
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(loadSyncConfig);
  const [syncTestMessage, setSyncTestMessage] = useState<string | null>(null);
  const [syncTestSuccess, setSyncTestSuccess] = useState<boolean | null>(null);
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Appearance typography & CSS state
  const [uiFont, setUiFontState] = useState(loadUiFont);
  const [codeFont, setCodeFontState] = useState(loadCodeFont);
  const [customCss, setCustomCssState] = useState(loadCustomCss);
  const [customCssEnabled, setCustomCssEnabledState] = useState(isCustomCssEnabled);

  // Hotkeys state
  const [customShortcuts, setCustomShortcutsState] = useState<CustomShortcutDef[]>(loadCustomShortcuts);
  const [rebindingId, setRebindingId] = useState<string | null>(null);

  // Hotkey keydown listener for interactive rebinding
  useEffect(() => {
    if (!rebindingId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      const newKey = parts.join("+");

      const updated = customShortcuts.map((s) =>
        s.id === rebindingId ? { ...s, currentKey: newKey } : s
      );
      setCustomShortcutsState(updated);
      saveCustomShortcuts(updated);
      setRebindingId(null);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [rebindingId, customShortcuts]);

  const handleUpdateSyncConfig = (patch: Partial<SyncConfig>) => {
    const next = { ...syncConfig, ...patch };
    setSyncConfig(next);
    saveSyncConfig(next);
  };

  const handleTestWebDav = async () => {
    setIsTestingSync(true);
    setSyncTestMessage(null);
    try {
      const res = await testWebDavConnection(syncConfig);
      setSyncTestSuccess(res.success);
      setSyncTestMessage(res.message);
    } finally {
      setIsTestingSync(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatus("Syncing vault with WebDAV...");
    try {
      const res = await performWebDavSync(syncConfig, vaultNotes || []);
      setSyncStatus(res.message);
    } catch (err: any) {
      setSyncStatus(`Sync failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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

  const filteredFeatureMetadata = FEATURE_METADATA.filter(
    (f) => featureCategory === "all" || f.category === featureCategory
  );

  const lastCheckedTs = getLastCheckedTimestamp();
  const lastCheckedDateStr = lastCheckedTs
    ? new Date(lastCheckedTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-[560px] bg-bg-card border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-secondary/40 select-none">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">
              {t?.title || "Settings"}
            </span>
            {updateInfo?.hasUpdate && (
              <span className="px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple text-[10px] font-medium border border-accent-purple/30 animate-pulse">
                Update v{updateInfo.latestVersion} Available
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Navigation */}
          <div className="w-48 bg-bg-secondary/70 border-r border-border-subtle p-2 space-y-1 shrink-0 select-none">
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
              <Palette className="w-4 h-4 text-accent-blue" /> {t?.appearance || "Appearance & Themes"}
            </button>
            <button
              onClick={() => setActiveTab("features")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-left transition-colors ${
                activeTab === "features"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-accent-emerald" />
                <span>{t?.features || "Features & Modules"}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "general"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Sliders className="w-4 h-4 text-accent-orange" /> {t?.general || "General & Backup"}
            </button>
            <button
              onClick={() => setActiveTab("sync")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "sync"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Cloud className="w-4 h-4 text-accent-blue" /> <span>Sync & Cloud</span>
            </button>
            <button
              onClick={() => setActiveTab("hotkeys")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors ${
                activeTab === "hotkeys"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Keyboard className="w-4 h-4 text-text-faint" /> {t?.hotkeys || "Hotkeys"}
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-left transition-colors ${
                activeTab === "about"
                  ? "bg-bg-card text-white font-medium border-l-2 border-accent-purple"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 text-accent-purple" />
                <span>{t?.about || "About & Updates"}</span>
              </div>
              {updateInfo?.hasUpdate && (
                <span className="w-2 h-2 rounded-full bg-accent-purple animate-ping" />
              )}
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

                {/* Typography Settings */}
                <div className="pt-3 border-t border-border-subtle space-y-3">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="w-4 h-4 text-accent-purple" />
                    <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                      Typography & Fonts
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-text-muted mb-1 font-medium">UI Font Family</label>
                      <select
                        value={uiFont}
                        onChange={(e) => {
                          setUiFontState(e.target.value);
                          setUiFont(e.target.value);
                        }}
                        className="w-full bg-bg-card border border-border-subtle rounded-md px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple"
                      >
                        <option value="system">System Default</option>
                        <option value="inter">Inter (Modern Clean)</option>
                        <option value="cairo">Cairo (Arabic / RTL Optimized)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-text-muted mb-1 font-medium">Editor Code Font</label>
                      <select
                        value={codeFont}
                        onChange={(e) => {
                          setCodeFontState(e.target.value);
                          setCodeFont(e.target.value);
                        }}
                        className="w-full bg-bg-card border border-border-subtle rounded-md px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple font-mono"
                      >
                        <option value="mono">Monospace Default</option>
                        <option value="jetbrains">JetBrains Mono</option>
                        <option value="fira">Fira Code</option>
                        <option value="consolas">Consolas</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Live Custom CSS Snippets */}
                <div className="pt-3 border-t border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CodeIcon className="w-4 h-4 text-accent-emerald" />
                      <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                        Custom CSS Snippets
                      </h3>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-muted">
                      <span>Enable CSS</span>
                      <input
                        type="checkbox"
                        checked={customCssEnabled}
                        onChange={(e) => {
                          setCustomCssEnabledState(e.target.checked);
                          setCustomCssEnabled(e.target.checked);
                        }}
                        className="accent-accent-purple"
                      />
                    </label>
                  </div>

                  <p className="text-[10px] text-text-faint">
                    Inject arbitrary custom styling directly into Shard's editor, preview, and UI panes in real time.
                  </p>

                  <textarea
                    rows={4}
                    value={customCss}
                    onChange={(e) => {
                      setCustomCssState(e.target.value);
                      saveCustomCss(e.target.value);
                    }}
                    placeholder={`/* Example custom styling */\n.cm-content { line-height: 1.8; }\n.cm-header-1 { color: #a855f7 !important; }`}
                    className="w-full bg-bg-card border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-purple leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* 3. Features & Modules Tab (Ability to Hide Features You Don't Like) */}
            {activeTab === "features" && (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <span>{t?.features || "Features & Modules"}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-purple/15 text-accent-purple font-mono">
                        Modular
                      </span>
                    </h3>
                    <p className="text-text-faint text-[11px] mt-0.5 max-w-md">
                      {t?.featuresDesc ||
                        "Turn off any feature you don't use to keep Shard completely clutter-free and tailored to your workflow."}
                    </p>
                  </div>

                  {onResetFeatures && (
                    <button
                      onClick={onResetFeatures}
                      className="px-2.5 py-1 rounded bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-muted hover:text-text-primary text-[10px] transition-colors"
                      title="Reset all modules to ON"
                    >
                      {t?.resetFeatures || "Enable All"}
                    </button>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 pb-1 border-b border-border-subtle overflow-x-auto text-[11px]">
                  {(["all", "views", "sidebar", "editor", "tools"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFeatureCategory(cat)}
                      className={`px-2.5 py-1 rounded-md transition-colors capitalize ${
                        featureCategory === cat
                          ? "bg-accent-purple text-white font-medium"
                          : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                      }`}
                    >
                      {cat === "all" ? "All Features" : cat}
                    </button>
                  ))}
                </div>

                {/* Features List */}
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {filteredFeatureMetadata.map((f) => {
                    const isEnabled = features ? features[f.key] !== false : true;
                    return (
                      <div
                        key={f.key}
                        onClick={() => onToggleFeature && onToggleFeature(f.key)}
                        className={`p-3 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                          isEnabled
                            ? "bg-bg-card/70 border-border-subtle hover:border-accent-purple/50"
                            : "bg-bg-secondary/40 border-border-subtle/40 opacity-60 hover:opacity-80"
                        }`}
                      >
                        <div className="space-y-0.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-text-primary text-xs">
                              {language === "ar" ? f.nameAr : f.name}
                            </span>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-bg-secondary text-text-faint font-mono border border-border-subtle/50">
                              {f.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-text-faint leading-relaxed" dir={language === "ar" ? "rtl" : "ltr"}>
                            {language === "ar" ? f.descriptionAr : f.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="shrink-0 p-1 text-accent-purple transition-transform active:scale-95"
                          title={isEnabled ? "Click to disable" : "Click to enable"}
                        >
                          {isEnabled ? (
                            <ToggleRight className="w-6 h-6 text-accent-purple fill-accent-purple/20" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-text-faint" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. General & Backup Tab */}
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

            {/* 5. Hotkeys Tab with Interactive Rebinding */}
            {activeTab === "hotkeys" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      {t?.shortcutsTitle || "Keyboard Shortcuts"}
                    </h3>
                    <p className="text-[11px] text-text-faint mt-0.5">
                      Click "Rebind" and press any key combination to customize shortcuts.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCustomShortcutsState(DEFAULT_SHORTCUTS);
                      saveCustomShortcuts(DEFAULT_SHORTCUTS);
                    }}
                    className="px-2.5 py-1 rounded bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-muted hover:text-text-primary text-[10px] flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {customShortcuts.map((s) => {
                    const isRebinding = rebindingId === s.id;
                    return (
                      <div
                        key={s.id}
                        className="p-2.5 rounded-lg bg-bg-card/60 border border-border-subtle flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-medium text-text-primary">
                            {language === "ar" ? s.nameAr : s.name}
                          </div>
                          <div className="text-[10px] text-text-faint">
                            Default: {s.defaultKey}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded font-mono text-[11px] border ${
                              isRebinding
                                ? "bg-accent-purple text-white animate-pulse border-accent-purple"
                                : "bg-bg-hover text-accent-purple border-border-subtle"
                            }`}
                          >
                            {isRebinding ? "Press key combo..." : s.currentKey}
                          </span>

                          <button
                            type="button"
                            onClick={() => setRebindingId(isRebinding ? null : s.id)}
                            className="px-2 py-1 rounded bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-[10px] text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          >
                            {isRebinding ? "Cancel" : "Rebind"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Sync & Cloud Tab */}
            {activeTab === "sync" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-accent-blue" />
                    <span>Private Cloud & Remote Sync</span>
                  </h3>
                  <p className="text-text-faint text-[11px] mt-0.5">
                    Sync your local notes seamlessly with private WebDAV storage (Nextcloud, OwnCloud, Synology NAS) or Git.
                  </p>
                </div>

                {/* Provider Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-text-muted">Sync Provider</label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: "none", name: "Offline Only", desc: "No remote sync" },
                      { id: "webdav", name: "WebDAV", desc: "Nextcloud, NAS, InfiniCLOUD" },
                      { id: "git", name: "Git Repo", desc: "GitHub / GitLab" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleUpdateSyncConfig({ provider: p.id as any })}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          syncConfig.provider === p.id
                            ? "border-accent-purple bg-bg-card font-medium text-text-primary shadow-sm"
                            : "border-border-subtle bg-bg-secondary/40 text-text-muted hover:bg-bg-card hover:text-text-primary"
                        }`}
                      >
                        <div className="font-semibold text-xs">{p.name}</div>
                        <div className="text-[10px] text-text-faint mt-0.5">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* WebDAV Settings */}
                {syncConfig.provider === "webdav" && (
                  <div className="space-y-3 p-3.5 rounded-xl bg-bg-card/50 border border-border-subtle text-xs">
                    <div>
                      <label className="block text-text-muted mb-1 font-medium">WebDAV URL</label>
                      <input
                        type="url"
                        value={syncConfig.webdavUrl || ""}
                        onChange={(e) => handleUpdateSyncConfig({ webdavUrl: e.target.value })}
                        placeholder="https://cloud.example.com/remote.php/dav/files/user/shard/"
                        className="w-full bg-bg-primary border border-border-subtle rounded-md px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-text-muted mb-1 font-medium">Username</label>
                        <input
                          type="text"
                          value={syncConfig.webdavUsername || ""}
                          onChange={(e) => handleUpdateSyncConfig({ webdavUsername: e.target.value })}
                          placeholder="username"
                          className="w-full bg-bg-primary border border-border-subtle rounded-md px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple"
                        />
                      </div>
                      <div>
                        <label className="block text-text-muted mb-1 font-medium">Password / App Token</label>
                        <input
                          type="password"
                          value={syncConfig.webdavPassword || ""}
                          onChange={(e) => handleUpdateSyncConfig({ webdavPassword: e.target.value })}
                          placeholder="••••••••••••"
                          className="w-full bg-bg-primary border border-border-subtle rounded-md px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestWebDav}
                          disabled={isTestingSync || !syncConfig.webdavUrl}
                          className="px-3 py-1.5 rounded-md bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-primary font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isTestingSync ? "Testing..." : "Test Connection"}
                        </button>

                        <button
                          type="button"
                          onClick={handleTriggerSync}
                          disabled={isSyncing || !syncConfig.webdavUrl}
                          className="px-3 py-1.5 rounded-md bg-accent-purple hover:bg-accent-purple-hover text-white font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isSyncing ? "Syncing..." : "Sync Now"}
                        </button>
                      </div>

                      <label className="flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncConfig.autoSync}
                          onChange={(e) => handleUpdateSyncConfig({ autoSync: e.target.checked })}
                          className="accent-accent-purple"
                        />
                        <span>Auto-sync in background</span>
                      </label>
                    </div>

                    {syncTestMessage && (
                      <div
                        className={`p-2 rounded text-[11px] ${
                          syncTestSuccess
                            ? "bg-accent-green/15 text-accent-green border border-accent-green/30"
                            : "bg-accent-orange/15 text-accent-orange border border-accent-orange/30"
                        }`}
                      >
                        {syncTestMessage}
                      </div>
                    )}

                    {syncStatus && (
                      <div className="p-2 rounded bg-bg-secondary text-[11px] text-text-muted font-mono">
                        {syncStatus}
                      </div>
                    )}
                  </div>
                )}

                {/* Git Settings */}
                {syncConfig.provider === "git" && (
                  <div className="space-y-3 p-3.5 rounded-xl bg-bg-card/50 border border-border-subtle text-xs">
                    <div>
                      <label className="block text-text-muted mb-1 font-medium">Git Repository URL</label>
                      <input
                        type="url"
                        value={syncConfig.gitRemoteUrl || ""}
                        onChange={(e) => handleUpdateSyncConfig({ gitRemoteUrl: e.target.value })}
                        placeholder="https://github.com/username/vault.git"
                        className="w-full bg-bg-primary border border-border-subtle rounded-md px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-text-muted mb-1 font-medium">Branch</label>
                        <input
                          type="text"
                          value={syncConfig.gitBranch || "main"}
                          onChange={(e) => handleUpdateSyncConfig({ gitBranch: e.target.value })}
                          placeholder="main"
                          className="w-full bg-bg-primary border border-border-subtle rounded-md px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple"
                        />
                      </div>
                      <div>
                        <label className="block text-text-muted mb-1 font-medium">Personal Access Token</label>
                        <input
                          type="password"
                          value={syncConfig.gitToken || ""}
                          onChange={(e) => handleUpdateSyncConfig({ gitToken: e.target.value })}
                          placeholder="ghp_••••••••••••"
                          className="w-full bg-bg-primary border border-border-subtle rounded-md px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple"
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-text-faint leading-relaxed">
                      💡 Notes in local vault folders can also be versioned directly using any system Git client.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. About & In-App Updates Tab */}
            {activeTab === "about" && (
              <div className="space-y-4">
                {/* Brand Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-bg-secondary flex items-center justify-center border border-border-subtle shadow-md">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]">
                        <polygon points="12,2 19,8 17,17 12,22 7,17 5,8" fill="#7b6cd9" stroke="#ffffff" strokeWidth="0.8" />
                        <polygon points="12,2 12,22 17,17 19,8" fill="#5848c2" opacity="0.8" />
                        <line x1="12" y1="2" x2="12" y2="22" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.8" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">Shard</h3>
                      <div className="text-[11px] text-accent-purple font-medium">
                        v{CURRENT_VERSION} (Zero-Bloat Release)
                      </div>
                    </div>
                  </div>

                  {/* Manual Check for Updates Button */}
                  {onCheckUpdate && (
                    <button
                      onClick={onCheckUpdate}
                      disabled={isCheckingUpdate}
                      className="px-3 py-1.5 rounded-lg bg-accent-purple hover:bg-accent-purple-hover text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? "animate-spin" : ""}`} />
                      <span>{isCheckingUpdate ? (t?.checkingUpdates || "Checking...") : (t?.checkForUpdates || "Check for Updates")}</span>
                    </button>
                  )}
                </div>

                {/* Update Status Card */}
                {updateInfo && (
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${
                      updateInfo.hasUpdate
                        ? "bg-accent-purple/10 border-accent-purple/40 text-text-primary shadow-lg"
                        : "bg-bg-secondary/60 border-border-subtle text-text-muted"
                    }`}
                  >
                    {updateInfo.hasUpdate ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-accent-purple animate-bounce" />
                            <span className="font-semibold text-xs text-text-primary">
                              {t?.updateAvailable || "New update available!"} v{updateInfo.latestVersion}
                            </span>
                          </div>
                          <span className="text-[10px] text-text-faint">
                            Released on {updateInfo.publishedAt}
                          </span>
                        </div>

                        {/* Release Notes Preview */}
                        <div className="p-2.5 rounded bg-bg-primary/70 border border-border-subtle max-h-36 overflow-y-auto text-[11px] text-text-muted font-mono whitespace-pre-line leading-relaxed">
                          {updateInfo.releaseNotes}
                        </div>

                        {/* Direct Download Links */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] text-text-faint uppercase font-semibold">
                            Download Packages:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {updateInfo.assets.map((asset) => (
                              <a
                                key={asset.name}
                                href={asset.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-md bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-primary text-[11px] flex items-center gap-1.5 transition-colors font-medium hover:border-accent-purple"
                              >
                                <FileDown className="w-3.5 h-3.5 text-accent-purple" />
                                <span>{asset.name}</span>
                                <span className="text-text-faint text-[10px]">({asset.formattedSize})</span>
                              </a>
                            ))}
                            <a
                              href={updateInfo.releaseUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-md bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-muted hover:text-text-primary text-[11px] flex items-center gap-1 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View on GitHub</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-accent-green" />
                          <span className="text-text-primary font-medium">
                            {t?.upToDate || "You're on the latest version"} (v{CURRENT_VERSION})
                          </span>
                        </div>
                        {lastCheckedDateStr && (
                          <span className="text-[10px] text-text-faint">
                            Checked at {lastCheckedDateStr}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Auto Update Check Option */}
                {onToggleAutoCheck && (
                  <div className="flex items-center justify-between p-2.5 bg-bg-secondary/40 rounded-lg border border-border-subtle">
                    <div className="text-[11px] text-text-primary">
                      {t?.autoCheckUpdates || "Automatically check for updates on startup"}
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleAutoCheck(!autoCheckEnabled)}
                      className="p-1 text-accent-purple"
                    >
                      {autoCheckEnabled ? (
                        <ToggleRight className="w-5 h-5 text-accent-purple" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-text-faint" />
                      )}
                    </button>
                  </div>
                )}

                <p className="text-text-muted leading-relaxed text-[11px]">
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
