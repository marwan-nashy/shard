export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface SearchResult {
  title: string;
  path: string;
  snippet: string;
}

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  tags: string[];
  link_count: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface BacklinkItem {
  source_title: string;
  source_path: string;
  snippet: string;
  line_number: number;
}

export interface BacklinksData {
  linked_mentions: BacklinkItem[];
  unlinked_mentions: BacklinkItem[];
}

export interface TabItem {
  path: string;
  title: string;
  isDirty?: boolean;
}

export type ViewMode = 'live' | 'source';
export type SidebarTab = 'files' | 'search' | 'tags' | 'outline';
export type RightSidebarTab = 'backlinks' | 'outline';

export interface OutlineItem {
  level: number;
  title: string;
  line: number;
}

export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  shortcut?: string;
  category?: string;
  action: () => void;
}

export interface CanvasNodeData {
  id: string;
  type: "text" | "file";
  text?: string;
  file?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface CanvasEdgeData {
  id: string;
  fromNode: string;
  toNode: string;
}

export interface CanvasData {
  nodes: CanvasNodeData[];
  edges: CanvasEdgeData[];
}
