// scripts/migrate/backfill-ghost-decisions-wave2.ts
//
// Wave-2 backfill for 15 decision IDs flagged by the
// `recon:decision-record-event-symmetry` advisory pipeline.
//
// NOTE: D-REPORTING-CAPABILITY is intentionally excluded. The bare ID was
// extracted from the Slice 5 deliverable *title* by the body-text scanner
// and would create a prefix-shadow hygiene fail against
// D-REPORTING-CAPABILITY-M2-M3. The governing decision is
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; this bare ID is a false positive.
//
// These IDs appear in archive/owner-inbox/ files with `decision-required: false`
// (i.e. the markdown claims the decision is closed) but no backing Decision
// event existed in the event store.  Source period: 2026-05-07 – 2026-05-21,
// the early days before events-first discipline was fully enforced.
//
// Idempotent: each entry is skipped if the decisions register already shows a
// terminal phase for that decisionId.
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16).
// Author: Scrooge (session-delegation, 2026-05-25)

import { eventStore } from "../../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
import { recordDecision, requestDecision } from "../../runtime/decisions/record";

interface Wave2Entry {
  decisionId: string;
  title: string;
  category: "engineering" | "governance" | "risk" | "compliance" | "product" | "other";
  phase: "approved" | "superseded" | "withdrawn" | "deferred";
  asOf: string;
  recommendation: string;
  rationale: string;
}

const WAVE2_ENTRIES: readonly Wave2Entry[] = [
  // -----------------------------------------------------------------------
  // APPROVED — decision was made; work delivered or regulatory posture adopted
  // -----------------------------------------------------------------------
  {
    decisionId: "D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP",
    title:
      "PA communications — full historical sweep (time-bounds lifted); obligations-register v1.16",
    category: "compliance",
    phase: "approved",
    asOf: "2026-05-10T00:00:00Z",
    recommendation:
      "Approve register update: extend historical sweep to cover all in-force SARB Prudential Authority instruments regardless of vintage; obligations-register v1.16 expansion by Mira (Compliance / RegTech engineer) + Imani (Legal-as-code engineer)",
    rationale:
      "Marc requested the complete historical inventory (every PA Directive, Joint Standard, Guidance Note, Circular regardless of issue date). v1.16 lifts the self-imposed time-bounds from PR #171 v1.14 (Directives since-2018, Guidance Notes since-2018, Circulars since-2020) while retaining the wholesale-institutional applicability filter. Register additions are within curator mandate scope; no separate CEO authorisation is required. Filed as a CeoDecision event of record per events-first authoring (CLAUDE.md 'Operating procedures'). Source: archive/owner-inbox/2026-05-10_mira-imani_pa-communications-full-historical-sweep.md.",
  },
  {
    decisionId: "D-PA-COMMUNICATIONS-REGISTER-UPDATE",
    title:
      "PA communications survey + obligations-register v1.14 expansion (JS-number mis-citation found)",
    category: "compliance",
    phase: "approved",
    asOf: "2026-05-10T00:00:00Z",
    recommendation:
      "Approve register update: SARB PA Directives, Joint Standards, Guidance Notes, and Circulars survey; obligations-register expanded to v1.14 with JS-number mis-citation surfaced as WS-JS-NUMBER-RECONCILIATION finding",
    rationale:
      "Standing register-curator mandate (Mira under Zara (CCO)) + WS-INSTRUMENT-ANALYSES continuous workstream. The survey identified that the cybersecurity Joint Standard is JS 2 of 2024, not JS 1 of 2024, and created workstream WS-JS-NUMBER-RECONCILIATION for the corrective rename. Register additions are within curator mandate scope. Filed as a CeoDecision event of record per events-first authoring. Source: archive/owner-inbox/2026-05-10_mira-imani_pa-communications-research.md.",
  },
  {
    decisionId: "D-CRO-CLIMATE-FLUENCY",
    title: "Human CRO seat — climate-risk fluency posture: Preferred (not Must-have)",
    category: "governance",
    phase: "approved",
    asOf: "2026-05-09T09:00:00Z",
    recommendation:
      "Approve: climate-risk fluency at PA Guidance Note 1 of 2024 depth is Preferred (NOT Must-have) in the human CRO recruitment search criteria",
    rationale:
      "Marc confirmed 'it is preferred' (chat-intake 2026-05-09). Reasoning: (1) engineering-not-governance — climate substrate work is by Rohan + Anya; CRO governs the substrate, not authors it; (2) pool-size economics — must-have reduces SA candidate pool from ~5–10 to ~2–3; (3) PA GN 1/2024 is guidance, not a Directive — CRO can develop depth post-appointment. Helena (CRO) + PAX (Role researcher) had converged on this posture; CEO decision closes the open question. Source: archive/owner-inbox/2026-05-09_scrooge_ceo-decision-record_d-cro-climate-fluency-preferred.md.",
  },
  {
    decisionId: "D-FOLLOW-ON-ROUTER-TEST",
    title: "Substrate verification — follow-on-router smoke test",
    category: "engineering",
    phase: "approved",
    asOf: "2026-05-07T13:25:27Z",
    recommendation:
      "Approve test decision to verify the follow-on-router dispatches resolved routes and surfaces unresolved ones as escalations",
    rationale:
      "Synthetic test decision used to verify the follow-on-router mechanism at 2026-05-07 substrate bring-up. Marc approved via chat-intake 2026-05-07. Follow-on routes: agent:mira:citation-gate, agent:nolan:author-persona-spec. Source: archive/owner-inbox/2026-05-07_scrooge_ceo-decision-record_d-follow-on-router-test.md.",
  },
  {
    decisionId: "D-FAIS-ANALYSIS-V1",
    title: "FAIS Act 37/2002 — Analysis v1 delivered; obligations-register v1.17 updated",
    category: "compliance",
    phase: "approved",
    asOf: "2026-05-12T00:00:00Z",
    recommendation:
      "Approve FAIS Act 37/2002 Analysis v1 delivery for Hoz Securities Limited; five Domain P [citation: TBC] markers resolved with confirmed Act section references; obligations-register bumped to v1.17",
    rationale:
      "Mira (Compliance / RegTech engineer) delivered full statutory analysis of FAIS Act 37 of 2002 sourced from original Government Gazette verbatim text. Five Domain P rows updated with confirmed section references (s.7(1), s.8(1), s.16(1), s.16(2), s.18, s.15(1)). GCC sub-section references remain [TEXT NOT RETRIEVED] — manual ratification at licence-application gate by Imani + external counsel. FSP licence (Categories I + II) necessity confirmed (D-FSP-LICENCE-NECESSITY). Source: archive/owner-inbox/2026-05-12_mira_fais-act-analysis-v1.md.",
  },
  {
    decisionId: "D-WS-JS-NUMBER-RECONCILIATION",
    title:
      "WS-JS-NUMBER-RECONCILIATION — Joint Standard 1/2024 → Joint Standard 2/2024 rename across Domain CY; obligations-register v1.15",
    category: "compliance",
    phase: "approved",
    asOf: "2026-05-10T00:00:00Z",
    recommendation:
      "Approve register correction: rename every obligations-register reference from Joint Standard 1 of 2024 to Joint Standard 2 of 2024 across Domain CY rows (ORG-CY-01–05), Domain F (ORG-GV-17), Domain Q (ORG-BNK-CYBER-CONS), Domain O (two rows), entity-scope vocabulary, and Domain N URN-slug; register bumped to v1.15",
    rationale:
      "The cybersecurity-and-cyber-resilience Joint Standard is JS 2 of 2024 (commenced 1 June 2025). The register had cited 'Joint Standard 1 of 2024' for cybersecurity since v1.0; JS 1 of 2024 is Outsourcing by Insurers (insurer-only). Mis-citation identified during the PA publications survey (v1.14). Standing register-curator mandate under Zara (CCO). Filed as CeoDecision event of record per events-first authoring. Source: archive/owner-inbox/2026-05-10_mira_ws-js-number-reconciliation.md.",
  },
  {
    decisionId: "D-EVENT-VIEW-BOUNDARY-WIRE",
    title:
      "Event/view boundary wiring — reversal-then-reval atomicity (Slice B.1): every position-day either carries one FxPositionRevalued event or none",
    category: "engineering",
    phase: "approved",
    asOf: "2026-05-21T00:00:00Z",
    recommendation:
      "Approve Slice B.1 boundary discipline: reversal-then-reval pair is atomic — every position-day either carries one FxPositionRevalued event (live or stale-mark) or none; Bea's posting engine never reverses without a paired forward; OfficialMarkAdopted emitted via adoptFxMark; recon:mtm-reversal-paired-with-reval asserts per-position-day pairing",
    rationale:
      "The daily MTM handler (Rohan) and SARB-fixing-ingester cite D-EVENT-VIEW-BOUNDARY-WIRE as the governing boundary discipline for event/view separation in the mark-to-market pipeline. The decision establishes the atomicity invariant that protects Bea's posting engine from orphan reversals. Referenced in archive/owner-inbox/2026-05-21_rohan_daily-mtm.md, 2026-05-22_rohan_daily-mtm.md, and prototype/platform/market-data/sarb-fixing-ingester.ts.",
  },
  {
    decisionId: "D-SAMOS-NON-CLEARING",
    title:
      "Bank is not a direct SAMOS clearing / settlement participant — indirect model via SAMOS-sponsor bank",
    category: "governance",
    phase: "approved",
    asOf: "2026-05-07T00:00:00Z",
    recommendation:
      "Approve: the bank does not become a direct SAMOS settlement participant; ZAR-denominated cash flows clear via a SAMOS-sponsor bank under the indirect participant model; the bank instructs ZAR settlement via the sponsor",
    rationale:
      "Direct CEO directive (Marc, chat-intake 2026-05-07). Capital-light, operationally lean, sponsor-routed model consistent with the FX correspondent decision (D-FX-CLS-MEMBERSHIP). Extends the indirect/sponsor-routed pattern: same third-party-risk governance, same legal pattern, same cyber due diligence. Licence-type implications (s.16 vs alternative licence with indirect SAMOS) routed to Mira + Imani + Saskia for confirmation. Concentration-risk question (same entity for both SAMOS sponsor and FX correspondent) flagged to Devon. Source: archive/owner-inbox/2026-05-07_ceo-decision_samos-non-clearing.md.",
  },
  {
    decisionId: "D-BANK-NAME-FALLBACK",
    title:
      "Bank name fallback candidates (Lucet, Noeta, Synaps) pre-cleared in parallel with Hoz s.22 clearance process",
    category: "governance",
    phase: "approved",
    asOf: "2026-05-09T00:00:00Z",
    recommendation:
      "Approve pre-clearing fallback name candidates (Lucet, Noeta, Synaps) in parallel with the primary Hoz Banks Act s.22 clearance process; counsel's plan must name the fallback path for any s.22 concern the PA raises that counsel's opinion did not anticipate",
    rationale:
      "Contingency discipline: the s.22 deceptive-similarity test is broader than visual-form similarity (also phonetic, conceptual, market-positioning). If PA raises a s.22 concern, a named fallback set allows immediate re-engagement without fresh brand research. Three candidates from Linnea (v2 shortlist) pre-cleared in parallel. Source: archive/owner-inbox/2026-05-09_imani_hoz-banks-act-s22-scoping.md + archive/owner-inbox/2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md. Owen's governance-cycle-prep (2026-05-14) records this decision as approved 2026-05-09.",
  },
  {
    decisionId: "D-PARTY-REGISTER-CORRECTION",
    title: "D-PARTY-REGISTER correction — retract the 'closes 10 of 14 F-032 gaps' prediction",
    category: "engineering",
    phase: "approved",
    asOf: "2026-05-11T04:42:00Z",
    recommendation:
      "Approve modification: retract the claim from D-PARTY-REGISTER that the Party substrate closes 10 of 14 outstanding F-032 event-type registry-coverage gaps; all other clauses of D-PARTY-REGISTER stand unchanged",
    rationale:
      "PR 1 of D-PARTY-REGISTER (scrooge#203, merged 2026-05-11T04:41:29Z) revealed that the 14 outstanding F-032 gaps are unrelated readiness-snapshot events (RiskRunCompleted, AuditCommitteePackPrepped, etc.) emitted by other agents. Party adds net-new event types never previously appended, so the F-032 count stays at 14, not 4. Substrate work in PR 1 is correct. Marc chose emit-correction-event over inline-correction-note per Principle 1 (retract by event, not silent markdown edit). Source: archive/owner-inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md.",
  },
  {
    decisionId: "D-PARTY-RELATIONSHIP-KINDS-V0",
    title: "Closed v0 enum of Party relationship kinds — typed graph edges between Parties",
    category: "engineering",
    phase: "approved",
    asOf: "2026-05-11T04:16:09Z",
    recommendation:
      "Approve the v0 closed enum of Party relationship kinds grouped by semantics; new relationship kinds beyond v0 require a follow-up CEO decision because each encodes regulatory semantics and citation requirements",
    rationale:
      "Marc approved as the relationship-kind layer of the unified Party event family. 20+ relationship kinds across five semantic groups: Authority/representation (acts-on-behalf-of, signatory-of, authorised-trader-for, key-individual-of, employee-of, contractor-of); Governance/control (director-of, ubo-of); Service/commercial (sponsor-bank-for, correspondent-bank-for, intermediary-for, external-counsel-to, auditor-of, intra-group-counterparty-of); Org structure (parent-of); Workforce/oversight (reports-to, subject-to-oversight-of); Personal network / PEP-relevant (spouse-of, parent-of-natural, business-associate-of). Authority chains: Companies Act 71/2008 s.69, FIC Act 38/2001 s.21B, FAIS Act 37/2002, Banks Act 94/1990. Source: archive/owner-inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md.",
  },

  // -----------------------------------------------------------------------
  // DEFERRED — explicitly sequenced as future work
  // -----------------------------------------------------------------------
  {
    decisionId: "D-RUNTIME-LANGUAGE",
    title: "Runtime language for licence-day — Bun vs Node evaluation deferred to M8 cloud-lift",
    category: "engineering",
    phase: "deferred",
    asOf: "2026-05-07T00:00:00Z",
    recommendation:
      "Defer runtime language (Bun vs Node) evaluation to the M8 cloud-lift stage; use Bun through the build phase; decision must be made before the first Container App deploy",
    rationale:
      "Atlas's engineering-platform appropriateness assessment (2026-05-07) flagged D-RUNTIME-LANGUAGE as one of three upcoming decisions warranting attention. Bun is the build-phase runtime (fast iteration, native TS, native SQLite) and is appropriate through build phase. The Bun vs Node choice is a multi-year commitment that should be evaluated at M8 with the Container App target architecture in view. No SARB-regulated precedent for Bun exists; evaluation before first cloud deploy is required. Source: archive/owner-inbox/2026-05-07_atlas_engineering-platform-appropriateness.md.",
  },
  {
    decisionId: "D-CI-GITHUB-PLAN-UPGRADE-DEFER",
    title:
      "GitHub plan upgrade for branch-protection enforcement — deferred; agent discipline holds the line",
    category: "engineering",
    phase: "deferred",
    asOf: "2026-05-10T00:00:00Z",
    recommendation:
      "Defer GitHub plan upgrade; agent discipline holds branch-protection operating posture until upgrade lands; resurfaces at regulator-readiness gate, internal-audit prep, substrate-quality drift, or repo-visibility shift",
    rationale:
      "Marc: 'Defer but remember need to upgrade' (chat-intake 2026-05-10). Trigger: Vera's CI-gate-integrity finding (PR #103). Substrate-fix half (four failing CI gates) executing as D-CI-GATE-INTEGRITY. Deferral is acceptable in build phase provided agent-discipline holds. Operating rule: agents must NOT merge a red-CI PR. Upgrade is non-negotiable at licence-day (Principle 4 enforcement layer). Re-litigation triggers: (1) regulator-readiness gate; (2) audit-plan prep; (3) agent-discipline drift; (4) repo-visibility shift. Source: archive/owner-inbox/2026-05-10_scrooge_ceo-decision-record_d-ci-github-plan-upgrade-defer.md.",
  },

  // -----------------------------------------------------------------------
  // WITHDRAWN — never intended as formal decisions (false positives or
  //             hypothetical placeholders)
  // -----------------------------------------------------------------------
  {
    decisionId: "D-RT-LR-GV",
    title:
      "Risk taxonomy — RT-LR.GV level-2 node for legal-side governance risk (withdrawn — hypothetical only)",
    category: "governance",
    phase: "withdrawn",
    asOf: "2026-05-11T00:00:00Z",
    recommendation:
      "Withdraw — this ID was mentioned as a hypothetical placeholder in Owen's policy-frontmatter taxonomy backfill; no formal decision brief was ever filed",
    rationale:
      "Owen's policy-frontmatter taxonomy-backfill (2026-05-11) noted 'if Helena wants the distinction, a D-RT-LR-GV CeoDecision could add it' — a rhetorical placeholder for a potential future decision, not a formal request. No taxonomy change was made (v1 substitutes RT-LR into RT-ST.GV). The body-text scanner created a spurious placeholder event. Withdrawing to clear the register. Source: archive/owner-inbox/2026-05-11_owen_policy-frontmatter-taxonomy-backfill.md.",
  },
  {
    decisionId: "D-SIB",
    title:
      "D-SIB — false positive: abbreviation for Domestic Systemically Important Bank classification (withdrawn)",
    category: "compliance",
    phase: "withdrawn",
    asOf: "2026-05-16T00:00:00Z",
    recommendation:
      "Withdraw — the string 'D-SIB' in the Mira WS-INSTRUMENT-ANALYSES citation-TBC-resolution file is an abbreviation for 'Domestic Systemically Important Bank' (a PA regulatory classification), not a CEO decision ID",
    rationale:
      "In archive/owner-inbox/2026-05-16_mira_ws-instrument-analyses-citation-tbc-resolution-run1.md the text 'non-D-SIB maximum 25% of eligible capital; D-SIB limits by counterparty type' refers to the PA's Domestic Systemically Important Bank (D-SIB) concentration-limit framework under D3-2022 Annexure 1. The body-text scanner captured 'D-SIB' as a candidate decision ID — false positive. No decision brief for D-SIB exists; the bank's D-SIB designation status is a regulatory classification question, not a CEO decision record. Withdrawing.",
  },
];

async function main(): Promise<void> {
  const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
  const terminalIds = new Set(register.resolved.map((r) => r.decisionId));
  // Track which IDs already have a `requested` event so we can emit one first
  // for IDs that go straight to a terminal phase. This satisfies the
  // `recon:decision-symmetry` gate (every closed decision needs a requested
  // opener in its phase chain). These archive files are not in actioned/, so
  // backfill-all-decisions.ts doesn't body-scan them and never emits the opener.
  const hasRequestedEvent = new Set<string>();
  for (const [id, history] of register.byId.entries()) {
    if (history.events.some((e) => e.phase === "requested")) {
      hasRequestedEvent.add(id);
    }
  }

  let emitted = 0;
  let skipped = 0;

  for (const entry of WAVE2_ENTRIES) {
    if (terminalIds.has(entry.decisionId)) {
      console.log(`SKIP  ${entry.decisionId} — already resolved`);
      skipped++;
      continue;
    }

    const sharedInput = {
      decisionId: entry.decisionId,
      authority: "CEO" as const,
      authorityRef: "marc@tgv.co.za",
      title: entry.title,
      category: entry.category,
      recommendation: entry.recommendation,
      rationale: entry.rationale,
      sourceDocHashes: [] as string[],
      citations: [] as string[],
      recordedVia: "backfill:ghost-decisions-wave2" as const,
    };

    // Emit a `requested` opener if none exists, so decision-symmetry is satisfied.
    if (!hasRequestedEvent.has(entry.decisionId)) {
      requestDecision(sharedInput, entry.asOf);
      console.log(`EMIT  ${entry.decisionId} → requested @ ${entry.asOf} (opener)`);
      emitted++;
    }

    recordDecision({ ...sharedInput, phase: entry.phase }, entry.asOf);

    console.log(`EMIT  ${entry.decisionId} → ${entry.phase} @ ${entry.asOf}`);
    emitted++;
  }

  console.log(`\nDone: ${emitted} emitted, ${skipped} skipped.`);

  // Verify no wave-2 entries remain open.
  const updated = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
  const stillOpen = updated.open.filter((r) =>
    WAVE2_ENTRIES.some((e) => e.decisionId === r.decisionId),
  );
  if (stillOpen.length > 0) {
    console.error(`\nWARN: ${stillOpen.length} wave-2 entry/entries still open after backfill:`);
    for (const r of stillOpen) console.error(`  ${r.decisionId}`);
  } else {
    console.log("Verified: all wave-2 entries are closed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
