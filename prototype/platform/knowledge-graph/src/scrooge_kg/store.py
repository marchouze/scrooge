"""Graph store — wraps a NetworkX in-memory MultiDiGraph with JSON persistence.

Spike-grade choice: keep the deterministic ingest tier separate from Graphiti's
LLM-extraction tier. The deterministic graph is the canonical record; Graphiti
results (when run) layer additional narrative edges on top, with provenance to
the source episode.

For the FX-Spot spike we persist:
  - nodes.jsonl  (one node per line)
  - edges.jsonl  (one edge per line)
  - run.json     (ingest metadata — counts, spend, wall-clock, model)
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Iterable

from .ingest.markdown import DeterministicEdge, DeterministicNode, IngestResult


class JsonGraphStore:
    """Append-only JSONL store. One file per kind for streaming-friendly diffs."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.nodes_path = root / "nodes.jsonl"
        self.edges_path = root / "edges.jsonl"
        self.episodes_path = root / "episodes.jsonl"
        self.run_path = root / "run.json"

    def reset(self) -> None:
        for p in (self.nodes_path, self.edges_path, self.episodes_path, self.run_path):
            if p.exists():
                p.unlink()

    def write_results(self, results: Iterable[IngestResult]) -> tuple[int, int, int]:
        """Returns (node_count, edge_count, episode_count) after de-duplication on URN."""
        seen_nodes: dict[str, dict] = {}
        edges: list[dict] = []
        episodes: list[dict] = []
        for r in results:
            for n in r.nodes:
                # First-write-wins; subsequent occurrences extend `attrs.sources`.
                existing = seen_nodes.get(n.urn)
                if existing is None:
                    rec = asdict(n)
                    rec.setdefault("sources", []).append(
                        {"path": n.source_file, "content_hash": n.content_hash}
                    )
                    seen_nodes[n.urn] = rec
                else:
                    existing.setdefault("sources", []).append(
                        {"path": n.source_file, "content_hash": n.content_hash}
                    )
            for e in r.edges:
                edges.append(asdict(e))
            for ep in r.episode_texts:
                src, h, body = ep
                episodes.append({"source_file": src, "content_hash": h, "body": body})

        with self.nodes_path.open("w", encoding="utf-8") as f:
            for n in seen_nodes.values():
                f.write(json.dumps(n) + "\n")
        with self.edges_path.open("w", encoding="utf-8") as f:
            for e in edges:
                f.write(json.dumps(e) + "\n")
        with self.episodes_path.open("w", encoding="utf-8") as f:
            for ep in episodes:
                f.write(json.dumps(ep) + "\n")
        return len(seen_nodes), len(edges), len(episodes)

    def write_run_metadata(self, meta: dict) -> None:
        self.run_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    def load_nodes(self) -> list[dict]:
        if not self.nodes_path.exists():
            return []
        return [json.loads(l) for l in self.nodes_path.read_text().splitlines() if l.strip()]

    def load_edges(self) -> list[dict]:
        if not self.edges_path.exists():
            return []
        return [json.loads(l) for l in self.edges_path.read_text().splitlines() if l.strip()]
