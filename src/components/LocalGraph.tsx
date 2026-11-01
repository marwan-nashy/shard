import React, { useEffect, useRef, useState, useMemo } from "react";
import { GraphData, GraphNode } from "../types";
import { Maximize2, Share2 } from "lucide-react";

interface LocalGraphProps {
  currentTitle: string;
  graphData: GraphData;
  onSelectNode: (title: string) => void;
  onOpenFullGraph?: () => void;
}

export const LocalGraph: React.FC<LocalGraphProps> = ({
  currentTitle,
  graphData,
  onSelectNode,
  onOpenFullGraph,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [depth, setDepth] = useState<1 | 2>(1);
  const nodesRef = useRef<GraphNode[]>([]);
  const animationFrameId = useRef<number | null>(null);

  // Extract 1-hop or 2-hop subnetwork around currentTitle
  const { localNodes, localLinks } = useMemo(() => {
    if (!currentTitle || !graphData.nodes.length) {
      return { localNodes: [], localLinks: [] };
    }

    const currentLower = currentTitle.toLowerCase();
    const centerNode = graphData.nodes.find(
      (n) => n.label.toLowerCase() === currentLower
    );

    if (!centerNode) {
      // If note isn't in graph yet, display just center
      return {
        localNodes: [
          {
            id: currentTitle,
            label: currentTitle,
            path: "",
            tags: [],
            link_count: 0,
          },
        ],
        localLinks: [],
      };
    }

    const hop1NodeIds = new Set<string>([centerNode.id]);

    // Find all 1-hop links
    graphData.links.forEach((link) => {
      if (link.source === centerNode.id) hop1NodeIds.add(link.target);
      if (link.target === centerNode.id) hop1NodeIds.add(link.source);
    });

    const activeNodeIds = new Set<string>(hop1NodeIds);

    // If depth is 2, find hop 2 neighbors
    if (depth === 2) {
      graphData.links.forEach((link) => {
        if (hop1NodeIds.has(link.source)) activeNodeIds.add(link.target);
        if (hop1NodeIds.has(link.target)) activeNodeIds.add(link.source);
      });
    }

    const filteredNodes = graphData.nodes.filter((n) => activeNodeIds.has(n.id));
    const filteredLinks = graphData.links.filter(
      (l) => activeNodeIds.has(l.source) && activeNodeIds.has(l.target)
    );

    return { localNodes: filteredNodes, localLinks: filteredLinks };
  }, [currentTitle, graphData, depth]);

  // Physics simulation
  useEffect(() => {
    const width = 280;
    const height = 240;

    const existing = new Map(nodesRef.current.map((n) => [n.id, n]));

    nodesRef.current = localNodes.map((n) => {
      const isCenter = n.label.toLowerCase() === currentTitle.toLowerCase();
      const old = existing.get(n.id);
      return {
        ...n,
        x: isCenter
          ? width / 2
          : old?.x ?? width / 2 + (Math.random() - 0.5) * 120,
        y: isCenter
          ? height / 2
          : old?.y ?? height / 2 + (Math.random() - 0.5) * 120,
        vx: 0,
        vy: 0,
      };
    });

    let iter = 0;
    const simulate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const nodes = nodesRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Spring forces
      localLinks.forEach((l) => {
        const s = nodes.find((n) => n.id === l.source);
        const t = nodes.find((n) => n.id === l.target);
        if (!s || !t) return;

        const dx = (t.x || 0) - (s.x || 0);
        const dy = (t.y || 0) - (s.y || 0);
        const dist = Math.hypot(dx, dy) || 1;
        const targetDist = 65;
        const force = (dist - targetDist) * 0.04;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (s.label.toLowerCase() !== currentTitle.toLowerCase()) {
          s.vx = (s.vx || 0) + fx;
          s.vy = (s.vy || 0) + fy;
        }
        if (t.label.toLowerCase() !== currentTitle.toLowerCase()) {
          t.vx = (t.vx || 0) - fx;
          t.vy = (t.vy || 0) - fy;
        }
      });

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = (b.x || 0) - (a.x || 0);
          const dy = (b.y || 0) - (a.y || 0);
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 100) {
            const rep = ((100 - dist) / dist) * 0.4;
            const rx = dx * rep;
            const ry = dy * rep;
            if (a.label.toLowerCase() !== currentTitle.toLowerCase()) {
              a.vx = (a.vx || 0) - rx;
              a.vy = (a.vy || 0) - ry;
            }
            if (b.label.toLowerCase() !== currentTitle.toLowerCase()) {
              b.vx = (b.vx || 0) + rx;
              b.vy = (b.vy || 0) + ry;
            }
          }
        }
      }

      // Center gravity & damping
      nodes.forEach((n) => {
        if (n.label.toLowerCase() !== currentTitle.toLowerCase()) {
          n.vx = (n.vx || 0) + (width / 2 - (n.x || 0)) * 0.01;
          n.vy = (n.vy || 0) + (height / 2 - (n.y || 0)) * 0.01;
          n.vx = (n.vx || 0) * 0.85;
          n.vy = (n.vy || 0) * 0.85;
          n.x = (n.x || 0) + (n.vx || 0);
          n.y = (n.y || 0) + (n.vy || 0);
        } else {
          n.x = width / 2;
          n.y = height / 2;
        }
      });

      // Render
      ctx.clearRect(0, 0, width, height);

      // Links
      ctx.lineWidth = 1;
      localLinks.forEach((l) => {
        const s = nodes.find((n) => n.id === l.source);
        const t = nodes.find((n) => n.id === l.target);
        if (s && t && s.x !== undefined && s.y !== undefined && t.x !== undefined && t.y !== undefined) {
          ctx.strokeStyle = "rgba(123, 108, 217, 0.35)";
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
      });

      // Nodes
      nodes.forEach((n) => {
        if (n.x === undefined || n.y === undefined) return;
        const isCenter = n.label.toLowerCase() === currentTitle.toLowerCase();
        const radius = isCenter ? 7 : 4.5;

        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);

        if (isCenter) {
          ctx.fillStyle = "#7b6cd9";
          ctx.shadowColor = "rgba(123, 108, 217, 0.7)";
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = "#4a90e2";
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.font = isCenter
          ? "600 11px -apple-system, sans-serif"
          : "400 9.5px -apple-system, sans-serif";
        ctx.fillStyle = isCenter ? "#ffffff" : "#a0a0a0";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + (isCenter ? 14 : 11));
      });

      iter++;
      if (iter < 120) {
        animationFrameId.current = requestAnimationFrame(simulate);
      }
    };

    animationFrameId.current = requestAnimationFrame(simulate);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [localNodes, localLinks, currentTitle]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (const node of nodesRef.current) {
      if (node.x !== undefined && node.y !== undefined) {
        if (Math.hypot(node.x - mouseX, node.y - mouseY) <= 12) {
          onSelectNode(node.label);
          return;
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary/40 select-none">
      {/* Header Controls */}
      <div className="h-8 border-b border-border-subtle flex items-center justify-between px-2.5 text-[11px] text-text-muted">
        <div className="flex items-center gap-1.5 font-medium text-text-primary">
          <Share2 className="w-3.5 h-3.5 text-accent-purple" />
          <span>Local Graph</span>
          <span className="text-[10px] text-text-faint">({localNodes.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDepth(depth === 1 ? 2 : 1)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
              depth === 2
                ? "bg-accent-purple/20 text-accent-purple border-accent-purple/30 font-semibold"
                : "border-border-subtle text-text-faint hover:text-text-primary"
            }`}
            title="Toggle Graph Depth (1-hop or 2-hop)"
          >
            {depth}H
          </button>
          {onOpenFullGraph && (
            <button
              onClick={onOpenFullGraph}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
              title="Open Global Graph"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-[220px] relative overflow-hidden bg-bg-primary/50">
        <canvas
          ref={canvasRef}
          width={280}
          height={240}
          onClick={handleClick}
          className="w-full h-full cursor-pointer"
        />
        {localNodes.length <= 1 && (
          <div className="absolute inset-0 flex items-center justify-center text-text-faint text-[11px] pointer-events-none p-4 text-center">
            No connections found for this note yet. Use [[wikilinks]] to link notes!
          </div>
        )}
      </div>
    </div>
  );
};
