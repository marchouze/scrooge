"""Command-line entry point: `kg ingest --slice <name>`, `kg query <name> ...`, `kg reset`."""

from __future__ import annotations

import importlib.resources as ir
import json
import time
from pathlib import Path

import click
import yaml
from dotenv import load_dotenv

from . import ingest as ingest_pkg  # noqa: F401  (re-export)
from .ingest.markdown import (
    IngestResult,
    ingest_decisions,
    ingest_policy,
    ingest_procedure,
    ingest_regulation,
)
from .ingest.registers import (
    ingest_obligations_register,
    ingest_product_instruments,
    ingest_risk_taxonomy,
)
from .ingest.typescript import ingest_ts_module
from .llm_pass import estimate_cost_usd, run_extraction
from .queries import (
    code_for_procedure,
    decisions_affecting,
    obligations_for_product,
    regulations_cited_by,
)
from .store import JsonGraphStore


# Repo root resolution: this file lives at
# prototype/platform/knowledge-graph/src/scrooge_kg/cli.py — repo root is 5 up.
PKG_DIR = Path(__file__).resolve().parent
REPO_ROOT = PKG_DIR.parents[4]
PROTOTYPE_ROOT = REPO_ROOT / "prototype"
KG_ROOT = PROTOTYPE_ROOT / "platform" / "knowledge-graph"
STORE_DIR = KG_ROOT / ".local"


def _load_slice(name: str) -> dict:
    slices_dir = PKG_DIR / "slices"
    p = slices_dir / f"{name}.yaml"
    if not p.exists():
        raise click.ClickException(f"Unknown slice: {name} (looked at {p})")
    return yaml.safe_load(p.read_text(encoding="utf-8"))


def _glob(repo_root: Path, patterns: list[str]) -> list[Path]:
    out: list[Path] = []
    for pat in patterns:
        out.extend(repo_root.glob(pat))
    return [p for p in out if p.is_file()]


@click.group()
@click.option("--env-file", type=click.Path(), default=None, help="Path to .env file (overrides default).")
def main(env_file: str | None) -> None:
    """Scrooge knowledge-graph CLI — FX-Spot spike."""
    # Prefer prototype/.env.local for ANTHROPIC_API_KEY (Marc's convention).
    candidates = []
    if env_file:
        candidates.append(Path(env_file))
    candidates.append(PROTOTYPE_ROOT / ".env.local")
    candidates.append(REPO_ROOT / ".env.local")
    for c in candidates:
        if c.exists():
            load_dotenv(c)
            break


@main.command()
@click.option("--slice", "slice_name", required=True, help="Slice name (e.g. fx-spot).")
@click.option("--skip-llm", is_flag=True, help="Skip the narrative-extraction LLM pass.")
@click.option("--llm-model", default="claude-haiku-4-5", help="Anthropic model id for LLM pass.")
@click.option("--max-llm-episodes", type=int, default=None, help="Cap LLM episodes for cost control.")
def ingest(slice_name: str, skip_llm: bool, llm_model: str, max_llm_episodes: int | None) -> None:
    """Run the full ingest for a slice; write to .local/<slice>/{nodes,edges,episodes}.jsonl."""
    spec = _load_slice(slice_name)
    out_dir = STORE_DIR / slice_name
    store = JsonGraphStore(out_dir)

    started = time.time()
    results: list[IngestResult] = []

    # ── deterministic tier ─────────────────────────────────────────────────
    for rel in spec.get("regulations", []):
        p = REPO_ROOT / rel
        if p.exists():
            results.append(ingest_regulation(p))

    for rel in spec.get("policies", []):
        p = REPO_ROOT / rel
        if p.exists():
            results.append(ingest_policy(p))

    for rel in spec.get("procedures", []):
        p = REPO_ROOT / rel
        if p.exists():
            results.append(ingest_procedure(p))

    decision_paths = _glob(REPO_ROOT, spec.get("decision_globs", []))
    results.append(ingest_decisions(decision_paths))

    code_paths = _glob(REPO_ROOT, spec.get("code_globs", []))
    ts_stats_combined = {"files": 0, "exports": 0, "handlers": 0, "failures": []}
    for cp in code_paths:
        r, s = ingest_ts_module(cp, PROTOTYPE_ROOT)
        results.append(r)
        ts_stats_combined["files"] += s.files
        ts_stats_combined["exports"] += s.exports
        ts_stats_combined["handlers"] += s.handlers
        ts_stats_combined["failures"].extend(s.failures)

    regs = spec.get("registers", {}) or {}
    fx_kw = spec.get("fx_keywords", [])
    if regs.get("obligations"):
        p = REPO_ROOT / regs["obligations"]
        if p.exists():
            results.append(ingest_obligations_register(p, fx_kw))
    if regs.get("risk_taxonomy"):
        p = REPO_ROOT / regs["risk_taxonomy"]
        if p.exists():
            results.append(ingest_risk_taxonomy(p))

    results.append(ingest_product_instruments())

    # ── persist deterministic tier ─────────────────────────────────────────
    store.reset()
    n_nodes, n_edges, n_eps = store.write_results(results)

    # ── narrative LLM tier (optional) ──────────────────────────────────────
    all_nodes = []
    all_episodes: list[tuple[str, str, str]] = []
    for r in results:
        all_nodes.extend(r.nodes)
        all_episodes.extend(r.episode_texts)

    llm_stats = None
    llm_edges_added = 0
    if not skip_llm and all_episodes:
        click.echo(f"  LLM pass: {len(all_episodes)} episodes, model={llm_model}")
        extracted, llm_stats = run_extraction(
            all_nodes, all_episodes, model=llm_model, max_episodes=max_llm_episodes
        )
        if extracted:
            # Append to edges file (don't rewrite nodes — keeps idempotency
            # for the deterministic tier).
            with store.edges_path.open("a", encoding="utf-8") as f:
                from dataclasses import asdict

                for e in extracted:
                    f.write(json.dumps(asdict(e)) + "\n")
                llm_edges_added = len(extracted)

    wall = time.time() - started
    meta = {
        "slice": slice_name,
        "started_at": started,
        "wall_clock_s": round(wall, 2),
        "nodes": n_nodes,
        "deterministic_edges": n_edges,
        "episodes": n_eps,
        "ts_stats": ts_stats_combined,
        "llm": {
            "skipped": skip_llm,
            "model": llm_model if not skip_llm else None,
            "calls": getattr(llm_stats, "calls", 0) if llm_stats else 0,
            "input_tokens": getattr(llm_stats, "input_tokens", 0) if llm_stats else 0,
            "output_tokens": getattr(llm_stats, "output_tokens", 0) if llm_stats else 0,
            "failed_calls": getattr(llm_stats, "failed_calls", 0) if llm_stats else 0,
            "extracted_edges": llm_edges_added,
            "estimated_cost_usd": (
                round(estimate_cost_usd(llm_stats, llm_model), 4)
                if (llm_stats and not skip_llm)
                else 0.0
            ),
            "errors": getattr(llm_stats, "errors", []) if llm_stats else [],
        },
    }
    store.write_run_metadata(meta)
    total_edges = n_edges + llm_edges_added
    click.echo(json.dumps(meta, indent=2))
    click.echo(
        f"\n✓ Ingested slice={slice_name}: "
        f"{n_nodes} nodes, {total_edges} edges ({n_edges} deterministic + {llm_edges_added} LLM), "
        f"{wall:.1f}s wall-clock."
    )


@main.command()
@click.argument("query_name")
@click.option("--proc", default=None)
@click.option("--policy", default=None)
@click.option("--handler", default=None)
@click.option("--instrument", default=None)
@click.option("--slice", "slice_name", default="fx-spot")
def query(
    query_name: str,
    proc: str | None,
    policy: str | None,
    handler: str | None,
    instrument: str | None,
    slice_name: str,
) -> None:
    """Run one of the four spike queries."""
    store = JsonGraphStore(STORE_DIR / slice_name)
    if query_name == "code-for-procedure":
        if not proc:
            raise click.ClickException("--proc required")
        rows = code_for_procedure(store, proc)
    elif query_name == "regulations-cited-by":
        if not policy:
            raise click.ClickException("--policy required")
        rows = regulations_cited_by(store, policy)
    elif query_name == "decisions-affecting":
        if not handler:
            raise click.ClickException("--handler required")
        rows = decisions_affecting(store, handler)
    elif query_name == "obligations-for-product":
        if not instrument:
            raise click.ClickException("--instrument required")
        rows = obligations_for_product(store, instrument)
    else:
        raise click.ClickException(f"Unknown query: {query_name}")
    click.echo(json.dumps(rows, indent=2))


@main.command()
@click.option("--slice", "slice_name", default="fx-spot")
def reset(slice_name: str) -> None:
    """Wipe the JSON store for a slice."""
    store = JsonGraphStore(STORE_DIR / slice_name)
    store.reset()
    click.echo(f"✓ Reset slice={slice_name}")


if __name__ == "__main__":
    main()
