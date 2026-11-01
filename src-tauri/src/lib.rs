use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub title: String,
    pub path: String,
    pub snippet: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub path: String,
    pub tags: Vec<String>,
    pub link_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphLink {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BacklinkItem {
    pub source_title: String,
    pub source_path: String,
    pub snippet: String,
    pub line_number: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BacklinksData {
    pub linked_mentions: Vec<BacklinkItem>,
    pub unlinked_mentions: Vec<BacklinkItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenameResult {
    pub new_path: String,
    pub refactored_files_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct AppConfig {
    pub last_vault: Option<String>,
    pub recent_vaults: Vec<String>,
}

const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "dist-ssr",
    "src-tauri",
    "src-egui",
    ".git",
    ".obsidian",
    ".vscode",
    ".idea",
    ".gemini",
    ".agents",
];

fn get_config_file_path() -> Option<PathBuf> {
    directories::ProjectDirs::from("com", "shardnotes", "Shard").map(|proj| {
        let dir = proj.config_dir();
        let _ = fs::create_dir_all(dir);
        dir.join("config.json")
    })
}

fn load_app_config() -> AppConfig {
    if let Some(path) = get_config_file_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                    return config;
                }
            }
        }
    }
    AppConfig::default()
}

fn save_app_config(config: &AppConfig) {
    if let Some(path) = get_config_file_path() {
        if let Ok(content) = serde_json::to_string_pretty(config) {
            let _ = fs::write(path, content);
        }
    }
}

// 1. Get Last Vault (Strictly returns valid absolute path, never relative '.')
#[tauri::command]
fn get_last_vault() -> Option<String> {
    let config = load_app_config();
    if let Some(ref path_str) = config.last_vault {
        let p = Path::new(path_str);
        if p.is_absolute() && p.is_dir() {
            return Some(path_str.clone());
        }
    }
    None
}

// 2. Get Recent Vaults
#[tauri::command]
fn get_recent_vaults() -> Vec<String> {
    let config = load_app_config();
    config
        .recent_vaults
        .into_iter()
        .filter(|v| {
            let p = Path::new(v);
            p.is_absolute() && p.is_dir()
        })
        .collect()
}

// 3. Save Active Vault Path
#[tauri::command]
fn set_last_vault(vault_path: String) -> Result<(), String> {
    let p = PathBuf::from(&vault_path);
    if !p.is_dir() {
        return Err("Path is not a valid directory".to_string());
    }

    let canonical = fs::canonicalize(&p)
        .map_err(|e| format!("Invalid path: {}", e))?
        .to_string_lossy()
        .to_string();

    let clean_path = canonical
        .trim_start_matches(r"\\?\")
        .to_string();

    let mut config = load_app_config();
    config.last_vault = Some(clean_path.clone());
    config.recent_vaults.retain(|v| v != &clean_path);
    config.recent_vaults.insert(0, clean_path);
    if config.recent_vaults.len() > 10 {
        config.recent_vaults.truncate(10);
    }
    save_app_config(&config);
    Ok(())
}

// 4. Default Documents Vault Path (e.g. C:\Users\Username\Documents\Shard Vault)
#[tauri::command]
fn get_default_vault_path() -> String {
    if let Some(user_dirs) = directories::UserDirs::new() {
        if let Some(docs) = user_dirs.document_dir() {
            return docs.join("Shard Vault").to_string_lossy().to_string();
        }
    }
    if let Some(base_dirs) = directories::BaseDirs::new() {
        return base_dirs.home_dir().join("Documents").join("Shard Vault").to_string_lossy().to_string();
    }
    "Shard Vault".to_string()
}

// 5. Create or Initialize a Vault
#[tauri::command]
fn create_vault(vault_path: String) -> Result<String, String> {
    let p = PathBuf::from(&vault_path);
    fs::create_dir_all(&p).map_err(|e| format!("Failed to create folder: {}", e))?;

    let welcome_note = p.join("Welcome to Shard.md");
    if !welcome_note.exists() {
        let welcome_content = r#"# Welcome to Shard

Shard is your ultra-lightweight, high-performance local knowledge base.

## Quick Start
- **Create a note**: Click the `+` icon in the File Explorer or press `Ctrl + N`
- **Quick Switcher**: Press `Ctrl + O` or `Ctrl + P` to instantly find any note
- **Graph View**: Press `Ctrl + G` or click the Graph icon in the left ribbon
- **Wikilinks**: Type `[[` anywhere to link notes together like [[My Ideas]]

## Features
- [x] 100% Plain Markdown local storage
- [x] Zero background telemetry or Electron bloat
- [x] Interactive checklists (click the box to toggle!)
- [ ] Write your first note today

Enjoy writing with zero lag!
"#;
        let _ = fs::write(&welcome_note, welcome_content);
    }

    let canonical = fs::canonicalize(&p)
        .map_err(|e| format!("Failed to resolve path: {}", e))?
        .to_string_lossy()
        .to_string();

    let clean_path = canonical.trim_start_matches(r"\\?\").to_string();
    let _ = set_last_vault(clean_path.clone());
    Ok(clean_path)
}

// 6. Pick Vault Dialog
#[tauri::command]
fn open_vault_dialog() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Select Notes Vault Folder")
        .pick_folder()
        .map(|p| {
            p.to_string_lossy()
                .trim_start_matches(r"\\?\")
                .to_string()
        })
}

// 7. Scan Vault File Tree
#[tauri::command]
fn scan_vault(vault_path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&vault_path);
    if !root.exists() || !root.is_dir() {
        return Err("Invalid vault directory".to_string());
    }

    fn scan_dir(dir: &Path) -> Vec<FileNode> {
        let nodes = Vec::new();
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return nodes,
        };

        let mut dirs = Vec::new();
        let mut files = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden folders and files (like .obsidian, .git)
            if name.starts_with('.') || IGNORED_DIRS.contains(&name.as_str()) {
                continue;
            }

            if path.is_dir() {
                let children = scan_dir(&path);
                dirs.push(FileNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    children,
                });
            } else if path.is_file() {
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                if ext == "md" || ext == "canvas" {
                    files.push(FileNode {
                        name,
                        path: path.to_string_lossy().to_string(),
                        is_dir: false,
                        children: Vec::new(),
                    });
                }
            }
        }

        dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        dirs.extend(files);
        dirs
    }

    Ok(scan_dir(root))
}

// 8. Read Note Content
#[tauri::command]
fn read_file_content(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))
}

// 9. Save Note Content
#[tauri::command]
fn write_file_content(file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))
}

// 10. Create Note or Canvas
#[tauri::command]
fn create_note(vault_path: String, parent_folder: Option<String>, name: String) -> Result<String, String> {
    let target_dir = match parent_folder {
        Some(folder) if !folder.is_empty() => PathBuf::from(folder),
        _ => PathBuf::from(vault_path),
    };

    let filename = if name.ends_with(".md") || name.ends_with(".canvas") {
        name
    } else {
        format!("{}.md", name)
    };

    let file_path = target_dir.join(filename);
    if file_path.exists() {
        return Err("A file with this name already exists".to_string());
    }

    fs::write(&file_path, "").map_err(|e| format!("Failed to create file: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

// 11. Create Folder
#[tauri::command]
fn create_folder(vault_path: String, parent_folder: Option<String>, name: String) -> Result<String, String> {
    let target_dir = match parent_folder {
        Some(folder) if !folder.is_empty() => PathBuf::from(folder),
        _ => PathBuf::from(vault_path),
    };

    let folder_path = target_dir.join(name);
    fs::create_dir_all(&folder_path).map_err(|e| format!("Failed to create folder: {}", e))?;
    Ok(folder_path.to_string_lossy().to_string())
}

// 12. Delete File or Folder
#[tauri::command]
fn delete_item(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Failed to delete folder: {}", e))
    } else {
        fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

// 13. Rename Note with Automatic Link Refactoring
#[tauri::command]
fn rename_note_with_refactor(
    vault_path: String,
    old_path: String,
    new_title: String,
) -> Result<RenameResult, String> {
    let old_p = PathBuf::from(&old_path);
    if !old_p.exists() {
        return Err("Original file not found".to_string());
    }

    let parent = old_p.parent().unwrap_or_else(|| Path::new(&vault_path));
    let is_canvas = old_p.extension().and_then(|s| s.to_str()) == Some("canvas");
    let ext = if is_canvas { "canvas" } else { "md" };
    let clean_title = new_title.trim().trim_end_matches(".md").trim_end_matches(".canvas");
    let new_filename = format!("{}.{}", clean_title, ext);
    let new_p = parent.join(&new_filename);

    if new_p.exists() && new_p != old_p {
        return Err("A file with that name already exists".to_string());
    }

    let old_stem = old_p
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    fs::rename(&old_p, &new_p).map_err(|e| format!("Failed to rename file: {}", e))?;

    let mut refactored_files_count = 0;
    if !old_stem.is_empty() && old_stem != clean_title {
        let old_link_prefix = format!("[[{}", old_stem);

        for entry in WalkDir::new(&vault_path).into_iter().flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Ok(content) = fs::read_to_string(path) {
                    if content.contains(&old_link_prefix) {
                        let updated = content
                            .replace(&format!("[[{}]]", old_stem), &format!("[[{}]]", clean_title))
                            .replace(&format!("[[{}#", old_stem), &format!("[[{}#", clean_title))
                            .replace(&format!("[[{}|", old_stem), &format!("[[{}|", clean_title));
                        if updated != content {
                            let _ = fs::write(path, updated);
                            refactored_files_count += 1;
                        }
                    }
                }
            }
        }
    }

    Ok(RenameResult {
        new_path: new_p.to_string_lossy().to_string(),
        refactored_files_count,
    })
}

// 14. Instant Fuzzy Search across Vault
#[tauri::command]
fn search_vault(vault_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    for entry in WalkDir::new(&vault_path).into_iter().flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            let title_lower = stem.to_lowercase();
            let mut matched = false;
            let mut snippet = String::new();

            if title_lower.contains(&q) {
                matched = true;
                snippet = format!("Note Title: {}", stem);
            } else if let Ok(content) = fs::read_to_string(path) {
                let lower_content = content.to_lowercase();
                if let Some(pos) = lower_content.find(&q) {
                    matched = true;
                    let mut start = pos.saturating_sub(40);
                    while start > 0 && !content.is_char_boundary(start) {
                        start -= 1;
                    }
                    let mut end = (pos + q.len() + 60).min(content.len());
                    while end < content.len() && !content.is_char_boundary(end) {
                        end += 1;
                    }
                    snippet = format!("...{}...", content[start..end].replace('\n', " "));
                }
            }

            if matched {
                results.push(SearchResult {
                    title: stem,
                    path: path.to_string_lossy().to_string(),
                    snippet,
                });
                if results.len() >= 50 {
                    break;
                }
            }
        }
    }

    Ok(results)
}

// 15. Extract 2D Graph Data (Nodes & Links)
#[tauri::command]
fn get_vault_graph(vault_path: String) -> Result<GraphData, String> {
    let mut notes = Vec::new();
    let mut title_to_path = std::collections::HashMap::new();

    for entry in WalkDir::new(&vault_path).into_iter().flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            title_to_path.insert(stem.clone(), path.to_string_lossy().to_string());
            notes.push((stem, path.to_path_buf()));
        }
    }

    let mut nodes = Vec::new();
    let mut links = Vec::new();
    let mut link_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    for (title, path) in &notes {
        let content = fs::read_to_string(path).unwrap_or_default();
        let mut tags = Vec::new();

        for word in content.split_whitespace() {
            if word.starts_with('#') && word.len() > 1 {
                let tag = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '/' && c != '_');
                if !tag.is_empty() && !tags.contains(&tag.to_string()) {
                    tags.push(tag.to_string());
                }
            }
        }

        let mut idx = 0;
        while let Some(start) = content[idx..].find("[[") {
            let actual_start = idx + start + 2;
            if let Some(end) = content[actual_start..].find("]]") {
                let actual_end = actual_start + end;
                let raw_link = &content[actual_start..actual_end];
                let target_title = raw_link
                    .split('#')
                    .next()
                    .unwrap_or(raw_link)
                    .split('|')
                    .next()
                    .unwrap_or(raw_link)
                    .trim();

                if !target_title.is_empty() && target_title != title {
                    links.push(GraphLink {
                        source: title.clone(),
                        target: target_title.to_string(),
                    });
                    *link_counts.entry(title.clone()).or_insert(0) += 1;
                    *link_counts.entry(target_title.to_string()).or_insert(0) += 1;
                }
                idx = actual_end + 2;
            } else {
                break;
            }
        }

        nodes.push(GraphNode {
            id: title.clone(),
            label: title.clone(),
            path: path.to_string_lossy().to_string(),
            tags,
            link_count: 0,
        });
    }

    for node in &mut nodes {
        node.link_count = *link_counts.get(&node.id).unwrap_or(&0);
    }

    Ok(GraphData { nodes, links })
}

// 16. Backlinks Calculation for Active Note
#[tauri::command]
fn get_note_backlinks(vault_path: String, note_title: String) -> Result<BacklinksData, String> {
    let mut linked = Vec::new();
    let mut unlinked = Vec::new();

    let target_wikilink = format!("[[{}", note_title);
    let title_lower = note_title.to_lowercase();

    for entry in WalkDir::new(&vault_path).into_iter().flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            if stem == note_title {
                continue;
            }

            if let Ok(content) = fs::read_to_string(path) {
                let path_str = path.to_string_lossy().to_string();

                for (line_idx, line) in content.lines().enumerate() {
                    if line.contains(&target_wikilink) {
                        linked.push(BacklinkItem {
                            source_title: stem.clone(),
                            source_path: path_str.clone(),
                            snippet: line.trim().to_string(),
                            line_number: line_idx + 1,
                        });
                    } else if line.to_lowercase().contains(&title_lower) {
                        unlinked.push(BacklinkItem {
                            source_title: stem.clone(),
                            source_path: path_str.clone(),
                            snippet: line.trim().to_string(),
                            line_number: line_idx + 1,
                        });
                    }
                }
            }
        }
    }

    Ok(BacklinksData {
        linked_mentions: linked,
        unlinked_mentions: unlinked,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_last_vault,
            get_recent_vaults,
            set_last_vault,
            get_default_vault_path,
            create_vault,
            open_vault_dialog,
            scan_vault,
            read_file_content,
            write_file_content,
            create_note,
            create_folder,
            delete_item,
            rename_note_with_refactor,
            search_vault,
            get_vault_graph,
            get_note_backlinks
        ])
        .run(tauri::generate_context!())
        .expect("error while running Shard application");
}
