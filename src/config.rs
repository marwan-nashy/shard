use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub last_vault: Option<PathBuf>,
    pub recent_vaults: Vec<PathBuf>,
    #[serde(default)]
    pub open_tabs: Vec<PathBuf>,
    #[serde(default)]
    pub active_tab: Option<PathBuf>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            last_vault: None,
            recent_vaults: Vec::new(),
            open_tabs: Vec::new(),
            active_tab: None,
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
}
