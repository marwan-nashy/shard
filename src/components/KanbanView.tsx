import React, { useState, useEffect } from "react";
import { KanbanColumn, KanbanCard, FeatureFlags } from "../types";
import { parseMarkdownToKanban, kanbanToMarkdown } from "../utils/kanbanParser";
import { Plus, Trash2, CheckSquare, Square, GripVertical } from "lucide-react";

interface KanbanViewProps {
  content: string;
  onChange: (newContent: string) => void;
  noteTitle?: string;
  textDirection?: "auto" | "rtl" | "ltr";
  features?: FeatureFlags;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  content,
  onChange,
  noteTitle = "Kanban Board",
  textDirection = "auto",
}) => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [preamble, setPreamble] = useState("");
  const [newCardTexts, setNewCardTexts] = useState<Record<string, string>>({});
  const [addingCardColId, setAddingCardColId] = useState<string | null>(null);
  const [draggedCardInfo, setDraggedCardInfo] = useState<{
    card: KanbanCard;
    sourceColId: string;
  } | null>(null);

  useEffect(() => {
    const parsed = parseMarkdownToKanban(content);
    setColumns(parsed.columns);
    setPreamble(parsed.preamble);
  }, [content]);

  const updateColumns = (newCols: KanbanColumn[]) => {
    setColumns(newCols);
    const md = kanbanToMarkdown(newCols, preamble);
    onChange(md);
  };

  const handleAddCard = (colId: string) => {
    const text = (newCardTexts[colId] || "").trim();
    if (!text) return;

    const tags = (text.match(/#[a-zA-Z0-9_\u0600-\u06FF]+/g) || []).map((t) => t.slice(1));
    const newCard: KanbanCard = {
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      content: text,
      isTask: true,
      completed: false,
      tags,
    };

    const newCols = columns.map((col) => {
      if (col.id === colId) {
        return { ...col, cards: [...col.cards, newCard] };
      }
      return col;
    });

    setNewCardTexts((prev) => ({ ...prev, [colId]: "" }));
    setAddingCardColId(null);
    updateColumns(newCols);
  };

  const handleDeleteCard = (colId: string, cardId: string) => {
    const newCols = columns.map((col) => {
      if (col.id === colId) {
        return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
      }
      return col;
    });
    updateColumns(newCols);
  };

  const handleToggleTask = (colId: string, cardId: string) => {
    const newCols = columns.map((col) => {
      if (col.id === colId) {
        return {
          ...col,
          cards: col.cards.map((c) => (c.id === cardId ? { ...c, completed: !c.completed } : c)),
        };
      }
      return col;
    });
    updateColumns(newCols);
  };

  const handleAddColumn = () => {
    const name = prompt("Enter column name:", "New Column");
    if (!name?.trim()) return;
    const newCol: KanbanColumn = {
      id: `col-${Date.now()}`,
      title: name.trim(),
      cards: [],
    };
    updateColumns([...columns, newCol]);
  };

  const handleDeleteColumn = (colId: string) => {
    if (!confirm("Delete this column and all its cards?")) return;
    updateColumns(columns.filter((c) => c.id !== colId));
  };

  // Drag and drop handlers
  const handleDragStart = (card: KanbanCard, sourceColId: string) => {
    setDraggedCardInfo({ card, sourceColId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetColId: string) => {
    if (!draggedCardInfo) return;
    const { card, sourceColId } = draggedCardInfo;
    if (sourceColId === targetColId) {
      setDraggedCardInfo(null);
      return;
    }

    const newCols = columns.map((col) => {
      if (col.id === sourceColId) {
        return { ...col, cards: col.cards.filter((c) => c.id !== card.id) };
      }
      if (col.id === targetColId) {
        return { ...col, cards: [...col.cards, card] };
      }
      return col;
    });

    setDraggedCardInfo(null);
    updateColumns(newCols);
  };

  return (
    <div
      dir={textDirection === "rtl" ? "rtl" : "ltr"}
      className="w-full h-full bg-bg-primary flex flex-col overflow-hidden select-none"
    >
      {/* Board Top Header */}
      <div className="h-10 px-5 border-b border-border-subtle bg-bg-secondary/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-text-primary">{noteTitle}</span>
          <span className="text-[10px] text-text-faint font-mono">
            ({columns.reduce((acc, c) => acc + c.cards.length, 0)} cards)
          </span>
        </div>
        <button
          onClick={handleAddColumn}
          className="px-2.5 py-1 rounded-md bg-accent-purple/15 hover:bg-accent-purple/25 text-accent-purple text-xs font-medium flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Column</span>
        </button>
      </div>

      {/* Columns Container */}
      <div className="flex-1 overflow-x-auto p-4 flex items-start gap-4">
        {columns.map((col) => (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(col.id)}
            className="w-72 max-h-full flex flex-col bg-bg-card border border-border-subtle rounded-xl shadow-md shrink-0 overflow-hidden"
          >
            {/* Column Header */}
            <div className="px-3.5 py-2.5 bg-bg-secondary/70 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-text-primary">{col.title}</span>
                <span className="w-5 h-5 rounded-full bg-bg-hover text-text-faint text-[10px] flex items-center justify-center font-mono">
                  {col.cards.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAddingCardColId(col.id)}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
                  title="Add card"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteColumn(col.id)}
                  className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-bg-hover"
                  title="Delete column"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Column Cards List */}
            <div className="p-2 overflow-y-auto space-y-2 flex-1 max-h-[calc(100vh-210px)]">
              {col.cards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => handleDragStart(card, col.id)}
                  className={`group p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing shadow-xs ${
                    card.completed
                      ? "bg-bg-secondary/40 border-border-subtle/50 opacity-60"
                      : "bg-bg-primary/90 border-border-subtle hover:border-accent-purple/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {card.isTask ? (
                      <button
                        onClick={() => handleToggleTask(col.id, card.id)}
                        className="mt-0.5 text-accent-purple shrink-0"
                      >
                        {card.completed ? (
                          <CheckSquare className="w-4 h-4 text-accent-green" />
                        ) : (
                          <Square className="w-4 h-4 text-text-muted" />
                        )}
                      </button>
                    ) : (
                      <GripVertical className="w-3.5 h-3.5 text-text-faint opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 text-xs text-text-primary leading-relaxed break-words">
                      <span className={card.completed ? "line-through text-text-faint" : ""}>
                        {card.content}
                      </span>

                      {/* Tag badges */}
                      {card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {card.tags.map((tg) => (
                            <span
                              key={tg}
                              className="px-1.5 py-0.2 rounded bg-accent-purple/15 text-accent-purple text-[10px] font-mono"
                            >
                              #{tg}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteCard(col.id, card.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent-red transition-opacity rounded hover:bg-bg-hover shrink-0"
                      title="Delete card"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* In-place Add Card Input */}
              {addingCardColId === col.id ? (
                <div className="p-2 rounded-lg bg-bg-secondary border border-accent-purple/50 space-y-2">
                  <textarea
                    autoFocus
                    placeholder="Enter card title..."
                    value={newCardTexts[col.id] || ""}
                    onChange={(e) =>
                      setNewCardTexts((prev) => ({ ...prev, [col.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddCard(col.id);
                      }
                      if (e.key === "Escape") setAddingCardColId(null);
                    }}
                    className="w-full bg-bg-primary border border-border-subtle rounded p-2 text-xs text-text-primary outline-none resize-none focus:border-accent-purple"
                    rows={2}
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setAddingCardColId(null)}
                      className="px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAddCard(col.id)}
                      className="px-2.5 py-1 rounded bg-accent-purple hover:bg-accent-purple-hover text-white text-[11px] font-medium"
                    >
                      Add Card
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingCardColId(col.id)}
                  className="w-full py-2 rounded-lg border border-dashed border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-purple hover:bg-bg-hover/50 text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Card</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
