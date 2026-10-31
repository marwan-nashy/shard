use super::theme::Theme;
use crate::config::{AccentColor, AppConfig, ThemeMode};
use crate::vault::Vault;
use egui::{
    Align2, Color32, Id, Key, Margin, RichText, Rounding, ScrollArea, Stroke, TextEdit, Window,
};
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
            .resizable(true)
            .default_size(egui::vec2(800.0, 560.0))
            .min_size(egui::vec2(680.0, 460.0))
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .open(&mut is_open)
            .show(ctx, |ui| {
                let accent = Theme::accent_to_color(config.accent_color);

                ui.horizontal(|ui| {
                    // Left navigation category list (width 160px)
                    ui.allocate_ui(egui::vec2(160.0, ui.available_height()), |ui| {
                        ui.vertical(|ui| {
                            ui.add_space(4.0);
                            for (cat, label) in [
                                (SettingsCategory::General, "General"),
                                (SettingsCategory::Appearance, "Appearance"),
                                (SettingsCategory::CorePlugins, "Core plugins"),
                                (SettingsCategory::Hotkeys, "Hotkeys"),
                                (SettingsCategory::About, "About"),
                            ] {
                                let is_selected = self.category == cat;
                                let (rect, response) = ui.allocate_exact_size(
                                    egui::vec2(ui.available_width() - 8.0, 32.0),
                                    egui::Sense::click(),
                                );

                                if is_selected {
                                    ui.painter().rect_filled(rect, 4.0, Theme::BG_CARD);
                                    ui.painter().line_segment(
                                        [
                                            rect.left_top() + egui::vec2(1.0, 4.0),
                                            rect.left_bottom() + egui::vec2(1.0, -4.0),
                                        ],
                                        Stroke::new(2.5_f32, accent),
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
                                    rect.left_center() + egui::vec2(14.0, 0.0),
                                    Align2::LEFT_CENTER,
                                    label,
                                    egui::FontId::proportional(13.0),
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

                    // Right content pane filling ALL available width and height
                    ui.allocate_ui_with_layout(
                        egui::vec2(ui.available_width(), ui.available_height()),
                        egui::Layout::top_down(egui::Align::LEFT),
                        |ui| match self.category {
                            SettingsCategory::General => {
                                render_general_tab(ui, vault, config, switch_vault, pick_vault);
                            }
                            SettingsCategory::Appearance => {
                                render_appearance_tab(ui, config, accent);
                            }
                            SettingsCategory::CorePlugins => {
                                render_core_plugins_tab(ui, config, accent);
                            }
                            SettingsCategory::Hotkeys => {
                                render_hotkeys_tab(ui, &mut self.hotkey_filter);
                            }
                            SettingsCategory::About => {
                                render_about_tab(ui);
                            }
                        },
                    );
                });
            });

        self.is_open = is_open;
    }
}

fn toggle_switch(ui: &mut egui::Ui, enabled: &mut bool, accent: Color32) -> egui::Response {
    let desired_size = egui::vec2(34.0, 18.0);
    let (rect, mut response) = ui.allocate_exact_size(desired_size, egui::Sense::click());
    if response.clicked() {
        *enabled = !*enabled;
        response.mark_changed();
    }

    let track_color = if *enabled {
        accent
    } else if response.hovered() {
        Color32::from_rgb(52, 52, 52)
    } else {
        Color32::from_rgb(40, 40, 40)
    };

    let painter = ui.painter();
    painter.rect_filled(rect, 9.0, track_color);
    if !*enabled {
        painter.rect_stroke(rect, 9.0, Stroke::new(1.0_f32, Theme::BORDER));
    }

    let knob_radius = 6.5_f32;
    let knob_x = if *enabled {
        rect.max.x - knob_radius - 2.5_f32
    } else {
        rect.min.x + knob_radius + 2.5_f32
    };
    let knob_center = egui::pos2(knob_x, rect.center().y);
    painter.circle_filled(knob_center, knob_radius, Color32::WHITE);

    response
}

fn render_hotkey_pill(ui: &mut egui::Ui, keys_str: &str) {
    ui.horizontal(|ui| {
        let parts: Vec<&str> = keys_str.split('+').map(|s| s.trim()).collect();
        for (i, part) in parts.iter().enumerate() {
            if i > 0 {
                ui.label(RichText::new("+").size(10.0).color(Theme::TEXT_DIMMED));
            }
            let (rect, _) = ui.allocate_exact_size(
                egui::vec2((part.len() as f32 * 7.5 + 12.0).max(22.0), 20.0),
                egui::Sense::hover(),
            );
            ui.painter().rect_filled(rect, 4.0, Theme::BG_CARD);
            ui.painter()
                .rect_stroke(rect, 4.0, Stroke::new(1.0_f32, Theme::BORDER));
            ui.painter().text(
                rect.center(),
                Align2::CENTER_CENTER,
                *part,
                egui::FontId::proportional(11.0),
                Theme::TEXT_PRIMARY,
            );
        }
    });
}

fn render_general_tab(
    ui: &mut egui::Ui,
    vault: Option<&Vault>,
    config: &mut AppConfig,
    switch_vault: &mut Option<PathBuf>,
    pick_vault: &mut bool,
) {
    ui.label(
        RichText::new("General Settings")
            .strong()
            .size(16.0)
            .color(Theme::TEXT_PRIMARY),
    );
    ui.add_space(4.0);
    ui.label(
        RichText::new("Manage vault storage, recent repositories, and application defaults.")
            .size(11.5)
            .color(Theme::TEXT_MUTED),
    );
    ui.add_space(8.0);
    ui.separator();
    ui.add_space(8.0);

    ScrollArea::vertical()
        .id_salt("general_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.label(
                RichText::new("ACTIVE VAULT")
                    .strong()
                    .size(10.5)
                    .color(Theme::TEXT_DIMMED),
            );
            ui.add_space(6.0);

            egui::Frame::none()
                .fill(Theme::BG_CARD)
                .stroke(Stroke::new(1.0_f32, Theme::BORDER))
                .rounding(Rounding::same(6.0))
                .inner_margin(Margin::same(12.0))
                .show(ui, |ui| {
                    if let Some(v) = vault {
                        let folder_name = v
                            .root_path
                            .file_name()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_else(|| "Vault".to_string());
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(format!("📁 {}", folder_name))
                                    .strong()
                                    .size(13.0)
                                    .color(Theme::TEXT_PRIMARY),
                            );
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    if ui.button("Switch vault · Ctrl+O").clicked() {
                                        *pick_vault = true;
                                    }
                                },
                            );
                        });
                        ui.add_space(4.0);
                        ui.label(
                            RichText::new(v.root_path.display().to_string())
                                .size(11.0)
                                .color(Theme::TEXT_MUTED),
                        );
                        ui.add_space(4.0);
                        ui.label(
                            RichText::new(format!(
                                "{} notes · {} canvases · {} bookmarks",
                                v.notes.len(),
                                v.canvases.len(),
                                config.bookmarks.len()
                            ))
                            .size(10.5)
                            .color(Theme::TEXT_DIMMED),
                        );
                    } else {
                        ui.label(
                            RichText::new("No active vault opened.")
                                .size(12.0)
                                .color(Theme::TEXT_MUTED),
                        );
                        ui.add_space(6.0);
                        if ui.button("Open a vault folder · Ctrl+O").clicked() {
                            *pick_vault = true;
                        }
                    }
                });

            ui.add_space(14.0);
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
                    RichText::new("No recent vaults opened yet.")
                        .size(11.5)
                        .color(Theme::TEXT_MUTED),
                );
            } else {
                for path in config.recent_vaults.clone() {
                    let folder_name = path
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| path.display().to_string());

                    egui::Frame::none()
                        .fill(Theme::BG_CARD)
                        .stroke(Stroke::new(1.0_f32, Theme::BORDER))
                        .rounding(Rounding::same(4.0))
                        .inner_margin(Margin::symmetric(10.0, 8.0))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                ui.label(
                                    RichText::new(format!("📁 {}", folder_name))
                                        .strong()
                                        .size(12.0)
                                        .color(Theme::TEXT_PRIMARY),
                                );
                                ui.add_space(6.0);
                                ui.label(
                                    RichText::new(path.display().to_string())
                                        .size(10.5)
                                        .color(Theme::TEXT_DIMMED),
                                );

                                ui.with_layout(
                                    egui::Layout::right_to_left(egui::Align::Center),
                                    |ui| {
                                        if ui.small_button("Open").clicked() {
                                            *switch_vault = Some(path.clone());
                                        }
                                    },
                                );
                            });
                        });
                    ui.add_space(4.0);
                }
            }
        });
}

fn render_appearance_tab(ui: &mut egui::Ui, config: &mut AppConfig, accent: Color32) {
    ui.label(
        RichText::new("Appearance")
            .strong()
            .size(16.0)
            .color(Theme::TEXT_PRIMARY),
    );
    ui.add_space(4.0);
    ui.label(
        RichText::new("Customize themes, color schemes, accent palette, and workspace aesthetics.")
            .size(11.5)
            .color(Theme::TEXT_MUTED),
    );
    ui.add_space(8.0);
    ui.separator();
    ui.add_space(8.0);

    ScrollArea::vertical()
        .id_salt("appearance_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.label(
                RichText::new("BASE THEME")
                    .strong()
                    .size(10.5)
                    .color(Theme::TEXT_DIMMED),
            );
            ui.add_space(6.0);

            ui.horizontal_wrapped(|ui| {
                for (mode, title, desc) in [
                    (
                        ThemeMode::Dark,
                        "Obsidian Dark",
                        "Default neutral charcoal (#1e1e1e)",
                    ),
                    (
                        ThemeMode::Light,
                        "Obsidian Light",
                        "Clean crisp bright theme",
                    ),
                    (ThemeMode::Nord, "Nord", "Arctic cold blue-slate palette"),
                    (ThemeMode::Dracula, "Dracula", "Vibrant gothic purple-dark"),
                ] {
                    let is_sel = config.theme_mode == mode;
                    let (r, resp) =
                        ui.allocate_exact_size(egui::vec2(136.0, 52.0), egui::Sense::click());
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
                            if is_sel { 2.0_f32 } else { 1.0_f32 },
                            if is_sel { accent } else { Theme::BORDER },
                        ),
                    );
                    ui.painter().text(
                        r.min + egui::vec2(10.0, 16.0),
                        Align2::LEFT_CENTER,
                        title,
                        egui::FontId::proportional(12.5),
                        if is_sel {
                            Theme::TEXT_PRIMARY
                        } else {
                            Theme::TEXT_MUTED
                        },
                    );
                    ui.painter().text(
                        r.min + egui::vec2(10.0, 36.0),
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
                    ui.add_space(8.0);
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
                for (accent_choice, name) in [
                    (AccentColor::Purple, "Obsidian Purple"),
                    (AccentColor::Blue, "Sapphire Blue"),
                    (AccentColor::Green, "Emerald Green"),
                    (AccentColor::Amber, "Sunset Amber"),
                    (AccentColor::Red, "Crimson Red"),
                    (AccentColor::Cyan, "Electric Cyan"),
                    (AccentColor::Pink, "Rose Pink"),
                ] {
                    let is_sel = config.accent_color == accent_choice;
                    let col = Theme::accent_to_color(accent_choice);
                    let (r, resp) =
                        ui.allocate_exact_size(egui::vec2(32.0, 32.0), egui::Sense::click());
                    if resp.hovered() {
                        ui.painter().rect_filled(r.expand(2.0), 6.0, Theme::BG_CARD);
                    }
                    ui.painter().rect_filled(r, 5.0, col);
                    if is_sel {
                        ui.painter().rect_stroke(
                            r.expand(3.0),
                            7.0,
                            Stroke::new(2.0_f32, Color32::WHITE),
                        );
                    }
                    if resp.clicked() {
                        config.accent_color = accent_choice;
                        Theme::apply_with_config(ui.ctx(), config);
                        config.save();
                    }
                    resp.on_hover_text(name);
                    ui.add_space(10.0);
                }
            });

            ui.add_space(18.0);
            ui.separator();
            ui.add_space(10.0);

            ui.label(
                RichText::new("THEME PREVIEW")
                    .strong()
                    .size(10.5)
                    .color(Theme::TEXT_DIMMED),
            );
            ui.add_space(6.0);

            egui::Frame::none()
                .fill(Theme::BG_SECONDARY)
                .stroke(Stroke::new(1.0_f32, Theme::BORDER))
                .rounding(Rounding::same(6.0))
                .inner_margin(Margin::same(12.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        let tab_rect =
                            egui::Rect::from_min_size(ui.cursor().min, egui::vec2(110.0, 26.0));
                        ui.painter().rect_filled(tab_rect, 4.0, Theme::BG_CARD);
                        ui.painter().line_segment(
                            [tab_rect.left_top(), tab_rect.right_top()],
                            Stroke::new(2.0_f32, accent),
                        );
                        ui.painter().text(
                            tab_rect.center(),
                            Align2::CENTER_CENTER,
                            "Sample Note.md",
                            egui::FontId::proportional(11.5),
                            Theme::TEXT_PRIMARY,
                        );
                        ui.add_space(120.0);
                        ui.label(
                            RichText::new("Live surface, border, and accent rendering")
                                .size(11.5)
                                .color(Theme::TEXT_MUTED),
                        );
                    });
                    ui.add_space(10.0);
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("Links appear in accent color: ")
                                .size(11.5)
                                .color(Theme::TEXT_PRIMARY),
                        );
                        ui.label(
                            RichText::new("[[Connected Notes]]")
                                .size(11.5)
                                .color(accent)
                                .strong(),
                        );
                    });
                });
        });
}

fn render_core_plugins_tab(ui: &mut egui::Ui, config: &mut AppConfig, accent: Color32) {
    ui.label(
        RichText::new("Core Plugins")
            .strong()
            .size(16.0)
            .color(Theme::TEXT_PRIMARY),
    );
    ui.add_space(4.0);
    ui.label(
        RichText::new("Enable or disable built-in features to customize your workspace.")
            .size(11.5)
            .color(Theme::TEXT_MUTED),
    );
    ui.add_space(8.0);
    ui.separator();
    ui.add_space(4.0);

    let mut plugins_changed = false;

    ScrollArea::vertical()
        .id_salt("core_plugins_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            let mut plugin_row = |ui: &mut egui::Ui, name: &str, desc: &str, enabled: &mut bool| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            RichText::new(name)
                                .strong()
                                .size(12.5)
                                .color(Theme::TEXT_PRIMARY),
                        );
                        ui.label(RichText::new(desc).size(11.0).color(Theme::TEXT_MUTED));
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if toggle_switch(ui, enabled, accent).changed() {
                            plugins_changed = true;
                        }
                    });
                });
                ui.add_space(4.0);
                ui.separator();
                ui.add_space(4.0);
            };

            plugin_row(
                ui,
                "File explorer",
                "View and manage files, folders, and markdown documents in your vault.",
                &mut config.core_plugins.file_explorer,
            );
            plugin_row(
                ui,
                "Search",
                "Search for notes, text phrases, and headings across the entire vault.",
                &mut config.core_plugins.search,
            );
            plugin_row(
                ui,
                "Bookmarks",
                "Bookmark important notes and quickly access them from the ribbon.",
                &mut config.core_plugins.bookmarks,
            );
            plugin_row(
                ui,
                "Tags view",
                "Browse, filter, and organize notes by #hashtags taxonomy.",
                &mut config.core_plugins.tags,
            );
            plugin_row(
                ui,
                "Graph view",
                "Visually explore bidirectional links and connections across your notes.",
                &mut config.core_plugins.graph_view,
            );
            plugin_row(
                ui,
                "Canvas",
                "Infinite visual whiteboard to arrange notes, cards, and diagrams.",
                &mut config.core_plugins.canvas,
            );
            plugin_row(
                ui,
                "Daily notes",
                "Open today's journal note with date formatting and custom template.",
                &mut config.core_plugins.daily_notes,
            );
            plugin_row(
                ui,
                "Templates",
                "Insert pre-defined Markdown templates and reusable snippets into notes.",
                &mut config.core_plugins.templates,
            );
            plugin_row(
                ui,
                "Note outline",
                "Display an interactive table of contents for headings in the active note.",
                &mut config.core_plugins.outline,
            );
            plugin_row(
                ui,
                "Backlinks",
                "Show which notes link to the active document with context excerpts.",
                &mut config.core_plugins.backlinks,
            );
            plugin_row(
                ui,
                "Word count",
                "Display real-time word and character statistics in the status bar.",
                &mut config.core_plugins.word_count,
            );
        });

    if plugins_changed {
        config.save();
    }
}

fn render_hotkeys_tab(ui: &mut egui::Ui, filter: &mut String) {
    ui.label(
        RichText::new("Keyboard Shortcuts")
            .strong()
            .size(16.0)
            .color(Theme::TEXT_PRIMARY),
    );
    ui.add_space(4.0);
    ui.label(
        RichText::new(
            "Keyboard shortcuts for workspace navigation, editing, formatting, and commands.",
        )
        .size(11.5)
        .color(Theme::TEXT_MUTED),
    );
    ui.add_space(8.0);

    ui.add(
        TextEdit::singleline(filter)
            .hint_text("Filter shortcuts…")
            .desired_width(ui.available_width() - 8.0),
    );
    ui.add_space(8.0);
    ui.separator();
    ui.add_space(4.0);

    let needle = filter.trim().to_lowercase();
    let hotkeys: [(&str, &str, &str); 20] = [
        (
            "Quick Switcher",
            "Search and open notes in vault",
            "Ctrl + O",
        ),
        (
            "Command Palette",
            "Open palette with all workspace actions",
            "Ctrl + P",
        ),
        (
            "New Note",
            "Create a new untitled markdown document",
            "Ctrl + N",
        ),
        (
            "New Folder",
            "Create a new subdirectory folder in vault",
            "Ctrl + Shift + N",
        ),
        (
            "Save",
            "Save changes to active note or canvas document",
            "Ctrl + S",
        ),
        (
            "Find in Note",
            "Open in-note search and jump across matches",
            "Ctrl + F",
        ),
        (
            "Vault Search",
            "Global full-text search across all notes",
            "Ctrl + Shift + F",
        ),
        (
            "Toggle View",
            "Cycle between Editing, Split, and Reading view",
            "Ctrl + E",
        ),
        ("Close Tab", "Close current note or canvas tab", "Ctrl + W"),
        (
            "Next Tab",
            "Switch to the next tab on the right",
            "Ctrl + Tab",
        ),
        (
            "Previous Tab",
            "Switch to the previous tab on the left",
            "Ctrl + Shift + Tab",
        ),
        ("Bold", "Wrap selected text in bold **syntax**", "Ctrl + B"),
        (
            "Italic",
            "Wrap selected text in italic *syntax*",
            "Ctrl + I",
        ),
        (
            "Link",
            "Wrap selection in [[wikilink]] brackets",
            "Ctrl + K",
        ),
        (
            "Daily Note",
            "Open or create today's daily journal note",
            "Ctrl + D",
        ),
        (
            "Graph View",
            "Open interactive node network graph",
            "Ctrl + G",
        ),
        (
            "Insert Template",
            "Open template picker to insert template snippet",
            "Ctrl + T",
        ),
        ("Bookmark", "Toggle bookmark for current note", "Ctrl + B"),
        (
            "Settings",
            "Open configuration and preferences dialog",
            "Ctrl + ,",
        ),
        (
            "Dismiss",
            "Close open dialogs, palettes, and popups",
            "Escape",
        ),
    ];

    ScrollArea::vertical()
        .id_salt("hotkeys_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            for (name, desc, keys) in hotkeys {
                if !needle.is_empty()
                    && !name.to_lowercase().contains(&needle)
                    && !desc.to_lowercase().contains(&needle)
                    && !keys.to_lowercase().contains(&needle)
                {
                    continue;
                }

                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            RichText::new(name)
                                .strong()
                                .size(12.5)
                                .color(Theme::TEXT_PRIMARY),
                        );
                        ui.label(RichText::new(desc).size(11.0).color(Theme::TEXT_MUTED));
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        render_hotkey_pill(ui, keys);
                    });
                });
                ui.add_space(4.0);
                ui.separator();
                ui.add_space(4.0);
            }
        });
}

fn render_about_tab(ui: &mut egui::Ui) {
    ui.label(
        RichText::new("About Better Obsidian")
            .strong()
            .size(16.0)
            .color(Theme::TEXT_PRIMARY),
    );
    ui.add_space(4.0);
    ui.label(
        RichText::new("A 1:1 lightweight native desktop clone of Obsidian for low-end PCs.")
            .size(11.5)
            .color(Theme::TEXT_MUTED),
    );
    ui.add_space(8.0);
    ui.separator();
    ui.add_space(8.0);

    ScrollArea::vertical()
        .id_salt("about_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            egui::Frame::none()
                .fill(Theme::BG_CARD)
                .stroke(Stroke::new(1.0_f32, Theme::BORDER))
                .rounding(Rounding::same(6.0))
                .inner_margin(Margin::same(12.0))
                .show(ui, |ui| {
                    ui.label(
                        RichText::new("Obsidian Architecture Clone")
                            .strong()
                            .size(13.0)
                            .color(Theme::TEXT_PRIMARY),
                    );
                    ui.add_space(4.0);
                    ui.label(
                        RichText::new(
                            "Built in 100% pure native Rust with eframe & egui 0.29 on the Glow hardware renderer.\nZero Electron runtime, zero Chromium webview, instant cold startup, and ~6 MB executable.",
                        )
                        .size(11.5)
                        .color(Theme::TEXT_MUTED),
                    );
                });

            ui.add_space(14.0);
            ui.separator();
            ui.add_space(10.0);

            ui.label(
                RichText::new("RUNTIME & COMPILATION SPECS")
                    .strong()
                    .size(10.5)
                    .color(Theme::TEXT_DIMMED),
            );
            ui.add_space(6.0);

            for (spec, val) in [
                ("Version", "0.1.0"),
                ("Renderer", "Hardware accelerated OpenGL (Glow)"),
                ("Binary footprint", "6.6 MB standalone Windows PE executable"),
                (
                    "Storage",
                    "Local plain Markdown (.md) & JSON Canvas (.canvas)",
                ),
                ("Licensing", "MIT / Open clone"),
            ] {
                ui.horizontal(|ui| {
                    ui.allocate_ui(egui::vec2(160.0, 20.0), |ui| {
                        ui.label(RichText::new(spec).size(11.5).color(Theme::TEXT_MUTED));
                    });
                    ui.label(
                        RichText::new(val)
                            .strong()
                            .size(11.5)
                            .color(Theme::TEXT_PRIMARY),
                    );
                });
                ui.add_space(4.0);
            }
        });
}
