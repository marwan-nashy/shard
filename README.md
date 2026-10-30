# Better Obsidian

A lightweight, native Windows-first desktop Markdown vault application written in pure Rust.

Better Obsidian delivers an Obsidian-like experience for local Markdown vaults using a native Rust immediate-mode UI (`eframe` / `egui`) powered by the OpenGL `glow` renderer. It avoids shipping an Electron or embedded-browser runtime. Performance claims will be based on measurements from low-spec reference hardware.

---

## Architecture & Design Principles

### 1. Pure Native Desktop UI (Zero Embedded Browsers)
Unlike traditional Markdown and note-taking apps that run inside a heavy web runtime (such as Electron or WebView2), Better Obsidian renders directly to the window using **egui** and **glow** (OpenGL).

- **No Embedded Browser Engine**: The UI uses egui/glow instead of bundling Chromium, Blink, WebKit, or an embedded WebView.
- **No Bundled Browser Runtime**: The app does not ship Electron, Chromium, or WebView2. It uses a native window and OpenGL renderer; the executable size, startup time, and memory use still need to be measured on reference hardware.
- **Native Windowing**: Uses the system windowing APIs through `eframe`/`egui` and requires a working graphics driver. It does not require Node.js or the WebView2 runtime.

### 2. File Safety & Non-Destructive Vault Model
- **Ordinary Files in Existing Paths**: Notes are stored as standard `.md` and `.markdown` files inside the user's chosen folder. Subdirectory structures are fully preserved.
- **Non-Destructive Opening**: Simply opening a vault or app never creates hidden database files, never modifies file timestamps, and never deletes or alters existing notes.
- **No-Overwrite Note Creation**: Note creation uses OS-level exclusive file creation (`std::fs::OpenOptions::new().create_new(true)`) and rejects absolute paths, parent traversal, and unsafe Windows names. Existing files cannot be silently overwritten.
- **External Edit Protection**: Before saving, the app checks that the file is still inside the vault, is not a symbolic link, and has not changed on disk since it was opened. Conflicts are reported instead of silently overwriting the newer file.
- **Dirty State Tracking & Work Protection**: Tracks unsaved changes in real time. If a user attempts to switch notes or open another vault while changes are pending, a modal dialog offers `Save & Continue`, `Discard Changes`, or `Cancel`.

### 3. Obsidian-Style Wikilinks & Backlinks
- **Wikilink Syntax**: Supports `[[Note Title]]`, aliased links `[[Note Title|Custom Display Text]]`, and heading references `[[Note Title#Heading]]`.
- **Interactive Preview Navigation**: Clicking any wikilink in the rendered preview resolves the target note across the vault (by relative path or case-insensitive title match) and immediately navigates to it.
- **Missing Note Creation**: Clicking a wikilink whose target does not exist opens a prompt offering to create the note with an initial header in one click.
- **On-Demand Backlinks**: Scans vault Markdown files on-demand for incoming links to the active note, displaying referencing notes along with line numbers and matched context snippets.

### 4. Debounced On-Demand Search
- **Startup Memory Optimization**: Avoids loading note contents into memory at startup. Vault discovery only scans filenames and metadata.
- **Debounced Execution**: Search input waits 300 ms after typing pauses before starting a search.
- **Title and Content Matching**: Simultaneously matches note titles instantly and searches file bodies line-by-line on demand, extracting matching line numbers and highlighted snippets while streaming files.
- **Capped Results**: Search returns a bounded number of matching notes. Large-vault responsiveness still needs measurement and optimization.

### 5. Local State & Privacy
- **Local Persistence**: Remembers the last active vault and recent vaults in `%APPDATA%\better-obsidian\BetterObsidian\config.json` via standard OS directory conventions.
- **Zero Cloud / Telemetry**: No telemetry, no background indexers, no daemons, no network requests, and no databases.

---

## Architectural Tradeoffs

| Decision | Benefits | Tradeoffs & Mitigations |
| :--- | :--- | :--- |
| **Immediate Mode (`egui`) vs Retained DOM (HTML/CSS)** | Single-language codebase with no DOM or browser engine. | Complex typographic styling (e.g. multi-column CSS tables) requires custom layout code. The preview currently supports a useful Markdown subset rather than the full CommonMark specification. |
| **On-Demand Scanning vs Persistent SQLite Indexing** | No background indexer, database file, or index maintenance. | Full-text search reads note files when requested. Performance on large vaults has not been benchmarked yet. |
| **Native Glow (OpenGL) vs WebView2** | Avoids bundling an embedded browser runtime and keeps the UI in Rust. | Requires a supported OpenGL driver; actual startup and memory use must be measured. Web browser extensions and JavaScript plugins are not supported. |
| **On-Demand Reads vs Cache All Files** | Avoids keeping all note bodies in memory at startup. | Files are read from disk when opened, searched, or scanned for backlinks. Performance on large vaults still needs measurement. |

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + S` | Save the currently active note |
| `Ctrl + N` | Create a new note (with conflict detection) |
| `Ctrl + O` | Open an existing folder as a vault |
| `Ctrl + F` | Focus the search tab |
| `Ctrl + E` | Cycle through view modes (`Edit` $\rightarrow$ `Split` $\rightarrow$ `Preview`) |
| `Escape` | Dismiss modal dialogs |

---

## Project Structure

```text
better-obsidian/
├── Cargo.toml               # Package dependencies (eframe, egui, rfd, serde, walkdir, directories)
├── README.md                # Architecture, design decisions, and tradeoffs
└── src/
    ├── main.rs              # Application entry point & native viewport configuration
    ├── app.rs               # BetterObsidianApp state, update loop, keyboard shortcuts & layout
    ├── config.rs            # Persistent local configuration (last vault, recent vaults)
    ├── vault.rs             # Vault management, metadata scanning, atomic file creation & saving
    ├── wikilinks.rs         # Wikilink parsing, target resolution, and on-demand backlinks scanner
    ├── search.rs            # Debounced title and content search engine
    └── ui/
        ├── mod.rs           # UI module definitions
        ├── theme.rs         # Obsidian-inspired dark theme and color palette
        ├── sidebar.rs       # Sidebar with Notes, Search, and Backlinks tabs
        ├── editor.rs        # Text editor, view mode toggles, and welcome screen
        ├── preview.rs       # Native Markdown parser and renderer with interactive wikilinks
        └── modals.rs        # New Note, Unsaved Changes, and Missing Wikilink modal dialogs
```

---

## Building & Running

### Prerequisites
- Rust 1.75+ (tested on Rust 1.99.1 / Cargo 1.99.1 on Windows).

### Development Run
```powershell
cargo run
```

### Release Build
```powershell
cargo build --release
```
The optimized executable will be located at:
```text
target/release/better-obsidian.exe
```
