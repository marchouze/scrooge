// runtime/agents/senna-m1-trading-stack-threat-model.ts
//
// Senna's M1 trading-stack threat-model handler.
//
// Authority:
//   - `Team Inbox/2026-05-07_brief_senna_m1-trading-stack-threat-model.md` —
//     scope, what-good-looks-like, reconciliation, deliverable.
//   - `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md`
//     — §9 (architecture layers), §11 (Senna+Rashida cross-persona dep),
//     §14 (open items routed to Senna+Rashida).
//   - CEO decision `D-MARKETS-SCHEMA-FOUNDATION` (approved 2026-05-07) —
//     the trigger condition for this handler.
//   - CLAUDE.md Principle 4 — security designed in from the start.
//   - Joint Standard 2 of 2024 (PA + FSCA) on cyber resilience for the
//     trading estate; ORG-CY-01..05, ORG-CY-09..14 in the obligations
//     register.
//   - POPIA s.19–22 — operational security safeguards (ORG-PR(IV)-06).
//   - BCBS Op Resilience principles (ORG-CY-08; cited alongside Joint
//     Standard 1 of 2024 at ORG-CY-05).
//
// Trigger kind: event-driven. Subscribes to `CeoDecision`. Filters for
// `decisionId === "D-MARKETS-SCHEMA-FOUNDATION"` so unrelated CeoDecisions
// don't fire the handler.
//
// What this handler does:
//   1. For each triggering D-MARKETS-SCHEMA-FOUNDATION CeoDecision,
//      emits four `ThreatModelDimensionRegistered` events covering:
//        a. STRIDE on the FIX-gateway perimeter (ingress).
//        b. Zero-trust posture for the gateway (pairs with Kai's
//           pre-trade-gateway aggregator, PR #26).
//        c. HSM key custody for the order-signing path.
//        d. Operational-security boundary on the OMS/EMS substrate.
//   2. Emits one `SecurityGateRegistered` event recording the M2
//      pre-condition: M2 (listed bonds + repo) cannot start until the
//      four dimensions above are reviewed and ratified by Rashida (per
//      Senna spec §10 — engineering-level recommendation, governance
//      ratification escalates to Rashida).
//   3. Writes an Owner Inbox completion deliverable summarising what
//      was modelled, what controls anchor each dimension, and the
//      substrate gaps the brief flags (HSM provisioning is open under
//      Atlas).
//
// What this handler does NOT do (intentional):
//   - It does not author the long-form STRIDE table per dimension —
//     those land at `security/threat-models/<...>.md` once Senna's spec
//     §16 substrate-gap (threat-model artefact directory) closes. v1
//     anchors the *registration* events so Vera's pipeline can prove
//     coverage; the prose threat models follow.
//   - It does not gate M2 in code today — Atlas's gate-check is a
//     planned Vera Wave-4 reconciliation. v1 records the gate as an
//     event so the gate-check can be added without re-emission.
//   - It does not run the CISO ratification (`ThreatModelGateApproved`)
//     — that escalates to Rashida via `AgentEscalation` per Senna spec
//     §10 and is its own typed event.
//
// Idempotency: re-running with the same D-MARKETS-SCHEMA-FOUNDATION
// CeoDecision is a no-op once the four dimensions and the gate are
// already registered (checked against the event store by dimensionId
// and gateId).
//
// Author: Senna (handler) · Rashida (CISO — ratification overseer) ·
// Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const DEFAULT_ENTITY = "BANK-ZA-001";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:senna:m1-trading-stack-threat-model",
};

const TARGET_DECISION_ID = "D-MARKETS-SCHEMA-FOUNDATION";

const M2_GATE_ID = "gate:senna:m1-trading-stack-threat-model:m2-precondition";

/**
 * Citation chain shared across every emission from this handler. Per
 * Principle 2 each event traces to a structured source. Anchors:
 *   - ORG-CY-01 — Joint Standard 2 of 2024 framework (cyber-resilience
 *     accountable named substrate).
 *   - ORG-CY-03 — Joint Standard 2 of 2024 threat modelling, risk
 *     assessment, controls catalogue (the explicit obligation this
 *     handler discharges at engineering level).
 *   - ORG-CY-05 — Joint Standard 2 of 2024 + BCBS Op Resilience tested
 *     cyber-incident response with rehearsed runbooks (anchors the
 *     ops-security boundary dimension).
 *   - ORG-CY-09 — ISO/IEC 27001:2022 reference alignment for the ISMS.
 *   - ORG-CY-12 — NIST SP 800-218 (SSDF) reference for secure SDLC
 *     (anchors the OMS/EMS substrate dimension).
 *   - ORG-PR(IV)-06 — POPIA s.19–22 operational security safeguards
 *     (binds whenever the trading stack handles personal information of
 *     counterparty staff / authorised traders).
 *   - GOV-FRAMEWORK-CEO-RESERVED — the franchise-scope authority that
 *     the CEO reserved on 2026-05-07 with D-MARKETS-SCHEMA-FOUNDATION.
 */
const BASE_CITATIONS: readonly string[] = [
  "ORG-CY-01",
  "ORG-CY-03",
  "ORG-CY-05",
  "ORG-CY-09",
  "ORG-CY-12",
  "ORG-PR(IV)-06",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

/**
 * The four threat-model dimensions this handler registers. Each dimension
 * is a `ThreatModelDimensionRegistered` event payload. The prose threat
 * model lands at `security/threat-models/<dimensionId>.md` once Senna's
 * spec §16 substrate gap (threat-model artefact directory) closes; the
 * registration alone is sufficient for Vera's coverage assertion and for
 * Rashida's ratification queue.
 */
interface ThreatModelDimension {
  readonly dimensionId: string;
  readonly surface: string;
  /** Human-readable headline of the dimension (one sentence). */
  readonly headline: string;
  /**
   * The framework anchored on this dimension — STRIDE for ingress
   * threat enumeration, zero-trust for gateway identity / authz, HSM-FIPS
   * for cryptographic-key custody, ops-security for the resilience
   * boundary on the platform substrate.
   */
  readonly framework: "STRIDE" | "zero-trust" | "HSM-FIPS-140-2-3-L3" | "ops-security";
  /**
   * Headline controls that anchor this dimension. The full STRIDE-by-
   * threat table follows in the prose threat model; these are the load-
   * bearing controls captured at registration time.
   */
  readonly controls: readonly string[];
  /**
   * Citations specific to this dimension, unioned with BASE_CITATIONS at
   * emission time. Keep in lockstep with the obligations register —
   * anything new flagged with `[citation: route to Mira]` until Mira's
   * register entry lands.
   */
  readonly extraCitations: readonly string[];
  /** Substrate gap — what this dimension assumes that doesn't yet exist. */
  readonly substrateGap: string | null;
}

const DIMENSIONS: readonly ThreatModelDimension[] = [
  {
    dimensionId: "tm:senna:trading-stack:fix-gateway-stride",
    surface: "FIX-gateway perimeter (inbound trading-session ingress)",
    headline:
      "STRIDE enumeration on the FIX-gateway perimeter — session authentication, message integrity, replay protection, sequence-gap handling, rate-limit DoS posture, audit-log tamper-evidence.",
    framework: "STRIDE",
    controls: [
      "Mutual TLS with counterparty certificate pinning (Spoofing)",
      "FIX session-level message integrity via signed envelope and per-message HMAC (Tampering)",
      "Append-only event-store ingest with as-of replay (Repudiation; pairs with Principle 1)",
      "POPIA-aligned per-field encryption on counterparty trader identity (Information disclosure)",
      "Rate-limit + token-bucket on the FIX session, surfacing SuspiciousAuthEvent on burst (Denial of Service)",
      "Zero-trust workload identity on the gateway — no shared service account (Elevation of privilege)",
      "Sequence-gap detection with explicit re-request semantics; gaps emit SecurityIncidentRaised at Tier configurable per RAS B6",
    ],
    extraCitations: [
      // FIX gateway is institutional-only and JSE-routed; the franchise-
      // scope citation anchors at the CEO-reserved governance line.
      // STRATEGIC-FOUNDATION-INSTITUTIONAL is not yet in the register —
      // [citation: route to Mira] until it lands.
      "JSE-RULES-EQUITIES",
      "FMA-S5",
    ],
    substrateGap:
      "FIX-gateway implementation does not yet exist; the threat model is a forward-load anchor for the gateway build. v1 registration locks the dimensions; the live gateway substrate inherits the controls list at build time.",
  },
  {
    dimensionId: "tm:senna:trading-stack:gateway-zero-trust",
    surface:
      "Pre-trade gateway aggregator + check fan-out path (Kai's `@platform/markets/pre-trade-gateway`, PR #26)",
    headline:
      "Zero-trust posture for the pre-trade gateway — every check handler authenticates and authorises against the substrate, no implicit trust between aggregator and check workers, dispatch is the single architectural non-bypassability point.",
    framework: "zero-trust",
    controls: [
      "Workload identity per check handler (sanctions / suitability / credit / market-risk / capital-impact / funding / surveillance) — Atlas A2 permission-policy publishes the allow-list",
      "Aggregator is the single dispatch point that emits OrderApprovedAtGateway / OrderRejectedAtGateway (Kai.md §15 non-bypassability)",
      "GatewayCheckRequested fan-out carries a per-request capability token; check handlers cannot emit decisions outside their scope",
      "BusDispatched idempotency on (eventId, handlerKey) prevents replay-style override",
      "All gateway events carry the citation chain to FAIS / FIC / JSE / FMA / governance line (Principle 2)",
      "Override path deferred entirely from v0 (per S7-Targeted #5 sub-decision C); no break-glass surface in M1",
    ],
    extraCitations: ["ORG-CD-01", "ORG-FC-13"],
    substrateGap:
      "Slice-1 default-approve aggregator is live (PR #26); slices 2–7 (individual check handlers, surveillance overlay) land per the gateway brief. Zero-trust posture binds at slice 2 when the first check handler authenticates against the aggregator.",
  },
  {
    dimensionId: "tm:senna:trading-stack:hsm-order-signing",
    surface:
      "Order-signing key custody (HSM-bound private keys for order + trade-confirmation events)",
    headline:
      "HSM key-custody for the order-signing and trade-confirmation paths — keys never leave the FIPS 140-2/3 Level 3 boundary; rotation cadence policy-bound; segregation between trade-confirmation and settlement signing keys.",
    framework: "HSM-FIPS-140-2-3-L3",
    controls: [
      "Trade-confirmation signing key segregated from settlement signing key — different HSM key handles, different rotation cadence, different actor IDs",
      "Quarterly key-ceremony rehearsal (Senna spec §6 Cadence) — synthetic phase today, live at licence-day",
      "KeyRotationPerformed event emitted on every rotation; KeyRotationDue event from the scheduler triggers Senna's rotation handler",
      "Identity issuance via `scripts/identity-issue.ts` produces non-extractable HSM-bound keys (per Senna spec §12)",
      "Dual-control on any rotation that changes custodianship (Senna spec §10 escalation to Rashida)",
      "Order-signing path emits an event-store entry with the signing key's HSM handle for audit replay",
    ],
    extraCitations: [
      // SARB PA Directive 3 of 2018 governs cloud key custody where keys
      // sit in a managed cloud HSM (target state per project_cloud_target_azure).
      "ORG-CY-06",
    ],
    substrateGap:
      "HSM substrate is not yet provisioned (Senna spec §16 — open Atlas roadmap item; pre-licence cloud-lift target). Local-build phase uses placeholder keys with the same envelope shape so the order-signing path is wire-compatible at cutover.",
  },
  {
    dimensionId: "tm:senna:trading-stack:oms-ems-ops-security",
    surface:
      "OMS / EMS substrate (multi-asset booking, order routing, exchange connectivity, surveillance feeds — Kai's mandate)",
    headline:
      "Operational-security boundary on the OMS / EMS substrate — secure SDLC gates, build-time supply-chain attestation, runtime detection on the trading-agent fleet, incident-response runbooks rehearsed for the markets-event stream.",
    framework: "ops-security",
    controls: [
      "Secure SDLC gates declared in `prototype/package.json` `ci` script (typecheck, lint, test, citation gate, recon harnesses); SCA / SAST land per Senna spec §16",
      "SLSA-aligned build provenance for OMS / EMS deploy artefacts (ORG-CY-13 reference; target Build Level 3)",
      "ISO 27001:2022 Annex A.8.25–A.8.34 reference alignment on secure development (ORG-CY-14)",
      "Detection-pipeline rules for surveillance-feed anomalies feed `SecurityIncidentRaised` (Senna spec §11; pipeline substrate planned)",
      "IR runbook `Procedures/by-policy/incident-response.md` rehearsed monthly (Senna spec §6); Tier-3/Tier-4 cyber severity per RAS B6 routes to Rashida",
      "Operational-resilience scenario testing extends to markets-stack outage scenarios (ORG-CY-08; Devon co-owns)",
      "POPIA s.22 breach-notification workflow lit on personal-information compromise via `Procedures/by-policy/popia-breach-notification.md`",
    ],
    extraCitations: [
      "ORG-CY-08",
      // BCBS principles on operational and cyber risk are cited alongside
      // Joint Standard 2 of 2024 at ORG-CY-05; the operational-risk
      // umbrella sits at ORG-PR-17.
      "ORG-PR-17",
    ],
    substrateGap:
      "Detection pipeline (SIEM / EDR / XDR) and SOAR orchestrator are not yet built (Senna spec §16). v1 dimension registers the controls as posture; live runtime detection lights up at pre-licence.",
  },
];

/**
 * Look up whether a ThreatModelDimensionRegistered already exists for a
 * given dimensionId — handler-layer idempotency.
 */
function dimensionAlreadyRegistered(dimensionId: string): boolean {
  for (const e of eventStore.replay({ type: "ThreatModelDimensionRegistered" })) {
    const p = e.payload as { dimensionId?: unknown };
    if (typeof p.dimensionId === "string" && p.dimensionId === dimensionId) return true;
  }
  return false;
}

/**
 * Look up whether the M2 SecurityGateRegistered already exists.
 */
function gateAlreadyRegistered(gateId: string): boolean {
  for (const e of eventStore.replay({ type: "SecurityGateRegistered" })) {
    const p = e.payload as { gateId?: unknown };
    if (typeof p.gateId === "string" && p.gateId === gateId) return true;
  }
  return false;
}

interface RunOutcome {
  readonly dimensionsEmitted: number;
  readonly dimensionsSkipped: number;
  readonly gateEmitted: boolean;
  readonly gateSkipped: boolean;
}

function emitDimensions(ctx: AgentRunContext, decisionId: string): RunOutcome {
  let dimensionsEmitted = 0;
  let dimensionsSkipped = 0;
  let gateEmitted = false;
  let gateSkipped = false;

  for (const dim of DIMENSIONS) {
    if (dimensionAlreadyRegistered(dim.dimensionId)) {
      dimensionsSkipped += 1;
      continue;
    }
    if (ctx.dryRun) continue;
    eventStore.append({
      event_id: newEventId(),
      type: "ThreatModelDimensionRegistered",
      as_of: ctx.asOf,
      entity: DEFAULT_ENTITY,
      actor: HANDLER_ACTOR,
      citations: [...BASE_CITATIONS, ...dim.extraCitations],
      payload: {
        dimensionId: dim.dimensionId,
        surface: dim.surface,
        headline: dim.headline,
        framework: dim.framework,
        controls: [...dim.controls],
        substrateGap: dim.substrateGap,
        sourceDecisionId: decisionId,
        runTrigger: ctx.trigger.id,
      },
    });
    dimensionsEmitted += 1;
  }

  if (gateAlreadyRegistered(M2_GATE_ID)) {
    gateSkipped = true;
  } else if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "SecurityGateRegistered",
      as_of: ctx.asOf,
      entity: DEFAULT_ENTITY,
      actor: HANDLER_ACTOR,
      citations: [...BASE_CITATIONS],
      payload: {
        gateId: M2_GATE_ID,
        gateKind: "m2-precondition",
        description:
          "M2 (listed bonds + repo) cannot start until the four trading-stack threat-model dimensions are reviewed and ratified by Rashida (CISO) per Joint Standard 2 of 2024 programme.",
        gatedDimensionIds: DIMENSIONS.map((d) => d.dimensionId),
        sourceDecisionId: decisionId,
        runTrigger: ctx.trigger.id,
      },
    });
    gateEmitted = true;
  }

  return { dimensionsEmitted, dimensionsSkipped, gateEmitted, gateSkipped };
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  outcome: RunOutcome,
  decisionIds: readonly string[],
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Senna", "m1-trading-stack-threat-model", ctx.asOf));
  lines.push(`# Senna — M1 trading-stack threat-model, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Senna's M1 trading-stack threat-model handler per `Team Inbox/2026-05-07_brief_senna_m1-trading-stack-threat-model.md`. Triggered event-driven on `CeoDecision` for `D-MARKETS-SCHEMA-FOUNDATION`.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${DIMENSIONS.length} threat-model dimensions registered (${outcome.dimensionsEmitted} emitted; ${outcome.dimensionsSkipped} idempotent-skipped). M2 security-gate ${outcome.gateEmitted ? "registered" : outcome.gateSkipped ? "already present" : "not registered (dry-run / no trigger)"}.`,
  );
  lines.push("");

  lines.push("## Dimensions modelled");
  lines.push("");
  for (const dim of DIMENSIONS) {
    lines.push(`### ${dim.dimensionId}`);
    lines.push("");
    lines.push(`- **Surface.** ${dim.surface}`);
    lines.push(`- **Framework.** ${dim.framework}`);
    lines.push(`- **Headline.** ${dim.headline}`);
    lines.push("- **Controls.**");
    for (const c of dim.controls) lines.push(`  - ${c}`);
    if (dim.substrateGap) lines.push(`- **Substrate gap.** ${dim.substrateGap}`);
    lines.push("");
  }

  lines.push("## M2 security gate");
  lines.push("");
  lines.push(`- **Gate ID.** \`${M2_GATE_ID}\``);
  lines.push(
    "- **Pre-condition.** M2 (listed bonds + repo) cannot start until the four dimensions above are reviewed and ratified by Rashida (CISO) per the Joint Standard 2 of 2024 programme.",
  );
  lines.push(
    "- **Enforcement.** v1 records the gate as a `SecurityGateRegistered` event; Atlas's gate-check (planned Vera Wave-4 reconciliation) will block M2 dispatch until the gated dimensions carry a `ThreatModelGateApproved` event from Rashida.",
  );
  lines.push("");

  lines.push("## Citation chain");
  lines.push("");
  lines.push(
    "Every event emitted by this handler carries the union of the base chain and the dimension-specific anchors:",
  );
  lines.push("");
  for (const c of BASE_CITATIONS) lines.push(`- \`${c}\``);
  lines.push("");
  lines.push(
    "Joint Standard 2 of 2024 binds at ORG-CY-01 / 03 / 05; POPIA s.19–22 binds at ORG-PR(IV)-06; BCBS Op Resilience binds at ORG-PR-17 / ORG-CY-08 (cited per dimension where the resilience boundary is load-bearing). NIST SSDF (ORG-CY-12) and ISO 27001:2022 (ORG-CY-09 / 14) are reference-aligned anchors per the obligations register.",
  );
  lines.push("");
  lines.push(
    "_Substrate-gap citations flagged inline with `[citation: route to Mira]` are forward-load — Mira's parallel `m1-regulator-citation-urns` handler is updating the register alongside this run; missing URNs land in the next register snapshot._",
  );
  lines.push("");

  lines.push("## What this run did");
  lines.push("");
  lines.push(`- **Trigger.** ${ctx.trigger.kind} \`${ctx.trigger.id}\``);
  lines.push(
    `- **Triggering CeoDecisions matched.** ${decisionIds.length === 0 ? "_none_" : decisionIds.map((d) => `\`${d}\``).join(", ")}`,
  );
  lines.push(
    `- **\`ThreatModelDimensionRegistered\` events emitted.** ${outcome.dimensionsEmitted}`,
  );
  lines.push(
    `- **\`ThreatModelDimensionRegistered\` events skipped (idempotent).** ${outcome.dimensionsSkipped}`,
  );
  lines.push(
    `- **\`SecurityGateRegistered\` event.** ${outcome.gateEmitted ? "emitted" : outcome.gateSkipped ? "skipped (already present)" : "not emitted"}`,
  );
  lines.push("");

  lines.push("## Out of scope for M1");
  lines.push("");
  lines.push(
    "- Production-grade penetration test of the gateway — separate engagement, post-licence.",
  );
  lines.push(
    "- Insider-threat modelling on agent-runtime privileges — separate Senna workstream paired with the agent-runtime substrate's permission policy (Atlas A2).",
  );
  lines.push(
    "- Long-form prose threat-model artefacts at `security/threat-models/<dimensionId>.md` — substrate gap (Senna spec §16); v1 anchors registration; prose follows.",
  );
  lines.push("");

  lines.push("## Reconciliation");
  lines.push("");
  lines.push(
    "- Vera asserts every dimension has a registered control set, and every control reconciles to a system capability or procedure (planned recon pipeline against `ThreatModelDimensionRegistered`).",
  );
  lines.push(
    "- Senna's `security-substrate-state` weekly handler (`runtime/agents/senna-security-substrate-state.ts`) picks up the four new dimensions in its next snapshot.",
  );
  lines.push(
    "- Rashida's CISO ratification arrives as `ThreatModelGateApproved` events; until they land, M2 dispatch is gated.",
  );
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `Team Inbox/2026-05-07_brief_senna_m1-trading-stack-threat-model.md` (binding scope), `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` (source proposal §9 / §11 / §14), `Team/Senna.md` (operating spec), `Regulations/_obligations-register.md` (URN anchors), `prototype/runtime/agents/kai-pre-trade-gateway-aggregator.ts` (PR #26 zero-trust pairing), and CLAUDE.md Principle 4 (security designed in from the start).",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  // D-DECISIONS-FRAMEWORK-REDESIGN Slice C: accept both legacy CeoDecision
  // and the unified Decision event type.
  const ceoDecisions = triggering.filter(
    (e): e is Event => e.type === "CeoDecision" || e.type === "Decision",
  );

  // Filter for the specific decision that authorises this handler.
  const matched = ceoDecisions.filter((e) => {
    const p = e.payload as { decisionId?: unknown };
    return typeof p.decisionId === "string" && p.decisionId === TARGET_DECISION_ID;
  });

  if (matched.length === 0) {
    logger.debug(
      { triggering: triggering.length, ceoDecisions: ceoDecisions.length },
      `senna:m1-trading-stack-threat-model — no ${TARGET_DECISION_ID} CeoDecision in triggering set; nothing to do`,
    );
    return {
      eventsEmitted: 0,
      summary: `no ${TARGET_DECISION_ID} CeoDecision in triggering set; nothing to do`,
      ok: true,
    };
  }

  // The handler's emissions are decision-shape-stable: the same four
  // dimensions and the same gate are registered regardless of which
  // matched CeoDecision fired the run. Idempotency at the dimensionId /
  // gateId level handles re-fires from multiple triggering decisions in
  // the same triggering set or from later re-runs.
  const decisionIds = matched.map((e) => {
    const p = e.payload as { decisionId?: unknown };
    return typeof p.decisionId === "string" ? p.decisionId : "(unknown)";
  });

  const outcome = emitDimensions(ctx, decisionIds[0] ?? TARGET_DECISION_ID);
  const eventsEmitted = outcome.dimensionsEmitted + (outcome.gateEmitted ? 1 : 0);

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_senna_m1-trading-stack-threat-model_completion.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, outcome, decisionIds),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.info(
    {
      triggering: triggering.length,
      ceoDecisions: ceoDecisions.length,
      matchedDecisions: matched.length,
      dimensionsEmitted: outcome.dimensionsEmitted,
      dimensionsSkipped: outcome.dimensionsSkipped,
      gateEmitted: outcome.gateEmitted,
      gateSkipped: outcome.gateSkipped,
    },
    "senna:m1-trading-stack-threat-model — done",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${matched.length} ${TARGET_DECISION_ID} decision(s); ${outcome.dimensionsEmitted} dimensions emitted, ${outcome.dimensionsSkipped} idempotent-skipped; gate ${outcome.gateEmitted ? "emitted" : outcome.gateSkipped ? "already present" : "not emitted"}.`,
    ok: true,
  };
};

export default handler;
