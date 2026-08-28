use crate::error::{CoreError, CoreResult};
use std::{
    ffi::OsStr,
    fs::{self, OpenOptions},
    io::Write,
    path::{Component, Path, PathBuf},
};
use uuid::Uuid;

pub fn canonical_vault_root(path: &Path) -> CoreResult<PathBuf> {
    if !path.is_absolute() {
        return Err(CoreError::InvalidVault(
            "the vault path must be absolute".to_owned(),
        ));
    }

    let root = fs::canonicalize(path)
        .map_err(|error| CoreError::InvalidVault(format!("{} ({error})", path.display())))?;
    if !root.is_dir() {
        return Err(CoreError::InvalidVault(format!(
            "{} is not a directory",
            root.display()
        )));
    }
    if root.parent().is_none() {
        return Err(CoreError::InvalidVault(
            "the filesystem root cannot be used as a vault".to_owned(),
        ));
    }
    Ok(root)
}

pub fn validate_relative_path(input: &str) -> CoreResult<PathBuf> {
    if input.trim().is_empty() || input.contains('\0') {
        return Err(CoreError::InvalidPath(input.to_owned()));
    }

    let path = Path::new(input);
    if path.is_absolute() {
        return Err(CoreError::InvalidPath(input.to_owned()));
    }

    let mut component_count = 0usize;
    for component in path.components() {
        match component {
            Component::Normal(value) => {
                if component_count == 0 && value.to_string_lossy().eq_ignore_ascii_case(".biota") {
                    return Err(CoreError::ReservedPath);
                }
                component_count += 1;
            }
            Component::CurDir
            | Component::ParentDir
            | Component::RootDir
            | Component::Prefix(_) => {
                return Err(CoreError::InvalidPath(input.to_owned()));
            }
        }
    }

    if component_count == 0 {
        return Err(CoreError::InvalidPath(input.to_owned()));
    }
    Ok(path.to_path_buf())
}

pub fn resolve_existing(root: &Path, input: &str) -> CoreResult<PathBuf> {
    let relative = validate_relative_path(input)?;
    let candidate = root.join(&relative);
    let canonical =
        fs::canonicalize(&candidate).map_err(|_| CoreError::NotFound(input.to_owned()))?;
    ensure_beneath(root, &canonical, input)?;
    reject_symlink_components(root, &relative, input)?;
    Ok(canonical)
}

pub fn resolve_for_write(root: &Path, input: &str) -> CoreResult<PathBuf> {
    let relative = validate_relative_path(input)?;
    let candidate = root.join(&relative);

    if candidate.exists() {
        let canonical = fs::canonicalize(&candidate)?;
        ensure_beneath(root, &canonical, input)?;
        reject_symlink_components(root, &relative, input)?;
        return Ok(candidate);
    }

    let mut ancestor = candidate
        .parent()
        .ok_or_else(|| CoreError::InvalidPath(format!("{input} has no parent directory")))?;
    while !ancestor.exists() {
        ancestor = ancestor
            .parent()
            .ok_or_else(|| CoreError::OutsideVault(input.to_owned()))?;
    }
    let canonical_ancestor = fs::canonicalize(ancestor)?;
    ensure_at_or_beneath(root, &canonical_ancestor, input)?;
    reject_symlink_components(root, &relative, input)?;
    Ok(candidate)
}

fn ensure_beneath(root: &Path, canonical: &Path, display: &str) -> CoreResult<()> {
    if canonical == root || !canonical.starts_with(root) {
        return Err(CoreError::OutsideVault(display.to_owned()));
    }
    Ok(())
}

fn ensure_at_or_beneath(root: &Path, canonical: &Path, display: &str) -> CoreResult<()> {
    if !canonical.starts_with(root) {
        return Err(CoreError::OutsideVault(display.to_owned()));
    }
    Ok(())
}

fn reject_symlink_components(root: &Path, relative: &Path, display: &str) -> CoreResult<()> {
    let mut current = root.to_path_buf();
    for component in relative.components() {
        current.push(component.as_os_str());
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(CoreError::InvalidPath(format!(
                    "symbolic links are not supported in record paths: {display}"
                )));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
            Err(error) => return Err(error.into()),
        }
    }
    Ok(())
}

pub fn ensure_text_record_path(path: &Path) -> CoreResult<()> {
    let extension = path
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    const TEXT_EXTENSIONS: &[&str] = &[
        "md", "markdown", "csv", "tsv", "txt", "gb", "gbk", "genbank", "fasta", "fa", "fna", "faa",
        "yaml", "yml", "json",
    ];
    if !TEXT_EXTENSIONS.contains(&extension.as_str()) {
        return Err(CoreError::InvalidDocument(format!(
            "unsupported text record extension: .{extension}"
        )));
    }
    Ok(())
}

pub fn relative_display(root: &Path, path: &Path) -> CoreResult<String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| CoreError::OutsideVault(path.display().to_string()))?;
    Ok(relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/"))
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> CoreResult<()> {
    atomic_write_with_pre_commit(path, bytes, |_| Ok(()))
}

fn atomic_write_with_pre_commit<F>(path: &Path, bytes: &[u8], pre_commit: F) -> CoreResult<()>
where
    F: FnOnce(&Path) -> CoreResult<()>,
{
    let parent = path.parent().ok_or_else(|| {
        CoreError::InvalidPath(format!("{} has no parent directory", path.display()))
    })?;
    fs::create_dir_all(parent)?;

    let canonical_parent = fs::canonicalize(parent)?;
    if !canonical_parent.is_dir() {
        return Err(CoreError::InvalidPath(format!(
            "{} is not a directory",
            parent.display()
        )));
    }

    let file_name = path
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| CoreError::InvalidPath(path.display().to_string()))?;
    let temporary = parent.join(format!(
        ".{file_name}.biota-{}.tmp",
        Uuid::new_v4().simple()
    ));

    let result = (|| -> CoreResult<()> {
        let mut options = OpenOptions::new();
        options.create_new(true).write(true);
        let mut file = options.open(&temporary)?;
        if let Ok(metadata) = fs::metadata(path) {
            file.set_permissions(metadata.permissions())?;
        }
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        pre_commit(&temporary)?;
        fs::rename(&temporary, path)?;

        // Best-effort directory sync makes the rename durable on filesystems
        // that support opening directories.
        if let Ok(directory) = fs::File::open(parent) {
            let _ = directory.sync_all();
        }
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn rejects_absolute_parent_and_reserved_paths() {
        assert!(validate_relative_path("/tmp/example.md").is_err());
        assert!(validate_relative_path("../example.md").is_err());
        assert!(validate_relative_path("notes/../../example.md").is_err());
        assert!(matches!(
            validate_relative_path(".biota/vault.json"),
            Err(CoreError::ReservedPath)
        ));
        assert!(validate_relative_path("Notes/example.md").is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape_for_reads_and_writes() {
        use std::os::unix::fs::symlink;

        let vault = tempdir().unwrap();
        let outside = tempdir().unwrap();
        fs::write(outside.path().join("secret.md"), "secret").unwrap();
        symlink(outside.path(), vault.path().join("escape")).unwrap();

        let root = canonical_vault_root(vault.path()).unwrap();
        assert!(matches!(
            resolve_existing(&root, "escape/secret.md"),
            Err(CoreError::OutsideVault(_))
        ));
        assert!(matches!(
            resolve_for_write(&root, "escape/new.md"),
            Err(CoreError::OutsideVault(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_internal_symlink_aliases() {
        use std::os::unix::fs::symlink;

        let vault = tempdir().unwrap();
        fs::create_dir_all(vault.path().join("Notes")).unwrap();
        fs::write(vault.path().join("Notes/target.md"), "target").unwrap();
        symlink(
            vault.path().join("Notes/target.md"),
            vault.path().join("alias.md"),
        )
        .unwrap();

        let root = canonical_vault_root(vault.path()).unwrap();
        assert!(matches!(
            resolve_existing(&root, "alias.md"),
            Err(CoreError::InvalidPath(_))
        ));
    }

    #[test]
    fn atomic_write_replaces_complete_content() {
        let directory = tempdir().unwrap();
        let file = directory.path().join("record.md");
        atomic_write(&file, b"first").unwrap();
        atomic_write(&file, b"second").unwrap();
        assert_eq!(fs::read(file).unwrap(), b"second");
    }

    #[test]
    fn permits_a_new_record_below_a_not_yet_created_folder() {
        let directory = tempdir().unwrap();
        let root = canonical_vault_root(directory.path()).unwrap();
        let resolved = resolve_for_write(&root, "实验/record.md").unwrap();
        assert_eq!(resolved, root.join("实验/record.md"));
    }

    #[test]
    fn interrupted_atomic_write_preserves_original_and_cleans_temporary_file() {
        let directory = tempdir().unwrap();
        let file = directory.path().join("record.md");
        atomic_write(&file, b"original content").unwrap();

        let result = atomic_write_with_pre_commit(&file, b"partial replacement", |_| {
            Err(CoreError::Io(std::io::Error::new(
                std::io::ErrorKind::Interrupted,
                "simulated interruption before rename",
            )))
        });
        assert!(matches!(result, Err(CoreError::Io(_))));
        assert_eq!(fs::read(&file).unwrap(), b"original content");

        let temporary_files = fs::read_dir(directory.path())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains(".biota-"))
            .count();
        assert_eq!(temporary_files, 0);
    }
}
