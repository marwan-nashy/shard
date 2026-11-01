import React, { useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Code,
  Link2,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Table,
  Sigma,
  Minus,
  Maximize2,
  ChevronDown,
  Info,
  Lightbulb,
  AlertTriangle,
  Flame,
  HelpCircle,
  AlignRight,
  Mic,
  MicOff,
  Sparkles,
  History,
  GitFork,
  Printer,
  FileDown,
  Columns3,
  Radio,
} from "lucide-react";

import { FeatureFlags } from "../types";

interface FormattingToolbarProps {
  onApplyFormat: (type: string, arg?: string) => void;
  onInsertText?: (text: string) => void;
  wordCount: number;
  charCount: number;
  readingTimeMinutes: number;
  textDirection?: "auto" | "rtl" | "ltr";
  onToggleTextDirection?: () => void;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
  onOpenTemplates?: () => void;
  onOpenHistory?: () => void;
  onExportPdf?: () => void;
  onExportHtml?: () => void;
  features?: FeatureFlags;
  onOpenTableEditor?: () => void;
  onOpenAudioMemo?: () => void;
  onToggleKanban?: () => void;
  isKanban?: boolean;
}

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onApplyFormat,
  onInsertText,
  wordCount,
  charCount,
  readingTimeMinutes,
  textDirection,
  onToggleTextDirection,
  onToggleZenMode,
  isZenMode,
  onOpenTemplates,
  onOpenHistory,
  onExportPdf,
  onExportHtml,
  features,
  onOpenTableEditor,
  onOpenAudioMemo,
  onToggleKanban,
  isKanban = false,
}) => {
  const [calloutMenuOpen, setCalloutMenuOpen] = useState(false);
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const callouts = [
    { type: "NOTE", label: "Note", icon: Info, color: "text-accent-blue" },
    { type: "TIP", label: "Tip", icon: Lightbulb, color: "text-accent-green" },
    { type: "WARNING", label: "Warning", icon: AlertTriangle, color: "text-accent-orange" },
    { type: "CAUTION", label: "Caution", icon: Flame, color: "text-accent-red" },
    { type: "EXAMPLE", label: "Example", icon: HelpCircle, color: "text-accent-purple" },
  ];

  // Speech-to-Text Voice Dictation (English & Arabic support)
  const toggleDictation = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      alert("Speech recognition is not supported in this browser or environment.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = textDirection === "rtl" ? "ar-EG" : "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && onInsertText) {
          onInsertText(` ${transcript} `);
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="h-9 bg-bg-secondary/90 backdrop-blur-sm border-b border-border-subtle flex items-center justify-between px-3 text-xs select-none shrink-0 z-10 overflow-x-auto no-scrollbar gap-2">
      {/* Left Formatting Action Group */}
      <div className="flex items-center gap-0.5">
        {/* Headings dropdown */}
        <div className="relative">
          <button
            onClick={() => setHeadingMenuOpen(!headingMenuOpen)}
            className="px-2 py-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover flex items-center gap-1 font-semibold text-[11px]"
            title="Headings"
          >
            <span>H</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {headingMenuOpen && (
            <div
              className="absolute top-full left-0 mt-1 w-32 bg-bg-card border border-border-subtle rounded-md shadow-2xl py-1 z-50 animate-in fade-in duration-150"
              onClick={() => setHeadingMenuOpen(false)}
            >
              <button
                onClick={() => onApplyFormat("h1")}
                className="w-full text-left px-3 py-1 hover:bg-bg-hover text-text-primary font-bold text-sm flex items-center justify-between"
              >
                <span>Heading 1</span>
                <span className="text-[10px] text-text-faint font-mono">#</span>
              </button>
              <button
                onClick={() => onApplyFormat("h2")}
                className="w-full text-left px-3 py-1 hover:bg-bg-hover text-text-primary font-semibold text-xs flex items-center justify-between"
              >
                <span>Heading 2</span>
                <span className="text-[10px] text-text-faint font-mono">##</span>
              </button>
              <button
                onClick={() => onApplyFormat("h3")}
                className="w-full text-left px-3 py-1 hover:bg-bg-hover text-text-primary text-xs flex items-center justify-between"
              >
                <span>Heading 3</span>
                <span className="text-[10px] text-text-faint font-mono">###</span>
              </button>
              <button
                onClick={() => onApplyFormat("p")}
                className="w-full text-left px-3 py-1 hover:bg-bg-hover text-text-muted text-xs border-t border-border-subtle mt-0.5 pt-1"
              >
                Paragraph
              </button>
            </div>
          )}
        </div>

        <div className="w-[1px] h-4 bg-border-subtle mx-1" />

        {/* Inline styles */}
        <button
          onClick={() => onApplyFormat("bold")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onApplyFormat("italic")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onApplyFormat("strike")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Strikethrough (~~text~~)"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onApplyFormat("highlight")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Highlight (==text==)"
        >
          <Highlighter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onApplyFormat("code")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Inline Code (`code`)"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onApplyFormat("link")}
          className="p-1 rounded text-text-muted hover:text-accent-purple hover:bg-bg-hover"
          title="Wikilink (Ctrl+K or [[Note]])"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-border-subtle mx-1" />

        {/* Blocks & Lists */}
        <button
          onClick={() => onApplyFormat("task")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Task Checkbox (- [ ])"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onApplyFormat("bullet")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Bullet List (- item)"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onApplyFormat("number")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Numbered List (1. item)"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onApplyFormat("quote")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Blockquote (> quote)"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        {/* Callout dropdown */}
        <div className="relative">
          <button
            onClick={() => setCalloutMenuOpen(!calloutMenuOpen)}
            className="px-1.5 py-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover flex items-center gap-0.5"
            title="Obsidian Callouts (> [!NOTE])"
          >
            <Info className="w-3.5 h-3.5 text-accent-purple" />
            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
          </button>
          {calloutMenuOpen && (
            <div
              className="absolute top-full left-0 mt-1 w-36 bg-bg-card border border-border-subtle rounded-md shadow-2xl py-1 z-50 animate-in fade-in duration-150"
              onClick={() => setCalloutMenuOpen(false)}
            >
              <div className="px-2 py-0.5 text-[10px] text-text-faint font-semibold uppercase">
                Callouts
              </div>
              {callouts.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.type}
                    onClick={() => onApplyFormat("callout", c.type)}
                    className="w-full text-left px-2.5 py-1 hover:bg-bg-hover text-text-primary text-xs flex items-center gap-2 transition-colors"
                  >
                    <Icon className={`w-3.5 h-3.5 ${c.color}`} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {features?.tableEditor !== false && (
          <button
            onClick={() => {
              if (onOpenTableEditor) onOpenTableEditor();
              else onApplyFormat("table");
            }}
            className="p-1 rounded text-text-muted hover:text-accent-purple hover:bg-bg-hover"
            title="Interactive Table Editor"
          >
            <Table className="w-3.5 h-3.5" />
          </button>
        )}

        {features?.mathLatex !== false && (
          <button
            onClick={() => onApplyFormat("math")}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
            title="LaTeX Math Formula ($x$)"
          >
            <Sigma className="w-3.5 h-3.5" />
          </button>
        )}

        {features?.mermaidDiagrams !== false && (
          <button
            onClick={() => onApplyFormat("mermaid")}
            className="p-1 rounded text-text-muted hover:text-accent-purple hover:bg-bg-hover"
            title="Mermaid Diagram Flowchart"
          >
            <GitFork className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => onApplyFormat("divider")}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="Horizontal Rule (---)"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-border-subtle mx-1" />

        {/* Voice Dictation (Speech-to-Text) */}
        {features?.voiceDictation !== false && (
          <button
            onClick={toggleDictation}
            className={`p-1 rounded transition-all flex items-center gap-1 ${
              isListening
                ? "text-red-500 bg-red-500/15 animate-pulse shadow-xs"
                : "text-text-muted hover:text-accent-purple hover:bg-bg-hover"
            }`}
            title={
              isListening
                ? "Listening... Speak now (English or Arabic)"
                : "Voice Dictation (Speech to Text)"
            }
          >
            {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 opacity-80" />}
          </button>
        )}

        {/* Audio Memo Recorder Button */}
        {features?.audioRecorder !== false && onOpenAudioMemo && (
          <button
            onClick={onOpenAudioMemo}
            className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-bg-hover transition-colors"
            title="Record Voice Memo (.webm attachment)"
          >
            <Radio className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Smart Templates Button */}
        {features?.templates !== false && onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            className="p-1 rounded text-text-muted hover:text-accent-purple hover:bg-bg-hover"
            title="Insert Template (Meeting, Journal, Roadmap)"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Kanban Board View Toggle */}
        {features?.kanbanView !== false && onToggleKanban && (
          <button
            onClick={onToggleKanban}
            className={`p-1 rounded transition-colors ${
              isKanban
                ? "bg-accent-purple/20 text-accent-purple font-medium"
                : "text-text-muted hover:text-accent-purple hover:bg-bg-hover"
            }`}
            title={isKanban ? "Switch to Markdown Document" : "Switch to Kanban Board View"}
          >
            <Columns3 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Note Revision History */}
        {features?.versionHistory !== false && onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="p-1 rounded text-text-muted hover:text-accent-purple hover:bg-bg-hover"
            title="Note Version History (Timeline Snapshots)"
          >
            <History className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Export Dropdown */}
        {features?.documentExport !== false && (onExportPdf || onExportHtml) && (
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover flex items-center"
              title="Export Note (PDF / HTML)"
            >
              <FileDown className="w-3.5 h-3.5" />
            </button>
            {exportMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-36 bg-bg-card border border-border-subtle rounded-md shadow-2xl py-1 z-50 animate-in fade-in duration-150"
                onClick={() => setExportMenuOpen(false)}
              >
                {onExportPdf && (
                  <button
                    onClick={onExportPdf}
                    className="w-full text-left px-3 py-1 hover:bg-bg-hover text-text-primary text-xs flex items-center gap-2"
                  >
                    <Printer className="w-3 h-3 text-accent-blue" />
                    <span>Print to PDF</span>
                  </button>
                )}
                {onExportHtml && (
                  <button
                    onClick={onExportHtml}
                    className="w-full text-left px-3 py-1 hover:bg-bg-hover text-text-primary text-xs flex items-center gap-2"
                  >
                    <FileDown className="w-3 h-3 text-accent-emerald" />
                    <span>Export HTML</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Stats & Zen Mode Group */}
      <div className="flex items-center gap-3 shrink-0 text-text-faint text-[11px] font-mono">
        {onToggleTextDirection && (
          <button
            onClick={onToggleTextDirection}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
              textDirection === "rtl"
                ? "bg-accent-purple/20 text-accent-purple border-accent-purple/40"
                : "text-text-muted border-border-subtle hover:bg-bg-hover hover:text-text-primary"
            }`}
            title="Toggle Text Direction (Ctrl+Shift+X)"
          >
            <span className="flex items-center gap-1">
              <AlignRight className="w-3 h-3" />
              <span>{textDirection?.toUpperCase() || "AUTO"}</span>
            </span>
          </button>
        )}

        {features?.statusBar !== false && (
          <div className="hidden sm:flex items-center gap-2">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} chars</span>
            <span>•</span>
            <span>{readingTimeMinutes} min read</span>
          </div>
        )}

        {onToggleZenMode && (
          <button
            onClick={onToggleZenMode}
            className={`p-1 rounded hover:bg-bg-hover transition-colors ${
              isZenMode ? "text-accent-purple bg-accent-purple/20" : "text-text-muted hover:text-text-primary"
            }`}
            title={isZenMode ? "Exit Zen Mode (Esc)" : "Enter Focus / Zen Mode (F11)"}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
