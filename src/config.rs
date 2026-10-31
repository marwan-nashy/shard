use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CorePlugins {
    #[serde(default = "default_true")]
    pub file_explorer: bool,
    #[serde(default = "default_true")]
    pub search: bool,
    #[serde(default = "default_true")]
    pub bookmarks: bool,
    #[serde(default = "default_true")]
    pub tags: bool,
    #[serde(default = "default_true")]
    pub graph_view: bool,
    #[serde(default = "default_true")]
    pub canvas: bool,
    #[serde(default = "default_true")]
    pub daily_notes: bool,
    #[serde(default = "default_true")]
    pub templates: bool,
    #[serde(default = "default_true")]
    pub outline: bool,
    #[serde(default = "default_true")]
    pub backlinks: bool,
    #[serde(default = "default_true")]
    pub word_count: bool,
}

impl Default for CorePlugins {
    fn default() -> Self {
        Self {
            file_explorer: true,
            search: true,
            bookmarks: true,
            tags: true,
            graph_view: true,
            canvas: true,
            daily_notes: true,
            templates: true,
            outline: true,
            backlinks: true,
            word_count: true,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThemeMode {
    Dark,
    Light,
    Nord,
    Dracula,
}

impl Default for ThemeMode {
    fn default() -> Self {
        Self::Dark
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccentColor {
    Purple,
    Blue,
    Green,
    Amber,
    Red,
    Cyan,
    Pink,
}

impl Default for AccentColor {
    fn default() -> Self {
        Self::Purple
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileSortOrder {
    Alphabetical,
    AlphabeticalReverse,
    ModifiedNewest,
    ModifiedOldest,
}

impl Default for FileSortOrder {
    fn default() -> Self {
        Self::Alphabetical
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub last_vault: Option<PathBuf>,
    pub recent_vaults: Vec<PathBuf>,
    #[serde(default)]
    pub open_tabs: Vec<PathBuf>,
    #[serde(default)]
    pub active_tab: Option<PathBuf>,
    #[serde(default)]
    pub bookmarks: Vec<PathBuf>,
    #[serde(default)]
    pub core_plugins: CorePlugins,
    #[serde(default)]
    pub theme_mode: ThemeMode,
    #[serde(default)]
    pub accent_color: AccentColor,
    #[serde(default)]
    pub file_sort_order: FileSortOrder,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            last_vault: None,
            recent_vaults: Vec::new(),
            open_tabs: Vec::new(),
            active_tab: None,
            bookmarks: Vec::new(),
            core_plugins: CorePlugins::default(),
            theme_mode: ThemeMode::Dark,
            accent_color: AccentColor::Purple,
            file_sort_order: FileSortOrder::Alphabetical,
        }
    }
}

impl AppConfig {
    fn config_file_path() -> Option<PathBuf> {
        directories::ProjectDirs::from("com", "better-obsidian", "BetterObsidian")
            .map(|dirs| dirs.config_dir().join("config.json"))
    }

    pub fn load() -> Self {
        if let Some(path) = Self::config_file_path() {
            if path.exists() {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                        return config;
                    }
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) {
        if let Some(path) = Self::config_file_path() {
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if let Ok(json) = serde_json::to_string_pretty(self) {
                let _ = std::fs::write(path, json);
            }
        }
    }

    pub fn set_last_vault(&mut self, path: PathBuf) {
        self.last_vault = Some(path.clone());
        self.recent_vaults.retain(|p| p != &path);
        self.recent_vaults.insert(0, path);
        if self.recent_vaults.len() > 10 {
            self.recent_vaults.truncate(10);
        }
        self.save();
    }

    pub fn set_open_tabs(&mut self, tabs: Vec<PathBuf>, active_tab: Option<PathBuf>) {
        self.open_tabs = tabs;
        self.active_tab = active_tab;
        self.save();
    }

    pub fn is_bookmarked(&self, path: &std::path::Path) -> bool {
        self.bookmarks.iter().any(|b| b == path)
    }

    pub fn toggle_bookmark(&mut self, path: PathBuf) -> bool {
        if let Some(pos) = self.bookmarks.iter().position(|b| b == &path) {
            self.bookmarks.remove(pos);
            self.save();
            false
        } else {
            self.bookmarks.push(path);
            self.save();
            true
        }
    }

    pub fn remove_bookmark(&mut self, path: &std::path::Path) {
        self.bookmarks.retain(|b| b != path);
        self.save();
    }
}
