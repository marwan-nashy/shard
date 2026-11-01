import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText } from "lucide-react";

interface CalendarPaneProps {
  allNotes: { title: string; path: string }[];
  onOpenNote: (path: string) => void;
  onCreateDailyNote: (dateStr: string) => void;
}

export const CalendarPane: React.FC<CalendarPaneProps> = ({
  allNotes,
  onOpenNote,
  onCreateDailyNote,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Map of YYYY-MM-DD to existing note
  const notesByDate = useMemo(() => {
    const map = new Map<string, string>();
    allNotes.forEach((n) => {
      // Check if note title or path contains YYYY-MM-DD
      const match = n.title.match(/\b\d{4}-\d{2}-\d{2}\b/);
      if (match) {
        map.set(match[0], n.path);
      }
    });
    return map;
  }, [allNotes]);

  // Calendar grid calculations
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const str = prevDate.toISOString().split("T")[0];
      days.push({ day: d, isCurrentMonth: false, dateStr: str });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const padM = String(month + 1).padStart(2, "0");
      const padD = String(d).padStart(2, "0");
      const str = `${year}-${padM}-${padD}`;
      days.push({ day: d, isCurrentMonth: true, dateStr: str });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const str = nextDate.toISOString().split("T")[0];
      days.push({ day: d, isCurrentMonth: false, dateStr: str });
    }

    return days;
  }, [year, month]);

  const todayStr = new Date().toISOString().split("T")[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleDayClick = (dateStr: string) => {
    const existing = notesByDate.get(dateStr);
    if (existing) {
      onOpenNote(existing);
    } else {
      onCreateDailyNote(dateStr);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none p-3 overflow-y-auto">
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-text-primary">
          <CalendarIcon className="w-3.5 h-3.5 text-accent-purple" />
          <span>
            {monthNames[month]} {year}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToToday}
            className="px-1.5 py-0.5 text-[10px] rounded font-mono text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Go to Today"
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono font-medium text-text-faint mb-1">
        {daysOfWeek.map((d) => (
          <div key={d} className="py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarDays.map((item, idx) => {
          const hasNote = notesByDate.has(item.dateStr);
          const isToday = item.dateStr === todayStr;

          return (
            <button
              key={idx}
              onClick={() => handleDayClick(item.dateStr)}
              className={`h-7 w-full rounded flex flex-col items-center justify-center relative text-xs transition-all ${
                item.isCurrentMonth
                  ? "text-text-primary hover:bg-bg-hover"
                  : "text-text-faint/50 hover:bg-bg-hover/50"
              } ${
                isToday
                  ? "bg-accent-purple/20 text-accent-purple font-bold border border-accent-purple/50"
                  : ""
              }`}
              title={
                hasNote
                  ? `Open note for ${item.dateStr}`
                  : `Create daily note for ${item.dateStr}`
              }
            >
              <span>{item.day}</span>
              {hasNote && (
                <span className="w-1 h-1 rounded-full bg-accent-purple absolute bottom-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Journaling Actions */}
      <div className="mt-4 pt-3 border-t border-border-subtle flex flex-col gap-1.5">
        <button
          onClick={() => handleDayClick(todayStr)}
          className="w-full py-1.5 px-2.5 rounded-md bg-bg-card hover:bg-bg-hover border border-border-subtle text-xs text-text-primary flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-accent-purple" />
            <span>Today's Journal</span>
          </span>
          <span className="text-[10px] font-mono text-text-faint">{todayStr}</span>
        </button>
      </div>
    </div>
  );
};
