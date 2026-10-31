use super::editor::ViewMode;
use super::theme::Theme;
use crate::vault::Vault;
use egui::{Color32, Key, RichText, TextEdit};
use std::path::PathBuf;

#[derive(Clone)]
pub enum PaletteAction {
    CreateNote,
    CreateCanvas,
    OpenDailyNote,
    OpenVault,
    SaveNote,
    SearchNotes,
    ShowGraph,
    ShowOutline,
    ShowBookmarks,
    ToggleBookmark,
    OpenSettings,
    SetViewMode(ViewMode),
    OpenNote(PathBuf),
    InsertTemplate,
    DeleteActiveNote,
    DeleteActiveCanvas,
}

#[derive(Clone)]
struct PaletteEntry {
    title: String,
    detail: String,
    action: PaletteAction,
}

#[derive(Default)]
pub struct CommandPalette {
    pub is_open: bool,
    query: String,
    selected: usize,
    focus_query: bool,
}

impl CommandPalette {
    pub fn toggle_shortcut(&mut self, ctx: &egui::Context) {
        let pressed = ctx.input(|input| input.modifiers.command && input.key_pressed(Key::P));
        if pressed {
            self.is_open = !self.is_open;
            self.query.clear();
            self.selected = 0;
            self.focus_query = self.is_open;
        }
    }

    pub fn render(
        &mut self,
        ctx: &egui::Context,
        vault: Option<&Vault>,
        has_active_note: bool,
        has_active_canvas: bool,
    ) -> Option<PaletteAction> {
        if !self.is_open {
            return None;
        }

        let mut chosen = None;
        let mut close = false;

        // Pressing Escape closes the palette immediately
        if ctx.input(|i| i.key_pressed(Key::Escape)) {
            close = true;
        }

        // Full screen modal backdrop: clicking anywhere outside closes the palette
        let screen_rect = ctx.screen_rect();
        egui::Area::new(egui::Id::new("command_palette_backdrop"))
            .order(egui::Order::Middle)
            .fixed_pos(screen_rect.min)
            .show(ctx, |ui| {
                let (rect, response) =
                    ui.allocate_exact_size(screen_rect.size(), egui::Sense::click());
                ui.painter()
                    .rect_filled(rect, 0.0, Color32::from_black_alpha(110));
                if response.clicked() {
                    close = true;
                }
            });

        let mut entries = vec![
            PaletteEntry {
                title: "Create new note".into(),
                detail: "Ctrl+N".into(),
                action: PaletteAction::CreateNote,
            },
            PaletteEntry {
                title: "Create new canvas".into(),
                detail: "Create an Obsidian-compatible .canvas board".into(),
                action: PaletteAction::CreateCanvas,
            },
            PaletteEntry {
                title: "Open today's daily note".into(),
                detail: "Ctrl+D · create from Templates/Daily.md when available".into(),
                action: PaletteAction::OpenDailyNote,
            },
            PaletteEntry {
                title: "Insert template".into(),
                detail: "Choose a Markdown template and insert at cursor".into(),
                action: PaletteAction::InsertTemplate,
            },
            PaletteEntry {
                title: "Open vault folder".into(),
                detail: "Ctrl+O".into(),
                action: PaletteAction::OpenVault,
            },
            PaletteEntry {
                title: "Search notes".into(),
                detail: "Find by title or content".into(),
                action: PaletteAction::SearchNotes,
            },
            PaletteEntry {
                title: "Show graph view".into(),
                detail: "Explore note connections".into(),
                action: PaletteAction::ShowGraph,
            },
            PaletteEntry {
                title: "Show note outline".into(),
                detail: "Navigate headings in the active note".into(),
                action: PaletteAction::ShowOutline,
            },
            PaletteEntry {
                title: "Switch to Edit view".into(),
                detail: "Markdown source".into(),
                action: PaletteAction::SetViewMode(ViewMode::Edit),
            },
            PaletteEntry {
                title: "Switch to Split view".into(),
                detail: "Editor and preview".into(),
                action: PaletteAction::SetViewMode(ViewMode::Split),
            },
            PaletteEntry {
                title: "Switch to Preview view".into(),
                detail: "Rendered Markdown".into(),
                action: PaletteAction::SetViewMode(ViewMode::Preview),
            },
            PaletteEntry {
                title: "Save active note".into(),
                detail: "Ctrl+S".into(),
                action: PaletteAction::SaveNote,
            },
            PaletteEntry {
                title: "Bookmarks: Show bookmarked notes".into(),
                detail: "Open bookmarks in the sidebar".into(),
                action: PaletteAction::ShowBookmarks,
            },
            PaletteEntry {
                title: "Bookmarks: Bookmark / unbookmark active note".into(),
                detail: "Ctrl+B".into(),
                action: PaletteAction::ToggleBookmark,
            },
            PaletteEntry {
                title: "Open settings".into(),
                detail: "Ctrl+, · Themes, hotkeys, appearance".into(),
                action: PaletteAction::OpenSettings,
            },
        ];

        if has_active_note {
            entries.push(PaletteEntry {
                title: "Delete active note…".into(),
                detail: "Permanently delete the current note from disk".into(),
                action: PaletteAction::DeleteActiveNote,
            });
        }
        if has_active_canvas {
            entries.push(PaletteEntry {
                title: "Delete active canvas…".into(),
                detail: "Permanently delete the current canvas from disk".into(),
                action: PaletteAction::DeleteActiveCanvas,
            });
        }

        let mut is_open = self.is_open;
        egui::Window::new("Command palette")
            .id(egui::Id::new("command_palette"))
            .collapsible(false)
            .resizable(false)
            .title_bar(false)
            .anchor(egui::Align2::CENTER_TOP, egui::vec2(0.0, 90.0))
            .open(&mut is_open)
            .show(ctx, |ui| {
                ui.set_min_width(480.0);
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new("COMMAND PALETTE")
                            .strong()
                            .size(10.0)
                            .color(Theme::TEXT_DIMMED),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui
                            .add(
                                egui::Button::new(
                                    RichText::new("×").size(14.0).color(Theme::TEXT_MUTED),
                                )
                                .frame(false),
                            )
                            .on_hover_text("Close (Esc)")
                            .clicked()
                        {
                            close = true;
                        }
                    });
                });
                ui.add_space(6.0);
                let query = ui.add(
                    TextEdit::singleline(&mut self.query)
                        .hint_text("Search commands and notes…")
                        .desired_width(f32::INFINITY)
                        .id(egui::Id::new("command_palette_query")),
                );
                if self.focus_query {
                    query.request_focus();
                    self.focus_query = false;
                }
                if query.changed() {
                    self.selected = 0;
                }

                let needle = self.query.trim().to_lowercase();
                let mut filtered: Vec<_> = entries
                    .iter()
                    .filter(|entry| {
                        needle.is_empty()
                            || entry.title.to_lowercase().contains(&needle)
                            || entry.detail.to_lowercase().contains(&needle)
                    })
                    .cloned()
                    .collect();
                let mut more_notes = false;
                if !needle.is_empty() {
                    if let Some(vault) = vault {
                        let mut matching = vault.notes.iter().filter(|note| {
                            note.title.to_lowercase().contains(&needle)
                                || note.rel_path.to_lowercase().contains(&needle)
                        });
                        filtered.extend(matching.by_ref().take(100).map(|note| PaletteEntry {
                            title: note.title.clone(),
                            detail: note.rel_path.clone(),
                            action: PaletteAction::OpenNote(note.abs_path.clone()),
                        }));
                        more_notes = matching.next().is_some();
                    }
                }
                if filtered.is_empty() {
                    ui.add_space(14.0);
                    ui.label(
                        RichText::new("No matching commands or notes").color(Theme::TEXT_MUTED),
                    );
                }

                let key_action = ctx.input(|input| {
                    (
                        input.key_pressed(Key::ArrowDown),
                        input.key_pressed(Key::ArrowUp),
                        input.key_pressed(Key::Enter),
                        input.key_pressed(Key::Escape),
                    )
                });
                if key_action.0 && !filtered.is_empty() {
                    self.selected = (self.selected + 1).min(filtered.len() - 1);
                }
                if key_action.1 && !filtered.is_empty() {
                    self.selected = self.selected.saturating_sub(1);
                }
                if key_action.2 {
                    chosen = filtered
                        .get(self.selected)
                        .map(|entry| entry.action.clone());
                    close = chosen.is_some();
                }
                if key_action.3 {
                    close = true;
                }

                ui.add_space(6.0);
                if more_notes {
                    ui.label(
                        RichText::new(
                            "More matches exist; type a longer query to narrow the list.",
                        )
                        .size(10.0)
                        .color(Theme::TEXT_DIMMED),
                    );
                }
                egui::ScrollArea::vertical()
                    .max_height(340.0)
                    .show(ui, |ui| {
                        for (index, entry) in filtered.iter().enumerate() {
                            let response = ui.selectable_label(
                                index == self.selected,
                                format!("{}     {}", entry.title, entry.detail),
                            );
                            if response.clicked() {
                                chosen = Some(entry.action.clone());
                                close = true;
                            }
                        }
                    });

                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new("Esc to close  ·  ↑↓ to navigate  ·  Enter to select")
                            .size(10.0)
                            .color(Theme::TEXT_DIMMED),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.small_button("Cancel").clicked() {
                            close = true;
                        }
                    });
                });
            });
        if close {
            is_open = false;
            self.query.clear();
            self.selected = 0;
        }
        self.is_open = is_open;
        if !self.is_open {
            return None;
        }
        chosen
    }
}
