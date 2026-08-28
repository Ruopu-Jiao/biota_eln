#!/usr/bin/env bash

set -euo pipefail

# Tauri can infer a real identity from APPLE_CERTIFICATE in CI. For a local
# developer build without credentials, ad-hoc signing still produces a
# self-consistent app bundle that can be verified with codesign.
if [[ -z "${APPLE_SIGNING_IDENTITY:-}" && -z "${APPLE_CERTIFICATE:-}" ]]; then
  export APPLE_SIGNING_IDENTITY="-"
  echo "No Apple signing certificate configured; creating an ad-hoc signed build."
fi

# Finder-based DMG styling occasionally leaves the temporary image busy on
# headless/automated builds. Tauri's CI-safe path creates the same installable
# image without relying on Finder automation.
export CI="${CI:-true}"

exec tauri build "$@"
