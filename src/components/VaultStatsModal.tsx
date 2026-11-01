import React, { useMemo } from "react";
import { X, BarChart3, FileText, Link2, Hash, Clock, GitFork, AlertCircle } from "lucide-react";
import { GraphData } from "../types";

interface VaultStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allNotes: { title: string; path: string }[];
  allTags: { tag: string; count: number; paths: string[] }[];
  graphData: GraphData;
  onNavigateToNote: (path: string) => void;
}

export const VaultStatsModal: React.FC<VaultStatsModalProps> = ({
  isOpen,
  onClose,
  allNotes,
  allTags,
  graphData,
  onNavigateToNote,
}) => {
  // Compute analytics
  const stats = useMemo(() => {
    const totalNotes = allNotes.filter((n) => !n.path.endsWith(".canvas")).length;
    const totalCanvases = allNotes.filter((n) => n.path.endsWith(".canvas")).length;
    const totalLinks = graphData.links.length;
    const totalTagsCount = allTags.length;

    // Identify Hub Notes (highest links count)
    const linkCounts = new Map<string, number>();
    graphData.links.forEach((l) => {
      linkCounts.set(l.source, (linkCounts.get(l.source) || 0) + 1);
      linkCounts.set(l.target, (linkCounts.get(l.target) || 0) + 1);
    });

    const hubNotes = Array.from(linkCounts.entries())
      .map(([id, count]) => {
        const node = graphData.nodes.find((n) => n.id === id);
        return {
          id,
          title: node ? node.label : id,
          count,
          path: node ? node.path : "",
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Identify Orphan Notes (nodes in graph with 0 links or not connected)
    const connectedIds = new Set<string>();
    graphData.links.forEach((l) => {
      connectedIds.add(l.source);
      connectedIds.add(l.target);
    });

    const orphanNotes = allNotes
      .filter((n) => !n.path.endsWith(".canvas") && !connectedIds.has(n.title.toLowerCase()))
      .slice(0, 8);

    return {
      totalNotes,
      totalCanvases,
      totalLinks,
      totalTagsCount,
      hubNotes,
      orphanNotes,
    };
  }, [allNotes, allTags, graphData]);

  // Generate 52-week activity heatmap data (last 365 days)
  const heatmapData = useMemo(() => {
    const days: { dateStr: string; count: number; dayOfWeek: number }[] = [];
    const today = new Date();
    const dailyNotesDates = new Set(
      allNotes
        .map((n) => n.title.match(/^\d{4}-\d{2}-\d{2}$/)?.[0])
        .filter(Boolean) as string[]
    );

    // Last 28 weeks (approx 7 months) for compact visual display
    for (let i = 195; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const isDaily = dailyNotesDates.has(iso);

      // Deterministic activity count for visual representation
      let count = isDaily ? 2 : 0;
      if (iso === today.toISOString().slice(0, 10)) count += 3;

      days.push({
        dateStr: iso,
        count,
        dayOfWeek: d.getDay(),
      });
    }

    // Group into weeks (columns)
    const weeks: { dateStr: string; count: number }[][] = [];
    let currentWeek: { dateStr: string; count: number }[] = [];

    days.forEach((day) => {
      currentWeek.push(day);
      if (day.dayOfWeek === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return weeks;
  }, [allNotes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-bg-card border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-bg-secondary/50">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent-purple" />
            <h3 className="text-xs font-semibold text-text-primary tracking-wide">
              Vault Analytics & Activity
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* 1. Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-bg-secondary/50 border border-border-subtle space-y-1">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                <FileText className="w-3.5 h-3.5 text-accent-purple" />
                <span>Notes & Canvases</span>
              </div>
              <div className="text-xl font-bold text-text-primary">
                {stats.totalNotes}{" "}
                <span className="text-xs font-normal text-text-faint">
                  (+{stats.totalCanvases} boards)
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-bg-secondary/50 border border-border-subtle space-y-1">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                <Link2 className="w-3.5 h-3.5 text-accent-blue" />
                <span>Wikilinks</span>
              </div>
              <div className="text-xl font-bold text-text-primary">{stats.totalLinks}</div>
            </div>

            <div className="p-3.5 rounded-lg bg-bg-secondary/50 border border-border-subtle space-y-1">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                <Hash className="w-3.5 h-3.5 text-accent-emerald" />
                <span>Tags Registered</span>
              </div>
              <div className="text-xl font-bold text-text-primary">{stats.totalTagsCount}</div>
            </div>

            <div className="p-3.5 rounded-lg bg-bg-secondary/50 border border-border-subtle space-y-1">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                <Clock className="w-3.5 h-3.5 text-accent-orange" />
                <span>Link Density</span>
              </div>
              <div className="text-xl font-bold text-text-primary">
                {stats.totalNotes > 0 ? (stats.totalLinks / stats.totalNotes).toFixed(1) : 0}{" "}
                <span className="text-xs font-normal text-text-faint">links/note</span>
              </div>
            </div>
          </div>

          {/* 2. Activity Heatmap Punchcard */}
          <div className="p-4 rounded-xl bg-bg-secondary/40 border border-border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-primary">
                Writing Consistency & Daily Notes
              </h4>
              <div className="flex items-center gap-1 text-[10px] text-text-faint">
                <span>Less</span>
                <div className="w-2.5 h-2.5 rounded-xs bg-bg-card border border-border-subtle" />
                <div className="w-2.5 h-2.5 rounded-xs bg-accent-purple/30" />
                <div className="w-2.5 h-2.5 rounded-xs bg-accent-purple/60" />
                <div className="w-2.5 h-2.5 rounded-xs bg-accent-purple" />
                <span>More</span>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1 min-w-[500px]">
                {heatmapData.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((day, dIdx) => {
                      const colorClass =
                        day.count === 0
                          ? "bg-bg-card/70 border border-border-subtle/50"
                          : day.count === 1
                          ? "bg-accent-purple/30"
                          : day.count === 2
                          ? "bg-accent-purple/60"
                          : "bg-accent-purple shadow-xs";
                      return (
                        <div
                          key={dIdx}
                          title={`${day.dateStr}: ${day.count} activity units`}
                          className={`w-2.5 h-2.5 rounded-xs transition-transform hover:scale-125 cursor-default ${colorClass}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Knowledge Hubs vs. Orphan Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Top Knowledge Hubs */}
            <div className="p-4 rounded-xl bg-bg-secondary/40 border border-border-subtle space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <GitFork className="w-3.5 h-3.5 text-accent-purple" />
                <span>Top Knowledge Hubs</span>
              </div>
              <div className="space-y-1.5">
                {stats.hubNotes.length === 0 ? (
                  <div className="text-[11px] text-text-faint py-3">No interconnected notes yet.</div>
                ) : (
                  stats.hubNotes.map((hub) => (
                    <div
                      key={hub.id}
                      onClick={() => {
                        if (hub.path) {
                          onNavigateToNote(hub.path);
                          onClose();
                        }
                      }}
                      className="flex items-center justify-between p-2 rounded-lg bg-bg-card/40 hover:bg-bg-card hover:border-accent-purple/40 border border-transparent cursor-pointer transition-all text-xs"
                    >
                      <span className="truncate font-medium text-text-primary">
                        [[{hub.title}]]
                      </span>
                      <span className="text-[11px] font-mono text-accent-purple font-semibold">
                        {hub.count} {hub.count === 1 ? "link" : "links"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Orphan Notes (0 links) */}
            <div className="p-4 rounded-xl bg-bg-secondary/40 border border-border-subtle space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                  <AlertCircle className="w-3.5 h-3.5 text-accent-orange" />
                  <span>Unlinked / Orphan Notes</span>
                </div>
                <span className="text-[10px] text-text-faint">
                  {stats.orphanNotes.length} notes
                </span>
              </div>
              <div className="space-y-1.5">
                {stats.orphanNotes.length === 0 ? (
                  <div className="text-[11px] text-text-faint py-3">
                    All notes in your vault are interconnected!
                  </div>
                ) : (
                  stats.orphanNotes.map((orphan) => (
                    <div
                      key={orphan.path}
                      onClick={() => {
                        onNavigateToNote(orphan.path);
                        onClose();
                      }}
                      className="flex items-center justify-between p-2 rounded-lg bg-bg-card/40 hover:bg-bg-card hover:border-accent-orange/40 border border-transparent cursor-pointer transition-all text-xs"
                    >
                      <span className="truncate text-text-muted hover:text-text-primary">
                        {orphan.title}
                      </span>
                      <span className="text-[10px] text-accent-orange opacity-80">
                        Needs links &rarr;
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
