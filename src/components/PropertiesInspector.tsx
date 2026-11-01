import React, { useState } from "react";
import { FrontmatterProperty, FeatureFlags } from "../types";
import { parseFrontmatter, serializeFrontmatter } from "../utils/yamlFrontmatter";
import { ChevronDown, ChevronRight, Plus, Trash2, Tag, Calendar, CheckSquare, Type, Hash, Sliders } from "lucide-react";

interface PropertiesInspectorProps {
  content: string;
  onChange: (newContent: string) => void;
  features?: FeatureFlags;
}

export const PropertiesInspector: React.FC<PropertiesInspectorProps> = ({ content, onChange }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [newTagInput, setNewTagInput] = useState<{ [key: string]: string }>({});

  const { hasFrontmatter, properties, body } = parseFrontmatter(content);

  const handleUpdateProperties = (newProps: FrontmatterProperty[]) => {
    const updated = serializeFrontmatter(newProps, body);
    onChange(updated);
  };

  const handlePropertyChange = (key: string, value: any) => {
    const newProps = properties.map((p) => (p.key === key ? { ...p, value } : p));
    handleUpdateProperties(newProps);
  };

  const handleDeleteProperty = (key: string) => {
    const newProps = properties.filter((p) => p.key !== key);
    handleUpdateProperties(newProps);
  };

  const handleAddProperty = () => {
    const key = prompt("Enter property name (e.g., status, author, priority):");
    if (!key?.trim()) return;
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");
    if (properties.some((p) => p.key === cleanKey)) return;

    const newProp: FrontmatterProperty = {
      key: cleanKey,
      value: cleanKey === "tags" ? [] : "",
      type: cleanKey === "tags" ? "tags" : "text",
    };
    handleUpdateProperties([...properties, newProp]);
  };

  const handleInitializeFrontmatter = () => {
    const initialProps: FrontmatterProperty[] = [
      { key: "tags", value: [], type: "tags" },
      { key: "status", value: "active", type: "text" },
      { key: "created", value: new Date().toISOString().split("T")[0], type: "date" },
    ];
    handleUpdateProperties(initialProps);
    setIsExpanded(true);
  };

  const handleAddTag = (propKey: string) => {
    const tag = (newTagInput[propKey] || "").trim().replace(/^#/, "");
    if (!tag) return;
    const prop = properties.find((p) => p.key === propKey);
    if (!prop) return;
    const currentTags = Array.isArray(prop.value) ? prop.value : [];
    if (!currentTags.includes(tag)) {
      handlePropertyChange(propKey, [...currentTags, tag]);
    }
    setNewTagInput((prev) => ({ ...prev, [propKey]: "" }));
  };

  const handleRemoveTag = (propKey: string, tagToRemove: string) => {
    const prop = properties.find((p) => p.key === propKey);
    if (!prop) return;
    const currentTags = Array.isArray(prop.value) ? prop.value : [];
    handlePropertyChange(
      propKey,
      currentTags.filter((t: string) => t !== tagToRemove)
    );
  };

  const getPropIcon = (type: FrontmatterProperty["type"], key: string) => {
    if (key === "tags" || type === "tags") return <Tag className="w-3.5 h-3.5 text-accent-purple" />;
    if (type === "date") return <Calendar className="w-3.5 h-3.5 text-accent-blue" />;
    if (type === "checkbox") return <CheckSquare className="w-3.5 h-3.5 text-accent-emerald" />;
    if (type === "number") return <Hash className="w-3.5 h-3.5 text-accent-orange" />;
    return <Type className="w-3.5 h-3.5 text-text-muted" />;
  };

  if (!hasFrontmatter) {
    return (
      <div className="px-5 py-2 select-none border-b border-border-subtle/40 bg-bg-secondary/20">
        <button
          onClick={handleInitializeFrontmatter}
          className="text-[11px] text-text-faint hover:text-accent-purple flex items-center gap-1.5 transition-colors group"
        >
          <Sliders className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" />
          <span>+ Add Note Properties (YAML Frontmatter)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-border-subtle bg-bg-secondary/40 select-none text-xs">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-hover/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-faint" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-faint" />
          )}
          <span className="font-semibold text-text-muted uppercase text-[10px] tracking-wider">
            Properties
          </span>
          <span className="text-[10px] text-text-faint font-mono px-1.5 py-0.2 rounded bg-bg-hover">
            {properties.length}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddProperty();
          }}
          className="p-1 rounded text-text-muted hover:text-accent-purple hover:bg-bg-hover transition-colors flex items-center gap-1 text-[11px]"
          title="Add Property"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add property</span>
        </button>
      </div>

      {/* Properties List */}
      {isExpanded && (
        <div className="px-5 pb-3 pt-1 space-y-1.5">
          {properties.map((prop) => (
            <div
              key={prop.key}
              className="flex items-center gap-3 group py-0.5 hover:bg-bg-hover/30 px-1.5 rounded transition-colors"
            >
              <div className="w-28 shrink-0 flex items-center gap-1.5 text-text-muted">
                {getPropIcon(prop.type, prop.key)}
                <span className="truncate font-mono text-[11px]">{prop.key}</span>
              </div>

              {/* Value renderer by type */}
              <div className="flex-1 min-w-0">
                {prop.type === "tags" || Array.isArray(prop.value) ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(Array.isArray(prop.value) ? prop.value : []).map((t: string) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-purple/15 text-accent-purple text-[10px] font-mono"
                      >
                        <span>#{t}</span>
                        <button
                          onClick={() => handleRemoveTag(prop.key, t)}
                          className="hover:text-red-400 font-bold text-xs leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder="+ tag"
                      value={newTagInput[prop.key] || ""}
                      onChange={(e) =>
                        setNewTagInput((prev) => ({ ...prev, [prop.key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag(prop.key);
                        }
                      }}
                      className="bg-transparent text-[11px] text-text-primary outline-none placeholder:text-text-faint w-16 focus:w-28 transition-all"
                    />
                  </div>
                ) : prop.type === "checkbox" ? (
                  <button
                    type="button"
                    onClick={() => handlePropertyChange(prop.key, !prop.value)}
                    className="p-0.5 text-accent-purple"
                  >
                    {prop.value ? (
                      <CheckSquare className="w-4 h-4 text-accent-green" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded border border-border-subtle" />
                    )}
                  </button>
                ) : prop.type === "date" ? (
                  <input
                    type="date"
                    value={prop.value || ""}
                    onChange={(e) => handlePropertyChange(prop.key, e.target.value)}
                    className="bg-transparent text-[11px] text-text-primary outline-none font-mono"
                  />
                ) : (
                  <input
                    type="text"
                    value={prop.value ?? ""}
                    onChange={(e) => handlePropertyChange(prop.key, e.target.value)}
                    placeholder="Empty"
                    className="w-full bg-transparent text-[11px] text-text-primary outline-none placeholder:text-text-faint focus:text-accent-purple"
                  />
                )}
              </div>

              <button
                onClick={() => handleDeleteProperty(prop.key)}
                className="opacity-0 group-hover:opacity-100 p-1 text-text-faint hover:text-accent-red rounded hover:bg-bg-hover transition-opacity"
                title="Delete Property"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
