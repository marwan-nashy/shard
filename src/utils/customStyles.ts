const FONT_UI_KEY = "shard_font_ui";
const FONT_CODE_KEY = "shard_font_code";
const CUSTOM_CSS_KEY = "shard_custom_css";
const CUSTOM_CSS_ENABLED_KEY = "shard_custom_css_enabled";
const CUSTOM_HOTKEYS_KEY = "shard_custom_hotkeys";

export interface CustomShortcutDef {
  id: string;
  name: string;
  nameAr: string;
  defaultKey: string;
  currentKey: string;
}

export const DEFAULT_SHORTCUTS: CustomShortcutDef[] = [
  { id: "quick-switcher", name: "Quick Switcher / Search", nameAr: "التنقل السريع والبحث", defaultKey: "Ctrl+O", currentKey: "Ctrl+O" },
  { id: "command-palette", name: "Command Palette", nameAr: "لوحة الأوامر", defaultKey: "Ctrl+P", currentKey: "Ctrl+P" },
  { id: "save-note", name: "Save Note", nameAr: "حفظ الملاحظة", defaultKey: "Ctrl+S", currentKey: "Ctrl+S" },
  { id: "open-graph", name: "Open 2D Graph View", nameAr: "عرض شبكة الرسم البياني", defaultKey: "Ctrl+G", currentKey: "Ctrl+G" },
  { id: "toggle-preview", name: "Toggle Live Preview / Source", nameAr: "تبديل المعاينة الحية والمصدر", defaultKey: "Ctrl+E", currentKey: "Ctrl+E" },
  { id: "toggle-direction", name: "Cycle Text Direction", nameAr: "تبديل اتجاه النص", defaultKey: "Ctrl+Shift+X", currentKey: "Ctrl+Shift+X" },
  { id: "toggle-zen", name: "Toggle Zen / Focus Mode", nameAr: "وضع التركيز الخالي من المشتتات", defaultKey: "F11", currentKey: "F11" },
  { id: "open-settings", name: "Open Settings", nameAr: "فتح الإعدادات", defaultKey: "Ctrl+,", currentKey: "Ctrl+," },
];

export function loadCustomShortcuts(): CustomShortcutDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_HOTKEYS_KEY);
    if (!raw) return DEFAULT_SHORTCUTS;
    const parsed = JSON.parse(raw);
    return DEFAULT_SHORTCUTS.map((s) => ({
      ...s,
      currentKey: parsed[s.id] || s.defaultKey,
    }));
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export function saveCustomShortcuts(shortcuts: CustomShortcutDef[]): void {
  try {
    const map: Record<string, string> = {};
    shortcuts.forEach((s) => {
      map[s.id] = s.currentKey;
    });
    localStorage.setItem(CUSTOM_HOTKEYS_KEY, JSON.stringify(map));
  } catch {}
}

export function loadUiFont(): string {
  return localStorage.getItem(FONT_UI_KEY) || "system";
}

export function setUiFont(font: string): void {
  localStorage.setItem(FONT_UI_KEY, font);
  applyTypography();
}

export function loadCodeFont(): string {
  return localStorage.getItem(FONT_CODE_KEY) || "mono";
}

export function setCodeFont(font: string): void {
  localStorage.setItem(FONT_CODE_KEY, font);
  applyTypography();
}

export function loadCustomCss(): string {
  return localStorage.getItem(CUSTOM_CSS_KEY) || "";
}

export function saveCustomCss(css: string): void {
  localStorage.setItem(CUSTOM_CSS_KEY, css);
  applyCustomCss();
}

export function isCustomCssEnabled(): boolean {
  return localStorage.getItem(CUSTOM_CSS_ENABLED_KEY) === "true";
}

export function setCustomCssEnabled(enabled: boolean): void {
  localStorage.setItem(CUSTOM_CSS_ENABLED_KEY, enabled.toString());
  applyCustomCss();
}

export function applyTypography(): void {
  const ui = loadUiFont();
  const code = loadCodeFont();

  let fontStyleEl = document.getElementById("shard-typography");
  if (!fontStyleEl) {
    fontStyleEl = document.createElement("style");
    fontStyleEl.id = "shard-typography";
    document.head.appendChild(fontStyleEl);
  }

  let uiFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', sans-serif";
  if (ui === "inter") uiFamily = "'Inter', -apple-system, sans-serif";
  if (ui === "cairo") uiFamily = "'Cairo', 'Segoe UI', Tahoma, sans-serif";
  if (ui === "system") uiFamily = "system-ui, -apple-system, sans-serif";

  let codeFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  if (code === "jetbrains") codeFamily = "'JetBrains Mono', Consolas, monospace";
  if (code === "fira") codeFamily = "'Fira Code', monospace";
  if (code === "consolas") codeFamily = "Consolas, 'Courier New', monospace";

  fontStyleEl.textContent = `
    body, html, input, button, select {
      font-family: ${uiFamily} !important;
    }
    .cm-editor, .cm-content, pre, code, kbd {
      font-family: ${codeFamily} !important;
    }
  `;
}

export function applyCustomCss(): void {
  const enabled = isCustomCssEnabled();
  const css = loadCustomCss();

  let styleEl = document.getElementById("shard-custom-css");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "shard-custom-css";
    document.head.appendChild(styleEl);
  }

  if (enabled && css.trim()) {
    styleEl.textContent = css;
  } else {
    styleEl.textContent = "";
  }
}
