//! Obsidian-compatible JSON Canvas documents and a lightweight native canvas view.
use crate::ui::theme::Theme;
use egui::{Color32, RichText, Sense, Stroke, TextEdit};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasNode {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasEdge {
    pub id: String,
    #[serde(rename = "fromNode")]
    pub from_node: String,
    #[serde(rename = "toNode")]
    pub to_node: String,
    #[serde(default, rename = "fromSide", skip_serializing_if = "Option::is_none")]
    pub from_side: Option<String>,
    #[serde(default, rename = "toSide", skip_serializing_if = "Option::is_none")]
    pub to_side: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CanvasDocument {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub nodes: Vec<CanvasNode>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub edges: Vec<CanvasEdge>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

pub struct CanvasWorkspace {
    pub path: PathBuf,
    pub title: String,
    pub document: CanvasDocument,
    saved_json: String,
    pub pan: egui::Vec2,
    pub zoom: f32,
    pub selected: Option<String>,
    pub connect_from: Option<String>,
    pub request_delete: bool,
}

impl CanvasWorkspace {
    pub fn open(root: &Path, path: &Path) -> io::Result<Self> {
        let relative = path
            .strip_prefix(root)
            .map_err(|_| invalid("Canvas is outside the vault."))?;
        if relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        {
            return Err(invalid("Canvas path is not a safe vault path."));
        }
        let metadata = fs::symlink_metadata(path)?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(invalid("Canvas must be a regular file inside the vault."));
        }
        let json = fs::read_to_string(path)?;
        let document = serde_json::from_str(&json)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        Ok(Self {
            path: path.to_path_buf(),
            title: path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            document,
            saved_json: json,
            pan: egui::Vec2::ZERO,
            zoom: 1.0,
            selected: None,
            connect_from: None,
            request_delete: false,
        })
    }

    pub fn save(&mut self, root: &Path) -> io::Result<()> {
        let relative = self
            .path
            .strip_prefix(root)
            .map_err(|_| invalid("Canvas is outside the vault."))?;
        if relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        {
            return Err(invalid("Canvas path is not safe."));
        }
        let metadata = fs::symlink_metadata(&self.path)?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(invalid("Canvas is no longer a regular vault file."));
        }
        let disk = fs::read_to_string(&self.path)?;
        if disk != self.saved_json {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                "Canvas changed on disk since it was opened. Reopen it before saving.",
            ));
        }
        let json = serde_json::to_string_pretty(&self.document)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(&self.path, &json)?;
        self.saved_json = json;
        Ok(())
    }

    pub fn is_dirty(&self) -> bool {
        serde_json::to_string(&self.document).ok()
            != serde_json::from_str::<CanvasDocument>(&self.saved_json)
                .ok()
                .and_then(|d| serde_json::to_string(&d).ok())
    }

    pub fn add_text(&mut self) {
        let id = format!(
            "text-{:x}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        self.document.nodes.push(CanvasNode {
            id: id.clone(),
            kind: "text".into(),
            x: 40.0 + self.document.nodes.len() as f32 * 24.0,
            y: 40.0 + self.document.nodes.len() as f32 * 24.0,
            width: 300.0,
            height: 190.0,
            text: Some(String::new()),
            file: None,
            url: None,
            extra: Default::default(),
        });
        self.selected = Some(id);
    }
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

pub fn render(ui: &mut egui::Ui, canvas: &mut CanvasWorkspace) -> bool {
    let mut changed = false;

    // Top Canvas Toolbar
    egui::Frame::none()
        .fill(Theme::BG_SECONDARY)
        .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
        .inner_margin(egui::Margin::symmetric(12.0, 6.0))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(&canvas.title)
                        .strong()
                        .size(13.0)
                        .color(Theme::TEXT_PRIMARY),
                );
                ui.separator();
                if ui
                    .add(egui::Button::new(RichText::new("+ Text card").size(11.5)))
                    .clicked()
                {
                    canvas.add_text();
                    changed = true;
                }
                let connecting = canvas.connect_from.is_some();
                if ui
                    .add(
                        egui::Button::new(
                            RichText::new(if connecting {
                                "Pick target…"
                            } else {
                                "Connect"
                            })
                            .size(11.5)
                            .color(if connecting {
                                Theme::ACCENT_BLUE
                            } else {
                                Theme::TEXT_PRIMARY
                            }),
                        )
                        .fill(if connecting {
                            Theme::BG_CARD
                        } else {
                            Color32::TRANSPARENT
                        }),
                    )
                    .clicked()
                {
                    if let Some(selected) = canvas.selected.clone() {
                        if let Some(first) = canvas.connect_from.take() {
                            if first != selected {
                                canvas.document.edges.push(CanvasEdge {
                                    id: format!(
                                        "edge-{:x}",
                                        std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_nanos()
                                    ),
                                    from_node: first,
                                    to_node: selected,
                                    from_side: None,
                                    to_side: None,
                                    label: None,
                                    extra: Default::default(),
                                });
                                changed = true;
                            }
                        } else {
                            canvas.connect_from = Some(selected);
                        }
                    }
                }
                if ui.button("−").clicked() {
                    canvas.zoom = (canvas.zoom / 1.15).clamp(0.35, 2.5);
                }
                if ui.button("+").clicked() {
                    canvas.zoom = (canvas.zoom * 1.15).clamp(0.35, 2.5);
                }
                ui.label(
                    RichText::new(format!("{:.0}%", canvas.zoom * 100.0))
                        .size(11.0)
                        .color(Theme::TEXT_MUTED),
                );
                if canvas.is_dirty() {
                    ui.label(
                        RichText::new("● Unsaved")
                            .size(11.0)
                            .color(Theme::ACCENT_ORANGE),
                    );
                }

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui
                        .button(
                            RichText::new("Delete canvas…")
                                .size(11.0)
                                .color(Theme::ACCENT_RED),
                        )
                        .on_hover_text("Permanently delete this .canvas board")
                        .clicked()
                    {
                        canvas.request_delete = true;
                    }
                });
            });
        });

    let (rect, response) = ui.allocate_exact_size(ui.available_size(), Sense::drag());
    let painter = ui.painter_at(rect);

    // Canvas background
    painter.rect_filled(rect, 0.0, Theme::BG_SECONDARY);

    if response.dragged() {
        canvas.pan += response.drag_delta();
    }
    if response.hovered() {
        let scroll = ui.input(|i| i.raw_scroll_delta.y);
        if scroll != 0.0 {
            canvas.zoom = (canvas.zoom * (1.0 + scroll * 0.001)).clamp(0.35, 2.5);
        }
    }
    let origin = rect.min + canvas.pan;

    // Obsidian-style dot grid
    let grid_spacing = (28.0 * canvas.zoom).clamp(14.0, 120.0);
    let offset_x = (origin.x % grid_spacing + grid_spacing) % grid_spacing;
    let offset_y = (origin.y % grid_spacing + grid_spacing) % grid_spacing;
    let dot_color = Color32::from_rgb(38, 38, 38);
    let mut gx = rect.min.x + offset_x;
    while gx <= rect.max.x {
        let mut gy = rect.min.y + offset_y;
        while gy <= rect.max.y {
            painter.circle_filled(egui::pos2(gx, gy), 1.0, dot_color);
            gy += grid_spacing;
        }
        gx += grid_spacing;
    }

    let positions: std::collections::HashMap<_, _> = canvas
        .document
        .nodes
        .iter()
        .map(|n| {
            (
                n.id.clone(),
                egui::pos2(origin.x + n.x * canvas.zoom, origin.y + n.y * canvas.zoom),
            )
        })
        .collect();

    // Edges with arrowheads
    for edge in &canvas.document.edges {
        if let (Some(a), Some(b)) = (positions.get(&edge.from_node), positions.get(&edge.to_node)) {
            let start = *a + egui::vec2(150.0, 90.0) * canvas.zoom;
            let end = *b + egui::vec2(150.0, 90.0) * canvas.zoom;
            let edge_color = Color32::from_rgb(95, 105, 120);
            painter.line_segment([start, end], Stroke::new(2.0_f32, edge_color));

            // Arrowhead
            let delta = end - start;
            let len = delta.length();
            if len > 10.0 {
                let dir = delta / len;
                let arrow_len = (8.0 * canvas.zoom).clamp(6.0, 14.0);
                let p1 = end - dir * arrow_len + egui::vec2(-dir.y, dir.x) * (arrow_len * 0.4);
                let p2 = end - dir * arrow_len - egui::vec2(-dir.y, dir.x) * (arrow_len * 0.4);
                painter.line_segment([end, p1], Stroke::new(2.0_f32, edge_color));
                painter.line_segment([end, p2], Stroke::new(2.0_f32, edge_color));
            }
        }
    }

    // Cards
    for node in &mut canvas.document.nodes {
        let size = egui::vec2(node.width, node.height) * canvas.zoom;
        let pos = egui::pos2(
            origin.x + node.x * canvas.zoom,
            origin.y + node.y * canvas.zoom,
        );
        let card = egui::Rect::from_min_size(pos, size);
        if !rect.intersects(card) {
            continue;
        }
        let selected = canvas.selected.as_deref() == Some(node.id.as_str());

        // Card body
        painter.rect_filled(card, 8.0, Theme::BG_CARD);
        painter.rect_stroke(
            card,
            8.0,
            Stroke::new(
                if selected { 2.0_f32 } else { 1.0_f32 },
                if selected {
                    Theme::ACCENT_BLUE
                } else {
                    Theme::BORDER
                },
            ),
        );

        // Card header
        let header_h = 26.0 * canvas.zoom;
        let header = egui::Rect::from_min_size(card.min, egui::vec2(size.x, header_h));
        painter.rect_filled(
            header,
            egui::Rounding {
                nw: 8.0,
                ne: 8.0,
                sw: 0.0,
                se: 0.0,
            },
            Color32::from_rgb(28, 28, 28),
        );
        painter.line_segment(
            [header.left_bottom(), header.right_bottom()],
            Stroke::new(1.0_f32, Theme::BORDER),
        );

        let drag = ui.interact(
            header,
            egui::Id::new((&node.id, "drag")),
            Sense::click_and_drag(),
        );
        if drag.clicked() {
            canvas.selected = Some(node.id.clone());
        }
        if drag.dragged() {
            node.x += drag.drag_delta().x / canvas.zoom;
            node.y += drag.drag_delta().y / canvas.zoom;
            changed = true;
        }

        painter.text(
            header.left_center() + egui::vec2(10.0, 0.0),
            egui::Align2::LEFT_CENTER,
            if node.kind == "text" {
                "Text"
            } else {
                &node.kind
            },
            egui::FontId::proportional(11.5 * canvas.zoom),
            Theme::TEXT_MUTED,
        );

        if node.kind == "text" {
            let inset = 10.0 * canvas.zoom;
            let body = egui::Rect::from_min_max(
                card.min + egui::vec2(inset, header_h + 6.0),
                card.max - egui::vec2(inset, inset),
            );
            let edit = ui.put(
                body,
                TextEdit::multiline(node.text.get_or_insert_with(String::new))
                    .frame(false)
                    .font(egui::TextStyle::Body),
            );
            changed |= edit.changed();
        } else {
            painter.text(
                card.center(),
                egui::Align2::CENTER_CENTER,
                node.file
                    .as_deref()
                    .or(node.url.as_deref())
                    .unwrap_or("Unsupported card"),
                egui::FontId::proportional(13.0),
                Theme::TEXT_MUTED,
            );
        }
    }

    if canvas.document.nodes.is_empty() {
        painter.text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            "Add a text card to begin",
            egui::FontId::proportional(14.0),
            Theme::TEXT_DIMMED,
        );
    }
    changed
}
