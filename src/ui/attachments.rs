use egui::{ColorImage, Context, TextureHandle, TextureOptions};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;

const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_IMAGE_PIXELS: u64 = 12_000_000;
const MAX_TEXTURES: usize = 6;

pub enum ImageStatus {
    Ready(TextureHandle),
    Loading,
    Failed(String),
}

pub struct AttachmentCache {
    textures: HashMap<PathBuf, TextureHandle>,
    lru: VecDeque<PathBuf>,
    pending: HashSet<PathBuf>,
    failures: HashMap<PathBuf, String>,
    sender: Sender<(PathBuf, Result<ColorImage, String>)>,
    receiver: Receiver<(PathBuf, Result<ColorImage, String>)>,
}

impl Default for AttachmentCache {
    fn default() -> Self {
        let (sender, receiver) = mpsc::channel();
        Self {
            textures: HashMap::new(),
            lru: VecDeque::new(),
            pending: HashSet::new(),
            failures: HashMap::new(),
            sender,
            receiver,
        }
    }
}

impl AttachmentCache {
    pub fn get_or_load(&mut self, ctx: &Context, path: &Path) -> ImageStatus {
        self.poll(ctx);
        let path = path.to_path_buf();
        if let Some(texture) = self.textures.get(&path).cloned() {
            self.lru.retain(|cached| cached != &path);
            self.lru.push_back(path);
            return ImageStatus::Ready(texture);
        }
        if let Some(error) = self.failures.get(&path) {
            return ImageStatus::Failed(error.clone());
        }
        if self.pending.insert(path.clone()) {
            let sender = self.sender.clone();
            thread::spawn(move || {
                let result = decode_image(&path);
                let _ = sender.send((path, result));
            });
        }
        ImageStatus::Loading
    }

    fn poll(&mut self, ctx: &Context) {
        while let Ok((path, decoded)) = self.receiver.try_recv() {
            self.pending.remove(&path);
            match decoded {
                Ok(image) => {
                    let name = path
                        .file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .unwrap_or_else(|| "attachment".to_string());
                    let texture = ctx.load_texture(name, image, TextureOptions::LINEAR);
                    self.textures.insert(path.clone(), texture);
                    self.lru.retain(|cached| cached != &path);
                    self.lru.push_back(path);
                    while self.lru.len() > MAX_TEXTURES {
                        if let Some(oldest) = self.lru.pop_front() {
                            self.textures.remove(&oldest);
                            self.failures.remove(&oldest);
                        }
                    }
                }
                Err(error) => {
                    if self.failures.len() >= MAX_TEXTURES {
                        if let Some(oldest) = self.failures.keys().next().cloned() {
                            self.failures.remove(&oldest);
                        }
                    }
                    self.failures.insert(path, error);
                }
            }
        }
    }
}

pub fn resolve_attachment(note_path: &Path, vault_root: &Path, target: &str) -> Option<PathBuf> {
    let target = target.trim().trim_matches(['<', '>']);
    if target.is_empty()
        || target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("data:")
    {
        return None;
    }

    let target = target.split(['#', '?']).next().unwrap_or(target).trim();
    let relative = Path::new(target);
    if relative.is_absolute() {
        return None;
    }
    let parent = note_path.parent()?;
    let candidates = [parent.join(relative), vault_root.join(relative)];
    for candidate in candidates {
        let Ok(canonical) = fs::canonicalize(candidate) else {
            continue;
        };
        if !canonical.starts_with(vault_root) || !canonical.is_file() {
            continue;
        }
        let supported = canonical
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                extension.eq_ignore_ascii_case("png")
                    || extension.eq_ignore_ascii_case("jpg")
                    || extension.eq_ignore_ascii_case("jpeg")
            });
        if supported {
            return Some(canonical);
        }
    }
    None
}

fn decode_image(path: &Path) -> Result<ColorImage, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("Could not read image: {error}"))?;
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err("Image is larger than the 20 MB preview limit.".to_string());
    }
    let bytes = fs::read(path).map_err(|error| format!("Could not read image: {error}"))?;
    let reader = image::ImageReader::new(std::io::Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|error| format!("Could not identify image format: {error}"))?;
    let (width, height) = reader
        .into_dimensions()
        .map_err(|error| format!("Could not read image dimensions: {error}"))?;
    if u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
        return Err("Image exceeds the 12 megapixel preview limit.".to_string());
    }

    let decoded = image::load_from_memory(&bytes)
        .map_err(|error| format!("Could not decode image: {error}"))?;
    let image = decoded.thumbnail(1600, 1200).to_rgba8();
    let size = [image.width() as usize, image.height() as usize];
    Ok(ColorImage::from_rgba_unmultiplied(size, image.as_raw()))
}
