use std::collections::{HashMap, VecDeque};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::sync::Arc;
use std::thread;

const MAX_EMBED_BYTES: u64 = 512 * 1024;
const MAX_CACHE_ENTRIES: usize = 12;
const MAX_PENDING_READS: usize = 3;

enum Entry {
    Ready(Arc<str>),
    Failed(String),
}

pub enum EmbedLoad {
    Ready(Arc<str>),
    Loading,
    Failed(String),
}

#[derive(Default)]
pub struct NoteEmbedCache {
    entries: HashMap<PathBuf, Entry>,
    pending: HashMap<PathBuf, Receiver<Result<String, String>>>,
    recently_used: VecDeque<PathBuf>,
}

impl NoteEmbedCache {
    pub fn load(&mut self, path: &Path, vault_root: &Path) -> EmbedLoad {
        if let Some(receiver) = self.pending.get(path) {
            match receiver.try_recv() {
                Ok(result) => {
                    self.pending.remove(path);
                    let entry = match result {
                        Ok(content) => Entry::Ready(Arc::from(content)),
                        Err(error) => Entry::Failed(error),
                    };
                    self.entries.insert(path.to_path_buf(), entry);
                    self.touch(path);
                    self.evict_old_entries();
                }
                Err(mpsc::TryRecvError::Disconnected) => {
                    self.pending.remove(path);
                    self.entries.insert(
                        path.to_path_buf(),
                        Entry::Failed("The note could not be read.".to_string()),
                    );
                }
                Err(mpsc::TryRecvError::Empty) => return EmbedLoad::Loading,
            }
        }
        if let Some(entry) = self.entries.get(path) {
            let result = match entry {
                Entry::Ready(content) => EmbedLoad::Ready(Arc::clone(content)),
                Entry::Failed(error) => EmbedLoad::Failed(error.clone()),
            };
            self.touch(path);
            return result;
        }
        if self.pending.len() >= MAX_PENDING_READS {
            return EmbedLoad::Loading;
        }
        let path = path.to_path_buf();
        let worker_path = path.clone();
        let worker_root = vault_root.to_path_buf();
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let result = fs::symlink_metadata(&worker_path)
                .map_err(|error| error.to_string())
                .and_then(|metadata| {
                    if metadata.file_type().is_symlink() || !metadata.is_file() {
                        Err("Embedded notes must be regular files inside the vault.".to_string())
                    } else if metadata.len() > MAX_EMBED_BYTES {
                        Err(
                            "Embedded notes larger than 512 KiB are not loaded in preview."
                                .to_string(),
                        )
                    } else {
                        let canonical =
                            fs::canonicalize(&worker_path).map_err(|error| error.to_string())?;
                        if !canonical.starts_with(&worker_root) {
                            return Err("Embedded note resolves outside the vault.".to_string());
                        }
                        let canonical_metadata =
                            fs::metadata(&canonical).map_err(|error| error.to_string())?;
                        if canonical_metadata.len() > MAX_EMBED_BYTES {
                            return Err(
                                "Embedded notes larger than 512 KiB are not loaded in preview."
                                    .to_string(),
                            );
                        }
                        let mut content = String::new();
                        fs::File::open(canonical)
                            .map_err(|error| error.to_string())?
                            .take(MAX_EMBED_BYTES + 1)
                            .read_to_string(&mut content)
                            .map_err(|error| error.to_string())?;
                        if content.len() as u64 > MAX_EMBED_BYTES {
                            Err("Embedded note grew beyond the 512 KiB preview limit.".to_string())
                        } else {
                            Ok(content)
                        }
                    }
                });
            let _ = sender.send(result);
        });
        self.pending.insert(path, receiver);
        EmbedLoad::Loading
    }

    pub fn invalidate(&mut self, path: &Path) {
        self.entries.remove(path);
        self.pending.remove(path);
        self.recently_used.retain(|entry| entry != path);
    }

    fn touch(&mut self, path: &Path) {
        self.recently_used.retain(|entry| entry != path);
        self.recently_used.push_back(path.to_path_buf());
    }

    fn evict_old_entries(&mut self) {
        while self.entries.len() > MAX_CACHE_ENTRIES {
            if let Some(oldest) = self.recently_used.pop_front() {
                self.entries.remove(&oldest);
            } else {
                break;
            }
        }
    }
}
