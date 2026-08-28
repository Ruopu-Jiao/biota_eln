use crate::{
    error::{CoreError, CoreResult},
    history::hash_bytes,
    models::{
        Diagnostic, IndexMetadata, IndexedTask, RecordDocument, RecordSummary, SearchRequest,
        SearchResult, VaultFile, VaultScan,
    },
    pathing::{relative_display, resolve_existing},
};
use chrono::{DateTime, Utc};
use regex::Regex;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde_yaml::{Mapping, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
};
use walkdir::{DirEntry, WalkDir};

struct ScannedRecord {
    summary: RecordSummary,
    content: String,
}

pub fn read_document(vault_root: &Path, path: &Path) -> CoreResult<RecordDocument> {
    let bytes = fs::read(path)?;
    let content = String::from_utf8(bytes).map_err(|error| {
        CoreError::InvalidDocument(format!("{} is not valid UTF-8: {error}", path.display()))
    })?;
    let metadata = fs::metadata(path)?;
    let relative_path = relative_display(vault_root, path)?;
    let (summary, frontmatter, _) = summarize(&relative_path, &content, &metadata);
    Ok(RecordDocument {
        relative_path,
        content,
        content_hash: summary.content_hash.clone(),
        modified: summary.modified.clone(),
        size: summary.size,
        metadata: frontmatter,
        summary,
    })
}

pub fn rebuild(vault_root: &Path, index_path: &Path) -> CoreResult<VaultScan> {
    let (records, files, mut diagnostics) = scan_vault(vault_root)?;
    let mut ids: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for record in &records {
        if let Some(id) = &record.summary.biota_id {
            ids.entry(id.clone())
                .or_default()
                .push(record.summary.relative_path.clone());
        }
    }
    for (id, paths) in ids {
        if paths.len() > 1 {
            diagnostics.push(Diagnostic {
                severity: "error".to_owned(),
                code: "duplicate_biota_id".to_owned(),
                relative_path: None,
                message: format!("Biota ID {id} is used by {}", paths.join(", ")),
            });
        }
    }

    let mut connection = open_connection(index_path)?;
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM tasks", [])?;
    transaction.execute("DELETE FROM backlinks", [])?;
    transaction.execute("DELETE FROM records_fts", [])?;
    transaction.execute("DELETE FROM records", [])?;
    for record in &records {
        insert_record(&transaction, record)?;
    }
    let generated_at = Utc::now().to_rfc3339();
    set_metadata(&transaction, "generated_at", &generated_at)?;
    transaction.commit()?;

    let metadata = metadata(&connection, index_path, &generated_at)?;
    Ok(VaultScan {
        records: records.into_iter().map(|record| record.summary).collect(),
        files,
        diagnostics,
        index: metadata,
    })
}

pub fn upsert(vault_root: &Path, index_path: &Path, relative_path: &str) -> CoreResult<()> {
    let extension = Path::new(relative_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension != "md" && extension != "markdown" {
        remove(index_path, relative_path)?;
        return Ok(());
    }

    let path = vault_root.join(relative_path);
    let content = fs::read_to_string(&path)
        .map_err(|error| CoreError::InvalidDocument(format!("{}: {error}", path.display())))?;
    let file_metadata = fs::metadata(&path)?;
    let (summary, _, _) = summarize(relative_path, &content, &file_metadata);
    let record = ScannedRecord { summary, content };

    let mut connection = open_connection(index_path)?;
    let transaction = connection.transaction()?;
    delete_record(&transaction, relative_path)?;
    insert_record(&transaction, &record)?;
    set_metadata(&transaction, "generated_at", &Utc::now().to_rfc3339())?;
    transaction.commit()?;
    Ok(())
}

pub fn remove(index_path: &Path, relative_path: &str) -> CoreResult<()> {
    let mut connection = open_connection(index_path)?;
    let transaction = connection.transaction()?;
    delete_record(&transaction, relative_path)?;
    set_metadata(&transaction, "generated_at", &Utc::now().to_rfc3339())?;
    transaction.commit()?;
    Ok(())
}

pub fn sync_external(vault_root: &Path, index_path: &Path, relative_path: &str) -> CoreResult<()> {
    let canonical_root = fs::canonicalize(vault_root)?;
    let path = canonical_root.join(relative_path);
    if is_markdown_path(Path::new(relative_path)) {
        let is_regular_file = fs::symlink_metadata(&path)
            .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
            .unwrap_or(false);
        if is_regular_file && resolve_existing(&canonical_root, relative_path).is_ok() {
            return upsert(&canonical_root, index_path, relative_path);
        }
        return remove(index_path, relative_path);
    }

    if path.is_dir() {
        for entry in WalkDir::new(&path)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file() && is_markdown_path(entry.path()))
        {
            if let Ok(relative) = relative_display(&canonical_root, entry.path()) {
                upsert(&canonical_root, index_path, &relative)?;
            }
        }
    } else if !path.exists() {
        remove_prefix(index_path, relative_path)?;
    }
    Ok(())
}

pub fn task_list(index_path: &Path) -> CoreResult<Vec<IndexedTask>> {
    let connection = open_connection(index_path)?;
    let mut statement = connection.prepare(
        "SELECT task_id, source_path, source_title, line_number, text, completed,
                state, start_date, due_date, priority, metadata_json
         FROM tasks
         ORDER BY completed ASC,
                  COALESCE(due_date, start_date, '9999-12-31') ASC,
                  source_path ASC,
                  line_number ASC",
    )?;
    let rows = statement.query_map([], |row| {
        let metadata_json = row.get::<_, String>(10)?;
        Ok(IndexedTask {
            task_id: row.get(0)?,
            source_path: row.get(1)?,
            source_title: row.get(2)?,
            line_number: row.get::<_, i64>(3)? as usize,
            text: row.get(4)?,
            completed: row.get::<_, i64>(5)? != 0,
            state: row.get(6)?,
            start: row.get(7)?,
            due: row.get(8)?,
            priority: row.get(9)?,
            metadata: serde_json::from_str(&metadata_json).unwrap_or_default(),
        })
    })?;
    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(row?);
    }
    Ok(tasks)
}

pub fn search(index_path: &Path, request: &SearchRequest) -> CoreResult<Vec<SearchResult>> {
    let connection = open_connection(index_path)?;
    let limit = request.limit.unwrap_or(50).clamp(1, 200);
    let allowed_types: Option<BTreeSet<String>> = request.record_types.as_ref().map(|types| {
        types
            .iter()
            .map(|value| value.to_ascii_lowercase())
            .collect()
    });

    let fts_query = make_fts_query(&request.query);
    let mut results = if fts_query.is_empty() {
        let mut statement = connection.prepare(
            "SELECT relative_path, title, record_type, status,
                    substr(content, 1, 260), 0.0
             FROM records
             ORDER BY modified DESC, relative_path ASC
             LIMIT ?1",
        )?;
        let rows = statement.query_map(params![(limit * 5) as i64], row_to_result)?;
        collect_results(rows)?
    } else {
        let mut statement = connection.prepare(
            "SELECT records.relative_path, records.title, records.record_type,
                    records.status,
                    snippet(records_fts, 2, '<mark>', '</mark>', ' … ', 24),
                    -bm25(records_fts)
             FROM records_fts
             JOIN records ON records.rowid = records_fts.rowid
             WHERE records_fts MATCH ?1
             ORDER BY bm25(records_fts), records.relative_path
             LIMIT ?2",
        )?;
        let rows = statement.query_map(params![fts_query, (limit * 5) as i64], row_to_result)?;
        collect_results(rows)?
    };

    if let Some(types) = allowed_types {
        results.retain(|result| {
            result
                .record_type
                .as_ref()
                .map(|value| types.contains(&value.to_ascii_lowercase()))
                .unwrap_or(false)
        });
    }
    results.truncate(limit);
    Ok(results)
}

pub fn current_metadata(index_path: &Path) -> CoreResult<IndexMetadata> {
    let connection = open_connection(index_path)?;
    let generated_at = connection
        .query_row(
            "SELECT value FROM index_metadata WHERE key = 'generated_at'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    metadata(&connection, index_path, &generated_at)
}

fn open_connection(index_path: &Path) -> CoreResult<Connection> {
    if let Some(parent) = index_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let connection = Connection::open(index_path)?;
    connection.busy_timeout(std::time::Duration::from_secs(5))?;
    connection.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS records (
             relative_path TEXT NOT NULL UNIQUE,
             biota_id TEXT,
             record_type TEXT,
             title TEXT NOT NULL,
             status TEXT,
             tags TEXT NOT NULL,
             modified TEXT NOT NULL,
             size INTEGER NOT NULL,
             content_hash TEXT NOT NULL,
             content TEXT NOT NULL
         );
         CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
             relative_path UNINDEXED,
             title,
             content,
             tags,
             tokenize = 'unicode61'
         );
         CREATE TABLE IF NOT EXISTS tasks (
             source_path TEXT NOT NULL,
             source_title TEXT NOT NULL,
             line_number INTEGER NOT NULL,
             task_id TEXT,
             text TEXT NOT NULL,
             completed INTEGER NOT NULL,
             state TEXT,
             start_date TEXT,
             due_date TEXT,
             priority TEXT,
             metadata_json TEXT NOT NULL,
             PRIMARY KEY(source_path, line_number),
             FOREIGN KEY(source_path) REFERENCES records(relative_path) ON DELETE CASCADE
         );
         CREATE INDEX IF NOT EXISTS tasks_task_id_idx ON tasks(task_id);
         CREATE INDEX IF NOT EXISTS tasks_state_due_idx ON tasks(state, due_date);
         CREATE TABLE IF NOT EXISTS backlinks (
             source_path TEXT NOT NULL,
             source_title TEXT NOT NULL,
             target TEXT NOT NULL,
             line_number INTEGER NOT NULL,
             PRIMARY KEY(source_path, target, line_number),
             FOREIGN KEY(source_path) REFERENCES records(relative_path) ON DELETE CASCADE
         );
         CREATE INDEX IF NOT EXISTS backlinks_target_idx ON backlinks(target);
         CREATE TABLE IF NOT EXISTS index_metadata (
             key TEXT PRIMARY KEY,
             value TEXT NOT NULL
         );",
    )?;
    Ok(connection)
}

fn insert_record(transaction: &Transaction<'_>, record: &ScannedRecord) -> CoreResult<()> {
    let tags = record.summary.tags.join(" ");
    transaction.execute(
        "INSERT INTO records (
            relative_path, biota_id, record_type, title, status, tags,
            modified, size, content_hash, content
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            record.summary.relative_path,
            record.summary.biota_id,
            record.summary.record_type,
            record.summary.title,
            record.summary.status,
            tags,
            record.summary.modified,
            record.summary.size as i64,
            record.summary.content_hash,
            record.content,
        ],
    )?;
    let row_id = transaction.last_insert_rowid();
    transaction.execute(
        "INSERT INTO records_fts(rowid, relative_path, title, content, tags)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            row_id,
            record.summary.relative_path,
            record.summary.title,
            record.content,
            tags
        ],
    )?;
    for task in extract_tasks(
        &record.content,
        &record.summary.relative_path,
        &record.summary.title,
    ) {
        transaction.execute(
            "INSERT INTO tasks (
                source_path, source_title, line_number, task_id, text, completed,
                state, start_date, due_date, priority, metadata_json
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                task.source_path,
                task.source_title,
                task.line_number as i64,
                task.task_id,
                task.text,
                i64::from(task.completed),
                task.state,
                task.start,
                task.due,
                task.priority,
                serde_json::to_string(&task.metadata)?,
            ],
        )?;
    }
    for (target, line_number) in extract_backlinks(&record.content) {
        transaction.execute(
            "INSERT INTO backlinks(source_path, source_title, target, line_number)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                record.summary.relative_path,
                record.summary.title,
                target,
                line_number as i64
            ],
        )?;
    }
    Ok(())
}

fn delete_record(transaction: &Transaction<'_>, relative_path: &str) -> CoreResult<()> {
    let row_id = transaction
        .query_row(
            "SELECT rowid FROM records WHERE relative_path = ?1",
            params![relative_path],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    if let Some(row_id) = row_id {
        transaction.execute(
            "DELETE FROM tasks WHERE source_path = ?1",
            params![relative_path],
        )?;
        transaction.execute(
            "DELETE FROM backlinks WHERE source_path = ?1",
            params![relative_path],
        )?;
        transaction.execute("DELETE FROM records_fts WHERE rowid = ?1", params![row_id])?;
        transaction.execute("DELETE FROM records WHERE rowid = ?1", params![row_id])?;
    }
    Ok(())
}

fn remove_prefix(index_path: &Path, relative_path: &str) -> CoreResult<()> {
    let mut connection = open_connection(index_path)?;
    let transaction = connection.transaction()?;
    let escaped = relative_path
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    let pattern = format!("{escaped}/%");
    let paths = {
        let mut statement = transaction.prepare(
            "SELECT relative_path FROM records
             WHERE relative_path = ?1 OR relative_path LIKE ?2 ESCAPE '\\'",
        )?;
        let values = statement
            .query_map(params![relative_path, pattern], |row| {
                row.get::<_, String>(0)
            })?
            .collect::<Result<Vec<_>, _>>()?;
        values
    };
    for path in paths {
        delete_record(&transaction, &path)?;
    }
    set_metadata(&transaction, "generated_at", &Utc::now().to_rfc3339())?;
    transaction.commit()?;
    Ok(())
}

fn set_metadata(transaction: &Transaction<'_>, key: &str, value: &str) -> CoreResult<()> {
    transaction.execute(
        "INSERT INTO index_metadata(key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

fn metadata(
    connection: &Connection,
    index_path: &Path,
    generated_at: &str,
) -> CoreResult<IndexMetadata> {
    let sqlite_version = connection.query_row("SELECT sqlite_version()", [], |row| row.get(0))?;
    let fts5_enabled: i64 = connection.query_row(
        "SELECT sqlite_compileoption_used('ENABLE_FTS5')",
        [],
        |row| row.get(0),
    )?;
    let journal_mode = connection.query_row("PRAGMA journal_mode", [], |row| row.get(0))?;
    let record_count: i64 =
        connection.query_row("SELECT count(*) FROM records", [], |row| row.get(0))?;
    Ok(IndexMetadata {
        engine: "sqlite-fts5".to_owned(),
        sqlite_version,
        fts5_enabled: fts5_enabled == 1,
        journal_mode,
        index_path: index_path.display().to_string(),
        record_count: record_count as usize,
        generated_at: generated_at.to_owned(),
    })
}

fn scan_vault(
    vault_root: &Path,
) -> CoreResult<(Vec<ScannedRecord>, Vec<VaultFile>, Vec<Diagnostic>)> {
    let mut records = Vec::new();
    let mut files = Vec::new();
    let mut diagnostics = Vec::new();

    let walker = WalkDir::new(vault_root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| include_entry(vault_root, entry));
    for item in walker {
        let entry = match item {
            Ok(entry) => entry,
            Err(error) => {
                diagnostics.push(Diagnostic {
                    severity: "warning".to_owned(),
                    code: "scan_error".to_owned(),
                    relative_path: error
                        .path()
                        .and_then(|path| relative_display(vault_root, path).ok()),
                    message: error.to_string(),
                });
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let relative = relative_display(vault_root, entry.path())?;
        let file_metadata = fs::metadata(entry.path())?;
        let extension = entry
            .path()
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        files.push(VaultFile {
            relative_path: relative.clone(),
            file_name: entry.file_name().to_string_lossy().into_owned(),
            size: file_metadata.len(),
            modified: file_metadata
                .modified()
                .map(DateTime::<Utc>::from)
                .unwrap_or_else(|_| Utc::now())
                .to_rfc3339(),
            kind: file_kind(&extension).to_owned(),
            extension: (!extension.is_empty()).then_some(extension.clone()),
        });
        if extension != "md" && extension != "markdown" {
            continue;
        }

        let content = match fs::read_to_string(entry.path()) {
            Ok(content) => content,
            Err(error) => {
                diagnostics.push(Diagnostic {
                    severity: "error".to_owned(),
                    code: "unreadable_record".to_owned(),
                    relative_path: Some(relative),
                    message: error.to_string(),
                });
                continue;
            }
        };
        let (summary, _, frontmatter_error) = summarize(&relative, &content, &file_metadata);
        if let Some(message) = frontmatter_error {
            diagnostics.push(Diagnostic {
                severity: "error".to_owned(),
                code: "malformed_frontmatter".to_owned(),
                relative_path: Some(relative),
                message,
            });
        }
        records.push(ScannedRecord { summary, content });
    }
    records.sort_by(|left, right| left.summary.relative_path.cmp(&right.summary.relative_path));
    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok((records, files, diagnostics))
}

fn include_entry(vault_root: &Path, entry: &DirEntry) -> bool {
    if entry.path() == vault_root {
        return true;
    }
    if entry.file_type().is_symlink() {
        return false;
    }
    entry
        .path()
        .strip_prefix(vault_root)
        .ok()
        .and_then(|relative| relative.components().next())
        .map(|component| {
            !component
                .as_os_str()
                .to_string_lossy()
                .eq_ignore_ascii_case(".biota")
        })
        .unwrap_or(false)
}

fn is_markdown_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("md" | "markdown")
    )
}

fn file_kind(extension: &str) -> &'static str {
    match extension {
        "md" | "markdown" => "markdown",
        "gb" | "gbk" | "genbank" | "fasta" | "fa" | "fna" | "faa" | "dna" | "ab1" => "sequence",
        "csv" | "tsv" => "data",
        "yaml" | "yml" | "json" => "metadata",
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "pdf" | "doc" | "docx" | "xls"
        | "xlsx" | "ppt" | "pptx" | "zip" => "attachment",
        _ => "file",
    }
}

fn summarize(
    relative_path: &str,
    content: &str,
    file_metadata: &fs::Metadata,
) -> (RecordSummary, serde_json::Value, Option<String>) {
    let parsed = parse_frontmatter(content);
    let (yaml, body, error) = match parsed {
        Ok((yaml, body)) => (yaml, body, None),
        Err(message) => (Value::Mapping(Mapping::new()), content, Some(message)),
    };
    let mapping = yaml.as_mapping();
    let value = |key: &str| {
        mapping
            .and_then(|map| map.get(Value::String(key.to_owned())))
            .and_then(yaml_scalar)
    };
    let tags = extract_tags(mapping, content);
    let wikilinks = extract_wikilinks(content);
    let title = value("title")
        .or_else(|| first_heading(body))
        .unwrap_or_else(|| {
            Path::new(relative_path)
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("Untitled")
                .to_owned()
        });
    let modified = file_metadata
        .modified()
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(|_| Utc::now())
        .to_rfc3339();
    let metadata_json = serde_json::to_value(&yaml).unwrap_or(serde_json::Value::Null);
    (
        RecordSummary {
            relative_path: relative_path.to_owned(),
            file_name: Path::new(relative_path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(relative_path)
                .to_owned(),
            biota_id: value("biota_id"),
            record_type: value("biota_type"),
            title,
            status: value("status"),
            tags,
            wikilinks,
            task_count: task_count(content),
            modified,
            size: file_metadata.len(),
            content_hash: hash_bytes(content.as_bytes()),
        },
        metadata_json,
        error,
    )
}

fn parse_frontmatter(content: &str) -> Result<(Value, &str), String> {
    let Some(first_newline) = content.find('\n') else {
        return if content.trim_end_matches('\r') == "---" {
            Err("frontmatter has no closing delimiter".to_owned())
        } else {
            Ok((Value::Mapping(Mapping::new()), content))
        };
    };
    if content[..first_newline].trim_end_matches('\r') != "---" {
        return Ok((Value::Mapping(Mapping::new()), content));
    }

    let yaml_start = first_newline + 1;
    let mut cursor = yaml_start;
    for segment in content[yaml_start..].split_inclusive('\n') {
        let line = segment.trim_end_matches(&['\r', '\n'][..]);
        if line == "---" {
            let yaml_source = &content[yaml_start..cursor];
            let body_start = cursor + segment.len();
            let yaml =
                serde_yaml::from_str::<Value>(yaml_source).map_err(|error| error.to_string())?;
            if !yaml.is_mapping() && !yaml.is_null() {
                return Err("frontmatter must be a YAML mapping".to_owned());
            }
            return Ok((yaml, &content[body_start..]));
        }
        cursor += segment.len();
    }
    Err("frontmatter has no closing delimiter".to_owned())
}

fn yaml_scalar(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

fn extract_tags(mapping: Option<&Mapping>, content: &str) -> Vec<String> {
    let mut tags = BTreeSet::new();
    if let Some(value) = mapping.and_then(|map| map.get(Value::String("tags".to_owned()))) {
        match value {
            Value::Sequence(values) => {
                for value in values {
                    if let Some(tag) = yaml_scalar(value) {
                        tags.insert(tag.trim_start_matches('#').to_owned());
                    }
                }
            }
            Value::String(value) => {
                for tag in value.split([',', ' ']).filter(|tag| !tag.is_empty()) {
                    tags.insert(tag.trim_start_matches('#').to_owned());
                }
            }
            _ => {}
        }
    }

    let expression = Regex::new(r"(?:^|\s)#([\p{L}\p{N}_/-]+)").expect("valid tag regex");
    for captures in expression.captures_iter(content) {
        if let Some(value) = captures.get(1) {
            tags.insert(value.as_str().to_owned());
        }
    }
    tags.into_iter().collect()
}

fn extract_wikilinks(content: &str) -> Vec<String> {
    let mut links = BTreeSet::new();
    for (target, _) in extract_backlinks(content) {
        links.insert(target);
    }
    links.into_iter().collect()
}

fn extract_backlinks(content: &str) -> Vec<(String, usize)> {
    let expression =
        Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]").expect("valid wikilink regex");
    let mut links = BTreeSet::new();
    for (line_index, line) in content.lines().enumerate() {
        for captures in expression.captures_iter(line) {
            if let Some(value) = captures.get(1) {
                links.insert((value.as_str().trim().to_owned(), line_index + 1));
            }
        }
    }
    links.into_iter().collect()
}

fn extract_tasks(content: &str, source_path: &str, source_title: &str) -> Vec<IndexedTask> {
    let task_expression = Regex::new(r"^\s*[-*+]\s+\[([ xX])\]\s+(.*)$").expect("valid task regex");
    let comment_expression =
        Regex::new(r"(?s)<!--\s*biota-task(?:\s+(.*?))?\s*-->").expect("valid task metadata regex");
    let attribute_expression =
        Regex::new(r#"([A-Za-z][A-Za-z0-9_-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))"#)
            .expect("valid task attribute regex");
    let lines = content.lines().collect::<Vec<_>>();
    let mut tasks = Vec::new();

    for (line_index, line) in lines.iter().enumerate() {
        let Some(captures) = task_expression.captures(line) else {
            continue;
        };
        let completed = captures
            .get(1)
            .map(|value| !value.as_str().eq(" "))
            .unwrap_or(false);
        let remainder = captures.get(2).map(|value| value.as_str()).unwrap_or("");
        let metadata_comment = comment_expression.captures(remainder).or_else(|| {
            lines
                .get(line_index + 1)
                .and_then(|next| comment_expression.captures(next))
        });
        let mut task_metadata = BTreeMap::new();
        if let Some(comment) = metadata_comment {
            if let Some(attributes) = comment.get(1) {
                for attribute in attribute_expression.captures_iter(attributes.as_str()) {
                    let Some(key) = attribute.get(1) else {
                        continue;
                    };
                    let value = attribute
                        .get(2)
                        .or_else(|| attribute.get(3))
                        .or_else(|| attribute.get(4))
                        .map(|capture| capture.as_str())
                        .unwrap_or("");
                    task_metadata.insert(key.as_str().to_owned(), value.to_owned());
                }
            }
        }
        let text = comment_expression
            .replace_all(remainder, "")
            .trim()
            .to_owned();
        tasks.push(IndexedTask {
            task_id: task_metadata.get("id").cloned(),
            source_path: source_path.to_owned(),
            source_title: source_title.to_owned(),
            line_number: line_index + 1,
            text,
            completed,
            state: task_metadata.get("state").cloned(),
            start: task_metadata.get("start").cloned(),
            due: task_metadata.get("due").cloned(),
            priority: task_metadata.get("priority").cloned(),
            metadata: task_metadata,
        });
    }
    tasks
}

fn first_heading(body: &str) -> Option<String> {
    body.lines()
        .find_map(|line| line.strip_prefix("# ").map(str::trim))
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn task_count(content: &str) -> usize {
    let expression = Regex::new(r"(?m)^\s*[-*+]\s+\[[ xX]\]\s+").expect("valid task regex");
    expression.find_iter(content).count()
}

fn make_fts_query(input: &str) -> String {
    let expression = Regex::new(r"[\p{L}\p{N}_-]+").expect("valid search-token regex");
    expression
        .find_iter(input)
        .map(|token| format!("\"{}\"", token.as_str().replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" AND ")
}

fn row_to_result(row: &rusqlite::Row<'_>) -> rusqlite::Result<SearchResult> {
    Ok(SearchResult {
        relative_path: row.get(0)?,
        title: row.get(1)?,
        record_type: row.get(2)?,
        status: row.get(3)?,
        snippet: row.get(4)?,
        score: row.get(5)?,
    })
}

fn collect_results<I>(rows: I) -> CoreResult<Vec<SearchResult>>
where
    I: Iterator<Item = rusqlite::Result<SearchResult>>,
{
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn scans_frontmatter_wikilinks_tags_and_tasks() {
        let vault = tempdir().unwrap();
        let index_dir = tempdir().unwrap();
        fs::create_dir_all(vault.path().join("Experiments")).unwrap();
        fs::write(
            vault.path().join("Experiments/pilot.md"),
            "---\nbiota_id: 01TEST\nbiota_type: experiment\ntitle: Pilot\nstatus: planned\ntags: [assay]\nunknown: retained\n---\n# Body\n- [ ] Run #today [[Protocols/Test]]\n  <!-- biota-task id=01TASK state=scheduled start=2026-08-01 due=2026-08-02 priority=high -->\n",
        )
        .unwrap();
        fs::create_dir_all(vault.path().join("Sequences")).unwrap();
        fs::create_dir_all(vault.path().join("Data")).unwrap();
        fs::create_dir_all(vault.path().join("Attachments")).unwrap();
        fs::create_dir_all(vault.path().join(".biota")).unwrap();
        fs::write(vault.path().join("Sequences/vector.gb"), "LOCUS").unwrap();
        fs::write(vault.path().join("Data/results.csv"), "x,y\n1,2").unwrap();
        fs::write(vault.path().join("Attachments/figure.png"), b"png").unwrap();
        fs::write(vault.path().join(".biota/private.md"), "private").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(
            vault.path().join("Experiments/pilot.md"),
            vault.path().join("pilot-alias.md"),
        )
        .unwrap();

        let index_path = index_dir.path().join("index.sqlite3");
        let scan = rebuild(vault.path(), &index_path).unwrap();
        assert_eq!(scan.records.len(), 1);
        assert_eq!(scan.records[0].title, "Pilot");
        assert_eq!(scan.records[0].task_count, 1);
        assert_eq!(scan.records[0].wikilinks, vec!["Protocols/Test"]);
        assert_eq!(scan.records[0].tags, vec!["assay", "today"]);
        assert!(scan.index.fts5_enabled);
        assert_eq!(scan.files.len(), 4);
        assert!(scan.files.iter().any(|file| {
            file.relative_path == "Sequences/vector.gb" && file.kind == "sequence"
        }));
        assert!(scan
            .files
            .iter()
            .any(|file| file.relative_path == "Data/results.csv" && file.kind == "data"));
        assert!(scan.files.iter().all(|file| {
            !file.relative_path.starts_with(".biota") && file.relative_path != "pilot-alias.md"
        }));

        let tasks = task_list(&index_path).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].task_id.as_deref(), Some("01TASK"));
        assert_eq!(tasks[0].source_path, "Experiments/pilot.md");
        assert_eq!(tasks[0].source_title, "Pilot");
        assert_eq!(tasks[0].line_number, 10);
        assert_eq!(tasks[0].state.as_deref(), Some("scheduled"));
        assert_eq!(tasks[0].due.as_deref(), Some("2026-08-02"));
        assert_eq!(
            tasks[0].metadata.get("priority").map(String::as_str),
            Some("high")
        );

        let connection = open_connection(&index_path).unwrap();
        let backlink_count: i64 = connection
            .query_row("SELECT count(*) FROM backlinks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(backlink_count, 1);
    }

    #[test]
    fn search_uses_the_rebuildable_fts_index() {
        let vault = tempdir().unwrap();
        let index_dir = tempdir().unwrap();
        fs::write(
            vault.path().join("kinetics.md"),
            "---\nbiota_type: analysis\ntitle: Enzyme kinetics\n---\nMichaelis Menten measurements",
        )
        .unwrap();
        let index_path = index_dir.path().join("index.sqlite3");
        rebuild(vault.path(), &index_path).unwrap();

        let results = search(
            &index_path,
            &SearchRequest {
                query: "Michaelis".to_owned(),
                record_types: Some(vec!["analysis".to_owned()]),
                limit: Some(10),
            },
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].relative_path, "kinetics.md");
    }

    #[test]
    fn external_markdown_changes_are_incrementally_reindexed() {
        let vault = tempdir().unwrap();
        let index_dir = tempdir().unwrap();
        let index_path = index_dir.path().join("index.sqlite3");
        rebuild(vault.path(), &index_path).unwrap();

        let relative_path = "Projects/roadmap.md";
        fs::create_dir_all(vault.path().join("Projects")).unwrap();
        fs::write(
            vault.path().join(relative_path),
            "---\ntitle: Roadmap\n---\n- [ ] First task",
        )
        .unwrap();
        sync_external(vault.path(), &index_path, relative_path).unwrap();
        let tasks = task_list(&index_path).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].source_title, "Roadmap");

        fs::write(
            vault.path().join(relative_path),
            "---\ntitle: Updated roadmap\n---\n- [x] Finished task",
        )
        .unwrap();
        sync_external(vault.path(), &index_path, relative_path).unwrap();
        let tasks = task_list(&index_path).unwrap();
        assert_eq!(tasks.len(), 1);
        assert!(tasks[0].completed);
        assert_eq!(tasks[0].source_title, "Updated roadmap");

        fs::remove_file(vault.path().join(relative_path)).unwrap();
        sync_external(vault.path(), &index_path, relative_path).unwrap();
        assert!(task_list(&index_path).unwrap().is_empty());
        assert!(search(
            &index_path,
            &SearchRequest {
                query: "Updated".to_owned(),
                record_types: None,
                limit: None,
            }
        )
        .unwrap()
        .is_empty());
    }

    #[test]
    fn rebuild_reports_then_clears_frontmatter_and_duplicate_id_diagnostics() {
        let vault = tempdir().unwrap();
        let index_dir = tempdir().unwrap();
        let index_path = index_dir.path().join("index.sqlite3");
        fs::write(
            vault.path().join("first.md"),
            "---\nbiota_id: DUPLICATE\nbiota_type: note\ntitle: First\n---\nFirst body",
        )
        .unwrap();
        fs::write(
            vault.path().join("second.md"),
            "---\nbiota_id: DUPLICATE\nbiota_type: note\ntitle: Second\n---\nSecond body",
        )
        .unwrap();
        fs::write(
            vault.path().join("broken.md"),
            "---\nbiota_id: [not valid yaml\n---\nBroken body",
        )
        .unwrap();

        let first_scan = rebuild(vault.path(), &index_path).unwrap();
        assert_eq!(first_scan.records.len(), 3);
        assert!(first_scan
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "duplicate_biota_id"));
        assert!(first_scan.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "malformed_frontmatter"
                && diagnostic.relative_path.as_deref() == Some("broken.md")
        }));

        fs::write(
            vault.path().join("second.md"),
            "---\nbiota_id: SECOND\nbiota_type: note\ntitle: Second\n---\nSecond body",
        )
        .unwrap();
        fs::write(
            vault.path().join("broken.md"),
            "---\nbiota_id: REPAIRED\nbiota_type: note\ntitle: Repaired\n---\nRepaired body",
        )
        .unwrap();
        let repaired_scan = rebuild(vault.path(), &index_path).unwrap();
        assert!(repaired_scan.diagnostics.is_empty());
        assert_eq!(repaired_scan.index.record_count, 3);

        fs::remove_file(vault.path().join("first.md")).unwrap();
        let deletion_scan = rebuild(vault.path(), &index_path).unwrap();
        assert_eq!(deletion_scan.records.len(), 2);
        assert!(search(
            &index_path,
            &SearchRequest {
                query: "First".to_owned(),
                record_types: None,
                limit: None,
            }
        )
        .unwrap()
        .is_empty());

        fs::write(
            vault.path().join("first.md"),
            "---\nbiota_id: RECREATED\nbiota_type: note\ntitle: Recreated\n---\nNew body",
        )
        .unwrap();
        let recreated_scan = rebuild(vault.path(), &index_path).unwrap();
        assert_eq!(recreated_scan.records.len(), 3);
        assert_eq!(
            search(
                &index_path,
                &SearchRequest {
                    query: "Recreated".to_owned(),
                    record_types: None,
                    limit: None,
                }
            )
            .unwrap()
            .len(),
            1
        );
    }
}
