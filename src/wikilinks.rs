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

pub fn rewrite_wikilinks(content: &str, old_note: &NoteItem, new_note: &NoteItem) -> String {
    let old_rel = relative_stem(&old_note.rel_path);
    let new_rel = relative_stem(&new_note.rel_path);
    let mut output = String::with_capacity(content.len());
    let mut fence = None;
    for line in content.split_inclusive(char::from(10)) {
        let trimmed = line.trim_start();
        if let Some(delimiter) = fence {
            if is_code_fence(trimmed, delimiter) {
                fence = None;
            }
            output.push_str(line);
            continue;
        }
        if is_code_fence(trimmed, char::from(96)) {
            fence = Some(char::from(96));
            output.push_str(line);
            continue;
        }
        if is_code_fence(trimmed, '~') {
            fence = Some('~');
            output.push_str(line);
            continue;
        }
        let mut index = 0;
        let mut inline_code = false;
        while index < line.len() {
            let rest = &line[index..];
            let byte = rest.as_bytes()[0];
            if byte == 96 {
                inline_code = !inline_code;
                output.push(char::from(byte));
                index += 1;
                continue;
            }
            if !inline_code && rest.starts_with("[[") {
                if let Some(end) = rest[2..].find("]]") {
                    let inner_end = index + 2 + end;
                    let inner = &line[index + 2..inner_end];
                    output.push_str("[[");
                    if let Some(rewritten) =
                        rewrite_wikilink_target(inner, old_note, new_note, old_rel, new_rel)
                    {
                        output.push_str(&rewritten);
                    } else {
                        output.push_str(inner);
                    }
                    output.push_str("]]");
                    index = inner_end + 2;
                    continue;
                }
            }
            let character = rest.chars().next().unwrap();
            output.push(character);
            index += character.len_utf8();
        }
    }
    output
}

fn is_code_fence(line: &str, delimiter: char) -> bool {
    line.as_bytes().starts_with(&[delimiter as u8; 3])
}

fn rewrite_wikilink_target(
    inner: &str,
    old_note: &NoteItem,
    new_note: &NoteItem,
    old_rel: &str,
    new_rel: &str,
) -> Option<String> {
    let alias_start = inner.find('|').unwrap_or(inner.len());
    let target = &inner[..alias_start];
    let anchor_start = target.find('#').unwrap_or(target.len());
    let base = target[..anchor_start].trim();
    if base.is_empty() {
        return None;
    }
    let normalized = base.replace(char::from(92), "/");
    let extensionless = relative_stem(&normalized);
    let matches = extensionless.eq_ignore_ascii_case(&old_note.title)
        || extensionless.eq_ignore_ascii_case(old_rel)
        || normalized.eq_ignore_ascii_case(&old_note.rel_path);
    if !matches {
        return None;
    }
    let replacement = if extensionless.contains('/') {
        new_rel
    } else {
        &new_note.title
    };
    Some(format!(
        "{}{}{}",
        replacement,
        &target[anchor_start..],
        &inner[alias_start..]
    ))
}

fn relative_stem(path: &str) -> &str {
    let Some((stem, extension)) = path.rsplit_once('.') else {
        return path;
    };
    if extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("markdown") {
        stem
    } else {
        path
    }
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
