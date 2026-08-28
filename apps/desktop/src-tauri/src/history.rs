use crate::{
    error::{CoreError, CoreResult},
    models::{HistoryEvent, HistoryEventKind, HistoryVerification, ManifestEntry},
    pathing::{atomic_write, resolve_existing},
};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};
use ulid::Ulid;

const HASH_LENGTH: usize = 64;

#[derive(Debug, Default)]
pub struct HistoryEventDraft {
    pub kind: Option<HistoryEventKind>,
    pub relative_path: String,
    pub content_hash: String,
    pub message: Option<String>,
    pub source_event_id: Option<String>,
    pub moved_from: Option<String>,
    pub manifest: Vec<ManifestEntry>,
}

fn history_root(vault_root: &Path) -> PathBuf {
    vault_root.join(".biota").join("history")
}

fn events_path(vault_root: &Path) -> PathBuf {
    history_root(vault_root).join("events.jsonl")
}

fn object_path(vault_root: &Path, hash: &str) -> CoreResult<PathBuf> {
    if hash.len() != HASH_LENGTH
        || !hash
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err(CoreError::InvalidHistory(format!(
            "invalid object hash: {hash}"
        )));
    }
    Ok(history_root(vault_root)
        .join("objects")
        .join("sha256")
        .join(&hash[..2])
        .join(hash))
}

pub fn initialize(vault_root: &Path) -> CoreResult<()> {
    fs::create_dir_all(history_root(vault_root).join("objects").join("sha256"))?;
    Ok(())
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn store_revision(vault_root: &Path, bytes: &[u8]) -> CoreResult<String> {
    initialize(vault_root)?;
    let hash = hash_bytes(bytes);
    let destination = object_path(vault_root, &hash)?;
    if !destination.exists() {
        atomic_write(&destination, bytes)?;
    } else {
        let existing = fs::read(&destination)?;
        if hash_bytes(&existing) != hash {
            return Err(CoreError::InvalidHistory(format!(
                "history object {} is corrupt",
                destination.display()
            )));
        }
    }
    Ok(hash)
}

pub fn read_revision(vault_root: &Path, hash: &str) -> CoreResult<Vec<u8>> {
    let path = object_path(vault_root, hash)?;
    let bytes = fs::read(&path).map_err(|_| CoreError::NotFound(hash.to_owned()))?;
    let actual = hash_bytes(&bytes);
    if actual != hash {
        return Err(CoreError::InvalidHistory(format!(
            "history object {hash} has content hash {actual}"
        )));
    }
    Ok(bytes)
}

pub fn load_events(vault_root: &Path) -> CoreResult<Vec<HistoryEvent>> {
    let path = events_path(vault_root);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)?;
    let mut events = Vec::new();
    for (line_number, line) in content.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let event = serde_json::from_str::<HistoryEvent>(line).map_err(|error| {
            CoreError::InvalidHistory(format!(
                "events.jsonl line {} is invalid: {error}",
                line_number + 1
            ))
        })?;
        events.push(event);
    }
    validate_event_chain(&events)?;
    Ok(events)
}

fn event_hash(event: &HistoryEvent) -> CoreResult<String> {
    let mut unsigned = event.clone();
    unsigned.event_hash.clear();
    Ok(hash_bytes(&serde_json::to_vec(&unsigned)?))
}

pub fn validate_event_chain(events: &[HistoryEvent]) -> CoreResult<()> {
    let mut previous: Option<&str> = None;
    for (index, event) in events.iter().enumerate() {
        let expected_sequence = index as u64 + 1;
        if event.sequence != expected_sequence {
            return Err(CoreError::InvalidHistory(format!(
                "event {} has sequence {}, expected {}",
                event.event_id, event.sequence, expected_sequence
            )));
        }
        if event.previous_event_hash.as_deref() != previous {
            return Err(CoreError::InvalidHistory(format!(
                "event {} does not reference the previous event",
                event.event_id
            )));
        }
        let calculated = event_hash(event)?;
        if calculated != event.event_hash {
            return Err(CoreError::InvalidHistory(format!(
                "event {} has an invalid hash",
                event.event_id
            )));
        }
        previous = Some(&event.event_hash);
    }
    Ok(())
}

pub fn append_event(vault_root: &Path, draft: HistoryEventDraft) -> CoreResult<HistoryEvent> {
    initialize(vault_root)?;
    let mut events = load_events(vault_root)?;
    let kind = draft
        .kind
        .ok_or_else(|| CoreError::InvalidHistory("history event kind is required".to_owned()))?;
    let mut event = HistoryEvent {
        event_id: Ulid::new().to_string(),
        sequence: events.len() as u64 + 1,
        kind,
        timestamp: Utc::now().to_rfc3339(),
        relative_path: draft.relative_path,
        content_hash: draft.content_hash,
        previous_event_hash: events.last().map(|value| value.event_hash.clone()),
        event_hash: String::new(),
        message: draft.message,
        source_event_id: draft.source_event_id,
        moved_from: draft.moved_from,
        manifest: draft.manifest,
    };
    event.event_hash = event_hash(&event)?;
    events.push(event.clone());

    let mut serialized = Vec::new();
    for item in &events {
        serde_json::to_writer(&mut serialized, item)?;
        serialized.push(b'\n');
    }
    atomic_write(&events_path(vault_root), &serialized)?;
    Ok(event)
}

pub fn events_for_path(
    vault_root: &Path,
    relative_path: Option<&str>,
) -> CoreResult<Vec<HistoryEvent>> {
    let mut events = load_events(vault_root)?;
    if let Some(path) = relative_path {
        events.retain(|event| event.relative_path == path);
    }
    events.reverse();
    Ok(events)
}

pub fn is_finalized(vault_root: &Path, relative_path: &str) -> CoreResult<bool> {
    let events = load_events(vault_root)?;
    for event in events.iter().rev() {
        if event.relative_path != relative_path {
            continue;
        }
        match event.kind {
            HistoryEventKind::Finalize => return Ok(true),
            HistoryEventKind::Autosave
            | HistoryEventKind::RevisionOpened
            | HistoryEventKind::Restore
            | HistoryEventKind::Move => return Ok(false),
            HistoryEventKind::Checkpoint => {}
        }
    }
    Ok(false)
}

pub fn verify_history(vault_root: &Path) -> CoreResult<HistoryVerification> {
    let canonical_root = fs::canonicalize(vault_root)?;
    let mut problems = Vec::new();
    let events = match load_events(vault_root) {
        Ok(events) => events,
        Err(error) => {
            problems.push(error.to_string());
            Vec::new()
        }
    };
    let mut referenced_hashes = BTreeSet::new();
    for event in &events {
        if !event.content_hash.is_empty() {
            referenced_hashes.insert(event.content_hash.clone());
        }
        for entry in &event.manifest {
            referenced_hashes.insert(entry.content_hash.clone());
        }
    }

    for hash in &referenced_hashes {
        if let Err(error) = read_revision(vault_root, hash) {
            problems.push(error.to_string());
        }
    }

    let mut active_finalizations: BTreeMap<&str, &HistoryEvent> = BTreeMap::new();
    for event in &events {
        match event.kind {
            HistoryEventKind::Finalize => {
                active_finalizations.insert(&event.relative_path, event);
            }
            HistoryEventKind::Autosave
            | HistoryEventKind::RevisionOpened
            | HistoryEventKind::Restore
            | HistoryEventKind::Move => {
                active_finalizations.remove(event.relative_path.as_str());
            }
            HistoryEventKind::Checkpoint => {}
        }
    }
    for (relative_path, finalization) in active_finalizations {
        match resolve_existing(&canonical_root, relative_path).and_then(|path| Ok(fs::read(path)?))
        {
            Ok(bytes) => {
                let actual = hash_bytes(&bytes);
                if actual != finalization.content_hash {
                    problems.push(format!(
                        "finalized record {relative_path} has content hash {actual}, expected {}",
                        finalization.content_hash
                    ));
                }
            }
            Err(error) => problems.push(format!(
                "finalized record {relative_path} cannot be verified: {error}"
            )),
        }
    }

    let objects_root = history_root(vault_root).join("objects").join("sha256");
    let object_count = if objects_root.exists() {
        walkdir::WalkDir::new(objects_root)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file())
            .count()
    } else {
        0
    };

    Ok(HistoryVerification {
        valid: problems.is_empty(),
        event_count: events.len(),
        object_count,
        problems,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn draft(kind: HistoryEventKind, hash: String) -> HistoryEventDraft {
        HistoryEventDraft {
            kind: Some(kind),
            relative_path: "Experiments/test.md".to_owned(),
            content_hash: hash,
            ..HistoryEventDraft::default()
        }
    }

    #[test]
    fn revisions_are_content_addressed_and_deduplicated() {
        let directory = tempdir().unwrap();
        let first = store_revision(directory.path(), b"same content").unwrap();
        let second = store_revision(directory.path(), b"same content").unwrap();
        assert_eq!(first, second);

        let verification = verify_history(directory.path()).unwrap();
        assert_eq!(verification.object_count, 1);
        assert!(verification.valid);
    }

    #[test]
    fn event_chain_detects_tampering() {
        let directory = tempdir().unwrap();
        let hash = store_revision(directory.path(), b"version one").unwrap();
        append_event(
            directory.path(),
            draft(HistoryEventKind::Checkpoint, hash.clone()),
        )
        .unwrap();
        append_event(directory.path(), draft(HistoryEventKind::Finalize, hash)).unwrap();

        let events_file = events_path(directory.path());
        let original = fs::read_to_string(&events_file).unwrap();
        fs::write(
            &events_file,
            original.replacen("\"checkpoint\"", "\"autosave\"", 1),
        )
        .unwrap();
        assert!(load_events(directory.path()).is_err());
    }

    #[test]
    fn finalized_state_requires_an_explicit_revision_event() {
        let directory = tempdir().unwrap();
        let hash = store_revision(directory.path(), b"version one").unwrap();
        append_event(
            directory.path(),
            draft(HistoryEventKind::Finalize, hash.clone()),
        )
        .unwrap();
        assert!(is_finalized(directory.path(), "Experiments/test.md").unwrap());

        append_event(
            directory.path(),
            draft(HistoryEventKind::RevisionOpened, hash),
        )
        .unwrap();
        assert!(!is_finalized(directory.path(), "Experiments/test.md").unwrap());
    }

    #[test]
    fn verification_detects_tampering_of_an_active_finalized_record() {
        let directory = tempdir().unwrap();
        fs::create_dir_all(directory.path().join("Experiments")).unwrap();
        let relative_path = "Experiments/test.md";
        let record_path = directory.path().join(relative_path);
        fs::write(&record_path, "final content").unwrap();
        let hash = store_revision(directory.path(), b"final content").unwrap();
        append_event(
            directory.path(),
            HistoryEventDraft {
                kind: Some(HistoryEventKind::Finalize),
                relative_path: relative_path.to_owned(),
                content_hash: hash,
                ..HistoryEventDraft::default()
            },
        )
        .unwrap();
        assert!(verify_history(directory.path()).unwrap().valid);

        fs::write(record_path, "externally changed").unwrap();
        let verification = verify_history(directory.path()).unwrap();
        assert!(!verification.valid);
        assert!(verification
            .problems
            .iter()
            .any(|problem| problem.contains("finalized record Experiments/test.md")));
    }
}
