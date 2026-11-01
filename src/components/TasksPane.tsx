import React, { useState, useEffect, useMemo } from "react";
import { CheckSquare, Square, CheckCircle2, Search, RefreshCw, FileText, ExternalLink, Download } from "lucide-react";
import { TaskItem } from "../types";
import { appInvoke as invoke } from "../backend";
import { generateTasksIcs, downloadIcsFile } from "../utils/icsExport";

interface TasksPaneProps {
  allNotes: { title: string; path: string }[];
  onNavigateToNote: (path: string) => void;
  activePath?: string | null;
  activeContent?: string;
  onUpdateNoteContent?: (path: string, newContent: string) => void;
}

export const TasksPane: React.FC<TasksPaneProps> = ({
  allNotes,
  onNavigateToNote,
  activePath,
  activeContent,
  onUpdateNoteContent,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"pending" | "completed" | "all">("pending");
  const [query, setQuery] = useState("");

  const scanAllTasks = async () => {
    setLoading(true);
    const collected: TaskItem[] = [];

    for (const note of allNotes) {
      if (note.path.endsWith(".canvas")) continue;
      try {
        let content = "";
        if (activePath && note.path === activePath && activeContent !== undefined) {
          content = activeContent;
        } else {
          content = await invoke<string>("read_file_content", { filePath: note.path });
        }

        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          const match = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
          if (match) {
            const completed = match[2].toLowerCase() === "x";
            const text = match[3].trim();
            if (text) {
              collected.push({
                id: `${note.path}::L${idx + 1}`,
                path: note.path,
                noteTitle: note.title,
                line: idx + 1,
                text,
                completed,
              });
            }
          }
        });
      } catch (err) {
        console.error("Failed to read note for tasks scan:", note.path, err);
      }
    }

    setTasks(collected);
    setLoading(false);
  };

  useEffect(() => {
    scanAllTasks();
  }, [allNotes.length, activePath]);

  const toggleTask = async (task: TaskItem) => {
    try {
      let content = "";
      if (activePath && task.path === activePath && activeContent !== undefined) {
        content = activeContent;
      } else {
        content = await invoke<string>("read_file_content", { filePath: task.path });
      }

      const lines = content.split("\n");
      const lineIdx = task.line - 1;
      if (lineIdx >= 0 && lineIdx < lines.length) {
        const line = lines[lineIdx];
        const newCompleted = !task.completed;
        const updatedLine = newCompleted
          ? line.replace(/^(\s*)-\s*\[\s*\]/, "$1- [x]")
          : line.replace(/^(\s*)-\s*\[[xX]\]/, "$1- [ ]");

        lines[lineIdx] = updatedLine;
        const newContent = lines.join("\n");

        if (onUpdateNoteContent) {
          onUpdateNoteContent(task.path, newContent);
        } else {
          await invoke("write_file_content", { filePath: task.path, content: newContent });
        }

        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, completed: newCompleted } : t))
        );
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "pending" && t.completed) return false;
      if (filter === "completed" && !t.completed) return false;
      if (query && !t.text.toLowerCase().includes(query.toLowerCase()) && !t.noteTitle.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [tasks, filter, query]);

  // Group by noteTitle
  const groupedTasks = useMemo(() => {
    const map = new Map<string, { path: string; tasks: TaskItem[] }>();
    filteredTasks.forEach((t) => {
      if (!map.has(t.noteTitle)) {
        map.set(t.noteTitle, { path: t.path, tasks: [] });
      }
      map.get(t.noteTitle)!.tasks.push(t);
    });
    return Array.from(map.entries());
  }, [filteredTasks]);

  const totalPending = tasks.filter((t) => !t.completed).length;

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none">
      {/* Header Controls */}
      <div className="p-3 border-b border-border-subtle space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-accent-purple" />
            <span className="text-xs font-semibold text-text-primary">Vault Tasks</span>
            <span className="px-1.5 py-0.2 rounded-full bg-accent-purple/15 text-accent-purple font-mono text-[10px]">
              {totalPending}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const ics = generateTasksIcs(filteredTasks.length > 0 ? filteredTasks : tasks);
                downloadIcsFile("shard-tasks.ics", ics);
              }}
              className="p-1 text-text-muted hover:text-accent-purple rounded hover:bg-bg-hover transition-colors"
              title="Export Tasks to RFC 5545 iCalendar (.ics)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={scanAllTasks}
              disabled={loading}
              className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
              title="Rescan Vault Tasks"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent-purple" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2.5 top-2 text-text-faint" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tasks..."
            className="w-full pl-7 pr-2.5 py-1 bg-bg-card border border-border-subtle rounded text-[11px] text-text-primary outline-none focus:border-accent-purple"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 pt-1">
          <button
            onClick={() => setFilter("pending")}
            className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${
              filter === "pending"
                ? "bg-bg-card text-accent-purple font-semibold shadow-xs"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            Pending ({tasks.filter((t) => !t.completed).length})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${
              filter === "completed"
                ? "bg-bg-card text-accent-purple font-semibold shadow-xs"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            Done ({tasks.filter((t) => t.completed).length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${
              filter === "all"
                ? "bg-bg-card text-accent-purple font-semibold shadow-xs"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            All ({tasks.length})
          </button>
        </div>
      </div>

      {/* Task List grouped by Note */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {loading && tasks.length === 0 ? (
          <div className="py-8 text-center text-text-faint text-xs">
            Scanning vault notes for tasks...
          </div>
        ) : groupedTasks.length === 0 ? (
          <div className="py-8 text-center text-text-faint text-xs space-y-1">
            <CheckCircle2 className="w-6 h-6 mx-auto opacity-30 text-accent-emerald" />
            <div>No {filter} tasks found.</div>
          </div>
        ) : (
          groupedTasks.map(([noteTitle, { path, tasks: noteTasks }]) => (
            <div key={noteTitle} className="space-y-1">
              {/* Note Group Title Header */}
              <div
                onClick={() => onNavigateToNote(path)}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-text-muted hover:text-accent-purple cursor-pointer rounded hover:bg-bg-card transition-colors group"
              >
                <FileText className="w-3 h-3 text-accent-purple shrink-0" />
                <span className="truncate flex-1">{noteTitle}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Task Items */}
              <div className="space-y-0.5 pl-2">
                {noteTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 p-1.5 rounded hover:bg-bg-card transition-colors group text-xs text-text-primary"
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      className="mt-0.5 text-text-muted hover:text-accent-purple cursor-pointer shrink-0"
                    >
                      {task.completed ? (
                        <CheckSquare className="w-3.5 h-3.5 text-accent-purple" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span
                      onClick={() => onNavigateToNote(task.path)}
                      className={`flex-1 leading-snug cursor-pointer ${
                        task.completed ? "line-through text-text-faint" : "hover:text-accent-purple"
                      }`}
                    >
                      {task.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
