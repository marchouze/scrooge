"""LLM narrative-extraction pass — Anthropic Claude.

For the spike, we run a single-shot Anthropic call per episode (markdown body
chunk) and ask for typed edges grounded in the deterministic node set. This is
a deliberate simplification of Graphiti's bitemporal pipeline; it lets the
spike capture the *cost + accuracy* signal Marc needs even when the full
Graphiti install fails (and exposes that gap honestly in the outcome card).

If `graphiti-core` is importable, the caller can swap in Graphiti's
`add_episode`. The signature is preserved so the swap is mechanical.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Iterable

from anthropic import Anthropic

from .ingest.markdown import DeterministicEdge, DeterministicNode


SYSTEM_PROMPT = """You are a knowledge-graph edge extractor for Scrooge Bank's
regulatory + operational corpus. You will receive:
  (1) a list of already-known nodes (URN + entity_type + short label),
  (2) a snippet of source text (policy / procedure / decision body).
Your job: emit edges between *existing nodes* found in the text, using the
typed edge vocabulary CONTAINS, EXPRESSES, CLOSED_BY, GOVERNS, REALISED_BY,
IMPLEMENTED_AT, AFFECTS, TAGGED, APPLIES_TO. Do NOT invent new nodes. Do NOT
emit edges for nodes you cannot find in the provided list.

Output strict JSON: {"edges": [{"src": "<urn>", "dst": "<urn>", "relation": "<TYPE>"}]}
No prose, no markdown.
"""


@dataclass
class LlmStats:
    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    failed_calls: int = 0
    extracted_edges: int = 0
    errors: list[str] = field(default_factory=list)


def _node_catalogue(nodes: list[DeterministicNode], cap: int = 80) -> list[dict]:
    """A compact JSON-able catalogue for the prompt. Capped to keep token cost down."""
    out = []
    for n in nodes[:cap]:
        label = n.attrs.get("title") or n.attrs.get("requirement") or n.attrs.get("path") or n.urn
        out.append({"urn": n.urn, "type": n.entity_type, "label": str(label)[:80]})
    return out


def run_extraction(
    nodes: list[DeterministicNode],
    episodes: list[tuple[str, str, str]],
    model: str = "claude-haiku-4-5",
    max_episodes: int | None = None,
) -> tuple[list[DeterministicEdge], LlmStats]:
    """Run the narrative-extraction LLM pass.

    Returns (extracted_edges, stats). Uses claude-haiku-4-5 by default for cost.
    """
    stats = LlmStats()
    extracted: list[DeterministicEdge] = []

    if not os.environ.get("ANTHROPIC_API_KEY"):
        stats.errors.append("ANTHROPIC_API_KEY not set — LLM pass skipped")
        return extracted, stats

    client = Anthropic()
    catalogue = _node_catalogue(nodes)
    urn_set = {n.urn for n in nodes}

    eps = episodes if max_episodes is None else episodes[:max_episodes]
    for src, content_hash, body in eps:
        try:
            stats.calls += 1
            user_msg = (
                f"Known nodes (URN catalogue):\n{json.dumps(catalogue, indent=2)}\n\n"
                f"Source ({src}):\n{body}\n\n"
                "Return strict JSON only."
            )
            resp = client.messages.create(
                model=model,
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            )
            usage = getattr(resp, "usage", None)
            if usage is not None:
                stats.input_tokens += getattr(usage, "input_tokens", 0) or 0
                stats.output_tokens += getattr(usage, "output_tokens", 0) or 0
            content_blocks = resp.content
            text_out = "".join(
                getattr(b, "text", "") for b in content_blocks if hasattr(b, "text")
            )
            # Strip code fences if present
            cleaned = text_out.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`")
                # remove leading 'json' marker
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:]
            try:
                parsed = json.loads(cleaned)
            except json.JSONDecodeError:
                # Best-effort: find a {...} block
                lb = cleaned.find("{")
                rb = cleaned.rfind("}")
                if 0 <= lb < rb:
                    parsed = json.loads(cleaned[lb : rb + 1])
                else:
                    raise
            edges = parsed.get("edges", [])
            for e in edges:
                src_urn = e.get("src")
                dst_urn = e.get("dst")
                relation = e.get("relation")
                if not (src_urn and dst_urn and relation):
                    continue
                # Citation gate: both endpoints must be in the known catalogue.
                if src_urn not in urn_set or dst_urn not in urn_set:
                    continue
                extracted.append(
                    DeterministicEdge(
                        src_urn=src_urn,
                        dst_urn=dst_urn,
                        relation=relation,
                        source_file=src,
                    )
                )
                stats.extracted_edges += 1
        except Exception as e:  # noqa: BLE001
            stats.failed_calls += 1
            stats.errors.append(f"{src}: {type(e).__name__}: {e}")

    return extracted, stats


def estimate_cost_usd(stats: LlmStats, model: str) -> float:
    """Rough Anthropic pricing (per million tokens, as of mid-2026 catalogue)."""
    # Conservative estimates — clearly labelled as such in the outcome card.
    pricing = {
        "claude-haiku-4-5": (0.80, 4.00),  # (input, output) per 1M tokens
        "claude-sonnet-4-5": (3.00, 15.00),
        "claude-sonnet-4-6": (3.00, 15.00),
        "claude-opus-4-7": (15.00, 75.00),
    }
    in_p, out_p = pricing.get(model, (3.00, 15.00))
    return (stats.input_tokens / 1_000_000) * in_p + (stats.output_tokens / 1_000_000) * out_p
