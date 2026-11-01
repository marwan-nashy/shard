import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
  Table as TableIcon,
  Calculator,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { tableToMarkdown } from "../utils/tableParser";
import {
  colIndexToLetter,
  evaluateAllTableFormulas,
} from "../utils/tableFormula";
import { Language } from "../i18n";

interface TableEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTable: (markdownTable: string) => void;
  initialRows?: number;
  initialCols?: number;
  language?: Language;
}

export const TableEditorModal: React.FC<TableEditorModalProps> = ({
  isOpen,
  onClose,
  onInsertTable,
  initialRows = 3,
  initialCols = 3,
}) => {
  const [headers, setHeaders] = useState<string[]>(() =>
    Array.from({ length: initialCols }, (_, i) => `Header ${i + 1}`)
  );
  const [alignments, setAlignments] = useState<("left" | "center" | "right")[]>(() =>
    Array.from({ length: initialCols }, () => "left")
  );
  const [rows, setRows] = useState<string[][]>(() =>
    Array.from({ length: initialRows }, () =>
      Array.from({ length: initialCols }, () => "")
    )
  );
  const [lastFocusedCell, setLastFocusedCell] = useState<{ r: number; c: number } | null>(null);
  const [formulaStatus, setFormulaStatus] = useState<string | null>(null);
  const [autoEvaluateOnInsert, setAutoEvaluateOnInsert] = useState(true);

  if (!isOpen) return null;

  const addColumn = () => {
    const nextCol = headers.length + 1;
    setHeaders([...headers, `Header ${nextCol}`]);
    setAlignments([...alignments, "left"]);
    setRows(rows.map((r) => [...r, ""]));
  };

  const deleteColumn = (colIdx: number) => {
    if (headers.length <= 1) return;
    setHeaders(headers.filter((_, idx) => idx !== colIdx));
    setAlignments(alignments.filter((_, idx) => idx !== colIdx));
    setRows(rows.map((r) => r.filter((_, idx) => idx !== colIdx)));
  };

  const addRow = () => {
    setRows([...rows, Array.from({ length: headers.length }, () => "")]);
  };

  const deleteRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, idx) => idx !== rowIdx));
  };

  const cycleAlignment = (colIdx: number) => {
    const current = alignments[colIdx] || "left";
    const next: "left" | "center" | "right" =
      current === "left" ? "center" : current === "center" ? "right" : "left";
    const updated = [...alignments];
    updated[colIdx] = next;
    setAlignments(updated);
  };

  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    const newRows = rows.map((r, ri) =>
      ri === rIdx ? r.map((c, ci) => (ci === cIdx ? val : c)) : r
    );
    setRows(newRows);
  };

  const handleHeaderChange = (cIdx: number, val: string) => {
    const newHeaders = headers.map((h, ci) => (ci === cIdx ? val : h));
    setHeaders(newHeaders);
  };

  const handleCalculateFormulas = () => {
    const { newRows, evaluatedCount } = evaluateAllTableFormulas(rows);
    setRows(newRows);
    setFormulaStatus(
      evaluatedCount > 0
        ? `Calculated ${evaluatedCount} formula cell${evaluatedCount > 1 ? "s" : ""}`
        : "No formula cells found (start with =SUM, =AVG, etc.)"
    );
    setTimeout(() => setFormulaStatus(null), 3000);
  };

  const insertFormulaTemplate = (template: string) => {
    if (!lastFocusedCell) {
      // Default to last row, first column
      const r = rows.length - 1;
      const c = 0;
      handleCellChange(r, c, template);
      return;
    }
    handleCellChange(lastFocusedCell.r, lastFocusedCell.c, template);
  };

  const handleConfirm = () => {
    let finalRows = rows;
    if (autoEvaluateOnInsert) {
      finalRows = evaluateAllTableFormulas(rows).newRows;
    }
    const md = tableToMarkdown(headers, alignments, finalRows);
    onInsertTable(`\n${md}\n`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-bg-card border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-secondary/40 select-none">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-accent-purple" />
            <span className="font-semibold text-sm text-text-primary">Spreadsheet & Table Editor</span>
            <span className="text-[10px] text-text-faint font-mono bg-bg-primary px-1.5 py-0.5 rounded border border-border-subtle">
              {rows.length}R × {headers.length}C
            </span>
            {formulaStatus && (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-fade-in flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {formulaStatus}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formula Toolbar */}
        <div className="px-5 py-2 border-b border-border-subtle bg-bg-primary/40 flex items-center justify-between gap-3 text-[11px] flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-text-muted font-medium flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-accent-purple" />
              <span>Formulas (ƒx):</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const colLetter = colIndexToLetter(lastFocusedCell?.c ?? 0);
                insertFormulaTemplate(`=SUM(${colLetter}1:${colLetter}${rows.length})`);
              }}
              className="px-2 py-0.5 rounded bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-primary font-mono text-[10px]"
              title="Insert SUM over column"
            >
              =SUM(col)
            </button>
            <button
              type="button"
              onClick={() => {
                const colLetter = colIndexToLetter(lastFocusedCell?.c ?? 0);
                insertFormulaTemplate(`=AVG(${colLetter}1:${colLetter}${rows.length})`);
              }}
              className="px-2 py-0.5 rounded bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-primary font-mono text-[10px]"
              title="Insert AVERAGE"
            >
              =AVG(col)
            </button>
            <button
              type="button"
              onClick={() => insertFormulaTemplate("=A1+B1")}
              className="px-2 py-0.5 rounded bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-primary font-mono text-[10px]"
              title="Cell arithmetic"
            >
              =A1+B1
            </button>
            <button
              type="button"
              onClick={handleCalculateFormulas}
              className="px-2.5 py-0.5 rounded bg-accent-purple/15 text-accent-purple hover:bg-accent-purple/25 border border-accent-purple/30 font-medium text-[11px] flex items-center gap-1 transition-colors"
              title="Calculate all formulas immediately"
            >
              <Calculator className="w-3 h-3" />
              <span>Compute ƒ(x)</span>
            </button>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-text-muted hover:text-text-primary select-none">
            <input
              type="checkbox"
              checked={autoEvaluateOnInsert}
              onChange={(e) => setAutoEvaluateOnInsert(e.target.checked)}
              className="rounded accent-accent-purple w-3.5 h-3.5"
            />
            <span>Auto-evaluate on insert</span>
          </label>
        </div>

        {/* Spreadsheet Table Grid */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <div className="border border-border-subtle rounded-lg overflow-x-auto bg-bg-primary/50">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg-secondary border-b border-border-subtle">
                  <th className="w-10 p-1 text-[10px] text-text-faint font-mono text-center">#</th>
                  {headers.map((h, cIdx) => {
                    const colLetter = colIndexToLetter(cIdx);
                    return (
                      <th key={cIdx} className="p-2 border-l border-border-subtle min-w-[130px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[10px] text-text-faint font-mono pb-0.5 border-b border-border-subtle/40">
                            <span className="font-bold text-accent-purple">{colLetter}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => cycleAlignment(cIdx)}
                                className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
                                title={`Align: ${alignments[cIdx]}`}
                              >
                                {alignments[cIdx] === "center" ? (
                                  <AlignCenter className="w-3 h-3 text-accent-purple" />
                                ) : alignments[cIdx] === "right" ? (
                                  <AlignRight className="w-3 h-3 text-accent-purple" />
                                ) : (
                                  <AlignLeft className="w-3 h-3" />
                                )}
                              </button>
                              {headers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => deleteColumn(cIdx)}
                                  className="p-0.5 rounded text-text-muted hover:text-accent-red hover:bg-bg-hover"
                                  title="Delete Column"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <input
                            type="text"
                            value={h}
                            onChange={(e) => handleHeaderChange(cIdx, e.target.value)}
                            className="w-full bg-transparent font-semibold text-xs text-text-primary outline-none focus:text-accent-purple"
                          />
                        </div>
                      </th>
                    );
                  })}
                  <th className="w-10 p-1 text-center border-l border-border-subtle">
                    <button
                      onClick={addColumn}
                      className="p-1 rounded text-accent-purple hover:bg-accent-purple/15 transition-colors"
                      title="Add Column"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="border-b border-border-subtle/50 hover:bg-bg-secondary/30 transition-colors"
                  >
                    <td className="p-1 text-[10px] text-text-faint font-mono text-center select-none font-bold">
                      {rIdx + 1}
                    </td>
                    {row.map((cell, cIdx) => {
                      const isFormula = cell.trim().startsWith("=");
                      return (
                        <td key={cIdx} className="p-1.5 border-l border-border-subtle relative group">
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            onFocus={() => setLastFocusedCell({ r: rIdx, c: cIdx })}
                            style={{ textAlign: alignments[cIdx] }}
                            placeholder="..."
                            className={`w-full bg-transparent text-xs outline-none px-1 py-0.5 rounded transition-colors ${
                              isFormula
                                ? "text-accent-purple font-mono font-medium bg-accent-purple/5"
                                : "text-text-primary focus:bg-bg-hover/60"
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="p-1 text-center border-l border-border-subtle">
                      {rows.length > 1 && (
                        <button
                          onClick={() => deleteRow(rIdx)}
                          className="p-1 rounded text-text-faint hover:text-accent-red transition-colors"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={addRow}
              className="px-2.5 py-1 rounded bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-muted hover:text-text-primary text-xs flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-accent-purple" />
              <span>Add Row</span>
            </button>
            <button
              onClick={addColumn}
              className="px-2.5 py-1 rounded bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-muted hover:text-text-primary text-xs flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-accent-purple" />
              <span>Add Column</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle bg-bg-secondary/40 select-none">
          <div className="text-[11px] text-text-muted flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-text-faint" />
            <span>Type <code className="font-mono text-accent-purple">=SUM(A1:A5)</code> or <code className="font-mono text-accent-purple">=A1+B1</code> in any cell</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-1.5 rounded-lg bg-accent-purple hover:bg-accent-purple-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Insert Table</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
