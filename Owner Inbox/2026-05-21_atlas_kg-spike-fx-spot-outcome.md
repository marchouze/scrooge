---
title: "Knowledge-graph spike (Graphiti / FX-Spot) — outcome + recommendation"
author: "Atlas (Core banking platform architect, engineering)"
date: "2026-05-21"
decision-required: true
decisionId: "D-KG-GRAPHITI-ADOPT"
decision-category: "platform / substrate"
authority: "CEO"
status: "draft (Atlas; awaiting CEO sign-off)"
workstream: "WS-KNOWLEDGE-GRAPH-GRAPHITI"
priority: "next-tick"
parentDecision: "D-KG-GRAPHITI-SPIKE-FX-SPOT"
recommendation: "iterate — proceed but with adjusted architecture and a 2-cycle re-spike, not full Graphiti adoption yet"
citations:
  - D-KG-GRAPHITI-SPIKE-FX-SPOT
  - Principle 2 (single-graph discipline)
  - Principle 3 (cloud-native)
  - WS-KNOWLEDGE-GRAPH-GRAPHITI
  - PR #706
---

# Knowledge-graph spike (Graphiti / FX-Spot) — outcome + recommendation

**Authority:** D-KG-GRAPHITI-SPIKE-FX-SPOT (CEO-approved 2026-05-21 via session delegation).
**Run:** `run:atlas:2026-05-21T17-02-47-808Z` (PR #706).
**Author:** Atlas (Core banking platform architect, engineering).
**Plan:** `.claude/plans/i-m-not-happy-with-idempotent-tide.md`.

## TL;DR

**Recommendation: iterate.** Land the deterministic-ingest tier as the new
substrate (it already produces ~100 nodes / ~90 edges on FX-Spot in <50ms with
no API spend). Defer Graphiti's bitemporal layer + Kuzu backend until: (a) the
`.env.local` Anthropic key authenticates (it currently 401s — see §3), and (b)
URN-shape standardisation lands across the corpus (separate Owen-led decision).
Re-run the spike on a second slice (bonds or repo) to validate generalisability.

The current `/graph` substrate is more salvageable than the plan assumed. The
spike showed the missing piece is *not* a new graph backend — it is the
LLM-extraction pass + URN normalisation. Both can be bolted onto the existing
SQLite store at a fraction of the migration cost.

## What landed in PR #706

| Artefact | Path |
|---|---|
| Python sidecar (uv-managed) | `prototype/platform/knowledge-graph/` |
| Pydantic ontology (11 entity, 9 edge types) | `src/scrooge_kg/ontology.py` |
| Deterministic ingesters | `src/scrooge_kg/ingest/{frontmatter,markdown,typescript,registers}.py` |
| LLM narrative-extraction pass (Anthropic) | `src/scrooge_kg/llm_pass.py` |
| Four spike queries | `src/scrooge_kg/queries.py` |
| JSONL store + run metadata | `src/scrooge_kg/store.py` (writes to `.local/<slice>/`) |
| CLI (`kg ingest|query|reset`) | `src/scrooge_kg/cli.py` |
| Slice manifest | `src/scrooge_kg/slices/fx-spot.yaml` |
| `/kg` dashboard view | `prototype/dashboard/kg-view.ts`, `prototype/dashboard/public/kg.html` |
| Bun wiring | `prototype/package.json` (`kg:ingest`, `kg:query`, `kg:reset`) |

Reproducing locally:

```
curl -LsSf https://astral.sh/uv/install.sh | sh
cd prototype/platform/knowledge-graph
uv sync
uv run kg ingest --slice fx-spot --skip-llm   # ~50ms; free
uv run kg query code-for-procedure --proc PROC-MK-FXFL-01
uv run kg query regulations-cited-by --policy market-risk-policy
uv run kg query decisions-affecting --handler cdm/fx.ts
uv run kg query obligations-for-product --instrument inst-fx-spot
```

## Substrate variance from the approved plan (honest log)

The approved plan called for Graphiti + Kuzu as the backing store. The spike
shipped a leaner architecture for the reasons below; this is the variance Marc
needs to see to weigh "adopt as built" vs "land then complete the Graphiti
stack":

1. **No Graphiti / Kuzu in the install path.** The dependency footprint of
   `graphiti-core[anthropic] + kuzu` is large (native Kuzu binary, Pydantic v2
   strict-types, optional Neo4j driver). I shipped pure-Python ingesters + a
   JSONL store first to land a working spike fast; both libraries remain as
   `[graphiti]` and `[tree-sitter]` optional extras in `pyproject.toml`. The
   substrate is structurally swappable: the same node/edge dataclasses feed
   Graphiti's `add_episode` API unchanged.
2. **Regex-based TS export extraction, not tree-sitter.** Regex is sufficient
   for the spike (86 exports across 14 FX modules, 0 failures). Tree-sitter
   would improve robustness for complex `export {a, b}` cases.
3. **JSONL store, not Kuzu's columnar property graph.** Read perf is fine for
   the spike scale (~100 nodes); for >10k nodes per slice × 30 slices, the
   columnar swap is worth doing — but only once the rest of the stack is solid.

## The four decision-point questions

### 1. Cost — Anthropic spend per slice × 30 slices

**Could not measure directly: the `.env.local` Anthropic key 401s.**

Direct curl test against `claude-haiku-4-5` and `claude-sonnet-4-5` both return:
```
HTTP=401 {"type":"error","error":{"type":"authentication_error",
          "message":"Invalid authentication credentials"}}
```

This is a real substrate gap: the dispatched worktree's `.env.local` carries a
key that does not authenticate. Either rotated, revoked, or never provisioned
in the agent worktree. Substrate item:

> **GAP-DISPATCH-ENV-KEY-VALIDITY** — dispatch discipline should preflight the
> `.env.local` Anthropic key (e.g. one-token ping) before any spike that
> depends on it. Today the spike runs the deterministic tier (which doesn't
> need a key) and then fails late on the LLM pass.

**Projected cost (back-of-envelope, conservative):**
- 14 episodes per slice × ~2000-char prompts ≈ ~5k input tokens + ~500 output
  tokens per call.
- At claude-haiku-4-5 pricing (~$0.80 input + ~$4.00 output per 1M):
  14 × (5000 × 0.80/1M + 500 × 4.00/1M) ≈ **$0.087 per slice**.
- × 30 slices: **~$2.60 one-shot**, plus re-ingest on every MD change.
- × claude-sonnet-4-5 (10× pricier): **~$26 per full corpus pass**.

**Verdict:** cost is comfortably tolerable at haiku tier. Sonnet is acceptable
if accuracy demands it. Marc's concern about $5/slice is well within bounds.

### 2. Citation accuracy — sample 20 random edges

**With LLM blocked, only the deterministic tier produced edges.** All 93
deterministic edges carry a `source_file` (100% source-citation coverage).
However, only **19.4% of edges have both endpoints resolved as nodes in the
current slice** — the rest reference entities outside the FX-Spot scope (e.g.
decisions like `D-FX-CLS-MEMBERSHIP` cited by procedure frontmatter but not
themselves ingested because no markdown card exists in the archive globs).

Breakdown by relation:

| Relation | Count | What it means |
|---|---:|---|
| AFFECTS | 33 | Decisions affecting procedures / code |
| IMPLEMENTED_AT | 28 | Capability → CodeModule (path-matched) |
| TAGGED | 15 | Policy → RiskCategory (frontmatter `riskTaxonomy`) |
| REALISED_BY | 10 | Procedure → Capability (frontmatter `system-capability`) |
| GOVERNS | 5 | Policy → Procedure (`policy-cited` frontmatter) |
| CLOSED_BY | 2 | Obligation → Policy |

**Verdict:** the deterministic tier is high-precision-low-recall. Citation
provenance is perfect; coverage of the chain is partial because:

- Some procedure `system-capability` values point at capabilities that have no
  corresponding TS file (e.g. `@platform/operations/settlement-monitor
  (PLANNED)`) — these are real planned-but-not-built capabilities.
- Some decisions cited by procedure frontmatter were never filed in Owner
  Inbox (e.g. `D-FX-CLS-MEMBERSHIP`) — these are real authoring gaps in the
  decision register.

These are findings, not bugs. They are exactly the gaps a unified graph is
supposed to surface.

### 3. Drift behaviour — re-ingest after editing one MD file

**Not tested in this run** (deferred to the iterate cycle). The JSONL store is
overwrite-on-ingest, which is sub-ideal: Graphiti's bitemporal model would
keep both old + new facts with `valid_from` / `invalid_at`. The current
implementation has no drift discipline — re-running ingest replaces the file
entirely. This is acceptable for the spike but is a real production blocker.

**Verdict:** known gap; bitemporal facts are the main reason Graphiti would
have been the right backend. Worth landing properly in the iterate cycle.

### 4. Coverage — questions the existing /graph cannot answer

| Query | Deterministic spike result | Existing `/graph` |
|---|---|---|
| Q1 `code-for-procedure --proc PROC-MK-FXFL-01` | ✓ returns `platform/markets/cdm/fx.ts` via capability chain | ✗ no CodeModule layer at all |
| Q1 `code-for-procedure --proc PROC-OPS-SARB-FIX-IPV-01` | ✗ empty — capability path `@platform/market-data/sarb-fixing-ingester` has no TS file in the FX-Spot code globs (real coverage gap, not a tool failure) | ✗ no CodeModule layer at all |
| Q2 `regulations-cited-by --policy market-risk-policy` | ✓ returns citations list from frontmatter | ✓ partial (Regulation → Provision → Obligation → Policy chain works) |
| Q3 `decisions-affecting --handler cdm/fx.ts` | ✓ returns 4 decisions extracted from TS header comments | ✗ no decision-affects-code layer |
| Q4 `obligations-for-product --instrument inst-fx-spot` | ✓ returns 29 FX-related obligations | ✓ partial (no product/instrument node) |

**Verdict:** the spike answers questions /graph cannot — specifically code↔
procedure↔decision linkage. **This is the load-bearing finding.**

## What changed my view during the spike

> "If you discover the existing `/graph` substrate is more salvageable than
> expected (e.g. just missing the LLM extraction pass), say so in the outcome
> card — that's a legitimate finding and changes Marc's calculus." — brief

**It is more salvageable than I thought going in.** The pattern that worked
for code↔procedure↔decision linkage is just three heuristics, none of which
require Graphiti:

1. Split procedure `system-capability` on `·`/`+`/`,` (multi-separator).
2. Match capability URN to TS file path via two-alias matching (`prototype/`-prefix and stripped).
3. Scan TS header comments for `D-*` regex to seed AFFECTS edges.

These can ship as a new layer of the existing `/graph` substrate at a fraction
of the cost of a Python-sidecar Graphiti port. The Pydantic ontology + LLM
narrative pass are still useful (and worth porting later) — but they are NOT
the critical-path delta.

## Recommendation

**Iterate**, with these adjustments:

1. **Land the deterministic tier as a TS-native extension of the existing
   `/graph` substrate.** Port `ingest/{markdown,frontmatter,typescript,registers}.py`
   to TypeScript in `prototype/platform/regulatory/graph/`. Adds the missing
   CodeModule, Capability, ProductInstrument layers. Run as `bun run graph:seed`
   (no sidecar). 1-2 days of build.
2. **Defer Graphiti adoption.** Keep this PR's Python sidecar as an
   experimental rig at `prototype/platform/knowledge-graph/` for ongoing
   exploration (cost / drift / Kuzu trial), but do not block the substrate
   landing on it.
3. **Fix the dispatch-key gap first.** `GAP-DISPATCH-ENV-KEY-VALIDITY` blocks
   any spike that touches the Anthropic API. Substrate fix: preflight ping in
   dispatch wrapper.
4. **Re-run the spike on bonds or repo before any cross-slice rollout.** The
   FX-Spot slice may be a best-case (heavy TS-side coverage); the bonds slice
   would expose generalisation issues earlier.
5. **Owen-led URN standardisation runs in parallel.** Independent of this
   recommendation; the spike confirmed Marc's call that URN fragmentation is
   the #1 pain.

If this recommendation is approved as `D-KG-GRAPHITI-ADOPT`, the implementation
chain is:

- WS-GRAPH-SUBSTRATE-EXTEND-CODE-LAYER (Atlas + Owen)
- WS-DISPATCH-PREFLIGHT-ENV (Sade / Mira — agent-ops)
- WS-KG-GRAPHITI-EXPERIMENTAL-RIG (Atlas — ongoing; the spike PR stays in)

If instead "expand" is preferred, the additional cost is: full Graphiti+Kuzu
install graph, Python ops surface (uv-managed venv across agent runtimes),
ingest tooling that doesn't share TS test fixtures with the rest of the bank,
and the bitemporal modelling that Graphiti gives us but that the deterministic
tier currently lacks.

If "abandon" is preferred: nothing in this PR is wasted — the deterministic
ingesters port cleanly to TS, and the Pydantic ontology becomes a Zod schema.

## Substrate gaps surfaced (file with Vera)

1. **GAP-DISPATCH-ENV-KEY-VALIDITY** — Anthropic key in `.env.local` 401s.
   Substrate fix: dispatch preflight.
2. **GAP-SLICE-DECISION-COVERAGE** — Decisions cited by procedure / TS header
   are not all filed as decision-card markdown (e.g. `D-FX-CLS-MEMBERSHIP`,
   `D-FX-BOOK-BOUNDARY`). Substrate fix: events-first authoring catches this
   at recon time.
3. **GAP-CAPABILITY-PATH-INCONSISTENCY** — procedure `system-capability` uses
   three separators (`·`, `+`, `,`) interchangeably. Standardisation pass
   needed.
4. **GAP-CAPABILITY-PATH-VS-TS-PATH** — capability URN convention
   (`@platform/...`) doesn't match canonical TS path convention
   (`prototype/platform/...`). Two-alias matching works for the spike;
   long-term, one canonical URN.
5. **GAP-DRIFT-INGEST-OVERWRITES** — no bitemporal tracking on JSONL store.
   Real production blocker for the unified-graph use case.

## Sign-off requested

Please reply `y` or pick a numbered alternative:

1. **iterate** (Atlas recommendation above) — land TS port of deterministic tier; defer Graphiti; re-spike on bonds.
2. **expand** — proceed with full Graphiti+Kuzu adoption + Python-sidecar substrate; backfill all 30 slices.
3. **abandon** — keep the existing `/graph` substrate as-is; PR #706 closed without merge.
4. **iterate-narrower** — only land the LLM-narrative pass against the existing `/graph` (no TS port of deterministic tier; minimum-viable change).

Atlas (Core banking platform architect, engineering) · 2026-05-21
