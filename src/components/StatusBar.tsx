import React from "react";
import { Translations, TextDirection } from "../i18n";

interface StatusBarProps {
  status: string;
  activePath: string | null;
  content: string;
  t?: Translations["statusBar"];
  textDirection?: TextDirection;
  onToggleTextDirection?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  activePath,
  content,
  t,
  textDirection = "auto",
  onToggleTextDirection,
}) => {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const wordLabel = words === 1 ? (t?.word || "word") : (t?.words || "words");
  const charLabel = t?.characters || "characters";

  return (
    <div className="h-6 bg-bg-secondary border-t border-border-subtle flex items-center justify-between px-3 text-[11px] text-text-faint select-none z-10">
      <div className="flex items-center gap-2 truncate max-w-[60%]">
        <span dir="auto">{status || (activePath ? activePath : "Shard")}</span>
      </div>

      <div className="flex items-center gap-3">
        <span>
          {words} {wordLabel}, {chars} {charLabel}
        </span>
        <span className="text-border-subtle">|</span>
        <button
          onClick={onToggleTextDirection}
          className="hover:text-text-primary transition-colors cursor-pointer uppercase font-mono px-1 rounded hover:bg-bg-hover"
          title="Toggle Text Direction (Auto / RTL / LTR) [Ctrl+Shift+X]"
        >
          {textDirection.toUpperCase()}
        </button>
        <span className="text-border-subtle">|</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
};
