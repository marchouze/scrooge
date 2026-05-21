"""TypeScript ingester — exports + handler names via tree-sitter.

For the spike we accept a regex fallback if tree-sitter-typescript install
fails on the host — recorded honestly in the outcome card. Goal is to register
CodeModule nodes and link them to Capability nodes via path matching.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

from .markdown import DeterministicEdge, DeterministicNode, IngestResult


_EXPORT_PATTERNS = [
    re.compile(r"^export\s+(?:async\s+)?function\s+(\w+)", re.M),
    re.compile(r"^export\s+const\s+(\w+)", re.M),
    re.compile(r"^export\s+class\s+(\w+)", re.M),
    re.compile(r"^export\s+interface\s+(\w+)", re.M),
    re.compile(r"^export\s+type\s+(\w+)", re.M),
    re.compile(r"^export\s+enum\s+(\w+)", re.M),
]

_HANDLER_NAME_PATTERN = re.compile(r"\bhandlerName:\s*['\"]([\w-]+)['\"]")
# Decision IDs cited in TS header comments (e.g. "Authority: D-FX-SALES-TRADING-FRONTEND").
_DECISION_REF_PATTERN = re.compile(r"\b(D-[A-Z][A-Z0-9-]{2,})\b")


def _extract_exports(text: str) -> list[str]:
    found: set[str] = set()
    for pat in _EXPORT_PATTERNS:
        for m in pat.finditer(text):
            found.add(m.group(1))
    return sorted(found)


def _extract_handler_names(text: str) -> list[str]:
    return list({m.group(1) for m in _HANDLER_NAME_PATTERN.finditer(text)})


@dataclass
class TsIngestStats:
    files: int = 0
    exports: int = 0
    handlers: int = 0
    failures: list[str] = field(default_factory=list)


def ingest_ts_module(path: Path, prototype_root: Path) -> tuple[IngestResult, TsIngestStats]:
    result = IngestResult()
    stats = TsIngestStats()
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        stats.failures.append(f"{path}: {e}")
        return result, stats

    rel = str(path.relative_to(prototype_root))
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    exports = _extract_exports(text)
    handlers = _extract_handler_names(text)
    stats.files += 1
    stats.exports += len(exports)
    stats.handlers += len(handlers)

    code_urn = f"code:{rel}"
    result.nodes.append(
        DeterministicNode(
            entity_type="CodeModule",
            urn=code_urn,
            attrs={
                "path": rel,
                "exports": exports,
                "handler_name": handlers[0] if handlers else None,
            },
            source_file=str(path),
            content_hash=content_hash,
        )
    )

    # Heuristic: if the module path matches a capability stem, link IMPLEMENTED_AT.
    # Capability URNs from procedure ingest are like `capability:@platform/markets/eod/fx-revaluation`.
    # We approximate by deriving the canonical capability path from the rel path.
    cap_stem = rel
    if cap_stem.endswith(".ts"):
        cap_stem = cap_stem[:-3]
    cap_aliases = [
        f"capability:@{cap_stem}",
        f"capability:@{cap_stem.replace('prototype/', '')}",
    ]
    for cap in cap_aliases:
        result.edges.append(DeterministicEdge(cap, code_urn, "IMPLEMENTED_AT", str(path)))

    # Look at file-header comments for decision-id citations — gives Q3 a
    # deterministic signal without the LLM pass.
    header = "\n".join(text.splitlines()[:40])
    for m in _DECISION_REF_PATTERN.finditer(header):
        decision_id = m.group(1)
        result.edges.append(
            DeterministicEdge(decision_id, code_urn, "AFFECTS", str(path))
        )

    return result, stats
