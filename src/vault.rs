use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct NoteItem {
    pub rel_path: String,
    pub abs_path: PathBuf,
    pub title: String,
}

#[derive(Debug, Clone)]
pub struct CanvasItem {
    pub rel_path: String,
    pub abs_path: PathBuf,
    pub title: String,
}

#[derive(Debug, Clone)]
pub struct TemplateItem {
    pub name: String,
    pub rel_path: String,
    pub abs_path: PathBuf,
}

#[derive(Debug, Clone)]
pub struct ActiveNote {
    pub rel_path: String,
    pub abs_path: PathBuf,
    pub title: String,
    pub content: String,
    pub saved_content: String,
}

impl ActiveNote {
    pub fn is_dirty(&self) -> bool {
        self.content != self.saved_content
    }
}

pub struct Vault {
    pub root_path: PathBuf,
    pub notes: Vec<NoteItem>,
    pub canvases: Vec<CanvasItem>,
}

impl Vault {
    pub fn open(root_path: PathBuf) -> io::Result<Self> {
        if !root_path.is_dir() {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                format!("Selected path is not a valid directory: {:?}", root_path),
            ));
        }

        let root_path = fs::canonicalize(root_path)?;

        let mut vault = Self {
            root_path,
            notes: Vec::new(),
            canvases: Vec::new(),
        };
        vault.refresh_notes()?;
        Ok(vault)
    }

    /// Scans the vault directory for markdown files without loading note bodies into memory.
    pub fn refresh_notes(&mut self) -> io::Result<()> {
        let mut notes = Vec::new();
        let mut canvases = Vec::new();

        for entry in WalkDir::new(&self.root_path)
            .into_iter()
            .filter_entry(|e| !is_hidden_or_ignored(e))
        {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            if entry.file_type().is_file() {
                let path = entry.path();
                if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                    if ext.eq_ignore_ascii_case("canvas") {
                        if let Ok(rel) = path.strip_prefix(&self.root_path) {
                            let rel_path = rel.to_string_lossy().replace('\\', "/");
                            canvases.push(CanvasItem {
                                rel_path,
                                abs_path: path.to_path_buf(),
                                title: path
                                    .file_stem()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                                    .into_owned(),
                            });
                        }
                    } else if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown")
                    {
                        if let Ok(rel) = path.strip_prefix(&self.root_path) {
                            let rel_str = rel.to_string_lossy().replace('\\', "/");
                            let title = path
                                .file_stem()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_else(|| rel_str.clone());

                            notes.push(NoteItem {
                                rel_path: rel_str,
                                abs_path: path.to_path_buf(),
                                title,
                            });
                        }
                    }
                }
            }
        }

        notes.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));
        canvases.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));
        self.notes = notes;
        self.canvases = canvases;
        Ok(())
    }

    pub fn create_canvas(&mut self, title: &str) -> io::Result<CanvasItem> {
        let mut name = title.trim().trim_end_matches(".canvas").to_string();
        if name.is_empty() || name.contains(['/', '\\']) || name == "." || name == ".." {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Choose a simple canvas name.",
            ));
        }
        let mut path = self.root_path.join(format!("{name}.canvas"));
        let mut suffix = 2;
        while path.exists() {
            name = format!("{} ({suffix})", title.trim().trim_end_matches(".canvas"));
            path = self.root_path.join(format!("{name}.canvas"));
            suffix += 1;
        }
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)?;
        serde_json::to_writer_pretty(file, &serde_json::json!({"nodes": [], "edges": []}))
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        self.refresh_notes()?;
        Ok(CanvasItem {
            rel_path: format!("{name}.canvas"),
            abs_path: path,
            title: name,
        })
    }

    /// Read note content on-demand
    pub fn load_note(&self, abs_path: &Path) -> io::Result<ActiveNote> {
        let content = fs::read_to_string(abs_path)?;
        let rel_str = abs_path
            .strip_prefix(&self.root_path)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| {
                abs_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string()
            });

        let title = abs_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| rel_str.clone());

        Ok(ActiveNote {
            rel_path: rel_str,
            abs_path: abs_path.to_path_buf(),
            title,
            saved_content: content.clone(),
            content,
        })
    }

    /// Saves the active note to disk
    pub fn save_note(&self, active_note: &mut ActiveNote) -> io::Result<()> {
        let relative_path = active_note
            .abs_path
            .strip_prefix(&self.root_path)
            .map_err(|_| invalid_note_path("The note is outside the open vault."))?;
        if relative_path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        {
            return Err(invalid_note_path("The note path is not a safe vault path."));
        }

        let parent = active_note
            .abs_path
            .parent()
            .ok_or_else(|| invalid_note_path("The note has no parent directory."))?;
        let canonical_parent = fs::canonicalize(parent)?;
        if !canonical_parent.starts_with(&self.root_path) {
            return Err(invalid_note_path(
                "The note's parent directory resolves outside the open vault.",
            ));
        }

        let metadata = fs::symlink_metadata(&active_note.abs_path)?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(invalid_note_path(
                "The note is no longer a regular file inside the vault.",
            ));
        }

        let disk_content = fs::read_to_string(&active_note.abs_path)?;
        if disk_content != active_note.saved_content {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                "This note changed on disk since it was opened. Reopen it before saving to avoid overwriting the newer version.",
            ));
        }

        fs::write(&active_note.abs_path, &active_note.content)?;
        active_note.saved_content = active_note.content.clone();
        Ok(())
    }

    /// Creates a new note safely. Returns an error if the file already exists.
    /// Never silently overwrites an existing file.
    pub fn create_note(
        &mut self,
        filename: &str,
        initial_content: Option<&str>,
    ) -> io::Result<NoteItem> {
        let relative_path = normalize_note_name(filename)?;
        let target_path = create_safe_parent_path(&self.root_path, &relative_path)?;

        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target_path)?;

        let default_body = initial_content.unwrap_or("");
        if let Err(error) = file.write_all(default_body.as_bytes()) {
            drop(file);
            let _ = fs::remove_file(&target_path);
            return Err(error);
        }
        drop(file);

        self.refresh_notes()?;

        let rel_str = target_path
            .strip_prefix(&self.root_path)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| relative_path.to_string_lossy().replace('\\', "/"));

        let title = target_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| rel_str.clone());

        Ok(NoteItem {
            rel_path: rel_str,
            abs_path: target_path,
            title,
        })
    }

    pub fn rename_note(
        &mut self,
        source: &Path,
        new_name: &str,
        skip_link_rewrite: &HashSet<PathBuf>,
    ) -> io::Result<(NoteItem, Vec<PathBuf>)> {
        let source_relative = source
            .strip_prefix(&self.root_path)
            .map_err(|_| invalid_note_path("The note is outside the open vault."))?;
        if source_relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        {
            return Err(invalid_note_path("The note path is not a safe vault path."));
        }
        let source_metadata = fs::symlink_metadata(source)?;
        if source_metadata.file_type().is_symlink() || !source_metadata.is_file() {
            return Err(invalid_note_path(
                "Only regular Markdown notes can be renamed.",
            ));
        }
        let source_parent = source
            .parent()
            .ok_or_else(|| invalid_note_path("The note has no parent directory."))?;
        if !fs::canonicalize(source_parent)?.starts_with(&self.root_path) {
            return Err(invalid_note_path(
                "The note parent resolves outside the vault.",
            ));
        }
        let relative_target = normalize_note_name(new_name)?;
        let target = create_safe_parent_path(&self.root_path, &relative_target)?;
        if source
            .to_string_lossy()
            .eq_ignore_ascii_case(&target.to_string_lossy())
        {
            let existing = self
                .notes
                .iter()
                .find(|note| note.abs_path == source)
                .cloned()
                .ok_or_else(|| {
                    io::Error::new(io::ErrorKind::NotFound, "Note not found in vault.")
                })?;
            return Ok((existing, Vec::new()));
        }
        if target.exists() {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "A note already exists at that path.",
            ));
        }

        let old_note = self
            .notes
            .iter()
            .find(|note| note.abs_path == source)
            .cloned()
            .unwrap_or_else(|| {
                let rel_path = source_relative.to_string_lossy().replace('\\', "/");
                NoteItem {
                    title: source
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                    rel_path,
                    abs_path: source.to_path_buf(),
                }
            });
        let target_rel = target
            .strip_prefix(&self.root_path)
            .map_err(|_| invalid_note_path("The new note path is outside the vault."))?
            .to_string_lossy()
            .replace('\\', "/");
        let new_note = NoteItem {
            title: target
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            rel_path: target_rel,
            abs_path: target.clone(),
        };
        let source_content = fs::read_to_string(source)?;
        let renamed_content =
            crate::wikilinks::rewrite_wikilinks(&source_content, &old_note, &new_note);

        let mut changes: Vec<(PathBuf, String, String)> = Vec::new();
        let mut changed_paths = Vec::new();
        for note in &self.notes {
            if note.abs_path == source {
                continue;
            }
            let metadata = fs::symlink_metadata(&note.abs_path)?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err(invalid_note_path(
                    "A vault note is no longer a regular file.",
                ));
            }
            let canonical = fs::canonicalize(&note.abs_path)?;
            if !canonical.starts_with(&self.root_path) {
                return Err(invalid_note_path(
                    "A vault note resolves outside the open vault.",
                ));
            }
            let original = fs::read_to_string(&canonical)?;
            let rewritten = crate::wikilinks::rewrite_wikilinks(&original, &old_note, &new_note);
            if rewritten != original {
                changed_paths.push(note.abs_path.clone());
                if !skip_link_rewrite.contains(&note.abs_path) {
                    changes.push((canonical, original, rewritten));
                }
            }
        }

        let mut committed = Vec::new();
        for (path, original, rewritten) in &changes {
            match fs::read_to_string(path) {
                Ok(current) if current == *original => {}
                Ok(_) => {
                    rollback_rewrites(&committed);
                    return Err(io::Error::new(
                        io::ErrorKind::Other,
                        format!(
                            "{} changed during rename; reopen it and try again.",
                            path.display()
                        ),
                    ));
                }
                Err(error) => {
                    rollback_rewrites(&committed);
                    return Err(error);
                }
            }
            if let Err(error) = replace_file_contents_atomic(path, rewritten.as_bytes()) {
                rollback_rewrites(&committed);
                return Err(error);
            }
            committed.push((path.clone(), original.clone()));
        }

        let create_result = (|| {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&target)?;
            if let Err(error) = file.write_all(renamed_content.as_bytes()) {
                drop(file);
                let _ = fs::remove_file(&target);
                return Err(error);
            }
            drop(file);
            fs::remove_file(source)
        })();
        if let Err(error) = create_result {
            let _ = fs::remove_file(&target);
            rollback_rewrites(&committed);
            return Err(error);
        }

        self.notes.retain(|note| note.abs_path != source);
        self.notes.push(new_note.clone());
        self.notes
            .sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));
        Ok((new_note, changed_paths))
    }

    /// Deletes a file (note or canvas) safely from the vault.
    pub fn delete_file(&mut self, path: &Path) -> io::Result<()> {
        let relative = path
            .strip_prefix(&self.root_path)
            .map_err(|_| invalid_note_path("The file is outside the open vault."))?;
        if relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        {
            return Err(invalid_note_path("The file path is not a safe vault path."));
        }
        let metadata = fs::symlink_metadata(path)?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(invalid_note_path("Only regular vault files can be deleted."));
        }
        let parent = path
            .parent()
            .ok_or_else(|| invalid_note_path("The file has no parent directory."))?;
        if !fs::canonicalize(parent)?.starts_with(&self.root_path) {
            return Err(invalid_note_path("The file parent resolves outside the vault."));
        }

        fs::remove_file(path)?;
        self.refresh_notes()?;
        Ok(())
    }

    pub fn daily_note_template(&self) -> Option<String> {
        let template_path = self.root_path.join("Templates").join("Daily.md");
        self.read_template(&template_path).ok()
    }

    /// Read template content safely. Rejects symlinks, non-files, and paths outside vault.
    pub fn read_template(&self, abs_path: &Path) -> io::Result<String> {
        let metadata = fs::symlink_metadata(abs_path)?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(invalid_note_path(
                "The template is not a regular file inside the vault.",
            ));
        }
        let canonical = fs::canonicalize(abs_path)?;
        if !canonical.starts_with(&self.root_path) {
            return Err(invalid_note_path(
                "The template resolves outside the open vault.",
            ));
        }
        fs::read_to_string(canonical)
    }

    /// Discovers regular Markdown files under the vault's Templates folder (including subfolders).
    /// Does not follow symbolic links.
    pub fn list_templates(&self) -> Vec<TemplateItem> {
        let templates_dir = if self.root_path.join("Templates").is_dir() {
            self.root_path.join("Templates")
        } else if self.root_path.join("templates").is_dir() {
            self.root_path.join("templates")
        } else {
            return Vec::new();
        };

        let metadata = match fs::symlink_metadata(&templates_dir) {
            Ok(m) => m,
            Err(_) => return Vec::new(),
        };
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Vec::new();
        }

        let canonical_templates = match fs::canonicalize(&templates_dir) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };
        if !canonical_templates.starts_with(&self.root_path) {
            return Vec::new();
        }

        let mut templates = Vec::new();
        for entry in WalkDir::new(&canonical_templates)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| !is_hidden_or_ignored(e))
        {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            let path = entry.path();
            let metadata = match fs::symlink_metadata(path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                continue;
            }
            let Some(ext) = path.extension().and_then(|s| s.to_str()) else {
                continue;
            };
            if !ext.eq_ignore_ascii_case("md") && !ext.eq_ignore_ascii_case("markdown") {
                continue;
            }
            let Ok(canonical) = fs::canonicalize(path) else {
                continue;
            };
            if !canonical.starts_with(&self.root_path)
                || !canonical.starts_with(&canonical_templates)
            {
                continue;
            }
            let Ok(rel) = canonical.strip_prefix(&canonical_templates) else {
                continue;
            };
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            let name = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| rel_str.clone());

            templates.push(TemplateItem {
                name,
                rel_path: rel_str,
                abs_path: canonical,
            });
        }

        templates.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));
        templates
    }

    /// Finds a unique "Untitled" name that does not exist
    pub fn find_available_untitled_name(&self) -> String {
        let base = "Untitled";
        let candidate = format!("{}.md", base);
        if !self.root_path.join(&candidate).exists() {
            return base.to_string();
        }

        let mut index = 1;
        loop {
            let candidate = format!("{} {}.md", base, index);
            if !self.root_path.join(&candidate).exists() {
                return format!("{} {}", base, index);
            }
            index += 1;
        }
    }
}

fn invalid_note_path(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

fn replace_file_contents_atomic(path: &Path, content: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| invalid_note_path("File has no parent directory."))?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let file_name = path.file_name().unwrap_or_default().to_string_lossy();
    let temp = parent.join(format!(
        ".{file_name}.better-obsidian-{}-{stamp}.tmp",
        std::process::id()
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)?;
    if let Err(error) = file.write_all(content) {
        drop(file);
        let _ = fs::remove_file(&temp);
        return Err(error);
    }
    drop(file);
    if let Err(error) = fs::rename(&temp, path) {
        let _ = fs::remove_file(&temp);
        return Err(error);
    }
    Ok(())
}

fn rollback_rewrites(committed: &[(PathBuf, String)]) {
    for (path, original) in committed.iter().rev() {
        let _ = replace_file_contents_atomic(path, original.as_bytes());
    }
}

fn normalize_note_name(filename: &str) -> io::Result<PathBuf> {
    let clean_name = filename.trim().replace('\\', "/");
    let input_path = Path::new(&clean_name);
    if clean_name.is_empty() || input_path.is_absolute() {
        return Err(invalid_note_path(
            "Enter a note name relative to the vault, such as Folder/My Note.",
        ));
    }

    let mut relative_path = PathBuf::new();
    for component in input_path.components() {
        let Component::Normal(name) = component else {
            return Err(invalid_note_path(
                "Note names cannot contain absolute paths, '.' or '..' path segments.",
            ));
        };

        let name = name.to_string_lossy();
        if name.is_empty()
            || name.ends_with('.')
            || name.ends_with(' ')
            || name
                .chars()
                .any(|c| c.is_control() || "<>:\"|?*".contains(c))
            || is_windows_reserved_name(&name)
        {
            return Err(invalid_note_path(
                "The note name contains characters or a reserved name that Windows cannot safely use.",
            ));
        }
        relative_path.push(name.as_ref());
    }

    let file_name = relative_path
        .file_name()
        .ok_or_else(|| invalid_note_path("Note name cannot be empty."))?
        .to_string_lossy()
        .to_string();
    let lower_name = file_name.to_ascii_lowercase();
    if !lower_name.ends_with(".md") && !lower_name.ends_with(".markdown") {
        relative_path.set_file_name(format!("{file_name}.md"));
    }

    Ok(relative_path)
}

fn is_windows_reserved_name(name: &str) -> bool {
    let base = name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ["COM", "LPT"].iter().any(|prefix| {
            base.strip_prefix(prefix).is_some_and(|suffix| {
                suffix.len() == 1
                    && suffix.as_bytes()[0].is_ascii_digit()
                    && suffix.as_bytes()[0] != b'0'
            })
        })
}

fn create_safe_parent_path(root: &Path, relative_path: &Path) -> io::Result<PathBuf> {
    let mut current = root.to_path_buf();
    if let Some(parent) = relative_path.parent() {
        for component in parent.components() {
            let Component::Normal(name) = component else {
                return Err(invalid_note_path("The note parent path is not safe."));
            };
            current.push(name);

            match fs::symlink_metadata(&current) {
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    return Err(invalid_note_path(
                        "Cannot create a note through a symbolic link in the vault.",
                    ));
                }
                Ok(metadata) if !metadata.is_dir() => {
                    return Err(io::Error::new(
                        io::ErrorKind::AlreadyExists,
                        "A note folder path is occupied by a file.",
                    ));
                }
                Ok(_) => {}
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    fs::create_dir(&current)?;
                }
                Err(error) => return Err(error),
            }
        }
    }

    let canonical_parent = fs::canonicalize(&current)?;
    if !canonical_parent.starts_with(root) {
        return Err(invalid_note_path(
            "The note's parent directory resolves outside the open vault.",
        ));
    }

    let file_name = relative_path
        .file_name()
        .ok_or_else(|| invalid_note_path("Note name cannot be empty."))?;
    Ok(current.join(file_name))
}

fn is_hidden_or_ignored(entry: &walkdir::DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

pub fn expand_template_variables(template: &str, note_title: &str) -> String {
    let date = crate::date::today_local();
    template
        .replace("{{title}}", note_title)
        .replace("{{Title}}", note_title)
        .replace("{{TITLE}}", note_title)
        .replace("{{ title }}", note_title)
        .replace("{{ Title }}", note_title)
        .replace("{{date}}", &date)
        .replace("{{Date}}", &date)
        .replace("{{DATE}}", &date)
        .replace("{{ date }}", &date)
        .replace("{{ Date }}", &date)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_delete_note() {
        let temp_dir = std::env::temp_dir().join(format!("better_obsidian_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let mut vault = Vault::open(temp_dir.clone()).unwrap();

        let note = vault.create_note("Test Note", Some("Hello world")).unwrap();
        assert!(note.abs_path.exists());
        assert_eq!(vault.notes.len(), 1);

        vault.delete_file(&note.abs_path).unwrap();
        assert!(!note.abs_path.exists());
        assert_eq!(vault.notes.len(), 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_create_and_delete_canvas() {
        let temp_dir = std::env::temp_dir().join(format!("better_obsidian_test_canvas_{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let mut vault = Vault::open(temp_dir.clone()).unwrap();

        let canvas = vault.create_canvas("Test Canvas").unwrap();
        assert!(canvas.abs_path.exists());
        assert_eq!(vault.canvases.len(), 1);

        vault.delete_file(&canvas.abs_path).unwrap();
        assert!(!canvas.abs_path.exists());
        assert_eq!(vault.canvases.len(), 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
