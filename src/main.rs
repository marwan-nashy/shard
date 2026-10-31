#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use eframe::egui;

mod app;
mod canvas;
mod config;
mod date;
mod metadata;
mod search;
mod ui;
mod vault;
mod wikilinks;

fn main() -> Result<(), eframe::Error> {
    let native_options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1120.0, 720.0])
            .with_min_inner_size([720.0, 480.0])
            .with_title("Better Obsidian")
            .with_icon(std::sync::Arc::new(egui::IconData {
                rgba: include_bytes!("../assets/better-obsidian.rgba").to_vec(),
                width: 64,
                height: 64,
            })),
        ..Default::default()
    };

    eframe::run_native(
        "Better Obsidian",
        native_options,
        Box::new(|cc| Ok(Box::new(app::BetterObsidianApp::new(cc)))),
    )
}
