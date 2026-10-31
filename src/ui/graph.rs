use super::theme::Theme;
use crate::vault::{NoteItem, Vault};
use crate::wikilinks::extract_wikilinks;
use egui::{Align2, Color32, FontId, RichText, Sense, Stroke, TextEdit, Vec2};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver};
use std::thread;

#[derive(Clone)]
struct GraphNode {
    note: NoteItem,
    links: usize,
    backlinks: usize,
}

#[derive(Clone, Default)]
struct GraphData {
    nodes: Vec<GraphNode>,
    edges: Vec<(usize, usize)>,
    adjacency: Vec<Vec<usize>>,
}

pub struct GraphView {
    root_path: Option<PathBuf>,
    graph: Option<GraphData>,
    receiver: Option<Receiver<GraphData>>,
    layout_focus: Option<PathBuf>,
    positions: Vec<Vec2>,
    pub filter: String,
    pub local_only: bool,
    pub zoom: f32,
    pub pan: Vec2,
}

impl Default for GraphView {
    fn default() -> Self {
        Self {
            root_path: None,
            graph: None,
            receiver: None,
            layout_focus: None,
            positions: Vec::new(),
            filter: String::new(),
            local_only: false,
            zoom: 1.0,
            pan: Vec2::ZERO,
        }
    }
}

impl GraphView {
    pub fn invalidate(&mut self) {
        self.graph = None;
        self.layout_focus = None;
        self.positions.clear();
    }

    pub fn render(
        &mut self,
        ui: &mut egui::Ui,
        vault: Option<&Vault>,
        focus: Option<&PathBuf>,
    ) -> Option<PathBuf> {
        let Some(vault) = vault else {
            empty_state(ui, "Open a vault to see how your notes connect.");
            return None;
        };

        if self.root_path.as_ref() != Some(&vault.root_path) {
            self.root_path = Some(vault.root_path.clone());
            self.invalidate();
        }
        if let Some(receiver) = &self.receiver {
            if let Ok(graph) = receiver.try_recv() {
                self.graph = Some(graph);
                self.receiver = None;
                self.layout_focus = None;
            }
        }
        if self.graph.is_none() && self.receiver.is_none() {
            let (sender, receiver) = mpsc::channel();
            let notes = vault.notes.clone();
            thread::spawn(move || {
                let graph = build_graph(notes);
                let _ = sender.send(graph);
            });
            self.receiver = Some(receiver);
        }

        ui.horizontal(|ui| {
            ui.label(
                RichText::new("GRAPH VIEW")
                    .strong()
                    .size(10.0)
                    .color(Theme::TEXT_DIMMED),
            );
            ui.add_space(8.0);
            for (local, label) in [(false, "Global"), (true, "Local")] {
                let active = self.local_only == local;
                if ui.add(egui::Button::new(label).selected(active)).clicked() {
                    self.local_only = local;
                }
            }
            ui.add_space(6.0);
            ui.add(
                TextEdit::singleline(&mut self.filter)
                    .hint_text("Find a note")
                    .desired_width(140.0),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.small_button("Center").clicked() {
                    self.pan = Vec2::ZERO;
                    self.zoom = 1.0;
                }
            });
        });
        ui.add_space(8.0);

        let Some(graph) = self.graph.as_mut() else {
            ui.vertical_centered(|ui| {
                ui.add_space(32.0);
                ui.spinner();
                ui.add_space(8.0);
                ui.label(RichText::new("Mapping note links…").color(Theme::TEXT_MUTED));
            });
            ui.ctx()
                .request_repaint_after(std::time::Duration::from_millis(40));
            return None;
        };

        let focus_index = focus.and_then(|path| {
            graph
                .nodes
                .iter()
                .position(|node| &node.note.abs_path == path)
        });
        if self.layout_focus.as_ref() != focus {
            self.positions = layout_positions(graph, focus_index);
            self.layout_focus = focus.cloned();
        }
        if self.positions.len() != graph.nodes.len() {
            self.positions = layout_positions(graph, focus_index);
        }

        let available = ui.available_size().max(Vec2::splat(120.0));
        let (canvas, canvas_response) = ui.allocate_exact_size(available, Sense::drag());
        let painter = ui.painter_at(canvas);
        painter.rect_filled(canvas, 6.0, Color32::from_rgb(22, 22, 22));
        painter.rect_stroke(canvas, 6.0, Stroke::new(1.0_f32, Theme::BORDER));

        if canvas_response.dragged() {
            self.pan += ui.input(|input| input.pointer.delta());
        }
        if canvas_response.hovered() {
            let scroll = ui.input(|input| input.smooth_scroll_delta.y);
            if scroll.abs() > 0.0 {
                self.zoom = (self.zoom * (scroll * 0.0015).exp()).clamp(0.3, 3.0);
            }
        }

        let mut visible = vec![false; graph.nodes.len()];
        let filter = self.filter.trim().to_lowercase();
        for (index, node) in graph.nodes.iter().enumerate() {
            let matches_filter = filter.is_empty()
                || node.note.title.to_lowercase().contains(&filter)
                || node.note.rel_path.to_lowercase().contains(&filter);
            let matches_local = !self.local_only
                || focus_index
                    .is_some_and(|focus| index == focus || graph.adjacency[focus].contains(&index));
            visible[index] = matches_filter && matches_local;
        }

        let center = canvas.center() + self.pan;
        let to_screen = |position: Vec2| center + position * self.zoom;

        let mouse_pos = ui.input(|i| i.pointer.hover_pos());
        let mut hovered_node = None;
        if let Some(mouse) = mouse_pos {
            for (index, _node) in graph.nodes.iter().enumerate() {
                if !visible[index] {
                    continue;
                }
                let degree = graph.adjacency[index].len();
                let radius =
                    (6.0 + (degree as f32).sqrt() * 1.2_f32).clamp(6.0, 13.0) * self.zoom.sqrt();
                let position = to_screen(self.positions[index]);
                if mouse.distance(position) <= radius + 4.0 {
                    hovered_node = Some(index);
                    break;
                }
            }
        }

        for (source, target) in &graph.edges {
            if visible[*source] && visible[*target] {
                let is_highlighted = hovered_node.is_some_and(|h| h == *source || h == *target)
                    || focus_index.is_some_and(|f| f == *source || f == *target);
                let edge_stroke = if is_highlighted {
                    Stroke::new(1.6_f32, Theme::ACCENT_PURPLE)
                } else {
                    Stroke::new(1.0_f32, Color32::from_rgba_unmultiplied(75, 75, 85, 110))
                };
                painter.line_segment(
                    [
                        to_screen(self.positions[*source]),
                        to_screen(self.positions[*target]),
                    ],
                    edge_stroke,
                );
            }
        }

        let mut open_note = None;
        for (index, node) in graph.nodes.iter().enumerate() {
            if !visible[index] {
                continue;
            }
            let degree = graph.adjacency[index].len();
            let is_focus = Some(index) == focus_index;
            let is_hovered = Some(index) == hovered_node;
            let is_neighbor = hovered_node.is_some_and(|h| graph.adjacency[h].contains(&index))
                || focus_index.is_some_and(|f| graph.adjacency[f].contains(&index));

            let radius =
                (6.0 + (degree as f32).sqrt() * 1.2_f32).clamp(6.0, 13.0) * self.zoom.sqrt();
            let position = to_screen(self.positions[index]);
            if !canvas.expand(20.0).contains(position) {
                continue;
            }
            let node_rect = egui::Rect::from_center_size(position, Vec2::splat(radius * 3.2));
            let response = ui.interact(
                node_rect,
                ui.id().with(("graph_node", index)),
                Sense::click(),
            );

            let (fill_color, text_color) = if is_hovered {
                (Theme::ACCENT_PURPLE, Theme::TEXT_PRIMARY)
            } else if is_focus {
                (Theme::ACCENT_BLUE, Theme::TEXT_PRIMARY)
            } else if is_neighbor {
                (Color32::from_rgb(100, 130, 200), Theme::TEXT_PRIMARY)
            } else if degree == 0 {
                (Color32::from_rgb(75, 75, 82), Theme::TEXT_DIMMED)
            } else {
                (Color32::from_rgb(115, 115, 130), Theme::TEXT_MUTED)
            };

            if is_hovered || is_focus {
                painter.circle_stroke(
                    position,
                    radius + 3.0,
                    Stroke::new(
                        1.5_f32,
                        if is_hovered {
                            Theme::ACCENT_PURPLE
                        } else {
                            Theme::ACCENT_BLUE
                        },
                    ),
                );
            }

            painter.circle_filled(position, radius, fill_color);
            painter.circle_stroke(position, radius, Stroke::new(1.0_f32, Theme::BG_PRIMARY));
            let title = compact_title(&node.note.title, 30);
            painter.text(
                position + Vec2::new(0.0, radius + 4.0),
                Align2::CENTER_TOP,
                title,
                FontId::proportional(11.0),
                text_color,
            );
            let response = response.on_hover_text(format!(
                "{}\n{}\n{} outgoing · {} incoming",
                node.note.title, node.note.rel_path, node.links, node.backlinks
            ));
            if response.clicked() {
                open_note = Some(node.note.abs_path.clone());
            }
        }

        let shown = visible.iter().filter(|show| **show).count();
        if self.local_only && focus_index.is_none() {
            painter.text(
                canvas.center(),
                Align2::CENTER_CENTER,
                "Open a note to focus the local graph",
                FontId::proportional(14.0),
                Theme::TEXT_MUTED,
            );
        }
        ui.add_space(5.0);
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(format!("{} of {} notes", shown, graph.nodes.len()))
                    .size(11.0)
                    .color(Theme::TEXT_DIMMED),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    RichText::new("Drag to move · Scroll to zoom · Click a note to open")
                        .size(10.0)
                        .color(Theme::TEXT_DIMMED),
                );
            });
        });
        open_note
    }
}

fn empty_state(ui: &mut egui::Ui, message: &str) {
    ui.vertical_centered(|ui| {
        ui.add_space(30.0);
        ui.label(RichText::new(message).color(Theme::TEXT_MUTED));
    });
}

fn compact_title(title: &str, limit: usize) -> String {
    if title.chars().count() <= limit {
        title.to_string()
    } else {
        format!(
            "{}…",
            title
                .chars()
                .take(limit.saturating_sub(1))
                .collect::<String>()
        )
    }
}

fn build_graph(notes: Vec<NoteItem>) -> GraphData {
    let mut paths = HashMap::new();
    let mut titles = HashMap::new();
    for (index, note) in notes.iter().enumerate() {
        paths
            .entry(path_without_extension(&note.rel_path).to_lowercase())
            .or_insert(index);
        titles.entry(note.title.to_lowercase()).or_insert(index);
    }

    let mut edges = HashSet::new();
    for (source, note) in notes.iter().enumerate() {
        let Ok(file) = File::open(&note.abs_path) else {
            continue;
        };
        for line in BufReader::new(file).lines().flatten() {
            for link in extract_wikilinks(&line) {
                let target = path_without_extension(&link.target.replace('\\', "/"));
                let key = target.to_lowercase();
                let index = paths.get(&key).copied().or_else(|| {
                    let basename = key.rsplit('/').next().unwrap_or(&key);
                    titles.get(basename).copied()
                });
                if let Some(target) = index {
                    if source != target {
                        edges.insert((source, target));
                    }
                }
            }
        }
    }

    let mut nodes: Vec<GraphNode> = notes
        .into_iter()
        .map(|note| GraphNode {
            note,
            links: 0,
            backlinks: 0,
        })
        .collect();
    let mut adjacency = vec![Vec::new(); nodes.len()];
    let mut edges: Vec<_> = edges.into_iter().collect();
    edges.sort_unstable();
    for (source, target) in &edges {
        nodes[*source].links += 1;
        nodes[*target].backlinks += 1;
        adjacency[*source].push(*target);
        adjacency[*target].push(*source);
    }
    GraphData {
        nodes,
        edges,
        adjacency,
    }
}

fn path_without_extension(path: &str) -> String {
    match path.rsplit_once('.') {
        Some((stem, ext))
            if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown") =>
        {
            stem.to_string()
        }
        _ => path.to_string(),
    }
}

fn layout_positions(graph: &GraphData, focus: Option<usize>) -> Vec<Vec2> {
    let mut levels = vec![usize::MAX; graph.nodes.len()];
    let mut queue = VecDeque::new();
    if let Some(focus) = focus {
        levels[focus] = 0;
        queue.push_back(focus);
    } else if !graph.nodes.is_empty() {
        levels[0] = 0;
        queue.push_back(0);
    }
    while let Some(node) = queue.pop_front() {
        for neighbor in &graph.adjacency[node] {
            if levels[*neighbor] == usize::MAX {
                levels[*neighbor] = levels[node] + 1;
                queue.push_back(*neighbor);
            }
        }
    }
    let max_connected_level = levels
        .iter()
        .copied()
        .filter(|level| *level != usize::MAX)
        .max()
        .unwrap_or(0);
    for level in &mut levels {
        if *level == usize::MAX {
            *level = max_connected_level + 1;
        }
    }
    let max_level = levels.iter().copied().max().unwrap_or(0);
    let mut groups = vec![Vec::new(); max_level + 1];
    for (index, level) in levels.iter().enumerate() {
        groups[*level].push(index);
    }

    let mut positions = vec![Vec2::ZERO; graph.nodes.len()];
    for (level, group) in groups.iter().enumerate().skip(1) {
        let radius = 100.0 + level as f32 * 92.0;
        for (slot, index) in group.iter().enumerate() {
            let angle = std::f32::consts::TAU * slot as f32 / group.len().max(1) as f32;
            positions[*index] = Vec2::new(angle.cos() * radius, angle.sin() * radius);
        }
    }
    positions
}
