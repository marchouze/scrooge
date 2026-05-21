// runtime/agents/tomas-payments-readiness.ts
//
// Tomas's daily payments-readiness handler. Thirteenth handler in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Engineer-side counterpart to Devon's weekly
// OperationalResilienceSnapshot — Devon's run reports the engineering-
// bench coverage; Tomas's run reports the payments-substrate readiness
// across the SA payments stack and the international rails the bank
// depends on.
//
// What this handler does:
//   1. Walks Tomas-owned obligations: SARB SAMOS access (NPS Act);
//      BankservAfrica scheme rules; SWIFT MT/MX standards; ISO 20022
//      schemas; PASA settlement standards. Each entry carries its
//      build-phase status (PLANNED / DRAFTING / IN-FORCE / N/A-yet) so
//      the daily run reports the obligation surface even when the
//      pipelines aren't yet emitting events.
//   2. Counts payments-domain events in the last 7 days:
//      PaymentInitiated, PaymentSettled, ReconciliationCompleted,
//      CutoffMissed, SAMOSWindowEntered, SWIFTMessageProcessed. Most
//      are zero in build phase — the rails are not yet wired; the
//      build-phase posture is indirect-participant (memory:
//      project_indirect_participant_posture.md), so the bank goes via
//      sponsor / correspondent banks rather than directly joining
//      SAMOS / CLS.
//   3. Reads the latest OperationalResilienceSnapshot from Devon's run
//      and pairs Tomas's payments-substrate state to it.
//   4. For each payments capability — SAMOS-RTL gateway, BankservAfrica
//      EFT, SWIFT MT/MX, ISO 20022 pacs/camt, GL ↔ ledger
//      reconciliation, intra-day cut-off engine — reports
//      engineer-side readiness: ready / drafting / specified /
//      not-yet-specified.
//   5. Emits one PaymentsReadinessSnapshot event carrying the readiness
//      counts and a pointer to Devon's pair-up snapshot.
//   6. Writes a daily deliverable to Owner Inbox.
//
// Build-phase posture:
//   - The bank is an indirect participant: it does not directly join
//     SAMOS, CLS, or BankservAfrica's full participant tier. Access is
//     via correspondent / sponsor banks, which collapses some of the
//     readiness lines from "build-and-onboard" to "specify-the-sponsor-
//     contract". The readiness map below reflects that posture.
//   - Real scheme connectivity is not yet substrate. Tomas runs against
//     synthetic flows; the message generators, reconcilers, and cut-off
//     engine *are* the load-bearing build work. Live SAMOS /
//     BankservAfrica / SWIFT / Strate / CLS connectivity activates at
//     licence-day, with the indirect-participant model deciding which
//     onboarding paths fire and which collapse to a sponsor-bank seam.
//
// Author: Tomas (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "NPS-ACT-78-1998",
  "BANKS-ACT-94-1990",
  "SWIFT-CSP-2024",
  "ISO-20022",
  "PASA-SETTLEMENT-RULES",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const TOMAS_NARRATIVE_SYSTEM = `You are Tomas, the bank's operations & payments engineer — owner of SAMOS (RTGS, ISO 20022 native), BankservAfrica (EFT, RTC, PayShap), SWIFT (gpi, MT/MX, CBPR+, CSP), Strate / JSE settlement, CLS for FX, the cut-off and calendar engine, the reconciliation harness, and exception handling. Your operating spec is at \`Team/Tomas.md\`. You report through Devon (COO) at the governance level.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your daily payments-readiness attestation — for each payments capability, the engineer-side build-state, plus a walk of the obligations that bind the rails (NPS Act, scheme rulebooks, SWIFT CSP, ISO 20022, PASA), plus a 7-day count of payments-domain events, paired with Devon's most recent OperationalResilienceSnapshot.

You are an engineer. You operate the rails. You do not govern (Devon, Helena), nor account (Bea projects from your events), nor screen (Mira's gate is non-bypassable). Your voice is calm, scheme-grounded, cut-off-aware. You distinguish *direct participant* from *indirect participant via sponsor / correspondent*; *synthetic harness* from *live scheme connectivity*; *capability specified* from *capability deployed*. You name the scheme rule or SARB directive that pins each readiness line.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the payments substrate is, which capability is the load-bearing block on Devon's first end-to-end resilience rehearsal, and where the indirect-participant model collapses build work to a sponsor-bank seam.
- Picks the 1–3 most consequential observations: a capability one ticket from green; an obligation (NPS Act, scheme rulebook, ISO 20022 schema cycle) without a registered owning capability; a cut-off / reconciliation gap that gates Bea's first cash-leg posting.
- Names the next engineering move. Be concrete: a specific connector to draft (e.g., synthetic SAMOS gateway against pacs.009), a specific recon to commission (trade-leg ↔ payment-leg ↔ ledger-leg three-way), a specific scheme rulebook revision to ingest.

Cite the National Payment System Act 78 of 1998, Banks Act 94 of 1990, SWIFT CSP (current attestation cycle), ISO 20022 (current message-version cycle), and PASA settlement standards where they bind. Devon's snapshot is the canonical authoring location for engineering-bench coverage; your narrative is operations interpretation, not new bench substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Tomas's narrative". Just produce the prose.

If the input shows zero payments events (build phase), say so plainly. The dominant signal in build phase is the queue of substrate tickets between today and the first synthetic SAMOS rehearsal under Saskia's pre-licence go-live readiness gate.`;

interface ObligationLine {
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly status: "in-force" | "drafting" | "planned" | "n/a-yet";
  readonly note: string;
}

interface PaymentsEventCounts {
  readonly paymentInitiatedLast7d: number;
  readonly paymentSettledLast7d: number;
  readonly reconciliationCompletedLast7d: number;
  readonly cutoffMissedLast7d: number;
  readonly samosWindowEnteredLast7d: number;
  readonly swiftMessageProcessedLast7d: number;
}

interface CapabilityReadiness {
  readonly capabilityId: string;
  readonly label: string;
  readonly engineerSideState: "ready" | "drafting" | "specified" | "not-yet-specified";
  readonly substrateRequired: string;
  readonly nextEngineeringStep: string;
}

interface DevonPairUp {
  readonly latestSnapshot: string | null;
  readonly benchSeats: number | null;
  readonly benchSeatsWithoutHandler: number | null;
}

interface TomasSnapshot {
  readonly obligations: readonly ObligationLine[];
  readonly events: PaymentsEventCounts;
  readonly capabilities: readonly CapabilityReadiness[];
  readonly devon: DevonPairUp;
}

// Tomas's primary obligation surface. Curated here against the
// canonical sources (NPS Act, scheme rulebooks, SWIFT CSP, ISO 20022,
// PASA standards) until the obligations register exposes a structured
// per-row API and Tomas reads from it directly.
function tomasObligationShadow(): readonly ObligationLine[] {
  return [
    {
      id: "obligation:nps-act:samos-access",
      label: "SARB SAMOS access (RTGS settlement)",
      source: "National Payment System Act 78 of 1998 + SARB NPSD directives",
      status: "planned",
      note: "Indirect-participant model: access via sponsor / correspondent bank; direct SAMOS membership not pursued in build phase. Sponsor-bank contract is the binding artefact.",
    },
    {
      id: "obligation:bankserv:scheme-rules",
      label: "BankservAfrica scheme rules (EFT / RTC / PayShap)",
      source: "BankservAfrica scheme rulebooks; PASA settlement standards",
      status: "planned",
      note: "Indirect via sponsor; full participant onboarding deferred. Scheme rulebooks ingested for impact-tracking.",
    },
    {
      id: "obligation:swift:mt-mx",
      label: "SWIFT MT / MX message standards (gpi, CBPR+)",
      source: "SWIFT MT/MX rulebooks + CBPR+ migration timeline",
      status: "drafting",
      note: "BIC application not yet lodged; CSP attestation cycle starts at first BIC. Synthetic generators in flight.",
    },
    {
      id: "obligation:swift:csp",
      label: "SWIFT Customer Security Programme attestation",
      source: "SWIFT CSP 2024 control framework",
      status: "planned",
      note: "Annual attestation cycle activates at first BIC; co-owner with Senna (CSP).",
    },
    {
      id: "obligation:iso-20022:schemas",
      label: "ISO 20022 message families (pacs / pain / camt)",
      source: "ISO 20022 schema repository + scheme-published versions",
      status: "drafting",
      note: "Schema-version lock-step to scheme-published cadence. Synthetic generators target current scheme version.",
    },
    {
      id: "obligation:pasa:settlement",
      label: "PASA settlement standards (operating windows, finality)",
      source: "PASA settlement standards + scheme service-definition documents",
      status: "planned",
      note: "Calendar engine ingests PASA windows; finality semantics encoded in cut-off engine.",
    },
    {
      id: "obligation:strate:settlement",
      label: "Strate CSD settlement (T+3 → T+1 trajectory)",
      source: "Strate participant rules; JSE listings rules",
      status: "planned",
      note: "Settlement-side connectivity must land by 1 March 2027 cutover under Joint Notice 2 of 2024 (paired to Kai's reportable-trades feed).",
    },
    {
      id: "obligation:cls:fx-settlement",
      label: "CLS PvP for FX settlement",
      source: "CLS Settlement service rules",
      status: "n/a-yet",
      note: "Indirect-participant model: access via CLS member bank; direct CLS membership not pursued. Onboarding deferred to first FX position.",
    },
    {
      id: "obligation:samos:cut-off-windows",
      label: "SAMOS cut-off windows (open-of-day / end-of-day)",
      source: "SARB NPSD circulars on SAMOS operating hours",
      status: "drafting",
      note: "Cut-off engine encodes 06:00 / 16:00 SAST windows; tolerance ± 15 min per spec § 9.",
    },
  ];
}

// Engineer-side payments-capability readiness map. Each row points at a
// concrete substrate component Tomas owns (or co-owns with Atlas /
// Bea / Anya). State labels match the rohan handler's vocabulary:
//   - ready: substrate exists; capability runs today
//   - drafting: substrate work in flight (module / connector exists)
//   - specified: substrate spec exists (in /Team/Tomas.md or procedures)
//   - not-yet-specified: capability known but no substrate spec yet
function buildCapabilityReadinessMap(): readonly CapabilityReadiness[] {
  return [
    {
      capabilityId: "capability:samos-rtl-gateway",
      label: "SAMOS-RTL gateway (RTGS message exchange)",
      engineerSideState: "specified",
      substrateRequired:
        "@platform/payments/samos-connector — synthetic pacs.009 / pacs.002 round-trip against SAMOS-rehearsal endpoint. Indirect-participant: sponsor-bank API seam may collapse to a thin adapter.",
      nextEngineeringStep:
        "Draft synthetic SAMOS gateway with pacs.009 envelope shape; pair to cut-off engine 06:00 / 16:00 SAST windows.",
    },
    {
      capabilityId: "capability:bankserv-eft",
      label: "BankservAfrica EFT / RTC / PayShap connector",
      engineerSideState: "specified",
      substrateRequired:
        "@platform/payments/bankserv-connector — scheme-cycle harness for credit / debit / RTC / PayShap message families. Sponsor-bank seam for indirect access.",
      nextEngineeringStep:
        "Specify scheme-cycle table (credit, debit, RTC, PayShap) per current BankservAfrica rulebook; first synthetic cycle drives the calendar engine.",
    },
    {
      capabilityId: "capability:swift-mt-mx",
      label: "SWIFT MT / MX connector (gpi, CBPR+)",
      engineerSideState: "drafting",
      substrateRequired:
        "@platform/payments/swift-connector — MT 103 / MT 202 + MX pacs.008 / pacs.009 generators; gpi tracker; CBPR+ migration tracking.",
      nextEngineeringStep:
        "Synthetic generator covers MT/MX pair-up; BIC application is the unblock for live; CSP attestation cycle cadence specified.",
    },
    {
      capabilityId: "capability:iso-20022-pacs-camt",
      label: "ISO 20022 message families (pacs / camt)",
      engineerSideState: "drafting",
      substrateRequired:
        "Schema-version-locked envelope library — pacs.008, pacs.009, pacs.002, camt.052, camt.053, camt.054. Lock-step to scheme version cycles.",
      nextEngineeringStep:
        "Pin envelope schemas to current scheme version; reconciler reads camt.053 / camt.054 statements as the recon source-of-truth.",
    },
    {
      capabilityId: "capability:gl-ledger-reconciliation",
      label: "GL ↔ ledger reconciliation (trade-leg ↔ payment-leg ↔ ledger-leg)",
      engineerSideState: "specified",
      substrateRequired:
        "@platform/payments/reconciliation — three-way recon harness consuming Kai's trade events, Tomas's payment events, and Bea's posting events. Owner: Tomas + Bea + Anya.",
      nextEngineeringStep:
        "Specify three-way recon contract first; first reconciler runs against synthetic flows alongside the SAMOS gateway draft.",
    },
    {
      capabilityId: "capability:cut-off-engine",
      label: "Intra-day cut-off engine (calendars, holidays, scheme cycles)",
      engineerSideState: "specified",
      substrateRequired:
        "@platform/payments/calendar-engine — single-SA-calendar today; P5 multi-jurisdiction extension is design-only.",
      nextEngineeringStep:
        "Draft single-SA calendar with SAMOS / BankservAfrica / SWIFT / Strate cut-offs; multi-jurisdiction defers to second-jurisdiction onboarding.",
    },
    {
      capabilityId: "capability:strate-connector",
      label: "Strate CSD settlement connector",
      engineerSideState: "specified",
      substrateRequired:
        "@platform/payments/strate-connector — settlement-side hand-off paired to Kai's reportable-trades feed (Joint Notice 2 of 2024 1 March 2027 cutover).",
      nextEngineeringStep:
        "Specify settlement-side procedure now; participant onboarding pre-licence under Saskia's go-live readiness gate.",
    },
    {
      capabilityId: "capability:cls-connector",
      label: "CLS PvP connector (FX settlement)",
      engineerSideState: "not-yet-specified",
      substrateRequired:
        "@platform/payments/cls-connector — indirect-participant via CLS member bank. No spec until first FX position activates.",
      nextEngineeringStep:
        "Defer to first FX position (Saskia / Eitan); spec emerges with CLS member-bank contract.",
    },
  ];
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readPaymentsEventCounts(sinceIso: string): PaymentsEventCounts {
  let initiated = 0;
  let settled = 0;
  let reconCompleted = 0;
  let cutoffMissed = 0;
  let samosEntered = 0;
  let swiftProcessed = 0;
  for (const e of eventStore.replay({ type: "PaymentInitiated" })) {
    if (e.as_of >= sinceIso) initiated++;
  }
  for (const e of eventStore.replay({ type: "PaymentSettled" })) {
    if (e.as_of >= sinceIso) settled++;
  }
  for (const e of eventStore.replay({ type: "ReconciliationCompleted" })) {
    if (e.as_of >= sinceIso) reconCompleted++;
  }
  for (const e of eventStore.replay({ type: "CutoffMissed" })) {
    if (e.as_of >= sinceIso) cutoffMissed++;
  }
  for (const e of eventStore.replay({ type: "SAMOSWindowEntered" })) {
    if (e.as_of >= sinceIso) samosEntered++;
  }
  for (const e of eventStore.replay({ type: "SWIFTMessageProcessed" })) {
    if (e.as_of >= sinceIso) swiftProcessed++;
  }
  return {
    paymentInitiatedLast7d: initiated,
    paymentSettledLast7d: settled,
    reconciliationCompletedLast7d: reconCompleted,
    cutoffMissedLast7d: cutoffMissed,
    samosWindowEnteredLast7d: samosEntered,
    swiftMessageProcessedLast7d: swiftProcessed,
  };
}

function readDevonPairUp(): DevonPairUp {
  let latest: { asOf: string; payload: unknown } | null = null;
  for (const e of eventStore.replay({ type: "OperationalResilienceSnapshot" })) {
    if (latest === null || e.as_of > latest.asOf) {
      latest = { asOf: e.as_of, payload: e.payload };
    }
  }
  if (!latest) return { latestSnapshot: null, benchSeats: null, benchSeatsWithoutHandler: null };
  const p = latest.payload as { benchSeats?: number; benchSeatsWithoutHandler?: number };
  return {
    latestSnapshot: latest.asOf,
    benchSeats: typeof p.benchSeats === "number" ? p.benchSeats : null,
    benchSeatsWithoutHandler:
      typeof p.benchSeatsWithoutHandler === "number" ? p.benchSeatsWithoutHandler : null,
  };
}

function buildSnapshot(ctx: AgentRunContext): TomasSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  return {
    obligations: tomasObligationShadow(),
    events: readPaymentsEventCounts(sinceIso),
    capabilities: buildCapabilityReadinessMap(),
    devon: readDevonPairUp(),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: TomasSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Tomas-owned obligations:");
  for (const o of snap.obligations) {
    lines.push(`  - [${o.status}] ${o.id}`);
    lines.push(`      label: ${o.label}`);
    lines.push(`      source: ${o.source}`);
    lines.push(`      note: ${o.note}`);
  }
  lines.push("");
  lines.push("Payments-domain events (last 7 days):");
  lines.push(`  PaymentInitiated: ${snap.events.paymentInitiatedLast7d}`);
  lines.push(`  PaymentSettled: ${snap.events.paymentSettledLast7d}`);
  lines.push(`  ReconciliationCompleted: ${snap.events.reconciliationCompletedLast7d}`);
  lines.push(`  CutoffMissed: ${snap.events.cutoffMissedLast7d}`);
  lines.push(`  SAMOSWindowEntered: ${snap.events.samosWindowEnteredLast7d}`);
  lines.push(`  SWIFTMessageProcessed: ${snap.events.swiftMessageProcessedLast7d}`);
  lines.push("");
  lines.push("Capability readiness:");
  for (const c of snap.capabilities) {
    lines.push(`  - [${c.engineerSideState}] ${c.capabilityId}`);
    lines.push(`      label: ${c.label}`);
    lines.push(`      substrate: ${c.substrateRequired}`);
    lines.push(`      next: ${c.nextEngineeringStep}`);
  }
  lines.push("");
  lines.push(
    `Devon pair-up: latest OperationalResilienceSnapshot=${snap.devon.latestSnapshot ?? "never"}; benchSeats=${snap.devon.benchSeats ?? "n/a"}; benchSeatsWithoutHandler=${snap.devon.benchSeatsWithoutHandler ?? "n/a"}`,
  );
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on the first synthetic SAMOS rehearsal; close with the next engineering move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: TomasSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Tomas", "payments-readiness", ctx.asOf));
  lines.push(`# Tomas — daily payments-readiness, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Tomas's daily payments-readiness attestation per `Team/Tomas.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Thirteenth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Engineer-side counterpart to Devon's `OperationalResilienceSnapshot`.",
  );
  lines.push("");
  const readyN = snap.capabilities.filter((c) => c.engineerSideState === "ready").length;
  const draftingN = snap.capabilities.filter((c) => c.engineerSideState === "drafting").length;
  const specifiedN = snap.capabilities.filter((c) => c.engineerSideState === "specified").length;
  const unspecifiedN = snap.capabilities.filter(
    (c) => c.engineerSideState === "not-yet-specified",
  ).length;
  const settledTotal =
    snap.events.paymentInitiatedLast7d +
    snap.events.paymentSettledLast7d +
    snap.events.reconciliationCompletedLast7d +
    snap.events.cutoffMissedLast7d +
    snap.events.samosWindowEnteredLast7d +
    snap.events.swiftMessageProcessedLast7d;
  lines.push(
    `**Headline:** ${snap.capabilities.length} payments capabilities tracked · readiness ${readyN} ready / ${draftingN} drafting / ${specifiedN} specified / ${unspecifiedN} not-yet-specified · ${settledTotal} payments-domain event${settledTotal === 1 ? "" : "s"} (last 7d) · ${snap.obligations.length} obligation line${snap.obligations.length === 1 ? "" : "s"} on Tomas's mandate surface · indirect-participant posture (no direct SAMOS / CLS membership in build phase).`,
  );
  lines.push("");

  lines.push("## Devon's latest snapshot");
  lines.push("");
  if (snap.devon.latestSnapshot === null) {
    lines.push(
      "_No `OperationalResilienceSnapshot` event in the store. Devon's weekly handler has not yet run on this event-store instance — Tomas's run still produces the engineer-side payments-readiness against the static capability shadow._",
    );
  } else {
    lines.push(`Latest \`OperationalResilienceSnapshot\` event: ${snap.devon.latestSnapshot}`);
    if (snap.devon.benchSeats !== null) {
      lines.push(
        `Engineering bench: ${snap.devon.benchSeats} seat${snap.devon.benchSeats === 1 ? "" : "s"}; ${snap.devon.benchSeatsWithoutHandler ?? "?"} without runtime handler.`,
      );
    }
    lines.push("");
    lines.push(
      "Tomas's daily run pairs with Devon's weekly run: Devon reports the bench coverage; Tomas reports the payments-substrate state. Together they close the resilience-side ↔ rails-side loop on the operations substrate.",
    );
  }
  lines.push("");

  lines.push("## Tomas-owned obligations");
  lines.push("");
  lines.push("| Obligation | Source | Status | Note |");
  lines.push("|---|---|---|---|");
  for (const o of snap.obligations) {
    lines.push(`| \`${o.id}\` | ${o.source} | ${o.status} | ${o.note} |`);
  }
  lines.push("");
  lines.push(
    "_Source: curated from Tomas's mandate surface in `Team/Tomas.md` § 4 (Areas of expertise) cross-referenced to NPS Act 78 of 1998, scheme rulebooks, SWIFT CSP 2024, ISO 20022 schema repository, and PASA settlement standards. Folds into the obligations register once Mira lands the structured payments-domain rows._",
  );
  lines.push("");

  lines.push("## Payments-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`PaymentInitiated\` | ${snap.events.paymentInitiatedLast7d} |`);
  lines.push(`| \`PaymentSettled\` | ${snap.events.paymentSettledLast7d} |`);
  lines.push(`| \`ReconciliationCompleted\` | ${snap.events.reconciliationCompletedLast7d} |`);
  lines.push(`| \`CutoffMissed\` | ${snap.events.cutoffMissedLast7d} |`);
  lines.push(`| \`SAMOSWindowEntered\` | ${snap.events.samosWindowEnteredLast7d} |`);
  lines.push(`| \`SWIFTMessageProcessed\` | ${snap.events.swiftMessageProcessedLast7d} |`);
  lines.push("");
  if (settledTotal === 0) {
    lines.push(
      "_Build-phase posture: zero payments-domain events. The rails are not yet wired — synthetic generators are the load-bearing build work. The bank's indirect-participant model means SAMOS / CLS access lands via sponsor banks, not direct membership; live event flow activates at licence-day under Saskia's go-live readiness gate._",
    );
    lines.push("");
  }

  lines.push("## Capability readiness");
  lines.push("");
  lines.push("| Capability | Engineer-side state | Substrate required | Next engineering step |");
  lines.push("|---|---|---|---|");
  for (const c of snap.capabilities) {
    lines.push(
      `| \`${c.capabilityId}\` (${c.label}) | ${c.engineerSideState} | ${c.substrateRequired} | ${c.nextEngineeringStep} |`,
    );
  }
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **Synthetic SAMOS gateway** — pacs.009 / pacs.002 round-trip against a SAMOS-rehearsal endpoint is the load-bearing first ticket. Sponsor-bank seam collapses some onboarding cost; the message-shape work is unchanged.",
  );
  lines.push(
    "- **Three-way reconciliation harness (Tomas + Bea + Anya)** — trade-leg ↔ payment-leg ↔ ledger-leg recon designed, not deployed. Pre-condition for Bea's first cash-leg posting against synthetic flow.",
  );
  lines.push(
    "- **SWIFT BIC application + CSP onboarding** — pre-licence deliverable; co-owned with Senna. CSP attestation cycle cannot start until the BIC lands.",
  );
  lines.push(
    "- **Strate participant onboarding** — settlement-side connectivity must be live by 1 March 2027 (Joint Notice 2 of 2024 cutover). Paired to Kai's reportable-trades feed; co-owned with Saskia (markets seam).",
  );
  lines.push(
    "- **Cut-off engine — multi-jurisdictional calendar** — single-SA calendar today; P5 multi-jurisdiction extension is design-only. Defers to second-jurisdiction onboarding.",
  );
  lines.push(
    "- **Sponsor-bank contract template (indirect-participant model)** — Imani co-ownership; binding artefact for SAMOS / BankservAfrica / CLS access. Substrate gap: contract template not yet drafted.",
  );
  lines.push(
    "- **Structured obligations-register rows for payments domain** — Tomas's obligation shadow mirrored in this handler; folds into the obligations register when Mira lands the payments-domain entries.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Tomas's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Tomas's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    'Devon\'s latest `OperationalResilienceSnapshot` via `eventStore.replay({type:"OperationalResilienceSnapshot"})` (max as_of); obligation shadow curated from `Team/Tomas.md` cross-referenced to NPS Act 78 of 1998, scheme rulebooks, SWIFT CSP 2024, ISO 20022, and PASA standards; capability-readiness map curated by Tomas; payments-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days (`PaymentInitiated`, `PaymentSettled`, `ReconciliationCompleted`, `CutoffMissed`, `SAMOSWindowEntered`, `SWIFTMessageProcessed`).',
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "PaymentsReadinessSnapshot",
      as_of: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:tomas:payments-readiness" },
      citations: EVENT_CITATIONS,
      payload: {
        capabilityCount: snap.capabilities.length,
        readinessReady: snap.capabilities.filter((c) => c.engineerSideState === "ready").length,
        readinessDrafting: snap.capabilities.filter((c) => c.engineerSideState === "drafting")
          .length,
        readinessSpecified: snap.capabilities.filter((c) => c.engineerSideState === "specified")
          .length,
        readinessUnspecified: snap.capabilities.filter(
          (c) => c.engineerSideState === "not-yet-specified",
        ).length,
        obligationCount: snap.obligations.length,
        obligationsInForce: snap.obligations.filter((o) => o.status === "in-force").length,
        obligationsDrafting: snap.obligations.filter((o) => o.status === "drafting").length,
        obligationsPlanned: snap.obligations.filter((o) => o.status === "planned").length,
        obligationsNAyet: snap.obligations.filter((o) => o.status === "n/a-yet").length,
        ...snap.events,
        latestDevonSnapshot: snap.devon.latestSnapshot,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: TOMAS_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, snap),
        maxTokens: 6_000,
        effort: "high",
        meta: { runId: ctx.runId ?? ctx.trigger.id, agent: ctx.agent, dryRun: ctx.dryRun },
      });
      if (r.ok) {
        narrative = r.result.text.trim();
        logger.info(
          {
            inputTokens: r.result.usage.inputTokens,
            cacheReadInputTokens: r.result.usage.cacheReadInputTokens,
            outputTokens: r.result.usage.outputTokens,
            model: r.result.model,
          },
          "tomas:payments-readiness — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "tomas narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_tomas_payments-readiness.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      capabilities: snap.capabilities.length,
      readinessSpecified: snap.capabilities.filter((c) => c.engineerSideState === "specified")
        .length,
      paymentEvents:
        snap.events.paymentInitiatedLast7d +
        snap.events.paymentSettledLast7d +
        snap.events.swiftMessageProcessedLast7d,
      obligations: snap.obligations.length,
      latestDevonSnapshot: snap.devon.latestSnapshot,
    },
    "tomas:payments-readiness — snapshot built",
  );

  const readyN = snap.capabilities.filter((c) => c.engineerSideState === "ready").length;
  const draftingN = snap.capabilities.filter((c) => c.engineerSideState === "drafting").length;
  const specifiedN = snap.capabilities.filter((c) => c.engineerSideState === "specified").length;
  const unspecifiedN = snap.capabilities.filter(
    (c) => c.engineerSideState === "not-yet-specified",
  ).length;
  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.capabilities.length} payments capabilities · ${readyN}/${draftingN}/${specifiedN}/${unspecifiedN} ready/drafting/specified/unspecified · ${snap.obligations.length} obligations · ${snap.events.paymentInitiatedLast7d + snap.events.paymentSettledLast7d} payment events.`,
    ok: true,
  };
};

export default handler;
