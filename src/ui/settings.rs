use super::theme::Theme;
use crate::config::{AccentColor, AppConfig, ThemeMode};
use crate::vault::Vault;
use egui::{Align2, Color32, Id, Key, RichText, Stroke, TextEdit, Window};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsCategory {
    General,
    Appearance,
    CorePlugins,
    Hotkeys,
    About,
}

impl Default for SettingsCategory {
    fn default() -> Self {
        Self::General
    }
}

#[derive(Default)]
pub struct SettingsDialog {
    pub is_open: bool,
    pub category: SettingsCategory,
    pub hotkey_filter: String,
}

impl SettingsDialog {
    pub fn open(&mut self) {
        self.is_open = true;
        self.hotkey_filter.clear();
    }

    pub fn render(
        &mut self,
        ctx: &egui::Context,
        vault: Option<&Vault>,
        config: &mut AppConfig,
        switch_vault: &mut Option<PathBuf>,
        pick_vault: &mut bool,
    ) {
        if !self.is_open {
            return;
        }

        if ctx.input(|i| i.key_pressed(Key::Escape)) {
            self.is_open = false;
            return;
        }

        let mut is_open = self.is_open;

        Window::new("Settings")
            .id(Id::new("modal_settings_dialog"))
            .collapsible(false)
            .resizable(false)
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .open(&mut is_open)
            .show(ctx, |ui| {
                ui.set_min_size(egui::vec2(660.0, 440.0));
                ui.set_max_size(egui::vec2(760.0, 520.0));

                ui.horizontal(|ui| {
                    // Left navigation category list (width 160px)
                    ui.allocate_ui(egui::vec2(160.0, ui.available_height()), |ui| {
                        ui.vertical(|ui| {
                            ui.add_space(6.0);
                            for (cat, label) in [
                                (SettingsCategory::General, "General"),
                                (SettingsCategory::Appearance, "Appearance"),
                                (SettingsCategory::CorePlugins, "Core plugins"),
                                (SettingsCategory::Hotkeys, "Hotkeys"),
                                (SettingsCategory::About, "About"),
                            ] {
                                let is_selected = self.category == cat;
                                let (rect, response) = ui.allocate_exact_size(
                                    egui::vec2(ui.available_width() - 8.0, 28.0),
                                    egui::Sense::click(),
                                );

                                if is_selected {
                                    ui.painter().rect_filled(rect, 4.0, Theme::BG_CARD);
                                    ui.painter().line_segment(
                                        [
                                            rect.left_top() + egui::vec2(1.0, 3.0),
                                            rect.left_bottom() + egui::vec2(1.0, -3.0),
                                        ],
                                        Stroke::new(2.5_f32, Theme::ACCENT_BLUE),
                                    );
                                } else if response.hovered() {
                                    ui.painter().rect_filled(rect, 4.0, Theme::BG_ROW_HOVER);
                                }

                                let text_color = if is_selected {
                                    Theme::TEXT_PRIMARY
                                } else if response.hovered() {
                                    Theme::TEXT_PRIMARY
                                } else {
                                    Theme::TEXT_MUTED
                                };

                                ui.painter().text(
                                    rect.left_center() + egui::vec2(12.0, 0.0),
                                    egui::Align2::LEFT_CENTER,
                                    label,
                                    egui::FontId::proportional(12.5),
                                    text_color,
                                );

                                if response.clicked() {
                                    self.category = cat;
                                }
                                ui.add_space(2.0);
                            }
                        });
                    });

                    // Vertical divider between categories and content
                    ui.painter().line_segment(
                        [
                            egui::pos2(ui.cursor().min.x, ui.min_rect().min.y),
                            egui::pos2(ui.cursor().min.x, ui.max_rect().max.y),
                        ],
                        Stroke::new(1.0_f32, Theme::BORDER),
                    );
                    ui.add_space(12.0);

                    // Right content pane
                    ui.vertical(|ui| {
                        ui.add_space(6.0);
                        match self.category {
                            SettingsCategory::General => {
                                ui.label(
                                    RichText::new("General Settings")
                                        .strong()
                                        .size(15.0)
                                        .color(Theme::TEXT_PRIMARY),
                                );
                                ui.add_space(10.0);

                                ui.label(
                                    RichText::new("OPEN VAULT")
                                        .strong()
                                        .size(10.5)
                                        .color(Theme::TEXT_DIMMED),
                                );
                                ui.add_space(4.0);

                                if let Some(v) = vault {
                                    ui.label(
                                        RichText::new(format!(
                                            "Current vault folder: {}",
                                            v.root_path.display()
                                        ))
                                        .size(11.5)
                                        .color(Theme::TEXT_MUTED),
                                    );
                                } else {
                                    ui.label(
                                        RichText::new("No vault open.")
                                            .size(11.5)
                                            .color(Theme::TEXT_MUTED),
                                    );
                                }
                                ui.add_space(6.0);

                                if ui.button("Choose another vault folder · Ctrl+O").clicked() {
                                    *pick_vault = true;
                                }

                                ui.add_space(16.0);
                                ui.separator();
                                ui.add_space(10.0);

                                ui.label(
                                    RichText::new("RECENT VAULTS")
                                        .strong()
                                        .size(10.5)
                                        .color(Theme::TEXT_DIMMED),
                                );
                                ui.add_space(6.0);

                                if config.recent_vaults.is_empty() {
                                    ui.label(
                                        RichText::new("No recent vaults.")
                                            .size(11.0)
                                            .color(Theme::TEXT_MUTED),
                                    );
                                } else {
                                    for path in &config.recent_vaults {
                                        let name = path
                                            .file_name()
                                            .map(|s| s.to_string_lossy().to_string())
                                            .unwrap_or_else(|| path.display().to_string());
                                        ui.horizontal(|ui| {
                                            if ui.button(format!("Open {}", name)).clicked() {
                                                *switch_vault = Some(path.clone());
                                            }
                                            ui.label(
                                                RichText::new(path.display().to_string())
                                                    .size(10.5)
                                                    .color(Theme::TEXT_DIMMED),
                                            );
                                        });
                                    }
                                }
                            }
                            SettingsCategory::Appearance => {
                                ui.label(
                                    RichText::new("Appearance")
                                        .strong()
                                        .size(15.0)
                                        .color(Theme::TEXT_PRIMARY),
                                );
                                ui.add_space(10.0);

                                ui.label(
                                    RichText::new("BASE THEME")
                                        .strong()
                                        .size(10.5)
                                        .color(Theme::TEXT_DIMMED),
                                );
                                ui.add_space(4.0);

                                ui.horizontal_wrapped(|ui| {
                                    for (mode, title, desc) in [
                                        (ThemeMode::Dark, "Obsidian Dark", "Default charcoal (#1e1e1e)"),
                                        (ThemeMode::Light, "Obsidian Light", "Clean bright theme"),
                                        (ThemeMode::Nord, "Nord", "Arctic blue-slate"),
                                        (ThemeMode::Dracula, "Dracula", "Vibrant purple-dark"),
                                    ] {
                                        let is_sel = config.theme_mode == mode;
                                        let (r, resp) = ui.allocate_exact_size(
                                            egui::vec2(130.0, 48.0),
                                            egui::Sense::click(),
                                        );
                                        let fill = if is_sel {
                                            Theme::BG_CARD
                                        } else if resp.hovered() {
                                            Theme::BG_ROW_HOVER
                                        } else {
                                            Theme::BG_SECONDARY
                                        };
                                        ui.painter().rect_filled(r, 6.0, fill);
                                        ui.painter().rect_stroke(
                                            r,
                                            6.0,
                                            Stroke::new(
                                                if is_sel { 1.5_f32 } else { 1.0_f32 },
                                                if is_sel {
                                                    Theme::accent_to_color(config.accent_color)
                                                } else {
                                                    Theme::BORDER
                                                },
                                            ),
                                        );
                                        ui.painter().text(
                                            r.min + egui::vec2(10.0, 14.0),
                                            Align2::LEFT_CENTER,
                                            title,
                                            egui::FontId::proportional(12.0),
                                            if is_sel { Theme::TEXT_PRIMARY } else { Theme::TEXT_MUTED },
                                        );
                                        ui.painter().text(
                                            r.min + egui::vec2(10.0, 32.0),
                                            Align2::LEFT_CENTER,
                                            desc,
                                            egui::FontId::proportional(9.5),
                                            Theme::TEXT_DIMMED,
                                        );
                                        if resp.clicked() {
                                            config.theme_mode = mode;
                                            Theme::apply_with_config(ui.ctx(), config);
                                            config.save();
                                        }
                                        ui.add_space(6.0);
                                    }
                                });

                                ui.add_space(16.0);
                                ui.separator();
                                ui.add_space(10.0);

                                ui.label(
                                    RichText::new("ACCENT PALETTE")
                                        .strong()
                                        .size(10.5)
                                        .color(Theme::TEXT_DIMMED),
                                );
                                ui.add_space(6.0);

                                ui.horizontal_wrapped(|ui| {
                                    for (accent, name) in [
                                        (AccentColor::Purple, "Obsidian Purple"),
                                        (AccentColor::Blue, "Sapphire Blue"),
                                        (AccentColor::Green, "Emerald Green"),
                                        (AccentColor::Amber, "Sunset Amber"),
                                        (AccentColor::Red, "Crimson Red"),
                                        (AccentColor::Cyan, "Electric Cyan"),
                                        (AccentColor::Pink, "Rose Pink"),
                                    ] {
                                        let is_sel = config.accent_color == accent;
                                        let col = Theme::accent_to_color(accent);
                                        let (r, resp) = ui.allocate_exact_size(
                                            egui::vec2(28.0, 28.0),
                                            egui::Sense::click(),
                                        );
                                        if resp.hovered() {
                                            ui.painter().rect_filled(r.expand(2.0), 5.0, Theme::BG_CARD);
                                        }
                                        ui.painter().rect_filled(r, 4.0, col);
                                        if is_sel {
                                            ui.painter().rect_stroke(
                                                r.expand(3.0),
                                                6.0,
                                                Stroke::new(2.0_f32, Color32::WHITE),
                                            );
                                        }
                                        if resp.clicked() {
                                            config.accent_color = accent;
                                            Theme::apply_with_config(ui.ctx(), config);
                                            config.save();
                                        }
                                        resp.on_hover_text(name);
                                        ui.add_space(8.0);
                                    }
                                });

                                ui.add_space(16.0);
                                ui.separator();
                                ui.add_space(10.0);

                                ui.label(
                                    RichText::new("EDITOR TYPOGRAPHY")
                                        .strong()
                                        .size(10.5)
                                        .color(Theme::TEXT_DIMMED),
                                );
                                ui.add_space(4.0);
                                ui.label(
                                    RichText::new("Monospace code font for markdown editing, proportional for reading view.")
                                        .size(11.0)
                                        .color(Theme::TEXT_MUTED),
                                );
                            }
                            SettingsCategory::CorePlugins => {
                                ui.label(
                                    RichText::new("Core Plugins")
                                        .strong()
                                        .size(15.0)
                                        .color(Theme::TEXT_PRIMARY),
                                );
                                ui.add_space(4.0);
                                ui.label(
                                    RichText::new(
                                        "Enable or disable built-in features to customize your workspace.",
                                    )
                                    .size(11.0)
                                    .color(Theme::TEXT_MUTED),
                                );
                                ui.add_space(8.0);
                                ui.separator();
                                ui.add_space(6.0);

                                let mut plugins_changed = false;

                                egui::ScrollArea::vertical()
                                    .id_salt("core_plugins_scroll")
                                    .max_height(300.0)
                                    .show(ui, |ui| {
                                        let mut plugin_row = |ui: &mut egui::Ui,
                                                              name: &str,
                                                              desc: &str,
                                                              enabled: &mut bool| {
                                            ui.horizontal(|ui| {
                                                ui.vertical(|ui| {
                                                    ui.label(
                                                        RichText::new(name)
                                                            .strong()
                                                            .size(12.5)
                                                            .color(Theme::TEXT_PRIMARY),
                                                    );
                                                    ui.label(
                                                        RichText::new(desc)
                                                            .size(11.0)
                                                            .color(Theme::TEXT_MUTED),
                                                    );
                                                });
                                                ui.with_layout(
                                                    egui::Layout::right_to_left(egui::Align::Center),
                                                    |ui| {
                                                        if ui.checkbox(enabled, "").changed() {
                                                            plugins_changed = true;
                                                        }
                                                    },
                                                );
                                            });
                                            ui.add_space(3.0);
                                            ui.separator();
                                            ui.add_space(3.0);
                                        };

                                        plugin_row(
                                            ui,
                                            "File explorer",
                                            "View and manage files and folders in your vault.",
                                            &mut config.core_plugins.file_explorer,
                                        );
                                        plugin_row(
                                            ui,
                                            "Search",
                                            "Search for notes and text across the entire vault.",
                                            &mut config.core_plugins.search,
                                        );
                                        plugin_row(
                                            ui,
                                            "Bookmarks",
                                            "Bookmark important notes and quick shortcuts.",
                                            &mut config.core_plugins.bookmarks,
                                        );
                                        plugin_row(
                                            ui,
                                            "Tags view",
                                            "Browse and filter your notes by hashtag taxonomy.",
                                            &mut config.core_plugins.tags,
                                        );
                                        plugin_row(
                                            ui,
                                            "Graph view",
                                            "Visually explore connections and links across notes.",
                                            &mut config.core_plugins.graph_view,
                                        );
                                        plugin_row(
                                            ui,
                                            "Canvas",
                                            "Infinite visual board to arrange cards, notes, and links.",
                                            &mut config.core_plugins.canvas,
                                        );
                                        plugin_row(
                                            ui,
                                            "Daily notes",
                                            "Quickly jump to or create today's journal note.",
                                            &mut config.core_plugins.daily_notes,
                                        );
                                        plugin_row(
                                            ui,
                                            "Templates",
                                            "Insert reusable Markdown templates into your notes.",
                                            &mut config.core_plugins.templates,
                                        );
                                        plugin_row(
                                            ui,
                                            "Outline",
                                            "Display table of contents and headings of the active note.",
                                            &mut config.core_plugins.outline,
                                        );
                                        plugin_row(
                                            ui,
                                            "Backlinks",
                                            "Show which notes link to the current note.",
                                            &mut config.core_plugins.backlinks,
                                        );
                                        plugin_row(
                                            ui,
                                            "Word count",
                                            "Show real-time word and character statistics in the status bar.",
                                            &mut config.core_plugins.word_count,
                                        );
                                    });

                                if plugins_changed {
                                    config.save();
                                }
                            }
                            SettingsCategory::Hotkeys => {
                                ui.label(
                                    RichText::new("Keyboard Shortcuts")
                                        .strong()
                                        .size(15.0)
                                        .color(Theme::TEXT_PRIMARY),
                                );
                                ui.add_space(6.0);

                                ui.add(
                                    TextEdit::singleline(&mut self.hotkey_filter)
                                        .hint_text("Filter shortcuts…")
                                        .desired_width(ui.available_width() - 16.0),
                                );
                                ui.add_space(8.0);

                                let needle = self.hotkey_filter.trim().to_lowercase();
                                let hotkeys = [
                                    ("Ctrl+P", "Open command palette"),
                                    ("Ctrl+O", "Quick switcher / Search notes"),
                                    ("Ctrl+N", "Create new note"),
                                    ("Ctrl+S", "Save active note or canvas"),
                                    ("Ctrl+F", "Search within vault"),
                                    ("Ctrl+G", "Open graph view"),
                                    ("Ctrl+D", "Open today's daily note"),
                                    ("Ctrl+E", "Toggle editing / reading view"),
                                    ("Ctrl+W", "Close active tab"),
                                    ("Ctrl+B", "Toggle bookmark / bold text"),
                                    ("Ctrl+I", "Format selection as italic"),
                                    ("Ctrl+K", "Insert wikilink / link"),
                                    ("Ctrl+,", "Open settings dialog"),
                                    ("Ctrl+Tab", "Next tab"),
                                    ("Ctrl+Shift+Tab", "Previous tab"),
                                    ("Escape", "Close modal / palette / search"),
                                ];

                                egui::ScrollArea::vertical()
                                    .max_height(280.0)
                                    .show(ui, |ui| {
                                        for (keys, desc) in hotkeys {
                                            if !needle.is_empty()
                                                && !keys.to_lowercase().contains(&needle)
                                                && !desc.to_lowercase().contains(&needle)
                                            {
                                                continue;
                                            }

                                            ui.horizontal(|ui| {
                                                ui.allocate_ui(egui::vec2(130.0, 22.0), |ui| {
                                                    ui.label(
                                                        RichText::new(keys)
                                                            .size(11.5)
                                                            .strong()
                                                            .color(Theme::ACCENT_BLUE),
                                                    );
                                                });
                                                ui.label(
                                                    RichText::new(desc)
                                                        .size(11.5)
                                                        .color(Theme::TEXT_PRIMARY),
                                                );
                                            });
                                            ui.add_space(2.0);
                                        }
                                    });
                            }
                            SettingsCategory::About => {
                                ui.label(
                                    RichText::new("About Better Obsidian")
                                        .strong()
                                        .size(15.0)
                                        .color(Theme::TEXT_PRIMARY),
                                );
                                ui.add_space(8.0);

                                ui.label(
                                    RichText::new(
                                        "A 1:1 lightweight native clone of Obsidian for low-end PCs.",
                                    )
                                    .size(12.5)
                                    .color(Theme::TEXT_PRIMARY),
                                );
                                ui.add_space(6.0);
                                ui.label(
                                    RichText::new(
                                        "Built in 100% pure Rust with eframe / egui 0.29 on the Glow hardware renderer.\nNo Electron runtime, no Chromium webview, instant startup, and tiny memory footprint.",
                                    )
                                    .size(11.5)
                                    .color(Theme::TEXT_MUTED),
                                );

                                ui.add_space(14.0);
                                ui.separator();
                                ui.add_space(10.0);

                                ui.label(
                                    RichText::new("SYSTEM & BUILD INFO")
                                        .strong()
                                        .size(10.5)
                                        .color(Theme::TEXT_DIMMED),
                                );
                                ui.add_space(4.0);
                                ui.label(
                                    RichText::new("Version: 0.1.0\nRenderer: OpenGL (Glow)\nFile format: Plain Markdown (.md) and Obsidian Canvas (.canvas)")
                                        .size(11.0)
                                        .color(Theme::TEXT_MUTED),
                                );
                            }
                        }
                    });
                });
            });

        self.is_open = is_open;
    }
}
