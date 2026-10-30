use super::preview::{self, MarkdownAction};
use super::theme::Theme;
use crate::app::BetterObsidianApp;
use egui::{RichText, ScrollArea, TextEdit};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ViewMode {
    Edit,
    Split,
    Preview,
}

pub fn render_editor_area(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    if app.active_note.is_none() {
        render_welcome_screen(ui, app);
        return;
    }

    render_editor_toolbar(ui, app);
    ui.add_space(4.0);
    ui.separator();
    ui.add_space(4.0);

    let mut action = None;
    let view_mode = app.view_mode;

    match view_mode {
        ViewMode::Edit => {
            if let Some(active) = &mut app.active_note {
                ScrollArea::vertical()
                    .id_salt("editor_full_scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        let text_edit = TextEdit::multiline(&mut active.content)
                            .font(egui::TextStyle::Monospace)
                            .desired_width(f32::INFINITY)
                            .lock_focus(true);
                        ui.add_sized(ui.available_size(), text_edit);
                    });
            }
        }
        ViewMode::Preview => {
            if let Some(active) = &app.active_note {
                ScrollArea::vertical()
                    .id_salt("preview_full_scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        preview::render_markdown(ui, &active.content, &mut action);
                    });
            }
        }
        ViewMode::Split => {
            ui.columns(2, |cols| {
                // Left column: Editor
                cols[0].vertical(|ui| {
                    ui.label(RichText::new("Editor").size(11.0).color(Theme::TEXT_MUTED));
                    ui.add_space(2.0);
                    if let Some(active) = &mut app.active_note {
                        ScrollArea::vertical()
                            .id_salt("editor_split_scroll")
                            .auto_shrink([false, false])
                            .show(ui, |ui| {
                                let text_edit = TextEdit::multiline(&mut active.content)
                                    .font(egui::TextStyle::Monospace)
                                    .desired_width(f32::INFINITY)
                                    .lock_focus(true);
                                ui.add_sized(ui.available_size(), text_edit);
                            });
                    }
                });

                // Right column: Preview
                cols[1].vertical(|ui| {
                    ui.label(
                        RichText::new("Rendered Preview")
                            .size(11.0)
                            .color(Theme::TEXT_MUTED),
                    );
                    ui.add_space(2.0);
                    if let Some(active) = &app.active_note {
                        ScrollArea::vertical()
                            .id_salt("preview_split_scroll")
                            .auto_shrink([false, false])
                            .show(ui, |ui| {
                                preview::render_markdown(ui, &active.content, &mut action);
                            });
                    }
                });
            });
        }
    }

    if let Some(act) = action {
        match act {
            MarkdownAction::OpenWikilink(target) => {
                app.handle_wikilink_action(&target);
            }
            MarkdownAction::OpenUrl(url) => {
                app.set_status(format!("Link: {}", url));
            }
        }
    }
}

fn render_editor_toolbar(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let (title, is_dirty, rel_path) = match &app.active_note {
        Some(a) => (a.title.clone(), a.is_dirty(), a.rel_path.clone()),
        None => return,
    };

    ui.horizontal(|ui| {
        ui.label(
            RichText::new(format!("📄 {}", title))
                .strong()
                .color(Theme::TEXT_PRIMARY),
        );

        if is_dirty {
            ui.label(
                RichText::new("● Unsaved")
                    .color(Theme::ACCENT_ORANGE)
                    .size(12.0),
            );
        } else {
            ui.label(
                RichText::new("✓ Saved")
                    .color(Theme::ACCENT_GREEN)
                    .size(12.0),
            );
        }

        ui.label(
            RichText::new(format!("({})", rel_path))
                .color(Theme::TEXT_MUTED)
                .size(11.0),
        );

        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if ui.button(RichText::new("💾 Save").strong()).clicked() {
                app.save_active_note();
            }

            ui.add_space(8.0);

            let preview_btn = ui.selectable_label(app.view_mode == ViewMode::Preview, "👁 Preview");
            if preview_btn.clicked() {
                app.view_mode = ViewMode::Preview;
            }

            let split_btn = ui.selectable_label(app.view_mode == ViewMode::Split, "◫ Split");
            if split_btn.clicked() {
                app.view_mode = ViewMode::Split;
            }

            let edit_btn = ui.selectable_label(app.view_mode == ViewMode::Edit, "✏ Edit");
            if edit_btn.clicked() {
                app.view_mode = ViewMode::Edit;
            }
        });
    });
}

fn render_welcome_screen(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    ui.vertical_centered(|ui| {
        ui.add_space(40.0);
        ui.label(
            RichText::new("Better Obsidian")
                .size(28.0)
                .strong()
                .color(Theme::ACCENT_PURPLE),
        );
        ui.add_space(6.0);
        ui.label(
            RichText::new("A fast, lightweight, native Windows-first Markdown vault app.")
                .color(Theme::TEXT_MUTED)
                .size(14.0),
        );
        ui.add_space(20.0);

        ui.horizontal(|ui| {
            ui.add_space(ui.available_width() / 2.0 - 150.0);
            if ui
                .button(RichText::new("📂 Open Vault Folder").strong())
                .clicked()
            {
                app.pick_and_open_vault();
            }
            if ui
                .button(RichText::new("➕ Create New Note").strong())
                .clicked()
            {
                app.open_new_note_dialog();
            }
        });

        ui.add_space(30.0);
        ui.separator();
        ui.add_space(20.0);

        ui.label(
            RichText::new("Keyboard Shortcuts")
                .strong()
                .color(Theme::TEXT_PRIMARY),
        );
        ui.add_space(8.0);

        let shortcuts = [
            ("Ctrl + S", "Save active note"),
            ("Ctrl + N", "Create new note"),
            ("Ctrl + O", "Open vault folder"),
            ("Ctrl + F", "Focus search tab"),
            ("Ctrl + E", "Toggle Edit / Split / Preview"),
        ];

        for (key, desc) in shortcuts {
            ui.horizontal(|ui| {
                ui.add_space(ui.available_width() / 2.0 - 120.0);
                ui.label(RichText::new(key).monospace().color(Theme::ACCENT_BLUE));
                ui.label(RichText::new(format!(": {}", desc)).color(Theme::TEXT_MUTED));
            });
        }

        if !app.config.recent_vaults.is_empty() {
            ui.add_space(24.0);
            ui.label(
                RichText::new("Recent Vaults")
                    .strong()
                    .color(Theme::TEXT_PRIMARY),
            );
            ui.add_space(6.0);

            let recent = app.config.recent_vaults.clone();
            let mut vault_to_open = None;
            for vault_path in &recent {
                if vault_path.exists() {
                    let display_name = vault_path
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| vault_path.to_string_lossy().to_string());

                    if ui
                        .link(format!(
                            "📁 {} ({})",
                            display_name,
                            vault_path.to_string_lossy()
                        ))
                        .clicked()
                    {
                        vault_to_open = Some(vault_path.clone());
                    }
                }
            }

            if let Some(path) = vault_to_open {
                app.open_vault(path);
            }
        }
    });
}
