mod error;
mod history;
mod index;
mod models;
mod pathing;
mod sheet;

use crate::{
    error::{CommandError, CommandResult, CoreError, CoreResult},
    history::HistoryEventDraft,
    models::{
        BinaryFileResponse, BinaryFileWriteRequest, CreateVaultRequest, FinalizeRequest,
        HistoryEvent, HistoryEventKind, HistoryPathRequest, HistoryVerification, IndexedTask,
        ManifestEntry, MoveRecordRequest, MoveRecordResponse, RecordDocument, RestoreRequest,
        SearchRequest, SearchResult, SheetBundleResponse, SheetReadRequest, SheetWriteRequest,
        VaultChangeEvent, VaultManifest, VaultScan, VaultSummary, WriteRecordRequest,
        WriteRecordResponse,
    },
};
use chrono::Utc;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, RwLock},
};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

const VAULT_SCHEMA: u32 = 1;
const DEFAULT_FOLDERS: &[&str] = &[
    "Experiments",
    "Protocols",
    "Projects",
    "Entities",
    "Sequences",
    "Data",
    "Attachments",
    "Daily Notes",
    "Analyses",
];

#[derive(Clone)]
struct VaultContext {
    root: PathBuf,
    manifest: VaultManifest,
    index_path: PathBuf,
}

struct AppState {
    vault: RwLock<Option<VaultContext>>,
    config_dir: PathBuf,
    operation_lock: Mutex<()>,
    watcher: Mutex<Option<RecommendedWatcher>>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct PersistedState {
    selected_vault: Option<String>,
    #[serde(default)]
    recent_vaults: Vec<String>,
}

#[tauri::command]
fn vault_create(
    app: AppHandle,
    state: State<'_, AppState>,
    request: CreateVaultRequest,
) -> CommandResult<VaultSummary> {
    create_vault(&request, &state.config_dir)
        .and_then(|context| {
            index::rebuild(&context.root, &context.index_path)?;
            activate_vault(&app, &state, context.clone())?;
            Ok(summary(&context))
        })
        .map_err(CommandError::from)
}

#[tauri::command]
fn vault_open(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> CommandResult<VaultSummary> {
    open_vault(Path::new(&path), &state.config_dir)
        .and_then(|context| {
            index::rebuild(&context.root, &context.index_path)?;
            activate_vault(&app, &state, context.clone())?;
            Ok(summary(&context))
        })
        .map_err(CommandError::from)
}

#[tauri::command]
fn vault_current(state: State<'_, AppState>) -> CommandResult<Option<VaultSummary>> {
    let context = state
        .vault
        .read()
        .map_err(|_| lock_error("vault state"))?
        .clone();
    Ok(context.as_ref().map(summary))
}

#[tauri::command]
fn vault_close(state: State<'_, AppState>) -> CommandResult<()> {
    {
        let mut vault = state
            .vault
            .write()
            .map_err(|_| CommandError::from(lock_error("vault state")))?;
        *vault = None;
    }
    {
        let mut watcher = state
            .watcher
            .lock()
            .map_err(|_| CommandError::from(lock_error("vault watcher")))?;
        *watcher = None;
    }
    persist_selected(&state, None).map_err(CommandError::from)
}

#[tauri::command]
fn vault_scan(state: State<'_, AppState>) -> CommandResult<VaultScan> {
    let context = current_context(&state).map_err(CommandError::from)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| CommandError::from(lock_error("vault operation")))?;
    index::rebuild(&context.root, &context.index_path).map_err(CommandError::from)
}

#[tauri::command]
fn search_metadata(
    state: State<'_, AppState>,
    request: SearchRequest,
) -> CommandResult<Vec<SearchResult>> {
    let context = current_context(&state).map_err(CommandError::from)?;
    index::search(&context.index_path, &request).map_err(CommandError::from)
}

#[tauri::command]
fn index_metadata(state: State<'_, AppState>) -> CommandResult<models::IndexMetadata> {
    let context = current_context(&state).map_err(CommandError::from)?;
    index::current_metadata(&context.index_path).map_err(CommandError::from)
}

#[tauri::command]
fn task_list(state: State<'_, AppState>) -> CommandResult<Vec<IndexedTask>> {
    let context = current_context(&state).map_err(CommandError::from)?;
    index::task_list(&context.index_path).map_err(CommandError::from)
}

#[tauri::command]
fn record_read(state: State<'_, AppState>, relative_path: String) -> CommandResult<RecordDocument> {
    let context = current_context(&state).map_err(CommandError::from)?;
    pathing::validate_relative_path(&relative_path)
        .and_then(|_| pathing::resolve_existing(&context.root, &relative_path))
        .and_then(|path| {
            pathing::ensure_text_record_path(&path)?;
            index::read_document(&context.root, &path)
        })
        .map_err(CommandError::from)
}

#[tauri::command]
fn record_write(
    state: State<'_, AppState>,
    request: WriteRecordRequest,
) -> CommandResult<WriteRecordResponse> {
    write_record(&state, request).map_err(CommandError::from)
}

#[tauri::command]
fn record_move(
    state: State<'_, AppState>,
    request: MoveRecordRequest,
) -> CommandResult<MoveRecordResponse> {
    move_record(&state, request).map_err(CommandError::from)
}

#[tauri::command]
fn file_read_binary(state: State<'_, AppState>, relative_path: String) -> CommandResult<Vec<u8>> {
    const MAX_BINARY_BYTES: u64 = 64 * 1024 * 1024;
    let context = current_context(&state).map_err(CommandError::from)?;
    pathing::validate_relative_path(&relative_path)
        .and_then(|_| pathing::resolve_existing(&context.root, &relative_path))
        .and_then(|path| {
            let metadata = fs::metadata(&path)?;
            if !metadata.is_file() {
                return Err(CoreError::InvalidDocument(format!(
                    "{relative_path} is not a file"
                )));
            }
            if metadata.len() > MAX_BINARY_BYTES {
                return Err(CoreError::InvalidDocument(format!(
                    "{relative_path} exceeds the 64 MiB interactive import limit"
                )));
            }
            Ok(fs::read(path)?)
        })
        .map_err(CommandError::from)
}

#[tauri::command]
fn file_write_binary(
    state: State<'_, AppState>,
    request: BinaryFileWriteRequest,
) -> CommandResult<BinaryFileResponse> {
    write_binary_file(&state, request).map_err(CommandError::from)
}

#[tauri::command]
fn sheet_read(
    state: State<'_, AppState>,
    request: SheetReadRequest,
) -> CommandResult<SheetBundleResponse> {
    let context = current_context(&state).map_err(CommandError::from)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| CommandError::from(lock_error("vault operation")))?;
    sheet::read_bundle(&context.root, request).map_err(CommandError::from)
}

#[tauri::command]
fn sheet_write(
    state: State<'_, AppState>,
    request: SheetWriteRequest,
) -> CommandResult<SheetBundleResponse> {
    let context = current_context(&state).map_err(CommandError::from)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| CommandError::from(lock_error("vault operation")))?;
    sheet::write_bundle(&context.root, request).map_err(CommandError::from)
}

#[tauri::command]
fn history_checkpoint(
    state: State<'_, AppState>,
    request: HistoryPathRequest,
) -> CommandResult<HistoryEvent> {
    let context = current_context(&state).map_err(CommandError::from)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| CommandError::from(lock_error("vault operation")))?;
    checkpoint(&context, request).map_err(CommandError::from)
}

#[tauri::command]
fn history_finalize(
    state: State<'_, AppState>,
    request: FinalizeRequest,
) -> CommandResult<HistoryEvent> {
    let context = current_context(&state).map_err(CommandError::from)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| CommandError::from(lock_error("vault operation")))?;
    finalize(&context, request).map_err(CommandError::from)
}

#[tauri::command]
fn history_create_revision(
    state: State<'_, AppState>,
    request: HistoryPathRequest,
) -> CommandResult<HistoryEvent> {
    let context = current_context(&state).map_err(CommandError::from)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| CommandError::from(lock_error("vault operation")))?;
    create_revision(&context, request).map_err(CommandError::from)
}

#[tauri::command]
fn history_restore(
    state: State<'_, AppState>,
    request: RestoreRequest,
) -> CommandResult<WriteRecordResponse> {
    let context = current_context(&state).map_err(CommandError::from)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| CommandError::from(lock_error("vault operation")))?;
    restore(&context, request).map_err(CommandError::from)
}

#[tauri::command]
fn history_list(
    state: State<'_, AppState>,
    relative_path: Option<String>,
) -> CommandResult<Vec<HistoryEvent>> {
    let context = current_context(&state).map_err(CommandError::from)?;
    let normalized = relative_path
        .as_deref()
        .map(normalize_relative)
        .transpose()
        .map_err(CommandError::from)?;
    history::events_for_path(&context.root, normalized.as_deref()).map_err(CommandError::from)
}

#[tauri::command]
fn history_verify(state: State<'_, AppState>) -> CommandResult<HistoryVerification> {
    let context = current_context(&state).map_err(CommandError::from)?;
    history::verify_history(&context.root).map_err(CommandError::from)
}

#[tauri::command]
async fn analysis_run(request: serde_json::Value) -> CommandResult<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(move || run_analysis_sidecar(request))
        .await
        .map_err(|error| CommandError::from(CoreError::Analysis(error.to_string())))?
        .map_err(CommandError::from)
}

fn run_analysis_sidecar(request: serde_json::Value) -> CoreResult<serde_json::Value> {
    const MAX_REQUEST_BYTES: usize = 16 * 1024 * 1024;
    const MAX_RESPONSE_BYTES: usize = 64 * 1024 * 1024;

    let payload = serde_json::to_vec(&request)?;
    if payload.len() > MAX_REQUEST_BYTES {
        return Err(CoreError::Analysis(format!(
            "request is larger than {} MiB",
            MAX_REQUEST_BYTES / (1024 * 1024)
        )));
    }

    let binary = analysis_sidecar_path()?;
    let mut child = Command::new(&binary)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            CoreError::Analysis(format!("could not start {}: {error}", binary.display()))
        })?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| CoreError::Analysis("analysis stdin is unavailable".to_owned()))?;
    stdin.write_all(&payload)?;
    stdin.write_all(b"\n")?;
    drop(stdin);

    let output = child.wait_with_output()?;
    if output.stdout.len() > MAX_RESPONSE_BYTES {
        return Err(CoreError::Analysis(format!(
            "response is larger than {} MiB",
            MAX_RESPONSE_BYTES / (1024 * 1024)
        )));
    }
    if output.stdout.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(CoreError::Analysis(format!(
            "engine exited with {} without a JSON response{}",
            output.status,
            if stderr.trim().is_empty() {
                String::new()
            } else {
                format!(": {}", stderr.trim())
            }
        )));
    }
    serde_json::from_slice(&output.stdout).map_err(|error| {
        CoreError::Analysis(format!(
            "engine returned invalid JSON ({error}): {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    })
}

fn analysis_sidecar_path() -> CoreResult<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            candidates.push(parent.join("biota-analysis-engine"));
        }
    }
    if cfg!(debug_assertions) {
        candidates.push(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("binaries")
                .join("biota-analysis-engine-aarch64-apple-darwin"),
        );
    }
    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            CoreError::Analysis(
                "bundled analysis engine is missing; run npm run sidecar:build --workspace @biota/desktop"
                    .to_owned(),
            )
        })
}

fn write_record(state: &AppState, request: WriteRecordRequest) -> CoreResult<WriteRecordResponse> {
    let context = current_context(state)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| lock_error("vault operation"))?;
    let relative_path = normalize_relative(&request.relative_path)?;
    let target = pathing::resolve_for_write(&context.root, &relative_path)?;
    pathing::ensure_text_record_path(&target)?;
    if target.is_dir() {
        return Err(CoreError::InvalidDocument(format!(
            "{relative_path} is a directory"
        )));
    }
    if history::is_finalized(&context.root, &relative_path)? {
        return Err(CoreError::Finalized);
    }
    verify_expected_hash(&target, request.expected_hash.as_deref())?;

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
        let canonical_parent = fs::canonicalize(parent)?;
        if !canonical_parent.starts_with(&context.root) {
            return Err(CoreError::OutsideVault(relative_path));
        }
    }

    let content_hash = history::store_revision(&context.root, request.content.as_bytes())?;
    pathing::atomic_write(&target, request.content.as_bytes())?;
    let event = history::append_event(
        &context.root,
        HistoryEventDraft {
            kind: Some(HistoryEventKind::Autosave),
            relative_path: relative_path.clone(),
            content_hash,
            message: request.message,
            ..HistoryEventDraft::default()
        },
    )?;
    index::upsert(&context.root, &context.index_path, &relative_path)?;
    let document = index::read_document(&context.root, &target)?;
    Ok(WriteRecordResponse {
        document,
        history_event: event,
    })
}

fn write_binary_file(
    state: &AppState,
    request: BinaryFileWriteRequest,
) -> CoreResult<BinaryFileResponse> {
    const MAX_BINARY_BYTES: usize = 64 * 1024 * 1024;
    if request.bytes.len() > MAX_BINARY_BYTES {
        return Err(CoreError::InvalidDocument(
            "binary import exceeds the 64 MiB interactive import limit".to_owned(),
        ));
    }
    let context = current_context(state)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| lock_error("vault operation"))?;
    let relative_path = normalize_relative(&request.relative_path)?;
    let target = pathing::resolve_for_write(&context.root, &relative_path)?;
    if target.is_dir() {
        return Err(CoreError::InvalidDocument(format!(
            "{relative_path} is a directory"
        )));
    }
    if history::is_finalized(&context.root, &relative_path)? {
        return Err(CoreError::Finalized);
    }
    verify_expected_hash(&target, request.expected_hash.as_deref())?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
        let canonical_parent = fs::canonicalize(parent)?;
        if !canonical_parent.starts_with(&context.root) {
            return Err(CoreError::OutsideVault(relative_path));
        }
    }

    let content_hash = history::store_revision(&context.root, &request.bytes)?;
    pathing::atomic_write(&target, &request.bytes)?;
    let history_event = history::append_event(
        &context.root,
        HistoryEventDraft {
            kind: Some(HistoryEventKind::Autosave),
            relative_path: relative_path.clone(),
            content_hash: content_hash.clone(),
            message: request.message,
            ..HistoryEventDraft::default()
        },
    )?;
    index::sync_external(&context.root, &context.index_path, &relative_path)?;
    Ok(BinaryFileResponse {
        relative_path,
        content_hash,
        size: request.bytes.len() as u64,
        history_event,
    })
}

fn move_record(state: &AppState, request: MoveRecordRequest) -> CoreResult<MoveRecordResponse> {
    let context = current_context(state)?;
    let _operation = state
        .operation_lock
        .lock()
        .map_err(|_| lock_error("vault operation"))?;
    let from_path = normalize_relative(&request.from_path)?;
    let to_path = normalize_relative(&request.to_path)?;
    if from_path == to_path {
        return Err(CoreError::InvalidPath(
            "source and destination are the same".to_owned(),
        ));
    }
    if history::is_finalized(&context.root, &from_path)? {
        return Err(CoreError::Finalized);
    }
    let source = pathing::resolve_existing(&context.root, &from_path)?;
    if !source.is_file() {
        return Err(CoreError::InvalidDocument(format!(
            "{from_path} is not a file"
        )));
    }
    verify_expected_hash(&source, request.expected_hash.as_deref())?;
    let destination = pathing::resolve_for_write(&context.root, &to_path)?;
    if destination.exists() {
        return Err(CoreError::AlreadyExists(to_path));
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
        let canonical_parent = fs::canonicalize(parent)?;
        if !canonical_parent.starts_with(&context.root) {
            return Err(CoreError::OutsideVault(request.to_path));
        }
    }

    let bytes = fs::read(&source)?;
    let content_hash = history::store_revision(&context.root, &bytes)?;
    fs::rename(&source, &destination)?;
    let event = history::append_event(
        &context.root,
        HistoryEventDraft {
            kind: Some(HistoryEventKind::Move),
            relative_path: to_path.clone(),
            content_hash,
            moved_from: Some(from_path.clone()),
            ..HistoryEventDraft::default()
        },
    )?;
    index::remove(&context.index_path, &from_path)?;
    index::upsert(&context.root, &context.index_path, &to_path)?;
    let document = index::read_document(&context.root, &destination)?;
    Ok(MoveRecordResponse {
        from_path,
        document,
        history_event: event,
    })
}

fn checkpoint(context: &VaultContext, request: HistoryPathRequest) -> CoreResult<HistoryEvent> {
    let relative_path = normalize_relative(&request.relative_path)?;
    let path = pathing::resolve_existing(&context.root, &relative_path)?;
    let bytes = fs::read(path)?;
    let content_hash = history::store_revision(&context.root, &bytes)?;
    history::append_event(
        &context.root,
        HistoryEventDraft {
            kind: Some(HistoryEventKind::Checkpoint),
            relative_path,
            content_hash,
            message: request.message,
            ..HistoryEventDraft::default()
        },
    )
}

fn finalize(context: &VaultContext, request: FinalizeRequest) -> CoreResult<HistoryEvent> {
    let relative_path = normalize_relative(&request.relative_path)?;
    if history::is_finalized(&context.root, &relative_path)? {
        return Err(CoreError::Finalized);
    }

    let mut requested_paths = Vec::with_capacity(request.dependencies.len() + 1);
    requested_paths.push(relative_path.clone());
    for dependency in request.dependencies {
        requested_paths.push(normalize_relative(&dependency)?);
    }
    let mut seen = BTreeSet::new();
    let mut manifest = Vec::new();
    for item in requested_paths {
        if !seen.insert(item.clone()) {
            continue;
        }
        let path = pathing::resolve_existing(&context.root, &item)?;
        if !path.is_file() {
            return Err(CoreError::InvalidDocument(format!("{item} is not a file")));
        }
        let bytes = fs::read(path)?;
        let content_hash = history::store_revision(&context.root, &bytes)?;
        manifest.push(ManifestEntry {
            relative_path: item,
            content_hash,
            size: bytes.len() as u64,
        });
    }
    let content_hash = manifest
        .first()
        .map(|entry| entry.content_hash.clone())
        .ok_or_else(|| CoreError::InvalidHistory("empty finalization manifest".to_owned()))?;
    history::append_event(
        &context.root,
        HistoryEventDraft {
            kind: Some(HistoryEventKind::Finalize),
            relative_path,
            content_hash,
            message: request.message,
            manifest,
            ..HistoryEventDraft::default()
        },
    )
}

fn create_revision(
    context: &VaultContext,
    request: HistoryPathRequest,
) -> CoreResult<HistoryEvent> {
    let relative_path = normalize_relative(&request.relative_path)?;
    if !history::is_finalized(&context.root, &relative_path)? {
        return Err(CoreError::InvalidHistory(
            "the record is not finalized".to_owned(),
        ));
    }
    let path = pathing::resolve_existing(&context.root, &relative_path)?;
    let bytes = fs::read(path)?;
    let content_hash = history::store_revision(&context.root, &bytes)?;
    history::append_event(
        &context.root,
        HistoryEventDraft {
            kind: Some(HistoryEventKind::RevisionOpened),
            relative_path,
            content_hash,
            message: request.message,
            ..HistoryEventDraft::default()
        },
    )
}

fn restore(context: &VaultContext, request: RestoreRequest) -> CoreResult<WriteRecordResponse> {
    let relative_path = normalize_relative(&request.relative_path)?;
    if history::is_finalized(&context.root, &relative_path)? {
        return Err(CoreError::Finalized);
    }
    let target = pathing::resolve_for_write(&context.root, &relative_path)?;
    verify_expected_hash(&target, request.expected_hash.as_deref())?;
    let source = history::load_events(&context.root)?
        .into_iter()
        .find(|event| event.event_id == request.event_id && event.relative_path == relative_path)
        .ok_or_else(|| CoreError::NotFound(request.event_id.clone()))?;
    let bytes = history::read_revision(&context.root, &source.content_hash)?;
    pathing::atomic_write(&target, &bytes)?;
    let event = history::append_event(
        &context.root,
        HistoryEventDraft {
            kind: Some(HistoryEventKind::Restore),
            relative_path: relative_path.clone(),
            content_hash: source.content_hash,
            source_event_id: Some(source.event_id),
            message: Some("Restored an earlier revision".to_owned()),
            ..HistoryEventDraft::default()
        },
    )?;
    index::upsert(&context.root, &context.index_path, &relative_path)?;
    let document = index::read_document(&context.root, &target)?;
    Ok(WriteRecordResponse {
        document,
        history_event: event,
    })
}

pub(crate) fn verify_expected_hash(path: &Path, expected: Option<&str>) -> CoreResult<()> {
    let Some(expected) = expected else {
        return Ok(());
    };
    let actual = if path.exists() {
        history::hash_bytes(&fs::read(path)?)
    } else {
        String::new()
    };
    if actual != expected {
        return Err(CoreError::Conflict {
            expected: expected.to_owned(),
            actual,
        });
    }
    Ok(())
}

fn create_vault(request: &CreateVaultRequest, config_dir: &Path) -> CoreResult<VaultContext> {
    let requested = PathBuf::from(&request.path);
    if !requested.is_absolute() {
        return Err(CoreError::InvalidVault(
            "the vault path must be absolute".to_owned(),
        ));
    }
    if !requested.exists() {
        fs::create_dir_all(&requested)?;
    }
    let root = pathing::canonical_vault_root(&requested)?;
    let manifest_path = root.join(".biota").join("vault.json");
    if manifest_path.exists() {
        return Err(CoreError::AlreadyExists(
            manifest_path.display().to_string(),
        ));
    }
    fs::create_dir_all(root.join(".biota"))?;
    let fallback_name = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Biota Vault")
        .to_owned();
    let name = request
        .name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&fallback_name)
        .to_owned();
    let manifest = VaultManifest {
        schema: VAULT_SCHEMA,
        vault_id: Uuid::new_v4().to_string(),
        name,
        created: Utc::now().to_rfc3339(),
    };
    pathing::atomic_write(&manifest_path, &serde_json::to_vec_pretty(&manifest)?)?;
    history::initialize(&root)?;
    if request.create_default_folders {
        for folder in DEFAULT_FOLDERS {
            fs::create_dir_all(root.join(folder))?;
        }
    }
    context_for(root, manifest, config_dir)
}

fn open_vault(path: &Path, config_dir: &Path) -> CoreResult<VaultContext> {
    let root = pathing::canonical_vault_root(path)?;
    let manifest_path = root.join(".biota").join("vault.json");
    let bytes = fs::read(&manifest_path)
        .map_err(|_| CoreError::InvalidVault(format!("{} is not a Biota vault", root.display())))?;
    let manifest: VaultManifest = serde_json::from_slice(&bytes)?;
    if manifest.schema != VAULT_SCHEMA {
        return Err(CoreError::InvalidVault(format!(
            "vault schema {} is not supported",
            manifest.schema
        )));
    }
    history::initialize(&root)?;
    context_for(root, manifest, config_dir)
}

fn context_for(
    root: PathBuf,
    manifest: VaultManifest,
    config_dir: &Path,
) -> CoreResult<VaultContext> {
    let vault_id = Uuid::parse_str(&manifest.vault_id)
        .map_err(|_| CoreError::InvalidVault("vault_id must be a UUID".to_owned()))?;
    let index_path = config_dir
        .join("indexes")
        .join(format!("{vault_id}.sqlite3"));
    Ok(VaultContext {
        root,
        manifest,
        index_path,
    })
}

fn summary(context: &VaultContext) -> VaultSummary {
    VaultSummary {
        root_path: context.root.display().to_string(),
        manifest: context.manifest.clone(),
        default_folders: DEFAULT_FOLDERS
            .iter()
            .filter(|folder| context.root.join(folder).is_dir())
            .map(|folder| (*folder).to_owned())
            .collect(),
    }
}

fn activate_vault(app: &AppHandle, state: &AppState, context: VaultContext) -> CoreResult<()> {
    persist_selected(state, Some(&context.root))?;
    install_watcher(app, state, &context)?;
    let mut vault = state.vault.write().map_err(|_| lock_error("vault state"))?;
    *vault = Some(context);
    Ok(())
}

fn current_context(state: &AppState) -> CoreResult<VaultContext> {
    state
        .vault
        .read()
        .map_err(|_| lock_error("vault state"))?
        .clone()
        .ok_or(CoreError::NoVault)
}

fn persisted_state_path(state: &AppState) -> PathBuf {
    state.config_dir.join("state.json")
}

fn persist_selected(state: &AppState, selected: Option<&Path>) -> CoreResult<()> {
    let path = persisted_state_path(state);
    let mut persisted = if path.exists() {
        serde_json::from_slice::<PersistedState>(&fs::read(&path)?).unwrap_or_default()
    } else {
        PersistedState::default()
    };
    persisted.selected_vault = selected.map(|value| value.display().to_string());
    if let Some(selected) = &persisted.selected_vault {
        persisted.recent_vaults.retain(|value| value != selected);
        persisted.recent_vaults.insert(0, selected.clone());
        persisted.recent_vaults.truncate(10);
    }
    pathing::atomic_write(&path, &serde_json::to_vec_pretty(&persisted)?)
}

fn load_selected(config_dir: &Path) -> Option<PathBuf> {
    let path = config_dir.join("state.json");
    let bytes = fs::read(path).ok()?;
    let state = serde_json::from_slice::<PersistedState>(&bytes).ok()?;
    state.selected_vault.map(PathBuf::from)
}

fn install_watcher(app: &AppHandle, state: &AppState, context: &VaultContext) -> CoreResult<()> {
    let watched_root = context.root.clone();
    let callback_root = watched_root.clone();
    let callback_index = context.index_path.clone();
    let event_app = app.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else {
            return;
        };
        let paths = event
            .paths
            .iter()
            .filter_map(|path| path.strip_prefix(&callback_root).ok())
            .filter(|relative| {
                relative
                    .components()
                    .next()
                    .map(|component| {
                        !component
                            .as_os_str()
                            .to_string_lossy()
                            .eq_ignore_ascii_case(".biota")
                    })
                    .unwrap_or(false)
            })
            .map(|relative| {
                relative
                    .components()
                    .map(|component| component.as_os_str().to_string_lossy())
                    .collect::<Vec<_>>()
                    .join("/")
            })
            .collect::<Vec<_>>();
        if paths.is_empty() {
            return;
        }
        for path in &paths {
            let _ = index::sync_external(&callback_root, &callback_index, path);
        }
        let payload = VaultChangeEvent {
            kind: format!("{:?}", event.kind).to_ascii_lowercase(),
            paths,
        };
        let _ = event_app.emit("vault://changed", payload);
    })?;
    watcher.watch(&watched_root, RecursiveMode::Recursive)?;
    let mut slot = state
        .watcher
        .lock()
        .map_err(|_| lock_error("vault watcher"))?;
    *slot = Some(watcher);
    Ok(())
}

fn normalize_relative(input: &str) -> CoreResult<String> {
    let path = pathing::validate_relative_path(input)?;
    Ok(path
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/"))
}

fn lock_error(name: &str) -> CoreError {
    CoreError::InvalidVault(format!("{name} lock was poisoned"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            fs::create_dir_all(&config_dir)?;
            let initial_context =
                load_selected(&config_dir).and_then(|path| open_vault(&path, &config_dir).ok());
            app.manage(AppState {
                vault: RwLock::new(initial_context.clone()),
                config_dir,
                operation_lock: Mutex::new(()),
                watcher: Mutex::new(None),
            });

            if let Some(context) = initial_context {
                let _ = index::rebuild(&context.root, &context.index_path);
                let state = app.state::<AppState>();
                let _ = install_watcher(app.handle(), &state, &context);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault_create,
            vault_open,
            vault_current,
            vault_close,
            vault_scan,
            search_metadata,
            index_metadata,
            task_list,
            record_read,
            record_write,
            record_move,
            file_read_binary,
            file_write_binary,
            sheet_read,
            sheet_write,
            history_checkpoint,
            history_finalize,
            history_create_revision,
            history_restore,
            history_list,
            history_verify,
            analysis_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Biota desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn restoring_a_finalized_record_requires_opening_a_revision() {
        let vault_parent = tempdir().unwrap();
        let config_dir = tempdir().unwrap();
        let vault_path = vault_parent.path().join("vault");
        let context = create_vault(
            &CreateVaultRequest {
                path: vault_path.display().to_string(),
                name: Some("Test vault".to_owned()),
                create_default_folders: true,
            },
            config_dir.path(),
        )
        .unwrap();
        let relative_path = "Experiments/test.md";
        let record_path = context.root.join(relative_path);
        pathing::atomic_write(&record_path, b"version one").unwrap();
        index::rebuild(&context.root, &context.index_path).unwrap();
        let checkpoint = checkpoint(
            &context,
            HistoryPathRequest {
                relative_path: relative_path.to_owned(),
                message: Some("Version one".to_owned()),
            },
        )
        .unwrap();

        pathing::atomic_write(&record_path, b"version two").unwrap();
        finalize(
            &context,
            FinalizeRequest {
                relative_path: relative_path.to_owned(),
                dependencies: Vec::new(),
                message: None,
            },
        )
        .unwrap();
        let expected_hash = history::hash_bytes(b"version two");
        let restore_request = RestoreRequest {
            relative_path: relative_path.to_owned(),
            event_id: checkpoint.event_id.clone(),
            expected_hash: Some(expected_hash.clone()),
        };
        assert!(matches!(
            restore(&context, restore_request),
            Err(CoreError::Finalized)
        ));
        assert_eq!(fs::read_to_string(&record_path).unwrap(), "version two");

        create_revision(
            &context,
            HistoryPathRequest {
                relative_path: relative_path.to_owned(),
                message: Some("Continue editing".to_owned()),
            },
        )
        .unwrap();
        restore(
            &context,
            RestoreRequest {
                relative_path: relative_path.to_owned(),
                event_id: checkpoint.event_id,
                expected_hash: Some(expected_hash),
            },
        )
        .unwrap();
        assert_eq!(fs::read_to_string(record_path).unwrap(), "version one");
    }

    #[test]
    fn binary_import_preserves_exact_bytes_and_revision_hash() {
        let vault_parent = tempdir().unwrap();
        let config_dir = tempdir().unwrap();
        let vault_path = vault_parent.path().join("vault");
        let context = create_vault(
            &CreateVaultRequest {
                path: vault_path.display().to_string(),
                name: Some("Binary fixture".to_owned()),
                create_default_folders: true,
            },
            config_dir.path(),
        )
        .unwrap();
        index::rebuild(&context.root, &context.index_path).unwrap();
        let state = AppState {
            vault: RwLock::new(Some(context.clone())),
            config_dir: config_dir.path().to_path_buf(),
            operation_lock: Mutex::new(()),
            watcher: Mutex::new(None),
        };
        let bytes = vec![0, 83, 110, 97, 112, 71, 101, 110, 101, 255];
        let response = write_binary_file(
            &state,
            BinaryFileWriteRequest {
                relative_path: "Attachments/imports/fixture.dna".to_owned(),
                bytes: bytes.clone(),
                expected_hash: None,
                message: Some("Imported source file".to_owned()),
            },
        )
        .unwrap();

        assert_eq!(
            fs::read(context.root.join(&response.relative_path)).unwrap(),
            bytes
        );
        assert_eq!(response.content_hash, history::hash_bytes(&bytes));
        assert_eq!(
            history::read_revision(&context.root, &response.content_hash).unwrap(),
            bytes
        );
    }

    #[test]
    fn unicode_path_and_content_round_trip_through_the_vault_core() {
        let vault_parent = tempdir().unwrap();
        let config_dir = tempdir().unwrap();
        let vault_path = vault_parent.path().join("vault");
        let context = create_vault(
            &CreateVaultRequest {
                path: vault_path.display().to_string(),
                name: Some("Unicode vault".to_owned()),
                create_default_folders: true,
            },
            config_dir.path(),
        )
        .unwrap();
        index::rebuild(&context.root, &context.index_path).unwrap();
        let state = AppState {
            vault: RwLock::new(Some(context.clone())),
            config_dir: config_dir.path().to_path_buf(),
            operation_lock: Mutex::new(()),
            watcher: Mutex::new(None),
        };
        let relative_path = "实验/剂量反应-β🧬.md";
        let content = "---\nbiota_id: 01UNICODE\nbiota_type: experiment\ntitle: 剂量反应 🧬\ncustom_field: 保留\n---\n# 观察\nΔ fluorescence = 你好, мир, café\n- [ ] 分析 β 数据 [[Protocols/转染]]\n  <!-- biota-task id=01TASK-UNICODE state=inbox -->\n";

        let written = write_record(
            &state,
            WriteRecordRequest {
                relative_path: relative_path.to_owned(),
                content: content.to_owned(),
                expected_hash: None,
                message: Some("Unicode round trip".to_owned()),
            },
        )
        .unwrap();
        assert_eq!(written.document.relative_path, relative_path);
        assert_eq!(written.document.content, content);
        assert_eq!(written.document.summary.title, "剂量反应 🧬");
        assert_eq!(
            written.document.metadata["custom_field"],
            serde_json::Value::String("保留".to_owned())
        );

        let path = pathing::resolve_existing(&context.root, relative_path).unwrap();
        let read_back = index::read_document(&context.root, &path).unwrap();
        assert_eq!(read_back.content.as_bytes(), content.as_bytes());
        assert_eq!(read_back.content_hash, written.document.content_hash);

        let search_results = index::search(
            &context.index_path,
            &SearchRequest {
                query: "剂量反应".to_owned(),
                record_types: Some(vec!["experiment".to_owned()]),
                limit: Some(10),
            },
        )
        .unwrap();
        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].relative_path, relative_path);
        let tasks = index::task_list(&context.index_path).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].source_path, relative_path);
        assert!(tasks[0].text.contains("分析 β 数据"));

        let scan = index::rebuild(&context.root, &context.index_path).unwrap();
        assert!(scan
            .files
            .iter()
            .any(|file| file.relative_path == relative_path));
        assert!(history::verify_history(&context.root).unwrap().valid);
    }
}
