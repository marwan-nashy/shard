use crate::config::AppConfig;
use crate::search::SearchEngine;
use crate::ui::editor::{render_editor_area, ViewMode};
use crate::ui::modals::{
    MissingWikilinkDialog, NewNoteDialog, PendingAction, UnsavedChoice, UnsavedDialog,
};
use crate::ui::sidebar::{render_sidebar, SidebarTab};
use crate::ui::theme::Theme;
use crate::vault::{ActiveNote, NoteItem, Vault};
use crate::wikilinks::{self, BacklinkMatch};
use egui::{CentralPanel, Key, RichText, SidePanel, TopBottomPanel};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub struct BetterObsidianApp {
    pub config: AppConfig,
    pub vault: Option<Vault>,
    pub active_note: Option<ActiveNote>,

    pub view_mode: ViewMode,
    pub sidebar_tab: SidebarTab,
    pub notes_filter: String,

    pub search_engine: SearchEngine,

    pub backlinks: Vec<BacklinkMatch>,
    pub backlinks_target_path: Option<PathBuf>,

    pub new_note_dialog: NewNoteDialog,
    pub unsaved_dialog: UnsavedDialog,
    pub missing_wikilink_dialog: MissingWikilinkDialog,

    pub status_message: Option<(String, Instant)>,
    pub error_banner: Option<(String, Instant)>,
}

impl BetterObsidianApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        Theme::apply(&cc.egui_ctx);
        let config = AppConfig::load();
        let mut app = Self {
            vault: None,
            active_note: None,
            view_mode: ViewMode::Split,
            sidebar_tab: SidebarTab::Notes,
            notes_filter: String::new(),
            search_engine: SearchEngine::default(),
            backlinks: Vec::new(),
            backlinks_target_path: None,
            new_note_dialog: NewNoteDialog::default(),
            unsaved_dialog: UnsavedDialog::default(),
            missing_wikilink_dialog: MissingWikilinkDialog::default(),
            status_message: None,
            error_banner: None,
            config,
        };

        if let Some(last_vault) = &app.config.last_vault.clone() {
            if last_vault.is_dir() {
                if let Ok(v) = Vault::open(last_vault.clone()) {
                    app.vault = Some(v);
                    app.set_status(format!(
                        "Opened vault: {:?}",
                        last_vault.file_name().unwrap_or_default()
                    ));
                }
            }
        }

        app
    }

    pub fn set_status(&mut self, msg: impl Into<String>) {
        self.status_message = Some((msg.into(), Instant::now()));
    }

    pub fn set_error(&mut self, err: impl Into<String>) {
        self.error_banner = Some((err.into(), Instant::now()));
    }

    pub fn save_active_note(&mut self) -> bool {
        if let (Some(vault), Some(active_note)) = (&self.vault, &mut self.active_note) {
            match vault.save_note(active_note) {
                Ok(_) => {
                    self.set_status("Note saved successfully.");
                    if self.sidebar_tab == SidebarTab::Backlinks {
                        self.refresh_backlinks();
                    } else {
                        self.backlinks_target_path = None;
                    }
                    true
                }
                Err(e) => {
                    self.set_error(format!("Failed to save note: {}", e));
                    false
                }
            }
        } else {
            false
        }
    }

    pub fn open_new_note_dialog(&mut self) {
        if self.vault.is_none() {
            self.set_error("Please open a vault before creating notes.");
            return;
        }

        let default_name = if let Some(v) = &self.vault {
            v.find_available_untitled_name()
        } else {
            "Untitled".to_string()
        };

        self.new_note_dialog.open(default_name);
    }

    pub fn pick_and_open_vault(&mut self) {
        if let Some(active) = &self.active_note {
            if active.is_dirty() {
                self.unsaved_dialog
                    .open(active.rel_path.clone(), PendingAction::PickVault);
                return;
            }
        }
        self.do_pick_and_open_vault();
    }

    fn do_pick_and_open_vault(&mut self) {
        let mut dialog = rfd::FileDialog::new().set_title("Open Markdown Vault Folder");
        if let Some(vault) = &self.vault {
            dialog = dialog.set_directory(&vault.root_path);
        }
        if let Some(folder) = dialog.pick_folder() {
            self.open_vault(folder);
        }
    }

    pub fn open_vault(&mut self, folder: PathBuf) {
        match Vault::open(folder.clone()) {
            Ok(vault) => {
                self.config.set_last_vault(folder);
                self.vault = Some(vault);
                self.active_note = None;
                self.backlinks.clear();
                self.backlinks_target_path = None;
                self.set_status("Vault opened successfully.");
            }
            Err(e) => {
                self.set_error(format!("Failed to open vault: {}", e));
            }
        }
    }

    pub fn request_open_note(&mut self, target_path: PathBuf) {
        if let Some(active) = &self.active_note {
            if active.abs_path == target_path {
                return;
            }
            if active.is_dirty() {
                self.unsaved_dialog.open(
                    active.rel_path.clone(),
                    PendingAction::OpenNote(target_path),
                );
                return;
            }
        }
        self.do_open_note(&target_path);
    }

    fn do_open_note(&mut self, target_path: &Path) {
        if let Some(vault) = &self.vault {
            match vault.load_note(target_path) {
                Ok(note) => {
                    self.active_note = Some(note);
                    self.backlinks.clear();
                    self.backlinks_target_path = None;
                    if self.sidebar_tab == SidebarTab::Backlinks {
                        self.refresh_backlinks();
                    }
                }
                Err(e) => {
                    self.set_error(format!("Failed to open note: {}", e));
                }
            }
        }
    }

    pub fn handle_wikilink_action(&mut self, target: &str) {
        if let Some(vault) = &self.vault {
            if let Some(resolved) = wikilinks::resolve_wikilink(vault, target) {
                let path = resolved.abs_path.clone();
                self.request_open_note(path);
            } else {
                self.missing_wikilink_dialog.open(target.to_string());
            }
        }
    }

    pub fn refresh_backlinks(&mut self) {
        if let (Some(vault), Some(active_note)) = (&self.vault, &self.active_note) {
            let note_item = NoteItem {
                rel_path: active_note.rel_path.clone(),
                abs_path: active_note.abs_path.clone(),
                title: active_note.title.clone(),
            };
            self.backlinks = wikilinks::find_backlinks(vault, &note_item);
            self.backlinks_target_path = Some(active_note.abs_path.clone());
        } else {
            self.backlinks.clear();
            self.backlinks_target_path = None;
        }
    }

    fn handle_shortcuts(&mut self, ctx: &egui::Context) {
        let input = ctx.input(|i| {
            let cmd = i.modifiers.command;
            let s = cmd && i.key_pressed(Key::S);
            let n = cmd && i.key_pressed(Key::N);
            let o = cmd && i.key_pressed(Key::O);
            let f = cmd && i.key_pressed(Key::F);
            let e = cmd && i.key_pressed(Key::E);
            (s, n, o, f, e)
        });

        if input.0 {
            self.save_active_note();
        }
        if input.1 {
            self.open_new_note_dialog();
        }
        if input.2 {
            self.pick_and_open_vault();
        }
        if input.3 {
            self.sidebar_tab = SidebarTab::Search;
        }
        if input.4 {
            self.view_mode = match self.view_mode {
                ViewMode::Edit => ViewMode::Split,
                ViewMode::Split => ViewMode::Preview,
                ViewMode::Preview => ViewMode::Edit,
            };
        }
    }

    fn execute_pending_action(&mut self, action: PendingAction) {
        match action {
            PendingAction::OpenNote(path) => {
                self.do_open_note(&path);
            }
            PendingAction::PickVault => {
                self.do_pick_and_open_vault();
            }
        }
    }
}

impl eframe::App for BetterObsidianApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Keyboard Shortcuts
        self.handle_shortcuts(ctx);

        // Debounced Search Engine Update
        self.search_engine.poll();
        if self.search_engine.is_searching {
            if let Some(t) = self.search_engine.last_input_time {
                let elapsed = t.elapsed();
                if elapsed >= Duration::from_millis(300) {
                    self.search_engine.update(&self.vault, false);
                } else {
                    let remaining = Duration::from_millis(300) - elapsed;
                    ctx.request_repaint_after(remaining);
                }
            } else {
                ctx.request_repaint_after(Duration::from_millis(50));
            }
        }

        // Top Navigation Bar
        TopBottomPanel::top("top_panel").show(ctx, |ui| {
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new("Better Obsidian")
                        .strong()
                        .color(Theme::ACCENT_PURPLE),
                );
                ui.separator();

                if let Some(vault) = &self.vault {
                    let folder_name = vault
                        .root_path
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "Vault".to_string());
                    ui.label(
                        RichText::new(format!("📁 {}", folder_name)).color(Theme::TEXT_PRIMARY),
                    );
                    ui.label(
                        RichText::new(format!("({})", vault.root_path.to_string_lossy()))
                            .color(Theme::TEXT_MUTED)
                            .size(11.0),
                    );
                } else {
                    ui.label(RichText::new("No Vault Selected").color(Theme::TEXT_MUTED));
                }

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.button("➕ New Note (Ctrl+N)").clicked() {
                        self.open_new_note_dialog();
                    }
                    if ui.button("📂 Open Vault (Ctrl+O)").clicked() {
                        self.pick_and_open_vault();
                    }
                });
            });
            ui.add_space(4.0);
        });

        // Bottom Status Bar
        TopBottomPanel::bottom("bottom_panel").show(ctx, |ui| {
            ui.add_space(3.0);
            ui.horizontal(|ui| {
                // Left: Error banner or status message or vault info
                if let Some((err, time)) = &self.error_banner {
                    if time.elapsed() < Duration::from_secs(8) {
                        ui.label(
                            RichText::new(format!("⚠️ {}", err))
                                .color(Theme::ACCENT_RED)
                                .strong(),
                        );
                    } else {
                        self.error_banner = None;
                    }
                } else if let Some((msg, time)) = &self.status_message {
                    if time.elapsed() < Duration::from_secs(5) {
                        ui.label(RichText::new(format!("✓ {}", msg)).color(Theme::ACCENT_GREEN));
                    } else {
                        self.status_message = None;
                    }
                } else if let Some(active) = &self.active_note {
                    ui.label(
                        RichText::new(format!("📄 {}", active.rel_path)).color(Theme::TEXT_MUTED),
                    );
                } else {
                    ui.label(RichText::new("Ready").color(Theme::TEXT_DIMMED));
                }

                // Right: Word & Char count, encoding, dirty status
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if let Some(active) = &self.active_note {
                        if active.is_dirty() {
                            ui.label(
                                RichText::new("● Unsaved (Ctrl+S)").color(Theme::ACCENT_ORANGE),
                            );
                        } else {
                            ui.label(RichText::new("✓ Saved").color(Theme::ACCENT_GREEN));
                        }

                        ui.separator();
                        ui.label(RichText::new("UTF-8").color(Theme::TEXT_DIMMED));
                        ui.separator();

                        let (words, chars) = count_words_and_chars(&active.content);
                        ui.label(
                            RichText::new(format!("{} words, {} chars", words, chars))
                                .color(Theme::TEXT_MUTED),
                        );
                    }
                });
            });
            ui.add_space(3.0);
        });

        // Left Sidebar Panel
        SidePanel::left("left_sidebar_panel")
            .resizable(true)
            .default_width(260.0)
            .width_range(180.0..=450.0)
            .show(ctx, |ui| {
                render_sidebar(ui, self);
            });

        // Central Panel (Editor / Markdown Preview)
        CentralPanel::default().show(ctx, |ui| {
            render_editor_area(ui, self);
        });

        // Modal Dialogs
        if let Some(note) = self.new_note_dialog.render(ctx, &mut self.vault) {
            let path = note.abs_path.clone();
            self.do_open_note(&path);
            self.set_status(format!("Created note '{}'", note.title));
        }

        if let Some(note) = self.missing_wikilink_dialog.render(ctx, &mut self.vault) {
            let path = note.abs_path.clone();
            self.do_open_note(&path);
            self.set_status(format!("Created note '{}'", note.title));
        }

        if let Some(choice) = self.unsaved_dialog.render(ctx) {
            match choice {
                UnsavedChoice::SaveAndProceed(action) => {
                    if self.save_active_note() {
                        self.execute_pending_action(action);
                    } else if let Some(active) = &self.active_note {
                        self.unsaved_dialog.open(active.rel_path.clone(), action);
                    }
                }
                UnsavedChoice::DiscardAndProceed(action) => {
                    self.execute_pending_action(action);
                }
                UnsavedChoice::Cancel => {}
            }
        }
    }
}

fn count_words_and_chars(text: &str) -> (usize, usize) {
    let chars = text.chars().count();
    let words = text.split_whitespace().count();
    (words, chars)
}
