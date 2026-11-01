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

export type ViewMode = "live" | "source";
export type SidebarTab =
  | "files"
  | "search"
  | "tags"
  | "outline"
  | "calendar"
  | "tasks"
  | "bookmarks";
export type RightSidebarTab = "backlinks" | "outline" | "localgraph";
export type ThemePreset = "shard" | "oled" | "catppuccin" | "nord" | "paper";

export interface TaskItem {
  id: string;
  path: string;
  noteTitle: string;
  line: number;
  text: string;
  completed: boolean;
}

export interface NoteRevision {
  id: string;
  timestamp: number;
  dateStr: string;
  content: string;
  wordCount: number;
}

export interface BookmarkItem {
  path: string;
  title: string;
  type: "note" | "canvas";
}

export interface TemplateItem {
  id: string;
  title: string;
  description: string;
  content: string;
}

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
  label?: string;
}

export interface CanvasData {
  nodes: CanvasNodeData[];
  edges: CanvasEdgeData[];
}

export interface KanbanCard {
  id: string;
  content: string;
  isTask: boolean;
  completed: boolean;
  tags: string[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface FrontmatterProperty {
  key: string;
  value: any;
  type: "text" | "tags" | "date" | "number" | "checkbox";
}

export interface SyncConfig {
  provider: "none" | "git" | "webdav";
  autoSync: boolean;
  syncIntervalMinutes: number;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  gitRemoteUrl: string;
  gitBranch: string;
  gitToken: string;
  lastSyncTime?: number;
  lastSyncStatus?: "idle" | "success" | "error" | "syncing";
  lastSyncMessage?: string;
}

export interface CustomShortcut {
  id: string;
  title: string;
  defaultKey: string;
  customKey: string;
}

export interface FeatureFlags {
  // Core Views
  graphView: boolean;
  canvasView: boolean;
  kanbanView: boolean;
  dailyNotes: boolean;
  vaultStats: boolean;

  // Left Sidebar Panes
  sidebarSearch: boolean;
  sidebarTags: boolean;
  sidebarCalendar: boolean;
  sidebarTasks: boolean;
  sidebarBookmarks: boolean;

  // Editor & Formatting
  formattingToolbar: boolean;
  propertiesInspector: boolean;
  tableEditor: boolean;
  voiceDictation: boolean;
  audioRecorder: boolean;
  templates: boolean;
  versionHistory: boolean;
  mermaidDiagrams: boolean;
  mathLatex: boolean;
  documentExport: boolean;
  statusBar: boolean;

  // Sync & Storage
  syncManager: boolean;
}

