use crate::vault::{NoteItem, Vault};
use std::fs::File;
use std::io::{BufRead, BufReader};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedWikilink {
    pub raw: String,
    pub target: String,
    pub heading: Option<String>,
    pub display: String,
}

/// Parses a wikilink inner string (without the enclosing [[ and ]])
pub fn parse_wikilink_content(inner: &str) -> ParsedWikilink {
    let raw = inner.trim().to_string();

    let (target_part, display) = if let Some((target_str, alias_str)) = inner.split_once('|') {
        let t = target_str.trim();
        let a = alias_str.trim();
        (
            t,
            if a.is_empty() {
                t.to_string()
            } else {
                a.to_string()
            },
        )
    } else {
        let t = inner.trim();
        (t, t.to_string())
    };

    let (target, heading) = if let Some((t, h)) = target_part.split_once('#') {
        let t_clean = t.trim();
        let h_clean = h.trim();
        (t_clean.to_string(), Some(h_clean.to_string()))
    } else {
        (target_part.to_string(), None)
    };

    ParsedWikilink {
        raw,
        target,
        heading,
        display,
    }
}

/// Extract all wikilinks from text
pub fn extract_wikilinks(text: &str) -> Vec<ParsedWikilink> {
    let mut links = Vec::new();
    let mut rest = text;

    while let Some(start_idx) = rest.find("[[") {
        let after_start = &rest[start_idx + 2..];
        if let Some(end_idx) = after_start.find("]]") {
            let inner = &after_start[..end_idx];
            if !inner.contains('\n') {
                links.push(parse_wikilink_content(inner));
            }
            rest = &after_start[end_idx + 2..];
        } else {
            break;
        }
    }

    links
}

/// Resolve a wikilink target string to a NoteItem in the vault
pub fn resolve_wikilink<'a>(vault: &'a Vault, target: &str) -> Option<&'a NoteItem> {
    let clean_target = target.trim();
    if clean_target.is_empty() {
        return None;
    }

    let normalized = clean_target.replace('\\', "/");
    let target_stem = if normalized.ends_with(".md") {
        &normalized[..normalized.len() - 3]
    } else {
        &normalized
    };

    // 1. Try exact relative path match
    for note in &vault.notes {
        let note_rel_no_ext = if note.rel_path.ends_with(".md") {
            &note.rel_path[..note.rel_path.len() - 3]
        } else {
            &note.rel_path
        };
        if note_rel_no_ext.eq_ignore_ascii_case(target_stem)
            || note.rel_path.eq_ignore_ascii_case(&normalized)
        {
            return Some(note);
        }
    }

    // 2. Try match by title/file stem (case-insensitive) anywhere in the vault
    let target_filename = target_stem.rsplit('/').next().unwrap_or(target_stem);
    for note in &vault.notes {
        if note.title.eq_ignore_ascii_case(target_filename) {
            return Some(note);
        }
    }

    None
}

#[derive(Debug, Clone)]
pub struct BacklinkMatch {
    pub source_note: NoteItem,
    pub line_number: usize,
    pub snippet: String,
}

/// Finds all notes in the vault that link to the target note.
/// Streams files on-demand to avoid loading note contents into memory at startup.
pub fn find_backlinks(vault: &Vault, target_note: &NoteItem) -> Vec<BacklinkMatch> {
    let mut backlinks = Vec::new();

    let target_title = &target_note.title;
    let target_rel_no_ext = if target_note.rel_path.ends_with(".md") {
        &target_note.rel_path[..target_note.rel_path.len() - 3]
    } else {
        &target_note.rel_path
    };

    for note in &vault.notes {
        if note.abs_path == target_note.abs_path {
            continue;
        }

        let file = match File::open(&note.abs_path) {
            Ok(file) => file,
            Err(_) => continue,
        };

        for (line_idx, line) in BufReader::new(file).lines().enumerate() {
            let Ok(line) = line else {
                continue;
            };
            if !line.contains("[[") {
                continue;
            }

            let links = extract_wikilinks(&line);
            for link in links {
                let link_target = link.target.replace('\\', "/");
                let link_stem = if link_target.ends_with(".md") {
                    &link_target[..link_target.len() - 3]
                } else {
                    &link_target
                };

                let matches = link_stem.eq_ignore_ascii_case(target_title)
                    || link_stem.eq_ignore_ascii_case(target_rel_no_ext)
                    || link_stem
                        .rsplit('/')
                        .next()
                        .unwrap_or(link_stem)
                        .eq_ignore_ascii_case(target_title);

                if matches {
                    let snippet = line.trim().to_string();
                    backlinks.push(BacklinkMatch {
                        source_note: note.clone(),
                        line_number: line_idx + 1,
                        snippet,
                    });
                    break;
                }
            }
        }
    }

    backlinks
}
