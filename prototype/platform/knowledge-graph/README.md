# Knowledge-graph sidecar — FX-Spot spike

**Author:** Atlas (Core banking platform architect, engineering).
**Decision:** D-KG-GRAPHITI-SPIKE-FX-SPOT (CEO-approved 2026-05-21 via session delegation).
**Status:** spike. One-product-slice. Outcome card decides expand / iterate / abandon.

## What this is

A standalone Python sidecar at `prototype/platform/knowledge-graph/` that ingests
every artefact touching the FX-Spot product slice — regulations, policies,
procedures, decisions, code, registers — into a typed knowledge graph and
answers the four spike queries. Wired into the Bun runtime via `kg:*` scripts
in `prototype/package.json` (subprocess); no real-time runtime coupling.

The full plan is at `.claude/plans/i-m-not-happy-with-idempotent-tide.md`.

## Architecture choice — pragmatic spike layout

The approved plan calls for Graphiti (Zep AI) + Kuzu. Graphiti's install graph
is heavy (Kuzu native binaries, Pydantic v2 strict types, optional Neo4j driver)
and Marc explicitly authorised pragmatic fallbacks if install pain blocked the
spike. The shipping spike is structured in two tiers:

| Tier | Backend | Status |
|---|---|---|
| **Deterministic ingest** — frontmatter URNs, citations[], code-module exports, register rows | Plain JSONL store + Pydantic v2 ontology | landed ✓ |
| **Narrative LLM extraction** — typed edges from free-text bodies | Direct Anthropic client (`anthropic` SDK), strict-JSON output | landed ✓ |
| Graphiti / Kuzu bitemporal layer | Optional extra (`pip install -e .[graphiti]`) | install-deferred for the spike — call out in outcome card |

The substrate is structurally swappable: `store.py` writes JSONL today; the
same node/edge records would feed Graphiti's `add_episode` API unchanged once
the heavy install lands. The outcome card calls this out honestly so Marc's
decision is informed.

## One-time setup

```bash
# Install uv (Python package manager) — first time on a machine
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Sync the sidecar venv
cd prototype/platform/knowledge-graph
uv sync
```

Anthropic API key: place at `prototype/.env.local` (gitignored, mode 600):
```
ANTHROPIC_API_KEY=sk-ant-...
```

The CLI loads `.env.local` automatically via `python-dotenv`.

## Commands

From `prototype/platform/knowledge-graph/`:

```bash
uv run kg ingest --slice fx-spot                       # full ingest (deterministic + LLM)
uv run kg ingest --slice fx-spot --skip-llm            # deterministic only (free, ~1s)
uv run kg ingest --slice fx-spot --max-llm-episodes 5  # cost cap

uv run kg query code-for-procedure --proc PROC-OPS-SARB-FIX-IPV-01
uv run kg query regulations-cited-by --policy market-risk-policy
uv run kg query decisions-affecting --handler FxTradeBooked
uv run kg query obligations-for-product --instrument inst-fx-spot

uv run kg reset --slice fx-spot
```

From the Bun runtime root (`prototype/`):

```bash
bun run kg:ingest -- --slice fx-spot
bun run kg:query -- code-for-procedure --proc PROC-OPS-SARB-FIX-IPV-01
bun run kg:reset
```

The Bun scripts shell into `uv run kg ...`; output is stdout-passthrough.

## Output

Per-slice JSONL store at `.local/<slice>/`:

- `nodes.jsonl` — one node per line (URN-keyed, deduplicated)
- `edges.jsonl` — one edge per line (deterministic + LLM-extracted)
- `episodes.jsonl` — one source-text episode per line (BLAKE3 hashed)
- `run.json` — ingest metadata: counts, wall-clock, Anthropic tokens, estimated $$

The `/kg` dashboard route in `prototype/dashboard/` reads `nodes.jsonl` +
`edges.jsonl` + `run.json` and renders the FX-Spot subgraph side-by-side with
the existing `/graph` view for visual diff.

## What the spike measures (the four decision-point questions)

1. **Cost**: `run.json.llm.estimated_cost_usd` × 30 product slices ≤ tolerable?
2. **Citation accuracy**: every emitted edge carries `source_file` + parsed
   from the catalogue of *existing* nodes (the LLM cannot invent URNs);
   sampling 20 random edges and verifying against source MD is the manual gate.
3. **Drift behaviour**: edit one MD file, re-run `kg ingest`. Compare
   `nodes.jsonl` + `edges.jsonl` diffs.
4. **Coverage**: do the four spike queries return non-empty correct answers
   the existing `/graph` substrate can't?

## Fallback / failure modes (and what we did)

| If… | Then… |
|---|---|
| `uv` install fails | fall back to `python3 -m venv .venv && pip install -e .` |
| `graphiti-core` install fails | already deferred — spike ships without it. Outcome card flags as install-friction signal. |
| Kuzu native build fails | already deferred — JSONL store is the working spike. |
| Anthropic LLM call fails | `run.json.llm.errors` records the failure; deterministic tier still produced. |
| `tree-sitter-typescript` install fails | regex fallback in `ingest/typescript.py` already in use for the spike. |
| Anthropic spend > $2 partway | use `--max-llm-episodes` to cap; outcome card records the cap. |

## What's deliberately out of scope

- Migrating the existing `/graph` substrate at `prototype/platform/regulatory/graph/` — parallel run only.
- Other product slices (bonds, repo, IRD, equity).
- Canonical URN vocabulary across the corpus (separate Owen-led decision).
- Real-time event-stream ingest — batch only for the spike.
