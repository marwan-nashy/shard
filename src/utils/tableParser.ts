export interface ParsedTable {
  headers: string[];
  alignments: ("left" | "center" | "right")[];
  rows: string[][];
}

export function parseMarkdownTable(text: string): ParsedTable | null {
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));

  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] => {
    return line
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
  };

  const headers = parseRow(lines[0]);
  const delimiterRow = parseRow(lines[1]);

  const alignments: ("left" | "center" | "right")[] = delimiterRow.map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    // Pad row if needed
    while (row.length < headers.length) row.push("");
    rows.push(row.slice(0, headers.length));
  }

  return { headers, alignments, rows };
}

export function tableToMarkdown(
  headers: string[],
  alignments: ("left" | "center" | "right")[],
  rows: string[][]
): string {
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length));

  // Compute column widths for pretty formatting
  const colWidths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let max = (headers[c] || `Col ${c + 1}`).length;
    for (const r of rows) {
      max = Math.max(max, (r[c] || "").length);
    }
    colWidths[c] = Math.max(max, 3);
  }

  const formatRow = (cells: string[]): string => {
    const padded = cells.map((cell, idx) => {
      const width = colWidths[idx] || 3;
      const align = alignments[idx] || "left";
      const val = cell || "";
      if (align === "right") return val.padStart(width);
      if (align === "center") {
        const pad = width - val.length;
        const left = Math.floor(pad / 2);
        const right = pad - left;
        return " ".repeat(left) + val + " ".repeat(right);
      }
      return val.padEnd(width);
    });
    return `| ${padded.join(" | ")} |`;
  };

  const headerLine = formatRow(headers);
  const delimiterLine = `| ${headers
    .map((_, idx) => {
      const width = colWidths[idx] || 3;
      const align = alignments[idx] || "left";
      if (align === "center") return `:${"-".repeat(Math.max(1, width - 2))}:`;
      if (align === "right") return `${"-".repeat(Math.max(2, width - 1))}:`;
      return `:${"-".repeat(Math.max(2, width - 1))}`;
    })
    .join(" | ")} |`;

  const bodyLines = rows.map((r) => {
    const paddedRow = [...r];
    while (paddedRow.length < colCount) paddedRow.push("");
    return formatRow(paddedRow);
  });

  return [headerLine, delimiterLine, ...bodyLines].join("\n");
}

export function createDefaultTable(rowCount = 3, colCount = 3): string {
  const headers = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
  const alignments = Array.from({ length: colCount }, () => "left" as const);
  const rows = Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) => `Item ${r + 1}-${c + 1}`)
  );
  return tableToMarkdown(headers, alignments, rows);
}
