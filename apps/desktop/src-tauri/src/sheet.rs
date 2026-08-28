use crate::{
    error::{CoreError, CoreResult},
    history,
    models::{SheetBundleResponse, SheetReadRequest, SheetTextFile, SheetWriteRequest},
    pathing, verify_expected_hash,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

fn normalized_path(input: &str) -> CoreResult<String> {
    let path = pathing::validate_relative_path(input)?;
    Ok(path
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/"))
}

fn ensure_owner_extension(relative_path: &str) -> CoreResult<()> {
    let extension = Path::new(relative_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension != "md" && extension != "markdown" {
        return Err(CoreError::InvalidDocument(format!(
            "sheet owner must be a Markdown record: {relative_path}"
        )));
    }
    Ok(())
}

fn ensure_csv_extension(relative_path: &str) -> CoreResult<()> {
    let extension = Path::new(relative_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension != "csv" {
        return Err(CoreError::InvalidDocument(format!(
            "sheet data must use a .csv file: {relative_path}"
        )));
    }
    Ok(())
}

fn ensure_schema_extension(relative_path: &str) -> CoreResult<()> {
    let lower = relative_path.to_ascii_lowercase();
    if !lower.ends_with(".sheet.json") && !lower.ends_with(".sheet.yaml") {
        return Err(CoreError::InvalidDocument(format!(
            "sheet schema must use .sheet.json or .sheet.yaml: {relative_path}"
        )));
    }
    Ok(())
}

fn resolve_owner(root: &Path, relative_path: &str) -> CoreResult<PathBuf> {
    ensure_owner_extension(relative_path)?;
    let path = pathing::resolve_existing(root, relative_path)?;
    if !path.is_file() {
        return Err(CoreError::InvalidDocument(format!(
            "sheet owner is not a file: {relative_path}"
        )));
    }
    Ok(path)
}

fn resolve_existing_sheet_file(
    root: &Path,
    relative_path: &str,
    validate_extension: fn(&str) -> CoreResult<()>,
) -> CoreResult<PathBuf> {
    validate_extension(relative_path)?;
    let path = pathing::resolve_existing(root, relative_path)?;
    if !path.is_file() {
        return Err(CoreError::InvalidDocument(format!(
            "sheet sidecar is not a file: {relative_path}"
        )));
    }
    Ok(path)
}

fn resolve_sheet_file_for_write(
    root: &Path,
    relative_path: &str,
    validate_extension: fn(&str) -> CoreResult<()>,
) -> CoreResult<PathBuf> {
    validate_extension(relative_path)?;
    let path = pathing::resolve_for_write(root, relative_path)?;
    if path.is_dir() {
        return Err(CoreError::InvalidDocument(format!(
            "sheet sidecar is a directory: {relative_path}"
        )));
    }
    Ok(path)
}

fn ensure_write_parent(root: &Path, path: &Path, relative_path: &str) -> CoreResult<()> {
    let parent = path.parent().ok_or_else(|| {
        CoreError::InvalidPath(format!("{relative_path} has no parent directory"))
    })?;
    fs::create_dir_all(parent)?;
    let canonical_parent = fs::canonicalize(parent)?;
    if !canonical_parent.starts_with(root) {
        return Err(CoreError::OutsideVault(relative_path.to_owned()));
    }
    Ok(())
}

fn read_text(relative_path: String, path: &Path) -> CoreResult<SheetTextFile> {
    let bytes = fs::read(path)?;
    let content = String::from_utf8(bytes.clone()).map_err(|_| {
        CoreError::InvalidDocument(format!("{relative_path} is not valid UTF-8 text"))
    })?;
    Ok(SheetTextFile {
        relative_path,
        content,
        content_hash: history::hash_bytes(&bytes),
    })
}

pub fn read_bundle(root: &Path, request: SheetReadRequest) -> CoreResult<SheetBundleResponse> {
    let owner_relative_path = normalized_path(&request.owner_relative_path)?;
    let data_relative_path = normalized_path(&request.data_relative_path)?;
    let schema_relative_path = normalized_path(&request.schema_relative_path)?;
    resolve_owner(root, &owner_relative_path)?;
    let data_path = resolve_existing_sheet_file(root, &data_relative_path, ensure_csv_extension)?;
    let schema_path =
        resolve_existing_sheet_file(root, &schema_relative_path, ensure_schema_extension)?;

    Ok(SheetBundleResponse {
        owner_relative_path,
        data: read_text(data_relative_path, &data_path)?,
        schema: read_text(schema_relative_path, &schema_path)?,
    })
}

pub fn write_bundle(root: &Path, request: SheetWriteRequest) -> CoreResult<SheetBundleResponse> {
    let owner_relative_path = normalized_path(&request.owner_relative_path)?;
    let data_relative_path = normalized_path(&request.data_relative_path)?;
    let schema_relative_path = normalized_path(&request.schema_relative_path)?;
    resolve_owner(root, &owner_relative_path)?;
    if history::is_finalized(root, &owner_relative_path)? {
        return Err(CoreError::Finalized);
    }

    let data_path = resolve_sheet_file_for_write(root, &data_relative_path, ensure_csv_extension)?;
    let schema_path =
        resolve_sheet_file_for_write(root, &schema_relative_path, ensure_schema_extension)?;

    // Both optimistic-concurrency checks intentionally happen before either
    // sidecar is changed.
    verify_expected_hash(&data_path, request.expected_data_hash.as_deref())?;
    verify_expected_hash(&schema_path, request.expected_schema_hash.as_deref())?;

    ensure_write_parent(root, &data_path, &data_relative_path)?;
    ensure_write_parent(root, &schema_path, &schema_relative_path)?;
    // Each rename is atomic, but the pair is not a crash-safe transaction. A
    // journaled bundle commit would be required to recover a crash between them.
    pathing::atomic_write(&data_path, request.data_content.as_bytes())?;
    pathing::atomic_write(&schema_path, request.schema_content.as_bytes())?;

    Ok(SheetBundleResponse {
        owner_relative_path,
        data: SheetTextFile {
            relative_path: data_relative_path,
            content_hash: history::hash_bytes(request.data_content.as_bytes()),
            content: request.data_content,
        },
        schema: SheetTextFile {
            relative_path: schema_relative_path,
            content_hash: history::hash_bytes(request.schema_content.as_bytes()),
            content: request.schema_content,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        history::HistoryEventDraft,
        models::{HistoryEventKind, ManifestEntry},
    };
    use tempfile::tempdir;

    fn fixture() -> (tempfile::TempDir, PathBuf, String, String, String) {
        let vault = tempdir().unwrap();
        let root = fs::canonicalize(vault.path()).unwrap();
        fs::create_dir_all(root.join("Experiments")).unwrap();
        fs::create_dir_all(root.join("Data")).unwrap();
        history::initialize(&root).unwrap();
        let owner = "Experiments/Assay.md".to_owned();
        let csv = "Data/Assay.csv".to_owned();
        let metadata = "Data/Assay.sheet.json".to_owned();
        pathing::atomic_write(&root.join(&owner), b"# Assay\n").unwrap();
        pathing::atomic_write(&root.join(&csv), b"A,B\n1,2\n").unwrap();
        pathing::atomic_write(&root.join(&metadata), br#"{"schema":1,"name":"Assay"}"#).unwrap();
        (vault, root, owner, csv, metadata)
    }

    #[test]
    fn reads_and_writes_both_sidecars_with_content_hashes() {
        let (_vault, root, owner, csv, metadata) = fixture();
        let original = read_bundle(
            &root,
            SheetReadRequest {
                owner_relative_path: owner.clone(),
                data_relative_path: csv.clone(),
                schema_relative_path: metadata.clone(),
            },
        )
        .unwrap();
        assert_eq!(
            original.data.content_hash,
            history::hash_bytes(b"A,B\n1,2\n")
        );
        assert_eq!(
            original.schema.content_hash,
            history::hash_bytes(br#"{"schema":1,"name":"Assay"}"#)
        );

        let updated = write_bundle(
            &root,
            SheetWriteRequest {
                owner_relative_path: owner,
                data_relative_path: csv.clone(),
                schema_relative_path: metadata.clone(),
                data_content: "A,B\n3,4\n".to_owned(),
                schema_content: "{\"schema\":1,\"name\":\"Updated assay\"}".to_owned(),
                expected_data_hash: Some(original.data.content_hash),
                expected_schema_hash: Some(original.schema.content_hash),
            },
        )
        .unwrap();

        assert_eq!(fs::read_to_string(root.join(csv)).unwrap(), "A,B\n3,4\n");
        assert_eq!(
            fs::read_to_string(root.join(metadata)).unwrap(),
            "{\"schema\":1,\"name\":\"Updated assay\"}"
        );
        assert_eq!(
            updated.data.content_hash,
            history::hash_bytes(updated.data.content.as_bytes())
        );
        assert_eq!(
            updated.schema.content_hash,
            history::hash_bytes(updated.schema.content.as_bytes())
        );
    }

    #[test]
    fn creates_new_csv_and_yaml_sidecars_when_absence_is_expected() {
        let (_vault, root, owner, _, _) = fixture();
        let csv = "Data/Nested/New assay.csv".to_owned();
        let metadata = "Data/Nested/New assay.sheet.yaml".to_owned();
        let result = write_bundle(
            &root,
            SheetWriteRequest {
                owner_relative_path: owner,
                data_relative_path: csv.clone(),
                schema_relative_path: metadata.clone(),
                data_content: "A,B\n1,2\n".to_owned(),
                schema_content: "schema: 1\nname: New assay\n".to_owned(),
                expected_data_hash: Some(String::new()),
                expected_schema_hash: Some(String::new()),
            },
        )
        .unwrap();

        assert_eq!(result.data.relative_path, csv);
        assert_eq!(result.schema.relative_path, metadata);
        assert_eq!(
            fs::read_to_string(root.join(&result.data.relative_path)).unwrap(),
            result.data.content
        );
        assert_eq!(
            fs::read_to_string(root.join(&result.schema.relative_path)).unwrap(),
            result.schema.content
        );
    }

    #[test]
    fn checks_both_hashes_before_changing_either_sidecar() {
        let (_vault, root, owner, csv, metadata) = fixture();
        let original_csv = fs::read(root.join(&csv)).unwrap();
        let original_metadata = fs::read(root.join(&metadata)).unwrap();
        let result = write_bundle(
            &root,
            SheetWriteRequest {
                owner_relative_path: owner,
                data_relative_path: csv.clone(),
                schema_relative_path: metadata.clone(),
                data_content: "A,B\n9,9\n".to_owned(),
                schema_content: "{\"schema\":2}".to_owned(),
                expected_data_hash: Some(history::hash_bytes(&original_csv)),
                expected_schema_hash: Some("stale".to_owned()),
            },
        );

        assert!(matches!(result, Err(CoreError::Conflict { .. })));
        assert_eq!(fs::read(root.join(csv)).unwrap(), original_csv);
        assert_eq!(fs::read(root.join(metadata)).unwrap(), original_metadata);
    }

    #[test]
    fn rejects_wrong_extensions_traversal_and_finalized_owners() {
        let (_vault, root, owner, csv, metadata) = fixture();
        let wrong_extension = read_bundle(
            &root,
            SheetReadRequest {
                owner_relative_path: owner.clone(),
                data_relative_path: "Data/Assay.tsv".to_owned(),
                schema_relative_path: metadata.clone(),
            },
        );
        assert!(matches!(
            wrong_extension,
            Err(CoreError::InvalidDocument(_))
        ));

        let traversal = read_bundle(
            &root,
            SheetReadRequest {
                owner_relative_path: owner.clone(),
                data_relative_path: "../Assay.csv".to_owned(),
                schema_relative_path: metadata.clone(),
            },
        );
        assert!(matches!(traversal, Err(CoreError::InvalidPath(_))));

        let owner_bytes = fs::read(root.join(&owner)).unwrap();
        let owner_hash = history::store_revision(&root, &owner_bytes).unwrap();
        history::append_event(
            &root,
            HistoryEventDraft {
                kind: Some(HistoryEventKind::Finalize),
                relative_path: owner.clone(),
                content_hash: owner_hash.clone(),
                manifest: vec![ManifestEntry {
                    relative_path: owner.clone(),
                    content_hash: owner_hash,
                    size: owner_bytes.len() as u64,
                }],
                ..HistoryEventDraft::default()
            },
        )
        .unwrap();

        let finalized = write_bundle(
            &root,
            SheetWriteRequest {
                owner_relative_path: owner,
                data_relative_path: csv,
                schema_relative_path: metadata,
                data_content: "A\n5\n".to_owned(),
                schema_content: "{\"schema\":2}".to_owned(),
                expected_data_hash: None,
                expected_schema_hash: None,
            },
        );
        assert!(matches!(finalized, Err(CoreError::Finalized)));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_sidecars() {
        use std::os::unix::fs::symlink;

        let (_vault, root, owner, _, metadata) = fixture();
        let outside = tempdir().unwrap();
        fs::write(outside.path().join("outside.csv"), "A\n1\n").unwrap();
        symlink(
            outside.path().join("outside.csv"),
            root.join("Data/link.csv"),
        )
        .unwrap();

        let result = read_bundle(
            &root,
            SheetReadRequest {
                owner_relative_path: owner,
                data_relative_path: "Data/link.csv".to_owned(),
                schema_relative_path: metadata,
            },
        );
        assert!(matches!(
            result,
            Err(CoreError::OutsideVault(_)) | Err(CoreError::InvalidPath(_))
        ));
    }
}
