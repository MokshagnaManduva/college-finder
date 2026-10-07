"""Offline reviewed-claim import. Dry-run is the default; never fetches source URLs."""

import argparse
import asyncio
import hashlib
import json
from pathlib import Path

from app.db.session import get_engine, get_session_factory
from app.schemas.review import ReviewManifest
from app.services.review import import_review


def verify_documents(manifest: ReviewManifest, evidence_dir: Path):
    """Check retained source bytes without downloading anything or trusting file names."""
    digests = {
        (fact.source.document_sha256, fact.source.document_format)
        for course in manifest.courses
        for fact in course.facts
    }
    for digest, extension in sorted(digests):
        document = evidence_dir / (digest + "." + extension)
        if not document.is_file():
            raise ValueError(f"Missing retained evidence: {document.name}")
        with document.open("rb") as stream:
            actual = hashlib.file_digest(stream, "sha256").hexdigest()
        if actual != digest:
            raise ValueError(f"Retained evidence checksum mismatch: {document.name}")


async def run(path: Path, apply: bool, evidence_dir: Path | None = None):
    if path.stat().st_size > 2_000_000:
        raise ValueError("Review files must be smaller than 2 MB")
    manifest = ReviewManifest.model_validate_json(path.read_text())
    if apply and evidence_dir is None:
        raise ValueError("Applying a review requires --evidence-dir with retained source documents")
    if evidence_dir is not None:
        verify_documents(manifest, evidence_dir)
    try:
        async with get_session_factory()() as db, db.begin():
            changes = await import_review(db, manifest, apply=apply)
        print(json.dumps({"mode": "applied" if apply else "dry-run", "changes": changes}, indent=2))
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument(
        "--evidence-dir", type=Path, help="Directory of SHA-256-named source documents"
    )
    parser.add_argument(
        "--apply", action="store_true", help="Apply the validated review atomically"
    )
    args = parser.parse_args()
    try:
        asyncio.run(run(args.file, args.apply, args.evidence_dir))
    except (ValueError, OSError) as error:
        raise SystemExit(str(error)) from None
