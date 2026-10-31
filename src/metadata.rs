use crate::vault::NoteItem;
use std::collections::{BTreeMap, BTreeSet};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver};
use std::thread;

#[derive(Debug, Clone, Default)]
pub struct NoteMetadata {
    pub properties: Vec<(String, String)>,
    pub frontmatter_tags: Vec<String>,
    pub tags: Vec<String>,
    pub body: String,
}

pub fn parse_note(content: &str) -> NoteMetadata {
    let mut metadata = NoteMetadata::default();
    let mut lines = content.lines();
    let first = lines
        .next()
        .unwrap_or_default()
        .trim_start_matches('\u{feff}')
        .trim();
    if first == "---" {
        let mut properties = BTreeMap::<String, String>::new();
        let mut tags = BTreeSet::new();
        let mut current_key: Option<String> = None;
        let mut closed = false;
        for line in lines.by_ref() {
            let trimmed = line.trim();
            if trimmed == "---" || trimmed == "..." {
                closed = true;
                break;
            }
            if let Some(item) = trimmed.strip_prefix("- ") {
                if current_key
                    .as_deref()
                    .is_some_and(|key| key.eq_ignore_ascii_case("tags"))
                {
                    insert_tags(item, &mut tags);
                }
                continue;
            }
            let Some((key, value)) = line.split_once(':') else {
                current_key = None;
                continue;
            };
            let key = key.trim();
            if key.is_empty() || key.starts_with('#') {
                current_key = None;
                continue;
            }
            let value = value.trim();
            current_key = Some(key.to_string());
            if key.eq_ignore_ascii_case("tags") {
                insert_tags(value, &mut tags);
            } else {
                let value = clean_scalar(value);
                if !value.is_empty() {
                    properties.insert(key.to_string(), value);
                }
            }
        }
        if closed {
            metadata.properties = properties.into_iter().collect();
            metadata.frontmatter_tags = tags.into_iter().collect();
            metadata.tags = metadata.frontmatter_tags.clone();
            metadata.body = lines.collect::<Vec<_>>().join("\n");
        } else {
            metadata.body = content.to_string();
        }
    } else {
        metadata.body = content.to_string();
    }
    for line in metadata
        .body
        .lines()
        .filter(|line| !line.trim_start().starts_with("# "))
    {
        for word in line.split_whitespace() {
            let candidate = word.trim_matches(|c: char| {
                matches!(
                    c,
                    '(' | ')' | '[' | ']' | '{' | '}' | ',' | '.' | '!' | '?' | '"' | '\''
                )
            });
            if let Some(tag) = candidate.strip_prefix('#') {
                if !tag.is_empty()
                    && tag
                        .chars()
                        .all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '/'))
                {
                    metadata.tags.push(tag.to_string());
                }
            }
        }
    }
    metadata.tags.sort_by_key(|tag| tag.to_lowercase());
    metadata.tags.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
    metadata
}

pub fn extract_headings(content: &str) -> Vec<(u8, String, usize)> {
    let mut headings = Vec::new();
    let mut in_frontmatter = false;
    let mut frontmatter_done = false;
    let mut char_offset = 0;
    for (line_index, line) in content.lines().enumerate() {
        let trimmed = line.trim_start_matches('\u{feff}').trim();
        if line_index == 0 && trimmed == "---" {
            in_frontmatter = true;
        } else if in_frontmatter && (trimmed == "---" || trimmed == "...") {
            in_frontmatter = false;
            frontmatter_done = true;
        } else if !in_frontmatter && (frontmatter_done || line_index == 0) {
            let stripped = line.trim_start();
            let level = stripped.chars().take_while(|c| *c == '#').count();
            if (1..=6).contains(&level) && stripped[level..].starts_with(' ') {
                let title = stripped[level..]
                    .trim()
                    .trim_end_matches('#')
                    .trim()
                    .to_string();
                headings.push((level as u8, title, char_offset));
            }
        }
        char_offset += line.chars().count() + 1;
    }
    headings
}

pub fn set_frontmatter_property(content: &str, key: &str, value: Option<&str>) -> Option<String> {
    let key = key.trim();
    if key.is_empty()
        || !key
            .chars()
            .all(|c| c.is_alphanumeric() || matches!(c, '_' | '-'))
    {
        return None;
    }
    let mut lines: Vec<String> = content.lines().map(str::to_string).collect();
    let has_frontmatter = lines
        .first()
        .is_some_and(|line| line.trim_start_matches('\u{feff}').trim() == "---")
        && lines
            .iter()
            .skip(1)
            .any(|line| line.trim() == "---" || line.trim() == "...");
    if !has_frontmatter {
        if value.is_none() {
            return Some(content.to_string());
        }
        let mut result = String::from("---\n");
        if let Some(value) = value {
            result.push_str(&format!("{}\n", property_line(key, value)));
        }
        result.push_str("---\n");
        result.push_str(content);
        return Some(result);
    }
    let close = lines
        .iter()
        .enumerate()
        .skip(1)
        .find(|(_, line)| line.trim() == "---" || line.trim() == "...")?
        .0;
    let existing = (1..close).find(|index| {
        let line = &lines[*index];
        !line.starts_with([' ', '\t'])
            && line
                .split_once(':')
                .is_some_and(|(candidate, _)| candidate.trim() == key)
    });
    match (existing, value) {
        (Some(index), Some(value)) => lines[index] = property_line(key, value),
        (Some(index), None) => {
            lines.remove(index);
        }
        (None, Some(value)) => lines.insert(close, property_line(key, value)),
        (None, None) => {}
    }
    Some(lines.join("\n"))
}

fn property_line(key: &str, value: &str) -> String {
    if key.eq_ignore_ascii_case("tags") {
        let values = value
            .split(',')
            .map(str::trim)
            .filter(|tag| !tag.is_empty())
            .map(|tag| quote_yaml(tag.trim_start_matches('#')))
            .collect::<Vec<_>>()
            .join(", ");
        format!("{key}: [{values}]")
    } else {
        format!("{key}: {}", quote_yaml(value))
    }
}

fn quote_yaml(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
    )
}

fn clean_scalar(value: &str) -> String {
    let value = value.split(" #").next().unwrap_or(value).trim();
    if value.starts_with('[') && value.ends_with(']') {
        return value[1..value.len() - 1].trim().to_string();
    }
    value.trim_matches(['\'', '"']).to_string()
}

fn insert_tags(value: &str, tags: &mut BTreeSet<String>) {
    for value in value.trim().trim_matches(['[', ']']).split(',') {
        let tag = value
            .trim()
            .trim_matches(['\'', '"'])
            .trim_start_matches('#');
        if !tag.is_empty() {
            tags.insert(tag.to_string());
        }
    }
}

pub struct TagExplorer {
    root: Option<PathBuf>,
    receiver: Option<Receiver<BTreeMap<String, Vec<crate::vault::NoteItem>>>>,
    pub tags: BTreeMap<String, Vec<crate::vault::NoteItem>>,
    loaded: bool,
}

impl Default for TagExplorer {
    fn default() -> Self {
        Self {
            root: None,
            receiver: None,
            tags: BTreeMap::new(),
            loaded: false,
        }
    }
}

impl TagExplorer {
    pub fn invalidate(&mut self) {
        self.root = None;
        self.tags.clear();
        self.loaded = false;
    }
    pub fn poll(&mut self, root: &PathBuf, notes: &[NoteItem]) -> bool {
        if self.root.as_ref() != Some(root) {
            self.root = Some(root.clone());
            self.tags.clear();
            self.receiver = None;
            self.loaded = false;
        }
        if let Some(receiver) = &self.receiver {
            if let Ok(tags) = receiver.try_recv() {
                self.tags = tags;
                self.receiver = None;
                self.loaded = true;
                return true;
            }
        }
        if self.receiver.is_none() && !self.loaded {
            let (tx, rx) = mpsc::channel();
            let notes = notes.to_vec();
            thread::spawn(move || {
                let mut tags = BTreeMap::<String, Vec<NoteItem>>::new();
                for note in notes {
                    if let Ok(file) = File::open(&note.abs_path) {
                        let mut inside = false;
                        let mut tags_list = false;
                        for (index, line) in BufReader::new(file).lines().enumerate() {
                            let Ok(line) = line else {
                                break;
                            };
                            let trimmed = line.trim();
                            if index == 0 && trimmed == "---" {
                                inside = true;
                                continue;
                            }
                            if inside {
                                if trimmed == "---" || trimmed == "..." {
                                    inside = false;
                                    tags_list = false;
                                    continue;
                                }
                                if let Some((key, value)) = trimmed.split_once(':') {
                                    tags_list = key.trim().eq_ignore_ascii_case("tags");
                                    if tags_list {
                                        let mut parsed = BTreeSet::new();
                                        insert_tags(value, &mut parsed);
                                        for tag in parsed {
                                            tags.entry(tag).or_default().push(note.clone());
                                        }
                                    }
                                } else if tags_list {
                                    if let Some(value) = trimmed.strip_prefix("- ") {
                                        let mut parsed = BTreeSet::new();
                                        insert_tags(value, &mut parsed);
                                        for tag in parsed {
                                            tags.entry(tag).or_default().push(note.clone());
                                        }
                                    } else if !trimmed.is_empty() {
                                        tags_list = false;
                                    }
                                }
                            } else if !trimmed.starts_with("# ") {
                                for word in trimmed.split_whitespace() {
                                    let tag = word.trim_matches(|c: char| {
                                        matches!(
                                            c,
                                            '(' | ')'
                                                | '['
                                                | ']'
                                                | '{'
                                                | '}'
                                                | ','
                                                | '.'
                                                | '!'
                                                | '?'
                                                | '"'
                                                | '\''
                                        )
                                    });
                                    if let Some(tag) = tag.strip_prefix('#') {
                                        if !tag.is_empty() {
                                            tags.entry(tag.to_string())
                                                .or_default()
                                                .push(note.clone());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                for notes in tags.values_mut() {
                    notes.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));
                    notes.dedup_by(|a, b| a.abs_path == b.abs_path);
                }
                let _ = tx.send(tags);
            });
            self.receiver = Some(rx);
        }
        false
    }
    pub fn is_loading(&self) -> bool {
        self.receiver.is_some()
    }
}
