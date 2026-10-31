use super::preview::{self, MarkdownAction};
use super::theme::Theme;
use crate::app::{paint_app_mark, BetterObsidianApp};
use crate::vault::NoteItem;
use egui::text::{CCursor, CCursorRange};
use egui::{Color32, Key, RichText, ScrollArea, Stroke, TextEdit};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ViewMode {
    Edit,
    Split,
    Preview,
}

pub fn render_editor_area(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    if app.active_note.is_none() {
        render_welcome_screen(ui, app);
        return;
    }

    render_tab_bar(ui, app);

    if app.in_note_search_open {
        render_in_note_search_bar(ui, app);
    }

    let mut action = None;
    let view_mode = app.view_mode;
    let mut pending_heading_jump = app.pending_heading_jump.take();
    let mut pending_template_insert = app.pending_template_insert.take();
    let mut focus_editor_next_frame = app.focus_editor_next_frame;
    let completion_notes = app
        .vault
        .as_ref()
        .map(|vault| vault.notes.as_slice())
        .unwrap_or_default();

    let mut property_key_draft = std::mem::take(&mut app.property_key_draft);
    let mut property_value_draft = std::mem::take(&mut app.property_value_draft);
    let mut properties_editor_open = app.properties_editor_open;
    let mut rename_request = None;

    match view_mode {
        ViewMode::Edit => {
            if let Some(active) = &mut app.active_note {
                let title = active.title.clone();
                let abs_path = active.abs_path.clone();
                let rel_path = active.rel_path.clone();

                ScrollArea::vertical()
                    .id_salt("editor_full_scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        egui::Frame::none()
                            .inner_margin(egui::Margin::symmetric(48.0, 20.0))
                            .show(ui, |ui| {
                                let title_resp = ui
                                    .add(
                                        egui::Label::new(
                                            RichText::new(&title)
                                                .strong()
                                                .size(26.0)
                                                .color(Theme::TEXT_PRIMARY),
                                        )
                                        .sense(egui::Sense::click()),
                                    )
                                    .on_hover_text("Click to rename note");
                                if title_resp.clicked() {
                                    rename_request = Some((abs_path.clone(), rel_path.clone()));
                                }
                                ui.add_space(8.0);

                                render_inline_properties(
                                    ui,
                                    &mut active.content,
                                    &mut property_key_draft,
                                    &mut property_value_draft,
                                    &mut properties_editor_open,
                                );
                                ui.add_space(8.0);

                                show_note_editor(
                                    ui,
                                    &mut active.content,
                                    ("editor_full", active.abs_path.clone()),
                                    &active.abs_path,
                                    &mut pending_heading_jump,
                                    &mut pending_template_insert,
                                    &mut focus_editor_next_frame,
                                    completion_notes,
                                );
                            });
                    });
            }
        }
        ViewMode::Preview => {
            if let (Some(active), Some(vault)) = (&mut app.active_note, &app.vault) {
                let title = active.title.clone();
                let abs_path = active.abs_path.clone();
                let rel_path = active.rel_path.clone();

                ScrollArea::vertical()
                    .id_salt("preview_full_scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        egui::Frame::none()
                            .inner_margin(egui::Margin::symmetric(48.0, 20.0))
                            .show(ui, |ui| {
                                let title_resp = ui
                                    .add(
                                        egui::Label::new(
                                            RichText::new(&title)
                                                .strong()
                                                .size(26.0)
                                                .color(Theme::TEXT_PRIMARY),
                                        )
                                        .sense(egui::Sense::click()),
                                    )
                                    .on_hover_text("Click to rename note");
                                if title_resp.clicked() {
                                    rename_request = Some((abs_path.clone(), rel_path.clone()));
                                }
                                ui.add_space(8.0);

                                render_inline_properties(
                                    ui,
                                    &mut active.content,
                                    &mut property_key_draft,
                                    &mut property_value_draft,
                                    &mut properties_editor_open,
                                );
                                ui.add_space(8.0);

                                preview::render_markdown(
                                    ui,
                                    &active.content,
                                    &mut action,
                                    &active.abs_path,
                                    vault,
                                    &mut app.attachment_cache,
                                    &mut app.note_embed_cache,
                                );
                            });
                    });
            }
        }
        ViewMode::Split => {
            let available_width = ui.available_width();
            egui::SidePanel::left("split_editor_inner_panel")
                .resizable(true)
                .default_width(available_width * 0.5)
                .width_range(180.0..=(available_width - 180.0).max(180.0))
                .frame(
                    egui::Frame::none()
                        .fill(Theme::BG_PRIMARY)
                        .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER)),
                )
                .show_inside(ui, |editor_ui| {
                    if let Some(active) = &mut app.active_note {
                        let title = active.title.clone();
                        let abs_path = active.abs_path.clone();
                        let rel_path = active.rel_path.clone();

                        ScrollArea::vertical()
                            .id_salt("editor_split_scroll")
                            .auto_shrink([false, false])
                            .show(editor_ui, |ui| {
                                egui::Frame::none()
                                    .inner_margin(egui::Margin::symmetric(24.0, 16.0))
                                    .show(ui, |ui| {
                                        let title_resp = ui
                                            .add(
                                                egui::Label::new(
                                                    RichText::new(&title)
                                                        .strong()
                                                        .size(24.0)
                                                        .color(Theme::TEXT_PRIMARY),
                                                )
                                                .sense(egui::Sense::click()),
                                            )
                                            .on_hover_text("Click to rename note");
                                        if title_resp.clicked() {
                                            rename_request =
                                                Some((abs_path.clone(), rel_path.clone()));
                                        }
                                        ui.add_space(8.0);

                                        render_inline_properties(
                                            ui,
                                            &mut active.content,
                                            &mut property_key_draft,
                                            &mut property_value_draft,
                                            &mut properties_editor_open,
                                        );
                                        ui.add_space(8.0);

                                        show_note_editor(
                                            ui,
                                            &mut active.content,
                                            ("editor_split", active.abs_path.clone()),
                                            &active.abs_path,
                                            &mut pending_heading_jump,
                                            &mut pending_template_insert,
                                            &mut focus_editor_next_frame,
                                            completion_notes,
                                        );
                                    });
                            });
                    }
                });

            if let Some(split) = &mut app.split_note {
                let title = split.title.clone();
                let abs_path = split.abs_path.clone();
                let rel_path = split.rel_path.clone();
                let mut close_split = false;

                ScrollArea::vertical()
                    .id_salt("split_right_note_scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        egui::Frame::none()
                            .inner_margin(egui::Margin::symmetric(24.0, 16.0))
                            .show(ui, |ui| {
                                ui.horizontal(|ui| {
                                    let title_resp = ui.add(
                                        egui::Label::new(
                                            RichText::new(&title)
                                                .strong()
                                                .size(24.0)
                                                .color(Theme::TEXT_PRIMARY),
                                        )
                                        .sense(egui::Sense::click()),
                                    );
                                    if title_resp.clicked() {
                                        rename_request = Some((abs_path.clone(), rel_path.clone()));
                                    }
                                    ui.with_layout(
                                        egui::Layout::right_to_left(egui::Align::Center),
                                        |ui| {
                                            if ui
                                                .small_button("×")
                                                .on_hover_text("Close split pane")
                                                .clicked()
                                            {
                                                close_split = true;
                                            }
                                        },
                                    );
                                });
                                ui.add_space(8.0);

                                show_note_editor(
                                    ui,
                                    &mut split.content,
                                    ("editor_split_right", split.abs_path.clone()),
                                    &split.abs_path,
                                    &mut None,
                                    &mut None,
                                    &mut false,
                                    completion_notes,
                                );
                            });
                    });

                if close_split {
                    app.split_note = None;
                    app.view_mode = ViewMode::Edit;
                }
            } else if let (Some(active), Some(vault)) = (&mut app.active_note, &app.vault) {
                let title = active.title.clone();
                ScrollArea::vertical()
                    .id_salt("preview_split_scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        egui::Frame::none()
                            .inner_margin(egui::Margin::symmetric(24.0, 16.0))
                            .show(ui, |ui| {
                                ui.label(
                                    RichText::new(&title)
                                        .strong()
                                        .size(24.0)
                                        .color(Theme::TEXT_PRIMARY),
                                );
                                ui.add_space(8.0);

                                render_inline_properties(
                                    ui,
                                    &mut active.content,
                                    &mut property_key_draft,
                                    &mut property_value_draft,
                                    &mut properties_editor_open,
                                );
                                ui.add_space(8.0);

                                preview::render_markdown(
                                    ui,
                                    &active.content,
                                    &mut action,
                                    &active.abs_path,
                                    vault,
                                    &mut app.attachment_cache,
                                    &mut app.note_embed_cache,
                                );
                            });
                    });
            }
        }
    }

    app.property_key_draft = property_key_draft;
    app.property_value_draft = property_value_draft;
    app.properties_editor_open = properties_editor_open;
    if let Some((path, rel)) = rename_request {
        app.rename_note_dialog.open(path, rel);
    }

    if let Some(pending) = pending_template_insert {
        app.pending_template_insert = Some(pending);
    }
    app.focus_editor_next_frame = focus_editor_next_frame;

    if let Some(act) = action {
        match act {
            MarkdownAction::OpenWikilink(target) => {
                app.handle_wikilink_action(&target, None);
            }
            MarkdownAction::OpenHeadingWikilink { target, heading } => {
                app.handle_wikilink_action(&target, Some(&heading));
            }
            MarkdownAction::OpenUrl(url) => {
                app.set_status(format!("Link: {}", url));
            }
            MarkdownAction::ToggleTask(ordinal) => app.toggle_task_at_ordinal(ordinal),
        }
    }
}

fn show_note_editor(
    ui: &mut egui::Ui,
    content: &mut String,
    id_salt: impl std::hash::Hash,
    active_path: &std::path::Path,
    pending_heading_jump: &mut Option<usize>,
    pending_template_insert: &mut Option<String>,
    focus_editor_next_frame: &mut bool,
    notes: &[NoteItem],
) {
    let id = ui.make_persistent_id(id_salt);
    if let Some(char_offset) = pending_heading_jump.take() {
        let mut state =
            egui::widgets::text_edit::TextEditState::load(ui.ctx(), id).unwrap_or_default();
        state
            .cursor
            .set_char_range(Some(CCursorRange::one(CCursor::new(
                char_offset.min(content.chars().count()),
            ))));
        state.store(ui.ctx(), id);
        ui.memory_mut(|memory| memory.request_focus(id));
    }

    let inserted_template = pending_template_insert.is_some();
    if let Some(template_text) = pending_template_insert.take() {
        let mut state =
            egui::widgets::text_edit::TextEditState::load(ui.ctx(), id).unwrap_or_default();
        let total_chars = content.chars().count();
        let (start_char, end_char) = if let Some(cursor_range) = state.cursor.char_range() {
            let [s, e] = cursor_range.sorted();
            (s.index.min(total_chars), e.index.min(total_chars))
        } else {
            (total_chars, total_chars)
        };
        let byte_start = char_to_byte_index(content, start_char);
        let byte_end = char_to_byte_index(content, end_char);
        content.replace_range(byte_start..byte_end, &template_text);
        let cursor_after = start_char + template_text.chars().count();
        state
            .cursor
            .set_char_range(Some(CCursorRange::one(CCursor::new(cursor_after))));
        state.store(ui.ctx(), id);
        ui.memory_mut(|memory| memory.request_focus(id));
    }

    let editor = TextEdit::multiline(content)
        .font(egui::TextStyle::Body)
        .desired_width(f32::INFINITY)
        .min_size(ui.available_size())
        .hint_text("Start writing your note…")
        .frame(false)
        .lock_focus(true)
        .id(id);
    let output = editor.show(ui);
    if inserted_template || *focus_editor_next_frame {
        output.response.request_focus();
    }
    *focus_editor_next_frame = false;

    if output.response.has_focus() {
        let (cmd_b, cmd_i, cmd_k) = ui.input(|i| {
            let cmd = i.modifiers.command;
            (
                cmd && i.key_pressed(egui::Key::B),
                cmd && i.key_pressed(egui::Key::I),
                cmd && i.key_pressed(egui::Key::K),
            )
        });

        if cmd_b || cmd_i || cmd_k {
            let mut state =
                egui::widgets::text_edit::TextEditState::load(ui.ctx(), id).unwrap_or_default();
            let total_chars = content.chars().count();
            let (start_char, end_char) = if let Some(cursor_range) = state.cursor.char_range() {
                let [s, e] = cursor_range.sorted();
                (s.index.min(total_chars), e.index.min(total_chars))
            } else {
                (total_chars, total_chars)
            };

            let byte_start = char_to_byte_index(content, start_char);
            let byte_end = char_to_byte_index(content, end_char);

            let (prefix, suffix) = if cmd_b {
                ("**", "**")
            } else if cmd_i {
                ("*", "*")
            } else {
                ("[[", "]]")
            };

            if start_char < end_char {
                let selected_text = content[byte_start..byte_end].to_string();
                let wrapped = format!("{prefix}{selected_text}{suffix}");
                content.replace_range(byte_start..byte_end, &wrapped);
                let new_cursor_start = start_char + prefix.chars().count();
                let new_cursor_end = new_cursor_start + selected_text.chars().count();
                state.cursor.set_char_range(Some(CCursorRange::two(
                    CCursor::new(new_cursor_start),
                    CCursor::new(new_cursor_end),
                )));
            } else {
                let insert_str = format!("{prefix}{suffix}");
                content.replace_range(byte_start..byte_start, &insert_str);
                let inside_cursor = start_char + prefix.chars().count();
                state
                    .cursor
                    .set_char_range(Some(CCursorRange::one(CCursor::new(inside_cursor))));
            }
            state.store(ui.ctx(), id);
            output.response.request_focus();
        }
    }

    let Some(cursor) = output.cursor_range.filter(|range| range.is_empty()) else {
        return;
    };
    if !output.response.has_focus() {
        return;
    }
    let cursor_char = cursor.primary.ccursor.index.min(content.chars().count());
    let before: String = content.chars().take(cursor_char).collect();
    let Some(link_start) = before.rfind("[[") else {
        return;
    };
    let query = &before[link_start + 2..];
    if query.contains('\n') || query.contains("]]") || query.contains('|') || query.contains('#') {
        return;
    }
    let after: String = content.chars().skip(cursor_char).collect();
    if after.contains("]]") && !after.starts_with("]]") {
        return;
    }
    if !after.is_empty() && !after.starts_with("]]") && !after.starts_with('\n') {
        return;
    }
    let query_lower = query.to_lowercase();
    let matches: Vec<_> = notes
        .iter()
        .filter(|note| {
            note.abs_path != active_path
                && (note.title.to_lowercase().contains(&query_lower)
                    || note.rel_path.to_lowercase().contains(&query_lower))
                && !note.title.contains("]]")
        })
        .take(7)
        .cloned()
        .collect();
    if matches.is_empty() {
        return;
    }
    let caret_rect = output.galley.pos_from_ccursor(cursor.primary.ccursor);
    let popup_position =
        output.galley_pos + caret_rect.left_bottom().to_vec2() + egui::vec2(0.0, 3.0);
    let mut selected = None;
    egui::Area::new(id.with("wikilink-completion"))
        .order(egui::Order::Foreground)
        .fixed_pos(popup_position)
        .show(ui.ctx(), |ui| {
            egui::Frame::none()
                .fill(Theme::BG_SECONDARY)
                .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
                .rounding(egui::Rounding::same(7.0))
                .inner_margin(egui::Margin::same(5.0))
                .show(ui, |ui| {
                    ui.set_min_width(220.0);
                    ui.set_max_width(320.0);
                    ui.label(
                        RichText::new("LINK TO NOTE")
                            .strong()
                            .size(9.0)
                            .color(Theme::TEXT_DIMMED),
                    );
                    for note in matches {
                        if ui
                            .selectable_label(
                                false,
                                RichText::new(&note.title).color(Theme::TEXT_PRIMARY),
                            )
                            .on_hover_text(&note.rel_path)
                            .clicked()
                        {
                            selected = Some(note.title);
                        }
                    }
                });
        });
    if let Some(target) = selected {
        let query_start = link_start + 2;
        let byte_start = char_to_byte_index(content, query_start);
        let byte_cursor = char_to_byte_index(content, cursor_char);
        content.replace_range(byte_start..byte_cursor, &target);
        let added_closer = !after.starts_with("]]");
        let target_end = byte_start + target.len();
        if added_closer {
            content.insert_str(target_end, "]]");
        }
        let cursor_after = query_start + target.chars().count() + if added_closer { 2 } else { 0 };
        let mut state = output.state;
        state
            .cursor
            .set_char_range(Some(CCursorRange::one(CCursor::new(cursor_after))));
        state.store(ui.ctx(), id);
        ui.memory_mut(|memory| memory.request_focus(id));
    }
}

fn char_to_byte_index(text: &str, char_index: usize) -> usize {
    text.char_indices()
        .nth(char_index)
        .map(|(byte_index, _)| byte_index)
        .unwrap_or(text.len())
}

fn render_tab_bar(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let tabs = app.tab_summaries();
    if tabs.is_empty() {
        return;
    }

    let mut switch_to = None;
    let mut close = None;
    let mut open_split = None;
    let mut create_new = false;
    let mut toggle_view_mode = false;
    let mut toggle_split = false;
    let mut save_requested = false;
    let mut template_requested = false;
    let mut properties_requested = false;
    let mut rename_requested = false;
    let mut delete_requested = false;
    let mut tab_delete = None;

    egui::Frame::none()
        .fill(Theme::BG_SECONDARY)
        .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
        .inner_margin(egui::Margin {
            left: 6.0,
            right: 6.0,
            top: 3.0,
            bottom: 0.0,
        })
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                let row_height = 28.0;
                let right_actions_width = 86.0;
                let tabs_width = (ui.available_width() - right_actions_width - 32.0).max(60.0);
                ui.allocate_ui(egui::vec2(tabs_width, row_height), |ui| {
                    ScrollArea::horizontal()
                        .id_salt("document_tabs_scroll")
                        .max_width(tabs_width)
                        .auto_shrink([false, true])
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                for (path, title, active, dirty) in &tabs {
                                    let is_active = *active;
                                    let mut display_title = title.clone();
                                    if display_title.len() > 22 {
                                        display_title.truncate(20);
                                        display_title.push('…');
                                    }

                                    let tab_bg = if is_active {
                                        Theme::BG_PRIMARY
                                    } else {
                                        Color32::TRANSPARENT
                                    };

                                    let text_color = if is_active {
                                        Theme::TEXT_PRIMARY
                                    } else {
                                        Theme::TEXT_MUTED
                                    };

                                    let frame = egui::Frame::none()
                                        .fill(tab_bg)
                                        .rounding(egui::Rounding {
                                            nw: 5.0,
                                            ne: 5.0,
                                            sw: 0.0,
                                            se: 0.0,
                                        })
                                        .stroke(if is_active {
                                            egui::Stroke::new(1.0_f32, Theme::BORDER)
                                        } else {
                                            egui::Stroke::NONE
                                        })
                                        .inner_margin(egui::Margin::symmetric(8.0, 4.0));

                                    let resp = frame.show(ui, |ui| {
                                        ui.horizontal(|ui| {
                                            if *dirty {
                                                ui.label(
                                                    RichText::new("●")
                                                        .size(9.0)
                                                        .color(Theme::ACCENT_ORANGE),
                                                );
                                            }
                                            let label_resp = ui.add(
                                                egui::Label::new(
                                                    RichText::new(display_title)
                                                        .size(11.5)
                                                        .color(text_color),
                                                )
                                                .sense(egui::Sense::click()),
                                            );
                                            if label_resp.clicked() && !is_active {
                                                switch_to = Some(path.clone());
                                            }
                                            let label_resp = label_resp
                                                .on_hover_text(path.display().to_string());
                                            label_resp.context_menu(|ui| {
                                                if ui.button("Open to the right").clicked() {
                                                    open_split = Some(path.clone());
                                                    ui.close_menu();
                                                }
                                                if ui.button("Close tab").clicked() {
                                                    close = Some(path.clone());
                                                    ui.close_menu();
                                                }
                                                if ui
                                                    .button(
                                                        RichText::new("Delete note…")
                                                            .color(Theme::ACCENT_RED),
                                                    )
                                                    .clicked()
                                                {
                                                    tab_delete =
                                                        Some((path.clone(), title.clone()));
                                                    ui.close_menu();
                                                }
                                            });

                                            if ui
                                                .add(
                                                    egui::Button::new(
                                                        RichText::new("×")
                                                            .size(11.0)
                                                            .color(Theme::TEXT_DIMMED),
                                                    )
                                                    .frame(false),
                                                )
                                                .on_hover_text("Close tab · Ctrl+W")
                                                .clicked()
                                            {
                                                close = Some(path.clone());
                                            }
                                        });
                                    });

                                    // Top blue accent bar for active tab
                                    if is_active {
                                        let rect = resp.response.rect;
                                        ui.painter().line_segment(
                                            [rect.left_top(), rect.right_top()],
                                            Stroke::new(2.0_f32, Theme::ACCENT_BLUE),
                                        );
                                    }

                                    ui.add_space(2.0);
                                }
                            });
                        });
                });

                if ui
                    .add_sized(
                        [24.0, 22.0],
                        egui::Button::new(RichText::new("+").size(12.0).color(Theme::TEXT_MUTED)),
                    )
                    .on_hover_text("New tab / note · Ctrl+N")
                    .clicked()
                {
                    create_new = true;
                }

                // Right actions (More ..., Split toggle, ViewMode toggle)
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.menu_button("…", |ui| {
                        if ui.button("Save note · Ctrl+S").clicked() {
                            save_requested = true;
                            ui.close_menu();
                        }
                        if ui.button("Insert template…").clicked() {
                            template_requested = true;
                            ui.close_menu();
                        }
                        if ui.button("Toggle properties").clicked() {
                            properties_requested = true;
                            ui.close_menu();
                        }
                        let is_bm = if let Some(active) = &app.active_note {
                            app.is_bookmarked(&active.abs_path)
                        } else {
                            false
                        };
                        let bm_label = if is_bm {
                            "Remove bookmark · Ctrl+B"
                        } else {
                            "Bookmark note · Ctrl+B"
                        };
                        if ui.button(bm_label).clicked() {
                            if let Some(active) = &app.active_note {
                                let p = active.abs_path.clone();
                                app.toggle_bookmark(p);
                            }
                            ui.close_menu();
                        }
                        if ui.button("Rename note…").clicked() {
                            rename_requested = true;
                            ui.close_menu();
                        }
                        if ui
                            .button(RichText::new("Delete note…").color(Theme::ACCENT_RED))
                            .clicked()
                        {
                            delete_requested = true;
                            ui.close_menu();
                        }
                    })
                    .response
                    .on_hover_text("More note options");

                    let split_resp =
                        paint_editor_icon_button(ui, EditorActionIcon::Split, "Split right");
                    if split_resp.clicked() {
                        toggle_split = true;
                    }

                    let (mode_icon, mode_tooltip) = match app.view_mode {
                        ViewMode::Edit => {
                            (EditorActionIcon::Book, "Switch to reading view · Ctrl+E")
                        }
                        ViewMode::Preview => {
                            (EditorActionIcon::Pen, "Switch to editing view · Ctrl+E")
                        }
                        ViewMode::Split => {
                            (EditorActionIcon::Pen, "Switch to editing view · Ctrl+E")
                        }
                    };
                    let mode_resp = paint_editor_icon_button(ui, mode_icon, mode_tooltip);
                    if mode_resp.clicked() {
                        toggle_view_mode = true;
                    }
                });
            });
        });

    if let Some(path) = switch_to {
        app.request_open_note(path);
    }
    if let Some(path) = close {
        app.request_close_tab(&path);
    }
    if let Some(path) = open_split {
        app.open_note_in_split(&path);
    }
    if create_new {
        app.open_new_note_dialog();
    }
    if toggle_view_mode {
        app.view_mode = match app.view_mode {
            ViewMode::Edit => ViewMode::Preview,
            ViewMode::Preview => ViewMode::Edit,
            ViewMode::Split => ViewMode::Edit,
        };
    }
    if toggle_split {
        app.view_mode = match app.view_mode {
            ViewMode::Split => ViewMode::Edit,
            _ => ViewMode::Split,
        };
    }
    if save_requested {
        app.save_active_note();
    }
    if template_requested {
        app.open_insert_template_picker();
    }
    if properties_requested {
        app.properties_editor_open = !app.properties_editor_open;
    }
    if rename_requested {
        if let Some(active) = &app.active_note {
            app.rename_note_dialog
                .open(active.abs_path.clone(), active.rel_path.clone());
        }
    }
    if delete_requested {
        if let Some(active) = &app.active_note {
            app.request_delete_note(active.abs_path.clone(), active.title.clone());
        }
    }
    if let Some((path, title)) = tab_delete {
        app.request_delete_note(path, title);
    }
}

fn render_inline_properties(
    ui: &mut egui::Ui,
    content: &mut String,
    key_draft: &mut String,
    value_draft: &mut String,
    properties_open: &mut bool,
) {
    let metadata = crate::metadata::parse_note(content);
    let has_properties = !metadata.properties.is_empty() || !metadata.frontmatter_tags.is_empty();
    if !*properties_open && !has_properties {
        return;
    }

    let mut edits: Vec<(String, Option<String>)> = Vec::new();
    egui::Frame::none()
        .fill(Theme::BG_CARD)
        .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
        .rounding(egui::Rounding::same(6.0))
        .inner_margin(egui::Margin::symmetric(14.0, 10.0))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new("PROPERTIES")
                        .strong()
                        .size(10.0)
                        .color(Theme::TEXT_DIMMED),
                );
                ui.label(
                    RichText::new("YAML Frontmatter")
                        .size(10.0)
                        .color(Theme::TEXT_MUTED),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui
                        .small_button("×")
                        .on_hover_text("Hide properties")
                        .clicked()
                    {
                        *properties_open = false;
                    }
                });
            });
            ui.add_space(6.0);
            for (key, value) in metadata.properties {
                ui.horizontal(|ui| {
                    ui.label(RichText::new(&key).size(11.5).color(Theme::TEXT_MUTED));
                    let mut draft = value;
                    if ui
                        .add(
                            egui::TextEdit::singleline(&mut draft)
                                .desired_width(ui.available_width() - 28.0),
                        )
                        .changed()
                    {
                        edits.push((key.clone(), Some(draft)));
                    }
                    if ui
                        .small_button("x")
                        .on_hover_text("Remove property")
                        .clicked()
                    {
                        edits.push((key, None));
                    }
                });
            }
            let mut tags = metadata.frontmatter_tags.join(", ");
            ui.horizontal(|ui| {
                ui.label(RichText::new("tags").size(11.5).color(Theme::TEXT_MUTED));
                if ui
                    .add(
                        egui::TextEdit::singleline(&mut tags)
                            .hint_text("work, ideas")
                            .desired_width(ui.available_width() - 28.0),
                    )
                    .changed()
                {
                    edits.push(("tags".to_string(), Some(tags)));
                }
                if !metadata.frontmatter_tags.is_empty()
                    && ui
                        .small_button("x")
                        .on_hover_text("Remove tags property")
                        .clicked()
                {
                    edits.push(("tags".to_string(), None));
                }
            });
            ui.horizontal(|ui| {
                ui.add(
                    egui::TextEdit::singleline(key_draft)
                        .hint_text("New key")
                        .desired_width(120.0),
                );
                ui.add(
                    egui::TextEdit::singleline(value_draft)
                        .hint_text("Value")
                        .desired_width(ui.available_width() - 70.0),
                );
                if ui.small_button("+ Add").clicked() {
                    let key = key_draft.trim().to_string();
                    if !key.is_empty() {
                        edits.push((key, Some(value_draft.clone())));
                        key_draft.clear();
                        value_draft.clear();
                    }
                }
            });
        });
    for (key, value) in edits {
        if let Some(updated) =
            crate::metadata::set_frontmatter_property(content, &key, value.as_deref())
        {
            *content = updated;
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum EditorActionIcon {
    Book,
    Pen,
    Split,
}

fn paint_editor_icon_button(
    ui: &mut egui::Ui,
    icon: EditorActionIcon,
    tooltip: &str,
) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(egui::vec2(22.0, 22.0), egui::Sense::click());
    if response.hovered() {
        ui.painter().rect_filled(rect, 3.0, Theme::BG_CARD);
    }
    let color = if response.hovered() {
        Theme::TEXT_PRIMARY
    } else {
        Theme::TEXT_MUTED
    };
    let stroke = Stroke::new(1.3_f32, color);
    let c = rect.center();
    let painter = ui.painter();

    match icon {
        EditorActionIcon::Book => {
            let left_spine = c + egui::vec2(-0.8, 3.5);
            let right_spine = c + egui::vec2(0.8, 3.5);
            painter.line_segment(
                [c + egui::vec2(-5.5, -3.5), c + egui::vec2(-0.8, -2.5)],
                stroke,
            );
            painter.line_segment([c + egui::vec2(-0.8, -2.5), left_spine], stroke);
            painter.line_segment([left_spine, c + egui::vec2(-5.5, 2.5)], stroke);
            painter.line_segment(
                [c + egui::vec2(-5.5, 2.5), c + egui::vec2(-5.5, -3.5)],
                stroke,
            );

            painter.line_segment(
                [c + egui::vec2(0.8, -2.5), c + egui::vec2(5.5, -3.5)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(5.5, -3.5), c + egui::vec2(5.5, 2.5)],
                stroke,
            );
            painter.line_segment([c + egui::vec2(5.5, 2.5), right_spine], stroke);
            painter.line_segment([right_spine, c + egui::vec2(0.8, -2.5)], stroke);
        }
        EditorActionIcon::Pen => {
            painter.line_segment(
                [c + egui::vec2(-3.5, 3.5), c + egui::vec2(-4.5, 4.5)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(-3.5, 3.5), c + egui::vec2(3.0, -3.0)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(-2.0, 5.0), c + egui::vec2(4.5, -1.5)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(3.0, -3.0), c + egui::vec2(4.5, -1.5)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(-4.5, 4.5), c + egui::vec2(-2.0, 5.0)],
                stroke,
            );
        }
        EditorActionIcon::Split => {
            let r = egui::Rect::from_center_size(c, egui::vec2(12.0, 11.0));
            painter.rect_stroke(r, 1.5, stroke);
            painter.line_segment(
                [c + egui::vec2(0.0, -5.5), c + egui::vec2(0.0, 5.5)],
                stroke,
            );
        }
    }
    response.on_hover_text(tooltip)
}

fn render_welcome_screen(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let vault_info = app.vault.as_ref().map(|vault| {
        let name = vault
            .root_path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| "Vault".to_string());
        (name, vault.notes.len())
    });
    let notes = app
        .vault
        .as_ref()
        .map(|vault| vault.notes.iter().take(6).cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    let mut note_to_open = None;
    let mut show_graph = false;

    ui.vertical_centered(|ui| {
        ui.add_space((ui.available_height() * 0.08).clamp(20.0, 56.0));
        egui::Frame::none()
            .fill(Theme::BG_CARD)
            .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
            .rounding(egui::Rounding::same(8.0))
            .inner_margin(egui::Margin::symmetric(32.0, 28.0))
            .show(ui, |ui| {
                ui.set_max_width(560.0);
                ui.vertical_centered(|ui| {
                    paint_app_mark(ui, 44.0);
                    ui.add_space(12.0);
                    ui.label(
                        RichText::new(if let Some((_, count)) = &vault_info {
                            if *count == 0 {
                                "Your vault is ready"
                            } else {
                                "Better Obsidian"
                            }
                        } else {
                            "Better Obsidian"
                        })
                        .size(22.0)
                        .strong()
                        .color(Theme::TEXT_PRIMARY),
                    );
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(match &vault_info {
                            Some((name, 0)) => {
                                format!("{} is open. Create your first note to get started.", name)
                            }
                            Some((name, count)) => {
                                format!("{} is open with {} notes.", name, count)
                            }
                            None => "Open a Markdown vault folder to start writing.".to_string(),
                        })
                        .size(12.5)
                        .color(Theme::TEXT_MUTED),
                    );
                    ui.add_space(18.0);
                    if vault_info.is_some() {
                        ui.horizontal(|ui| {
                            if ui
                                .add(egui::Button::new(RichText::new("+ Create a note").strong()))
                                .clicked()
                            {
                                app.open_new_note_dialog();
                            }
                            if !notes.is_empty() && ui.button("Explore graph").clicked() {
                                show_graph = true;
                            }
                            if ui.button("Switch vault · Ctrl+O").clicked() {
                                app.pick_and_open_vault();
                            }
                        });
                        if !notes.is_empty() {
                            ui.add_space(16.0);
                            ui.label(
                                RichText::new("RECENT NOTES")
                                    .strong()
                                    .size(10.0)
                                    .color(Theme::TEXT_DIMMED),
                            );
                            ui.add_space(6.0);
                            for note in &notes {
                                if ui
                                    .add_sized(
                                        [ui.available_width(), 28.0],
                                        egui::Button::new(
                                            RichText::new(&note.title).color(Theme::TEXT_PRIMARY),
                                        ),
                                    )
                                    .clicked()
                                {
                                    note_to_open = Some(note.abs_path.clone());
                                }
                            }
                        }
                    } else {
                        if ui
                            .add_sized(
                                [180.0, 34.0],
                                egui::Button::new(RichText::new("Open vault folder").strong()),
                            )
                            .clicked()
                        {
                            app.pick_and_open_vault();
                        }

                        ui.add_space(16.0);
                        ui.separator();
                        ui.add_space(12.0);

                        if !app.config.recent_vaults.is_empty() {
                            ui.label(
                                RichText::new("RECENT VAULTS")
                                    .strong()
                                    .size(10.0)
                                    .color(Theme::TEXT_DIMMED),
                            );
                            ui.add_space(8.0);
                            let recent = app.config.recent_vaults.clone();
                            let mut vault_to_open = None;
                            for vault_path in &recent {
                                if vault_path.exists() {
                                    let display_name = vault_path
                                        .file_name()
                                        .map(|s| s.to_string_lossy().to_string())
                                        .unwrap_or_else(|| {
                                            vault_path.to_string_lossy().to_string()
                                        });
                                    if ui
                                        .add_sized(
                                            [ui.available_width(), 34.0],
                                            egui::Button::new(
                                                RichText::new(format!(
                                                    "{}     {}",
                                                    display_name,
                                                    vault_path.display()
                                                ))
                                                .color(Theme::TEXT_PRIMARY),
                                            ),
                                        )
                                        .clicked()
                                    {
                                        vault_to_open = Some(vault_path.clone());
                                    }
                                }
                            }
                            if let Some(path) = vault_to_open {
                                app.open_vault(path);
                            }
                        } else {
                            ui.label(
                                RichText::new("Tip: use Ctrl + O anytime to switch vaults.")
                                    .size(12.0)
                                    .color(Theme::TEXT_DIMMED),
                            );
                        }
                    }
                });
            });
    });
    if let Some(path) = note_to_open {
        app.request_open_note(path);
    }
    if show_graph {
        app.sidebar_tab = crate::ui::sidebar::SidebarTab::Graph;
    }
}

fn find_search_matches(content: &str, query: &str, case_sensitive: bool) -> Vec<(usize, usize)> {
    if query.is_empty() {
        return Vec::new();
    }
    let chars: Vec<char> = content.chars().collect();
    let q_chars: Vec<char> = query.chars().collect();
    if q_chars.is_empty() || chars.len() < q_chars.len() {
        return Vec::new();
    }
    let q_len = q_chars.len();
    let mut matches = Vec::new();
    if case_sensitive {
        for i in 0..=(chars.len() - q_len) {
            if chars[i..i + q_len] == q_chars[..] {
                matches.push((i, i + q_len));
            }
        }
    } else {
        let q_lower: Vec<char> = query.to_lowercase().chars().collect();
        let c_lower: Vec<char> = content.to_lowercase().chars().collect();
        if c_lower.len() < q_lower.len() {
            return Vec::new();
        }
        let q_len = q_lower.len();
        for i in 0..=(c_lower.len() - q_len) {
            if c_lower[i..i + q_len] == q_lower[..] {
                matches.push((i, i + q_len));
            }
        }
    }
    matches
}

fn render_in_note_search_bar(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let Some(active) = &app.active_note else {
        return;
    };
    let content = active.content.clone();
    let query = app.in_note_search_query.clone();
    let case_sensitive = app.in_note_search_case_sensitive;
    let matches = find_search_matches(&content, &query, case_sensitive);

    let editor_id = ui.make_persistent_id(("editor_full", active.abs_path.clone()));

    egui::Frame::none()
        .fill(Theme::BG_CARD)
        .stroke(Stroke::new(1.0_f32, Theme::BORDER))
        .rounding(egui::Rounding {
            nw: 0.0,
            ne: 0.0,
            sw: 6.0,
            se: 6.0,
        })
        .inner_margin(egui::Margin::symmetric(12.0, 4.0))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(RichText::new("Find").size(11.0).color(Theme::TEXT_MUTED));
                let search_resp = ui.add(
                    TextEdit::singleline(&mut app.in_note_search_query)
                        .hint_text("Find in note…")
                        .desired_width(160.0),
                );

                if app.in_note_search_focus {
                    search_resp.request_focus();
                    app.in_note_search_focus = false;
                }

                let enter = search_resp.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter));
                let shift = ui.input(|i| i.modifiers.shift);

                if !query.is_empty() {
                    let total = matches.len();
                    if total > 0 {
                        if app.in_note_search_match_idx >= total {
                            app.in_note_search_match_idx = 0;
                        }
                        ui.label(
                            RichText::new(format!(
                                "{}/{}",
                                app.in_note_search_match_idx + 1,
                                total
                            ))
                            .size(11.0)
                            .color(Theme::TEXT_MUTED),
                        );
                    } else {
                        ui.label(RichText::new("0/0").size(11.0).color(Theme::ACCENT_RED));
                    }

                    let mut jump_idx = None;

                    if ui
                        .small_button("<")
                        .on_hover_text("Previous match · Shift+Enter")
                        .clicked()
                        || (enter && shift)
                    {
                        if total > 0 {
                            app.in_note_search_match_idx = if app.in_note_search_match_idx == 0 {
                                total - 1
                            } else {
                                app.in_note_search_match_idx - 1
                            };
                            jump_idx = Some(app.in_note_search_match_idx);
                        }
                    }

                    if ui
                        .small_button(">")
                        .on_hover_text("Next match · Enter")
                        .clicked()
                        || (enter && !shift)
                    {
                        if total > 0 {
                            app.in_note_search_match_idx =
                                (app.in_note_search_match_idx + 1) % total;
                            jump_idx = Some(app.in_note_search_match_idx);
                        }
                    }

                    if search_resp.changed() && total > 0 {
                        app.in_note_search_match_idx = 0;
                        jump_idx = Some(0);
                    }

                    if let Some(idx) = jump_idx {
                        if let Some(&(s, e)) = matches.get(idx) {
                            let mut state =
                                egui::widgets::text_edit::TextEditState::load(ui.ctx(), editor_id)
                                    .unwrap_or_default();
                            state.cursor.set_char_range(Some(CCursorRange::two(
                                CCursor::new(s),
                                CCursor::new(e),
                            )));
                            state.store(ui.ctx(), editor_id);
                        }
                    }
                }

                if ui
                    .selectable_label(app.in_note_search_case_sensitive, "Aa")
                    .on_hover_text("Match case")
                    .clicked()
                {
                    app.in_note_search_case_sensitive = !app.in_note_search_case_sensitive;
                }

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui
                        .small_button("×")
                        .on_hover_text("Close find · Esc")
                        .clicked()
                    {
                        app.in_note_search_open = false;
                    }
                });
            });
        });
}
