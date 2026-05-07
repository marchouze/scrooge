# `@platform/dashboard`

Live bank operations dashboard. Reads from a structured state registry, surfaces open CEO decisions for efficient review, and records each CEO action as a `CeoDecision` event in the event store.

## What it is

A single-page browser dashboard served from a Bun HTTP server on `localhost:3010`. Polls `/api/state` every 8 seconds for live refresh; `POST /api/decide` records a CEO decision.

## Running it

From `prototype/`:

```sh
make dashboard            # or: bun run dashboard
```

Then open `http://localhost:3010`.

The dashboard reads from `seeds/dashboard-state.json`. To reset to first-load state, restore that file from git.

## What you see

- **Hero band** — bank's strategic foundation, operating posture, headline metrics (principles, policies, obligations, procedures, direct reports, open governance seats).
- **Decisions for CEO** — every open decision as a card with owner, trigger, what the CEO needs to decide, source documents, and four action buttons (Approve / Modify / Defer / Request revision).
- **Recently resolved** — the audit trail of resolved decisions (most-recent-first).
- **In flight** — work-in-progress with owner and due window.
- **Direct reports + open seats** — who reports to the CEO and which governance seats are still vacant.
- **Architectural principles** — the six in force.
- **Prototype** — CI status, test count, live module list.
- **Risks & observations** — the open-watch list.

## Recording a decision

Click any action button on a decision card. A modal opens with the decision context pre-loaded; pick an action, write a one-line outcome, optionally add a comment, and submit. The server:

1. Appends a `CeoDecision` event to the event store with citations to the Governance Framework and Companies Act 71 of 2008 (Principle 2).
2. Moves the decision from the open list to the resolved list in the registry.
3. Returns the new resolved record + event ID.

The dashboard re-fetches and re-renders.

## Substrate-replacement seam (P6 — upward chain)

| Element | Local (M1) | Cloud (M8) |
|---|---|---|
| HTTP server | `Bun.serve` on `localhost:3010` | Azure Container App + Front Door / API Management |
| State registry | `seeds/dashboard-state.json` | Cosmos DB / Postgres projection |
| Decision events | SQLite event store | Cloud event substrate |
| Identity | None enforced (single-user localhost) — `LOCAL_ONLY` | Azure Entra ID + WebAuthn for the CEO seat |
| Live refresh | Polling every 8s | SSE / SignalR push when projection updates |

The HTTP surface (`/api/state`, `/api/decide`) and event-emit shape are stable across substrates; only the implementation behind the seam changes.

## Architectural principles

- **P1** — every CEO decision is an event in the log; the registry is a cache. As-of replay reproduces decision posture at any past point.
- **P2** — every `CeoDecision` event carries citations (`GOV-FRAMEWORK-CEO-RESERVED`, `COMPANIES-ACT-71-2008`).
- **P3** — no manual decision-recording outside the system; the dashboard is the coded workflow.
- **P4** — the local mock IdP is the seam for the M8 Entra ID + WebAuthn flow. Today the loopback is single-user `LOCAL_ONLY`.
- **P5** — all state is per-entity (`BANK-ZA-001`); multi-entity expansion is a registry-shape change, not a code change.
- **P6 (downward)** — the dashboard is generated from the registry; nothing is authored in the UI itself.
- **P6 (upward)** — the dashboard module is a system capability supporting the **CEO Decision Review** procedure (`Procedures/by-policy/ceo-decision-review.md`). No orphan capability.

## Procedure backed by this capability

`Procedures/by-policy/ceo-decision-review.md` — the procedure that names this dashboard as its system capability. The procedure cites the Governance Framework (Owen) as its source policy.

## What it does *not* do (yet)

- **No authentication.** The local dashboard is single-user loopback; M8 wires `@platform/identity` for Entra-ID-backed login.
- **No SSE / WebSocket push.** Polling at 8s is the M1 cadence.
- **No markdown-doc auto-write of resolutions.** Today the resolved decision lives in the registry + event log; future versions will also append a record to `Team Inbox/actioned/`.
- **No CEO-comment routing.** Comments are recorded in the event payload but not yet routed to the affected team members; future versions will fan out to Team Inbox briefs.

## Tests

Unit-tested registry mutations live at `prototype/tests/dashboard.test.ts` — covers `applyDecision` purity, idempotence guards, missing-decision rejection.
