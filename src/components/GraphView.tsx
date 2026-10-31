import React, { useEffect, useRef, useState, useMemo } from "react";
import { GraphData, GraphNode } from "../types";
import { Search, Eye, RefreshCw } from "lucide-react";

interface GraphViewProps {
  data: GraphData;
  onSelectNode: (title: string) => void;
  onRefresh: () => void;
}

export const GraphView: React.FC<GraphViewProps> = ({
  data,
  onSelectNode,
  onRefresh,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [hideOrphans, setHideOrphans] = useState(false);

  // Transform (pan & zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNode = useRef<GraphNode | null>(null);
  const hoveredNode = useRef<GraphNode | null>(null);

  // Physics simulation state
  const nodesRef = useRef<GraphNode[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const isSimulating = useRef(true);

  // Collect unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    data.nodes.forEach((n) => n.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [data]);

  // Filtered nodes and links
  const { filteredNodes, filteredLinks } = useMemo(() => {
    let nodes = data.nodes;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      nodes = nodes.filter((n) => n.label.toLowerCase().includes(q));
    }

    if (selectedTag !== "all") {
      nodes = nodes.filter((n) => n.tags.includes(selectedTag));
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = data.links.filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    if (hideOrphans) {
      const connected = new Set<string>();
      links.forEach((l) => {
        connected.add(l.source);
        connected.add(l.target);
      });
      nodes = nodes.filter((n) => connected.has(n.id));
    }

    return { filteredNodes: nodes, filteredLinks: links };
  }, [data, searchFilter, selectedTag, hideOrphans]);

  // Initialize node positions
  useEffect(() => {
    const width = 800;
    const height = 600;
    const existing = new Map(nodesRef.current.map((n) => [n.id, n]));

    nodesRef.current = filteredNodes.map((node) => {
      const old = existing.get(node.id);
      return {
        ...node,
        x: old?.x ?? width / 2 + (Math.random() - 0.5) * 350,
        y: old?.y ?? height / 2 + (Math.random() - 0.5) * 350,
        vx: 0,
        vy: 0,
      };
    });

    isSimulating.current = true;
    startSimulation();
  }, [filteredNodes, filteredLinks]);

  // Physics simulation with equilibrium convergence
  const startSimulation = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let totalEnergy = 100;
    const damping = 0.88;
    const repulsion = 450;
    const springLength = 70;
    const springK = 0.05;

    const tick = () => {
      const nodes = nodesRef.current;
      const links = filteredLinks;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      let currentEnergy = 0;

      // 1. Repulsion between nodes (Coulomb force)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);

          if (dist < 400) {
            const force = repulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (a !== draggedNode.current) {
              a.vx = (a.vx ?? 0) - fx;
              a.vy = (a.vy ?? 0) - fy;
            }
            if (b !== draggedNode.current) {
              b.vx = (b.vx ?? 0) + fx;
              b.vy = (b.vy ?? 0) + fy;
            }
          }
        }
      }

      // 2. Spring attraction along links (Hooke's law)
      for (const link of links) {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (source && target) {
          const dx = (target.x ?? 0) - (source.x ?? 0);
          const dy = (target.y ?? 0) - (source.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - springLength) * springK;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source !== draggedNode.current) {
            source.vx = (source.vx ?? 0) + fx;
            source.vy = (source.vy ?? 0) + fy;
          }
          if (target !== draggedNode.current) {
            target.vx = (target.vx ?? 0) - fx;
            target.vy = (target.vy ?? 0) - fy;
          }
        }
      }

      // 3. Center gravity & velocity update
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      for (const node of nodes) {
        if (node === draggedNode.current) continue;

        // Weak pull toward center
        const dx = cx - (node.x ?? cx);
        const dy = cy - (node.y ?? cy);
        node.vx = ((node.vx ?? 0) + dx * 0.002) * damping;
        node.vy = ((node.vy ?? 0) + dy * 0.002) * damping;

        node.x = (node.x ?? 0) + (node.vx ?? 0);
        node.y = (node.y ?? 0) + (node.vy ?? 0);

        currentEnergy += Math.abs(node.vx ?? 0) + Math.abs(node.vy ?? 0);
      }

      totalEnergy = currentEnergy;

      // Render frame
      renderCanvas(ctx, canvas.width, canvas.height);

      // Equilibrium check: stop calculations when energy drops low enough
      if (totalEnergy > 0.1 || draggedNode.current) {
        animationFrameId.current = requestAnimationFrame(tick);
      } else {
        isSimulating.current = false;
        // Do one final crisp render
        renderCanvas(ctx, canvas.width, canvas.height);
      }
    };

    animationFrameId.current = requestAnimationFrame(tick);
  };

  const renderCanvas = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    const nodes = nodesRef.current;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Draw Links
    for (const link of filteredLinks) {
      const src = nodeMap.get(link.source);
      const tgt = nodeMap.get(link.target);
      if (src && tgt && src.x !== undefined && tgt.x !== undefined) {
        const isHighlighted =
          hoveredNode.current &&
          (hoveredNode.current.id === src.id || hoveredNode.current.id === tgt.id);

        ctx.strokeStyle = isHighlighted ? "#7b6cd9" : "#383838";
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y!);
        ctx.lineTo(tgt.x, tgt.y!);
        ctx.stroke();
      }
    }

    // Draw Nodes
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue;

      const isHovered = hoveredNode.current?.id === node.id;
      const baseRadius = 4 + Math.min(node.link_count * 1.5, 12);
      const radius = isHovered ? baseRadius + 3 : baseRadius;

      // Circle
      ctx.fillStyle = isHovered ? "#9283ed" : "#7b6cd9";
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = isHovered ? "#ffffff" : "#262626";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      if (transform.scale > 0.7 || isHovered || node.link_count > 3) {
        ctx.fillStyle = isHovered ? "#ffffff" : "#999999";
        ctx.font = `${isHovered ? "bold " : ""}11px -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + radius + 12);
      }
    }

    ctx.restore();
  };

  // Mouse event handlers for Pan, Zoom, and Drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;

    // Check if clicked a node
    for (const node of nodesRef.current) {
      if (node.x !== undefined && node.y !== undefined) {
        const dist = Math.hypot(node.x - mouseX, node.y - mouseY);
        if (dist <= 12) {
          draggedNode.current = node;
          startSimulation();
          return;
        }
      }
    }

    // Otherwise drag canvas
    isDraggingCanvas.current = true;
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (draggedNode.current) {
      draggedNode.current.x = (e.clientX - rect.left - transform.x) / transform.scale;
      draggedNode.current.y = (e.clientY - rect.top - transform.y) / transform.scale;
      draggedNode.current.vx = 0;
      draggedNode.current.vy = 0;
      return;
    }

    if (isDraggingCanvas.current) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      }));
      return;
    }

    // Check hover
    const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;
    let found: GraphNode | null = null;
    for (const node of nodesRef.current) {
      if (node.x !== undefined && node.y !== undefined) {
        if (Math.hypot(node.x - mouseX, node.y - mouseY) <= 12) {
          found = node;
          break;
        }
      }
    }

    if (hoveredNode.current !== found) {
      hoveredNode.current = found;
      if (!isSimulating.current) {
        const ctx = canvas.getContext("2d");
        if (ctx) renderCanvas(ctx, canvas.width, canvas.height);
      }
    }
  };

  const handleMouseUp = () => {
    if (draggedNode.current) {
      draggedNode.current = null;
    }
    isDraggingCanvas.current = false;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;

    for (const node of nodesRef.current) {
      if (node.x !== undefined && node.y !== undefined) {
        if (Math.hypot(node.x - mouseX, node.y - mouseY) <= 12) {
          onSelectNode(node.label);
          return;
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((prev) => {
      const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.2), 4.0);
      return {
        ...prev,
        scale: newScale,
      };
    });
  };

  // Resize canvas to parent
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) renderCanvas(ctx, canvas.width, canvas.height);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [transform]);

  return (
    <div className="relative w-full h-full bg-bg-primary overflow-hidden select-none">
      {/* Top Filter Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-bg-secondary/90 backdrop-blur border border-border-subtle rounded-lg px-2.5 py-1.5 shadow-md pointer-events-auto">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-faint w-28 focus:w-44 transition-all"
          />

          {allTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-bg-card border border-border-subtle text-xs text-text-muted rounded px-2 py-0.5 outline-none cursor-pointer"
            >
              <option value="all">All Tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setHideOrphans(!hideOrphans)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              hideOrphans
                ? "bg-accent-purple/20 text-accent-purple"
                : "text-text-muted hover:text-text-primary"
            }`}
            title="Toggle Orphan Nodes"
          >
            Orphans
          </button>
        </div>

        <div className="flex items-center gap-1 bg-bg-secondary/90 backdrop-blur border border-border-subtle rounded-lg p-1 shadow-md pointer-events-auto">
          <button
            onClick={onRefresh}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
            title="Reload Graph"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
            title="Reset View"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
