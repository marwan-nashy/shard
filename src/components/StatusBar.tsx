import React from "react";

interface StatusBarProps {
  status: string;
  activePath: string | null;
  content: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  activePath,
  content,
}) => {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;

  return (
    <div className="h-6 bg-bg-secondary border-t border-border-subtle flex items-center justify-between px-3 text-[11px] text-text-faint select-none z-10">
      <div className="flex items-center gap-2 truncate max-w-[60%]">
        <span>{status || (activePath ? activePath : "Shard")}</span>
      </div>

      <div className="flex items-center gap-3">
        <span>
          {words} {words === 1 ? "word" : "words"}, {chars} characters
        </span>
        <span className="text-border-subtle">|</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
};
