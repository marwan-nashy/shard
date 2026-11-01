import { KanbanColumn } from "../types";

export function parseMarkdownToKanban(content: string): { preamble: string; columns: KanbanColumn[] } {
  const lines = content.split("\n");
  const columns: KanbanColumn[] = [];
  let currentColumn: KanbanColumn | null = null;
  const preambleLines: string[] = [];
  let hasEncounteredHeading = false;

  let cardCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^#{1,3}\s+(.*)$/);

    if (headingMatch) {
      hasEncounteredHeading = true;
      const title = headingMatch[1].trim();
      currentColumn = {
        id: `col-${columns.length + 1}`,
        title,
        cards: [],
      };
      columns.push(currentColumn);
      continue;
    }

    if (!hasEncounteredHeading) {
      preambleLines.push(line);
      continue;
    }

    if (!currentColumn) continue;

    // Check if line is a list item or task
    const taskMatch = line.match(/^(\s*[-*]\s+)\[([ xX])\]\s+(.*)$/);
    const listMatch = line.match(/^(\s*[-*]\s+)(.*)$/);

    if (taskMatch) {
      const completed = taskMatch[2].toLowerCase() === "x";
      const cardText = taskMatch[3].trim();
      const tags = (cardText.match(/#[a-zA-Z0-9_\u0600-\u06FF]+/g) || []).map((t) => t.slice(1));
      currentColumn.cards.push({
        id: `card-${++cardCounter}`,
        content: cardText,
        isTask: true,
        completed,
        tags,
      });
    } else if (listMatch) {
      const cardText = listMatch[2].trim();
      if (cardText) {
        const tags = (cardText.match(/#[a-zA-Z0-9_\u0600-\u06FF]+/g) || []).map((t) => t.slice(1));
        currentColumn.cards.push({
          id: `card-${++cardCounter}`,
          content: cardText,
          isTask: false,
          completed: false,
          tags,
        });
      }
    } else if (line.trim().length > 0) {
      // Plain line / card
      const cardText = line.trim();
      const tags = (cardText.match(/#[a-zA-Z0-9_\u0600-\u06FF]+/g) || []).map((t) => t.slice(1));
      currentColumn.cards.push({
        id: `card-${++cardCounter}`,
        content: cardText,
        isTask: false,
        completed: false,
        tags,
      });
    }
  }

  // If no columns were found, supply standard default columns
  if (columns.length === 0) {
    return {
      preamble: content.trim(),
      columns: [
        { id: "col-1", title: "To Do", cards: [] },
        { id: "col-2", title: "In Progress", cards: [] },
        { id: "col-3", title: "Done", cards: [] },
      ],
    };
  }

  return {
    preamble: preambleLines.join("\n").trim(),
    columns,
  };
}

export function kanbanToMarkdown(columns: KanbanColumn[], preamble?: string): string {
  const parts: string[] = [];

  if (preamble && preamble.trim()) {
    parts.push(preamble.trim());
    parts.push("");
  }

  for (const col of columns) {
    parts.push(`## ${col.title}`);
    for (const card of col.cards) {
      if (card.isTask) {
        parts.push(`- [${card.completed ? "x" : " "}] ${card.content}`);
      } else {
        parts.push(`- ${card.content}`);
      }
    }
    parts.push("");
  }

  return parts.join("\n").trimEnd() + "\n";
}
