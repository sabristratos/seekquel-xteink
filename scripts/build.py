#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "seekquel"
PACKAGE_FILES = ("README.md", "device.json", "manifest.json", "plugin.js")
FIXED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
UNIX_SYSTEM = 3
FILE_MODE = 0o644 << 16


def build() -> Path:
    missing = [name for name in PACKAGE_FILES if not (PLUGIN / name).is_file()]
    if missing:
        sys.exit(f"missing package files: {', '.join(missing)}")

    version = json.loads((PLUGIN / "manifest.json").read_text(encoding="utf-8"))["version"]
    output = ROOT / "dist" / f"seekquel-crosspoint-{version}.zip"
    output.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in PACKAGE_FILES:
            info = zipfile.ZipInfo(f".crosspoint/plugins/seekquel/{name}", FIXED_TIMESTAMP)
            info.create_system = UNIX_SYSTEM
            info.external_attr = FILE_MODE
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, (PLUGIN / name).read_bytes())

    return output


if __name__ == "__main__":
    print(build())
