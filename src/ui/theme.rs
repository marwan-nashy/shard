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

    pub fn apply(ctx: &egui::Context) {
        let mut visuals = egui::Visuals::dark();
        visuals.panel_fill = Self::BG_PRIMARY;
        visuals.window_fill = Self::BG_SECONDARY;
        visuals.faint_bg_color = Self::BG_CARD;
        visuals.override_text_color = Some(Self::TEXT_PRIMARY);
        visuals.extreme_bg_color = Self::BG_SECONDARY;
        visuals.code_bg_color = Self::BG_CODE;
        visuals.hyperlink_color = Self::ACCENT_PURPLE;

        visuals.selection.bg_fill = Color32::from_rgb(32, 68, 118);
        visuals.selection.stroke = Stroke::new(1.0_f32, Self::ACCENT_BLUE);

        visuals.window_rounding = egui::Rounding::same(6.0);
        visuals.window_stroke = Stroke::new(1.0_f32, Self::BORDER);

        visuals.widgets.noninteractive.bg_fill = Self::BG_PRIMARY;
        visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, Self::TEXT_PRIMARY);
        visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, Self::BORDER);
        visuals.widgets.noninteractive.rounding = egui::Rounding::same(4.0);

        visuals.widgets.inactive.bg_fill = Self::BG_CARD;
        visuals.widgets.inactive.fg_stroke = Stroke::new(1.0_f32, Self::TEXT_PRIMARY);
        visuals.widgets.inactive.bg_stroke = Stroke::new(1.0_f32, Self::BORDER);
        visuals.widgets.inactive.rounding = egui::Rounding::same(4.0);

        visuals.widgets.hovered.bg_fill = Color32::from_rgb(46, 46, 46);
        visuals.widgets.hovered.fg_stroke = Stroke::new(1.0_f32, Color32::WHITE);
        visuals.widgets.hovered.bg_stroke = Stroke::new(1.0_f32, Self::ACCENT_BLUE);
        visuals.widgets.hovered.rounding = egui::Rounding::same(4.0);

        visuals.widgets.active.bg_fill = Color32::from_rgb(28, 62, 105);
        visuals.widgets.active.fg_stroke = Stroke::new(1.0_f32, Color32::WHITE);
        visuals.widgets.active.bg_stroke = Stroke::new(1.5_f32, Self::ACCENT_BLUE);
        visuals.widgets.active.rounding = egui::Rounding::same(4.0);

        visuals.widgets.open.bg_fill = Self::BG_CARD;
        visuals.widgets.open.fg_stroke = Stroke::new(1.0_f32, Self::TEXT_PRIMARY);
        visuals.widgets.open.bg_stroke = Stroke::new(1.0_f32, Self::ACCENT_BLUE);
        visuals.widgets.open.rounding = egui::Rounding::same(4.0);

        ctx.set_visuals(visuals);

        ctx.style_mut(|style| {
            style.spacing.item_spacing = egui::vec2(6.0, 4.0);
            style.spacing.button_padding = egui::vec2(8.0, 4.0);
            style.spacing.window_margin = egui::Margin::same(8.0);
        });
    }
}
