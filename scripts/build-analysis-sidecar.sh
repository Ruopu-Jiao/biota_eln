#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_dir="$(cd "${script_dir}/.." && pwd)"
engine_dir="${repository_dir}/packages/analysis-engine"
environment_dir="${engine_dir}/.venv"
distribution_binary="${engine_dir}/dist/biota-analysis-engine"
distribution_runtime="${engine_dir}/dist/biota-analysis-engine-runtime"
launcher_source="${engine_dir}/launcher/sidecar_launcher.c"
packaging_script="${engine_dir}/tools/package_cached_sidecar.py"
tauri_binary="${repository_dir}/apps/desktop/src-tauri/binaries/biota-analysis-engine-aarch64-apple-darwin"
python_bin="${BIOTA_PYTHON_BIN:-python3}"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "The initial Biota sidecar target requires Apple-silicon macOS." >&2
  exit 1
fi

needs_build=0
if [[ ! -x "${tauri_binary}" ]]; then
  needs_build=1
elif find \
  "${engine_dir}/src" \
  "${engine_dir}/tests" \
  "${engine_dir}/launcher" \
  "${engine_dir}/tools" \
  "${engine_dir}/pyproject.toml" \
  "${engine_dir}/biota-analysis-engine.spec" \
  "${BASH_SOURCE[0]}" \
  -newer "${tauri_binary}" -print -quit | grep -q .; then
  needs_build=1
fi

if [[ "${needs_build}" == "0" ]]; then
  echo "Biota analysis sidecar is current: ${tauri_binary}"
  exit 0
fi

if [[ ! -x "${environment_dir}/bin/python" ]]; then
  "${python_bin}" -m venv "${environment_dir}"
fi

"${environment_dir}/bin/pip" install -e "${engine_dir}[dev]"
(
  cd "${engine_dir}"
  "${environment_dir}/bin/pyinstaller" --noconfirm --clean biota-analysis-engine.spec
  "${environment_dir}/bin/python" "${packaging_script}" \
    --runtime "${distribution_runtime}" \
    --launcher-source "${launcher_source}" \
    --output "${distribution_binary}" \
    --clang "$(xcrun --find clang)" \
    --sdk-path "$(xcrun --sdk macosx --show-sdk-path)"
)

mkdir -p "$(dirname "${tauri_binary}")"
cp "${distribution_binary}" "${tauri_binary}"
chmod 755 "${tauri_binary}"
codesign --force --sign - "${tauri_binary}"

echo "Built Biota analysis sidecar: ${tauri_binary}"
