"""The four spike queries.

Run against the JSON store produced by `kg ingest`. Each query returns a list
of {node, citation_path} dicts the CLI can render and the `/kg` dashboard view
can consume.
"""

from __future__ import annotations

from collections import defaultdict, deque
from pathlib import Path

from .store import JsonGraphStore


def _build_indexes(store: JsonGraphStore) -> tuple[dict, dict, dict]:
    nodes = {n["urn"]: n for n in store.load_nodes()}
    out: dict[str, list[dict]] = defaultdict(list)
    inb: dict[str, list[dict]] = defaultdict(list)
    for e in store.load_edges():
        out[e["src_urn"]].append(e)
        inb[e["dst_urn"]].append(e)
    return nodes, out, inb


def code_for_procedure(store: JsonGraphStore, proc_id: str) -> list[dict]:
    """Q1: which code modules implement procedure PROC-XYZ?

    Walks proc → REALISED_BY → Capability → IMPLEMENTED_AT → CodeModule.
    """
    nodes, out, _ = _build_indexes(store)
    target_urn = f"proc:{proc_id}"
    if target_urn not in nodes:
        # tolerate frontmatter discrepancy: try suffix match
        matches = [u for u in nodes if u.endswith(proc_id)]
        if matches:
            target_urn = matches[0]
        else:
            return []

    results: list[dict] = []
    for e1 in out.get(target_urn, []):
        if e1["relation"] != "REALISED_BY":
            continue
        cap_urn = e1["dst_urn"]
        for e2 in out.get(cap_urn, []):
            if e2["relation"] != "IMPLEMENTED_AT":
                continue
            code = nodes.get(e2["dst_urn"])
            if code:
                results.append(
                    {
                        "node": code,
                        "citation_path": [target_urn, cap_urn, e2["dst_urn"]],
                        "via": [e1["source_file"], e2["source_file"]],
                    }
                )
    return results


def regulations_cited_by(store: JsonGraphStore, policy_id: str) -> list[dict]:
    """Q2: which regulations does policy <id> ultimately cite?

    Walks policy ← CLOSED_BY ← Obligation ← EXPRESSES ← Provision ← CONTAINS ← Regulation
    (or directly across the policy's `citations` list).
    """
    nodes, _, inb = _build_indexes(store)
    target_urn = f"policy:{policy_id}"
    if target_urn not in nodes:
        return []

    results: list[dict] = []
    # via Obligation
    for e in inb.get(target_urn, []):
        if e["relation"] != "CLOSED_BY":
            continue
        oblig = nodes.get(e["src_urn"])
        if not oblig:
            continue
        # walk back to provision/regulation (often unpopulated in spike — record anyway)
        results.append(
            {
                "node": oblig,
                "citation_path": [target_urn, e["src_urn"]],
                "via": [e["source_file"]],
            }
        )

    # Also surface the raw citations frontmatter list as best-effort hits.
    policy = nodes[target_urn]
    for c in policy.get("attrs", {}).get("citations", []) or []:
        results.append(
            {
                "node": {"urn": f"citation:{c}", "entity_type": "Citation", "attrs": {"label": c}},
                "citation_path": [target_urn, f"citation:{c}"],
                "via": [policy["source_file"]],
            }
        )
    return results


def decisions_affecting(store: JsonGraphStore, handler: str) -> list[dict]:
    """Q3: which decisions affect a given handler / code module / procedure?"""
    nodes, _, inb = _build_indexes(store)
    matches: list[str] = []
    for urn, n in nodes.items():
        if n["entity_type"] == "CodeModule":
            if handler in n.get("attrs", {}).get("path", ""):
                matches.append(urn)
            handler_name = n.get("attrs", {}).get("handler_name") or ""
            if handler == handler_name:
                matches.append(urn)
        if n["entity_type"] == "Procedure":
            pid = n.get("attrs", {}).get("procedure_id") or ""
            if handler == pid or handler in pid:
                matches.append(urn)
    matches = list(set(matches))

    results: list[dict] = []
    for m in matches:
        for e in inb.get(m, []):
            if e["relation"] != "AFFECTS":
                continue
            d = nodes.get(e["src_urn"]) or {
                "urn": e["src_urn"],
                "entity_type": "Decision",
                "attrs": {"decision_id": e["src_urn"], "title": "(not in slice)"},
                "_unresolved": True,
            }
            results.append(
                {
                    "node": d,
                    "citation_path": [e["src_urn"], m],
                    "via": [e["source_file"]],
                }
            )
    return results


def obligations_for_product(store: JsonGraphStore, instrument: str) -> list[dict]:
    """Q4: obligations bound at commencement-of-trading for a given product."""
    nodes, _, _ = _build_indexes(store)
    # Heuristic for the spike: every Obligation node whose `requirement` text
    # mentions the instrument family (or whose register_id is in MK family) counts.
    results: list[dict] = []
    key = instrument.lower()
    for urn, n in nodes.items():
        if n["entity_type"] != "Obligation":
            continue
        attrs = n.get("attrs", {})
        req = (attrs.get("requirement") or "").lower()
        rid = (attrs.get("register_id") or "").lower()
        if "fx" in req or "fx" in rid or "mk-" in rid or key in req:
            results.append({"node": n, "citation_path": [urn], "via": [n["source_file"]]})
    return results
