import { TaskItem } from "../types";

/**
 * Standard RFC 5545 iCalendar (.ics) generator for Shard.
 * Compatible with Google Calendar, Apple Calendar, Outlook, and Thunderbird.
 */

function formatUtcTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function formatDateValue(dateStr: string): string | null {
  // Extract YYYY-MM-DD
  const match = dateStr.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) return null;
  return `${match[1]}${match[2]}${match[3]}`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Generate RFC 5545 .ics content from vault tasks.
 */
export function generateTasksIcs(tasks: TaskItem[], calName: string = "Shard Tasks"): string {
  const nowStr = formatUtcTimestamp();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shard Markdown Notes//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    "X-WR-TIMEZONE:UTC",
  ];

  tasks.forEach((task, index) => {
    // Check if task has a due date tag like @YYYY-MM-DD, due:YYYY-MM-DD, or YYYY-MM-DD
    const dateMatch = formatDateValue(task.text);
    const dueDateStr = dateMatch || formatUtcTimestamp(new Date()).slice(0, 8);
    const uid = `task_${index}_${Date.now()}@shard.notes`;

    // Clean display text (strip date tag)
    const cleanSummary = task.text
      .replace(/@\d{4}-\d{2}-\d{2}/g, "")
      .replace(/due:\s*\d{4}-\d{2}-\d{2}/gi, "")
      .replace(/#due\/\d{4}-\d{2}-\d{2}/gi, "")
      .trim();

    lines.push("BEGIN:VTODO");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStr}`);
    if (task.completed) {
      lines.push("STATUS:COMPLETED");
    } else {
      lines.push("STATUS:NEEDS-ACTION");
    }
    lines.push(`SUMMARY:${escapeIcsText(cleanSummary || task.text)}`);
    lines.push(`DUE;VALUE=DATE:${dueDateStr}`);
    lines.push(`DESCRIPTION:${escapeIcsText(`From note: ${task.noteTitle}\nPath: ${task.path}`)}`);
    lines.push("END:VTODO");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Generate RFC 5545 .ics content for daily notes or calendar events.
 */
export function generateCalendarIcs(
  events: { dateStr: string; title: string; path: string }[],
  calName: string = "Shard Daily Notes"
): string {
  const nowStr = formatUtcTimestamp();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shard Markdown Notes//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    "X-WR-TIMEZONE:UTC",
  ];

  events.forEach((ev, idx) => {
    const dVal = formatDateValue(ev.dateStr);
    if (!dVal) return;

    // Next day for all-day DTEND
    const y = parseInt(dVal.slice(0, 4), 10);
    const m = parseInt(dVal.slice(4, 6), 10) - 1;
    const d = parseInt(dVal.slice(6, 8), 10);
    const nextDate = new Date(Date.UTC(y, m, d + 1));
    const nextPad = (n: number) => String(n).padStart(2, "0");
    const nextVal = `${nextDate.getUTCFullYear()}${nextPad(nextDate.getUTCMonth() + 1)}${nextPad(nextDate.getUTCDate())}`;

    const uid = `event_${idx}_${Date.now()}@shard.notes`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStr}`);
    lines.push(`DTSTART;VALUE=DATE:${dVal}`);
    lines.push(`DTEND;VALUE=DATE:${nextVal}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(`Path: ${ev.path}`)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Browser-safe Blob download for .ics file.
 */
export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
