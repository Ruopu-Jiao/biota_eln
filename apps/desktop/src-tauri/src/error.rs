use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("no vault is currently open")]
    NoVault,
    #[error("invalid vault path: {0}")]
    InvalidVault(String),
    #[error("invalid relative path: {0}")]
    InvalidPath(String),
    #[error("the path escapes the selected vault: {0}")]
    OutsideVault(String),
    #[error("the .biota directory is reserved for application data")]
    ReservedPath,
    #[error("file not found: {0}")]
    NotFound(String),
    #[error("a file already exists at: {0}")]
    AlreadyExists(String),
    #[error("the file changed since it was opened (expected {expected}, found {actual})")]
    Conflict { expected: String, actual: String },
    #[error("the record is finalized; create a new revision before editing it")]
    Finalized,
    #[error("invalid document: {0}")]
    InvalidDocument(String),
    #[error("history validation failed: {0}")]
    InvalidHistory(String),
    #[error("analysis engine error: {0}")]
    Analysis(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("index error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("watcher error: {0}")]
    Watcher(#[from] notify::Error),
}

impl CoreError {
    fn code(&self) -> &'static str {
        match self {
            Self::NoVault => "no_vault",
            Self::InvalidVault(_) => "invalid_vault",
            Self::InvalidPath(_) => "invalid_path",
            Self::OutsideVault(_) => "outside_vault",
            Self::ReservedPath => "reserved_path",
            Self::NotFound(_) => "not_found",
            Self::AlreadyExists(_) => "already_exists",
            Self::Conflict { .. } => "conflict",
            Self::Finalized => "finalized",
            Self::InvalidDocument(_) => "invalid_document",
            Self::InvalidHistory(_) => "invalid_history",
            Self::Analysis(_) => "analysis_error",
            Self::Io(_) => "io_error",
            Self::Json(_) => "json_error",
            Self::Yaml(_) => "yaml_error",
            Self::Sqlite(_) => "index_error",
            Self::Watcher(_) => "watcher_error",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl From<CoreError> for CommandError {
    fn from(value: CoreError) -> Self {
        Self {
            code: value.code().to_owned(),
            message: value.to_string(),
        }
    }
}

pub type CoreResult<T> = Result<T, CoreError>;
pub type CommandResult<T> = Result<T, CommandError>;
