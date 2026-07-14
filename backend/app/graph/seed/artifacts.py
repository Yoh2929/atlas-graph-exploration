from __future__ import annotations

import json
from pathlib import Path

from .models import SeedSnapshot
from .validation import ValidationReport


def write_artifacts(base_dir: Path, snapshot: SeedSnapshot, report: ValidationReport) -> Path:
    output_dir = base_dir / snapshot.run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "snapshot.json").write_text(
        json.dumps(snapshot.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (output_dir / "validation-report.json").write_text(
        json.dumps(report.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (base_dir / "latest.txt").write_text(snapshot.run_id, encoding="utf-8")
    return output_dir
