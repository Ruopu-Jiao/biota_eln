from __future__ import annotations

import hashlib
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest

from tools.package_cached_sidecar import create_deterministic_archive


class CachedSidecarPackagingTests(unittest.TestCase):
    def test_runtime_archive_is_reproducible_and_normalized(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_name:
            temporary_directory = Path(temporary_name)
            runtime = temporary_directory / "runtime"
            internal = runtime / "_internal"
            internal.mkdir(parents=True)
            executable = runtime / "biota-analysis-engine"
            executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            executable.chmod(0o755)
            data = internal / "data.txt"
            data.write_text("scientific payload\n", encoding="utf-8")
            (internal / "data-link").symlink_to("data.txt")

            first_archive = temporary_directory / "first.tar.gz"
            second_archive = temporary_directory / "second.tar.gz"
            create_deterministic_archive(runtime, first_archive)
            create_deterministic_archive(runtime, second_archive)

            first_bytes = first_archive.read_bytes()
            self.assertEqual(first_bytes, second_archive.read_bytes())
            self.assertEqual(
                hashlib.sha256(first_bytes).hexdigest(),
                hashlib.sha256(second_archive.read_bytes()).hexdigest(),
            )

            with tarfile.open(first_archive, mode="r:gz") as archive:
                members = {member.name: member for member in archive.getmembers()}
            self.assertEqual(
                set(members),
                {
                    "_internal",
                    "_internal/data-link",
                    "_internal/data.txt",
                    "biota-analysis-engine",
                },
            )
            self.assertTrue(members["_internal/data-link"].issym())
            self.assertEqual(members["_internal/data-link"].linkname, "data.txt")
            for member in members.values():
                self.assertEqual(member.mtime, 0)
                self.assertEqual(member.uid, 0)
                self.assertEqual(member.gid, 0)
            self.assertTrue(
                members["biota-analysis-engine"].mode & stat.S_IXUSR
            )


if __name__ == "__main__":
    unittest.main()
