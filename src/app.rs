use crate::canvas::CanvasWorkspace;
use crate::config::AppConfig;
use crate::search::SearchEngine;
use crate::ui::attachments::AttachmentCache;
use crate::ui::command_palette::{CommandPalette, PaletteAction};
use crate::ui::editor::{render_editor_area, ViewMode};
use crate::ui::embeds::NoteEmbedCache;
use crate::ui::graph::GraphView;
use crate::ui::modals::{
    DeleteConfirmDialog, DeleteTarget, MissingWikilinkDialog, NewNoteDialog, PendingAction,
    RenameNoteDialog, TemplatePickerDialog, UnsavedChoice, UnsavedDialog,
};
use crate::ui::sidebar::{
    render_activity_ribbon, render_right_sidebar, render_sidebar_pane, RightSidebarTab, SidebarTab,
};
use crate::ui::theme::Theme;
use crate::vault::{ActiveNote, NoteItem, Vault};
use crate::wikilinks::{self, BacklinkMatch};
use egui::{CentralPanel, Key, RichText, SidePanel, TopBottomPanel};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub struct BetterObsidianApp {
    pub config: AppConfig,
    pub vault: Option<Vault>,
    pub active_note: Option<ActiveNote>,
    pub active_canvas: Option<CanvasWorkspace>,
    pub open_tabs: Vec<PathBuf>,
    pub cached_notes: HashMap<PathBuf, ActiveNote>,

    pub view_mode: ViewMode,
    pub sidebar_tab: SidebarTab,
    pub left_sidebar_open: bool,
    pub notes_filter: String,
    pub graph_view: GraphView,
    pub command_palette: CommandPalette,
    pub attachment_cache: AttachmentCache,
    pub note_embed_cache: NoteEmbedCache,
    pub tag_explorer: crate::metadata::TagExplorer,
    pub selected_tag: Option<String>,
    pub properties_editor_open: bool,
    pub property_key_draft: String,
    pub property_value_draft: String,
    #[allow(dead_code)]
    pub collapsed_folders: HashSet<String>,
    pub right_sidebar_open: bool,
    pub right_sidebar_tab: RightSidebarTab,
    pub show_shortcuts: bool,
    pub pending_heading_jump: Option<usize>,
    pub pending_template_insert: Option<String>,
    pub focus_search_next_frame: bool,
    pub focus_editor_next_frame: bool,

    pub search_engine: SearchEngine,

    pub backlinks: Vec<BacklinkMatch>,
    pub backlinks_target_path: Option<PathBuf>,

    pub new_note_dialog: NewNoteDialog,
    pub rename_note_dialog: RenameNoteDialog,
    pub template_picker_dialog: TemplatePickerDialog,
    pub unsaved_dialog: UnsavedDialog,
    pub missing_wikilink_dialog: MissingWikilinkDialog,
    pub delete_confirm_dialog: DeleteConfirmDialog,

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
            active_canvas: None,
            open_tabs: Vec::new(),
            cached_notes: HashMap::new(),
            view_mode: ViewMode::Edit,
            sidebar_tab: SidebarTab::Notes,
            left_sidebar_open: true,
            notes_filter: String::new(),
            graph_view: GraphView::default(),
            command_palette: CommandPalette::default(),
            attachment_cache: AttachmentCache::default(),
            note_embed_cache: NoteEmbedCache::default(),
            tag_explorer: crate::metadata::TagExplorer::default(),
            selected_tag: None,
            properties_editor_open: true,
            property_key_draft: String::new(),
            property_value_draft: String::new(),
            collapsed_folders: HashSet::new(),
            right_sidebar_open: false,
            right_sidebar_tab: RightSidebarTab::Outline,
            show_shortcuts: false,
            pending_heading_jump: None,
            pending_template_insert: None,
            focus_search_next_frame: false,
            focus_editor_next_frame: false,
            search_engine: SearchEngine::default(),
            backlinks: Vec::new(),
            backlinks_target_path: None,
            new_note_dialog: NewNoteDialog::default(),
            rename_note_dialog: RenameNoteDialog::default(),
            template_picker_dialog: TemplatePickerDialog::default(),
            unsaved_dialog: UnsavedDialog::default(),
            missing_wikilink_dialog: MissingWikilinkDialog::default(),
            delete_confirm_dialog: DeleteConfirmDialog::default(),
            status_message: None,
            error_banner: None,
            config,
        };

        if let Some(last_vault) = app.config.last_vault.clone() {
            if last_vault.is_dir() {
                if let Ok(vault) = Vault::open(last_vault.clone()) {
                    let saved_tabs = app.config.open_tabs.clone();
                    let saved_active = app.config.active_tab.clone();
                    let existing_tabs: Vec<_> = saved_tabs
                        .into_iter()
                        .filter(|path| vault.notes.iter().any(|note| note.abs_path == *path))
                        .collect();
                    let first_note = vault.notes.first().map(|note| note.abs_path.clone());
                    app.vault = Some(vault);
                    for path in &existing_tabs {
                        app.do_open_note(path);
                    }
                    if let Some(active) = saved_active.filter(|path| existing_tabs.contains(path)) {
                        app.do_open_note(&active);
                    } else if existing_tabs.is_empty() {
                        if let Some(path) = first_note {
                            app.do_open_note(&path);
                        }
                    }
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
        if self.active_note.is_none() {
            return self.save_active_canvas();
        }
        if let (Some(vault), Some(active_note)) = (&self.vault, &mut self.active_note) {
            match vault.save_note(active_note) {
                Ok(_) => {
                    let note_path = active_note.abs_path.clone();
                    self.set_status("Note saved successfully.");
                    self.graph_view.invalidate();
                    self.note_embed_cache.invalidate(&note_path);
                    self.tag_explorer.invalidate();
                    if self.right_sidebar_open
                        && self.right_sidebar_tab == RightSidebarTab::Backlinks
                    {
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

    pub fn save_active_canvas(&mut self) -> bool {
        let Some(root) = self.vault.as_ref().map(|vault| vault.root_path.clone()) else {
            return false;
        };
        let Some(canvas) = self.active_canvas.as_mut() else {
            return false;
        };
        let title = canvas.title.clone();
        match canvas.save(&root) {
            Ok(()) => {
                self.set_status(format!("Saved {title}.canvas"));
                true
            }
            Err(error) => {
                self.set_error(format!("Could not save canvas: {error}"));
                false
            }
        }
    }

    pub fn create_canvas(&mut self) {
        if self.active_note.as_ref().is_some_and(ActiveNote::is_dirty) && !self.save_active_note() {
            return;
        }
        let Some(vault) = self.vault.as_mut() else {
            self.set_error("Open a vault before creating a canvas.");
            return;
        };
        match vault.create_canvas("Untitled") {
            Ok(item) => match CanvasWorkspace::open(&vault.root_path, &item.abs_path) {
                Ok(canvas) => {
                    self.active_note = None;
                    self.active_canvas = Some(canvas);
                    self.set_status("Canvas created. Changes save in Obsidian Canvas format.");
                }
                Err(error) => self.set_error(format!("Could not open canvas: {error}")),
            },
            Err(error) => self.set_error(format!("Could not create canvas: {error}")),
        }
    }

    pub fn open_canvas(&mut self, path: &Path) {
        if self.active_note.as_ref().is_some_and(ActiveNote::is_dirty) && !self.save_active_note() {
            return;
        }
        let Some(vault) = self.vault.as_ref() else {
            return;
        };
        match CanvasWorkspace::open(&vault.root_path, path) {
            Ok(canvas) => {
                self.active_note = None;
                self.active_canvas = Some(canvas);
            }
            Err(error) => self.set_error(format!("Could not open canvas: {error}")),
        }
    }

    pub fn toggle_task_at_ordinal(&mut self, ordinal: usize) {
        let Some(note) = self.active_note.as_mut() else {
            return;
        };
        let mut fence = None;
        let mut frontmatter = note
            .content
            .lines()
            .next()
            .is_some_and(|line| line.trim_start_matches('\u{feff}').trim() == "---");
        let mut frontmatter_lines = 0;
        let mut task_ordinal = 0;
        let mut replacement = None;
        let mut line_start = 0;
        for line in note.content.split_inclusive('\n') {
            let line_without_newline = line.trim_end_matches(['\r', '\n']);
            let trimmed = line_without_newline.trim_start();
            if frontmatter {
                frontmatter_lines += 1;
                if frontmatter_lines > 1 && (trimmed.trim() == "---" || trimmed.trim() == "...") {
                    frontmatter = false;
                }
                line_start += line.len();
                continue;
            }
            if let Some(delimiter) = fence {
                if trimmed.starts_with(delimiter) {
                    fence = None;
                }
                line_start += line.len();
                continue;
            }
            if trimmed.starts_with("```") {
                fence = Some('`');
                line_start += line.len();
                continue;
            }
            if trimmed.starts_with("~~~") {
                fence = Some('~');
                line_start += line.len();
                continue;
            }
            if trimmed.starts_with('>') {
                line_start += line.len();
                continue;
            }
            let is_task = trimmed.starts_with("- [ ] ")
                || trimmed.starts_with("- [x] ")
                || trimmed.starts_with("- [X] ")
                || trimmed.starts_with("* [ ] ")
                || trimmed.starts_with("* [x] ")
                || trimmed.starts_with("* [X] ");
            if !is_task {
                line_start += line.len();
                continue;
            }
            if task_ordinal == ordinal {
                let leading_bytes = line_without_newline.len() - trimmed.len();
                let byte_offset = line_start + leading_bytes + 3;
                let checked = trimmed.as_bytes()[3] != b' ';
                replacement = Some((byte_offset, if checked { " " } else { "x" }));
                break;
            }
            task_ordinal += 1;
            line_start += line.len();
        }
        if let Some((offset, value)) = replacement {
            note.content.replace_range(offset..offset + 1, value);
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

    pub fn request_delete_note(&mut self, path: PathBuf, display_name: String) {
        self.delete_confirm_dialog
            .open(DeleteTarget::Note(path, display_name));
    }

    pub fn request_delete_canvas(&mut self, path: PathBuf, display_name: String) {
        self.delete_confirm_dialog
            .open(DeleteTarget::Canvas(path, display_name));
    }

    pub fn execute_delete(&mut self, target: DeleteTarget) {
        let (path, display_name, is_canvas) = match target {
            DeleteTarget::Note(p, n) => (p, n, false),
            DeleteTarget::Canvas(p, n) => (p, n, true),
        };

        if !is_canvas {
            self.close_tab(&path);
            if self.active_note.as_ref().is_some_and(|n| n.abs_path == path) {
                self.active_note = None;
            }
            if self.backlinks_target_path.as_ref().is_some_and(|p| p == &path) {
                self.backlinks.clear();
                self.backlinks_target_path = None;
            }
        } else if self.active_canvas.as_ref().is_some_and(|c| c.path == path) {
            self.active_canvas = None;
        }

        let Some(vault) = self.vault.as_mut() else {
            return;
        };

        match vault.delete_file(&path) {
            Ok(()) => {
                let item_type = if is_canvas { "Canvas" } else { "Note" };
                self.set_status(format!("{item_type} '{display_name}' deleted."));
                self.graph_view.invalidate();
                self.tag_explorer.invalidate();
                self.search_engine.update(&self.vault, true);
            }
            Err(e) => {
                self.set_error(format!("Failed to delete: {e}"));
            }
        }
    }

    pub fn open_insert_template_picker(&mut self) {
        let templates = self
            .vault
            .as_ref()
            .map(Vault::list_templates)
            .unwrap_or_default();
        self.template_picker_dialog.open(templates);
    }

    fn insert_template(&mut self, template: crate::vault::TemplateItem) {
        let Some(note_title) = self.active_note.as_ref().map(|note| note.title.clone()) else {
            self.set_error("Open a note before inserting a template.");
            return;
        };
        let Some(vault) = self.vault.as_ref() else {
            self.set_error("Open a vault before inserting a template.");
            return;
        };
        match vault.read_template(&template.abs_path) {
            Ok(text) => {
                self.pending_template_insert =
                    Some(crate::vault::expand_template_variables(&text, &note_title));
                self.sidebar_tab = SidebarTab::Notes;
                if self.view_mode == ViewMode::Preview {
                    self.view_mode = ViewMode::Edit;
                }
                self.set_status(format!("Inserted template {}", template.rel_path));
            }
            Err(error) => self.set_error(format!("Could not read template: {error}")),
        }
    }

    pub fn open_daily_note(&mut self) {
        let date = crate::date::today_local();
        let existing = self.vault.as_ref().and_then(|vault| {
            vault
                .notes
                .iter()
                .find(|note| note.rel_path.eq_ignore_ascii_case(&format!("{date}.md")))
                .map(|note| note.abs_path.clone())
        });
        if let Some(path) = existing {
            self.request_open_note(path);
            return;
        }
        if let Some(active) = &self.active_note {
            if active.is_dirty() {
                self.unsaved_dialog
                    .open(active.rel_path.clone(), PendingAction::OpenDailyNote(date));
                return;
            }
        }
        self.create_daily_note(&date);
    }

    fn create_daily_note(&mut self, date: &str) {
        let Some(vault) = self.vault.as_ref() else {
            self.set_error("Open a vault before creating a daily note.");
            return;
        };
        let template = vault.daily_note_template().map(|template| {
            template
                .replace("{{date}}", date)
                .replace("{{title}}", date)
        });
        let result = self
            .vault
            .as_mut()
            .expect("vault checked above")
            .create_note(&format!("{date}.md"), template.as_deref());
        match result {
            Ok(note) => {
                let path = note.abs_path.clone();
                self.do_open_note(&path);
                self.graph_view.invalidate();
                self.tag_explorer.invalidate();
                self.set_status(format!("Opened daily note for {date}"));
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                if let Some(vault) = self.vault.as_mut() {
                    let _ = vault.refresh_notes();
                }
                if let Some(path) = self.vault.as_ref().and_then(|vault| {
                    vault
                        .notes
                        .iter()
                        .find(|note| note.rel_path.eq_ignore_ascii_case(&format!("{date}.md")))
                        .map(|note| note.abs_path.clone())
                }) {
                    self.request_open_note(path);
                } else {
                    self.set_error(format!("Could not open daily note: {error}"));
                }
            }
            Err(error) => self.set_error(format!("Could not create daily note: {error}")),
        }
    }

    pub fn pick_and_open_vault(&mut self) {
        if let Some(active) = &self.active_note {
            if active.is_dirty() {
                self.unsaved_dialog
                    .open(active.rel_path.clone(), PendingAction::PickVault);
                return;
            }
        }
        if let Some((path, note)) = self.cached_notes.iter().find(|(_, note)| note.is_dirty()) {
            self.unsaved_dialog.open(
                note.rel_path.clone(),
                PendingAction::PickVaultWithDirtyTab(path.clone()),
            );
            return;
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
                let first_note = vault.notes.first().map(|note| note.abs_path.clone());
                self.config.set_last_vault(folder);
                self.vault = Some(vault);
                self.graph_view.invalidate();
                self.active_note = None;
                self.open_tabs.clear();
                self.cached_notes.clear();
                self.config.set_open_tabs(Vec::new(), None);
                self.backlinks.clear();
                self.backlinks_target_path = None;
                if let Some(path) = first_note {
                    self.do_open_note(&path);
                    self.set_status("Vault opened. Ready to write.");
                } else {
                    self.set_status("Vault opened. Create your first note to get started.");
                }
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

    pub fn request_rename_note(&mut self, source: PathBuf, new_name: String) {
        let dirty_note = self
            .active_note
            .as_ref()
            .filter(|note| note.abs_path == source && note.is_dirty())
            .or_else(|| {
                self.cached_notes
                    .get(&source)
                    .filter(|note| note.is_dirty())
            });
        if let Some(note) = dirty_note {
            self.unsaved_dialog.open(
                note.rel_path.clone(),
                PendingAction::RenameNote(source, new_name),
            );
            return;
        }
        let _ = self.perform_rename_note(source, new_name);
    }

    fn perform_rename_note(&mut self, source: PathBuf, new_name: String) -> Option<PathBuf> {
        let Some(old_note) = self
            .vault
            .as_ref()
            .and_then(|vault| vault.notes.iter().find(|note| note.abs_path == source))
            .cloned()
        else {
            self.set_error("That note is no longer in the open vault.");
            return None;
        };

        let mut dirty_paths = self
            .cached_notes
            .iter()
            .filter(|(_, note)| note.is_dirty())
            .map(|(path, _)| path.clone())
            .collect::<std::collections::HashSet<_>>();
        if let Some(note) = self.active_note.as_ref().filter(|note| note.is_dirty()) {
            dirty_paths.insert(note.abs_path.clone());
        }

        let renamed = self
            .vault
            .as_mut()
            .expect("vault checked above")
            .rename_note(&source, &new_name, &dirty_paths);
        let (new_note, _) = match renamed {
            Ok(result) => result,
            Err(error) => {
                self.rename_note_dialog.open(source, new_name);
                self.rename_note_dialog.error_message = Some(error.to_string());
                return None;
            }
        };
        if new_note.abs_path == source {
            self.rename_note_dialog.is_open = false;
            self.set_status("The note already has that name.");
            return Some(source);
        }

        let update_loaded_note = |note: &mut ActiveNote, is_source: bool| {
            let was_dirty = note.is_dirty();
            note.content = wikilinks::rewrite_wikilinks(&note.content, &old_note, &new_note);
            if !was_dirty {
                note.saved_content =
                    wikilinks::rewrite_wikilinks(&note.saved_content, &old_note, &new_note);
            }
            if is_source {
                note.abs_path = new_note.abs_path.clone();
                note.rel_path = new_note.rel_path.clone();
                note.title = new_note.title.clone();
            }
        };

        if let Some(note) = self.active_note.as_mut() {
            update_loaded_note(note, note.abs_path == source);
        }
        for (path, note) in &mut self.cached_notes {
            update_loaded_note(note, *path == source);
        }
        if let Some(mut note) = self.cached_notes.remove(&source) {
            note.abs_path = new_note.abs_path.clone();
            note.rel_path = new_note.rel_path.clone();
            note.title = new_note.title.clone();
            self.cached_notes.insert(new_note.abs_path.clone(), note);
        }
        for path in &mut self.open_tabs {
            if *path == source {
                *path = new_note.abs_path.clone();
            }
        }
        if self
            .active_note
            .as_ref()
            .is_some_and(|note| note.abs_path == new_note.abs_path)
            && !self.open_tabs.contains(&new_note.abs_path)
        {
            self.open_tabs.push(new_note.abs_path.clone());
        }
        self.rename_note_dialog.is_open = false;
        self.persist_tabs();
        self.graph_view.invalidate();
        self.tag_explorer.invalidate();
        self.note_embed_cache.invalidate(&source);
        self.note_embed_cache.invalidate(&new_note.abs_path);
        self.refresh_backlinks();
        self.set_status(format!(
            "Renamed {} to {}",
            old_note.rel_path, new_note.rel_path
        ));
        Some(new_note.abs_path)
    }

    fn do_open_note(&mut self, target_path: &Path) {
        if self
            .active_note
            .as_ref()
            .is_some_and(|active| active.abs_path == target_path)
        {
            return;
        }
        let cached = self.cached_notes.remove(target_path);
        let loaded = cached.map(Ok).unwrap_or_else(|| {
            self.vault
                .as_ref()
                .ok_or_else(|| std::io::Error::other("No vault is open"))
                .and_then(|vault| vault.load_note(target_path))
        });

        match loaded {
            Ok(note) => {
                if let Some(active) = self.active_note.take() {
                    self.cached_notes.insert(active.abs_path.clone(), active);
                }
                if !self.open_tabs.contains(&note.abs_path) {
                    self.open_tabs.push(note.abs_path.clone());
                }
                self.active_note = Some(note);
                self.active_canvas = None;
                self.focus_editor_next_frame = true;
                self.persist_tabs();
                self.backlinks.clear();
                self.backlinks_target_path = None;
                if self.right_sidebar_open && self.right_sidebar_tab == RightSidebarTab::Backlinks {
                    self.refresh_backlinks();
                }
            }
            Err(e) => self.set_error(format!("Failed to open note: {}", e)),
        }
    }

    fn open_note_at_heading(&mut self, path: &Path, heading: &str) {
        self.do_open_note(path);
        let offset = self
            .active_note
            .as_ref()
            .filter(|note| note.abs_path == path)
            .and_then(|note| {
                crate::metadata::extract_headings(&note.content)
                    .into_iter()
                    .find(|(_, title, _)| title.eq_ignore_ascii_case(heading.trim()))
                    .map(|(_, _, offset)| offset)
            });
        if let Some(offset) = offset {
            self.pending_heading_jump = Some(offset);
            if self.view_mode == ViewMode::Preview {
                self.view_mode = ViewMode::Edit;
            }
        } else {
            self.set_status(format!("Heading not found: {heading}"));
        }
    }

    fn request_open_note_at_heading(&mut self, path: PathBuf, heading: String) {
        if self
            .active_note
            .as_ref()
            .is_some_and(|active| active.abs_path == path)
        {
            self.open_note_at_heading(&path, &heading);
            return;
        }
        if let Some(active) = &self.active_note {
            if active.is_dirty() {
                self.unsaved_dialog.open(
                    active.rel_path.clone(),
                    PendingAction::OpenNoteAtHeading(path, heading),
                );
                return;
            }
        }
        self.open_note_at_heading(&path, &heading);
    }

    pub fn request_close_tab(&mut self, path: &Path) {
        let dirty_note = self
            .active_note
            .as_ref()
            .filter(|note| note.abs_path == path && note.is_dirty())
            .map(|note| note.rel_path.clone())
            .or_else(|| {
                self.cached_notes
                    .get(path)
                    .filter(|note| note.is_dirty())
                    .map(|note| note.rel_path.clone())
            });

        if let Some(note_name) = dirty_note {
            self.unsaved_dialog
                .open(note_name, PendingAction::CloseTab(path.to_path_buf()));
        } else {
            self.close_tab(path);
        }
    }

    fn close_tab(&mut self, path: &Path) {
        self.open_tabs.retain(|tab| tab != path);
        self.cached_notes.remove(path);
        let closing_active = self
            .active_note
            .as_ref()
            .is_some_and(|note| note.abs_path == path);
        if closing_active {
            self.active_note = None;
            if let Some(next) = self.open_tabs.last().cloned() {
                self.do_open_note(&next);
            }
        }
        self.persist_tabs();
    }

    fn persist_tabs(&mut self) {
        let active = self.active_note.as_ref().map(|note| note.abs_path.clone());
        self.config.set_open_tabs(self.open_tabs.clone(), active);
    }

    fn save_tab(&mut self, path: &Path) -> bool {
        let is_active = self
            .active_note
            .as_ref()
            .is_some_and(|note| note.abs_path == path);
        if is_active {
            return self.save_active_note();
        }
        let save_result = {
            let Some(vault) = &self.vault else {
                return false;
            };
            let Some(note) = self.cached_notes.get_mut(path) else {
                return false;
            };
            vault.save_note(note).map(|_| note.title.clone())
        };
        let title = match save_result {
            Ok(title) => title,
            Err(error) => {
                self.set_error(format!("Failed to save note: {}", error));
                return false;
            }
        };
        self.graph_view.invalidate();
        self.tag_explorer.invalidate();
        self.note_embed_cache.invalidate(path);
        self.set_status(format!("Saved {}", title));
        true
    }

    fn execute_discarded_action(&mut self, action: PendingAction) {
        match action {
            PendingAction::OpenNote(path) => {
                if let Some(active) = self.active_note.take() {
                    self.open_tabs.retain(|tab| tab != &active.abs_path);
                    self.cached_notes.remove(&active.abs_path);
                }
                self.do_open_note(&path);
            }
            PendingAction::OpenNoteAtHeading(path, heading) => {
                if let Some(active) = self.active_note.take() {
                    self.open_tabs.retain(|tab| tab != &active.abs_path);
                    self.cached_notes.remove(&active.abs_path);
                }
                self.open_note_at_heading(&path, &heading);
            }
            PendingAction::OpenDailyNote(date) => {
                if let Some(active) = self.active_note.take() {
                    self.open_tabs.retain(|tab| tab != &active.abs_path);
                    self.cached_notes.remove(&active.abs_path);
                }
                self.create_daily_note(&date);
            }
            PendingAction::PickVault => {
                self.active_note = None;
                self.open_tabs.clear();
                self.cached_notes.clear();
                self.persist_tabs();
                self.do_pick_and_open_vault();
            }
            PendingAction::PickVaultWithDirtyTab(path) => {
                self.cached_notes.remove(&path);
                self.active_note = None;
                self.open_tabs.clear();
                self.cached_notes.clear();
                self.persist_tabs();
                self.do_pick_and_open_vault();
            }
            PendingAction::CloseTab(path) => {
                self.close_tab(&path);
            }
            PendingAction::RenameNote(path, new_name) => {
                if let Some(active) = self.active_note.as_ref() {
                    if active.abs_path == path && active.is_dirty() {
                        self.active_note = None;
                        self.cached_notes.remove(&path);
                        self.open_tabs.retain(|tab| tab != &path);
                    }
                }
                if self
                    .cached_notes
                    .get(&path)
                    .is_some_and(ActiveNote::is_dirty)
                {
                    self.cached_notes.remove(&path);
                    self.open_tabs.retain(|tab| tab != &path);
                }
                if let Some(path) = self.perform_rename_note(path, new_name) {
                    self.do_open_note(&path);
                }
            }
        }
    }

    fn save_for_action(&mut self, action: &PendingAction) -> bool {
        match action {
            PendingAction::PickVaultWithDirtyTab(path)
            | PendingAction::CloseTab(path)
            | PendingAction::RenameNote(path, _) => self.save_tab(path),
            PendingAction::OpenNote(_)
            | PendingAction::OpenNoteAtHeading(_, _)
            | PendingAction::OpenDailyNote(_)
            | PendingAction::PickVault => self.save_active_note(),
        }
    }

    fn pending_action_note_name(&self, action: &PendingAction) -> Option<String> {
        match action {
            PendingAction::CloseTab(path)
            | PendingAction::PickVaultWithDirtyTab(path)
            | PendingAction::RenameNote(path, _) => self
                .active_note
                .as_ref()
                .filter(|note| &note.abs_path == path)
                .or_else(|| self.cached_notes.get(path))
                .map(|note| note.rel_path.clone()),
            PendingAction::OpenNote(_)
            | PendingAction::OpenNoteAtHeading(_, _)
            | PendingAction::OpenDailyNote(_)
            | PendingAction::PickVault => {
                self.active_note.as_ref().map(|note| note.rel_path.clone())
            }
        }
    }

    fn execute_pending_action(&mut self, action: PendingAction) {
        match action {
            PendingAction::OpenNote(path) => self.do_open_note(&path),
            PendingAction::OpenNoteAtHeading(path, heading) => {
                self.open_note_at_heading(&path, &heading)
            }
            PendingAction::OpenDailyNote(date) => self.create_daily_note(&date),
            PendingAction::PickVault | PendingAction::PickVaultWithDirtyTab(_) => {
                self.do_pick_and_open_vault()
            }
            PendingAction::CloseTab(path) => self.close_tab(&path),
            PendingAction::RenameNote(path, new_name) => {
                let _ = self.perform_rename_note(path, new_name);
            }
        }
    }

    pub fn tab_summaries(&self) -> Vec<(PathBuf, String, bool, bool)> {
        self.open_tabs
            .iter()
            .filter_map(|path| {
                let active = self
                    .active_note
                    .as_ref()
                    .filter(|note| &note.abs_path == path);
                let note = active.or_else(|| self.cached_notes.get(path));
                note.map(|note| {
                    (
                        path.clone(),
                        note.title.clone(),
                        active.is_some(),
                        note.is_dirty(),
                    )
                })
            })
            .collect()
    }

    pub fn handle_wikilink_action(&mut self, target: &str, heading: Option<&str>) {
        let path = self
            .vault
            .as_ref()
            .and_then(|vault| wikilinks::resolve_wikilink(vault, target))
            .map(|note| note.abs_path.clone());
        if let Some(path) = path {
            if let Some(heading) = heading {
                self.request_open_note_at_heading(path, heading.to_string());
            } else {
                self.request_open_note(path);
            }
        } else {
            self.missing_wikilink_dialog.open(target.to_string());
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
        if self.command_palette.is_open {
            return;
        }
        let input = ctx.input(|i| {
            let cmd = i.modifiers.command;
            let s = cmd && i.key_pressed(Key::S);
            let n = cmd && i.key_pressed(Key::N);
            let o = cmd && i.key_pressed(Key::O);
            let f = cmd && i.key_pressed(Key::F);
            let e = cmd && i.key_pressed(Key::E);
            let w = cmd && i.key_pressed(Key::W);
            let d = cmd && i.key_pressed(Key::D);
            let g = cmd && i.key_pressed(Key::G);
            let next_tab = cmd && i.key_pressed(Key::Tab) && !i.modifiers.shift;
            let previous_tab = cmd && i.key_pressed(Key::Tab) && i.modifiers.shift;
            (s, n, o, f, e, w, d, g, next_tab, previous_tab)
        });

        if input.0 {
            if self.active_canvas.is_some() {
                self.save_active_canvas();
            } else {
                self.save_active_note();
            }
        }
        if input.1 {
            self.open_new_note_dialog();
        }
        if input.2 {
            self.pick_and_open_vault();
        }
        if input.3 {
            self.sidebar_tab = SidebarTab::Search;
            self.focus_search_next_frame = true;
        }
        if input.4 {
            self.view_mode = match self.view_mode {
                ViewMode::Edit => ViewMode::Split,
                ViewMode::Split => ViewMode::Preview,
                ViewMode::Preview => ViewMode::Edit,
            };
        }
        if input.5 {
            if let Some(path) = self.active_note.as_ref().map(|note| note.abs_path.clone()) {
                self.request_close_tab(&path);
            }
        }
        if input.6 {
            self.open_daily_note();
        }
        if input.7 {
            self.active_canvas = None;
            self.sidebar_tab = if self.sidebar_tab == SidebarTab::Graph {
                SidebarTab::Notes
            } else {
                SidebarTab::Graph
            };
        }
        if input.8 {
            self.cycle_note_tab(1);
        }
        if input.9 {
            self.cycle_note_tab(-1);
        }
    }

    fn cycle_note_tab(&mut self, direction: isize) {
        if self.open_tabs.len() < 2 {
            return;
        }
        let current = self
            .active_note
            .as_ref()
            .and_then(|note| {
                self.open_tabs
                    .iter()
                    .position(|path| path == &note.abs_path)
            })
            .unwrap_or(0);
        let count = self.open_tabs.len() as isize;
        let next = (current as isize + direction).rem_euclid(count) as usize;
        self.request_open_note(self.open_tabs[next].clone());
    }
}

impl eframe::App for BetterObsidianApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Keyboard Shortcuts
        self.handle_shortcuts(ctx);
        self.command_palette.toggle_shortcut(ctx);

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

        // Top Title Bar (Obsidian-style compact header)
        TopBottomPanel::top("top_panel")
            .exact_height(30.0)
            .frame(
                egui::Frame::none()
                    .fill(Theme::BG_HEADER)
                    .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
                    .inner_margin(egui::Margin::symmetric(10.0, 0.0)),
            )
            .show(ctx, |ui| {
                ui.horizontal_centered(|ui| {
                    paint_app_mark(ui, 18.0);
                    ui.add_space(6.0);

                    if let Some(vault) = &self.vault {
                        let folder_name = vault
                            .root_path
                            .file_name()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_else(|| "Vault".to_string());

                        ui.label(
                            RichText::new(&folder_name)
                                .strong()
                                .size(12.0)
                                .color(Theme::TEXT_PRIMARY),
                        );

                        if let Some(active) = &self.active_note {
                            ui.label(RichText::new("/").size(11.0).color(Theme::TEXT_DIMMED));
                            ui.label(
                                RichText::new(&active.title)
                                    .size(12.0)
                                    .color(Theme::TEXT_MUTED),
                            );
                        } else if let Some(canvas) = &self.active_canvas {
                            ui.label(RichText::new("/").size(11.0).color(Theme::TEXT_DIMMED));
                            ui.label(
                                RichText::new(&canvas.title)
                                    .size(12.0)
                                    .color(Theme::TEXT_MUTED),
                            );
                        }
                    } else {
                        ui.label(
                            RichText::new("Better Obsidian")
                                .strong()
                                .size(12.0)
                                .color(Theme::TEXT_PRIMARY),
                        );
                    }

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if paint_header_icon(ui, HeaderIcon::RightSidebar)
                            .on_hover_text("Toggle right sidebar")
                            .clicked()
                        {
                            self.right_sidebar_open = !self.right_sidebar_open;
                        }
                        if paint_header_icon(ui, HeaderIcon::Palette)
                            .on_hover_text("Command palette · Ctrl+P")
                            .clicked()
                        {
                            self.command_palette.is_open = true;
                        }
                        if paint_header_icon(ui, HeaderIcon::Search)
                            .on_hover_text("Quick switcher · search notes")
                            .clicked()
                        {
                            self.sidebar_tab = SidebarTab::Search;
                            self.left_sidebar_open = true;
                            self.focus_search_next_frame = true;
                        }
                    });
                });
            });

        // Bottom Status Bar (Obsidian-style flush status bar)
        TopBottomPanel::bottom("bottom_panel")
            .exact_height(22.0)
            .frame(
                egui::Frame::none()
                    .fill(Theme::BG_SECONDARY)
                    .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
                    .inner_margin(egui::Margin::symmetric(10.0, 0.0)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    // Left: Error banner or status message or file path
                    if let Some((err, time)) = &self.error_banner {
                        if time.elapsed() < Duration::from_secs(8) {
                            ui.label(
                                RichText::new(format!("Error: {}", err))
                                    .color(Theme::ACCENT_RED)
                                    .size(11.0)
                                    .strong(),
                            );
                        } else {
                            self.error_banner = None;
                        }
                    } else if let Some((msg, time)) = &self.status_message {
                        if time.elapsed() < Duration::from_secs(5) {
                            ui.label(RichText::new(msg).color(Theme::ACCENT_GREEN).size(11.0));
                        } else {
                            self.status_message = None;
                        }
                    } else if let Some(active) = &self.active_note {
                        ui.label(
                            RichText::new(active.rel_path.clone())
                                .size(11.0)
                                .color(Theme::TEXT_DIMMED),
                        );
                    } else if let Some(canvas) = &self.active_canvas {
                        ui.label(
                            RichText::new(format!("{}.canvas", canvas.title))
                                .size(11.0)
                                .color(Theme::TEXT_DIMMED),
                        );
                    } else {
                        ui.label(RichText::new("Ready").size(11.0).color(Theme::TEXT_DIMMED));
                    }

                    // Right: Word & Char count, encoding, dirty status
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if let Some(active) = &self.active_note {
                            ui.label(RichText::new("UTF-8").size(10.5).color(Theme::TEXT_DIMMED));
                            ui.separator();

                            let (words, chars) = count_words_and_chars(&active.content);
                            ui.label(
                                RichText::new(format!("{} words, {} chars", words, chars))
                                    .size(11.0)
                                    .color(Theme::TEXT_MUTED),
                            );

                            if !self.backlinks.is_empty() {
                                ui.separator();
                                ui.label(
                                    RichText::new(format!("{} backlinks", self.backlinks.len()))
                                        .size(11.0)
                                        .color(Theme::TEXT_DIMMED),
                                );
                            }
                        } else if let Some(canvas) = &self.active_canvas {
                            ui.label(
                                RichText::new(format!("{} cards", canvas.document.nodes.len()))
                                    .size(11.0)
                                    .color(Theme::TEXT_MUTED),
                            );
                        }
                    });
                });
            });

        // 1. Activity Ribbon (Far left 40px, non-resizable)
        SidePanel::left("activity_ribbon_panel")
            .exact_width(40.0)
            .resizable(false)
            .frame(
                egui::Frame::none()
                    .fill(Theme::BG_SECONDARY)
                    .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
                    .inner_margin(egui::Margin::symmetric(2.0, 6.0)),
            )
            .show(ctx, |ui| {
                render_activity_ribbon(ui, self);
            });

        // 2. Left Sidebar Pane (File Explorer, Search, Tags, etc.)
        if self.left_sidebar_open {
            SidePanel::left("sidebar_pane_panel")
                .resizable(true)
                .default_width(240.0)
                .width_range(160.0..=450.0)
                .frame(
                    egui::Frame::none()
                        .fill(Theme::BG_SECONDARY)
                        .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
                        .inner_margin(egui::Margin::symmetric(8.0, 6.0)),
                )
                .show(ctx, |ui| {
                    render_sidebar_pane(ui, self);
                });
        }

        if self.right_sidebar_open {
            SidePanel::right("right_sidebar_panel")
                .frame(
                    egui::Frame::none()
                        .fill(Theme::BG_SECONDARY)
                        .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
                        .inner_margin(egui::Margin::same(0.0)),
                )
                .resizable(true)
                .default_width(260.0)
                .width_range(180.0..=420.0)
                .show(ctx, |ui| {
                    render_right_sidebar(ui, self);
                });
        }

        if self.show_shortcuts {
            let mut open = self.show_shortcuts;
            egui::Window::new("Shortcuts")
                .open(&mut open)
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, egui::vec2(0.0, 0.0))
                .show(ctx, |ui| {
                    ui.set_min_width(320.0);
                    ui.label(
                        RichText::new("Keyboard shortcuts")
                            .strong()
                            .size(13.0)
                            .color(Theme::TEXT_PRIMARY),
                    );
                    ui.add_space(8.0);
                    for (keys, action) in [
                        ("Ctrl+P", "Command palette"),
                        ("Ctrl+O", "Open vault folder"),
                        ("Ctrl+N", "New note"),
                        ("Ctrl+S", "Save"),
                        ("Ctrl+F", "Search notes"),
                        ("Ctrl+G", "Graph view"),
                        ("Ctrl+D", "Daily note"),
                        ("Ctrl+E", "Cycle edit / split / preview"),
                        ("Ctrl+W", "Close tab"),
                    ] {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(keys)
                                    .size(11.0)
                                    .strong()
                                    .color(Theme::ACCENT_BLUE),
                            );
                            ui.label(RichText::new(action).size(11.0).color(Theme::TEXT_MUTED));
                        });
                    }
                });
            self.show_shortcuts = open;
        }

        // Central Panel (Editor / Markdown Preview)
        CentralPanel::default()
            .frame(
                egui::Frame::none()
                    .fill(Theme::BG_PRIMARY)
                    .inner_margin(egui::Margin::same(0.0)),
            )
            .show(ctx, |ui| {
                if let Some(canvas) = &mut self.active_canvas {
                    if canvas.request_delete {
                        canvas.request_delete = false;
                        let path = canvas.path.clone();
                        let title = canvas.title.clone();
                        self.request_delete_canvas(path, title);
                    } else if crate::canvas::render(ui, canvas) {
                        ctx.request_repaint();
                    }
                } else if self.sidebar_tab == SidebarTab::Graph {
                    let focus = self.active_note.as_ref().map(|note| note.abs_path.clone());
                    let opened = self
                        .graph_view
                        .render(ui, self.vault.as_ref(), focus.as_ref());
                    if let Some(path) = opened {
                        self.request_open_note(path);
                    }
                } else {
                    render_editor_area(ui, self);
                }
            });

        // Modal Dialogs
        if let Some(note) = self.new_note_dialog.render(ctx, &mut self.vault) {
            let path = note.abs_path.clone();
            self.do_open_note(&path);
            self.graph_view.invalidate();
            self.set_status(format!("Created note '{}'", note.title));
        }

        if let Some((path, new_name)) = self.rename_note_dialog.render(ctx) {
            self.request_rename_note(path, new_name);
        }

        if let Some(template) = self
            .template_picker_dialog
            .render(ctx, self.active_note.is_some())
        {
            self.insert_template(template);
        }

        if let Some(note) = self.missing_wikilink_dialog.render(ctx, &mut self.vault) {
            let path = note.abs_path.clone();
            self.do_open_note(&path);
            self.graph_view.invalidate();
            self.set_status(format!("Created note '{}'", note.title));
        }

        if let Some(target) = self.delete_confirm_dialog.render(ctx) {
            self.execute_delete(target);
        }

        if let Some(choice) = self.unsaved_dialog.render(ctx) {
            match choice {
                UnsavedChoice::SaveAndProceed(action) => {
                    if self.save_for_action(&action) {
                        self.execute_pending_action(action);
                    } else if let Some(note_name) = self.pending_action_note_name(&action) {
                        self.unsaved_dialog.open(note_name, action);
                    }
                }
                UnsavedChoice::DiscardAndProceed(action) => {
                    self.execute_discarded_action(action);
                }
                UnsavedChoice::Cancel => {}
            }
        }

        if let Some(action) = self.command_palette.render(
            ctx,
            self.vault.as_ref(),
            self.active_note.is_some(),
            self.active_canvas.is_some(),
        ) {
            match action {
                PaletteAction::CreateNote => self.open_new_note_dialog(),
                PaletteAction::CreateCanvas => self.create_canvas(),
                PaletteAction::OpenDailyNote => self.open_daily_note(),
                PaletteAction::InsertTemplate => self.open_insert_template_picker(),
                PaletteAction::OpenVault => self.pick_and_open_vault(),
                PaletteAction::SaveNote => {
                    if self.active_canvas.is_some() {
                        self.save_active_canvas();
                    } else {
                        self.save_active_note();
                    }
                }
                PaletteAction::SearchNotes => {
                    self.sidebar_tab = SidebarTab::Search;
                    self.focus_search_next_frame = true;
                }
                PaletteAction::ShowGraph => {
                    self.active_canvas = None;
                    self.sidebar_tab = SidebarTab::Graph;
                }
                PaletteAction::ShowOutline => {
                    self.right_sidebar_open = true;
                    self.right_sidebar_tab = RightSidebarTab::Outline;
                }
                PaletteAction::SetViewMode(mode) => self.view_mode = mode,
                PaletteAction::OpenNote(path) => self.request_open_note(path),
                PaletteAction::DeleteActiveNote => {
                    if let Some(active) = &self.active_note {
                        let path = active.abs_path.clone();
                        let title = active.title.clone();
                        self.request_delete_note(path, title);
                    }
                }
                PaletteAction::DeleteActiveCanvas => {
                    if let Some(canvas) = &self.active_canvas {
                        let path = canvas.path.clone();
                        let title = canvas.title.clone();
                        self.request_delete_canvas(path, title);
                    }
                }
            }
        }
    }
}

enum HeaderIcon {
    Search,
    Palette,
    RightSidebar,
}

fn paint_header_icon(ui: &mut egui::Ui, kind: HeaderIcon) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(egui::vec2(22.0, 22.0), egui::Sense::click());
    let color = if response.hovered() {
        Theme::TEXT_PRIMARY
    } else {
        Theme::TEXT_MUTED
    };
    if response.hovered() {
        ui.painter().rect_filled(rect, 4.0, Theme::BG_CARD);
    }
    let painter = ui.painter();
    let c = rect.center();
    let stroke = egui::Stroke::new(1.4_f32, color);
    match kind {
        HeaderIcon::Search => {
            painter.circle_stroke(c + egui::vec2(-1.5, -1.5), 5.0, stroke);
            painter.line_segment([c + egui::vec2(2.2, 2.2), c + egui::vec2(6.5, 6.5)], stroke);
        }
        HeaderIcon::Palette => {
            painter.line_segment(
                [c + egui::vec2(-4.0, -4.0), c + egui::vec2(-1.0, -1.0)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(-1.0, -1.0), c + egui::vec2(-4.0, 2.0)],
                stroke,
            );
            painter.line_segment([c + egui::vec2(0.0, 2.0), c + egui::vec2(4.0, 2.0)], stroke);
        }
        HeaderIcon::RightSidebar => {
            let r = egui::Rect::from_center_size(c, egui::vec2(13.0, 11.0));
            painter.rect_stroke(r, 1.5, stroke);
            painter.line_segment(
                [c + egui::vec2(2.5, -5.5), c + egui::vec2(2.5, 5.5)],
                stroke,
            );
        }
    }
    response
}

fn count_words_and_chars(text: &str) -> (usize, usize) {
    let chars = text.chars().count();
    let words = text.split_whitespace().count();
    (words, chars)
}

pub(crate) fn paint_app_mark(ui: &mut egui::Ui, size: f32) {
    let (rect, _) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 7.0, Theme::BG_CARD);
    painter.rect_stroke(rect, 7.0, egui::Stroke::new(1.0_f32, Theme::BORDER));
    let scale = size / 30.0;
    let page = egui::Rect::from_min_size(
        rect.min + egui::vec2(7.0 * scale, 4.5 * scale),
        egui::vec2(14.0 * scale, 21.0 * scale),
    );
    painter.rect_filled(page, 2.5 * scale, Theme::TEXT_PRIMARY);
    for y in [11.5, 14.5] {
        painter.line_segment(
            [
                rect.min + egui::vec2(10.0 * scale, y * scale),
                rect.min + egui::vec2((if y < 13.0 { 19.0 } else { 16.0 }) * scale, y * scale),
            ],
            egui::Stroke::new(1.1 * scale, Theme::TEXT_MUTED),
        );
    }
    let nodes = [
        (10.5, 20.0),
        (15.0, 17.0),
        (20.0, 20.0),
        (23.0, 16.5),
        (15.5, 24.0),
    ];
    for (from, to) in [(0, 1), (1, 2), (2, 3), (1, 4)] {
        let point =
            |index: usize| rect.min + egui::vec2(nodes[index].0 * scale, nodes[index].1 * scale);
        painter.line_segment(
            [point(from), point(to)],
            egui::Stroke::new(1.35 * scale, Theme::ACCENT_PURPLE),
        );
    }
    for (index, (x, y)) in nodes.into_iter().enumerate() {
        painter.circle_filled(
            rect.min + egui::vec2(x * scale, y * scale),
            if index == 1 { 2.0 } else { 1.6 } * scale,
            if index == 3 {
                Theme::ACCENT_ORANGE
            } else {
                Theme::ACCENT_PURPLE
            },
        );
    }
}
