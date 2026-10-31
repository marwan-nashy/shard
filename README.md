# Shard

A lightweight, zero-bloat, open-source local knowledge base and markdown editor designed to run effortlessly on low-spec "potato PCs" (low RAM, integrated Intel GPUs, dual-core CPUs) without Electron runtime overhead.

## Architectural Core Principles
1. **Zero Electron Bloat**: Avoids bundling full Chromium + Node.js runtimes. Built on **Tauri v2 (Rust backend)** + **OS Evergreen WebView2** (~30–35 MB idle RAM vs. Obsidian's 400 MB–900 MB).
2. **100% Local-First Plain-Text Vaults**: Notes are stored directly as standard `.md` and `.canvas` files on the local filesystem. Zero cloud telemetry or hidden background daemons.
3. **Sub-50ms Cold Startup**: Ready to write and search immediately upon launch.
4. **Scale & Efficiency**: Handles vaults with 20,000+ markdown files effortlessly with native multithreaded Rust indexing.

---

## Tech Stack
- **Desktop Shell**: [Tauri v2](https://tauri.app/) (Native Rust backend for filesystem scanning, atomic link refactoring, and indexing)
- **UI Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Markdown Editor**: [CodeMirror 6](https://codemirror.net/) (Modular, virtualized line rendering, memory-efficient)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Obsidian Dark Theme neutral charcoal `#1e1e1e` / `#161616` / `#262626` / `#7b6cd9`)
- **Icons**: [Lucide React](https://lucide.dev/) (Geometric SVGs with zero missing-glyph or Unicode square issues)

---

## Complete Feature Matrix

### 1. CodeMirror 6 Live Preview Markdown Editor
- **WYSIWYG Live Preview**:
  - Headings (`#`, `##`, `###`)
  - Bold (`**text**`), Italics (`*text*`), Inline code (`` `code` ``), Strikethrough (`~~text~~`)
  - Interactive checklists (`- [ ]` and `- [x]`) with one-click toggling
  - Callout blocks (`> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`, `> [!INFO]`, `> [!CAUTION]`)
  - Code blocks with language badges and one-click **Copy** buttons
  - Math equations (`$...$` and `$$...$$`)
- **In-Note Find & Replace (`Ctrl+F` / `Ctrl+H`)**: CodeMirror search bar styled in dark purple theme.
- **Dual-Mode Toggle (`Ctrl+E`)**: Switch between Live Preview and Raw Source mode with one click or shortcut.
- **Split View**: Side-by-side editing panes.
- **Formatting Keybindings**: `Ctrl+B` (bold), `Ctrl+I` (italic), `Ctrl+K` (insert wikilink), `Ctrl+S` (save).

### 2. Bidirectional Linking & Atomic Refactoring Engine
- **`[[Wikilinks]]` Autocomplete**: Typing `[[` instantly opens a suggestion popup of vault note titles.
- **Heading Links & Jumping**: Support for `[[Note Name#Section]]` and `[[Note Name|Alias]]`. Clicking scrolls smoothly to that heading.
- **Backlinks Panel**: Dedicated pane showing both linked mentions and unlinked text mentions for the active note.
- **Atomic Link Refactoring**: When a note is renamed, all `[[Old Name]]` occurrences across all Markdown files in the vault are atomically updated in native Rust.

### 3. Left Sidebar Multi-View
- 📁 **Files**: Collapsible folder tree, context menu (rename with refactor, delete), new note, new canvas, new folder, and collapse all buttons.
- 🔍 **Search**: Global vault search with real-time matching, file counts, and snippet highlights.
- 🏷️ **Tags**: Lists all `#tags` across the vault with note count badges; click a tag to inspect matching notes.
- 📑 **Outline**: Hierarchical table of contents (`#`, `##`, `###`) of the current note; clicking jumps directly to that section.

### 4. Hardware-Accelerated 2D Graph View
- HTML5 Canvas force-directed graph view.
- **Equilibrium Simulation Cutoff**: Automatically halts physics loops once nodes reach equilibrium, guaranteeing **0% idle CPU usage**.
- **Quick Filters**: Filter by text, tag (`#tag`), or hide orphan nodes.
- Interactive pan, zoom, drag nodes, and click to navigate to any note.

### 5. Visual Canvas (Infinite Whiteboard)
- Infinite 2D pan/zoom whiteboard for cards and connecting arrows.
- Compatible with Obsidian `.canvas` JSON structure.
- Save, add cards, drag, and organize visual mindmaps directly on disk.

### 6. Quick Switcher (`Ctrl+O`) & Command Palette (`Ctrl+P`)
- **Quick Switcher (`Ctrl+O`)**: Sub-5ms fuzzy search across note titles and contents.
- **Command Palette (`Ctrl+P` or type `>`)**: Fast command execution for all workspace actions:
  - Create note, folder, or canvas
  - Open 2D graph or visual canvas
  - Open today's daily note
  - Toggle live preview / source mode
  - Toggle left / right sidebars
  - Toggle split editor
  - Copy note content
  - Open settings / vault selector

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + O` | Open Quick Switcher (Find Note) |
| `Ctrl + P` | Open Command Palette |
| `Ctrl + N` | Create New Note |
| `Ctrl + Shift + N` | Create New Folder |
| `Ctrl + S` | Save Current Note |
| `Ctrl + F` | Find in Note |
| `Ctrl + H` | Find & Replace in Note |
| `Ctrl + G` | Toggle 2D Graph View |
| `Ctrl + E` | Toggle Live Preview / Source Mode |
| `Ctrl + \` | Toggle Left Sidebar |
| `Ctrl + B` | Toggle Right Sidebar (Backlinks) |
| `Ctrl + ,` | Open Settings |

---

## Running the App

### 1. Portable Standalone (No Install Required)
Double-click `Shard.exe` in the root folder or `release/Shard-Portable.exe`. It starts instantly with zero dependencies.

### 2. One-Click Setup (For New Devices)
Run `release/Shard-Setup.exe` to install Shard into Program Files with Start Menu and Desktop shortcuts.

---

## Legal Disclaimer

Shard is an independent, community-driven open-source software project. It is not affiliated with, associated with, sponsored by, or endorsed by Dynalist Inc. or Obsidian. All product names, logos, brands, and registered trademarks mentioned are property of their respective owners.
