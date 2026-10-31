use super::attachments::{resolve_attachment, AttachmentCache, ImageStatus};
use super::embeds::{EmbedLoad, NoteEmbedCache};
use super::theme::Theme;
use crate::vault::Vault;
use egui::{Color32, Margin, RichText, Rounding, Stroke};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub enum MarkdownAction {
    OpenWikilink(String),
    OpenHeadingWikilink { target: String, heading: String },
    OpenUrl(String),
    ToggleTask(usize),
}

#[derive(Debug, Clone, PartialEq)]
pub enum InlineSpan {
    Text(String),
    Bold(String),
    Italic(String),
    Code(String),
    Strikethrough(String),
    FootnoteRef(String),
    InlineMath(String),
    Wikilink {
        target: String,
        display: String,
        heading: Option<String>,
    },
    Url {
        text: String,
        url: String,
    },
    Image {
        alt: String,
        target: String,
    },
    NoteEmbed {
        target: String,
        heading: Option<String>,
    },
}

pub struct MarkdownRenderContext<'a> {
    note_path: PathBuf,
    vault_root: &'a Path,
    vault: &'a Vault,
    attachments: &'a mut AttachmentCache,
    note_embeds: &'a mut NoteEmbedCache,
    embed_depth: usize,
    embed_stack: Vec<PathBuf>,
    tasks_interactive: bool,
}

fn is_supported_image_target(target: &str) -> bool {
    let path = target
        .trim()
        .trim_matches(['<', '>'])
        .split(['#', '?'])
        .next()
        .unwrap_or_default();
    Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("png")
                || extension.eq_ignore_ascii_case("jpg")
                || extension.eq_ignore_ascii_case("jpeg")
        })
}

pub fn parse_inline_spans(input: &str) -> Vec<InlineSpan> {
    let mut spans = Vec::new();
    let mut current_text = String::new();

    let flush_text = |spans: &mut Vec<InlineSpan>, text: &mut String| {
        if !text.is_empty() {
            spans.push(InlineSpan::Text(std::mem::take(text)));
        }
    };

    let mut remaining = input;

    while !remaining.is_empty() {
        // 1. Obsidian image embed ![[image.png]]
        if remaining.starts_with("![[") {
            if let Some(end) = remaining[3..].find("]]") {
                let parsed = crate::wikilinks::parse_wikilink_content(&remaining[3..3 + end]);
                if is_supported_image_target(&parsed.target) {
                    flush_text(&mut spans, &mut current_text);
                    spans.push(InlineSpan::Image {
                        alt: parsed.display,
                        target: parsed.target,
                    });
                    remaining = &remaining[3 + end + 2..];
                    continue;
                } else {
                    flush_text(&mut spans, &mut current_text);
                    spans.push(InlineSpan::NoteEmbed {
                        target: parsed.target,
                        heading: parsed.heading,
                    });
                    remaining = &remaining[3 + end + 2..];
                    continue;
                }
            }
        }

        // 2. Markdown image ![alt](image.png)
        if remaining.starts_with("![") {
            if let Some(alt_end) = remaining[2..].find("](") {
                let alt = &remaining[2..2 + alt_end];
                let after_alt = &remaining[2 + alt_end + 2..];
                if let Some(target_end) = after_alt.find(')') {
                    let target = after_alt[..target_end]
                        .split_whitespace()
                        .next()
                        .unwrap_or_default()
                        .trim_matches(['<', '>']);
                    if is_supported_image_target(target) {
                        flush_text(&mut spans, &mut current_text);
                        spans.push(InlineSpan::Image {
                            alt: alt.to_string(),
                            target: target.to_string(),
                        });
                        remaining = &after_alt[target_end + 1..];
                        continue;
                    }
                }
            }
        }

        // 3. Wikilink [[...]]
        if remaining.starts_with("[[") {
            if let Some(end) = remaining[2..].find("]]") {
                let inner = &remaining[2..2 + end];
                if !inner.contains('\n') {
                    flush_text(&mut spans, &mut current_text);
                    let parsed = crate::wikilinks::parse_wikilink_content(inner);
                    spans.push(InlineSpan::Wikilink {
                        target: parsed.target,
                        display: parsed.display,
                        heading: parsed.heading,
                    });
                    remaining = &remaining[2 + end + 2..];
                    continue;
                }
            }
        }

        // Footnote reference [^label]
        if remaining.starts_with("[^") {
            if let Some(end) = remaining[2..].find(']') {
                let label = &remaining[2..2 + end];
                if !label.is_empty() && !label.contains('\n') && !label.contains(' ') {
                    flush_text(&mut spans, &mut current_text);
                    spans.push(InlineSpan::FootnoteRef(label.to_string()));
                    remaining = &remaining[2 + end + 1..];
                    continue;
                }
            }
        }

        // Inline math $...$
        if remaining.starts_with('$') && !remaining.starts_with("$$") {
            if let Some(end) = remaining[1..].find('$') {
                let math = &remaining[1..1 + end];
                if !math.is_empty()
                    && !math.contains('\n')
                    && !math.starts_with(' ')
                    && !math.ends_with(' ')
                {
                    flush_text(&mut spans, &mut current_text);
                    spans.push(InlineSpan::InlineMath(math.to_string()));
                    remaining = &remaining[1 + end + 1..];
                    continue;
                }
            }
        }

        // 4. Markdown link [text](url)
        if remaining.starts_with('[') {
            if let Some(bracket_end) = remaining[1..].find(']') {
                let text_inside = &remaining[1..1 + bracket_end];
                let after_bracket = &remaining[1 + bracket_end + 1..];
                if after_bracket.starts_with('(') {
                    if let Some(paren_end) = after_bracket[1..].find(')') {
                        let url_inside = &after_bracket[1..1 + paren_end];
                        flush_text(&mut spans, &mut current_text);
                        spans.push(InlineSpan::Url {
                            text: text_inside.to_string(),
                            url: url_inside.to_string(),
                        });
                        remaining = &after_bracket[1 + paren_end + 1..];
                        continue;
                    }
                }
            }
        }

        // 5. Inline code `...`
        if remaining.starts_with('`') {
            if let Some(end) = remaining[1..].find('`') {
                let code_text = &remaining[1..1 + end];
                flush_text(&mut spans, &mut current_text);
                spans.push(InlineSpan::Code(code_text.to_string()));
                remaining = &remaining[1 + end + 1..];
                continue;
            }
        }

        // 6. Bold **...** or __...__
        if remaining.starts_with("**") || remaining.starts_with("__") {
            let delim = &remaining[..2];
            if let Some(end) = remaining[2..].find(delim) {
                let bold_text = &remaining[2..2 + end];
                flush_text(&mut spans, &mut current_text);
                spans.push(InlineSpan::Bold(bold_text.to_string()));
                remaining = &remaining[2 + end + 2..];
                continue;
            }
        }

        // 7. Strikethrough ~~...~~
        if remaining.starts_with("~~") {
            if let Some(end) = remaining[2..].find("~~") {
                let strike_text = &remaining[2..2 + end];
                flush_text(&mut spans, &mut current_text);
                spans.push(InlineSpan::Strikethrough(strike_text.to_string()));
                remaining = &remaining[2 + end + 2..];
                continue;
            }
        }

        // 8. Italic *...* or _..._
        if remaining.starts_with('*') || remaining.starts_with('_') {
            let delim = &remaining[..1];
            if let Some(end) = remaining[1..].find(delim) {
                let italic_text = &remaining[1..1 + end];
                if !italic_text.is_empty() {
                    flush_text(&mut spans, &mut current_text);
                    spans.push(InlineSpan::Italic(italic_text.to_string()));
                    remaining = &remaining[1 + end + 1..];
                    continue;
                }
            }
        }

        // 9. Consume normal character
        if let Some(c) = remaining.chars().next() {
            current_text.push(c);
            remaining = &remaining[c.len_utf8()..];
        } else {
            break;
        }
    }

    flush_text(&mut spans, &mut current_text);
    spans
}

pub fn render_single_span(
    ui: &mut egui::Ui,
    span: &InlineSpan,
    action: &mut Option<MarkdownAction>,
    is_task_checked: bool,
    context: &mut MarkdownRenderContext<'_>,
) {
    match span {
        InlineSpan::Text(t) => {
            let mut rt = RichText::new(t);
            if is_task_checked {
                rt = rt.strikethrough().color(Theme::TEXT_MUTED);
            } else {
                rt = rt.color(Theme::TEXT_PRIMARY);
            }
            ui.label(rt);
        }
        InlineSpan::Bold(t) => {
            let mut rt = RichText::new(t).strong();
            if is_task_checked {
                rt = rt.strikethrough().color(Theme::TEXT_MUTED);
            } else {
                rt = rt.color(Theme::TEXT_PRIMARY);
            }
            ui.label(rt);
        }
        InlineSpan::Italic(t) => {
            let mut rt = RichText::new(t).italics();
            if is_task_checked {
                rt = rt.strikethrough().color(Theme::TEXT_MUTED);
            } else {
                rt = rt.color(Theme::TEXT_PRIMARY);
            }
            ui.label(rt);
        }
        InlineSpan::Code(t) => {
            egui::Frame::none()
                .fill(Theme::BG_CODE)
                .rounding(Rounding::same(3.0))
                .inner_margin(Margin::symmetric(4.0, 1.0))
                .show(ui, |ui| {
                    ui.label(
                        RichText::new(t)
                            .monospace()
                            .color(Color32::from_rgb(220, 160, 220)),
                    );
                });
        }
        InlineSpan::Strikethrough(t) => {
            ui.label(RichText::new(t).strikethrough().color(Theme::TEXT_MUTED));
        }
        InlineSpan::FootnoteRef(label) => {
            let resp = ui.add(egui::Link::new(
                RichText::new(format!("[^{label}]"))
                    .size(10.5)
                    .color(Theme::ACCENT_BLUE),
            ));
            if resp.hovered() {
                resp.on_hover_text(format!("Footnote [^{label}]"));
            }
        }
        InlineSpan::InlineMath(formula) => {
            let formatted = format_latex_math(formula);
            egui::Frame::none()
                .fill(Color32::from_rgb(28, 24, 38))
                .rounding(Rounding::same(3.0))
                .inner_margin(Margin::symmetric(4.0, 1.0))
                .show(ui, |ui| {
                    ui.label(
                        RichText::new(formatted)
                            .italics()
                            .color(Theme::ACCENT_PURPLE),
                    );
                });
        }
        InlineSpan::Wikilink {
            target,
            display,
            heading,
        } => {
            let resp = ui.add(egui::Link::new(
                RichText::new(display).color(Theme::ACCENT_BLUE).underline(),
            ));
            if resp.clicked() {
                *action = Some(match heading {
                    Some(heading) => MarkdownAction::OpenHeadingWikilink {
                        target: target.clone(),
                        heading: heading.clone(),
                    },
                    None => MarkdownAction::OpenWikilink(target.clone()),
                });
            }
            if resp.hovered() {
                resp.on_hover_text(format!("Open note: [[{}]]", target));
            }
        }
        InlineSpan::Url { text, url } => {
            let resp = ui.add(egui::Link::new(
                RichText::new(text).color(Theme::ACCENT_BLUE).underline(),
            ));
            if resp.clicked() {
                *action = Some(MarkdownAction::OpenUrl(url.clone()));
            }
            if resp.hovered() {
                resp.on_hover_text(url);
            }
        }
        InlineSpan::Image { alt, target } => {
            render_image(ui, alt, target, context, 320.0);
        }
        InlineSpan::NoteEmbed { target, heading } => {
            render_note_embed(ui, target, heading.as_deref(), action, context);
        }
    }
}

pub fn render_inline_spans(
    ui: &mut egui::Ui,
    spans: &[InlineSpan],
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    ui.horizontal_wrapped(|ui| {
        ui.spacing_mut().item_spacing.x = 4.0;
        for span in spans {
            render_single_span(ui, span, action, false, context);
        }
    });
}

#[derive(Debug, Clone)]
pub enum MarkdownBlock {
    Properties {
        values: Vec<(String, String)>,
        tags: Vec<String>,
    },
    Heading {
        level: u8,
        text: String,
    },
    Image {
        alt: String,
        target: String,
    },
    CodeBlock {
        lang: String,
        content: String,
    },
    MathBlock(String),
    FootnoteDefinition {
        label: String,
        content: String,
    },
    Blockquote(Vec<String>),
    Callout {
        kind: String,
        title: String,
        lines: Vec<String>,
        foldable: bool,
        collapsed: bool,
    },
    UnorderedList(Vec<String>),
    OrderedList(Vec<(usize, String)>),
    TaskList(Vec<(bool, String)>),
    Table {
        headers: Vec<String>,
        alignments: Vec<TableAlignment>,
        rows: Vec<Vec<String>>,
    },
    HorizontalRule,
    Paragraph(String),
}

#[derive(Debug, Clone, Copy)]
pub enum TableAlignment {
    Left,
    Center,
    Right,
}

fn is_task_list_item(s: &str) -> bool {
    let lower = s.to_lowercase();
    lower.starts_with("- [ ] ")
        || lower.starts_with("- [x] ")
        || lower.starts_with("* [ ] ")
        || lower.starts_with("* [x] ")
}

fn parse_task_list_item(s: &str) -> (bool, String) {
    let lower = s.to_lowercase();
    let checked = lower.starts_with("- [x] ") || lower.starts_with("* [x] ");
    let text = s[6..].trim().to_string();
    (checked, text)
}

fn is_unordered_list_item(s: &str) -> bool {
    (s.starts_with("- ") || s.starts_with("* ") || s.starts_with("+ ")) && !is_task_list_item(s)
}

fn extract_unordered_item_text(s: &str) -> String {
    s[2..].trim().to_string()
}

fn is_ordered_list_item(s: &str) -> bool {
    if let Some((num_part, _rest)) = s.split_once(". ") {
        !num_part.is_empty() && num_part.chars().all(|c| c.is_ascii_digit())
    } else {
        false
    }
}

fn extract_ordered_item(s: &str) -> (usize, String) {
    if let Some((num_part, rest)) = s.split_once(". ") {
        let num = num_part.parse::<usize>().unwrap_or(1);
        (num, rest.trim().to_string())
    } else {
        (1, s.to_string())
    }
}

fn parse_standalone_image(line: &str) -> Option<(String, String)> {
    if let Some(inner) = line.strip_prefix("![[") {
        if let Some(inner) = inner.strip_suffix("]]") {
            let parsed = crate::wikilinks::parse_wikilink_content(inner);
            return Some((parsed.display, parsed.target));
        }
    }

    let inner = line.strip_prefix("![")?;
    let close_alt = inner.find("](")?;
    let alt = inner[..close_alt].to_string();
    let target = inner[close_alt + 2..]
        .strip_suffix(')')?
        .split_whitespace()
        .next()?
        .trim_matches(['<', '>'])
        .to_string();
    Some((alt, target))
}

fn parse_table_row(line: &str) -> Option<Vec<String>> {
    if !line.contains('|') {
        return None;
    }
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut escaped = false;
    let mut in_code = false;
    let mut in_wikilink = false;
    let chars: Vec<char> = line.trim().chars().collect();
    for (index, ch) in chars.iter().copied().enumerate() {
        if escaped {
            current.push(ch);
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else if ch == '`' {
            in_code = !in_code;
            current.push(ch);
        } else if ch == '[' && chars.get(index + 1) == Some(&'[') {
            in_wikilink = true;
            current.push(ch);
        } else if ch == ']' && chars.get(index + 1) == Some(&']') {
            in_wikilink = false;
            current.push(ch);
        } else if ch == '|' && !in_code && !in_wikilink {
            if index != 0 {
                cells.push(current.trim().to_string());
            }
            current.clear();
        } else {
            current.push(ch);
        }
    }
    if !current.trim().is_empty() || !line.trim().ends_with('|') {
        cells.push(current.trim().to_string());
    }
    (!cells.is_empty()).then_some(cells)
}

fn parse_table_delimiter(line: &str, columns: usize) -> Option<Vec<TableAlignment>> {
    let cells = parse_table_row(line)?;
    if cells.len() != columns {
        return None;
    }
    cells
        .iter()
        .map(|cell| {
            let value = cell.trim();
            if value.len() < 3
                || !value.contains('-')
                || !value.chars().all(|c| c == '-' || c == ':')
            {
                return None;
            }
            Some(match (value.starts_with(':'), value.ends_with(':')) {
                (true, true) => TableAlignment::Center,
                (false, true) => TableAlignment::Right,
                _ => TableAlignment::Left,
            })
        })
        .collect()
}

pub fn parse_markdown_blocks(content: &str) -> Vec<MarkdownBlock> {
    let mut blocks = Vec::new();
    let metadata = crate::metadata::parse_note(content);
    if !metadata.properties.is_empty() || !metadata.tags.is_empty() {
        blocks.push(MarkdownBlock::Properties {
            values: metadata.properties,
            tags: metadata.tags,
        });
    }
    let mut lines = metadata.body.lines().peekable();

    while let Some(line) = lines.next() {
        let trimmed = line.trim();

        // 1. Code blocks: ```
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            let fence = &trimmed[..3];
            let lang = trimmed[3..].trim().to_string();
            let mut code_lines = Vec::new();
            while let Some(next_line) = lines.next() {
                if next_line.trim().starts_with(fence) {
                    break;
                }
                code_lines.push(next_line);
            }
            blocks.push(MarkdownBlock::CodeBlock {
                lang,
                content: code_lines.join("\n"),
            });
            continue;
        }

        // Math blocks: $$
        if trimmed.starts_with("$$") {
            if trimmed.len() > 4 && trimmed[2..].ends_with("$$") {
                let math = trimmed[2..trimmed.len() - 2].trim().to_string();
                blocks.push(MarkdownBlock::MathBlock(math));
                continue;
            } else {
                let mut math_lines = Vec::new();
                let initial = trimmed[2..].trim();
                if !initial.is_empty() {
                    math_lines.push(initial.to_string());
                }
                while let Some(next_line) = lines.next() {
                    let next_trimmed = next_line.trim();
                    if next_trimmed.ends_with("$$") {
                        let ending = next_trimmed.trim_end_matches('$').trim();
                        if !ending.is_empty() {
                            math_lines.push(ending.to_string());
                        }
                        break;
                    }
                    math_lines.push(next_line.to_string());
                }
                blocks.push(MarkdownBlock::MathBlock(math_lines.join("\n")));
                continue;
            }
        }

        // Footnote definitions: [^label]: ...
        if trimmed.starts_with("[^") {
            if let Some(close_bracket) = trimmed[2..].find("]:") {
                let label = trimmed[2..2 + close_bracket].trim().to_string();
                let rest = trimmed[2 + close_bracket + 2..].trim().to_string();
                let mut content_lines = vec![rest];
                while let Some(&next_line) = lines.peek() {
                    if next_line.starts_with("    ") || next_line.starts_with("\t") {
                        lines.next();
                        content_lines.push(next_line.trim().to_string());
                    } else {
                        break;
                    }
                }
                blocks.push(MarkdownBlock::FootnoteDefinition {
                    label,
                    content: content_lines.join(" "),
                });
                continue;
            }
        }

        // 2. Empty lines
        if trimmed.is_empty() {
            continue;
        }

        // 3. Horizontal rules
        if trimmed == "---" || trimmed == "***" || trimmed == "___" {
            blocks.push(MarkdownBlock::HorizontalRule);
            continue;
        }

        // 4. Headings: #, ##, etc.
        if trimmed.starts_with('#') {
            let hash_count = trimmed.chars().take_while(|&c| c == '#').count();
            if hash_count <= 6 && trimmed[hash_count..].starts_with(' ') {
                let heading_text = trimmed[hash_count..].trim().to_string();
                blocks.push(MarkdownBlock::Heading {
                    level: hash_count as u8,
                    text: heading_text,
                });
                continue;
            }
        }

        if let Some((alt, target)) = parse_standalone_image(trimmed) {
            blocks.push(MarkdownBlock::Image { alt, target });
            continue;
        }

        // GFM tables: header row, alignment delimiter, then pipe separated rows.
        if let Some(headers) = parse_table_row(trimmed) {
            if let Some(delimiter) = lines
                .peek()
                .and_then(|next| parse_table_delimiter(next.trim(), headers.len()))
            {
                lines.next();
                let mut rows = Vec::new();
                while let Some(next_line) = lines.peek() {
                    let next = next_line.trim();
                    if next.is_empty() {
                        break;
                    }
                    let Some(mut row) = parse_table_row(next) else {
                        break;
                    };
                    lines.next();
                    row.resize(headers.len(), String::new());
                    row.truncate(headers.len());
                    rows.push(row);
                }
                blocks.push(MarkdownBlock::Table {
                    headers,
                    alignments: delimiter,
                    rows,
                });
                continue;
            }
        }

        // 5. Blockquotes: >
        if trimmed.starts_with('>') {
            let mut quote_lines = vec![trimmed.trim_start_matches('>').trim().to_string()];
            while let Some(&next_line) = lines.peek() {
                let next_trimmed = next_line.trim();
                if next_trimmed.starts_with('>') {
                    lines.next();
                    quote_lines.push(next_trimmed.trim_start_matches('>').trim().to_string());
                } else {
                    break;
                }
            }
            if let Some((kind, title, foldable, collapsed)) = parse_callout_title(&quote_lines[0]) {
                blocks.push(MarkdownBlock::Callout {
                    kind,
                    title,
                    lines: quote_lines.into_iter().skip(1).collect(),
                    foldable,
                    collapsed,
                });
            } else {
                blocks.push(MarkdownBlock::Blockquote(quote_lines));
            }
            continue;
        }

        // 6. Task lists: - [ ] or - [x]
        if is_task_list_item(trimmed) {
            let mut items = vec![parse_task_list_item(trimmed)];
            while let Some(&next_line) = lines.peek() {
                let next_trimmed = next_line.trim();
                if is_task_list_item(next_trimmed) {
                    lines.next();
                    items.push(parse_task_list_item(next_trimmed));
                } else {
                    break;
                }
            }
            blocks.push(MarkdownBlock::TaskList(items));
            continue;
        }

        // 7. Unordered list: - , * , +
        if is_unordered_list_item(trimmed) {
            let mut items = vec![extract_unordered_item_text(trimmed)];
            while let Some(&next_line) = lines.peek() {
                let next_trimmed = next_line.trim();
                if is_task_list_item(next_trimmed) {
                    break;
                }
                if is_unordered_list_item(next_trimmed) {
                    lines.next();
                    items.push(extract_unordered_item_text(next_trimmed));
                } else {
                    break;
                }
            }
            blocks.push(MarkdownBlock::UnorderedList(items));
            continue;
        }

        // 8. Ordered list: 1. , 2.
        if is_ordered_list_item(trimmed) {
            let mut items = vec![extract_ordered_item(trimmed)];
            while let Some(&next_line) = lines.peek() {
                let next_trimmed = next_line.trim();
                if is_ordered_list_item(next_trimmed) {
                    lines.next();
                    items.push(extract_ordered_item(next_trimmed));
                } else {
                    break;
                }
            }
            blocks.push(MarkdownBlock::OrderedList(items));
            continue;
        }

        // 9. Normal paragraph
        let mut para_lines = vec![line.trim().to_string()];
        while let Some(&next_line) = lines.peek() {
            let next_trimmed = next_line.trim();
            if next_trimmed.is_empty()
                || next_trimmed.contains('|')
                || next_trimmed.starts_with('#')
                || next_trimmed.starts_with('>')
                || next_trimmed.starts_with("```")
                || next_trimmed.starts_with("~~~")
                || next_trimmed == "---"
                || next_trimmed.starts_with("$$")
                || next_trimmed.starts_with("[^")
                || is_task_list_item(next_trimmed)
                || is_unordered_list_item(next_trimmed)
                || is_ordered_list_item(next_trimmed)
            {
                break;
            }
            lines.next();
            para_lines.push(next_trimmed.to_string());
        }
        blocks.push(MarkdownBlock::Paragraph(para_lines.join(" ")));
    }

    blocks
}

fn parse_callout_title(line: &str) -> Option<(String, String, bool, bool)> {
    let trimmed = line.trim();
    let value = trimmed.strip_prefix("[!")?;
    let end = value.find(']')?;
    let kind = value[..end].trim().to_lowercase();
    if kind.is_empty() {
        return None;
    }
    let suffix = value[end + 1..].trim();
    let collapsed = suffix.starts_with('-');
    let foldable = collapsed || suffix.starts_with('+');
    let custom_title = if foldable { suffix[1..].trim() } else { suffix };
    let title = if custom_title.is_empty() {
        let mut chars = kind.chars();
        chars
            .next()
            .map(|first| first.to_uppercase().collect::<String>() + chars.as_str())
            .unwrap_or_else(|| "Note".to_string())
    } else {
        custom_title.to_string()
    };
    Some((kind, title, foldable, collapsed))
}

pub fn render_heading(ui: &mut egui::Ui, level: u8, text: &str) {
    let (size, strong, add_sep) = match level {
        1 => (24.0, true, true),
        2 => (20.0, true, true),
        3 => (17.0, true, false),
        4 => (15.0, true, false),
        5 => (14.0, true, false),
        _ => (13.0, true, false),
    };

    ui.add_space(6.0);
    let mut rt = RichText::new(text).size(size).color(Color32::WHITE);
    if strong {
        rt = rt.strong();
    }
    ui.label(rt);
    if add_sep {
        ui.separator();
    }
    ui.add_space(3.0);
}

pub fn render_code_block(ui: &mut egui::Ui, lang: &str, content: &str) {
    egui::Frame::none()
        .fill(Theme::BG_CODE)
        .rounding(Rounding::same(4.0))
        .stroke(Stroke::new(1.0_f32, Theme::BORDER))
        .inner_margin(Margin::same(10.0))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                if !lang.is_empty() {
                    ui.label(
                        RichText::new(lang)
                            .size(11.0)
                            .color(Theme::TEXT_MUTED)
                            .monospace(),
                    );
                }
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.small_button("📋 Copy").clicked() {
                        ui.output_mut(|o| o.copied_text = content.to_string());
                    }
                });
            });
            ui.add_space(4.0);
            ui.label(
                RichText::new(content)
                    .monospace()
                    .color(Theme::TEXT_PRIMARY)
                    .size(13.0),
            );
        });
}

pub fn render_blockquote(
    ui: &mut egui::Ui,
    lines: &[String],
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    ui.horizontal(|ui| {
        let bar_width = 3.0;
        let bar_height = (22.0 * lines.len().max(1) as f32).max(24.0);
        let (rect, _) =
            ui.allocate_exact_size(egui::vec2(bar_width, bar_height), egui::Sense::hover());
        ui.painter()
            .rect_filled(rect, Rounding::same(1.5), Theme::ACCENT_PURPLE);
        ui.add_space(8.0);

        ui.vertical(|ui| {
            for line in lines {
                let spans = parse_inline_spans(line);
                render_inline_spans(ui, &spans, action, context);
            }
        });
    });
    ui.add_space(4.0);
}

pub fn render_unordered_list(
    ui: &mut egui::Ui,
    items: &[String],
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    for item in items {
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing.x = 6.0;
            ui.label(RichText::new("•").color(Theme::ACCENT_PURPLE).strong());
            let spans = parse_inline_spans(item);
            for span in spans {
                render_single_span(ui, &span, action, false, context);
            }
        });
    }
}

pub fn render_ordered_list(
    ui: &mut egui::Ui,
    items: &[(usize, String)],
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    for (idx, item) in items {
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing.x = 6.0;
            ui.label(
                RichText::new(format!("{}.", idx))
                    .color(Theme::TEXT_MUTED)
                    .monospace(),
            );
            let spans = parse_inline_spans(item);
            for span in spans {
                render_single_span(ui, &span, action, false, context);
            }
        });
    }
}

pub fn render_task_list(
    ui: &mut egui::Ui,
    items: &[(bool, String)],
    task_ordinal: &mut usize,
    interactive: bool,
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    for (checked, text) in items {
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing.x = 6.0;
            let symbol = if *checked { "☑" } else { "☐" };
            let color = if *checked {
                Theme::TEXT_MUTED
            } else {
                Theme::ACCENT_PURPLE
            };
            if interactive {
                if ui
                    .small_button(RichText::new(symbol).color(color).size(14.0))
                    .clicked()
                {
                    *action = Some(MarkdownAction::ToggleTask(*task_ordinal));
                }
            } else {
                ui.label(RichText::new(symbol).color(color).size(14.0));
            }
            let spans = parse_inline_spans(text);
            for span in spans {
                render_single_span(ui, &span, action, *checked, context);
            }
        });
        *task_ordinal += 1;
    }
}

fn render_markdown_table(
    ui: &mut egui::Ui,
    headers: &[String],
    alignments: &[TableAlignment],
    rows: &[Vec<String>],
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    let columns = headers.len().max(1);
    let cell_width = (ui.available_width() / columns as f32).clamp(100.0, 260.0);
    let grid_id = ui.next_auto_id();
    egui::ScrollArea::horizontal()
        .auto_shrink([false, true])
        .show(ui, |ui| {
            egui::Grid::new(grid_id).spacing([0.0, 0.0]).show(ui, |ui| {
                for (index, header) in headers.iter().enumerate() {
                    render_table_cell(
                        ui,
                        header,
                        cell_width,
                        true,
                        false,
                        alignments
                            .get(index)
                            .copied()
                            .unwrap_or(TableAlignment::Left),
                        action,
                        context,
                    );
                }
                ui.end_row();
                for (row_index, row) in rows.iter().enumerate() {
                    for column in 0..columns {
                        let value = row.get(column).map(String::as_str).unwrap_or_default();
                        render_table_cell(
                            ui,
                            value,
                            cell_width,
                            false,
                            row_index % 2 == 1,
                            alignments
                                .get(column)
                                .copied()
                                .unwrap_or(TableAlignment::Left),
                            action,
                            context,
                        );
                    }
                    ui.end_row();
                }
            });
        });
    ui.add_space(8.0);
}

fn render_table_cell(
    ui: &mut egui::Ui,
    text: &str,
    width: f32,
    header: bool,
    alternate: bool,
    alignment: TableAlignment,
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    let fill = if header {
        Theme::BG_CARD
    } else if alternate {
        Theme::BG_PRIMARY
    } else {
        Theme::BG_SECONDARY
    };
    egui::Frame::none()
        .fill(fill)
        .stroke(Stroke::new(0.5_f32, Theme::BORDER))
        .inner_margin(Margin::symmetric(8.0, 6.0))
        .show(ui, |ui| {
            ui.set_min_width(width);
            ui.set_max_width(width);
            let align = match alignment {
                TableAlignment::Left => egui::Align::Min,
                TableAlignment::Center => egui::Align::Center,
                TableAlignment::Right => egui::Align::Max,
            };
            ui.with_layout(egui::Layout::top_down(align), |ui| {
                ui.horizontal_wrapped(|ui| {
                    for span in parse_inline_spans(text) {
                        if header {
                            if let InlineSpan::Text(value) = span {
                                render_single_span(
                                    ui,
                                    &InlineSpan::Bold(value),
                                    action,
                                    false,
                                    context,
                                );
                            } else {
                                render_single_span(ui, &span, action, false, context);
                            }
                        } else {
                            render_single_span(ui, &span, action, false, context);
                        }
                    }
                });
            });
        });
}

fn render_callout(
    ui: &mut egui::Ui,
    kind: &str,
    title: &str,
    lines: &[String],
    foldable: bool,
    collapsed: bool,
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    let accent = match kind {
        "tip" | "success" | "done" | "check" => Theme::ACCENT_GREEN,
        "warning" | "caution" | "attention" => Theme::ACCENT_ORANGE,
        "danger" | "failure" | "error" | "bug" => Theme::ACCENT_RED,
        "question" | "help" | "faq" => Theme::ACCENT_BLUE,
        _ => Theme::ACCENT_PURPLE,
    };
    let icon = match kind {
        "tip" => "✦",
        "warning" | "caution" | "attention" => "!",
        "danger" | "failure" | "error" => "×",
        "question" | "help" | "faq" => "?",
        "success" | "done" | "check" => "✓",
        "bug" => "⚑",
        _ => "●",
    };
    egui::Frame::none()
        .fill(Theme::BG_SECONDARY)
        .stroke(Stroke::new(1.0_f32, accent))
        .rounding(Rounding::same(7.0))
        .inner_margin(Margin::symmetric(10.0, 7.0))
        .show(ui, |ui| {
            if foldable {
                egui::CollapsingHeader::new(
                    RichText::new(format!("{icon}  {title}"))
                        .strong()
                        .color(accent),
                )
                .id_salt(ui.next_auto_id())
                .default_open(!collapsed)
                .show(ui, |ui| render_callout_lines(ui, lines, action, context));
            } else {
                ui.horizontal(|ui| {
                    ui.label(RichText::new(icon).strong().color(accent));
                    ui.label(RichText::new(title).strong().color(accent));
                });
                render_callout_lines(ui, lines, action, context);
            }
        });
    ui.add_space(6.0);
}

fn render_note_embed(
    ui: &mut egui::Ui,
    target: &str,
    heading: Option<&str>,
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    let Some(note) = crate::wikilinks::resolve_wikilink(context.vault, target) else {
        ui.label(
            RichText::new(format!("Note embed unavailable: [[{target}]]"))
                .color(Theme::ACCENT_ORANGE),
        );
        return;
    };
    let path = note.abs_path.clone();
    let title = note.title.clone();
    let cycle = context.embed_stack.contains(&path);
    egui::Frame::none()
        .fill(Theme::BG_SECONDARY)
        .stroke(Stroke::new(1.0_f32, Theme::BORDER))
        .rounding(Rounding::same(7.0))
        .inner_margin(Margin::symmetric(10.0, 7.0))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                let link = ui.add(egui::Link::new(
                    RichText::new(&title).strong().color(Theme::ACCENT_BLUE),
                ));
                if link.clicked() {
                    *action = Some(match heading {
                        Some(heading) => MarkdownAction::OpenHeadingWikilink {
                            target: target.to_string(),
                            heading: heading.to_string(),
                        },
                        None => MarkdownAction::OpenWikilink(target.to_string()),
                    });
                }
                ui.label(
                    RichText::new(if heading.is_some() {
                        "HEADING EMBED"
                    } else {
                        "NOTE EMBED"
                    })
                    .size(9.0)
                    .color(Theme::TEXT_DIMMED),
                );
            });
            if cycle {
                ui.label(
                    RichText::new("Circular embed skipped.")
                        .size(11.0)
                        .color(Theme::TEXT_MUTED),
                );
                return;
            }
            if context.embed_depth >= 3 {
                ui.label(
                    RichText::new("Embed depth limit reached.")
                        .size(11.0)
                        .color(Theme::TEXT_MUTED),
                );
                return;
            }
            let source = match context.note_embeds.load(&path, context.vault_root) {
                EmbedLoad::Ready(content) => content,
                EmbedLoad::Loading => {
                    ui.horizontal(|ui| {
                        ui.spinner();
                        ui.label(RichText::new("Loading embedded note…").color(Theme::TEXT_MUTED));
                    });
                    ui.ctx()
                        .request_repaint_after(std::time::Duration::from_millis(60));
                    return;
                }
                EmbedLoad::Failed(error) => {
                    ui.label(
                        RichText::new(format!("Could not embed note: {error}"))
                            .size(11.0)
                            .color(Theme::ACCENT_ORANGE),
                    );
                    return;
                }
            };
            let content: std::borrow::Cow<'_, str> = if let Some(heading) = heading {
                match extract_heading_section(&source, heading) {
                    Some(content) => std::borrow::Cow::Owned(content),
                    None => {
                        ui.label(
                            RichText::new(format!("Heading not found: {heading}"))
                                .size(11.0)
                                .color(Theme::TEXT_MUTED),
                        );
                        return;
                    }
                }
            } else {
                std::borrow::Cow::Borrowed(source.as_ref())
            };
            let previous_path = context.note_path.clone();
            let previous_task_interactive = context.tasks_interactive;
            context.note_path = path.clone();
            context.tasks_interactive = false;
            context.embed_depth += 1;
            context.embed_stack.push(path.clone());
            render_markdown_content(ui, &content, action, context);
            context.embed_stack.pop();
            context.embed_depth -= 1;
            context.tasks_interactive = previous_task_interactive;
            context.note_path = previous_path;
        });
    ui.add_space(6.0);
}

fn extract_heading_section(content: &str, requested: &str) -> Option<String> {
    let body = crate::metadata::parse_note(content).body;
    let lines: Vec<_> = body.lines().collect();
    let mut start = None;
    let mut level = 0;
    for (index, line) in lines.iter().enumerate() {
        let trimmed = line.trim_start();
        let hashes = trimmed.chars().take_while(|ch| *ch == '#').count();
        if (1..=6).contains(&hashes) && trimmed[hashes..].starts_with(' ') {
            let title = trimmed[hashes..].trim().trim_end_matches('#').trim();
            if title.eq_ignore_ascii_case(requested.trim()) {
                start = Some(index);
                level = hashes;
                break;
            }
        }
    }
    let start = start?;
    let end = lines
        .iter()
        .enumerate()
        .skip(start + 1)
        .find_map(|(index, line)| {
            let trimmed = line.trim_start();
            let hashes = trimmed.chars().take_while(|ch| *ch == '#').count();
            ((1..=level).contains(&hashes) && trimmed[hashes..].starts_with(' ')).then_some(index)
        })
        .unwrap_or(lines.len());
    Some(lines[start..end].join("\n"))
}

fn render_callout_lines(
    ui: &mut egui::Ui,
    lines: &[String],
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    for line in lines {
        if line.is_empty() {
            ui.add_space(3.0);
        } else {
            render_inline_spans(ui, &parse_inline_spans(line), action, context);
        }
    }
}

pub fn render_markdown(
    ui: &mut egui::Ui,
    content: &str,
    action: &mut Option<MarkdownAction>,
    note_path: &std::path::Path,
    vault: &Vault,
    attachments: &mut super::attachments::AttachmentCache,
    note_embeds: &mut NoteEmbedCache,
) {
    let mut context = MarkdownRenderContext {
        note_path: note_path.to_path_buf(),
        vault_root: &vault.root_path,
        vault,
        attachments,
        note_embeds,
        embed_depth: 0,
        embed_stack: vec![note_path.to_path_buf()],
        tasks_interactive: true,
    };
    render_markdown_content(ui, content, action, &mut context);
}

pub fn format_latex_math(input: &str) -> String {
    let mut s = input.to_string();

    let greek = [
        (r"\alpha", "α"),
        (r"\beta", "β"),
        (r"\gamma", "γ"),
        (r"\delta", "δ"),
        (r"\epsilon", "ε"),
        (r"\zeta", "ζ"),
        (r"\eta", "η"),
        (r"\theta", "θ"),
        (r"\iota", "ι"),
        (r"\kappa", "κ"),
        (r"\lambda", "λ"),
        (r"\mu", "μ"),
        (r"\nu", "ν"),
        (r"\xi", "ξ"),
        (r"\pi", "π"),
        (r"\rho", "ρ"),
        (r"\sigma", "σ"),
        (r"\tau", "τ"),
        (r"\upsilon", "υ"),
        (r"\phi", "φ"),
        (r"\chi", "χ"),
        (r"\psi", "ψ"),
        (r"\omega", "ω"),
        (r"\Delta", "Δ"),
        (r"\Theta", "Θ"),
        (r"\Lambda", "Λ"),
        (r"\Xi", "Ξ"),
        (r"\Pi", "Π"),
        (r"\Sigma", "Σ"),
        (r"\Phi", "Φ"),
        (r"\Psi", "Ψ"),
        (r"\Omega", "Ω"),
    ];
    for (from, to) in greek {
        s = s.replace(from, to);
    }

    let symbols = [
        (r"\times", "×"),
        (r"\div", "÷"),
        (r"\cdot", "·"),
        (r"\pm", "±"),
        (r"\mp", "∓"),
        (r"\leq", "≤"),
        (r"\le", "≤"),
        (r"\geq", "≥"),
        (r"\ge", "≥"),
        (r"\neq", "≠"),
        (r"\ne", "≠"),
        (r"\approx", "≈"),
        (r"\equiv", "≡"),
        (r"\infty", "∞"),
        (r"\partial", "∂"),
        (r"\nabla", "∇"),
        (r"\sum", "∑"),
        (r"\prod", "∏"),
        (r"\int", "∫"),
        (r"\in", "∈"),
        (r"\notin", "∉"),
        (r"\subset", "⊂"),
        (r"\subseteq", "⊆"),
        (r"\cup", "∪"),
        (r"\cap", "∩"),
        (r"\to", "→"),
        (r"\rightarrow", "→"),
        (r"\leftarrow", "←"),
        (r"\Rightarrow", "⇒"),
        (r"\Leftarrow", "⇐"),
        (r"\iff", "⇔"),
        (r"\forall", "∀"),
        (r"\exists", "∃"),
        (r"\sqrt", "√"),
    ];
    for (from, to) in symbols {
        s = s.replace(from, to);
    }

    let supers = [
        ("^0", "⁰"),
        ("^1", "¹"),
        ("^2", "²"),
        ("^3", "³"),
        ("^4", "⁴"),
        ("^5", "⁵"),
        ("^6", "⁶"),
        ("^7", "⁷"),
        ("^8", "⁸"),
        ("^9", "⁹"),
        ("^+", "⁺"),
        ("^-", "⁻"),
        ("^n", "ⁿ"),
        ("^x", "ˣ"),
    ];
    for (from, to) in supers {
        s = s.replace(from, to);
    }

    let subs = [
        ("_0", "₀"),
        ("_1", "₁"),
        ("_2", "₂"),
        ("_3", "₃"),
        ("_4", "₄"),
        ("_5", "₅"),
        ("_6", "₆"),
        ("_7", "₇"),
        ("_8", "₈"),
        ("_9", "₉"),
        ("_+", "₊"),
        ("_-", "₋"),
        ("_i", "ᵢ"),
        ("_j", "ⱼ"),
        ("_n", "ₙ"),
    ];
    for (from, to) in subs {
        s = s.replace(from, to);
    }

    s
}

pub fn render_math_block(ui: &mut egui::Ui, math: &str) {
    let formatted = format_latex_math(math);
    ui.add_space(4.0);
    egui::Frame::none()
        .fill(Color32::from_rgb(24, 22, 32))
        .rounding(Rounding::same(4.0))
        .stroke(Stroke::new(1.0_f32, Color32::from_rgb(50, 46, 68)))
        .inner_margin(Margin::symmetric(16.0, 10.0))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new("fx")
                        .size(11.0)
                        .italics()
                        .color(Theme::ACCENT_PURPLE),
                );
                ui.add_space(8.0);
                ui.label(
                    RichText::new(formatted.trim())
                        .monospace()
                        .size(13.0)
                        .color(Theme::TEXT_PRIMARY),
                );
            });
        });
    ui.add_space(4.0);
}

pub fn render_footnote_definition(
    ui: &mut egui::Ui,
    label: &str,
    content: &str,
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new(format!("[^{label}]:"))
                .size(11.0)
                .color(Theme::ACCENT_BLUE),
        );
        ui.add_space(4.0);
        let spans = parse_inline_spans(content);
        render_inline_spans(ui, &spans, action, context);
    });
}

fn render_markdown_content(
    ui: &mut egui::Ui,
    content: &str,
    action: &mut Option<MarkdownAction>,
    context: &mut MarkdownRenderContext<'_>,
) {
    let blocks = parse_markdown_blocks(content);
    let mut task_ordinal = 0;
    for block in blocks {
        match block {
            MarkdownBlock::Properties { values, tags } => {
                egui::Frame::none()
                    .fill(Theme::BG_SECONDARY)
                    .rounding(Rounding::same(8.0))
                    .inner_margin(Margin::symmetric(12.0, 8.0))
                    .stroke(Stroke::new(1.0_f32, Theme::BORDER))
                    .show(ui, |ui| {
                        ui.label(
                            RichText::new("PROPERTIES")
                                .strong()
                                .size(9.0)
                                .color(Theme::TEXT_DIMMED),
                        );
                        for (key, value) in values {
                            ui.horizontal_wrapped(|ui| {
                                ui.label(RichText::new(key).size(11.0).color(Theme::TEXT_MUTED));
                                ui.label(
                                    RichText::new(value).size(11.0).color(Theme::TEXT_PRIMARY),
                                );
                            });
                        }
                        if !tags.is_empty() {
                            ui.horizontal_wrapped(|ui| {
                                for tag in tags {
                                    ui.label(
                                        RichText::new(format!("#{tag}"))
                                            .size(11.0)
                                            .color(Theme::ACCENT_GREEN)
                                            .background_color(Theme::BG_CARD),
                                    );
                                }
                            });
                        }
                    });
                ui.add_space(8.0);
            }
            MarkdownBlock::Heading { level, text } => {
                render_heading(ui, level, &text);
            }
            MarkdownBlock::Image { alt, target } => {
                render_image(ui, &alt, &target, context, 560.0);
            }
            MarkdownBlock::CodeBlock { lang, content } => {
                render_code_block(ui, &lang, &content);
            }
            MarkdownBlock::MathBlock(math) => {
                render_math_block(ui, &math);
            }
            MarkdownBlock::FootnoteDefinition { label, content } => {
                render_footnote_definition(ui, &label, &content, action, context);
            }
            MarkdownBlock::Blockquote(lines) => {
                render_blockquote(ui, &lines, action, context);
            }
            MarkdownBlock::Callout {
                kind,
                title,
                lines,
                foldable,
                collapsed,
            } => {
                render_callout(
                    ui, &kind, &title, &lines, foldable, collapsed, action, context,
                );
            }
            MarkdownBlock::UnorderedList(items) => {
                render_unordered_list(ui, &items, action, context);
            }
            MarkdownBlock::OrderedList(items) => {
                render_ordered_list(ui, &items, action, context);
            }
            MarkdownBlock::TaskList(items) => {
                render_task_list(
                    ui,
                    &items,
                    &mut task_ordinal,
                    context.tasks_interactive,
                    action,
                    context,
                );
            }
            MarkdownBlock::Table {
                headers,
                alignments,
                rows,
            } => {
                render_markdown_table(ui, &headers, &alignments, &rows, action, context);
            }
            MarkdownBlock::HorizontalRule => {
                ui.add_space(4.0);
                ui.separator();
                ui.add_space(4.0);
            }
            MarkdownBlock::Paragraph(text) => {
                let spans = parse_inline_spans(&text);
                render_inline_spans(ui, &spans, action, context);
                ui.add_space(4.0);
            }
        }
    }
}

fn render_image(
    ui: &mut egui::Ui,
    alt: &str,
    target: &str,
    context: &mut MarkdownRenderContext<'_>,
    max_height: f32,
) {
    let Some(path) = resolve_attachment(&context.note_path, context.vault_root, target) else {
        ui.label(RichText::new(format!("Image unavailable: {target}")).color(Theme::ACCENT_ORANGE));
        return;
    };
    match context.attachments.get_or_load(ui.ctx(), &path) {
        ImageStatus::Ready(texture) => {
            let image = egui::Image::new((texture.id(), texture.size_vec2()))
                .max_size(egui::vec2(ui.available_width().min(800.0), max_height))
                .maintain_aspect_ratio(true);
            ui.add(image).on_hover_text(&path.display().to_string());
        }
        ImageStatus::Loading => {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(RichText::new(format!("Loading image: {alt}")).color(Theme::TEXT_MUTED));
            });
            ui.ctx()
                .request_repaint_after(std::time::Duration::from_millis(50));
        }
        ImageStatus::Failed(error) => {
            ui.label(RichText::new(format!("{alt}: {error}")).color(Theme::ACCENT_ORANGE));
        }
    }
    if !alt.is_empty() {
        ui.label(RichText::new(alt).size(11.0).color(Theme::TEXT_DIMMED));
    }
    ui.add_space(6.0);
}
