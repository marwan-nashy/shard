import React, { useState } from "react";
import { BacklinksData } from "../types";
import { Link2, ChevronRight, ChevronDown, FileText } from "lucide-react";

interface BacklinksPaneProps {
  currentTitle: string;
  data: BacklinksData;
  onNavigate: (title: string) => void;
}

export const BacklinksPane: React.FC<BacklinksPaneProps> = ({
  currentTitle,
  data,
  onNavigate,
}) => {
  const [showLinked, setShowLinked] = useState(true);
  const [showUnlinked, setShowUnlinked] = useState(true);

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none text-xs">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-text-faint uppercase">
          Backlinks for {currentTitle}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Linked Mentions */}
        <div>
          <button
            onClick={() => setShowLinked(!showLinked)}
            className="flex items-center gap-1.5 w-full text-left py-1 text-text-muted hover:text-text-primary font-medium"
          >
            {showLinked ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <Link2 className="w-3.5 h-3.5 text-accent-purple" />
            <span>Linked mentions</span>
            <span className="ml-auto text-[10px] text-text-faint px-1.5 py-0.2 rounded-full bg-bg-card">
              {data.linked_mentions.length}
            </span>
          </button>

          {showLinked && (
            <div className="mt-1 space-y-1 pl-2">
              {data.linked_mentions.length === 0 ? (
                <div className="text-[11px] text-text-faint py-1">
                  No linked mentions found.
                </div>
              ) : (
                data.linked_mentions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onNavigate(item.source_title)}
                    className="p-1.5 rounded bg-bg-card/50 hover:bg-bg-card cursor-pointer border border-transparent hover:border-border-subtle transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-text-primary font-medium">
                      <FileText className="w-3 h-3 text-accent-purple" />
                      <span>{item.source_title}</span>
                      <span className="ml-auto text-[10px] text-text-faint">
                        line {item.line_number}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-1 italic truncate">
                      "{item.snippet}"
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Unlinked Mentions */}
        <div>
          <button
            onClick={() => setShowUnlinked(!showUnlinked)}
            className="flex items-center gap-1.5 w-full text-left py-1 text-text-muted hover:text-text-primary font-medium"
          >
            {showUnlinked ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>Unlinked mentions</span>
            <span className="ml-auto text-[10px] text-text-faint px-1.5 py-0.2 rounded-full bg-bg-card">
              {data.unlinked_mentions.length}
            </span>
          </button>

          {showUnlinked && (
            <div className="mt-1 space-y-1 pl-2">
              {data.unlinked_mentions.length === 0 ? (
                <div className="text-[11px] text-text-faint py-1">
                  No unlinked mentions found.
                </div>
              ) : (
                data.unlinked_mentions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onNavigate(item.source_title)}
                    className="p-1.5 rounded bg-bg-card/50 hover:bg-bg-card cursor-pointer border border-transparent hover:border-border-subtle transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-text-primary font-medium">
                      <FileText className="w-3 h-3 text-text-muted" />
                      <span>{item.source_title}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-1 italic truncate">
                      "{item.snippet}"
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
