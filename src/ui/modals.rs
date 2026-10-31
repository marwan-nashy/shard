use super::theme::Theme;
use crate::vault::{NoteItem, TemplateItem, Vault};
use egui::{Align2, Color32, Id, Key, RichText, TextEdit, Window};
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub enum PendingAction {
    OpenNote(PathBuf),
    OpenNoteAtHeading(PathBuf, String),
    OpenDailyNote(String),
    PickVault,
    PickVaultWithDirtyTab(PathBuf),
    CloseTab(PathBuf),
    RenameNote(PathBuf, String),
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

        Window::new("Create New Note")
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
pub struct NewFolderDialog {
    pub is_open: bool,
    pub input_name: String,
    pub error_message: Option<String>,
}

impl NewFolderDialog {
    pub fn open(&mut self) {
        self.is_open = true;
        self.input_name = "New folder".to_string();
        self.error_message = None;
    }

    pub fn render(&mut self, ctx: &egui::Context, vault: &mut Option<Vault>) -> Option<PathBuf> {
        if !self.is_open {
            return None;
        }

        let mut created_folder = None;
        let mut close_dialog = false;

        Window::new("Create New Folder")
            .id(Id::new("modal_new_folder"))
            .collapsible(false)
            .resizable(false)
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .open(&mut self.is_open)
            .show(ctx, |ui| {
                ui.set_min_width(320.0);
                ui.label(
                    RichText::new("Folder Name")
                        .size(12.0)
                        .color(Theme::TEXT_MUTED),
                );
                ui.add_space(4.0);

                let enter_pressed = ui
                    .add(
                        TextEdit::singleline(&mut self.input_name)
                            .desired_width(f32::INFINITY)
                            .hint_text("e.g. Work or Projects/Design"),
                    )
                    .lost_focus()
                    && ui.input(|i| i.key_pressed(Key::Enter));

                if let Some(err) = &self.error_message {
                    ui.add_space(4.0);
                    ui.label(RichText::new(err).color(Theme::ACCENT_RED).size(11.0));
                }

                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    if ui.button("Cancel").clicked() {
                        close_dialog = true;
                    }

                    let can_create = !self.input_name.trim().is_empty();
                    let should_create = ui
                        .add_enabled(can_create, egui::Button::new("Create Folder"))
                        .clicked()
                        || (can_create && enter_pressed);

                    if should_create {
                        if let Some(vault) = vault {
                            match vault.create_folder(&self.input_name) {
                                Ok(path) => {
                                    created_folder = Some(path);
                                    close_dialog = true;
                                }
                                Err(e) => {
                                    self.error_message = Some(e.to_string());
                                }
                            }
                        } else {
                            self.error_message = Some("No open vault.".to_string());
                        }
                    }
                });
            });

        if close_dialog {
            self.is_open = false;
            self.error_message = None;
        }

        created_folder
    }
}

#[derive(Default)]
pub struct RenameNoteDialog {
    pub is_open: bool,
    pub source: Option<PathBuf>,
    pub input_name: String,
    pub error_message: Option<String>,
}

impl RenameNoteDialog {
    pub fn open(&mut self, source: PathBuf, relative_path: String) {
        self.is_open = true;
        self.source = Some(source);
        self.input_name = relative_path;
        self.error_message = None;
    }

    pub fn render(&mut self, ctx: &egui::Context) -> Option<(PathBuf, String)> {
        if !self.is_open {
            return None;
        }
        let mut result = None;
        let mut close = false;
        Window::new("Rename note")
            .id(Id::new("modal_rename_note"))
            .collapsible(false)
            .resizable(false)
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .show(ctx, |ui| {
                ui.label(
                    RichText::new("New note path, relative to this vault").color(Theme::TEXT_MUTED),
                );
                let input = ui.add(TextEdit::singleline(&mut self.input_name).desired_width(340.0));
                if input.lost_focus() && ctx.input(|i| i.key_pressed(Key::Enter)) {
                    if let Some(source) = self.source.clone() {
                        result = Some((source, self.input_name.clone()));
                        close = true;
                    }
                }
                if let Some(error) = &self.error_message {
                    ui.label(RichText::new(error).color(Theme::ACCENT_RED).size(11.0));
                }
                ui.horizontal(|ui| {
                    if ui.button("Rename").clicked() {
                        if let Some(source) = self.source.clone() {
                            result = Some((source, self.input_name.clone()));
                            close = true;
                        }
                    }
                    if ui.button("Cancel").clicked() || ctx.input(|i| i.key_pressed(Key::Escape)) {
                        close = true;
                    }
                });
            });
        if close {
            self.is_open = false;
            self.source = None;
            self.error_message = None;
        }
        result
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

        Window::new("Unsaved Changes")
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
                        .button(RichText::new("Save & Continue").color(Theme::ACCENT_GREEN))
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

        Window::new("Note Does Not Exist")
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
                        .button(RichText::new(format!("Create '{}.md'", self.target_name)).strong())
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

#[derive(Default)]
pub struct TemplatePickerDialog {
    pub is_open: bool,
    pub query: String,
    pub selected: usize,
    pub focus_query: bool,
    pub templates: Vec<TemplateItem>,
}

impl TemplatePickerDialog {
    pub fn open(&mut self, templates: Vec<TemplateItem>) {
        self.is_open = true;
        self.query.clear();
        self.selected = 0;
        self.focus_query = true;
        self.templates = templates;
    }

    pub fn render(&mut self, ctx: &egui::Context, has_active_note: bool) -> Option<TemplateItem> {
        if !self.is_open {
            return None;
        }

        let mut chosen = None;
        let mut close = false;
        let mut is_open = self.is_open;

        Window::new("Insert Template")
            .id(Id::new("modal_insert_template"))
            .collapsible(false)
            .resizable(false)
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, -40.0))
            .open(&mut is_open)
            .show(ctx, |ui| {
                ui.set_min_width(380.0);
                ui.set_max_width(480.0);

                if !has_active_note {
                    ui.add_space(4.0);
                    ui.label(
                        RichText::new("No active note is open to insert a template into.")
                            .color(Theme::ACCENT_RED)
                            .strong(),
                    );
                    ui.add_space(8.0);
                    if ui.button("Close").clicked() || ctx.input(|i| i.key_pressed(Key::Escape)) {
                        close = true;
                    }
                    return;
                }

                ui.label(
                    RichText::new("Choose a template to insert at cursor:")
                        .color(Theme::TEXT_PRIMARY),
                );
                ui.add_space(6.0);

                let edit_resp = ui.add(
                    TextEdit::singleline(&mut self.query)
                        .hint_text("Filter templates…")
                        .desired_width(f32::INFINITY)
                        .id(Id::new("template_picker_query")),
                );
                if self.focus_query {
                    edit_resp.request_focus();
                    self.focus_query = false;
                }
                if edit_resp.changed() {
                    self.selected = 0;
                }

                let needle = self.query.trim().to_lowercase();
                let filtered: Vec<_> = self
                    .templates
                    .iter()
                    .filter(|item| {
                        needle.is_empty()
                            || item.rel_path.to_lowercase().contains(&needle)
                            || item.name.to_lowercase().contains(&needle)
                    })
                    .cloned()
                    .collect();

                if self.templates.is_empty() {
                    ui.add_space(8.0);
                    ui.label(
                        RichText::new("No templates found in 'Templates' folder.")
                            .color(Theme::TEXT_MUTED),
                    );
                    ui.label(
                        RichText::new(
                            "Add Markdown files under 'Templates/' (including subfolders) to use them here.",
                        )
                        .color(Theme::TEXT_DIMMED)
                        .size(11.0),
                    );
                    ui.add_space(8.0);
                } else if filtered.is_empty() {
                    ui.add_space(8.0);
                    ui.label(RichText::new("No matching templates").color(Theme::TEXT_MUTED));
                    ui.add_space(8.0);
                } else {
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
                        chosen = filtered.get(self.selected).cloned();
                        close = chosen.is_some();
                    }
                    if key_action.3 {
                        close = true;
                    }

                    ui.add_space(6.0);
                    egui::ScrollArea::vertical()
                        .max_height(240.0)
                        .show(ui, |ui| {
                            for (index, item) in filtered.iter().enumerate() {
                                let label_text = item.rel_path.clone();
                                let response =
                                    ui.selectable_label(index == self.selected, label_text);
                                if response.clicked() {
                                    chosen = Some(item.clone());
                                    close = true;
                                }
                                if response.hovered() {
                                    response.on_hover_text(format!("Templates/{}", item.rel_path));
                                }
                            }
                        });
                    ui.add_space(8.0);
                }

                ui.horizontal(|ui| {
                    if !filtered.is_empty() {
                        let can_insert = self.selected < filtered.len();
                        if ui
                            .add_enabled(
                                can_insert,
                                egui::Button::new(RichText::new("Insert").strong()),
                            )
                            .clicked()
                        {
                            chosen = filtered.get(self.selected).cloned();
                            close = chosen.is_some();
                        }
                    }

                    if ui.button("Cancel").clicked() || ctx.input(|i| i.key_pressed(Key::Escape)) {
                        close = true;
                    }
                });
            });

        if close {
            is_open = false;
        }
        self.is_open = is_open;
        chosen
    }
}

#[derive(Debug, Clone)]
pub enum DeleteTarget {
    Note(PathBuf, String),
    Canvas(PathBuf, String),
}

#[allow(dead_code)]
impl DeleteTarget {
    pub fn path(&self) -> &PathBuf {
        match self {
            DeleteTarget::Note(p, _) => p,
            DeleteTarget::Canvas(p, _) => p,
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            DeleteTarget::Note(_, n) => n,
            DeleteTarget::Canvas(_, n) => n,
        }
    }

    pub fn is_canvas(&self) -> bool {
        matches!(self, DeleteTarget::Canvas(_, _))
    }
}

#[derive(Default)]
pub struct DeleteConfirmDialog {
    pub is_open: bool,
    pub target: Option<DeleteTarget>,
}

impl DeleteConfirmDialog {
    pub fn open(&mut self, target: DeleteTarget) {
        self.is_open = true;
        self.target = Some(target);
    }

    pub fn render(&mut self, ctx: &egui::Context) -> Option<DeleteTarget> {
        if !self.is_open {
            return None;
        }

        let Some(target) = &self.target else {
            self.is_open = false;
            return None;
        };

        let mut confirmed = None;
        let mut close = false;

        let screen_rect = ctx.screen_rect();
        egui::Area::new(Id::new("delete_modal_backdrop"))
            .order(egui::Order::Middle)
            .fixed_pos(screen_rect.min)
            .show(ctx, |ui| {
                let (rect, response) =
                    ui.allocate_exact_size(screen_rect.size(), egui::Sense::click());
                ui.painter()
                    .rect_filled(rect, 0.0, Color32::from_black_alpha(120));
                if response.clicked() {
                    close = true;
                }
            });

        let (kind_str, name_str) = match target {
            DeleteTarget::Note(_, name) => ("note", name.as_str()),
            DeleteTarget::Canvas(_, name) => ("canvas", name.as_str()),
        };

        Window::new(format!("Delete {kind_str}"))
            .id(Id::new("modal_delete_confirm"))
            .collapsible(false)
            .resizable(false)
            .anchor(Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
            .show(ctx, |ui| {
                ui.add_space(4.0);
                ui.label(
                    RichText::new(format!("Are you sure you want to delete \"{name_str}\"?"))
                        .color(Theme::TEXT_PRIMARY)
                        .strong(),
                );
                ui.add_space(4.0);
                ui.label(
                    RichText::new("This file will be permanently removed from disk.")
                        .color(Theme::TEXT_MUTED)
                        .size(11.5),
                );
                ui.add_space(10.0);

                ui.horizontal(|ui| {
                    if ui
                        .button(RichText::new("Delete").color(Theme::ACCENT_RED).strong())
                        .clicked()
                    {
                        confirmed = self.target.clone();
                        close = true;
                    }

                    if ui.button("Cancel").clicked() || ctx.input(|i| i.key_pressed(Key::Escape)) {
                        close = true;
                    }
                });
            });

        if close {
            self.is_open = false;
            self.target = None;
        }

        confirmed
    }
}
