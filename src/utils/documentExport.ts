import katex from "katex";
import { ThemePreset } from "../types";

/**
 * Triggers standard browser print dialog which can save as clean PDF.
 * Styled via @media print in index.css.
 */
export function exportNoteToPdf(title?: string): void {
  const originalTitle = document.title;
  if (title) {
    document.title = `${title} - Shard`;
  }
  window.print();
  if (title) {
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }
}

/**
 * Converts simple markdown text to self-contained, beautifully styled HTML document.
 */
export function exportNoteToHtml(
  title: string,
  content: string,
  theme: ThemePreset = "shard"
): void {
  // 1. Process math first ($math$ and $$math$$)
  let processed = content;

  // Block math $$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      return `<div class="math-block" dir="ltr">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `<pre>$$${math}$$</pre>`;
    }
  });

  // Inline math $...$
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return `<span class="math-inline" dir="ltr">${katex.renderToString(math.trim(), { displayMode: false, throwOnError: false })}</span>`;
    } catch {
      return `<code>$${math}$</code>`;
    }
  });

  // 2. Callouts [!NOTE], [!TIP], etc.
  processed = processed.replace(
    /^>\s*\[!([a-zA-Z]+)\]\s*(.*)$/gm,
    (_, type, titleText) => {
      const calloutType = type.toLowerCase();
      const titleClean = titleText ? ` - ${titleText}` : "";
      return `<div class="callout callout-${calloutType}"><div class="callout-title">${calloutType.toUpperCase()}${titleClean}</div>`;
    }
  );

  // 3. Headers, bold, italic, strikethrough, highlights
  processed = processed
    .replace(/^###### (.*$)/gim, "<h6>$1</h6>")
    .replace(/^##### (.*$)/gim, "<h5>$1</h5>")
    .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/==([^=]+)==/g, "<mark>$1</mark>")
    .replace(/\~\~([^\~]+)\~\~/g, "<del>$1</del>")
    .replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^\*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '<span class="wikilink">[[ $1 ]]</span>')
    .replace(/^- \[x\] (.*$)/gim, '<div class="task-item checked"><input type="checkbox" checked disabled> <span>$1</span></div>')
    .replace(/^- \[ \] (.*$)/gim, '<div class="task-item"><input type="checkbox" disabled> <span>$1</span></div>')
    .replace(/^- (.*$)/gim, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>");

  // Close opened callouts if any
  const openCallouts = (processed.match(/<div class="callout/g) || []).length;
  for (let i = 0; i < openCallouts; i++) {
    processed += "</div>";
  }

  const bgColor =
    theme === "oled"
      ? "#000000"
      : theme === "catppuccin"
      ? "#1e1e2e"
      : theme === "nord"
      ? "#2e3440"
      : theme === "paper"
      ? "#fbf7ee"
      : "#0f1117";
  const textColor = theme === "paper" ? "#2d2a24" : "#e2e8f0";
  const accentColor = theme === "paper" ? "#8f4426" : "#7c5cfc";
  const cardColor = theme === "paper" ? "#f2ecd9" : "#181b26";
  const borderColor = theme === "paper" ? "#e4dbc5" : "rgba(255,255,255,0.08)";

  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Shard Export</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
  <style>
    :root {
      --bg: ${bgColor};
      --text: ${textColor};
      --accent: ${accentColor};
      --card: ${cardColor};
      --border: ${borderColor};
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Noto Sans Arabic", sans-serif;
      line-height: 1.7;
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--text);
      font-weight: 700;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.3;
    }
    h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    code {
      background: var(--card);
      border: 1px solid var(--border);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.88em;
    }
    mark {
      background: rgba(234, 179, 8, 0.28);
      color: inherit;
      padding: 0.1em 0.3em;
      border-radius: 3px;
    }
    del { opacity: 0.6; }
    .wikilink {
      color: var(--accent);
      text-decoration: underline;
      text-underline-offset: 3px;
      font-weight: 500;
    }
    .callout {
      border-left: 4px solid var(--accent);
      background: var(--card);
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
    }
    .callout-title {
      font-weight: 700;
      font-size: 0.85em;
      margin-bottom: 6px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .callout-warning { border-left-color: #f59e0b; }
    .callout-caution { border-left-color: #ef4444; }
    .callout-tip { border-left-color: #10b981; }
    .task-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0;
    }
    .task-item.checked span {
      text-decoration: line-through;
      opacity: 0.6;
    }
    .math-block {
      text-align: center;
      margin: 20px 0;
      overflow-x: auto;
    }
    .export-footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      font-size: 0.8em;
      opacity: 0.6;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { background: #ffffff !important; color: #000000 !important; max-width: 100%; padding: 0; }
      .export-footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="note-content">
    <p>${processed}</p>
  </div>
  <div class="export-footer">
    <span>Exported from <strong>Shard</strong></span>
    <span>${new Date().toLocaleDateString()}</span>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]/g, "_") || "Note"}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
