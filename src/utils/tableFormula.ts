/**
 * Lightweight, zero-dependency spreadsheet formula engine for Shard Markdown tables.
 * Supports:
 * - Coordinates: A1, B2, etc. (Column A-Z, Row 1-N)
 * - Ranges: A1:A5, A1:C3
 * - Functions: =SUM(), =AVERAGE() / =AVG(), =COUNT(), =MIN(), =MAX(), =PRODUCT()
 * - Arithmetic: =A1 + B1, =A1 * 1.15, =(A1 + A2) / 2
 */

// Convert column letter(s) to 0-based index: A -> 0, B -> 1, AA -> 26
export function colLetterToIndex(colStr: string): number {
  let index = 0;
  const upper = colStr.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

// Convert 0-based column index to letter: 0 -> A, 1 -> B, 26 -> AA
export function colIndexToLetter(idx: number): string {
  let letter = "";
  let temp = idx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function parseCoordinate(coord: string): { col: number; row: number } | null {
  const match = coord.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1; // 1-based to 0-based
  return { col, row };
}

// Expand a range like "A1:B3" into list of coordinates ["A1", "A2", "A3", "B1", "B2", "B3"]
export function expandRange(rangeStr: string): string[] {
  const parts = rangeStr.split(":").map((s) => s.trim());
  if (parts.length === 1) return [parts[0].toUpperCase()];
  if (parts.length !== 2) return [];

  const start = parseCoordinate(parts[0]);
  const end = parseCoordinate(parts[1]);
  if (!start || !end) return [];

  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  const coords: string[] = [];
  for (let c = minCol; c <= maxCol; c++) {
    const colName = colIndexToLetter(c);
    for (let r = minRow; r <= maxRow; r++) {
      coords.push(`${colName}${r + 1}`);
    }
  }
  return coords;
}

// Extract numeric value from cell string
export function parseCellValue(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[$€£¥%]/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function roundClean(num: number): number {
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
}

/**
 * Evaluates a single formula expression against table data.
 * @param formula e.g. "=SUM(A1:A5)" or "=A1 + B1 * 2"
 * @param table 2D string array representing table rows
 * @param visited Set of visited cells to prevent circular references
 */
export function evaluateFormula(
  formula: string,
  table: string[][],
  visited: Set<string> = new Set()
): string {
  const raw = formula.trim();
  if (!raw.startsWith("=")) return raw;

  const expression = raw.substring(1).trim();

  // 1. Check for standard function: FUNCTION_NAME(...)
  const fnMatch = expression.match(/^([A-Za-z_]+)\((.*)\)$/);
  if (fnMatch) {
    const fnName = fnMatch[1].toUpperCase();
    const argsStr = fnMatch[2].trim();

    // Collect all cell coordinates in args
    const argTokens = argsStr.split(",").map((s) => s.trim());
    const cellCoords: string[] = [];
    for (const token of argTokens) {
      if (token.includes(":")) {
        cellCoords.push(...expandRange(token));
      } else {
        cellCoords.push(token.toUpperCase());
      }
    }

    const numbers: number[] = [];
    for (const coord of cellCoords) {
      if (visited.has(coord)) return "#CIRCULAR!";
      const parsed = parseCoordinate(coord);
      if (!parsed) continue;

      const cellText = table[parsed.row]?.[parsed.col] ?? "";
      if (cellText.startsWith("=")) {
        const nextVisited = new Set(visited).add(coord);
        const subRes = evaluateFormula(cellText, table, nextVisited);
        const num = parseCellValue(subRes);
        if (num !== null) numbers.push(num);
      } else {
        const num = parseCellValue(cellText);
        if (num !== null) numbers.push(num);
      }
    }

    switch (fnName) {
      case "SUM":
        return numbers.length ? String(roundClean(numbers.reduce((a, b) => a + b, 0))) : "0";
      case "AVERAGE":
      case "AVG":
        return numbers.length ? String(roundClean(numbers.reduce((a, b) => a + b, 0) / numbers.length)) : "0";
      case "COUNT":
        return String(numbers.length);
      case "MIN":
        return numbers.length ? String(roundClean(Math.min(...numbers))) : "0";
      case "MAX":
        return numbers.length ? String(roundClean(Math.max(...numbers))) : "0";
      case "PRODUCT":
        return numbers.length ? String(roundClean(numbers.reduce((a, b) => a * b, 1))) : "0";
      default:
        return "#NAME?";
    }
  }

  // 2. Arithmetic expression with cell references: e.g. A1 + B1, A1 * 1.5
  try {
    const replaced = expression.replace(/([A-Za-z]+\d+)/g, (match) => {
      const coord = match.toUpperCase();
      if (visited.has(coord)) throw new Error("CIRCULAR");
      const parsed = parseCoordinate(coord);
      if (!parsed) return "0";

      const cellText = table[parsed.row]?.[parsed.col] ?? "";
      if (cellText.startsWith("=")) {
        const nextVisited = new Set(visited).add(coord);
        const subRes = evaluateFormula(cellText, table, nextVisited);
        const num = parseCellValue(subRes);
        return String(num ?? 0);
      }
      const num = parseCellValue(cellText);
      return String(num ?? 0);
    });

    // Safe mathematical evaluator without eval()
    const result = evaluateMathExpression(replaced);
    return isNaN(result) ? "#VALUE!" : String(roundClean(result));
  } catch (err: any) {
    if (err?.message === "CIRCULAR") return "#CIRCULAR!";
    return "#ERROR!";
  }
}

/**
 * Safe parser for basic math (+ - * / () numbers)
 */
function evaluateMathExpression(expr: string): number {
  // Strip anything that is not math characters
  if (/[^0-9.+\-*/%() ]/.test(expr)) {
    throw new Error("Invalid characters");
  }

  // Use Function constructor in a closed scope to compute math string safely
  // (expr only contains verified numeric tokens and math operators)
  const fn = new Function(`return (${expr})`);
  const val = fn();
  return typeof val === "number" ? val : NaN;
}

/**
 * Evaluates all formulas in a 2D table grid, returning a new updated grid.
 */
export function evaluateAllTableFormulas(rows: string[][]): {
  newRows: string[][];
  evaluatedCount: number;
} {
  let count = 0;
  const newRows = rows.map((row, rIdx) =>
    row.map((cell, cIdx) => {
      if (cell.trim().startsWith("=")) {
        const coord = `${colIndexToLetter(cIdx)}${rIdx + 1}`;
        const val = evaluateFormula(cell, rows, new Set([coord]));
        count++;
        return val;
      }
      return cell;
    })
  );

  return { newRows, evaluatedCount: count };
}
