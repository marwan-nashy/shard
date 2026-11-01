import React, { useEffect, useRef, useMemo } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown } from "@codemirror/lang-markdown";
import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import katex from "katex";
import mermaid from "mermaid";
import { ViewMode, FeatureFlags } from "../types";
import { FormattingToolbar } from "./FormattingToolbar";

export interface EditorProps {
  content: string;
  onChange: (val: string) => void;
  onSave: () => void;
  viewMode: ViewMode;
  allNoteTitles: string[];
  onNavigateToNote: (title: string, heading?: string) => void;
  targetHeading?: string | null;
  textDirection?: "auto" | "rtl" | "ltr";
  onToggleTextDirection?: () => void;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
  onOpenTemplates?: () => void;
  onOpenHistory?: () => void;
  onExportPdf?: () => void;
  onExportHtml?: () => void;
  features?: FeatureFlags;
}

// Mermaid diagram initialization
let mermaidInitialized = false;
function ensureMermaidInitialized() {
  if (!mermaidInitialized) {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        fontFamily: "inherit",
      });
      mermaidInitialized = true;
    } catch {}
  }
}

// Widget for rendering Mermaid diagrams in Live Preview
class MermaidWidget extends WidgetType {
  constructor(readonly code: string, readonly id: string) {
    super();
  }

  eq(other: MermaidWidget) {
    return other.code === this.code;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className =
      "cm-mermaid-diagram my-3 p-3 rounded-lg bg-bg-card/60 border border-border-subtle flex flex-col items-center justify-center overflow-x-auto select-none";
    wrap.dir = "ltr";

    const loading = document.createElement("div");
    loading.className = "text-[11px] text-text-faint py-2 animate-pulse";
    loading.textContent = "Rendering diagram...";
    wrap.appendChild(loading);

    ensureMermaidInitialized();

    const uniqueId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
    mermaid
      .render(uniqueId, this.code.trim())
      .then(({ svg }) => {
        wrap.innerHTML = svg;
      })
      .catch((err) => {
        wrap.innerHTML = `<div class="text-xs text-accent-orange p-2 font-mono">Mermaid Syntax Error: ${err?.message || "Invalid diagram syntax"}</div><pre class="text-[10px] text-text-faint font-mono whitespace-pre">${this.code}</pre>`;
      });

    return wrap;
  }
}

// Widget for interactive checkbox toggling
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "inline-flex items-center align-middle mx-1.5 cursor-pointer";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    box.className =
      "w-4 h-4 rounded border border-neutral-600 bg-bg-card accent-accent-purple cursor-pointer";
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      const newChar = this.checked ? " " : "x";
      view.dispatch({
        changes: { from: this.pos + 3, to: this.pos + 4, insert: newChar },
      });
    });
    wrap.appendChild(box);
    return wrap;
  }
}

// Widget for LaTeX Math rendering (KaTeX)
class MathWidget extends WidgetType {
  constructor(readonly math: string, readonly isBlock: boolean) {
    super();
  }

  toDOM(): HTMLElement {
    const el = document.createElement(this.isBlock ? "div" : "span");
    el.className = this.isBlock
      ? "cm-math-block my-2 p-2 rounded bg-bg-card/40 border border-border-subtle text-center overflow-x-auto select-none"
      : "cm-math-inline px-1 py-0.5 rounded bg-bg-card/40 text-accent-purple select-none inline-block";
    el.dir = "ltr";
    try {
      el.innerHTML = katex.renderToString(this.math, {
        displayMode: this.isBlock,
        throwOnError: false,
      });
    } catch {
      el.textContent = this.math;
    }
    return el;
  }
}

// Widget for Callout badges (Obsidian style)
class CalloutBadgeWidget extends WidgetType {
  constructor(readonly type: string, readonly titleText: string) {
    super();
  }

  toDOM(): HTMLElement {
    const bar = document.createElement("div");
    const t = this.type.toLowerCase();
    bar.className = `cm-callout-badge cm-callout-badge-${t} flex items-center gap-1.5 font-semibold text-xs py-1 px-2 rounded mb-1 select-none`;

    const iconSpan = document.createElement("span");
    iconSpan.className = "text-sm";
    const iconsMap: Record<string, string> = {
      note: "ℹ️",
      info: "ℹ️",
      tip: "💡",
      warning: "⚠️",
      caution: "🔥",
      important: "❗",
      example: "📌",
    };
    iconSpan.textContent = iconsMap[t] || "📝";
    bar.appendChild(iconSpan);

    const titleSpan = document.createElement("span");
    titleSpan.className = "capitalize tracking-wide font-medium";
    titleSpan.textContent = this.titleText || this.type;
    bar.appendChild(titleSpan);

    return bar;
  }
}

// Widget for code block header with copy button
class CodeBlockHeaderWidget extends WidgetType {
  constructor(readonly lang: string, readonly getCode: () => string) {
    super();
  }

  toDOM(): HTMLElement {
    const bar = document.createElement("div");
    bar.dir = "ltr";
    bar.className =
      "flex items-center justify-between px-3 py-1 bg-[#141414] border border-[#2e2e2e] rounded-t text-[11px] text-[#888] font-mono select-none -mb-[1px]";

    const langSpan = document.createElement("span");
    langSpan.className = "uppercase font-semibold tracking-wider text-[10px] text-accent-purple";
    langSpan.textContent = this.lang || "CODE";
    bar.appendChild(langSpan);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "px-2 py-0.5 rounded text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] hover:text-white transition-colors cursor-pointer border border-[#383838]";
    btn.textContent = "Copy";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const code = this.getCode();
      navigator.clipboard.writeText(code);
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1500);
    });
    bar.appendChild(btn);

    return bar;
  }
}

// Wrap selected text with prefix and suffix
function wrapSelection(view: EditorView, prefix: string, suffix: string): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (
    selected.startsWith(prefix) &&
    selected.endsWith(suffix) &&
    selected.length >= prefix.length + suffix.length
  ) {
    const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
    view.dispatch({
      changes: { from, to, insert: unwrapped },
      selection: { anchor: from, head: from + unwrapped.length },
    });
  } else {
    const wrapped = `${prefix}${selected}${suffix}`;
    view.dispatch({
      changes: { from, to, insert: wrapped },
      selection: {
        anchor: from + prefix.length,
        head: from + prefix.length + selected.length,
      },
    });
  }
  return true;
}

// Live Preview Markdown Decorations Plugin
function livePreviewPlugin(
  onNavigate: (title: string, heading?: string) => void,
  features?: FeatureFlags
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const widgets: any[] = [];
        const { state } = view;

        let inCodeBlock = false;
        let codeBlockLang = "";
        let codeBlockStartLine = 0;

        const getCodeSnippet = (startLineNum: number) => {
          const lines: string[] = [];
          for (let ln = startLineNum + 1; ln <= state.doc.lines; ln++) {
            const l = state.doc.line(ln);
            if (l.text.trim().startsWith("```")) break;
            lines.push(l.text);
          }
          return lines.join("\n");
        };

        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos < to) {
            const line = state.doc.lineAt(pos);
            const text = line.text;
            const lineStart = line.from;

            // Check code block fences
            const codeBlockMatch = text.match(/^```(\w*)/);
            if (codeBlockMatch) {
              if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = codeBlockMatch[1] || "";
                codeBlockStartLine = line.number;
                widgets.push(
                  Decoration.widget({
                    widget: new CodeBlockHeaderWidget(codeBlockLang, () =>
                      getCodeSnippet(line.number)
                    ),
                    side: -1,
                  }).range(lineStart)
                );
                widgets.push(
                  Decoration.line({ class: "cm-codeblock-line" }).range(lineStart)
                );
              } else {
                inCodeBlock = false;
                widgets.push(
                  Decoration.line({ class: "cm-codeblock-line rounded-b mb-2" }).range(
                    lineStart
                  )
                );

                // If this is a Mermaid diagram block, render the MermaidWidget
                if (
                  features?.mermaidDiagrams !== false &&
                  codeBlockLang.toLowerCase() === "mermaid"
                ) {
                  const mCode = getCodeSnippet(codeBlockStartLine);
                  if (mCode.trim()) {
                    widgets.push(
                      Decoration.widget({
                        widget: new MermaidWidget(mCode, `mm-${codeBlockStartLine}`),
                        side: 1,
                      }).range(line.to)
                    );
                  }
                }
              }
              pos = line.to + 1;
              continue;
            }

            if (inCodeBlock) {
              widgets.push(
                Decoration.line({ class: "cm-codeblock-line" }).range(lineStart)
              );
              pos = line.to + 1;
              continue;
            }

            // 1. Headers
            if (text.startsWith("# ")) {
              widgets.push(
                Decoration.line({ class: "cm-header-1" }).range(lineStart)
              );
            } else if (text.startsWith("## ")) {
              widgets.push(
                Decoration.line({ class: "cm-header-2" }).range(lineStart)
              );
            } else if (text.startsWith("### ")) {
              widgets.push(
                Decoration.line({ class: "cm-header-3" }).range(lineStart)
              );
            }

            // 2. Interactive Checklists (- [ ] / - [x])
            const taskMatch = text.match(/^(\s*[-*]\s+)\[([ xX])\]/);
            if (taskMatch) {
              const checked = taskMatch[2].toLowerCase() === "x";
              const matchStart = lineStart + taskMatch[1].length - 1;
              widgets.push(
                Decoration.widget({
                  widget: new CheckboxWidget(checked, lineStart + taskMatch[1].length - 1),
                  side: 1,
                }).range(matchStart)
              );
            }

            // 3. Callout blocks (> [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT], > [!CAUTION])
            const calloutMatch = text.match(/^>\s*\[!(NOTE|WARNING|TIP|INFO|CAUTION|IMPORTANT|EXAMPLE)\]\s*(.*)/i);
            if (calloutMatch) {
              const type = calloutMatch[1].toLowerCase();
              const titleText = calloutMatch[2].trim();
              widgets.push(
                Decoration.widget({
                  widget: new CalloutBadgeWidget(type, titleText),
                  side: -1,
                }).range(lineStart)
              );
              widgets.push(
                Decoration.line({
                  class: `cm-callout cm-callout-${type}`,
                }).range(lineStart)
              );
            } else if (text.startsWith("> ")) {
              widgets.push(
                Decoration.line({ class: "cm-blockquote-line" }).range(lineStart)
              );
            }

            // 4. Wikilinks [[Note Title#Section|Alias]]
            let wikiIdx = 0;
            while (true) {
              const start = text.indexOf("[[", wikiIdx);
              if (start === -1) break;
              const end = text.indexOf("]]", start + 2);
              if (end === -1) break;

              const rawLink = text.slice(start + 2, end);
              const pipeParts = rawLink.split("|");
              const linkTarget = pipeParts[0].trim();

              const hashParts = linkTarget.split("#");
              const noteTitle = hashParts[0].trim();
              const heading = hashParts.length > 1 ? hashParts[1].trim() : undefined;

              const rangeFrom = lineStart + start;
              const rangeTo = lineStart + end + 2;

              widgets.push(
                Decoration.mark({
                  class: "cm-wikilink",
                  attributes: {
                    "data-wikilink": noteTitle,
                    ...(heading ? { "data-heading": heading } : {}),
                    title: heading ? `${noteTitle} > ${heading}` : noteTitle,
                  },
                }).range(rangeFrom, rangeTo)
              );
              wikiIdx = end + 2;
            }

            // 5. Bold **text**
            const boldRegex = /\*\*([^*]+)\*\*/g;
            let boldMatch;
            while ((boldMatch = boldRegex.exec(text)) !== null) {
              widgets.push(
                Decoration.mark({ class: "cm-bold" }).range(
                  lineStart + boldMatch.index,
                  lineStart + boldMatch.index + boldMatch[0].length
                )
              );
            }

            // 6. Italic *text*
            const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g;
            let italicMatch;
            while ((italicMatch = italicRegex.exec(text)) !== null) {
              widgets.push(
                Decoration.mark({ class: "cm-italic" }).range(
                  lineStart + italicMatch.index,
                  lineStart + italicMatch.index + italicMatch[0].length
                )
              );
            }

            // 7. Strikethrough ~~text~~
            const strikeRegex = /~~([^~]+)~~/g;
            let strikeMatch;
            while ((strikeMatch = strikeRegex.exec(text)) !== null) {
              widgets.push(
                Decoration.mark({ class: "cm-strikethrough" }).range(
                  lineStart + strikeMatch.index,
                  lineStart + strikeMatch.index + strikeMatch[0].length
                )
              );
            }

            // 8. Highlight ==text==
            const highlightRegex = /==([^=]+)==/g;
            let hlMatch;
            while ((hlMatch = highlightRegex.exec(text)) !== null) {
              widgets.push(
                Decoration.mark({ class: "cm-highlight" }).range(
                  lineStart + hlMatch.index,
                  lineStart + hlMatch.index + hlMatch[0].length
                )
              );
            }

            // 9. Inline Math $x$
            if (features?.mathLatex !== false) {
              const mathInlineRegex = /(?<!\$)\$([^\$\n]+)\$(?!\$)/g;
              let mathMatch;
              while ((mathMatch = mathInlineRegex.exec(text)) !== null) {
                const formula = mathMatch[1];
                widgets.push(
                  Decoration.widget({
                    widget: new MathWidget(formula, false),
                    side: 1,
                  }).range(lineStart + mathMatch.index + mathMatch[0].length)
                );
              }
            }

            pos = line.to + 1;
          }
        }

        return Decoration.set(
          widgets.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
        );
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        click: (e) => {
          const target = (e.target as HTMLElement).closest(".cm-wikilink");
          if (target) {
            const link = target.getAttribute("data-wikilink");
            const heading = target.getAttribute("data-heading") || undefined;
            if (link) {
              onNavigate(link, heading);
            }
          }
        },
      },
    }
  );
}

export const Editor: React.FC<EditorProps> = ({
  content,
  onChange,
  onSave,
  viewMode,
  allNoteTitles,
  onNavigateToNote,
  targetHeading,
  textDirection = "auto",
  onToggleTextDirection,
  onToggleZenMode,
  isZenMode,
  onOpenTemplates,
  onOpenHistory,
  onExportPdf,
  onExportHtml,
  features,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Live Stats
  const wordCount = useMemo(() => {
    const trimmed = content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [content]);

  const charCount = content.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  // Slash commands completion (/)
  const slashCommandsCompletion = (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos);
    const textBefore = line.text.slice(0, context.pos - line.from);

    const slashMatch = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9]*)$/);
    if (!slashMatch) return null;

    const start = line.from + textBefore.length - slashMatch[1].length - 1;

    const commands = [
      { label: "/h1", detail: "Heading 1", apply: "# " },
      { label: "/h2", detail: "Heading 2", apply: "## " },
      { label: "/h3", detail: "Heading 3", apply: "### " },
      { label: "/todo", detail: "Task Checkbox", apply: "- [ ] " },
      { label: "/bullet", detail: "Bulleted List", apply: "- " },
      { label: "/number", detail: "Numbered List", apply: "1. " },
      { label: "/quote", detail: "Blockquote", apply: "> " },
      { label: "/callout", detail: "Note Callout", apply: "> [!NOTE]\n> Note content here\n" },
      { label: "/tip", detail: "Tip Callout", apply: "> [!TIP]\n> Useful tip here\n" },
      { label: "/warning", detail: "Warning Callout", apply: "> [!WARNING]\n> Warning alert here\n" },
      { label: "/code", detail: "Code Block", apply: "```javascript\n\n```" },
      { label: "/table", detail: "Markdown Table", apply: "\n| Column 1 | Column 2 |\n| :--- | :--- |\n| Item 1 | Item 2 |\n" },
      { label: "/math", detail: "LaTeX Math Block", apply: "\n$$\nE = mc^2\n$$\n" },
      { label: "/mermaid", detail: "Mermaid Diagram", apply: "\n```mermaid\nflowchart TD\n    A[Start] --> B(Step)\n    B --> C[Done]\n```\n" },
      { label: "/footnote", detail: "Footnote Link", apply: "[^1]\n\n[^1]: Details here\n" },
      { label: "/divider", detail: "Horizontal Rule", apply: "\n---\n" },
    ];

    return {
      from: start,
      options: commands.map((c) => ({
        label: c.label,
        detail: c.detail,
        apply: c.apply,
        type: "keyword",
      })),
    };
  };

  // Wikilinks Autocompletion on [[
  const wikilinkCompletion = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\[\[([^\]]*)/);
    if (!word) return null;

    const query = word.text.slice(2).toLowerCase();
    const options = allNoteTitles
      .filter((title) => title.toLowerCase().includes(query))
      .map((title) => ({
        label: title,
        type: "text",
        apply: `[[${title}]]`,
      }));

    return {
      from: word.from,
      options,
    };
  };

  // Insert arbitrary text at cursor (used by templates & voice dictation)
  const handleInsertText = (text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  };

  // Formatting Toolbar Action Handler
  const handleApplyFormat = (type: string, arg?: string) => {
    const view = viewRef.current;
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const line = state.doc.lineAt(from);

    switch (type) {
      case "bold":
        wrapSelection(view, "**", "**");
        break;
      case "italic":
        wrapSelection(view, "*", "*");
        break;
      case "strike":
        wrapSelection(view, "~~", "~~");
        break;
      case "highlight":
        wrapSelection(view, "==", "==");
        break;
      case "code":
        wrapSelection(view, "`", "`");
        break;
      case "link":
        wrapSelection(view, "[[", "]]");
        break;
      case "math":
        wrapSelection(view, "$", "$");
        break;
      case "mermaid": {
        const diagram = `\n\`\`\`mermaid\nflowchart TD\n    A[Start] --> B(Process)\n    B --> C{Decision}\n    C -->|Yes| D[Done]\n    C -->|No| B\n\`\`\`\n`;
        view.dispatch({
          changes: { from, to, insert: diagram },
          selection: { anchor: from + diagram.length },
        });
        break;
      }
      case "h1":
      case "h2":
      case "h3":
      case "p": {
        const prefix = type === "h1" ? "# " : type === "h2" ? "## " : type === "h3" ? "### " : "";
        const cleanText = line.text.replace(/^#+\s*/, "");
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: `${prefix}${cleanText}` },
        });
        break;
      }
      case "task": {
        const hasTask = line.text.match(/^(\s*[-*]\s+)\[[ xX]\]/);
        if (hasTask) {
          view.dispatch({
            changes: {
              from: line.from,
              to: line.to,
              insert: line.text.replace(/^(\s*[-*]\s+)\[[ xX]\]\s*/, ""),
            },
          });
        } else {
          view.dispatch({
            changes: { from: line.from, to: line.from, insert: "- [ ] " },
          });
        }
        break;
      }
      case "bullet":
        view.dispatch({
          changes: { from: line.from, to: line.from, insert: "- " },
        });
        break;
      case "number":
        view.dispatch({
          changes: { from: line.from, to: line.from, insert: "1. " },
        });
        break;
      case "quote":
        view.dispatch({
          changes: { from: line.from, to: line.from, insert: "> " },
        });
        break;
      case "callout": {
        const calloutType = arg || "NOTE";
        const template = `> [!${calloutType}]\n> Note content here\n`;
        view.dispatch({
          changes: { from, to, insert: template },
          selection: { anchor: from + template.length },
        });
        break;
      }
      case "table": {
        const table = `\n| Column 1 | Column 2 |\n| :--- | :--- |\n| Item 1 | Item 2 |\n`;
        view.dispatch({
          changes: { from, to, insert: table },
          selection: { anchor: from + table.length },
        });
        break;
      }
      case "divider": {
        view.dispatch({
          changes: { from, to, insert: `\n---\n` },
          selection: { anchor: from + 5 },
        });
        break;
      }
    }
    view.focus();
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      history(),
      search({ top: true }),
      highlightSelectionMatches(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        {
          key: "Mod-s",
          run: () => {
            onSave();
            return true;
          },
        },
        {
          key: "Mod-b",
          run: (v) => wrapSelection(v, "**", "**"),
        },
        {
          key: "Mod-i",
          run: (v) => wrapSelection(v, "*", "*"),
        },
        {
          key: "Mod-k",
          run: (v) => wrapSelection(v, "[[", "]]"),
        },
        {
          key: "Mod-Shift-x",
          run: () => {
            if (onToggleTextDirection) {
              onToggleTextDirection();
              return true;
            }
            return false;
          },
        },
        {
          key: "F11",
          run: () => {
            if (onToggleZenMode) {
              onToggleZenMode();
              return true;
            }
            return false;
          },
        },
        {
          key: "Escape",
          run: () => {
            if (isZenMode && onToggleZenMode) {
              onToggleZenMode();
              return true;
            }
            return false;
          },
        },
      ]),
      markdown(),
      highlightActiveLine(),
      EditorView.perLineTextDirection.of(true),
      autocompletion({ override: [wikilinkCompletion, slashCommandsCompletion] }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": {
          backgroundColor: "var(--color-bg-primary, #1e1e1e)",
          color: "var(--color-text-primary, #dcddde)",
          height: "100%",
        },
        ".cm-gutters": {
          backgroundColor: "var(--color-bg-primary, #1e1e1e)",
          color: "var(--color-text-faint, #666666)",
          border: "none",
        },
        ".cm-tooltip": {
          backgroundColor: "var(--color-bg-card, #262626)",
          border: "1px solid var(--color-border-subtle, #383838)",
          borderRadius: "6px",
          color: "var(--color-text-primary, #dcddde)",
        },
        ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
          backgroundColor: "var(--color-accent-purple, #7b6cd9)",
          color: "#ffffff",
        },
      }),
    ];

    if (viewMode === "live") {
      extensions.push(livePreviewPlugin(onNavigateToNote, features));
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [viewMode]);

  // Sync external content update
  useEffect(() => {
    if (viewRef.current) {
      const currentDoc = viewRef.current.state.doc.toString();
      if (currentDoc !== content) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: content },
        });
      }
    }
  }, [content]);

  // Scroll to target heading
  useEffect(() => {
    if (!targetHeading || !viewRef.current) return;
    const view = viewRef.current;
    const doc = view.state.doc;
    const targetLower = targetHeading.toLowerCase();

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const text = line.text.trim();
      if (text.startsWith("#")) {
        const headingText = text.replace(/^#+\s*/, "").trim().toLowerCase();
        if (headingText === targetLower || headingText.includes(targetLower)) {
          view.dispatch({
            selection: { anchor: line.from },
            scrollIntoView: true,
          });
          break;
        }
      }
    }
  }, [targetHeading, content]);

  const dirClass =
    textDirection === "rtl"
      ? "editor-dir-rtl"
      : textDirection === "ltr"
      ? "editor-dir-ltr"
      : "editor-dir-auto";

  return (
    <div className={`w-full h-full overflow-hidden bg-bg-primary flex flex-col ${dirClass}`}>
      {/* Visual Formatting Toolbar */}
      {features?.formattingToolbar !== false && (
        <FormattingToolbar
          onApplyFormat={handleApplyFormat}
          onInsertText={handleInsertText}
          wordCount={wordCount}
          charCount={charCount}
          readingTimeMinutes={readingTimeMinutes}
          textDirection={textDirection}
          onToggleTextDirection={onToggleTextDirection}
          onToggleZenMode={onToggleZenMode}
          isZenMode={isZenMode}
          onOpenTemplates={onOpenTemplates}
          onOpenHistory={onOpenHistory}
          onExportPdf={onExportPdf}
          onExportHtml={onExportHtml}
          features={features}
        />
      )}

      {/* CodeMirror Scroller Container */}
      <div ref={containerRef} className="w-full h-full flex-1 overflow-hidden" />
    </div>
  );
};
