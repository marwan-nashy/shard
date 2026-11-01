import React, { useState } from "react";
import { X, Plus, Trash2, AlignLeft, AlignCenter, AlignRight, Check, Table as TableIcon } from "lucide-react";
import { tableToMarkdown } from "../utils/tableParser";

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

  const handleConfirm = () => {
    const md = tableToMarkdown(headers, alignments, rows);
    onInsertTable(`\n${md}\n`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-bg-card border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-secondary/40 select-none">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-accent-purple" />
            <span className="font-semibold text-sm text-text-primary">Interactive Table Editor</span>
            <span className="text-[10px] text-text-faint font-mono">
              ({rows.length} rows × {headers.length} columns)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Spreadsheet Table Grid */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <div className="border border-border-subtle rounded-lg overflow-x-auto bg-bg-primary/50">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg-secondary border-b border-border-subtle">
                  <th className="w-8 p-1 text-[10px] text-text-faint font-mono text-center">#</th>
                  {headers.map((h, cIdx) => (
                    <th key={cIdx} className="p-2 border-l border-border-subtle min-w-[120px]">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={h}
                          onChange={(e) => handleHeaderChange(cIdx, e.target.value)}
                          className="w-full bg-transparent font-semibold text-xs text-text-primary outline-none focus:text-accent-purple"
                        />
                        <button
                          type="button"
                          onClick={() => cycleAlignment(cIdx)}
                          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
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
                            className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-bg-hover"
                            title="Delete Column"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
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
                    <td className="p-1 text-[10px] text-text-faint font-mono text-center select-none">
                      {rIdx + 1}
                    </td>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-1.5 border-l border-border-subtle">
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          style={{ textAlign: alignments[cIdx] }}
                          placeholder="..."
                          className="w-full bg-transparent text-xs text-text-primary outline-none focus:bg-bg-hover/60 px-1 py-0.5 rounded"
                        />
                      </td>
                    ))}
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
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle bg-bg-secondary/40 select-none">
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
  );
};
