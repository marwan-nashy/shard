import React, { useEffect, useRef } from "react";
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
import { ViewMode } from "../types";

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

// Wrap selected text with prefix and suffix (e.g. bold, italic, wikilink)
function wrapSelection(view: EditorView, prefix: string, suffix: string): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (
    selected.startsWith(prefix) &&
    selected.endsWith(suffix) &&
    selected.length >= prefix.length + suffix.length
  ) {
    // Unwrap
    const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
    view.dispatch({
      changes: { from, to, insert: unwrapped },
      selection: { anchor: from, head: from + unwrapped.length },
    });
  } else {
    // Wrap
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
function livePreviewPlugin(onNavigate: (title: string, heading?: string) => void) {
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
                // Opening fence
                inCodeBlock = true;
                codeBlockLang = codeBlockMatch[1] || "";
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
                // Closing fence
                inCodeBlock = false;
                widgets.push(
                  Decoration.line({ class: "cm-codeblock-line rounded-b mb-2" }).range(
                    lineStart
                  )
                );
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

            // 3. Callout blocks (> [!NOTE], > [!WARNING], > [!TIP], > [!INFO], > [!CAUTION])
            const calloutMatch = text.match(/^>\s*\[!(NOTE|WARNING|TIP|INFO|CAUTION)\]\s*(.*)/i);
            if (calloutMatch) {
              const type = calloutMatch[1].toLowerCase();
              widgets.push(
                Decoration.line({
                  class: `cm-callout ${
                    type === "warning" || type === "caution"
                      ? "cm-callout-warning"
                      : type === "tip"
                      ? "cm-callout-tip"
                      : ""
                  }`,
                }).range(lineStart)
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

            // 8. Inline code `code`
            const codeRegex = /`([^`]+)`/g;
            let codeMatch;
            while ((codeMatch = codeRegex.exec(text)) !== null) {
              widgets.push(
                Decoration.mark({ class: "cm-inline-code" }).range(
                  lineStart + codeMatch.index,
                  lineStart + codeMatch.index + codeMatch[0].length
                )
              );
            }

            // 9. Math equations $math$ and $$block math$$
            const mathRegex = /\$([^$]+)\$/g;
            let mathMatch;
            while ((mathMatch = mathRegex.exec(text)) !== null) {
              widgets.push(
                Decoration.mark({ class: "cm-math-inline" }).range(
                  lineStart + mathMatch.index,
                  lineStart + mathMatch.index + mathMatch[0].length
                )
              );
            }

            pos = line.to + 1;
          }
        }

        // Sort decorations strictly by range
        widgets.sort((a, b) => a.from - b.from);
        return Decoration.set(widgets);
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

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
      ]),
      markdown(),
      highlightActiveLine(),
      EditorView.perLineTextDirection.of(true),
      autocompletion({ override: [wikilinkCompletion] }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": {
          backgroundColor: "#1e1e1e",
          color: "#dcddde",
          height: "100%",
        },
        ".cm-gutters": {
          backgroundColor: "#1e1e1e",
          color: "#666666",
          border: "none",
        },
        ".cm-tooltip": {
          backgroundColor: "#262626",
          border: "1px solid #383838",
          borderRadius: "6px",
          color: "#dcddde",
        },
        ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
          backgroundColor: "#3b3857",
          color: "#ffffff",
        },
      }),
    ];

    if (viewMode === "live") {
      extensions.push(livePreviewPlugin(onNavigateToNote));
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

  // Sync external content update if doc changed from outside (e.g. switching notes)
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

  // Scroll to target heading if specified
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
      <div ref={containerRef} className="w-full h-full flex-1" />
    </div>
  );
};
