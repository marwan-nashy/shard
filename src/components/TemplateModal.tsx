import React, { useState, useEffect } from "react";
import { X, Search, FileText, Plus, Sparkles } from "lucide-react";
import { TemplateItem } from "../types";
import { BUILTIN_TEMPLATES, renderTemplate } from "../utils/templateEngine";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteTitle: string;
  onInsertTemplate: (content: string) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  noteTitle,
  onInsertTemplate,
}) => {
  const [query, setQuery] = useState("");
  const [customTemplates, setCustomTemplates] = useState<TemplateItem[]>(() => {
    try {
      const saved = localStorage.getItem("shard_custom_templates");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newContent, setNewContent] = useState("");

  const allTemplates = [...customTemplates, ...BUILTIN_TEMPLATES];

  const filtered = allTemplates.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase())
  );

  const handleSaveCustom = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const newItem: TemplateItem = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || "User custom template",
      content: newContent,
    };
    const updated = [newItem, ...customTemplates];
    setCustomTemplates(updated);
    localStorage.setItem("shard_custom_templates", JSON.stringify(updated));
    setIsCreating(false);
    setNewTitle("");
    setNewDesc("");
    setNewContent("");
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setIsCreating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-bg-card border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-secondary/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-purple" />
            <h3 className="text-xs font-semibold text-text-primary tracking-wide">
              {isCreating ? "Create Custom Template" : "Insert Template"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-2 py-1 rounded bg-bg-card border border-border-subtle text-[11px] text-text-muted hover:text-text-primary flex items-center gap-1 hover:border-accent-purple transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isCreating ? (
          <div className="p-4 space-y-3 overflow-y-auto">
            <div>
              <label className="text-[11px] font-medium text-text-muted">Template Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Bug Report or Sprint Retrospective"
                className="w-full mt-1 bg-bg-secondary border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-muted">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief summary of when to use this template"
                className="w-full mt-1 bg-bg-secondary border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-text-muted">Template Markdown</label>
                <span className="text-[10px] text-accent-purple font-mono">
                  Supported: {"{{title}}"}, {"{{date}}"}, {"{{time}}"}, {"{{weekday}}"}
                </span>
              </div>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={8}
                placeholder="# {{title}}\nDate: {{date}}\n\n## Notes\n- [ ] "
                className="w-full mt-1 bg-bg-secondary border border-border-subtle rounded-lg p-3 text-xs text-text-primary font-mono outline-none focus:border-accent-purple"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustom}
                disabled={!newTitle.trim() || !newContent.trim()}
                className="px-4 py-1.5 text-xs text-white bg-accent-purple hover:bg-accent-purpleHover rounded font-medium disabled:opacity-50 transition-colors"
              >
                Save Template
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-3 border-b border-border-subtle">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-faint" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-8 pr-3 py-1.5 bg-bg-secondary border border-border-subtle rounded-lg text-xs text-text-primary outline-none focus:border-accent-purple"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-border-subtle/40">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-text-faint text-xs">
                  No templates matching "{query}"
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      const rendered = renderTemplate(item.content, noteTitle);
                      onInsertTemplate(rendered);
                      onClose();
                    }}
                    className="p-3 rounded-lg hover:bg-bg-hover cursor-pointer transition-colors group flex items-start justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-accent-purple" />
                        <span className="text-xs font-semibold text-text-primary group-hover:text-accent-purple">
                          {item.title}
                        </span>
                        {item.id.startsWith("custom-") && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded bg-accent-blue/15 text-accent-blue font-mono">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <span className="text-[10px] text-text-faint opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                      Click to insert &rarr;
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
