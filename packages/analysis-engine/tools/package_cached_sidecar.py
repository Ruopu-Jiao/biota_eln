#!/usr/bin/env python3
"""Package a PyInstaller onedir runtime into a cache-aware macOS launcher."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import os
from pathlib import Path
import stat
import subprocess
import tarfile
import tempfile


def _archive_info(path: Path, relative_path: Path) -> tarfile.TarInfo:
    metadata = path.lstat()
    info = tarfile.TarInfo(relative_path.as_posix())
    info.uid = 0
    info.gid = 0
    info.uname = ""
    info.gname = ""
    info.mtime = 0
    info.pax_headers = {}

    if stat.S_ISLNK(metadata.st_mode):
        info.type = tarfile.SYMTYPE
        info.linkname = os.readlink(path)
        info.mode = 0o777
    elif stat.S_ISDIR(metadata.st_mode):
        info.type = tarfile.DIRTYPE
        info.mode = 0o755
    elif stat.S_ISREG(metadata.st_mode):
        info.type = tarfile.REGTYPE
        info.mode = 0o755 if metadata.st_mode & 0o111 else 0o644
        info.size = metadata.st_size
    else:
        raise ValueError(f"unsupported runtime entry: {path}")
    return info


def create_deterministic_archive(runtime_directory: Path, archive_path: Path) -> None:
    entries = sorted(
        runtime_directory.rglob("*"),
        key=lambda path: path.relative_to(runtime_directory).as_posix(),
    )
    with archive_path.open("wb") as raw_archive:
        with gzip.GzipFile(
            filename="",
            mode="wb",
            compresslevel=9,
            fileobj=raw_archive,
            mtime=0,
        ) as compressed_archive:
            with tarfile.open(
                fileobj=compressed_archive,
                mode="w",
                format=tarfile.PAX_FORMAT,
            ) as archive:
                for entry in entries:
                    relative_path = entry.relative_to(runtime_directory)
                    info = _archive_info(entry, relative_path)
                    if info.isreg():
                        with entry.open("rb") as source:
                            archive.addfile(info, source)
                    else:
                        archive.addfile(info)


def package_launcher(
    runtime_directory: Path,
    launcher_source: Path,
    output_path: Path,
    clang: str,
    sdk_path: Path,
) -> tuple[str, int]:
    if not (runtime_directory / "biota-analysis-engine").is_file():
        raise ValueError(
            f"{runtime_directory} is not a Biota PyInstaller onedir runtime"
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(
        prefix=".biota-analysis-package-",
        dir=output_path.parent,
    ) as temporary_name:
        temporary_directory = Path(temporary_name)
        archive_path = temporary_directory / "runtime.tar.gz"
        unsigned_launcher = temporary_directory / "biota-analysis-engine"
        create_deterministic_archive(runtime_directory, archive_path)
        payload = archive_path.read_bytes()
        payload_sha = hashlib.sha256(payload).hexdigest()

        subprocess.run(
            [
                clang,
                "-arch",
                "arm64",
                "-mmacosx-version-min=12.0",
                "-isysroot",
                str(sdk_path),
                "-std=c11",
                "-O2",
                "-Wall",
                "-Wextra",
                "-Werror",
                "-Wl,-dead_strip",
                f"-Wl,-sectcreate,__DATA,__payload,{archive_path}",
                f'-DPAYLOAD_SHA="{payload_sha}"',
                str(launcher_source),
                "-o",
                str(unsigned_launcher),
            ],
            check=True,
        )
        subprocess.run(
            ["codesign", "--force", "--sign", "-", str(unsigned_launcher)],
            check=True,
        )
        os.replace(unsigned_launcher, output_path)
        output_path.chmod(0o755)
        return payload_sha, len(payload)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runtime", type=Path, required=True)
    parser.add_argument("--launcher-source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--clang", required=True)
    parser.add_argument("--sdk-path", type=Path, required=True)
    arguments = parser.parse_args()

    payload_sha, payload_size = package_launcher(
        arguments.runtime.resolve(),
        arguments.launcher_source.resolve(),
        arguments.output.resolve(),
        arguments.clang,
        arguments.sdk_path.resolve(),
    )
    print(f"payload_sha256={payload_sha}")
    print(f"payload_bytes={payload_size}")
    print(f"launcher={arguments.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
