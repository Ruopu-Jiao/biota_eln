use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultManifest {
    pub schema: u32,
    pub vault_id: String,
    pub name: String,
    pub created: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultSummary {
    pub root_path: String,
    pub manifest: VaultManifest,
    pub default_folders: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVaultRequest {
    pub path: String,
    pub name: Option<String>,
    #[serde(default = "default_true")]
    pub create_default_folders: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordSummary {
    pub relative_path: String,
    pub file_name: String,
    pub biota_id: Option<String>,
    pub record_type: Option<String>,
    pub title: String,
    pub status: Option<String>,
    pub tags: Vec<String>,
    pub wikilinks: Vec<String>,
    pub task_count: usize,
    pub modified: String,
    pub size: u64,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordDocument {
    pub relative_path: String,
    pub content: String,
    pub content_hash: String,
    pub modified: String,
    pub size: u64,
    pub metadata: serde_json::Value,
    pub summary: RecordSummary,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteRecordRequest {
    pub relative_path: String,
    pub content: String,
    pub expected_hash: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteRecordResponse {
    pub document: RecordDocument,
    pub history_event: HistoryEvent,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveRecordRequest {
    pub from_path: String,
    pub to_path: String,
    pub expected_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveRecordResponse {
    pub from_path: String,
    pub document: RecordDocument,
    pub history_event: HistoryEvent,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryFileWriteRequest {
    pub relative_path: String,
    pub bytes: Vec<u8>,
    pub expected_hash: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryFileResponse {
    pub relative_path: String,
    pub content_hash: String,
    pub size: u64,
    pub history_event: HistoryEvent,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetReadRequest {
    pub owner_relative_path: String,
    pub data_relative_path: String,
    pub schema_relative_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetWriteRequest {
    pub owner_relative_path: String,
    pub data_relative_path: String,
    pub schema_relative_path: String,
    pub data_content: String,
    pub schema_content: String,
    pub expected_data_hash: Option<String>,
    pub expected_schema_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SheetTextFile {
    pub relative_path: String,
    pub content: String,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SheetBundleResponse {
    pub owner_relative_path: String,
    pub data: SheetTextFile,
    pub schema: SheetTextFile,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub severity: String,
    pub code: String,
    pub relative_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexMetadata {
    pub engine: String,
    pub sqlite_version: String,
    pub fts5_enabled: bool,
    pub journal_mode: String,
    pub index_path: String,
    pub record_count: usize,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VaultFile {
    pub relative_path: String,
    pub file_name: String,
    pub size: u64,
    pub modified: String,
    pub kind: String,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultScan {
    pub records: Vec<RecordSummary>,
    pub files: Vec<VaultFile>,
    pub diagnostics: Vec<Diagnostic>,
    pub index: IndexMetadata,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRequest {
    pub query: String,
    pub record_types: Option<Vec<String>>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub relative_path: String,
    pub title: String,
    pub record_type: Option<String>,
    pub status: Option<String>,
    pub snippet: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexedTask {
    pub task_id: Option<String>,
    pub source_path: String,
    pub source_title: String,
    pub line_number: usize,
    pub text: String,
    pub completed: bool,
    pub state: Option<String>,
    pub start: Option<String>,
    pub due: Option<String>,
    pub priority: Option<String>,
    pub metadata: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HistoryEventKind {
    Autosave,
    Checkpoint,
    Finalize,
    RevisionOpened,
    Restore,
    Move,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestEntry {
    pub relative_path: String,
    pub content_hash: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEvent {
    pub event_id: String,
    pub sequence: u64,
    pub kind: HistoryEventKind,
    pub timestamp: String,
    pub relative_path: String,
    pub content_hash: String,
    pub previous_event_hash: Option<String>,
    pub event_hash: String,
    pub message: Option<String>,
    pub source_event_id: Option<String>,
    pub moved_from: Option<String>,
    pub manifest: Vec<ManifestEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPathRequest {
    pub relative_path: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalizeRequest {
    pub relative_path: String,
    #[serde(default)]
    pub dependencies: Vec<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRequest {
    pub relative_path: String,
    pub event_id: String,
    pub expected_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryVerification {
    pub valid: bool,
    pub event_count: usize,
    pub object_count: usize,
    pub problems: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultChangeEvent {
    pub kind: String,
    pub paths: Vec<String>,
}
