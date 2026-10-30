use egui::{Color32, Stroke};

pub struct Theme;

impl Theme {
    pub const BG_PRIMARY: Color32 = Color32::from_rgb(26, 26, 30);
    pub const BG_SECONDARY: Color32 = Color32::from_rgb(20, 20, 24);
    pub const BG_CARD: Color32 = Color32::from_rgb(34, 34, 40);
    pub const BG_CODE: Color32 = Color32::from_rgb(18, 18, 22);

    pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(228, 228, 235);
    pub const TEXT_MUTED: Color32 = Color32::from_rgb(140, 140, 155);
    pub const TEXT_DIMMED: Color32 = Color32::from_rgb(95, 95, 110);

    pub const ACCENT_PURPLE: Color32 = Color32::from_rgb(147, 112, 219);
    pub const ACCENT_BLUE: Color32 = Color32::from_rgb(108, 158, 255);
    pub const ACCENT_GREEN: Color32 = Color32::from_rgb(76, 175, 80);
    pub const ACCENT_ORANGE: Color32 = Color32::from_rgb(255, 152, 0);
    pub const ACCENT_RED: Color32 = Color32::from_rgb(239, 83, 80);

    pub const BORDER: Color32 = Color32::from_rgb(45, 45, 52);

    pub fn apply(ctx: &egui::Context) {
        let mut visuals = egui::Visuals::dark();
        visuals.panel_fill = Self::BG_PRIMARY;
        visuals.window_fill = Self::BG_SECONDARY;
        visuals.faint_bg_color = Self::BG_CARD;
        visuals.override_text_color = Some(Self::TEXT_PRIMARY);

        visuals.widgets.noninteractive.bg_fill = Self::BG_PRIMARY;
        visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, Self::TEXT_PRIMARY);
        visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, Self::BORDER);

        visuals.widgets.inactive.bg_fill = Self::BG_CARD;
        visuals.widgets.inactive.fg_stroke = Stroke::new(1.0_f32, Self::TEXT_PRIMARY);
        visuals.widgets.inactive.bg_stroke = Stroke::new(1.0_f32, Self::BORDER);

        visuals.widgets.hovered.bg_fill = Color32::from_rgb(48, 48, 58);
        visuals.widgets.hovered.fg_stroke = Stroke::new(1.0_f32, Color32::WHITE);
        visuals.widgets.hovered.bg_stroke = Stroke::new(1.0_f32, Self::ACCENT_PURPLE);

        visuals.widgets.active.bg_fill = Color32::from_rgb(60, 50, 80);
        visuals.widgets.active.fg_stroke = Stroke::new(1.0_f32, Color32::WHITE);
        visuals.widgets.active.bg_stroke = Stroke::new(1.0_f32, Self::ACCENT_PURPLE);

        ctx.set_visuals(visuals);
    }
}
