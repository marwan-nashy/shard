import { TemplateItem } from "../types";

export const BUILTIN_TEMPLATES: TemplateItem[] = [
  {
    id: "daily-journal",
    title: "Daily Journal",
    description: "Goals, scratchpad, log, and evening reflection",
    content: `# {{date}} - {{weekday}}

## 🎯 Top 3 Priorities
- [ ] 
- [ ] 
- [ ] 

## 📝 Working Notes & Log

## ✨ Reflection & Wins
`,
  },
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    description: "Attendees, agenda items, discussion points, action items",
    content: `# Meeting: {{title}}
**Date:** {{date}} at {{time}}  
**Participants:** 

---

## 📋 Agenda
1. 

## 💬 Discussion & Decisions
- 

## ✅ Action Items
- [ ] [ ] Owner: Due {{tomorrow}}
`,
  },
  {
    id: "project-spec",
    title: "Project Specification",
    description: "Goals, architecture, milestones, and task checklists",
    content: `# {{title}}

> [!NOTE] Overview
> Concise summary of the project goal and problem statement.

## 🎯 Scope & Deliverables
- [ ] Core architecture defined
- [ ] MVP implementation complete
- [ ] Documentation & tests written

## 📐 Architecture & Notes

## 🗓️ Milestones & Deadlines
| Milestone | Target Date | Status |
| :--- | :--- | :--- |
| Alpha Prototype | {{date}} | In Progress |
| Beta Release | {{tomorrow}} | Pending |
`,
  },
  {
    id: "weekly-review",
    title: "Weekly Review",
    description: "Retrospective, habit audit, and week planning",
    content: `# Weekly Review - Week of {{date}}

## 🏆 Key Achievements & Wins
- 

## ⚠️ Challenges & Friction
- 

## 📊 Habit & Project Audit
- Reading / Learning:
- Deep Work Hours:

## 🎯 Focus Areas for Next Week
- [ ] 
`,
  },
];

/**
 * Replaces dynamic variables inside template string.
 */
export function renderTemplate(templateContent: string, noteTitle: string): string {
  const now = new Date();

  // YYYY-MM-DD
  const dateStr = now.toISOString().slice(0, 10);

  // HH:mm
  const timeStr = now.toTimeString().slice(0, 5);

  // Weekday
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const weekdayStr = weekdays[now.getDay()];

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  return templateContent
    .replace(/\{\{\s*title\s*\}\}/gi, noteTitle || "Untitled")
    .replace(/\{\{\s*date\s*\}\}/gi, dateStr)
    .replace(/\{\{\s*time\s*\}\}/gi, timeStr)
    .replace(/\{\{\s*weekday\s*\}\}/gi, weekdayStr)
    .replace(/\{\{\s*yesterday\s*\}\}/gi, yesterdayStr)
    .replace(/\{\{\s*tomorrow\s*\}\}/gi, tomorrowStr);
}
