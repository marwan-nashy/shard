use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    "target",
    ".git",
    ".github",
    ".obsidian",
    ".trash",
    ".sync",
    ".agents",
];

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

pub fn run_mcp_server(explicit_vault: Option<String>) {
    let vault_path: PathBuf = match explicit_vault {
        Some(p) => PathBuf::from(p),
        None => {
            let config = crate::load_app_config();
            if let Some(lv) = config.last_vault {
                PathBuf::from(lv)
            } else {
                std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
            }
        }
    };

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let reader = stdin.lock();

    for line_result in reader.lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => break,
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let req: JsonRpcRequest = match serde_json::from_str(trimmed) {
            Ok(r) => r,
            Err(e) => {
                let err_resp = json!({
                    "jsonrpc": "2.0",
                    "id": Value::Null,
                    "error": {
                        "code": -32700,
                        "message": format!("Parse error: {}", e)
                    }
                });
                let _ = writeln!(stdout, "{}", err_resp);
                let _ = stdout.flush();
                continue;
            }
        };

        // If request has no id and is a notification (e.g. notifications/initialized), don't reply
        if req.id.is_none() {
            continue;
        }

        let id = req.id.unwrap();
        let response = match req.method.as_str() {
            "initialize" => handle_initialize(id),
            "ping" => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {}
            }),
            "tools/list" => handle_tools_list(id),
            "tools/call" => handle_tools_call(id, req.params, &vault_path),
            _ => json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": {
                    "code": -32601,
                    "message": format!("Method not found: {}", req.method)
                }
            }),
        };

        let _ = writeln!(stdout, "{}", response);
        let _ = stdout.flush();
    }
}

fn handle_initialize(id: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "shard-vault-mcp",
                "version": "0.2.0"
            }
        }
    })
}

fn handle_tools_list(id: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "tools": [
                {
                    "name": "list_notes",
                    "description": "List all markdown notes in the active Shard vault with their titles and paths",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "folder": {
                                "type": "string",
                                "description": "Optional subfolder relative to vault root"
                            }
                        }
                    }
                },
                {
                    "name": "read_note",
                    "description": "Read the full markdown content of a note by title or relative path",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path_or_title": {
                                "type": "string",
                                "description": "Note title (stem) or relative/absolute path to .md file"
                            }
                        },
                        "required": ["path_or_title"]
                    }
                },
                {
                    "name": "search_notes",
                    "description": "Search notes across the vault using Okapi BM25 relevance scoring",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query terms or phrase"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum number of results to return (default 10)"
                            }
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "write_note",
                    "description": "Create or update a markdown note in the Shard vault",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Note title or relative path (e.g. 'Project Roadmap' or 'work/Project Roadmap.md')"
                            },
                            "content": {
                                "type": "string",
                                "description": "Markdown content to write"
                            }
                        },
                        "required": ["title", "content"]
                    }
                },
                {
                    "name": "get_vault_stats",
                    "description": "Get summary statistics of the Shard vault (note count, word count, path)",
                    "inputSchema": {
                        "type": "object",
                        "properties": {}
                    }
                }
            ]
        }
    })
}

fn handle_tools_call(id: Value, params: Option<Value>, vault: &Path) -> Value {
    let params_obj = params.unwrap_or(Value::Null);
    let name = params_obj.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let args = params_obj.get("arguments").cloned().unwrap_or(json!({}));

    let result = match name {
        "list_notes" => tool_list_notes(vault, &args),
        "read_note" => tool_read_note(vault, &args),
        "search_notes" => tool_search_notes(vault, &args),
        "write_note" => tool_write_note(vault, &args),
        "get_vault_stats" => tool_get_vault_stats(vault),
        _ => Err(format!("Unknown tool: {}", name)),
    };

    match result {
        Ok(text) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": text
                    }
                ]
            }
        }),
        Err(err) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": {
                "code": -32603,
                "message": err
            }
        }),
    }
}

fn tool_list_notes(vault: &Path, args: &Value) -> Result<String, String> {
    if !vault.exists() {
        return Err(format!("Vault directory does not exist: {:?}", vault));
    }

    let target_dir = if let Some(folder) = args.get("folder").and_then(|v| v.as_str()) {
        vault.join(folder)
    } else {
        vault.to_path_buf()
    };

    let mut notes = Vec::new();
    for entry in WalkDir::new(&target_dir)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !IGNORED_DIRS.contains(&name.as_ref())
        })
        .flatten()
    {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            let rel_path = path.strip_prefix(vault).unwrap_or(path);
            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            notes.push(json!({
                "title": stem,
                "path": rel_path.to_string_lossy().to_string()
            }));
        }
    }

    Ok(serde_json::to_string_pretty(&notes).unwrap_or_else(|_| "[]".to_string()))
}

fn tool_read_note(vault: &Path, args: &Value) -> Result<String, String> {
    let target = args
        .get("path_or_title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path_or_title' argument".to_string())?;

    // 1. Try direct path
    let mut candidate = vault.join(target);
    if !candidate.exists() && !target.ends_with(".md") {
        candidate = vault.join(format!("{}.md", target));
    }

    if candidate.is_file() {
        return fs::read_to_string(&candidate).map_err(|e| e.to_string());
    }

    // 2. Search by title across all notes
    let target_stem = target.trim_end_matches(".md").to_lowercase();
    for entry in WalkDir::new(vault)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !IGNORED_DIRS.contains(&name.as_ref())
        })
        .flatten()
    {
        let p = entry.path();
        if p.is_file() && p.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                if stem.to_lowercase() == target_stem {
                    return fs::read_to_string(p).map_err(|e| e.to_string());
                }
            }
        }
    }

    Err(format!("Note not found: {}", target))
}

fn tool_search_notes(vault: &Path, args: &Value) -> Result<String, String> {
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'query' argument".to_string())?;

    let limit = args
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(10) as usize;

    let query_terms: Vec<String> = query
        .to_lowercase()
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();

    if query_terms.is_empty() {
        return Ok("[]".to_string());
    }

    // Collect all documents
    let mut docs: Vec<(String, String, String)> = Vec::new(); // (path, title, content)
    for entry in WalkDir::new(vault)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !IGNORED_DIRS.contains(&name.as_ref())
        })
        .flatten()
    {
        let p = entry.path();
        if p.is_file() && p.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Ok(content) = fs::read_to_string(p) {
                let stem = p
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let rel = p
                    .strip_prefix(vault)
                    .unwrap_or(p)
                    .to_string_lossy()
                    .to_string();
                docs.push((rel, stem, content));
            }
        }
    }

    let n = docs.len();
    if n == 0 {
        return Ok("[]".to_string());
    }

    // Compute document frequencies n(q)
    let mut term_doc_count: HashMap<String, usize> = HashMap::new();
    let mut total_length: usize = 0;
    let mut doc_lengths: Vec<usize> = Vec::with_capacity(n);

    for (_, title, content) in &docs {
        let text_lower = format!("{} {}", title.to_lowercase(), content.to_lowercase());
        let words: Vec<&str> = text_lower.split_whitespace().collect();
        let len = words.len();
        doc_lengths.push(len);
        total_length += len;

        for term in &query_terms {
            if text_lower.contains(term) {
                *term_doc_count.entry(term.clone()).or_insert(0) += 1;
            }
        }
    }

    let avgdl = if n > 0 { (total_length as f64) / (n as f64) } else { 1.0 };
    let k1 = 1.2f64;
    let b = 0.75f64;

    // Score documents
    let mut scored: Vec<(f64, String, String, String)> = Vec::new(); // (score, title, path, snippet)

    for (idx, (rel_path, title, content)) in docs.into_iter().enumerate() {
        let content_lower = content.to_lowercase();
        let title_lower = title.to_lowercase();
        let dl = doc_lengths[idx] as f64;
        let mut score = 0.0f64;

        for term in &query_terms {
            let n_q = *term_doc_count.get(term).unwrap_or(&0);
            if n_q == 0 {
                continue;
            }

            // Okapi BM25 IDF
            let idf = (((n as f64) - (n_q as f64) + 0.5) / ((n_q as f64) + 0.5) + 1.0).ln();

            let matches_title = title_lower.matches(term.as_str()).count();
            let matches_content = content_lower.matches(term.as_str()).count();
            let f = (matches_content as f64) + (matches_title as f64) * 3.0;

            if f > 0.0 {
                let term_score = idf * (f * (k1 + 1.0)) / (f + k1 * (1.0 - b + b * (dl / avgdl)));
                score += term_score;
            }
        }

        if score > 0.0 {
            // Snippet
            let mut snippet = "Note in vault".to_string();
            if let Some(pos) = content_lower.find(&query_terms[0]) {
                let start = if pos > 40 { pos - 40 } else { 0 };
                let end = (pos + query_terms[0].len() + 60).min(content.len());
                snippet = content[start..end].replace('\n', " ").trim().to_string();
            }

            scored.push((score, title, rel_path, snippet));
        }
    }

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);

    let results: Vec<Value> = scored
        .into_iter()
        .map(|(s, title, path, snippet)| {
            json!({
                "score": (s * 100.0).round() / 100.0,
                "title": title,
                "path": path,
                "snippet": snippet
            })
        })
        .collect();

    Ok(serde_json::to_string_pretty(&results).unwrap_or_else(|_| "[]".to_string()))
}

fn tool_write_note(vault: &Path, args: &Value) -> Result<String, String> {
    let title = args
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'title' argument".to_string())?;

    let content = args
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'content' argument".to_string())?;

    let file_name = if title.ends_with(".md") {
        title.to_string()
    } else {
        format!("{}.md", title)
    };

    let target_path = vault.join(&file_name);
    if let Some(parent) = target_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    fs::write(&target_path, content).map_err(|e| format!("Failed to write note: {}", e))?;

    Ok(format!(
        "Successfully saved note '{}' ({} bytes)",
        file_name,
        content.len()
    ))
}

fn tool_get_vault_stats(vault: &Path) -> Result<String, String> {
    let mut total_notes = 0;
    let mut total_words = 0;
    let mut total_bytes = 0;

    for entry in WalkDir::new(vault)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !IGNORED_DIRS.contains(&name.as_ref())
        })
        .flatten()
    {
        let p = entry.path();
        if p.is_file() && p.extension().and_then(|s| s.to_str()) == Some("md") {
            total_notes += 1;
            if let Ok(content) = fs::read_to_string(p) {
                total_bytes += content.len();
                total_words += content.split_whitespace().count();
            }
        }
    }

    let stats = json!({
        "vaultPath": vault.to_string_lossy().to_string(),
        "totalNotes": total_notes,
        "totalWords": total_words,
        "totalBytes": total_bytes,
        "server": "shard-vault-mcp v0.2.0"
    });

    Ok(serde_json::to_string_pretty(&stats).unwrap_or_else(|_| "{}".to_string()))
}
