"""Frontmatter parser — reads YAML headers from policy / procedure / decision MD."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass
class ParsedDoc:
    path: Path
    frontmatter: dict
    body: str
    content_hash: str  # sha256 (BLAKE3 not in stdlib; sha256 is sufficient for spike)


_FM_DELIM = "---"


def parse(path: Path) -> ParsedDoc:
    """Parse YAML frontmatter from a markdown file.

    Returns empty frontmatter dict if the file has no frontmatter block.
    """
    raw = path.read_text(encoding="utf-8")
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    lines = raw.splitlines()
    if not lines or lines[0].strip() != _FM_DELIM:
        return ParsedDoc(path=path, frontmatter={}, body=raw, content_hash=h)

    # find closing ---
    closing = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == _FM_DELIM:
            closing = i
            break
    if closing is None:
        return ParsedDoc(path=path, frontmatter={}, body=raw, content_hash=h)

    fm_block = "\n".join(lines[1:closing])
    body = "\n".join(lines[closing + 1 :])
    try:
        fm = yaml.safe_load(fm_block) or {}
        if not isinstance(fm, dict):
            fm = {}
    except yaml.YAMLError:
        fm = {}
    return ParsedDoc(path=path, frontmatter=fm, body=body, content_hash=h)
