"""Markdown ingester — Regulations, Policies, Procedures, Decisions.

Deterministic part: pull URN, policy-id / procedure-id / decision-id,
citations[], riskTaxonomy[], system-capability from frontmatter.

Narrative part (LLM): extract free-text relationships from the body. In the
spike, the LLM call is funnelled through Graphiti's `add_episode` — Graphiti
itself runs the extraction against the configured Anthropic client.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from .frontmatter import ParsedDoc, parse


@dataclass
class DeterministicNode:
    """A node we can build without an LLM — read straight from frontmatter."""

    entity_type: str
    urn: str
    attrs: dict
    source_file: str
    content_hash: str


@dataclass
class DeterministicEdge:
    src_urn: str
    dst_urn: str
    relation: str
    source_file: str


@dataclass
class IngestResult:
    nodes: list[DeterministicNode] = field(default_factory=list)
    edges: list[DeterministicEdge] = field(default_factory=list)
    episode_texts: list[tuple[str, str, str]] = field(
        default_factory=list,
        metadata={"description": "(source_file, content_hash, body_excerpt) for LLM ingest"},
    )


def _as_list(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v]
    return [str(v)]


def _policy_urn(policy_id: str) -> str:
    return f"policy:{policy_id}"


def _proc_urn(procedure_id: str) -> str:
    return f"proc:{procedure_id}"


def _decision_urn(decision_id: str) -> str:
    # The convention is `D-<SLUG>` — keep as-is.
    return decision_id


def _citation_to_urn(c: str) -> str | None:
    """Best-effort heuristic mapping a free-text citation to a URN.

    Spike-grade — covers the common forms in the corpus. Anything not matched
    becomes an unresolved-citation episode for the LLM to handle.
    """
    c = c.strip()
    if c.startswith("policy:") or c.startswith("proc:") or c.startswith("urn:"):
        return c
    if c.startswith("D-"):
        return c
    if c.startswith("ORG-"):
        return f"urn:obligation:{c.lower()}"
    if c.startswith("RT-"):
        # Risk taxonomy code — treated as a RiskCategory node.
        return f"risk:{c}"
    return None


def ingest_policy(path: Path) -> IngestResult:
    pd = parse(path)
    fm = pd.frontmatter
    result = IngestResult()
    policy_id = fm.get("policy-id") or path.stem
    urn = _policy_urn(policy_id)
    src = str(path)
    result.nodes.append(
        DeterministicNode(
            entity_type="Policy",
            urn=urn,
            attrs={
                "policy_id": policy_id,
                "title": fm.get("title"),
                "version": str(fm.get("version", "")),
                "owner": fm.get("owner"),
                "citations": _as_list(fm.get("citations")),
            },
            source_file=src,
            content_hash=pd.content_hash,
        )
    )

    for c in _as_list(fm.get("citations")):
        target = _citation_to_urn(c)
        if target:
            # A policy "is cited by" the artefact it lists — direction depends on type:
            # citations to Obligations / Regulations are CLOSED_BY (reverse direction)
            # or TAGGED for risk codes.
            if target.startswith("risk:"):
                result.edges.append(
                    DeterministicEdge(urn, target, "TAGGED", src)
                )
            elif target.startswith("urn:obligation:"):
                # Obligation → Policy : CLOSED_BY
                result.edges.append(
                    DeterministicEdge(target, urn, "CLOSED_BY", src)
                )

    for rt in _as_list(fm.get("riskTaxonomy")):
        result.edges.append(DeterministicEdge(urn, f"risk:{rt}", "TAGGED", src))

    # First 2000 chars of body to the LLM episode — keeps cost bounded.
    if pd.body.strip():
        result.episode_texts.append((src, pd.content_hash, pd.body[:2000]))
    return result


def ingest_procedure(path: Path) -> IngestResult:
    pd = parse(path)
    fm = pd.frontmatter
    result = IngestResult()
    procedure_id = fm.get("procedureId") or fm.get("procedure-id") or path.stem
    urn = _proc_urn(procedure_id)
    src = str(path)
    sys_cap = fm.get("system-capability")
    result.nodes.append(
        DeterministicNode(
            entity_type="Procedure",
            urn=urn,
            attrs={
                "procedure_id": procedure_id,
                "title": fm.get("title"),
                "system_capability": sys_cap,
            },
            source_file=src,
            content_hash=pd.content_hash,
        )
    )

    # policy-cited often has a free-text form: "Policies/foo.md §X · Policies/bar.md".
    pol = fm.get("policy-cited") or fm.get("policy-id")
    if pol and isinstance(pol, str):
        for token in pol.split("·"):
            t = token.strip()
            if "/" in t and ".md" in t:
                # extract stem
                stem = Path(t.split()[0]).stem
                if stem.startswith("policies/") or "policies" in t.lower():
                    stem = stem.replace("policies/", "").strip("-")
                pol_urn = _policy_urn(stem)
                result.edges.append(DeterministicEdge(pol_urn, urn, "GOVERNS", src))

    if sys_cap and isinstance(sys_cap, str):
        # The corpus uses three separators interchangeably: " · ", " + ", and ",".
        # Split on all of them and keep paths that start with '@'.
        import re as _re

        caps = [c.strip() for c in _re.split(r"\s*[·+,]\s*", sys_cap) if c.strip()]
        for cap in caps:
            # Drop trailing parenthesised qualifiers like " (PLANNED)" for matching;
            # keep them on the attrs.path for traceability.
            cap_clean = _re.sub(r"\s*\([^)]*\)\s*$", "", cap).strip()
            if cap_clean:
                cap_urn = f"capability:{cap_clean}"
                result.nodes.append(
                    DeterministicNode(
                        entity_type="Capability",
                        urn=cap_urn,
                        attrs={"path": cap, "procedure_urn": urn},
                        source_file=src,
                        content_hash=pd.content_hash,
                    )
                )
                result.edges.append(DeterministicEdge(urn, cap_urn, "REALISED_BY", src))

    for c in _as_list(fm.get("citations")):
        target = _citation_to_urn(c)
        if not target:
            continue
        if target.startswith("D-"):
            result.edges.append(DeterministicEdge(target, urn, "AFFECTS", src))
        elif target.startswith("urn:obligation:"):
            result.edges.append(DeterministicEdge(target, urn, "CLOSED_BY", src))
        elif target.startswith("risk:"):
            result.edges.append(DeterministicEdge(urn, target, "TAGGED", src))

    if pd.body.strip():
        result.episode_texts.append((src, pd.content_hash, pd.body[:2000]))
    return result


def ingest_regulation(path: Path) -> IngestResult:
    """Ingest a regulation markdown — high-level only for spike."""
    pd = parse(path)
    fm = pd.frontmatter
    result = IngestResult()
    urn = fm.get("urn") or f"urn:reg:{path.stem}"
    src = str(path)
    result.nodes.append(
        DeterministicNode(
            entity_type="Regulation",
            urn=urn,
            attrs={
                "act": fm.get("act") or fm.get("title") or path.stem,
                "jurisdiction": fm.get("jurisdiction", "ZA"),
                "year": fm.get("year"),
            },
            source_file=src,
            content_hash=pd.content_hash,
        )
    )
    if pd.body.strip():
        result.episode_texts.append((src, pd.content_hash, pd.body[:1500]))
    return result


def ingest_decisions(paths: Iterable[Path]) -> IngestResult:
    """Ingest decision records (Owner Inbox markdown for the spike)."""
    result = IngestResult()
    for path in paths:
        pd = parse(path)
        fm = pd.frontmatter
        decision_id = fm.get("decisionId") or fm.get("decision-id")
        if not decision_id:
            # try to read first H1: "# Decision card — D-FOO ..."
            for line in pd.body.splitlines()[:5]:
                if "D-" in line:
                    import re

                    m = re.search(r"\b(D-[A-Z0-9-]+)\b", line)
                    if m:
                        decision_id = m.group(1)
                        break
        if not decision_id:
            continue
        urn = _decision_urn(decision_id)
        src = str(path)
        result.nodes.append(
            DeterministicNode(
                entity_type="Decision",
                urn=urn,
                attrs={
                    "decision_id": decision_id,
                    "title": fm.get("title") or path.stem,
                    "authority": fm.get("authority", "CEO"),
                    "recorded_at": fm.get("date") or fm.get("decidedAt"),
                },
                source_file=src,
                content_hash=pd.content_hash,
            )
        )
        if pd.body.strip():
            result.episode_texts.append((src, pd.content_hash, pd.body[:1500]))
    return result
