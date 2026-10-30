use crate::vault::{NoteItem, Vault};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::thread;
use std::time::Instant;

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub note: NoteItem,
    pub is_title_match: bool,
    pub line_matches: Vec<(usize, String)>,
}

pub struct SearchEngine {
    pub query: String,
    pub search_content: bool,
    pub last_input_time: Option<Instant>,
    pub active_query: String,
    pub results: Vec<SearchResult>,
    pub is_searching: bool,
    generation: Arc<AtomicU64>,
    result_tx: Sender<(u64, Vec<SearchResult>)>,
    result_rx: Receiver<(u64, Vec<SearchResult>)>,
}

impl Default for SearchEngine {
    fn default() -> Self {
        let (result_tx, result_rx) = mpsc::channel();
        Self {
            query: String::new(),
            search_content: true,
            last_input_time: None,
            active_query: String::new(),
            results: Vec::new(),
            is_searching: false,
            generation: Arc::new(AtomicU64::new(0)),
            result_tx,
            result_rx,
        }
    }
}

impl SearchEngine {
    /// Notify the search engine of a changed query and cancel any stale search.
    pub fn on_query_changed(&mut self, new_query: String) {
        if self.query == new_query {
            return;
        }

        self.query = new_query;
        self.generation.fetch_add(1, Ordering::Relaxed);
        if self.query.trim().is_empty() {
            self.last_input_time = None;
            self.active_query.clear();
            self.results.clear();
            self.is_searching = false;
        } else {
            self.last_input_time = Some(Instant::now());
            self.is_searching = true;
        }
    }

    /// Restart the debounce period after a search option changes.
    pub fn schedule_current_query(&mut self) {
        if !self.query.trim().is_empty() {
            self.generation.fetch_add(1, Ordering::Relaxed);
            self.last_input_time = Some(Instant::now());
            self.is_searching = true;
        }
    }

    /// Launch a debounced search on a worker so file reads do not block the UI.
    pub fn update(&mut self, vault: &Option<Vault>, force: bool) -> bool {
        let query = self.query.trim();
        if query.is_empty() {
            self.active_query.clear();
            self.results.clear();
            self.is_searching = false;
            self.last_input_time = None;
            return false;
        }

        if query == self.active_query && self.last_input_time.is_none() {
            return false;
        }

        if !force {
            if let Some(time) = self.last_input_time {
                if time.elapsed().as_millis() < 300 {
                    return false;
                }
            }
        }

        self.active_query = query.to_string();
        self.last_input_time = None;

        let Some(vault) = vault else {
            self.results.clear();
            self.is_searching = false;
            return true;
        };

        self.is_searching = true;
        let notes = vault.notes.clone();
        let query = self.active_query.clone();
        let search_content = self.search_content;
        let generation = self.generation.fetch_add(1, Ordering::Relaxed) + 1;
        let cancellation = Arc::clone(&self.generation);
        let result_tx = self.result_tx.clone();

        thread::spawn(move || {
            let results =
                Self::execute_search(&notes, &query, search_content, generation, &cancellation);
            if cancellation.load(Ordering::Relaxed) == generation {
                let _ = result_tx.send((generation, results));
            }
        });

        true
    }

    /// Apply completed worker results and discard results from superseded queries.
    pub fn poll(&mut self) {
        while let Ok((generation, results)) = self.result_rx.try_recv() {
            if self.generation.load(Ordering::Relaxed) == generation {
                self.results = results;
                self.is_searching = false;
            }
        }
    }

    fn execute_search(
        notes: &[NoteItem],
        query: &str,
        search_content: bool,
        generation: u64,
        cancellation: &AtomicU64,
    ) -> Vec<SearchResult> {
        let mut results = Vec::new();
        let query_lower = query.to_lowercase();
        let max_content_matches_per_note = 5;
        let max_total_results = 80;

        for note in notes {
            if cancellation.load(Ordering::Relaxed) != generation
                || results.len() >= max_total_results
            {
                break;
            }

            let title_lower = note.title.to_lowercase();
            let rel_path_lower = note.rel_path.to_lowercase();
            let is_title_match =
                title_lower.contains(&query_lower) || rel_path_lower.contains(&query_lower);

            let mut line_matches = Vec::new();
            if search_content {
                if let Ok(file) = File::open(&note.abs_path) {
                    for (line_idx, line) in BufReader::new(file).lines().enumerate() {
                        if cancellation.load(Ordering::Relaxed) != generation {
                            return Vec::new();
                        }

                        let Ok(line) = line else {
                            continue;
                        };
                        if line.to_lowercase().contains(&query_lower) {
                            let snippet = line.trim();
                            let display_snippet = if snippet.chars().count() > 120 {
                                format!("{}...", snippet.chars().take(120).collect::<String>())
                            } else {
                                snippet.to_string()
                            };
                            line_matches.push((line_idx + 1, display_snippet));
                            if line_matches.len() >= max_content_matches_per_note {
                                break;
                            }
                        }
                    }
                }
            }

            if is_title_match || !line_matches.is_empty() {
                results.push(SearchResult {
                    note: note.clone(),
                    is_title_match,
                    line_matches,
                });
            }
        }

        results.sort_by(|a, b| {
            b.is_title_match
                .cmp(&a.is_title_match)
                .then_with(|| a.note.rel_path.cmp(&b.note.rel_path))
        });
        results
    }
}
