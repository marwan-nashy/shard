use super::theme::Theme;
use crate::app::BetterObsidianApp;
use crate::ui::modals::DeleteTarget;
use egui::{Color32, RichText, ScrollArea, Stroke, TextEdit};
use std::collections::BTreeMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SidebarTab {
    Notes,
    Search,
    #[allow(dead_code)]
    Backlinks,
    Graph,
    Tags,
    #[allow(dead_code)]
    Outline,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RightSidebarTab {
    Outline,
    Backlinks,
    Tags,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum RibbonAction {
    Tab(SidebarTab),
    Daily,
    Template,
}

pub fn render_activity_ribbon(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    ui.vertical(|ui| {
        // Top global workspace actions & explorer tabs
        let ribbon_items: [(RibbonAction, &str); 6] = [
            (RibbonAction::Tab(SidebarTab::Notes), "Files"),
            (RibbonAction::Tab(SidebarTab::Search), "Search · Ctrl+F"),
            (RibbonAction::Tab(SidebarTab::Tags), "Tags"),
            (RibbonAction::Tab(SidebarTab::Graph), "Graph view · Ctrl+G"),
            (RibbonAction::Daily, "Open today's daily note · Ctrl+D"),
            (RibbonAction::Template, "Insert template"),
        ];

        for (action, label) in ribbon_items {
            let is_selected = match action {
                RibbonAction::Tab(tab) => app.sidebar_tab == tab && app.left_sidebar_open,
                _ => false,
            };

            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(34.0, 32.0), egui::Sense::click());
            let color = if is_selected {
                Theme::ACCENT_BLUE
            } else if response.hovered() {
                Theme::TEXT_PRIMARY
            } else {
                Theme::TEXT_MUTED
            };

            if is_selected {
                ui.painter().rect_filled(rect, 4.0, Theme::BG_CARD);
                // 2.5px blue vertical indicator on the left edge
                ui.painter().line_segment(
                    [
                        rect.left_top() + egui::vec2(0.5, 4.0),
                        rect.left_bottom() + egui::vec2(0.5, -4.0),
                    ],
                    Stroke::new(2.5_f32, Theme::ACCENT_BLUE),
                );
            } else if response.hovered() {
                ui.painter()
                    .rect_filled(rect, 4.0, Color32::from_rgb(36, 36, 36));
            }

            paint_ribbon_action_icon(ui.painter(), action, rect.center(), color);

            if response.clicked() {
                match action {
                    RibbonAction::Tab(tab) => {
                        if app.sidebar_tab == tab && app.left_sidebar_open {
                            app.left_sidebar_open = false;
                        } else {
                            app.sidebar_tab = tab;
                            app.left_sidebar_open = true;
                            if tab == SidebarTab::Search {
                                app.focus_search_next_frame = true;
                            }
                        }
                    }
                    RibbonAction::Daily => {
                        app.open_daily_note();
                    }
                    RibbonAction::Template => {
                        app.open_insert_template_picker();
                    }
                }
            }
            response.on_hover_text(label);
            ui.add_space(2.0);
        }

        // Bottom ribbon actions
        ui.with_layout(egui::Layout::bottom_up(egui::Align::Center), |ui| {
            ui.add_space(4.0);

            // Shortcuts / Help (?)
            let (h_rect, h_resp) =
                ui.allocate_exact_size(egui::vec2(34.0, 32.0), egui::Sense::click());
            let h_color = if h_resp.hovered() {
                Theme::TEXT_PRIMARY
            } else {
                Theme::TEXT_DIMMED
            };
            if h_resp.hovered() {
                ui.painter().rect_filled(h_rect, 4.0, Theme::BG_CARD);
            }
            paint_help_icon(ui.painter(), h_rect.center(), h_color);
            if h_resp.clicked() {
                app.show_shortcuts = true;
            }
            h_resp.on_hover_text("Keyboard shortcuts");

            // Open Vault folder
            let (v_rect, v_resp) =
                ui.allocate_exact_size(egui::vec2(34.0, 32.0), egui::Sense::click());
            let v_color = if v_resp.hovered() {
                Theme::TEXT_PRIMARY
            } else {
                Theme::TEXT_DIMMED
            };
            if v_resp.hovered() {
                ui.painter().rect_filled(v_rect, 4.0, Theme::BG_CARD);
            }
            paint_vault_icon(ui.painter(), v_rect.center(), v_color);
            if v_resp.clicked() {
                app.pick_and_open_vault();
            }
            v_resp.on_hover_text("Open vault folder · Ctrl+O");

            // Command Palette (>_)
            let (p_rect, p_resp) =
                ui.allocate_exact_size(egui::vec2(34.0, 32.0), egui::Sense::click());
            let p_color = if p_resp.hovered() {
                Theme::TEXT_PRIMARY
            } else {
                Theme::TEXT_DIMMED
            };
            if p_resp.hovered() {
                ui.painter().rect_filled(p_rect, 4.0, Theme::BG_CARD);
            }
            paint_prompt_icon(ui.painter(), p_rect.center(), p_color);
            if p_resp.clicked() {
                app.command_palette.is_open = true;
            }
            p_resp.on_hover_text("Command palette · Ctrl+P");
        });
    });
}

pub fn render_sidebar_pane(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    ui.horizontal(|ui| {
        let pane_title = match app.sidebar_tab {
            SidebarTab::Notes => "FILES",
            SidebarTab::Search => "SEARCH",
            SidebarTab::Backlinks => "BACKLINKS",
            SidebarTab::Graph => "GRAPH",
            SidebarTab::Tags => "TAGS",
            SidebarTab::Outline => "OUTLINE",
        };

        ui.label(
            RichText::new(pane_title)
                .strong()
                .size(10.5)
                .color(Theme::TEXT_DIMMED),
        );

        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if app.sidebar_tab == SidebarTab::Notes {
                // New note button
                let (r, resp) =
                    ui.allocate_exact_size(egui::vec2(20.0, 20.0), egui::Sense::click());
                if resp.hovered() {
                    ui.painter().rect_filled(r, 3.0, Theme::BG_CARD);
                }
                let color = if resp.hovered() {
                    Theme::TEXT_PRIMARY
                } else {
                    Theme::TEXT_MUTED
                };
                let stroke = Stroke::new(1.3_f32, color);
                let c = r.center();
                ui.painter().line_segment(
                    [c + egui::vec2(-4.0, 0.0), c + egui::vec2(4.0, 0.0)],
                    stroke,
                );
                ui.painter().line_segment(
                    [c + egui::vec2(0.0, -4.0), c + egui::vec2(0.0, 4.0)],
                    stroke,
                );
                if resp.clicked() {
                    app.open_new_note_dialog();
                }
                resp.on_hover_text("New note · Ctrl+N");
            }
        });
    });

    ui.add_space(4.0);
    ui.painter().line_segment(
        [
            egui::pos2(ui.min_rect().min.x, ui.cursor().top()),
            egui::pos2(ui.min_rect().max.x, ui.cursor().top()),
        ],
        Stroke::new(1.0_f32, Theme::BORDER),
    );
    ui.add_space(4.0);

    match app.sidebar_tab {
        SidebarTab::Notes => render_notes_tab(ui, app),
        SidebarTab::Search => render_search_tab(ui, app),
        SidebarTab::Backlinks => render_backlinks_tab(ui, app),
        SidebarTab::Graph => {
            let count = app.vault.as_ref().map_or(0, |vault| vault.notes.len());
            ui.label(
                RichText::new(format!("Explore links across {count} notes."))
                    .color(Theme::TEXT_PRIMARY)
                    .size(12.0),
            );
            ui.add_space(4.0);
            ui.label(
                RichText::new("Drag to pan · scroll to zoom · click a note to open")
                    .size(11.0)
                    .color(Theme::TEXT_MUTED),
            );
            ui.add_space(8.0);
            ui.label(
                RichText::new(if app.active_note.is_some() {
                    "Choose Local or Global above the graph canvas."
                } else {
                    "Open a note to focus the graph on its connections."
                })
                .size(11.0)
                .color(Theme::TEXT_MUTED),
            );
        }
        SidebarTab::Tags => render_tags_tab(ui, app),
        SidebarTab::Outline => render_outline_tab(ui, app),
    }
}

pub fn render_right_sidebar(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    ui.horizontal(|ui| {
        for (tab, name) in [
            (RightSidebarTab::Outline, "Outline"),
            (RightSidebarTab::Backlinks, "Backlinks"),
            (RightSidebarTab::Tags, "Tags"),
        ] {
            let active = app.right_sidebar_tab == tab;
            let resp = ui.selectable_label(active, name);
            if resp.clicked() {
                app.right_sidebar_tab = tab;
                if tab == RightSidebarTab::Backlinks {
                    app.refresh_backlinks();
                }
            }
        }
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if ui.small_button("×").on_hover_text("Close panel").clicked() {
                app.right_sidebar_open = false;
            }
        });
    });
    ui.add_space(4.0);
    ui.painter().line_segment(
        [
            egui::pos2(ui.min_rect().min.x, ui.cursor().top()),
            egui::pos2(ui.min_rect().max.x, ui.cursor().top()),
        ],
        Stroke::new(1.0_f32, Theme::BORDER),
    );
    ui.add_space(4.0);

    match app.right_sidebar_tab {
        RightSidebarTab::Outline => render_outline_tab(ui, app),
        RightSidebarTab::Backlinks => render_backlinks_tab(ui, app),
        RightSidebarTab::Tags => render_tags_tab(ui, app),
    }
}

fn paint_prompt_icon(painter: &egui::Painter, c: egui::Pos2, color: Color32) {
    let stroke = Stroke::new(1.4_f32, color);
    painter.line_segment(
        [c + egui::vec2(-4.0, -4.0), c + egui::vec2(-1.0, -1.0)],
        stroke,
    );
    painter.line_segment(
        [c + egui::vec2(-1.0, -1.0), c + egui::vec2(-4.0, 2.0)],
        stroke,
    );
    painter.line_segment([c + egui::vec2(0.0, 2.0), c + egui::vec2(4.0, 2.0)], stroke);
}

fn paint_vault_icon(painter: &egui::Painter, c: egui::Pos2, color: Color32) {
    let stroke = Stroke::new(1.4_f32, color);
    painter.rect_stroke(
        egui::Rect::from_center_size(c, egui::vec2(14.0, 11.0)),
        2.0,
        stroke,
    );
    painter.line_segment(
        [c + egui::vec2(-7.0, -1.0), c + egui::vec2(7.0, -1.0)],
        stroke,
    );
}

fn paint_help_icon(painter: &egui::Painter, c: egui::Pos2, color: Color32) {
    let stroke = Stroke::new(1.3_f32, color);
    painter.line_segment(
        [c + egui::vec2(-3.0, -4.0), c + egui::vec2(1.0, -4.0)],
        stroke,
    );
    painter.line_segment(
        [c + egui::vec2(1.0, -4.0), c + egui::vec2(2.5, -2.0)],
        stroke,
    );
    painter.line_segment(
        [c + egui::vec2(2.5, -2.0), c + egui::vec2(0.0, 0.5)],
        stroke,
    );
    painter.line_segment([c + egui::vec2(0.0, 0.5), c + egui::vec2(0.0, 2.0)], stroke);
    painter.circle_filled(c + egui::vec2(0.0, 4.5), 1.1, color);
}

fn paint_ribbon_action_icon(
    painter: &egui::Painter,
    action: RibbonAction,
    center: egui::Pos2,
    color: Color32,
) {
    let stroke = Stroke::new(1.4_f32, color);
    let c = center;
    match action {
        RibbonAction::Tab(tab) => paint_sidebar_icon(painter, tab, center, color),
        RibbonAction::Daily => {
            let r = egui::Rect::from_center_size(c, egui::vec2(12.0, 12.0));
            painter.rect_stroke(r, 1.5, stroke);
            painter.line_segment(
                [c + egui::vec2(-6.0, -2.5), c + egui::vec2(6.0, -2.5)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(-3.0, -7.0), c + egui::vec2(-3.0, -5.0)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(3.0, -7.0), c + egui::vec2(3.0, -5.0)],
                stroke,
            );
        }
        RibbonAction::Template => {
            let r = egui::Rect::from_center_size(c, egui::vec2(11.0, 13.0));
            painter.rect_stroke(r, 1.5, stroke);
            painter.line_segment(
                [c + egui::vec2(-3.0, -2.5), c + egui::vec2(3.0, -2.5)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(-3.0, 0.5), c + egui::vec2(3.0, 0.5)],
                stroke,
            );
            painter.line_segment(
                [c + egui::vec2(-3.0, 3.5), c + egui::vec2(1.0, 3.5)],
                stroke,
            );
        }
    }
}

fn paint_sidebar_icon(
    painter: &egui::Painter,
    tab: SidebarTab,
    center: egui::Pos2,
    color: Color32,
) {
    let stroke = Stroke::new(1.6_f32, color);
    let point = |x: f32, y: f32| center + egui::vec2(x, y);
    match tab {
        SidebarTab::Notes => {
            let folder = [
                (-8.0, -4.0),
                (-4.0, -4.0),
                (-2.0, -7.0),
                (4.0, -7.0),
                (5.0, -4.0),
                (8.0, -4.0),
                (7.0, 7.0),
                (-7.0, 7.0),
            ];
            for index in 0..folder.len() {
                let start = folder[index];
                let end = folder[(index + 1) % folder.len()];
                painter.line_segment([point(start.0, start.1), point(end.0, end.1)], stroke);
            }
            painter.line_segment([point(-6.0, 0.0), point(6.0, 0.0)], stroke);
        }
        SidebarTab::Search => {
            painter.circle_stroke(point(-2.0, -2.0), 5.5, stroke);
            painter.line_segment([point(2.0, 2.0), point(7.0, 7.0)], stroke);
        }
        SidebarTab::Backlinks => {
            painter.line_segment([point(-6.0, 6.0), point(5.0, -5.0)], stroke);
            painter.line_segment([point(0.0, -5.0), point(5.0, -5.0)], stroke);
            painter.line_segment([point(5.0, -5.0), point(5.0, 0.0)], stroke);
            painter.circle_filled(point(-6.0, 6.0), 2.0, color);
        }
        SidebarTab::Graph => {
            let nodes = [(-6.0, -5.0), (5.0, -4.0), (0.0, 6.0)];
            for (from, to) in [(0, 1), (0, 2), (1, 2)] {
                painter.line_segment(
                    [
                        point(nodes[from].0, nodes[from].1),
                        point(nodes[to].0, nodes[to].1),
                    ],
                    stroke,
                );
            }
            for (x, y) in nodes {
                painter.circle_filled(point(x, y), 2.5, color);
            }
        }
        SidebarTab::Tags => {
            let vertices = [
                (-8.0, -5.0),
                (1.0, -7.0),
                (8.0, 0.0),
                (1.0, 7.0),
                (-8.0, 5.0),
            ];
            for index in 0..vertices.len() {
                let start = vertices[index];
                let end = vertices[(index + 1) % vertices.len()];
                painter.line_segment([point(start.0, start.1), point(end.0, end.1)], stroke);
            }
            painter.circle_filled(point(-4.0, 0.0), 1.4, color);
        }
        SidebarTab::Outline => {
            for (y, end_x) in [(-6.0, 5.0), (0.0, 8.0), (6.0, 3.0)] {
                painter.circle_filled(point(-7.0, y), 1.2, color);
                painter.line_segment([point(-3.0, y), point(end_x, y)], stroke);
            }
        }
    }
}

fn render_outline_tab(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let Some(content) = app.active_note.as_ref().map(|note| note.content.as_str()) else {
        ui.label(RichText::new("Open a note to see its outline.").color(Theme::TEXT_MUTED));
        return;
    };
    let headings = crate::metadata::extract_headings(content);
    if headings.is_empty() {
        ui.label(
            RichText::new("Add Markdown headings to build an outline.").color(Theme::TEXT_MUTED),
        );
        return;
    }
    let mut jump = None;
    ScrollArea::vertical()
        .id_salt("sidebar_outline_scroll")
        .show(ui, |ui| {
            for (level, title, char_offset) in headings {
                ui.horizontal(|ui| {
                    ui.add_space(f32::from(level.saturating_sub(1)) * 9.0);
                    if ui.selectable_label(false, title).clicked() {
                        jump = Some(char_offset);
                    }
                });
            }
        });
    if let Some(char_offset) = jump {
        app.pending_heading_jump = Some(char_offset);
        if app.view_mode == crate::ui::editor::ViewMode::Preview {
            app.view_mode = crate::ui::editor::ViewMode::Edit;
        }
    }
}

fn render_notes_tab(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    if app.vault.is_none() {
        egui::Frame::none()
            .fill(Theme::BG_CARD)
            .rounding(egui::Rounding::same(6.0))
            .inner_margin(egui::Margin::symmetric(14.0, 16.0))
            .show(ui, |ui| {
                ui.label(
                    RichText::new("No vault open")
                        .strong()
                        .size(13.0)
                        .color(Theme::TEXT_PRIMARY),
                );
                ui.add_space(4.0);
                ui.label(
                    RichText::new("Open a Markdown folder to view its files.")
                        .size(11.0)
                        .color(Theme::TEXT_MUTED),
                );
                ui.add_space(10.0);
                if ui.button("Choose a vault folder").clicked() {
                    app.pick_and_open_vault();
                }
            });
        return;
    }

    ui.horizontal(|ui| {
        let has_filter = !app.notes_filter.is_empty();
        let avail = ui.available_width() - if has_filter { 24.0 } else { 0.0 };
        ui.add(
            TextEdit::singleline(&mut app.notes_filter)
                .hint_text("Filter...")
                .desired_width(avail.max(40.0)),
        );
        if has_filter {
            if ui.small_button("x").on_hover_text("Clear filter").clicked() {
                app.notes_filter.clear();
            }
        }
    });

    ui.add_space(4.0);

    let is_empty = app
        .vault
        .as_ref()
        .map(|v| v.notes.is_empty() && v.canvases.is_empty())
        .unwrap_or(true);
    if is_empty {
        ui.vertical_centered(|ui| {
            ui.add_space(20.0);
            ui.label(RichText::new("No notes in vault").color(Theme::TEXT_MUTED));
            ui.add_space(8.0);
            if ui.button("+ Create first note").clicked() {
                app.open_new_note_dialog();
            }
        });
        return;
    }

    let filter_lower = app.notes_filter.to_lowercase();
    let active_path = app.active_note.as_ref().map(|a| a.abs_path.clone());

    let notes: Vec<(PathBuf, String, String)> = if let Some(v) = &app.vault {
        v.notes
            .iter()
            .filter(|n| {
                (filter_lower.is_empty()
                    || n.title.to_lowercase().contains(&filter_lower)
                    || n.rel_path.to_lowercase().contains(&filter_lower))
                    && app.selected_tag.as_ref().is_none_or(|tag| {
                        app.tag_explorer.tags.get(tag).is_some_and(|notes| {
                            notes.iter().any(|note| note.abs_path == n.abs_path)
                        })
                    })
            })
            .map(|n| (n.abs_path.clone(), n.title.clone(), n.rel_path.clone()))
            .collect()
    } else {
        Vec::new()
    };

    let mut tree = FolderNode::default();
    for note in notes {
        let parts: Vec<_> = note.2.split('/').collect();
        let (directories, _) = parts.split_at(parts.len().saturating_sub(1));
        let mut folder = &mut tree;
        for directory in directories {
            folder = folder
                .directories
                .entry((*directory).to_string())
                .or_default();
        }
        folder.notes.push((note.0, note.1, note.2));
    }

    let mut note_to_open = None;
    let mut canvas_to_open = None;
    let mut rename_request = None;
    let mut delete_request = None;

    ScrollArea::vertical()
        .id_salt("sidebar_notes_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 1.0;
            render_folder_contents(
                ui,
                &tree,
                "",
                0,
                active_path.as_ref(),
                &mut note_to_open,
                &mut rename_request,
                &mut delete_request,
            );
            if let Some(vault) = &app.vault {
                if !vault.canvases.is_empty() {
                    ui.add_space(8.0);
                    ui.label(
                        RichText::new("CANVASES")
                            .size(10.0)
                            .strong()
                            .color(Theme::TEXT_DIMMED),
                    );
                    ui.add_space(2.0);
                    for canvas in &vault.canvases {
                        let is_active = app
                            .active_canvas
                            .as_ref()
                            .is_some_and(|active| active.path == canvas.abs_path);
                        let (rect, response) = ui.allocate_exact_size(
                            egui::vec2(ui.available_width(), 22.0),
                            egui::Sense::click(),
                        );
                        if is_active {
                            ui.painter().rect_filled(rect, 4.0, Theme::BG_NOTE_ACTIVE);
                            ui.painter().line_segment(
                                [
                                    rect.left_top() + egui::vec2(1.0, 2.0),
                                    rect.left_bottom() + egui::vec2(1.0, -2.0),
                                ],
                                Stroke::new(2.5_f32, Theme::ACCENT_BLUE),
                            );
                        } else if response.hovered() {
                            ui.painter().rect_filled(rect, 4.0, Theme::BG_ROW_HOVER);
                        }
                        let text_color = if is_active {
                            Theme::ACCENT_BLUE
                        } else if response.hovered() {
                            Theme::TEXT_PRIMARY
                        } else {
                            Theme::TEXT_PRIMARY
                        };

                        // Small canvas icon (2x2 grid)
                        let ic = rect.left_center() + egui::vec2(8.0, 0.0);
                        let icon_stroke = Stroke::new(1.0_f32, text_color);
                        ui.painter().rect_stroke(
                            egui::Rect::from_center_size(ic, egui::vec2(10.0, 10.0)),
                            1.0,
                            icon_stroke,
                        );
                        ui.painter().line_segment(
                            [ic + egui::vec2(-5.0, 0.0), ic + egui::vec2(5.0, 0.0)],
                            icon_stroke,
                        );
                        ui.painter().line_segment(
                            [ic + egui::vec2(0.0, -5.0), ic + egui::vec2(0.0, 5.0)],
                            icon_stroke,
                        );

                        let text_pos = rect.left_center() + egui::vec2(20.0, 0.0);
                        ui.painter().text(
                            text_pos,
                            egui::Align2::LEFT_CENTER,
                            &canvas.title,
                            egui::FontId::proportional(12.5),
                            text_color,
                        );

                        if response.clicked() {
                            canvas_to_open = Some(canvas.abs_path.clone());
                        }
                        let response = response.on_hover_text(&canvas.rel_path);
                        response.context_menu(|ui| {
                            if ui
                                .button(RichText::new("Delete canvas…").color(Theme::ACCENT_RED))
                                .clicked()
                            {
                                delete_request = Some(DeleteTarget::Canvas(
                                    canvas.abs_path.clone(),
                                    canvas.title.clone(),
                                ));
                                ui.close_menu();
                            }
                        });
                    }
                }
            }
        });

    if let Some(path) = note_to_open {
        app.active_canvas = None;
        app.request_open_note(path);
    }
    if let Some(path) = canvas_to_open {
        app.open_canvas(&path);
    }
    if let Some((path, relative_path)) = rename_request {
        app.rename_note_dialog.open(path, relative_path);
    }
    if let Some(target) = delete_request {
        match target {
            DeleteTarget::Note(path, title) => app.request_delete_note(path, title),
            DeleteTarget::Canvas(path, title) => app.request_delete_canvas(path, title),
        }
    }
}

fn render_tags_tab(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let Some(vault) = app.vault.as_ref() else {
        ui.label(RichText::new("Open a vault to browse tags.").color(Theme::TEXT_MUTED));
        return;
    };
    let root = vault.root_path.clone();
    let notes = vault.notes.clone();
    if app.tag_explorer.poll(&root, &notes) {
        ui.ctx().request_repaint();
    } else if app.tag_explorer.is_loading() {
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(60));
    }
    ui.horizontal(|ui| {
        ui.label(
            RichText::new("TAGS")
                .strong()
                .size(10.0)
                .color(Theme::TEXT_DIMMED),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if ui
                .small_button("Refresh")
                .on_hover_text("Rescan vault tags")
                .clicked()
            {
                app.tag_explorer.invalidate();
            }
            if app.selected_tag.is_some() && ui.small_button("Clear").clicked() {
                app.selected_tag = None;
            }
        });
    });
    ui.add_space(6.0);
    if app.tag_explorer.is_loading() && app.tag_explorer.tags.is_empty() {
        ui.horizontal(|ui| {
            ui.spinner();
            ui.label(RichText::new("Reading tags on demand…").color(Theme::TEXT_MUTED));
        });
        return;
    }
    let tags: Vec<_> = app
        .tag_explorer
        .tags
        .iter()
        .map(|(tag, notes)| (tag.clone(), notes.clone()))
        .collect();
    if tags.is_empty() {
        ui.label(
            RichText::new("No tags found. Add #tags in a note or use a tags property.")
                .size(11.0)
                .color(Theme::TEXT_MUTED),
        );
        return;
    }
    let mut open_path = None;
    ScrollArea::vertical()
        .id_salt("sidebar_tags_scroll")
        .show(ui, |ui| {
            for (tag, notes) in tags {
                let selected = app.selected_tag.as_deref() == Some(&tag);
                if ui
                    .selectable_label(selected, format!("#{}   {}", tag, notes.len()))
                    .clicked()
                {
                    app.selected_tag = if selected { None } else { Some(tag.clone()) };
                    app.sidebar_tab = SidebarTab::Notes;
                }
                if selected {
                    for note in notes {
                        if ui.small_button(format!("  {}", note.title)).clicked() {
                            open_path = Some(note.abs_path);
                        }
                    }
                }
            }
        });
    if let Some(path) = open_path {
        app.request_open_note(path);
    }
}

#[derive(Default)]
struct FolderNode {
    directories: BTreeMap<String, FolderNode>,
    notes: Vec<(PathBuf, String, String)>,
}

fn render_folder_contents(
    ui: &mut egui::Ui,
    folder: &FolderNode,
    parent_path: &str,
    depth: usize,
    active_path: Option<&PathBuf>,
    note_to_open: &mut Option<PathBuf>,
    rename_request: &mut Option<(PathBuf, String)>,
    delete_request: &mut Option<DeleteTarget>,
) {
    let indent = (depth as f32) * 12.0;

    for (name, child) in &folder.directories {
        let path = if parent_path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", parent_path, name)
        };
        ui.horizontal(|ui| {
            if indent > 0.0 {
                ui.add_space(indent);
            }
            egui::CollapsingHeader::new(RichText::new(name).size(12.0).color(Theme::TEXT_PRIMARY))
                .id_salt(("vault_folder", path.clone()))
                .default_open(true)
                .show(ui, |ui| {
                    render_folder_contents(
                        ui,
                        child,
                        &path,
                        depth + 1,
                        active_path,
                        note_to_open,
                        rename_request,
                        delete_request,
                    );
                });
        });
    }

    for (abs_path, title, rel_path) in &folder.notes {
        let is_active = active_path.is_some_and(|active| active == abs_path);
        let avail_w = ui.available_width();
        let (rect, response) =
            ui.allocate_exact_size(egui::vec2(avail_w, 22.0), egui::Sense::click());

        if is_active {
            ui.painter().rect_filled(rect, 4.0, Theme::BG_NOTE_ACTIVE);
            ui.painter().line_segment(
                [
                    rect.left_top() + egui::vec2(1.0, 2.0),
                    rect.left_bottom() + egui::vec2(1.0, -2.0),
                ],
                Stroke::new(2.5_f32, Theme::ACCENT_BLUE),
            );
        } else if response.hovered() {
            ui.painter().rect_filled(rect, 4.0, Theme::BG_ROW_HOVER);
        }

        let text_color = if is_active {
            Theme::ACCENT_BLUE
        } else if response.hovered() {
            Theme::TEXT_PRIMARY
        } else {
            Theme::TEXT_PRIMARY
        };

        let x_offset = 8.0 + indent;
        let text_pos = rect.left_center() + egui::vec2(x_offset, 0.0);
        ui.painter().text(
            text_pos,
            egui::Align2::LEFT_CENTER,
            title,
            egui::FontId::proportional(12.5),
            text_color,
        );

        if response.clicked() {
            *note_to_open = Some(abs_path.clone());
        }
        let response = response.on_hover_text(rel_path);
        response.context_menu(|ui| {
            if ui.button("Rename note…").clicked() {
                *rename_request = Some((abs_path.clone(), rel_path.clone()));
                ui.close_menu();
            }
            if ui
                .button(RichText::new("Delete note…").color(Theme::ACCENT_RED))
                .clicked()
            {
                *delete_request = Some(DeleteTarget::Note(abs_path.clone(), title.clone()));
                ui.close_menu();
            }
        });
    }
}

fn render_search_tab(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let mut current_query = app.search_engine.query.clone();

    ui.horizontal(|ui| {
        let has_query = !current_query.is_empty();
        let avail = ui.available_width() - if has_query { 24.0 } else { 0.0 };
        let edit_resp = ui.add(
            TextEdit::singleline(&mut current_query)
                .hint_text("Search notes or content...")
                .desired_width(avail.max(40.0)),
        );
        if app.focus_search_next_frame {
            edit_resp.request_focus();
            app.focus_search_next_frame = false;
        }
        if edit_resp.changed() {
            app.search_engine.on_query_changed(current_query);
        }
        if has_query {
            if ui.small_button("x").on_hover_text("Clear search").clicked() {
                app.search_engine.on_query_changed(String::new());
            }
        }
    });

    ui.add_space(4.0);
    let mut search_content = app.search_engine.search_content;
    if ui
        .checkbox(&mut search_content, "Search file content")
        .changed()
    {
        app.search_engine.search_content = search_content;
        app.search_engine.schedule_current_query();
    }

    ui.add_space(4.0);
    ui.separator();
    ui.add_space(4.0);

    if app.search_engine.query.trim().is_empty() {
        ui.vertical_centered(|ui| {
            ui.add_space(20.0);
            ui.label(
                RichText::new("Type to search note titles and content.").color(Theme::TEXT_MUTED),
            );
            ui.label(
                RichText::new("Search runs on-demand without startup indexing.")
                    .color(Theme::TEXT_DIMMED)
                    .size(11.0),
            );
        });
        return;
    }

    if app.search_engine.is_searching {
        ui.label(RichText::new("Searching...").color(Theme::TEXT_MUTED));
        return;
    }

    if app.search_engine.results.is_empty() {
        ui.label(
            RichText::new(format!(
                "No matches found for '{}'",
                app.search_engine.active_query
            ))
            .color(Theme::TEXT_MUTED),
        );
        return;
    }

    ui.label(
        RichText::new(format!(
            "{} notes matched:",
            app.search_engine.results.len()
        ))
        .color(Theme::TEXT_MUTED)
        .size(12.0),
    );
    ui.add_space(4.0);

    let results = app.search_engine.results.clone();
    let active_path = app.active_note.as_ref().map(|a| a.abs_path.clone());
    let mut note_to_open = None;

    ScrollArea::vertical()
        .id_salt("sidebar_search_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 6.0;

            for res in results {
                let is_active = active_path
                    .as_ref()
                    .map(|p| p == &res.note.abs_path)
                    .unwrap_or(false);

                egui::Frame::none()
                    .fill(if is_active {
                        Color32::from_rgb(30, 52, 82)
                    } else {
                        Theme::BG_CARD
                    })
                    .rounding(egui::Rounding::same(4.0))
                    .inner_margin(egui::Margin::same(6.0))
                    .stroke(Stroke::new(
                        1.0_f32,
                        if is_active {
                            Theme::ACCENT_BLUE
                        } else {
                            Theme::BORDER
                        },
                    ))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(&res.note.title)
                                    .strong()
                                    .color(Theme::TEXT_PRIMARY),
                            );
                            if res.is_title_match {
                                ui.label(
                                    RichText::new("Title").size(10.0).color(Theme::ACCENT_BLUE),
                                );
                            }
                        });

                        ui.label(
                            RichText::new(&res.note.rel_path)
                                .size(11.0)
                                .color(Theme::TEXT_MUTED),
                        );

                        for (line_no, snippet) in res.line_matches.iter().take(3) {
                            ui.horizontal(|ui| {
                                ui.label(
                                    RichText::new(format!("L{}:", line_no))
                                        .monospace()
                                        .size(10.0)
                                        .color(Theme::TEXT_DIMMED),
                                );
                                ui.label(
                                    RichText::new(snippet).size(11.0).color(Theme::TEXT_PRIMARY),
                                );
                            });
                        }

                        if ui.button("Open note").clicked() {
                            note_to_open = Some(res.note.abs_path);
                        }
                    });
            }
        });

    if let Some(path) = note_to_open {
        app.request_open_note(path);
    }
}

fn render_backlinks_tab(ui: &mut egui::Ui, app: &mut BetterObsidianApp) {
    let (active_title, active_path) = match &app.active_note {
        Some(a) => (a.title.clone(), a.abs_path.clone()),
        None => {
            ui.vertical_centered(|ui| {
                ui.add_space(20.0);
                ui.label(RichText::new("No active note selected.").color(Theme::TEXT_MUTED));
                ui.label(
                    RichText::new("Select a note to inspect backlinks.")
                        .color(Theme::TEXT_DIMMED)
                        .size(11.0),
                );
            });
            return;
        }
    };

    if app.backlinks_target_path.as_ref() != Some(&active_path) {
        app.refresh_backlinks();
    }

    ui.horizontal(|ui| {
        ui.label(
            RichText::new(format!("Links to [[{}]]", active_title))
                .strong()
                .color(Theme::TEXT_PRIMARY),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if ui.small_button("Refresh").clicked() {
                app.refresh_backlinks();
            }
        });
    });

    ui.add_space(4.0);
    ui.separator();
    ui.add_space(4.0);

    if app.backlinks.is_empty() {
        ui.vertical_centered(|ui| {
            ui.add_space(16.0);
            ui.label(RichText::new("No backlinks found.").color(Theme::TEXT_MUTED));
            ui.add_space(4.0);
            ui.label(
                RichText::new(format!(
                    "Use [[{}]] in other notes to link here.",
                    active_title
                ))
                .color(Theme::TEXT_DIMMED)
                .size(11.0),
            );
        });
        return;
    }

    ui.label(
        RichText::new(format!("{} referencing notes found:", app.backlinks.len()))
            .color(Theme::TEXT_MUTED)
            .size(12.0),
    );
    ui.add_space(4.0);

    let backlinks = app.backlinks.clone();
    let mut note_to_open = None;

    ScrollArea::vertical()
        .id_salt("sidebar_backlinks_scroll")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 6.0;

            for link in backlinks {
                egui::Frame::none()
                    .fill(Theme::BG_CARD)
                    .rounding(egui::Rounding::same(4.0))
                    .inner_margin(egui::Margin::same(6.0))
                    .stroke(Stroke::new(1.0_f32, Theme::BORDER))
                    .show(ui, |ui| {
                        ui.label(
                            RichText::new(&link.source_note.title)
                                .strong()
                                .color(Theme::TEXT_PRIMARY),
                        );
                        ui.label(
                            RichText::new(&link.source_note.rel_path)
                                .size(11.0)
                                .color(Theme::TEXT_MUTED),
                        );

                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(format!("L{}:", link.line_number))
                                    .monospace()
                                    .size(10.0)
                                    .color(Theme::TEXT_DIMMED),
                            );
                            ui.label(
                                RichText::new(&link.snippet)
                                    .size(11.0)
                                    .color(Theme::TEXT_PRIMARY),
                            );
                        });

                        if ui.button("Navigate to note").clicked() {
                            note_to_open = Some(link.source_note.abs_path);
                        }
                    });
            }
        });

    if let Some(path) = note_to_open {
        app.request_open_note(path);
    }
}
