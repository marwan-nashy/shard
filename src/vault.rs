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
        };
        vault.refresh_notes()?;
        Ok(vault)
    }

    /// Scans the vault directory for markdown files without loading note bodies into memory.
    pub fn refresh_notes(&mut self) -> io::Result<()> {
        let mut notes = Vec::new();

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
                    if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown") {
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
        self.notes = notes;
        Ok(())
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
