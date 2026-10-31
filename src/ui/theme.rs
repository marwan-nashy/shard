use crate::config::{AccentColor, AppConfig, ThemeMode};
use egui::{Color32, Stroke};

pub struct Theme;

impl Theme {
    // Obsidian-like dark workspace palette: neutral charcoal surfaces,
    // crisp 1px borders, blue selection/active states, and Obsidian purple links.
    pub const BG_PRIMARY: Color32 = Color32::from_rgb(30, 30, 30); // #1e1e1e
    pub const BG_SECONDARY: Color32 = Color32::from_rgb(22, 22, 22); // #161616
    pub const BG_CARD: Color32 = Color32::from_rgb(38, 38, 38); // #262626
    pub const BG_CODE: Color32 = Color32::from_rgb(24, 24, 24); // #181818

    pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(220, 221, 222); // #dcddde
    pub const TEXT_MUTED: Color32 = Color32::from_rgb(153, 153, 153); // #999999
    pub const TEXT_DIMMED: Color32 = Color32::from_rgb(102, 102, 102); // #666666

    pub const ACCENT_PURPLE: Color32 = Color32::from_rgb(123, 108, 217); // #7b6cd9 (Obsidian purple)
    pub const ACCENT_BLUE: Color32 = Color32::from_rgb(74, 144, 226); // #4a90e2 (Blue selection & ribbon active)
    pub const ACCENT_GREEN: Color32 = Color32::from_rgb(86, 176, 117); // #56b075 (Saved)
    pub const ACCENT_ORANGE: Color32 = Color32::from_rgb(230, 150, 60); // #e6963c (Unsaved)
    pub const ACCENT_RED: Color32 = Color32::from_rgb(225, 85, 85); // #e15555 (Error)

    pub const BORDER: Color32 = Color32::from_rgb(46, 46, 46); // #2e2e2e
    pub const BG_HEADER: Color32 = Color32::from_rgb(28, 28, 28); // #1c1c1c
    pub const BG_NOTE_ACTIVE: Color32 = Color32::from_rgb(30, 52, 82); // #1e3452
    pub const BG_ROW_HOVER: Color32 = Color32::from_rgb(36, 36, 36); // #242424

    pub fn accent_to_color(accent: AccentColor) -> Color32 {
        match accent {
            AccentColor::Purple => Self::ACCENT_PURPLE,
            AccentColor::Blue => Self::ACCENT_BLUE,
            AccentColor::Green => Self::ACCENT_GREEN,
            AccentColor::Amber => Self::ACCENT_ORANGE,
            AccentColor::Red => Self::ACCENT_RED,
            AccentColor::Cyan => Color32::from_rgb(56, 189, 248),
            AccentColor::Pink => Color32::from_rgb(236, 72, 153),
        }
    }

    #[allow(dead_code)]
    pub fn apply(ctx: &egui::Context) {
        Self::apply_with_config(ctx, &AppConfig::default());
    }

    pub fn apply_with_config(ctx: &egui::Context, config: &AppConfig) {
        let accent = Self::accent_to_color(config.accent_color);
        let is_light = config.theme_mode == ThemeMode::Light;

        let mut visuals = if is_light {
            egui::Visuals::light()
        } else {
            egui::Visuals::dark()
        };

        let (bg_primary, bg_secondary, bg_card, bg_code, text_primary, border) =
            match config.theme_mode {
                ThemeMode::Dark => (
                    Self::BG_PRIMARY,
                    Self::BG_SECONDARY,
                    Self::BG_CARD,
                    Self::BG_CODE,
                    Self::TEXT_PRIMARY,
                    Self::BORDER,
                ),
                ThemeMode::Light => (
                    Color32::from_rgb(255, 255, 255),
                    Color32::from_rgb(242, 243, 245),
                    Color32::from_rgb(231, 232, 236),
                    Color32::from_rgb(245, 246, 248),
                    Color32::from_rgb(46, 51, 56),
                    Color32::from_rgb(210, 212, 216),
                ),
                ThemeMode::Nord => (
                    Color32::from_rgb(46, 52, 64),
                    Color32::from_rgb(36, 41, 51),
                    Color32::from_rgb(59, 66, 82),
                    Color32::from_rgb(39, 44, 54),
                    Color32::from_rgb(236, 239, 244),
                    Color32::from_rgb(67, 76, 94),
                ),
                ThemeMode::Dracula => (
                    Color32::from_rgb(40, 42, 54),
                    Color32::from_rgb(33, 34, 44),
                    Color32::from_rgb(52, 55, 70),
                    Color32::from_rgb(30, 31, 41),
                    Color32::from_rgb(248, 248, 242),
                    Color32::from_rgb(68, 71, 90),
                ),
            };

        visuals.panel_fill = bg_primary;
        visuals.window_fill = bg_secondary;
        visuals.faint_bg_color = bg_card;
        visuals.override_text_color = Some(text_primary);
        visuals.extreme_bg_color = bg_secondary;
        visuals.code_bg_color = bg_code;
        visuals.hyperlink_color = accent;

        visuals.selection.bg_fill = Color32::from_rgba_unmultiplied(
            accent.r(),
            accent.g(),
            accent.b(),
            if is_light { 60 } else { 80 },
        );
        visuals.selection.stroke = Stroke::new(1.0_f32, accent);

        visuals.window_rounding = egui::Rounding::same(6.0);
        visuals.window_stroke = Stroke::new(1.0_f32, border);

        visuals.widgets.noninteractive.bg_fill = bg_primary;
        visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, text_primary);
        visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, border);
        visuals.widgets.noninteractive.rounding = egui::Rounding::same(4.0);

        visuals.widgets.inactive.bg_fill = bg_card;
        visuals.widgets.inactive.fg_stroke = Stroke::new(1.0_f32, text_primary);
        visuals.widgets.inactive.bg_stroke = Stroke::new(1.0_f32, border);
        visuals.widgets.inactive.rounding = egui::Rounding::same(4.0);

        visuals.widgets.hovered.bg_fill = if is_light {
            Color32::from_rgb(220, 222, 228)
        } else {
            Color32::from_rgb(46, 46, 46)
        };
        visuals.widgets.hovered.fg_stroke = Stroke::new(1.0_f32, text_primary);
        visuals.widgets.hovered.bg_stroke = Stroke::new(1.0_f32, accent);
        visuals.widgets.hovered.rounding = egui::Rounding::same(4.0);

        visuals.widgets.active.bg_fill = if is_light {
            Color32::from_rgb(205, 208, 216)
        } else {
            Color32::from_rgb(28, 62, 105)
        };
        visuals.widgets.active.fg_stroke = Stroke::new(1.0_f32, text_primary);
        visuals.widgets.active.bg_stroke = Stroke::new(1.5_f32, accent);
        visuals.widgets.active.rounding = egui::Rounding::same(4.0);

        visuals.widgets.open.bg_fill = bg_card;
        visuals.widgets.open.fg_stroke = Stroke::new(1.0_f32, text_primary);
        visuals.widgets.open.bg_stroke = Stroke::new(1.0_f32, accent);
        visuals.widgets.open.rounding = egui::Rounding::same(4.0);

        ctx.set_visuals(visuals);

        ctx.style_mut(|style| {
            style.spacing.item_spacing = egui::vec2(6.0, 4.0);
            style.spacing.button_padding = egui::vec2(8.0, 4.0);
            style.spacing.window_margin = egui::Margin::same(8.0);
        });
    }
}
