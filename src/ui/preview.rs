use super::theme::Theme;
use egui::{Color32, Margin, RichText, Rounding, Stroke};

#[derive(Debug, Clone)]
pub enum MarkdownAction {
    OpenWikilink(String),
    OpenUrl(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum InlineSpan {
    Text(String),
    Bold(String),
    Italic(String),
    Code(String),
    Strikethrough(String),
    Wikilink { target: String, display: String },
    Url { text: String, url: String },
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
        // 1. Wikilink [[...]]
        if remaining.starts_with("[[") {
            if let Some(end) = remaining[2..].find("]]") {
                let inner = &remaining[2..2 + end];
                if !inner.contains('\n') {
                    flush_text(&mut spans, &mut current_text);
                    let parsed = crate::wikilinks::parse_wikilink_content(inner);
                    spans.push(InlineSpan::Wikilink {
                        target: parsed.target,
                        display: parsed.display,
                    });
                    remaining = &remaining[2 + end + 2..];
                    continue;
                }
            }
        }

        // 2. Markdown link [text](url)
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

        // 3. Inline code `...`
        if remaining.starts_with('`') {
            if let Some(end) = remaining[1..].find('`') {
                let code_text = &remaining[1..1 + end];
                flush_text(&mut spans, &mut current_text);
                spans.push(InlineSpan::Code(code_text.to_string()));
                remaining = &remaining[1 + end + 1..];
                continue;
            }
        }

        // 4. Bold **...** or __...__
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

        // 5. Strikethrough ~~...~~
        if remaining.starts_with("~~") {
            if let Some(end) = remaining[2..].find("~~") {
                let strike_text = &remaining[2..2 + end];
                flush_text(&mut spans, &mut current_text);
                spans.push(InlineSpan::Strikethrough(strike_text.to_string()));
                remaining = &remaining[2 + end + 2..];
                continue;
            }
        }

        // 6. Italic *...* or _..._
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

        // 7. Consume normal character
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
        InlineSpan::Wikilink { target, display } => {
            let resp = ui.add(egui::Link::new(
                RichText::new(display).color(Theme::ACCENT_BLUE).underline(),
            ));
            if resp.clicked() {
                *action = Some(MarkdownAction::OpenWikilink(target.clone()));
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
    }
}

pub fn render_inline_spans(
    ui: &mut egui::Ui,
    spans: &[InlineSpan],
    action: &mut Option<MarkdownAction>,
) {
    ui.horizontal_wrapped(|ui| {
        ui.spacing_mut().item_spacing.x = 4.0;
        for span in spans {
            render_single_span(ui, span, action, false);
        }
    });
}

#[derive(Debug, Clone)]
pub enum MarkdownBlock {
    Heading { level: u8, text: String },
    CodeBlock { lang: String, content: String },
    Blockquote(Vec<String>),
    UnorderedList(Vec<String>),
    OrderedList(Vec<(usize, String)>),
    TaskList(Vec<(bool, String)>),
    HorizontalRule,
    Paragraph(String),
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

pub fn parse_markdown_blocks(content: &str) -> Vec<MarkdownBlock> {
    let mut blocks = Vec::new();
    let mut lines = content.lines().peekable();

    while let Some(line) = lines.next() {
        let trimmed = line.trim();

        // 1. Code blocks: ```
        if trimmed.starts_with("```") {
            let lang = trimmed[3..].trim().to_string();
            let mut code_lines = Vec::new();
            while let Some(next_line) = lines.next() {
                if next_line.trim().starts_with("```") {
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
            blocks.push(MarkdownBlock::Blockquote(quote_lines));
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
                || next_trimmed.starts_with('#')
                || next_trimmed.starts_with('>')
                || next_trimmed.starts_with("```")
                || next_trimmed == "---"
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

pub fn render_blockquote(ui: &mut egui::Ui, lines: &[String], action: &mut Option<MarkdownAction>) {
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
                render_inline_spans(ui, &spans, action);
            }
        });
    });
    ui.add_space(4.0);
}

pub fn render_unordered_list(
    ui: &mut egui::Ui,
    items: &[String],
    action: &mut Option<MarkdownAction>,
) {
    for item in items {
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing.x = 6.0;
            ui.label(RichText::new("•").color(Theme::ACCENT_PURPLE).strong());
            let spans = parse_inline_spans(item);
            for span in spans {
                render_single_span(ui, &span, action, false);
            }
        });
    }
}

pub fn render_ordered_list(
    ui: &mut egui::Ui,
    items: &[(usize, String)],
    action: &mut Option<MarkdownAction>,
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
                render_single_span(ui, &span, action, false);
            }
        });
    }
}

pub fn render_task_list(
    ui: &mut egui::Ui,
    items: &[(bool, String)],
    action: &mut Option<MarkdownAction>,
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
            ui.label(RichText::new(symbol).color(color).size(14.0));
            let spans = parse_inline_spans(text);
            for span in spans {
                render_single_span(ui, &span, action, *checked);
            }
        });
    }
}

pub fn render_markdown(ui: &mut egui::Ui, content: &str, action: &mut Option<MarkdownAction>) {
    let blocks = parse_markdown_blocks(content);
    for block in blocks {
        match block {
            MarkdownBlock::Heading { level, text } => {
                render_heading(ui, level, &text);
            }
            MarkdownBlock::CodeBlock { lang, content } => {
                render_code_block(ui, &lang, &content);
            }
            MarkdownBlock::Blockquote(lines) => {
                render_blockquote(ui, &lines, action);
            }
            MarkdownBlock::UnorderedList(items) => {
                render_unordered_list(ui, &items, action);
            }
            MarkdownBlock::OrderedList(items) => {
                render_ordered_list(ui, &items, action);
            }
            MarkdownBlock::TaskList(items) => {
                render_task_list(ui, &items, action);
            }
            MarkdownBlock::HorizontalRule => {
                ui.add_space(4.0);
                ui.separator();
                ui.add_space(4.0);
            }
            MarkdownBlock::Paragraph(text) => {
                let spans = parse_inline_spans(&text);
                render_inline_spans(ui, &spans, action);
                ui.add_space(4.0);
            }
        }
    }
}
