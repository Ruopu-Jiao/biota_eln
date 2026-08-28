# Biota analysis engine

This package is the local, versioned calculation engine used by the Biota
desktop application. It accepts a JSON request and returns JSON results so the
desktop shell can keep the scientific calculation boundary separate from the
UI.

The engine never reads outside paths supplied by the trusted Tauri core. The
core is responsible for resolving vault-relative paths and for writing result
artifacts back into the vault.

## Development

```bash
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/python -m unittest discover -s tests
```

Run a request from standard input:

```bash
echo '{"kind":"descriptive","columns":{"value":[1,2,3]}}' \
  | .venv/bin/python -m biota_analysis
```

Build the Apple-silicon sidecar:

```bash
(cd ../.. && bash scripts/build-analysis-sidecar.sh)
file ../../apps/desktop/src-tauri/binaries/biota-analysis-engine-aarch64-apple-darwin
```

The distributed sidecar remains one signed arm64 executable. It embeds a
deterministic PyInstaller onedir archive and extracts that runtime once into a
SHA-256-addressed directory under the macOS per-user cache. Later invocations
execute the stable cached runtime directly, avoiding PyInstaller one-file
extraction and repeated macOS validation. macOS may purge the cache, in which
case the next invocation safely rebuilds it under a per-payload file lock.
The first invocation of each new payload still pays that extraction and
validation cost, and the expanded runtime currently occupies about 90 MB.
Older hash-addressed runtimes are left for macOS cache management rather than
being deleted by the application.

Supported calculations:

- descriptive statistics
- paired and unpaired t-tests
- one- and two-way ANOVA
- linear regression
- 4PL and 5PL dose-response fits
- exponential association and decay fits
- Michaelis-Menten fits

Every CLI response includes `ok` and `engine_version`. Successful responses
place diagnostics, warnings, and calculation-specific data under `result`.
Invalid requests and failed fits exit with status 2 and place a structured
`type` and `message` under `error` instead of returning a partial result.
