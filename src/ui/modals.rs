use super::theme::Theme;
use crate::vault::{NoteItem, Vault};
use egui::{Align2, Id, Key, RichText, TextEdit, Window};
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub enum PendingAction {
    OpenNote(PathBuf),
    PickVault,
}

#[derive(Debug, Clone)]
pub enum UnsavedChoice {
    SaveAndProceed(PendingAction),
    DiscardAndProceed(PendingAction),
    Cancel,
}

#[derive(Default)]
pub struct NewNoteDialog {
    pub is_open: bool,
    pub input_name: String,
    pub error_message: Option<String>,
}

impl NewNoteDialog {
    pub fn open(&mut self, default_name: String) {
        self.is_open = true;
        self.input_name = default_name;
        self.error_message = None;
    }

    pub fn render(&mut self, ctx: &egui::Context, vault: &mut Option<Vault>) -> Option<NoteItem> {
        if !self.is_open {
            return None;
        }

        let mut created_note = None;
        let mut close_dialog = false;

        Window::new("➕ Create New Note")
            .id(Id::new("modal_new_note"))
            .collapsible(false)
            .resizable(false)
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .show(ctx, |ui| {
                ui.add_space(4.0);
                ui.label(
                    RichText::new("Enter note name (e.g. My Note or Folder/My Note):")
                        .color(Theme::TEXT_PRIMARY),
                );
                ui.add_space(4.0);

                let edit_resp = ui.add(
                    TextEdit::singleline(&mut self.input_name)
                        .desired_width(320.0)
                        .hint_text("Note Title"),
                );

                if edit_resp.lost_focus() && ctx.input(|i| i.key_pressed(Key::Enter)) {
                    if let Some(v) = vault {
                        match v.create_note(&self.input_name, None) {
                            Ok(note) => {
                                created_note = Some(note);
                                close_dialog = true;
                            }
                            Err(e) => {
                                self.error_message = Some(e.to_string());
                            }
                        }
                    }
                }

                if let Some(err) = &self.error_message {
                    ui.add_space(4.0);
                    ui.label(RichText::new(err).color(Theme::ACCENT_RED).size(12.0));
                }

                ui.add_space(6.0);
                ui.label(
                    RichText::new(
                        "Notes are saved as ordinary .md files without overwriting existing files.",
                    )
                    .color(Theme::TEXT_DIMMED)
                    .size(11.0),
                );
                ui.add_space(8.0);

                ui.horizontal(|ui| {
                    if ui.button(RichText::new("Create Note").strong()).clicked() {
                        if let Some(v) = vault {
                            match v.create_note(&self.input_name, None) {
                                Ok(note) => {
                                    created_note = Some(note);
                                    close_dialog = true;
                                }
                                Err(e) => {
                                    self.error_message = Some(e.to_string());
                                }
                            }
                        }
                    }

                    if ui.button("Cancel").clicked() || ctx.input(|i| i.key_pressed(Key::Escape)) {
                        close_dialog = true;
                    }
                });
            });

        if close_dialog {
            self.is_open = false;
            self.error_message = None;
        }

        created_note
    }
}

#[derive(Default)]
pub struct UnsavedDialog {
    pub is_open: bool,
    pub note_name: String,
    pub pending_action: Option<PendingAction>,
}

impl UnsavedDialog {
    pub fn open(&mut self, note_name: String, action: PendingAction) {
        self.is_open = true;
        self.note_name = note_name;
        self.pending_action = Some(action);
    }

    pub fn render(&mut self, ctx: &egui::Context) -> Option<UnsavedChoice> {
        if !self.is_open {
            return None;
        }

        let mut choice = None;

        Window::new("⚠️ Unsaved Changes")
            .id(Id::new("modal_unsaved_changes"))
            .collapsible(false)
            .resizable(false)
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .show(ctx, |ui| {
                ui.add_space(4.0);
                ui.label(
                    RichText::new(format!("You have unsaved changes in '{}'.", self.note_name))
                        .color(Theme::TEXT_PRIMARY)
                        .strong(),
                );
                ui.add_space(4.0);
                ui.label(
                    RichText::new("Do you want to save your changes before proceeding?")
                        .color(Theme::TEXT_MUTED),
                );
                ui.add_space(10.0);

                ui.horizontal(|ui| {
                    if ui
                        .button(RichText::new("💾 Save & Continue").color(Theme::ACCENT_GREEN))
                        .clicked()
                    {
                        if let Some(action) = self.pending_action.take() {
                            choice = Some(UnsavedChoice::SaveAndProceed(action));
                        }
                        self.is_open = false;
                    }

                    if ui
                        .button(RichText::new("Discard Changes").color(Theme::ACCENT_RED))
                        .clicked()
                    {
                        if let Some(action) = self.pending_action.take() {
                            choice = Some(UnsavedChoice::DiscardAndProceed(action));
                        }
                        self.is_open = false;
                    }

                    if ui.button("Cancel").clicked() || ctx.input(|i| i.key_pressed(Key::Escape)) {
                        choice = Some(UnsavedChoice::Cancel);
                        self.is_open = false;
                    }
                });
            });

        choice
    }
}

#[derive(Default)]
pub struct MissingWikilinkDialog {
    pub is_open: bool,
    pub target_name: String,
    pub error_message: Option<String>,
}

impl MissingWikilinkDialog {
    pub fn open(&mut self, target: String) {
        self.is_open = true;
        self.target_name = target;
        self.error_message = None;
    }

    pub fn render(&mut self, ctx: &egui::Context, vault: &mut Option<Vault>) -> Option<NoteItem> {
        if !self.is_open {
            return None;
        }

        let mut created_note = None;
        let mut close_dialog = false;

        Window::new("🔗 Note Does Not Exist")
            .id(Id::new("modal_missing_wikilink"))
            .collapsible(false)
            .resizable(false)
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .show(ctx, |ui| {
                ui.add_space(4.0);
                ui.label(
                    RichText::new(format!(
                        "The note '[[{}]]' does not exist in this vault.",
                        self.target_name
                    ))
                    .color(Theme::TEXT_PRIMARY),
                );
                ui.add_space(4.0);
                ui.label(
                    RichText::new("Would you like to create it now?").color(Theme::TEXT_MUTED),
                );

                if let Some(err) = &self.error_message {
                    ui.add_space(4.0);
                    ui.label(RichText::new(err).color(Theme::ACCENT_RED).size(12.0));
                }

                ui.add_space(8.0);
                ui.horizontal(|ui| {
                    if ui
                        .button(
                            RichText::new(format!("➕ Create '{}.md'", self.target_name)).strong(),
                        )
                        .clicked()
                    {
                        if let Some(v) = vault {
                            let initial = format!("# {}\n\n", self.target_name);
                            match v.create_note(&self.target_name, Some(&initial)) {
                                Ok(note) => {
                                    created_note = Some(note);
                                    close_dialog = true;
                                }
                                Err(e) => {
                                    self.error_message = Some(e.to_string());
                                }
                            }
                        }
                    }

                    if ui.button("Cancel").clicked() || ctx.input(|i| i.key_pressed(Key::Escape)) {
                        close_dialog = true;
                    }
                });
            });

        if close_dialog {
            self.is_open = false;
            self.error_message = None;
        }

        created_note
    }
}
