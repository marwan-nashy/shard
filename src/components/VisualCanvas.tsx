import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Move,
  ZoomIn,
  ZoomOut,
  Save,
  Trash2,
  RotateCcw,
  FileText,
  FilePlus,
  Palette,
  ExternalLink,
} from "lucide-react";
import { CanvasNodeData, CanvasEdgeData } from "../types";

interface VisualCanvasProps {
  canvasPath?: string | null;
  initialContent?: string;
  onSave?: (json: string) => void;
  allNotes?: { title: string; path: string }[];
  onOpenNote?: (path: string) => void;
}

const COLOR_CLASSES: Record<
  string,
  { bg: string; border: string; header: string; accent: string }
> = {
  default: {
    bg: "bg-bg-card",
    border: "border-border-subtle",
    header: "bg-bg-secondary/70",
    accent: "bg-neutral-600",
  },
  purple: {
    bg: "bg-[#231a33]",
    border: "border-[#7b6cd9]/70",
    header: "bg-[#191326]",
    accent: "bg-[#7b6cd9]",
  },
  blue: {
    bg: "bg-[#142336]",
    border: "border-[#4a90e2]/70",
    header: "bg-[#0e1a29]",
    accent: "bg-[#4a90e2]",
  },
  green: {
    bg: "bg-[#13291d]",
    border: "border-[#56b075]/70",
    header: "bg-[#0d1e15]",
    accent: "bg-[#56b075]",
  },
  orange: {
    bg: "bg-[#2e1d0f]",
    border: "border-[#e6963c]/70",
    header: "bg-[#24160a]",
    accent: "bg-[#e6963c]",
  },
  red: {
    bg: "bg-[#2e1417]",
    border: "border-[#e05353]/70",
    header: "bg-[#240e11]",
    accent: "bg-[#e05353]",
  },
};

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
  canvasPath,
  initialContent,
  onSave,
  allNotes = [],
  onOpenNote,
}) => {
  const [nodes, setNodes] = useState<CanvasNodeData[]>([
    {
      id: "node-1",
      type: "text",
      text: "# Ideas & Thoughts\nDouble-click anywhere to add new cards.\nDrag handles on borders to connect concepts.",
      x: 100,
      y: 100,
      width: 280,
      height: 160,
      color: "purple",
    },
    {
      id: "node-2",
      type: "text",
      text: "### Connected Concept\n- Drag to move cards\n- Drag bottom-right corner to resize\n- Change card colors",
      x: 480,
      y: 120,
      width: 260,
      height: 150,
      color: "blue",
    },
  ]);

  const [edges, setEdges] = useState<CanvasEdgeData[]>([
    {
      id: "edge-1",
      fromNode: "node-1",
      toNode: "node-2",
    },
  ]);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [colorMenuNodeId, setColorMenuNodeId] = useState<string | null>(null);

  // Dragging Board state
  const isDraggingBoard = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Dragging Node state
  const draggedNodeId = useRef<string | null>(null);
  const nodeOffset = useRef({ x: 0, y: 0 });

  // Resizing Node state
  const resizingNodeId = useRef<string | null>(null);
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  // Connecting Edge state
  const connectingState = useRef<{
    fromNodeId: string;
    fromX: number;
    fromY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [activeConnection, setActiveConnection] = useState<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial content safely (must be JSON and canvasPath must be a .canvas file)
  useEffect(() => {
    if (canvasPath && !canvasPath.endsWith(".canvas")) return;

    if (initialContent && initialContent.trim()) {
      try {
        const parsed = JSON.parse(initialContent);
        if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          setNodes(parsed.nodes);
        }
        if (Array.isArray(parsed.edges)) {
          setEdges(parsed.edges);
        }
      } catch (e) {
        console.warn("Could not parse canvas JSON:", e);
      }
    }
  }, [initialContent, canvasPath]);

  // Debounced auto-save
  useEffect(() => {
    if (!onSave || !canvasPath || !canvasPath.endsWith(".canvas")) return;

    const timer = setTimeout(() => {
      setSaveStatus("saving");
      const canvasData = { nodes, edges };
      onSave(JSON.stringify(canvasData, null, 2));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    }, 700);

    return () => clearTimeout(timer);
  }, [nodes, edges, canvasPath, onSave]);

  // Window global mouse move & mouse up to ensure fluid, non-sticky dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 1. Resizing Node
      if (resizingNodeId.current) {
        const deltaX = (e.clientX - resizeStart.current.mouseX) / transform.scale;
        const deltaY = (e.clientY - resizeStart.current.mouseY) / transform.scale;
        const newW = Math.max(resizeStart.current.w + deltaX, 180);
        const newH = Math.max(resizeStart.current.h + deltaY, 100);

        setNodes((prev) =>
          prev.map((n) =>
            n.id === resizingNodeId.current
              ? { ...n, width: Math.round(newW), height: Math.round(newH) }
              : n
          )
        );
        return;
      }

      // 2. Dragging Node
      if (draggedNodeId.current) {
        const newX = (e.clientX - transform.x) / transform.scale - nodeOffset.current.x;
        const newY = (e.clientY - transform.y) / transform.scale - nodeOffset.current.y;

        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggedNodeId.current
              ? { ...n, x: Math.round(newX), y: Math.round(newY) }
              : n
          )
        );
        return;
      }

      // 3. Creating Edge
      if (connectingState.current) {
        const toX = (e.clientX - transform.x) / transform.scale;
        const toY = (e.clientY - transform.y) / transform.scale;
        setActiveConnection({
          fromX: connectingState.current.fromX,
          fromY: connectingState.current.fromY,
          toX,
          toY,
        });
        return;
      }

      // 4. Panning Board
      if (isDraggingBoard.current) {
        setTransform((prev) => ({
          ...prev,
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y,
        }));
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      // If we were connecting an edge, check if mouse released over a target node
      if (connectingState.current) {
        const targetElement = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest(".canvas-node");
        const targetNodeId = targetElement?.getAttribute("data-node-id");

        if (
          targetNodeId &&
          targetNodeId !== connectingState.current.fromNodeId
        ) {
          const fromId = connectingState.current.fromNodeId;
          const toId = targetNodeId;
          // Avoid duplicate edges
          setEdges((prev) => {
            if (prev.some((ed) => ed.fromNode === fromId && ed.toNode === toId)) {
              return prev;
            }
            return [
              ...prev,
              {
                id: `edge-${Date.now()}`,
                fromNode: fromId,
                toNode: toId,
              },
            ];
          });
        }
      }

      isDraggingBoard.current = false;
      draggedNodeId.current = null;
      resizingNodeId.current = null;
      connectingState.current = null;
      setActiveConnection(null);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [transform]);

  // Board mouse down (panning)
  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-node") || (e.target as HTMLElement).closest(".canvas-toolbar")) {
      return;
    }
    setColorMenuNodeId(null);
    isDraggingBoard.current = true;
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  // Double click board to create card
  const handleBoardDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-node") || (e.target as HTMLElement).closest(".canvas-toolbar")) {
      return;
    }
    const canvasX = Math.round((e.clientX - transform.x) / transform.scale - 130);
    const canvasY = Math.round((e.clientY - transform.y) / transform.scale - 75);

    addCardAt(canvasX, canvasY);
  };

  // Mouse wheel zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.25), 3.0);

    // Zoom towards mouse position
    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = e.clientX - (rect?.left || 0);
    const mouseY = e.clientY - (rect?.top || 0);

    const newX = mouseX - ((mouseX - transform.x) / transform.scale) * newScale;
    const newY = mouseY - ((mouseY - transform.y) / transform.scale) * newScale;

    setTransform({
      x: newX,
      y: newY,
      scale: newScale,
    });
  };

  const addCardAt = (x: number, y: number, text = "New note idea...") => {
    const id = `node-${Date.now()}`;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "text",
        text,
        x,
        y,
        width: 260,
        height: 150,
        color: "default",
      },
    ]);
  };

  const addNoteCard = (noteTitle: string, notePath: string) => {
    const id = `node-${Date.now()}`;
    const x = Math.round((-transform.x + 350) / transform.scale);
    const y = Math.round((-transform.y + 200) / transform.scale);

    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "file",
        file: notePath,
        text: `### [[${noteTitle}]]\nNote reference from vault`,
        x,
        y,
        width: 270,
        height: 140,
        color: "purple",
      },
    ]);
    setShowNotePicker(false);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.fromNode !== id && e.toNode !== id));
  };

  const deleteEdge = (id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
  };

  const changeNodeColor = (id: string, color: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, color } : n))
    );
    setColorMenuNodeId(null);
  };

  const handleManualSave = () => {
    if (!onSave) return;
    const canvasData = { nodes, edges };
    onSave(JSON.stringify(canvasData, null, 2));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 1500);
  };

  const canvasTitle = canvasPath
    ? canvasPath.split(/[\\/]/).pop()?.replace(/\.canvas$/, "")
    : "Canvas";

  // Calculate Bezier curve between two cards
  const getEdgePath = (fromNode: CanvasNodeData, toNode: CanvasNodeData) => {
    const fromCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
    const toCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    let startX: number, startY: number, endX: number, endY: number;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      if (dx > 0) {
        startX = fromNode.x + fromNode.width;
        startY = fromCenter.y;
        endX = toNode.x;
        endY = toCenter.y;
      } else {
        startX = fromNode.x;
        startY = fromCenter.y;
        endX = toNode.x + toNode.width;
        endY = toCenter.y;
      }
      const midX = (startX + endX) / 2;
      return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    } else {
      // Vertical connection
      if (dy > 0) {
        startX = fromCenter.x;
        startY = fromNode.y + fromNode.height;
        endX = toCenter.x;
        endY = toNode.y;
      } else {
        startX = fromCenter.x;
        startY = fromNode.y;
        endX = toCenter.x;
        endY = toNode.y + toNode.height;
      }
      const midY = (startY + endY) / 2;
      return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#141414] overflow-hidden select-none font-sans"
      onMouseDown={handleBoardMouseDown}
      onDoubleClick={handleBoardDoubleClick}
      onWheel={handleWheel}
      style={{
        backgroundImage: "radial-gradient(circle, #252525 1.2px, transparent 1.2px)",
        backgroundSize: "28px 28px",
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        cursor: isDraggingBoard.current ? "grabbing" : "default",
      }}
    >
      {/* Floating Canvas Top Toolbar */}
      <div className="canvas-toolbar absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-bg-secondary/95 backdrop-blur border border-border-subtle rounded-lg p-1.5 shadow-2xl">
        <span className="text-xs font-semibold text-text-primary px-2 border-r border-border-subtle flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-purple" />
          <span>{canvasTitle}</span>
        </span>

        {/* Add Card Button */}
        <button
          onClick={() => {
            const x = Math.round((-transform.x + 350) / transform.scale);
            const y = Math.round((-transform.y + 200) / transform.scale);
            addCardAt(x, y);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-text-primary bg-bg-card hover:bg-bg-hover border border-border-subtle rounded transition-colors"
          title="Add Text Card (or double-click anywhere on the canvas)"
        >
          <Plus className="w-3.5 h-3.5 text-accent-purple" />
          <span>Add Card</span>
        </button>

        {/* Add Note Card Button */}
        <button
          onClick={() => setShowNotePicker(!showNotePicker)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary bg-bg-card hover:bg-bg-hover border border-border-subtle rounded transition-colors"
          title="Add Note Reference Card"
        >
          <FilePlus className="w-3.5 h-3.5 text-accent-blue" />
          <span>Add Note</span>
        </button>

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Zoom Controls */}
        <button
          onClick={() => setTransform((p) => ({ ...p, scale: Math.min(p.scale * 1.2, 3) }))}
          className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setTransform((p) => ({ ...p, scale: Math.max(p.scale / 1.2, 0.25) }))}
          className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover text-xs font-mono"
          title="Reset Zoom (100%)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Save Button */}
        <button
          onClick={handleManualSave}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors font-medium ${
            saveStatus === "saved"
              ? "bg-accent-green text-white"
              : "bg-accent-purple hover:bg-accent-purpleHover text-white"
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saveStatus === "saved" ? "Saved!" : "Save"}</span>
        </button>
      </div>

      {/* Note Picker Dropdown */}
      {showNotePicker && (
        <div className="absolute top-14 left-3 z-40 w-64 bg-bg-card border border-border-subtle rounded-lg shadow-2xl p-2 space-y-1">
          <div className="text-[11px] font-semibold text-text-muted uppercase px-2 py-1">
            Pick a note to embed:
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {allNotes.length === 0 ? (
              <div className="text-xs text-text-faint p-2 text-center">No notes in vault</div>
            ) : (
              allNotes.map((note) => (
                <div
                  key={note.path}
                  onClick={() => addNoteCard(note.title, note.path)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover cursor-pointer text-xs text-text-primary"
                >
                  <FileText className="w-3.5 h-3.5 text-accent-purple shrink-0" />
                  <span className="truncate">{note.title}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SVG Connecting Edges Layer */}
      <svg
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        <defs>
          <marker
            id="shard-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#7b6cd9" />
          </marker>
        </defs>

        {/* Render Saved Edges */}
        {edges.map((edge) => {
          const fromNode = nodes.find((n) => n.id === edge.fromNode);
          const toNode = nodes.find((n) => n.id === edge.toNode);
          if (!fromNode || !toNode) return null;

          const pathD = getEdgePath(fromNode, toNode);

          return (
            <g key={edge.id} className="group pointer-events-auto cursor-pointer">
              {/* Invisible wide hit area for easy edge clicking */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="18"
                onClick={() => deleteEdge(edge.id)}
              />
              {/* Visible edge line */}
              <path
                d={pathD}
                fill="none"
                stroke="#7b6cd9"
                strokeWidth="2.2"
                strokeOpacity="0.85"
                markerEnd="url(#shard-arrow)"
                className="group-hover:stroke-accent-red group-hover:stroke-[3] transition-all"
                onClick={() => deleteEdge(edge.id)}
              />
            </g>
          );
        })}

        {/* Render Active Dragging Connection Line */}
        {activeConnection && (
          <path
            d={`M ${activeConnection.fromX} ${activeConnection.fromY} L ${activeConnection.toX} ${activeConnection.toY}`}
            fill="none"
            stroke="#a855f7"
            strokeWidth="2"
            strokeDasharray="5,5"
            markerEnd="url(#shard-arrow)"
          />
        )}
      </svg>

      {/* Board Elements (Cards) */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          width: "100%",
          height: "100%",
        }}
      >
        {nodes.map((node) => {
          const colorTheme = COLOR_CLASSES[node.color || "default"] || COLOR_CLASSES.default;
          const isNoteCard = node.type === "file";

          return (
            <div
              key={node.id}
              data-node-id={node.id}
              style={{
                position: "absolute",
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
              }}
              className={`canvas-node pointer-events-auto ${colorTheme.bg} border ${colorTheme.border} rounded-xl shadow-2xl flex flex-col overflow-visible group transition-shadow hover:shadow-[0_0_20px_rgba(123,108,217,0.25)]`}
            >
              {/* 4 Connection Handle Ports (Top, Right, Bottom, Left) */}
              {/* Top Handle */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  connectingState.current = {
                    fromNodeId: node.id,
                    fromX: node.x + node.width / 2,
                    fromY: node.y,
                    currentX: node.x + node.width / 2,
                    currentY: node.y,
                  };
                }}
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-accent-purple/80 hover:bg-accent-purple border-2 border-[#1e1e1e] cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-30"
                title="Drag to connect another card"
              />
              {/* Right Handle */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  connectingState.current = {
                    fromNodeId: node.id,
                    fromX: node.x + node.width,
                    fromY: node.y + node.height / 2,
                    currentX: node.x + node.width,
                    currentY: node.y + node.height / 2,
                  };
                }}
                className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent-purple/80 hover:bg-accent-purple border-2 border-[#1e1e1e] cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-30"
                title="Drag to connect another card"
              />
              {/* Bottom Handle */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  connectingState.current = {
                    fromNodeId: node.id,
                    fromX: node.x + node.width / 2,
                    fromY: node.y + node.height,
                    currentX: node.x + node.width / 2,
                    currentY: node.y + node.height,
                  };
                }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-accent-purple/80 hover:bg-accent-purple border-2 border-[#1e1e1e] cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-30"
                title="Drag to connect another card"
              />
              {/* Left Handle */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  connectingState.current = {
                    fromNodeId: node.id,
                    fromX: node.x,
                    fromY: node.y + node.height / 2,
                    currentX: node.x,
                    currentY: node.y + node.height / 2,
                  };
                }}
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent-purple/80 hover:bg-accent-purple border-2 border-[#1e1e1e] cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-30"
                title="Drag to connect another card"
              />

              {/* Card Header (Drag Handle & Actions) */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  draggedNodeId.current = node.id;
                  nodeOffset.current = {
                    x: (e.clientX - transform.x) / transform.scale - node.x,
                    y: (e.clientY - transform.y) / transform.scale - node.y,
                  };
                }}
                className={`h-7 ${colorTheme.header} border-b ${colorTheme.border} rounded-t-xl flex items-center justify-between px-2 cursor-grab active:cursor-grabbing text-text-faint hover:text-text-muted`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Move className="w-3 h-3 text-text-muted" />
                  {isNoteCard && (
                    <span className="text-[10px] text-accent-blue font-medium truncate max-w-[120px]">
                      {node.file?.split(/[\\/]/).pop()?.replace(/\.md$/, "")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Open Referenced Note */}
                  {isNoteCard && node.file && onOpenNote && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNote(node.file!);
                      }}
                      className="p-1 hover:text-accent-purple text-text-faint transition-colors"
                      title="Open full note"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}

                  {/* Color Palette Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColorMenuNodeId(colorMenuNodeId === node.id ? null : node.id);
                      }}
                      className="p-1 hover:text-text-primary text-text-faint transition-colors"
                      title="Change color"
                    >
                      <Palette className="w-3 h-3" />
                    </button>

                    {colorMenuNodeId === node.id && (
                      <div className="absolute right-0 top-6 z-50 bg-bg-card border border-border-subtle rounded-lg p-1.5 shadow-2xl flex items-center gap-1">
                        {Object.keys(COLOR_CLASSES).map((colorKey) => (
                          <div
                            key={colorKey}
                            onClick={(e) => {
                              e.stopPropagation();
                              changeNodeColor(node.id, colorKey);
                            }}
                            className={`w-4 h-4 rounded-full cursor-pointer border border-white/20 hover:scale-125 transition-transform ${COLOR_CLASSES[colorKey].accent}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete Card */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                    className="p-1 hover:text-accent-red text-text-faint transition-colors"
                    title="Delete card"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Card Body (Text Area) */}
              <div className="flex-1 p-2 flex flex-col min-h-0">
                <textarea
                  value={node.text || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNodes((prev) =>
                      prev.map((n) => (n.id === node.id ? { ...n, text: val } : n))
                    );
                  }}
                  placeholder="Write note or ideas..."
                  className="flex-1 w-full bg-transparent text-xs text-text-primary outline-none resize-none leading-relaxed placeholder:text-text-faint/60"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>

              {/* Resize Handle (Bottom-Right Corner) */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  resizingNodeId.current = node.id;
                  resizeStart.current = {
                    mouseX: e.clientX,
                    mouseY: e.clientY,
                    w: node.width,
                    h: node.height,
                  };
                }}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 text-text-faint hover:text-accent-purple"
                title="Drag to resize card"
              >
                <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 fill-current">
                  <polygon points="6,0 6,6 0,6" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
