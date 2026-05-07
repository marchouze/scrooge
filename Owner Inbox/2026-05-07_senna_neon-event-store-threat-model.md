---
agent: Senna
trigger: threat-model-gate
asOf: 2026-05-07T10:40:00.000Z
decision-required: false
---

# Senna — threat model: Neon event-store substrate

**From:** Senna (security engineer)
**To:** Rashida (CISO) — for sign-off at the threat-model gate.
**Cc:** Atlas (substrate owner), Vera (independent assurance), Iris (POPIA s.19–22 partnered counterpart), Helena (CRO).
**Authority:** CEO directive 2026-05-07 to close Atlas substrate-gap #1 (host-local event store) by introducing a shared cloud event store on Neon Postgres.

> *In-voice threat-model output. Per CLAUDE.md Principle 4 (Security designed in from the start) and Principle 7 (Autonomous by default), every new event type, API, integration, or substrate component runs through this gate before going live. This is the substrate gate for the Neon-backed cloud event store.*

## 1. What changed

The bank's event store, previously a host-local sqlite database (`prototype/.local/event.db`, gitignored), is now also persisted in a hosted Neon Postgres instance — `neondb` on `ep-floral-smoke-aq0hgdum.c-8.us-east-1.aws.neon.tech`. The local sqlite remains canonical-shape on every host; a per-run sync (`bun run event-store:sync`) reconciles the two stores bidirectionally on `event_id`.

Operational boundary:

- **Marc's laptop** — writes events to local sqlite; runs `event-store:sync` to push to Neon (manually or via git pre-push hook in future).
- **GitHub Actions runners** — pull from Neon at start of every agent workflow; agent run emits events to the runner's local sqlite; push back to Neon at end of run.
- **M8 (post-Azure cloud lift)** — Neon migrates either to Neon-on-Azure (Marketplace presence) or to Azure Database for PostgreSQL Flexible Server. Surface area at this gate does not change at M8; only the host moves.

## 2. Trust boundary

The new trust boundary is the connection from any agent host to Neon Postgres over the public internet, authenticated by a single password embedded in a libpq connection URL.

What's in the boundary:

- **Connection string** — `postgresql://<role>:<password>@<host>/<db>?sslmode=require`. Password is the only authenticator. TLS is required by Neon and not disabled in our code.
- **Database role** — `neondb_owner` (current). Owns the schema. **This is overprovisioned** — see §6.
- **Schema** — single table `events` (append-only by Principle 1) plus three indexes. No PII today; future events containing personal information go through Iris's lawful-processing register before they may flow to this store.

What's outside the boundary:

- The events themselves. Per Principle 1 the event log is the canonical record; integrity properties (append-only, citation-bound, replayable) are properties of the application, not of the store.

## 3. STRIDE on the new surface

| Threat | Vector | Mitigation today | Residual risk |
|---|---|---|---|
| **Spoofing** | Adversary obtains the connection string and impersonates a legitimate writer | Secret stored only in env (`BANK_EVENT_DB_URL`) and in GitHub Actions secrets. Never logged, never written to events, never echoed in deliverables. Pasted in chat once during setup — Marc to consider rotating once setup confirmed. | **Medium.** Single-factor auth on a long-lived password. Mitigation: rotate quarterly + on any suspected exposure. |
| **Tampering** | Adversary gains DB access and modifies / deletes historical events | `events` table is conceptually append-only. **Not enforced at schema level today** (current role can UPDATE / DELETE). Vera's `decision-event-recon` and `prose-duplication` recon detect divergence between registry and event log. | **High.** Mitigation §6: drop role to SELECT + INSERT; revoke UPDATE/DELETE/DDL. |
| **Repudiation** | An agent run denies emitting an event it did emit | Every event carries `actor.type` and `actor.id` (`service:agent:<name>:<trigger>` or `human:<email>`). Vera's continuous-controls programme consumes this as audit evidence. `recorded_at` server-clock distinct from `as_of` business time. | **Low.** Acceptable for build phase. |
| **Information disclosure** | Adversary reads event payloads | Events today contain no PII / no sensitive financial data — substrate-state snapshots, recon results, policy-change records. **TLS-only in transit; encrypted at rest by Neon.** When real-customer events come on stream (post-licence-day) Iris's lawful-processing register gates what may flow here. | **Low today; medium at licence-day.** Mitigation: per-field encryption for sensitive payloads via HSM-bound keys (Senna substrate, planned). |
| **Denial of service** | Neon goes down or rate-limits | Local sqlite remains canonical-shape on every host — agent runs continue to read/write locally. Sync fails non-fatally with a logged error; the next sync catches up. Free tier limits: 0.5GB storage, ~190 compute-hours/month — well within build-phase volume. | **Low.** Sync-on-boot pattern degrades gracefully. |
| **Elevation of privilege** | Adversary uses Postgres role to attack other resources | Single role (`neondb_owner`) on a single database (`neondb`) on a single Neon project. No cross-tenant blast radius. Network: Neon-managed; we do not run other workloads on this host. | **Low.** |

## 4. Secret hygiene

Today:

- ✅ Connection string stored in GitHub Actions repo secret `BANK_EVENT_DB_URL`.
- ✅ Local Marc-side use is via `read -r -d '' NEON_URL <<'EOF' … EOF` heredoc + temporary env var — not written to a file. (Recommendation: persist to macOS keychain or 1Password rather than `.envrc` — see §6.)
- ✅ Connection string never logged. Run output logs `pgRole` (the Postgres username) for audit but never the password.
- ✅ Connection string never written to events. Code path inspected.
- ✅ Connection string never echoed in deliverables. Inspected.
- ⚠️ Connection string was pasted into the working chat during setup. Recommendation: rotate the Neon password once the substrate is confirmed working and the setup chat is no longer load-bearing.

GitHub Actions:

- ✅ `BANK_EVENT_DB_URL` is a repository secret — not exposed to logs, not exposed to PRs from forks.
- ✅ Workflow injects via `env:` block on the specific step that needs it — not on the whole job.

## 5. Required hardening (before we treat this as production-ready)

Items §6 are mitigations I want before this substrate carries anything sensitive. None of them block the substrate from being useful today; they block the *next* substrate band — when real customer-data events come on stream.

### 5.1 Drop role to SELECT + INSERT

Today the connection string uses `neondb_owner`, which can UPDATE / DELETE / DROP TABLE. Append-only is a Principle 1 property; the schema must enforce it.

**Action:** Marc creates a new Neon role `bank_event_store_writer` with permissions:

```sql
GRANT SELECT, INSERT ON TABLE events TO bank_event_store_writer;
GRANT USAGE, SELECT ON SEQUENCE events_sequence_seq TO bank_event_store_writer;
-- No UPDATE, no DELETE, no DDL.
```

Then rotate `BANK_EVENT_DB_URL` to use the new role. The schema-creation `CREATE TABLE IF NOT EXISTS` in `postgres-sync.ts` becomes a no-op against the existing schema; if a schema migration is needed in future, run it once with the owner role and revert.

### 5.2 IP allowlisting

Today: any host with the connection string can connect. Mitigation: Neon supports IP allowlisting per project. Restrict to (a) Marc's home IP, (b) the GitHub Actions IP ranges (well-published list — pulled from the GitHub `meta` API).

### 5.3 Rotation cadence

Quarterly rotation. Trigger ad-hoc on any suspected exposure (e.g. credential pasted in chat, repository secrets API key compromise, Neon notification of breach).

### 5.4 PII gate at licence-day

Before any customer-data event flows to Neon, Iris (Information Officer) and I jointly sign off on:

- Lawful-processing register entry for the event class.
- Per-field encryption status (which payload fields are encrypted under HSM-bound keys; which are plaintext).
- Cross-border-transfer governance under POPIA s.72 + SARB Directive 3 of 2018. Neon-on-Azure (us-east-1 today) means data is processed in the United States. Until / unless customers consent, the data residency posture must move to a SARB-acceptable region.

### 5.5 Connection-string hygiene on Marc's laptop

Today: heredoc'd into env var per session. Acceptable for setup. Recommendation: persist via macOS keychain (`security add-generic-password`) or 1Password, retrieved by a small wrapper at the top of `event-store:sync` invocations. Out of scope for this turn.

## 6. Build-phase posture (today's actual state)

- The store is **shared but not yet hardened**. Treat it as carrying only build-phase events: substrate snapshots, recon results, agent autonomous runs, decision events, workstream lifecycle. No PII, no sensitive financial data, no real customer information.
- Vera's recon now sees the same canonical event history regardless of which host is running. The false-positive condition that motivated this work — runners reporting "registry resolved decisions but no events in store" — closes on the next workflow run that pulls from Neon.
- §5 hardening is required before the substrate carries anything sensitive. Tracked as a substrate-gap item; Atlas surfaces it on his next weekly snapshot.

## 7. Sign-off

**Approved 2026-05-07 by Marc (CEO acting as interim CISO; substantive CISO appointment pending pre-licence-day).**

Canonical entry: `TM-NEON-EVENT-STORE-001` in `Owner Inbox/2026-05-07_owen_substrate-exception-register.md`. That register is the single source of truth for the entry's status, conditions, expiry, and approver — this section does not restate them in prose (per Principle 6 single-graph discipline).

CEO disposition recorded with this approval:
- §5.1 (role downgrade), §5.2 (IP allowlist), and the §6 immediate Neon-password rotation are **deferred** while events remain non-sensitive. Acceptable while the store carries only substrate snapshots, recon results, agent run records, decision events, and workstream lifecycle. Re-gated before any sensitive-data event flows.
- §5.3 (quarterly rotation cadence) and §5.4 (PII gate at licence-day) remain in force as standing conditions.

Until the substantive CISO is appointed, "weekly state-of-platform note to Rashida" routes to Marc via Scrooge.

—Senna
