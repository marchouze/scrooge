"""Register ingester — Obligations, Risk taxonomy, Party register, Activity taxonomy.

The registers are large markdown tables. The spike scope is the FX-Spot product
slice, so we filter by 'fx' / 'FX' / 'MK-FX' tokens and only emit nodes that
touch FX-Spot.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .markdown import DeterministicEdge, DeterministicNode, IngestResult


_OBLIGATION_ROW = re.compile(r"^\|\s*(ORG-[A-Z0-9-]+)\s*\|", re.M)
_RT_CODE = re.compile(r"^\|\s*(RT-[A-Z0-9.]+)\s*\|", re.M)


def ingest_obligations_register(path: Path, fx_keywords: list[str]) -> IngestResult:
    """Read obligations register; emit Obligation nodes for FX-touching rows."""
    result = IngestResult()
    text = path.read_text(encoding="utf-8")
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    lines = text.splitlines()

    for i, line in enumerate(lines):
        if not line.startswith("|"):
            continue
        m = _OBLIGATION_ROW.match(line)
        if not m:
            continue
        org_id = m.group(1)
        # widen line to neighbours for FX detection
        neighborhood = "\n".join(lines[max(0, i - 1) : i + 2]).lower()
        if not any(k in neighborhood for k in fx_keywords):
            continue
        urn = f"urn:obligation:{org_id.lower()}"
        # Best-effort requirement: 4th column
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        requirement = cells[3] if len(cells) > 3 else ""
        result.nodes.append(
            DeterministicNode(
                entity_type="Obligation",
                urn=urn,
                attrs={
                    "register_id": org_id,
                    "requirement": requirement[:300],
                },
                source_file=str(path),
                content_hash=content_hash,
            )
        )
    return result


def ingest_risk_taxonomy(path: Path, prefix: str = "RT-MK.FX") -> IngestResult:
    """Filter risk-taxonomy register to FX subtree."""
    result = IngestResult()
    text = path.read_text(encoding="utf-8")
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

    for m in _RT_CODE.finditer(text):
        code = m.group(1)
        if not code.startswith(prefix):
            continue
        result.nodes.append(
            DeterministicNode(
                entity_type="RiskCategory",
                urn=f"risk:{code}",
                attrs={"code": code},
                source_file=str(path),
                content_hash=content_hash,
            )
        )
    return result


def ingest_product_instruments() -> IngestResult:
    """Emit the inst-fx-spot product node (canonical for the spike)."""
    result = IngestResult()
    result.nodes.append(
        DeterministicNode(
            entity_type="ProductInstrument",
            urn="product:inst-fx-spot",
            attrs={"code": "inst-fx-spot", "label": "FX Spot"},
            source_file="<synthetic>",
            content_hash="",
        )
    )
    return result
