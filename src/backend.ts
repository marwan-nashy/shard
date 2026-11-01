import { invoke } from "@tauri-apps/api/core";
import { FileNode, SearchResult, GraphLink, GraphNode, BacklinkItem } from "./types";

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
};

// In-Browser Virtual Vault for Web / Playground execution
const DEMO_VAULT_KEY = "shard_web_vault_files";

interface VirtualFile {
  path: string;
  name: string;
  isDir: boolean;
  content: string;
}

const DEFAULT_FILES: VirtualFile[] = [
  {
    path: "Web Demo Vault/Welcome to Shard.md",
    name: "Welcome to Shard.md",
    isDir: false,
    content: `# Welcome to Shard (Web Playground)

Shard is an ultra-lightweight, zero-bloat personal knowledge base and visual canvas. You are trying the **in-browser Web Demo**!

## ✨ Interactive Live Preview
- [x] Checkboxes toggle with a single click
- [x] Try typing [[Projects & Ideas]] for instant autocompletion
- [ ] Create a new note using \`Ctrl + N\`
- [ ] Explore the 2D Graph View with \`Ctrl + G\`

## 📐 Mathematical Equations & Syntax
Inline math equation: $E = mc^2$ and block math:
$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$

\`\`\`rust
// Fast compiled Rust core
fn main() {
    println!("Hello from Shard!");
}
\`\`\`

> [!NOTE]
> Everything in this web demo runs 100% locally in your browser and automatically persists to localStorage.
`,
  },
  {
    path: "Web Demo Vault/Projects & Ideas.md",
    name: "Projects & Ideas.md",
    isDir: false,
    content: `# Projects & Ideas

Brainstorming and interconnected concepts.

## Connected Notes
- Check out [[Welcome to Shard]]
- Visual concepts on [[Mindmap]]
- Arabic support on [[ملاحظات باللغة العربية]]

#productivity #research #ideas
`,
  },
  {
    path: "Web Demo Vault/ملاحظات باللغة العربية.md",
    name: "ملاحظات باللغة العربية.md",
    isDir: false,
    content: `# ملاحظات باللغة العربية

أهلاً بك في **شارد**! يدعم شارد الكتابة باللغة العربية بسلاسة تامة مع اكتشاف ذكي لاتجاه كل سطر (BiDi).

## المزايا
- [x] دعم كامل للكتابة من اليمين إلى اليسار (RTL)
- [x] اختصار تبديل الاتجاه السريع \`Ctrl + Shift + X\`
- [x] إمكانية تعريب واجهة التطبيق بالكامل من الإعدادات (\`Ctrl + ,\`)

#عربي #ملاحظات
`,
  },
  {
    path: "Web Demo Vault/Mindmap.canvas",
    name: "Mindmap.canvas",
    isDir: false,
    content: JSON.stringify(
      {
        nodes: [
          {
            id: "node-1",
            type: "text",
            text: "# Web Mindmap\nInteractive 2D canvas running in your browser.\nDrag cards to move.",
            x: 100,
            y: 100,
            width: 280,
            height: 160,
            color: "purple",
          },
          {
            id: "node-2",
            type: "text",
            text: "### Connected Concept\n- Drag connection handles\n- Fully compatible with .canvas\n- Autosaved locally",
            x: 480,
            y: 120,
            width: 260,
            height: 150,
            color: "blue",
          },
        ],
        edges: [
          {
            id: "edge-1",
            fromNode: "node-1",
            toNode: "node-2",
          },
        ],
      },
      null,
      2
    ),
  },
];

function getVirtualFiles(): VirtualFile[] {
  try {
    const raw = localStorage.getItem(DEMO_VAULT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to read virtual files from localStorage", e);
  }
  return DEFAULT_FILES;
}

function saveVirtualFiles(files: VirtualFile[]) {
  try {
    localStorage.setItem(DEMO_VAULT_KEY, JSON.stringify(files));
  } catch (e) {
    console.warn("Failed to persist virtual files to localStorage", e);
  }
}

// Mock invoke implementation for pure web browser execution
async function webMockInvoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const files = getVirtualFiles();

  switch (cmd) {
    case "get_last_vault":
    case "get_default_vault_path":
    case "create_vault":
      return "Web Demo Vault" as unknown as T;

    case "get_recent_vaults":
      return ["Web Demo Vault"] as unknown as T;

    case "set_last_vault":
      return undefined as unknown as T;

    case "open_vault_dialog":
      return "Web Demo Vault" as unknown as T;

    case "scan_vault": {
      const rootFiles = files.filter((f) => !f.isDir);
      const nodes: FileNode[] = rootFiles.map((f) => ({
        name: f.name,
        path: f.path,
        is_dir: false,
        children: [],
      }));
      return nodes as unknown as T;
    }

    case "read_file_content": {
      const filePath = args.filePath as string;
      const file = files.find((f) => f.path === filePath);
      return (file ? file.content : "") as unknown as T;
    }

    case "write_file_content": {
      const { filePath, content } = args;
      const file = files.find((f) => f.path === filePath);
      if (file) {
        file.content = content;
      } else {
        files.push({
          path: filePath,
          name: filePath.split("/").pop() || "Untitled.md",
          isDir: false,
          content,
        });
      }
      saveVirtualFiles(files);
      return undefined as unknown as T;
    }

    case "create_note": {
      const { name } = args;
      const fileName = name.endsWith(".md") || name.endsWith(".canvas") ? name : `${name}.md`;
      const path = `Web Demo Vault/${fileName}`;
      if (!files.some((f) => f.path === path)) {
        files.push({
          path,
          name: fileName,
          isDir: false,
          content: fileName.endsWith(".canvas")
            ? JSON.stringify({ nodes: [], edges: [] })
            : `# ${fileName.replace(/\.(md|canvas)$/, "")}\n\nStart typing here...`,
        });
        saveVirtualFiles(files);
      }
      return path as unknown as T;
    }

    case "create_folder": {
      return "Web Demo Vault" as unknown as T;
    }

    case "delete_item": {
      const { path } = args;
      const updated = files.filter((f) => f.path !== path);
      saveVirtualFiles(updated);
      return undefined as unknown as T;
    }

    case "rename_note_with_refactor": {
      const { oldPath, newTitle } = args;
      const oldFile = files.find((f) => f.path === oldPath);
      if (!oldFile) throw new Error("File not found");

      const ext = oldFile.name.endsWith(".canvas") ? ".canvas" : ".md";
      const cleanTitle = newTitle.replace(/\.(md|canvas)$/, "");
      const newFileName = `${cleanTitle}${ext}`;
      const newPath = `Web Demo Vault/${newFileName}`;
      const oldStem = oldFile.name.replace(/\.(md|canvas)$/, "");

      oldFile.name = newFileName;
      oldFile.path = newPath;

      let refactoredCount = 0;
      files.forEach((f) => {
        if (!f.name.endsWith(".canvas") && f.content.includes(`[[${oldStem}`)) {
          f.content = f.content
            .replace(new RegExp(`\\[\\[${oldStem}\\]\\]`, "g"), `[[${cleanTitle}]]`)
            .replace(new RegExp(`\\[\\[${oldStem}#`, "g"), `[[${cleanTitle}#`)
            .replace(new RegExp(`\\[\\[${oldStem}\\|`, "g"), `[[${cleanTitle}|`);
          refactoredCount++;
        }
      });

      saveVirtualFiles(files);
      return { new_path: newPath, refactored_files_count: refactoredCount } as unknown as T;
    }

    case "search_vault": {
      const query = (args.query || "").trim().toLowerCase();
      if (!query) return [] as unknown as T;

      const results: SearchResult[] = [];
      files.forEach((f) => {
        if (f.name.endsWith(".canvas")) return;
        const stem = f.name.replace(/\.md$/, "");
        if (stem.toLowerCase().includes(query)) {
          results.push({
            title: stem,
            path: f.path,
            snippet: `Note title: ${stem}`,
          });
        } else if (f.content.toLowerCase().includes(query)) {
          const idx = f.content.toLowerCase().indexOf(query);
          const start = Math.max(0, idx - 30);
          const end = Math.min(f.content.length, idx + query.length + 50);
          results.push({
            title: stem,
            path: f.path,
            snippet: `...${f.content.slice(start, end).replace(/\n/g, " ")}...`,
          });
        }
      });
      return results as unknown as T;
    }

    case "get_vault_graph": {
      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];
      const linkCounts: Record<string, number> = {};

      files.forEach((f) => {
        if (f.name.endsWith(".canvas")) return;
        const title = f.name.replace(/\.md$/, "");

        const tags: string[] = [];
        const words = f.content.split(/\s+/);
        words.forEach((w) => {
          if (w.startsWith("#") && w.length > 1) {
            const clean = w.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, "");
            if (clean && !tags.includes(clean)) tags.push(clean);
          }
        });

        // Wikilinks
        const wikiRegex = /\[\[([^\]|#]+)/g;
        let match;
        while ((match = wikiRegex.exec(f.content)) !== null) {
          const target = match[1].trim();
          if (target && target !== title) {
            links.push({ source: title, target });
            linkCounts[title] = (linkCounts[title] || 0) + 1;
            linkCounts[target] = (linkCounts[target] || 0) + 1;
          }
        }

        nodes.push({
          id: title,
          label: title,
          path: f.path,
          tags,
          link_count: 0,
        });
      });

      nodes.forEach((n) => {
        n.link_count = linkCounts[n.id] || 0;
      });

      return { nodes, links } as unknown as T;
    }

    case "get_note_backlinks": {
      const noteTitle = args.note_title as string;
      const linked: BacklinkItem[] = [];
      const unlinked: BacklinkItem[] = [];
      const targetWiki = `[[${noteTitle}`;
      const titleLower = noteTitle.toLowerCase();

      files.forEach((f) => {
        if (f.name.endsWith(".canvas")) return;
        const stem = f.name.replace(/\.md$/, "");
        if (stem === noteTitle) return;

        const lines = f.content.split("\n");
        lines.forEach((line, idx) => {
          if (line.includes(targetWiki)) {
            linked.push({
              source_title: stem,
              source_path: f.path,
              snippet: line.trim(),
              line_number: idx + 1,
            });
          } else if (line.toLowerCase().includes(titleLower)) {
            unlinked.push({
              source_title: stem,
              source_path: f.path,
              snippet: line.trim(),
              line_number: idx + 1,
            });
          }
        });
      });

      return { linked_mentions: linked, unlinked_mentions: unlinked } as unknown as T;
    }

    default:
      console.warn("Unhandled mock invoke command:", cmd, args);
      return undefined as unknown as T;
  }
}

export async function appInvoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (isTauri()) {
    return await invoke<T>(cmd, args);
  } else {
    return await webMockInvoke<T>(cmd, args);
  }
}
