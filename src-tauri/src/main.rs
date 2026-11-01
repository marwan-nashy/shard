// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--mcp" || a == "mcp") {
        let vault_path = args
            .iter()
            .position(|a| a == "--vault" || a == "-v")
            .and_then(|idx| args.get(idx + 1).cloned())
            .or_else(|| args.get(2).filter(|a| !a.starts_with('-')).cloned());
        shard_lib::mcp::run_mcp_server(vault_path);
        return;
    }
    shard_lib::run()
}
