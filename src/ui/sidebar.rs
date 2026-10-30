use super::theme::Theme;
use crate::app::BetterObsidianApp;
use egui::{Color32, RichText, ScrollArea, Stroke, TextEdit};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SidebarTab {
    Notes,
    Search,
    Backlinks,
}

pub fn render_sidebar(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    ui.add_space(4.0);

    // Vault Info & Action Header
    ui.horizontal(|ui| {
        let vault_name = if let Some(v) = &app.vault {
            v.root_path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "Vault".to_string())
        } else {
            "No Vault".to_string()
        };

        ui.label(
            RichText::new(format!("📁 {}", vault_name))
                .strong()
                .color(Theme::TEXT_PRIMARY),
        );

        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if ui.small_button("📂 Open").clicked() {
                app.pick_and_open_vault();
            }
            if ui.small_button("➕ New").clicked() {
                app.open_new_note_dialog();
            }
        });
    });

    ui.add_space(6.0);
    ui.separator();
    ui.add_space(4.0);

    // Tab Bar (Notes | Search | Backlinks)
    ui.horizontal(|ui| {
        let notes_count = app.vault.as_ref().map(|v| v.notes.len()).unwrap_or(0);
        let notes_btn = ui.selectable_label(
            app.sidebar_tab == SidebarTab::Notes,
            format!("📄 Notes ({})", notes_count),
        );
        if notes_btn.clicked() {
            app.sidebar_tab = SidebarTab::Notes;
        }

        let search_label = if app.search_engine.is_searching {
            "🔍 Search...".to_string()
        } else if !app.search_engine.results.is_empty() {
            format!("🔍 Search ({})", app.search_engine.results.len())
        } else {
            "🔍 Search".to_string()
        };
        let search_btn = ui.selectable_label(app.sidebar_tab == SidebarTab::Search, search_label);
        if search_btn.clicked() {
            app.sidebar_tab = SidebarTab::Search;
        }

        let backlinks_count = app.backlinks.len();
        let backlinks_btn = ui.selectable_label(
            app.sidebar_tab == SidebarTab::Backlinks,
            format!("🔗 Links ({})", backlinks_count),
        );
        if backlinks_btn.clicked() {
            app.sidebar_tab = SidebarTab::Backlinks;
            app.refresh_backlinks();
        }
    });

    ui.add_space(6.0);

    match app.sidebar_tab {
        SidebarTab::Notes => render_notes_tab(ui, app),
        SidebarTab::Search => render_search_tab(ui, app),
        SidebarTab::Backlinks => render_backlinks_tab(ui, app),
    }
}

fn render_notes_tab(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    ui.horizontal(|ui| {
        ui.add(
            TextEdit::singleline(&mut app.notes_filter)
                .hint_text("Filter notes...")
                .desired_width(ui.available_width() - 25.0),
        );
        if !app.notes_filter.is_empty() {
            if ui.small_button("✖").clicked() {
                app.notes_filter.clear();
            }
        }
    });

    ui.add_space(6.0);

    if app.vault.is_none() {
        ui.vertical_centered(|ui| {
            ui.add_space(20.0);
            ui.label(RichText::new("No vault folder open").color(Theme::TEXT_MUTED));
            ui.add_space(8.0);
            if ui.button("Open Vault Folder").clicked() {
                app.pick_and_open_vault();
            }
        });
        return;
    }

    let is_empty = app
        .vault
        .as_ref()
        .map(|v| v.notes.is_empty())
        .unwrap_or(true);
    if is_empty {
        ui.vertical_centered(|ui| {
            ui.add_space(20.0);
            ui.label(RichText::new("No markdown notes in vault").color(Theme::TEXT_MUTED));
            ui.add_space(8.0);
            if ui.button("➕ Create First Note").clicked() {
                app.open_new_note_dialog();
            }
        });
        return;
    }

    let filter_lower = app.notes_filter.to_lowercase();
    let active_path = app.active_note.as_ref().map(|a| a.abs_path.clone());

    let notes: Vec<(PathBuf, String, String)> = if let Some(v) = &app.vault {
        v.notes
            .iter()
            .filter(|n| {
                filter_lower.is_empty()
                    || n.title.to_lowercase().contains(&filter_lower)
                    || n.rel_path.to_lowercase().contains(&filter_lower)
            })
            .map(|n| (n.abs_path.clone(), n.title.clone(), n.rel_path.clone()))
            .collect()
    } else {
        Vec::new()
    };

    let mut note_to_open = None;

    ScrollArea::vertical()
        .id_salt("sidebar_notes_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 2.0;

            for (abs_path, _title, rel_path) in notes {
                let is_active = active_path
                    .as_ref()
                    .map(|p| p == &abs_path)
                    .unwrap_or(false);

                let label_text = format!("📄 {}", rel_path);
                let resp = ui.selectable_label(is_active, label_text);
                let resp = resp.on_hover_text(&rel_path);

                if resp.clicked() {
                    note_to_open = Some(abs_path);
                }
            }
        });

    if let Some(path) = note_to_open {
        app.request_open_note(path);
    }
}

fn render_search_tab(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let mut current_query = app.search_engine.query.clone();

    ui.horizontal(|ui| {
        let edit_resp = ui.add(
            TextEdit::singleline(&mut current_query)
                .hint_text("Search notes or content...")
                .desired_width(ui.available_width() - 25.0),
        );
        if edit_resp.changed() {
            app.search_engine.on_query_changed(current_query);
        }
        if !app.search_engine.query.is_empty() {
            if ui.small_button("✖").clicked() {
                app.search_engine.on_query_changed(String::new());
            }
        }
    });

    ui.add_space(4.0);
    let mut search_content = app.search_engine.search_content;
    if ui
        .checkbox(&mut search_content, "Search file content")
        .changed()
    {
        app.search_engine.search_content = search_content;
        app.search_engine.schedule_current_query();
    }

    ui.add_space(4.0);
    ui.separator();
    ui.add_space(4.0);

    if app.search_engine.query.trim().is_empty() {
        ui.vertical_centered(|ui| {
            ui.add_space(20.0);
            ui.label(
                RichText::new("Type to search note titles and content.").color(Theme::TEXT_MUTED),
            );
            ui.label(
                RichText::new("Search runs on-demand without startup indexing.")
                    .color(Theme::TEXT_DIMMED)
                    .size(11.0),
            );
        });
        return;
    }

    if app.search_engine.is_searching {
        ui.label(RichText::new("Searching...").color(Theme::TEXT_MUTED));
        return;
    }

    if app.search_engine.results.is_empty() {
        ui.label(
            RichText::new(format!(
                "No matches found for '{}'",
                app.search_engine.active_query
            ))
            .color(Theme::TEXT_MUTED),
        );
        return;
    }

    ui.label(
        RichText::new(format!(
            "{} notes matched:",
            app.search_engine.results.len()
        ))
        .color(Theme::TEXT_MUTED)
        .size(12.0),
    );
    ui.add_space(4.0);

    let results = app.search_engine.results.clone();
    let active_path = app.active_note.as_ref().map(|a| a.abs_path.clone());
    let mut note_to_open = None;

    ScrollArea::vertical()
        .id_salt("sidebar_search_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 6.0;

            for res in results {
                let is_active = active_path
                    .as_ref()
                    .map(|p| p == &res.note.abs_path)
                    .unwrap_or(false);

                egui::Frame::none()
                    .fill(if is_active {
                        Color32::from_rgb(45, 40, 60)
                    } else {
                        Theme::BG_CARD
                    })
                    .rounding(egui::Rounding::same(4.0))
                    .inner_margin(egui::Margin::same(6.0))
                    .stroke(Stroke::new(1.0_f32, Theme::BORDER))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(format!("📄 {}", res.note.title))
                                    .strong()
                                    .color(Theme::TEXT_PRIMARY),
                            );
                            if res.is_title_match {
                                ui.label(
                                    RichText::new("Title")
                                        .size(10.0)
                                        .color(Theme::ACCENT_PURPLE),
                                );
                            }
                        });

                        ui.label(
                            RichText::new(&res.note.rel_path)
                                .size(11.0)
                                .color(Theme::TEXT_MUTED),
                        );

                        for (line_no, snippet) in res.line_matches.iter().take(3) {
                            ui.horizontal(|ui| {
                                ui.label(
                                    RichText::new(format!("L{}:", line_no))
                                        .monospace()
                                        .size(10.0)
                                        .color(Theme::TEXT_DIMMED),
                                );
                                ui.label(
                                    RichText::new(snippet).size(11.0).color(Theme::TEXT_PRIMARY),
                                );
                            });
                        }

                        if ui.button("Open Note").clicked() {
                            note_to_open = Some(res.note.abs_path);
                        }
                    });
            }
        });

    if let Some(path) = note_to_open {
        app.request_open_note(path);
    }
}

fn render_backlinks_tab(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let (active_title, active_path) = match &app.active_note {
        Some(a) => (a.title.clone(), a.abs_path.clone()),
        None => {
            ui.vertical_centered(|ui| {
                ui.add_space(20.0);
                ui.label(RichText::new("No active note selected.").color(Theme::TEXT_MUTED));
                ui.label(
                    RichText::new("Select a note to inspect backlinks.")
                        .color(Theme::TEXT_DIMMED)
                        .size(11.0),
                );
            });
            return;
        }
    };

    if app.backlinks_target_path.as_ref() != Some(&active_path) {
        app.refresh_backlinks();
    }

    ui.horizontal(|ui| {
        ui.label(
            RichText::new(format!("Links to [[{}]]", active_title))
                .strong()
                .color(Theme::TEXT_PRIMARY),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if ui.small_button("🔄 Refresh").clicked() {
                app.refresh_backlinks();
            }
        });
    });

    ui.add_space(4.0);
    ui.separator();
    ui.add_space(4.0);

    if app.backlinks.is_empty() {
        ui.vertical_centered(|ui| {
            ui.add_space(16.0);
            ui.label(RichText::new("No backlinks found.").color(Theme::TEXT_MUTED));
            ui.add_space(4.0);
            ui.label(
                RichText::new(format!(
                    "Use [[{}]] in other notes to link here.",
                    active_title
                ))
                .color(Theme::TEXT_DIMMED)
                .size(11.0),
            );
        });
        return;
    }

    ui.label(
        RichText::new(format!("{} referencing notes found:", app.backlinks.len()))
            .color(Theme::TEXT_MUTED)
            .size(12.0),
    );
    ui.add_space(4.0);

    let backlinks = app.backlinks.clone();
    let mut note_to_open = None;

    ScrollArea::vertical()
        .id_salt("sidebar_backlinks_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 6.0;

            for link in backlinks {
                egui::Frame::none()
                    .fill(Theme::BG_CARD)
                    .rounding(egui::Rounding::same(4.0))
                    .inner_margin(egui::Margin::same(6.0))
                    .stroke(Stroke::new(1.0_f32, Theme::BORDER))
                    .show(ui, |ui| {
                        ui.label(
                            RichText::new(format!("📄 {}", link.source_note.title))
                                .strong()
                                .color(Theme::TEXT_PRIMARY),
                        );
                        ui.label(
                            RichText::new(&link.source_note.rel_path)
                                .size(11.0)
                                .color(Theme::TEXT_MUTED),
                        );

                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(format!("L{}:", link.line_number))
                                    .monospace()
                                    .size(10.0)
                                    .color(Theme::TEXT_DIMMED),
                            );
                            ui.label(
                                RichText::new(&link.snippet)
                                    .size(11.0)
                                    .color(Theme::TEXT_PRIMARY),
                            );
                        });

                        if ui.button("Navigate to Note").clicked() {
                            note_to_open = Some(link.source_note.abs_path);
                        }
                    });
            }
        });

    if let Some(path) = note_to_open {
        app.request_open_note(path);
    }
}
