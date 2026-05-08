// runtime/agents/mira-m1-regulator-citation-urns.ts
//
// Mira's M1 regulator-citation-URN registration handler.
//
// Authority:
//   - CEO decision D-MARKETS-SCHEMA-FOUNDATION (approved 2026-05-07).
//   - Brief: `Team Inbox/2026-05-07_brief_mira_m1-regulator-citation-urns.md`.
//   - Source proposal: `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §8 (URN set) + §14 ("To Mira: populate the obligations register with the URNs in §8").
//   - `Team/Mira.md` §3 (mandate: obligations-register curator under Zara) ·
//     §11 (registers maintained: `Regulations/_obligations-register.md`).
//
// Trigger kind: event-driven. Subscribes to `CeoDecision`. Processes only
// the triggering events whose `decisionId === "D-MARKETS-SCHEMA-FOUNDATION"`
// and `action === "approve"`; everything else is a no-op (the trigger is
// shared across the CeoDecision fan-out and other handlers — Anya's
// projection-refresh, Scrooge's follow-on-router — already consume it).
//
// What this handler does:
//   1. Holds the canonical M1 URN catalogue (the §8 set + the brief's
//      tranche extensions: market-infrastructure / OTC anchors / accounting
//      / prudential / operational+cyber / AML+privacy / reporting).
//   2. For each URN, emits a typed `ObligationRegistered` event carrying
//      the URN, the regulator-instrument citation, the upstream source
//      (decision-record event id), Mira's confidence flag, and the
//      downstream consumer hint (the policy / procedure / system-capability
//      that will read this URN at M-phase milestones).
//   3. Idempotent: replays the store and skips URNs that have already been
//      registered (matches by deterministic `obligationUrn`). Re-running
//      the handler after a partial failure is safe.
//   4. Emits one summary `M1CitationTrancheRegistered` event covering the
//      run as a whole — count of URNs registered, count skipped,
//      authoring decision id.
//   5. Writes an Owner Inbox completion deliverable per the brief's "Owner
//      Inbox deliverable on completion" requirement.
//
// What this handler does NOT do (deferred per brief "Out of scope"):
//   - Procedure-side citations — those land per-procedure as Owen + domain
//     leads write each procedure under Principle 6's downward chain.
//   - Policy-side citations — those land in the policy register against
//     each policy.
//   - URN-to-consumer reconciliation — the brief asks that "every URN
//     reconciles to at least one downstream consumer within 1 sprint of
//     M2 starting"; that reconciliation is a Vera Wave-4 audit pipeline
//     (M2-phase deliverable), not part of M1 registration.
//
// Author: Mira (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

// ---------------------------------------------------------------------------
// Citations.
//
// Every event this handler emits carries Principle-2 anchors: the
// obligations-register curator mandate (ORG-FC-01 = RMCP s.42), the
// canonical-source-registry control (Owen 2026-05-07), and the
// CLAUDE.md Principle-2 anchor itself. Each `ObligationRegistered`
// additionally carries the URN it is registering — so the event chain
// is self-citing.
// ---------------------------------------------------------------------------
const BASE_CITATIONS = [
  "P2-CITATION-DISCIPLINE",
  "ORG-FC-01", // RMCP under FIC Act s.42 — the source of Mira's mandate
  "GOV-FRAMEWORK-CEO-RESERVED",
] as const;

// ---------------------------------------------------------------------------
// URN catalogue — M1 tranches.
//
// Source: brief §"URN tranches required at M1" (lines 16–23) and proposal
// §8 (table of regulator-citation surface). Every entry below references
// real, published material — no invented citations.
//
// Each URN is a typed entry: `regulator + instrument + section + as-of date`.
// The `urn` field is the canonical citation key callable from
// `@platform/citation/`. The `consumers` field names the downstream
// procedures / system capabilities that will read this URN at M-phase
// milestones (per the brief's "consumers" requirement).
// ---------------------------------------------------------------------------

interface RegulatorCitationUrn {
  /** Canonical citation key. Matches the registry under `@platform/citation/`. */
  readonly urn: string;
  /** Tranche this URN belongs to. */
  readonly tranche:
    | "market-infrastructure"
    | "otc-derivatives-anchors"
    | "accounting"
    | "prudential"
    | "operational-cyber"
    | "aml-privacy"
    | "reporting";
  /** Regulator / standards body. */
  readonly regulator: string;
  /** Instrument name (Act, regulation, standard). */
  readonly instrument: string;
  /** Section / clause within the instrument. */
  readonly section: string;
  /** Effective / as-of date of the cited version. ISO 8601 date or year. */
  readonly asOfDate: string;
  /** Verification status: "verified" once Mira has hand-cited from the published instrument; "draft" if pending verification. */
  readonly confidence: "verified" | "draft";
  /** Downstream consumers (procedures, system capabilities, policies) that will read this URN. */
  readonly consumers: readonly string[];
  /** M-phase that first consumes this URN (per proposal §10 build sequence). */
  readonly firstConsumedAt: "M1" | "M2" | "M3" | "M4" | "M5";
  /** Existing obligations-register entry id, if this URN extends one already on the register. Null if this URN is net-new. */
  readonly registerEntryId: string | null;
}

const M1_URN_CATALOGUE: readonly RegulatorCitationUrn[] = [
  // -------------------------------------------------------------------------
  // Market infrastructure — South Africa listed venues + STT.
  // -------------------------------------------------------------------------
  {
    urn: "JSE-EQUITIES-RULES-2024",
    tranche: "market-infrastructure",
    regulator: "JSE Limited",
    instrument: "JSE Equities Rules and Directives",
    section: "Rules + Directives (consolidated)",
    asOfDate: "2024-01-01",
    confidence: "verified",
    consumers: [
      "@platform/markets/cdm (M1 equities listed-cash)",
      "Procedures/by-policy/counterparty-onboarding-markets.md (planned)",
      "Procedures/by-policy/best-execution.md (planned, markets bundle)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-MK-01",
  },
  {
    urn: "JSE-LISTINGS-REQUIREMENTS-2024",
    tranche: "market-infrastructure",
    regulator: "JSE Limited",
    instrument: "JSE Listings Requirements",
    section: "Service Issue (consolidated)",
    asOfDate: "2024-01-01",
    confidence: "verified",
    consumers: [
      "Insider Trading / PA Dealing Policy",
      "@platform/markets/cdm (M1 corporate-action events)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-MK-05",
  },
  {
    urn: "FMA-19-2012",
    tranche: "market-infrastructure",
    regulator: "Republic of South Africa",
    instrument: "Financial Markets Act 19 of 2012",
    section: "Chapter X (market abuse) + s.5 (OTC derivatives) + s.6A (ODP authorisation)",
    asOfDate: "2012-11-09",
    confidence: "verified",
    consumers: [
      "Market Abuse / Surveillance Policy",
      "ODP Authorisation Policy (planned, markets bundle)",
      "Procedures/by-policy/surveillance-alert-triage.md (planned)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-MK-01",
  },
  {
    urn: "FSCA-CONDUCT-STANDARD-MARKET-CONDUCT",
    tranche: "market-infrastructure",
    regulator: "FSCA",
    instrument: "FSCA Conduct Standards on market conduct + market abuse",
    section:
      "Conduct Standards 1–3 of 2018 (OTC derivative providers); market-abuse regulations under FMA Ch. X",
    asOfDate: "2018-02-09",
    confidence: "verified",
    consumers: [
      "Best Execution Policy (planned)",
      "Market Abuse / Surveillance Policy",
      "@platform/markets/cdm (Mira surveillance projection §7)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-MK-02",
  },
  {
    urn: "STT-ACT-25-2007",
    tranche: "market-infrastructure",
    regulator: "Republic of South Africa (SARS)",
    instrument: "Securities Transfer Tax Act 25 of 2007",
    section: "Sections 2 + 3 (charging provision; rate)",
    asOfDate: "2007-12-21",
    confidence: "verified",
    consumers: [
      "Tax Policy",
      "@platform/markets/cdm (M1 equity-trade settlement event)",
      "Procedures/by-policy/stt-settlement.md (planned)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: null,
  },

  // -------------------------------------------------------------------------
  // OTC derivatives anchors — forward-load for M3.
  //
  // ISDA / ICMA documentation is private contractual material; the
  // citations here name the document family and version. The clause
  // library (Imani) is the per-clause home; the obligations register
  // anchors the document family.
  // -------------------------------------------------------------------------
  {
    urn: "ISDA-MASTER-2002",
    tranche: "otc-derivatives-anchors",
    regulator: "ISDA",
    instrument: "ISDA Master Agreement (2002 form)",
    section: "Sections 1–14 (full master)",
    asOfDate: "2002-01-08",
    confidence: "verified",
    consumers: [
      "Counterparty Onboarding Policy (planned)",
      "Imani clause library (`@platform/legal-as-code/`)",
      "@platform/markets/cdm (M3 OTC IRS Collateral primitive)",
    ],
    firstConsumedAt: "M3",
    registerEntryId: "ORG-MK-06",
  },
  {
    urn: "ISDA-CSA-NY-LAW-1994",
    tranche: "otc-derivatives-anchors",
    regulator: "ISDA",
    instrument: "ISDA Credit Support Annex (NY Law)",
    section: "Paragraphs 1–13 (1994 form)",
    asOfDate: "1994-01-01",
    confidence: "verified",
    consumers: [
      "Collateral Management Policy",
      "Margin Policy",
      "@platform/markets/cdm (M3 CSA primitive)",
    ],
    firstConsumedAt: "M3",
    registerEntryId: "ORG-MK-06",
  },
  {
    urn: "ISDA-CSA-ENGLISH-LAW-1995",
    tranche: "otc-derivatives-anchors",
    regulator: "ISDA",
    instrument: "ISDA Credit Support Annex (English Law — Transfer)",
    section: "Paragraphs 1–11 (1995 form, as updated)",
    asOfDate: "1995-01-01",
    confidence: "verified",
    consumers: [
      "Collateral Management Policy",
      "Margin Policy",
      "@platform/markets/cdm (M3 CSA primitive)",
    ],
    firstConsumedAt: "M3",
    registerEntryId: "ORG-MK-06",
  },
  {
    urn: "ICMA-GMRA-2011-SA-SCHEDULE",
    tranche: "otc-derivatives-anchors",
    regulator: "ICMA",
    instrument: "Global Master Repurchase Agreement 2011 (with South African schedule)",
    section: "Paragraphs 1–20 + SA-jurisdiction schedule",
    asOfDate: "2011-10-01",
    confidence: "verified",
    consumers: [
      "Counterparty Onboarding Policy (planned)",
      "Repo Documentation (Imani clause library)",
      "@platform/markets/cdm (M4 repo primitive)",
    ],
    firstConsumedAt: "M4",
    registerEntryId: "ORG-MK-06",
  },

  // -------------------------------------------------------------------------
  // Accounting — IFRS standards as published by the IFRS Foundation.
  // -------------------------------------------------------------------------
  {
    urn: "IFRS-9-2014",
    tranche: "accounting",
    regulator: "IFRS Foundation (IASB)",
    instrument: "IFRS 9 Financial Instruments",
    section:
      "Classification + Measurement (Ch. 4) + Impairment / ECL (Ch. 5.5) + Hedge Accounting (Ch. 6)",
    asOfDate: "2014-07-24",
    confidence: "verified",
    consumers: [
      "Accounting Policies (IFRS bundle)",
      "@platform/markets/cdm (M1 sub-ledger projection)",
      "Procedures/by-policy/ifrs9-classification.md (planned)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-AC-01",
  },
  {
    urn: "IFRS-13-2011",
    tranche: "accounting",
    regulator: "IFRS Foundation (IASB)",
    instrument: "IFRS 13 Fair Value Measurement",
    section: "Sections 1–99 (full standard)",
    asOfDate: "2011-05-12",
    confidence: "verified",
    consumers: [
      "Accounting Policies (IFRS bundle)",
      "@platform/markets/cdm (M3 MTM lifecycle event)",
      "Valuation Procedure (Rohan, planned)",
    ],
    firstConsumedAt: "M3",
    registerEntryId: "ORG-AC-01",
  },
  {
    urn: "IFRS-7-2005",
    tranche: "accounting",
    regulator: "IFRS Foundation (IASB)",
    instrument: "IFRS 7 Financial Instruments: Disclosures",
    section: "Sections 1–45 (consolidated, with subsequent amendments)",
    asOfDate: "2005-08-18",
    confidence: "verified",
    consumers: [
      "Accounting Policies (IFRS bundle)",
      "Annual Financial Statements generator (Camille + Bea)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-AC-01",
  },
  {
    urn: "IAS-21-1993",
    tranche: "accounting",
    regulator: "IFRS Foundation (IASB)",
    instrument: "IAS 21 The Effects of Changes in Foreign Exchange Rates",
    section: "Sections 1–60 (consolidated, with subsequent amendments)",
    asOfDate: "1993-12-01",
    confidence: "verified",
    consumers: [
      "Accounting Policies (IFRS bundle)",
      "@platform/markets/cdm (M4 FX-swap primitive — Principle 5 multi-currency)",
    ],
    firstConsumedAt: "M4",
    registerEntryId: "ORG-AC-01",
  },
  {
    urn: "IAS-12-1996",
    tranche: "accounting",
    regulator: "IFRS Foundation (IASB)",
    instrument: "IAS 12 Income Taxes",
    section: "Sections 1–99 (consolidated; equity dividends + STT credit treatment)",
    asOfDate: "1996-10-01",
    confidence: "verified",
    consumers: [
      "Tax Policy",
      "Accounting Policies (IFRS bundle)",
      "Procedures/by-policy/deferred-tax-mtm.md (planned)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-AC-01",
  },

  // -------------------------------------------------------------------------
  // Prudential — BCBS standards. Forward-load for M2–M5.
  //
  // BCBS document numbers are stable; their published date is the
  // canonical as-of. SA implementation lands via PA Banks Act
  // Regulations (already cited under ORG-PR-19, etc.).
  // -------------------------------------------------------------------------
  {
    urn: "BCBS-D457-FRTB-2019",
    tranche: "prudential",
    regulator: "Basel Committee on Banking Supervision",
    instrument: "BCBS d457 Minimum capital requirements for market risk (FRTB, revised)",
    section: "Full standard (Standardised Approach + Internal Model Approach)",
    asOfDate: "2019-01-14",
    confidence: "verified",
    consumers: [
      "Market Risk Policy",
      "@platform/markets/cdm (M5 FRTB IMA shadow projection)",
      "Procedures/by-policy/frtb-capital-calc.md (planned)",
    ],
    firstConsumedAt: "M5",
    registerEntryId: "ORG-PR-19",
  },
  {
    urn: "BCBS-D279-SA-CCR-2014",
    tranche: "prudential",
    regulator: "Basel Committee on Banking Supervision",
    instrument:
      "BCBS d279 The standardised approach for measuring counterparty credit risk exposures (SA-CCR)",
    section: "Full standard (effective 1 January 2017)",
    asOfDate: "2014-03-31",
    confidence: "verified",
    consumers: [
      "Counterparty Credit Risk Policy",
      "@platform/markets/cdm (M3 counterparty-exposure projection)",
      "Procedures/by-policy/sa-ccr-calc.md (planned)",
    ],
    firstConsumedAt: "M3",
    registerEntryId: "ORG-PR-16",
  },
  {
    urn: "BCBS-D368-IRRBB-2016",
    tranche: "prudential",
    regulator: "Basel Committee on Banking Supervision",
    instrument: "BCBS d368 Standards on interest rate risk in the banking book (IRRBB)",
    section: "Full standard (12 IRRBB principles + standardised framework)",
    asOfDate: "2016-04-21",
    confidence: "verified",
    consumers: [
      "IRRBB Policy (within RMF)",
      "@platform/markets/cdm (M3 banking-book IRS projection)",
    ],
    firstConsumedAt: "M3",
    registerEntryId: "ORG-PR-11",
  },

  // -------------------------------------------------------------------------
  // Operational + cyber — Joint Standard 1 of 2024, Banks Act Reg 39.
  // -------------------------------------------------------------------------
  {
    urn: "JOINT-STANDARD-1-2024-CYBER",
    tranche: "operational-cyber",
    regulator: "Prudential Authority + FSCA (joint)",
    instrument: "Joint Standard 1 of 2024 — Cybersecurity and Cyber Resilience",
    section:
      "Full standard (governance, risk management, incident response, third-party, cyber-resilience testing)",
    asOfDate: "2024-05-17",
    confidence: "verified",
    consumers: [
      "Information Security Policy (CISO programme)",
      "Cyber Resilience Policy",
      "Procedures/by-policy/cyber-incident-response.md (planned)",
      "@platform/markets/cdm (FIX-gateway threat model — trading-systems estate)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-CY-01",
  },
  {
    urn: "BANKS-ACT-REG-39-OPERATIONAL-RISK",
    tranche: "operational-cyber",
    regulator: "Prudential Authority (SARB)",
    instrument: "Regulations Relating to Banks (under Banks Act 94 of 1990) — Regulation 39",
    section: "Regulation 39 (operational risk management)",
    asOfDate: "2012-12-12",
    confidence: "verified",
    consumers: ["Operational Risk Policy", "Operational Resilience Policy"],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-PR-17",
  },

  // -------------------------------------------------------------------------
  // AML / KYC + privacy.
  // -------------------------------------------------------------------------
  {
    urn: "FIC-ACT-38-2001-S21-S43B",
    tranche: "aml-privacy",
    regulator: "Financial Intelligence Centre",
    instrument: "Financial Intelligence Centre Act 38 of 2001",
    section:
      "Sections 21–43B (CDD, EDD, beneficial ownership, record-keeping, CTR/STR/PAR/TPR, RMCP)",
    asOfDate: "2001-11-28",
    confidence: "verified",
    consumers: [
      "RMCP",
      "KYC / CDD / EDD Policy",
      "AML/CFT Policy",
      "Procedures/by-policy/kyc-onboarding.md",
      "Procedures/by-policy/sanctions-screening.md",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-FC-01",
  },
  {
    urn: "POPIA-S71-AUTOMATED-DECISIONING",
    tranche: "aml-privacy",
    regulator: "Information Regulator",
    instrument: "Protection of Personal Information Act 4 of 2013",
    section: "Section 71 (automated decision-making)",
    asOfDate: "2013-11-26",
    confidence: "verified",
    consumers: [
      "POPIA / Privacy Policy",
      "@platform/markets/cdm (pre-trade-rejection auto-reject path; surveillance auto-flag path)",
      "Procedures/by-policy/automated-decision-review.md (planned)",
    ],
    firstConsumedAt: "M1",
    registerEntryId: "ORG-PR(IV)-01",
  },

  // -------------------------------------------------------------------------
  // Reporting — FATCA / CRS / FSCA conduct templates.
  // -------------------------------------------------------------------------
  {
    urn: "FATCA-IGA-ANNEX-II-SA",
    tranche: "reporting",
    regulator: "US Treasury / IRS + SARS",
    instrument: "FATCA IGA between South Africa and the United States (Annex II)",
    section: "Annex II — exempt and deemed-compliant FFIs; reportable accounts",
    asOfDate: "2014-06-09",
    confidence: "verified",
    consumers: [
      "FATCA / CRS Policy",
      "Procedures/by-policy/fatca-crs-annual-submission.md (planned)",
      "@platform/markets/cdm (counterparty-classification gate at M4)",
    ],
    firstConsumedAt: "M4",
    registerEntryId: "ORG-FC-15",
  },
  {
    urn: "CRS-OECD-2014",
    tranche: "reporting",
    regulator: "OECD + SARS",
    instrument:
      "Common Reporting Standard (Standard for Automatic Exchange of Financial Account Information)",
    section: "Full standard (Sections I–IX) + South African implementation under Tax Admin Act",
    asOfDate: "2014-07-21",
    confidence: "verified",
    consumers: [
      "FATCA / CRS Policy",
      "Procedures/by-policy/fatca-crs-annual-submission.md (planned)",
      "@platform/markets/cdm (counterparty-classification gate at M4)",
    ],
    firstConsumedAt: "M4",
    registerEntryId: "ORG-FC-16",
  },
  {
    urn: "FSCA-CONDUCT-REPORTING-TEMPLATES",
    tranche: "reporting",
    regulator: "FSCA",
    instrument: "FSCA conduct reporting templates (per FSCA Conduct Standards 1–3 of 2018)",
    section: "Reporting templates referenced by Conduct Standards 1–3 of 2018",
    asOfDate: "2018-02-09",
    confidence: "draft",
    consumers: ["Trade Reporting Policy (planned)", "Conduct of Business / TCF Policy"],
    firstConsumedAt: "M3",
    registerEntryId: "ORG-CS2-001",
  },
];

const URN_COUNT = M1_URN_CATALOGUE.length;

// ---------------------------------------------------------------------------
// Idempotency — replay the store, gather already-registered URNs.
// ---------------------------------------------------------------------------

function alreadyRegisteredUrns(): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay()) {
    if (e.type !== "ObligationRegistered") continue;
    const p = e.payload as { obligationUrn?: unknown };
    if (typeof p.obligationUrn === "string") out.add(p.obligationUrn);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Handler.
// ---------------------------------------------------------------------------

interface RegistrationOutcome {
  readonly urn: RegulatorCitationUrn;
  readonly status: "registered" | "skipped-already-registered";
}

const TARGET_DECISION_ID = "D-MARKETS-SCHEMA-FOUNDATION";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const ceoDecisions = triggering.filter((e) => e.type === "CeoDecision");

  // Locate the authorising decision in the triggering set. The handler
  // is event-driven on `CeoDecision`; we register the M1 URN tranche
  // only when the parent decision is the markets-schema-foundation
  // approval. Other CeoDecision events are no-ops (the event-driven
  // fan-out is shared with Anya's projection-refresh / Scrooge's
  // follow-on-router).
  const authorising = ceoDecisions.find((e) => {
    const p = e.payload as { decisionId?: unknown; action?: unknown };
    return p.decisionId === TARGET_DECISION_ID && p.action === "approve";
  });

  if (!authorising) {
    return {
      eventsEmitted: 0,
      summary: `no ${TARGET_DECISION_ID} approval in triggering set; nothing to register`,
      ok: true,
    };
  }

  const alreadyRegistered = alreadyRegisteredUrns();
  const outcomes: RegistrationOutcome[] = [];
  let eventsEmitted = 0;

  for (const urn of M1_URN_CATALOGUE) {
    if (alreadyRegistered.has(urn.urn)) {
      outcomes.push({ urn, status: "skipped-already-registered" });
      continue;
    }

    if (!ctx.dryRun) {
      eventStore.append({
        event_id: newEventId(),
        type: "ObligationRegistered",
        as_of: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:mira:m1-regulator-citation-urns" },
        // The URN itself is in the citations array — every
        // ObligationRegistered is self-citing in addition to carrying
        // the base mandate citations.
        citations: [...BASE_CITATIONS, urn.urn],
        payload: {
          obligationUrn: urn.urn,
          tranche: urn.tranche,
          regulator: urn.regulator,
          instrument: urn.instrument,
          section: urn.section,
          asOfDate: urn.asOfDate,
          confidence: urn.confidence,
          consumers: [...urn.consumers],
          firstConsumedAt: urn.firstConsumedAt,
          registerEntryId: urn.registerEntryId,
          authorisingDecisionId: TARGET_DECISION_ID,
          authorisingDecisionEventId: authorising.event_id,
        },
      });
      eventsEmitted++;
    }
    outcomes.push({ urn, status: "registered" });
  }

  // Tranche summary event — one per run, regardless of how many URNs
  // were already registered. Vera's continuous-controls programme reads
  // this stream for register-coverage assurance.
  const registered = outcomes.filter((o) => o.status === "registered").length;
  const skipped = outcomes.filter((o) => o.status === "skipped-already-registered").length;

  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "M1CitationTrancheRegistered",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:mira:m1-regulator-citation-urns" },
      citations: [...BASE_CITATIONS],
      payload: {
        decisionId: TARGET_DECISION_ID,
        decisionEventId: authorising.event_id,
        catalogueSize: URN_COUNT,
        registered,
        skipped,
        tranches: Array.from(new Set(M1_URN_CATALOGUE.map((u) => u.tranche))),
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted++;
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_mira_m1-regulator-citation-urns_completion.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildDeliverable(ctx, outcomes, authorising.event_id),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.info(
    {
      catalogue: URN_COUNT,
      registered,
      skipped,
      decision: TARGET_DECISION_ID,
    },
    "mira:m1-regulator-citation-urns — done",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${URN_COUNT} URN${URN_COUNT === 1 ? "" : "s"} in M1 catalogue · ${registered} registered · ${skipped} already registered.`,
    ok: true,
  };
};

// ---------------------------------------------------------------------------
// Owner Inbox deliverable — completion record per the brief.
// ---------------------------------------------------------------------------

function buildDeliverable(
  ctx: AgentRunContext,
  outcomes: readonly RegistrationOutcome[],
  decisionEventId: string,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Mira", "m1-regulator-citation-urns", ctx.asOf));
  lines.push(`# Mira — M1 regulator-citation URN registration, ${date}`);
  lines.push("");
  lines.push(
    `Event-driven run of Mira's M1 regulator-citation-URN handler under ${TARGET_DECISION_ID}. Subscribes to \`CeoDecision\`; triggered by the markets-schema-foundation approval (decision event \`${decisionEventId.slice(0, 12)}…\`). Registers the URN tranche named in the source proposal §8 + brief §"URN tranches required at M1".`,
  );
  lines.push("");

  const registered = outcomes.filter((o) => o.status === "registered").length;
  const skipped = outcomes.filter((o) => o.status === "skipped-already-registered").length;
  lines.push(
    `**Headline:** ${URN_COUNT} URN${URN_COUNT === 1 ? "" : "s"} in M1 catalogue · ${registered} registered · ${skipped} already registered.`,
  );
  lines.push("");

  // Group by tranche for readability.
  const trancheOrder: RegulatorCitationUrn["tranche"][] = [
    "market-infrastructure",
    "otc-derivatives-anchors",
    "accounting",
    "prudential",
    "operational-cyber",
    "aml-privacy",
    "reporting",
  ];

  for (const tranche of trancheOrder) {
    const trancheOutcomes = outcomes.filter((o) => o.urn.tranche === tranche);
    if (trancheOutcomes.length === 0) continue;
    lines.push(`## Tranche — ${tranche.replace(/-/g, " ")}`);
    lines.push("");
    lines.push("| URN | Instrument | Section | First consumed at | Confidence | Status |");
    lines.push("|---|---|---|---|---|---|");
    for (const o of trancheOutcomes) {
      const safeInstrument = o.urn.instrument.replace(/\|/g, "\\|");
      const safeSection = o.urn.section.replace(/\|/g, "\\|");
      lines.push(
        `| \`${o.urn.urn}\` | ${safeInstrument} | ${safeSection} | ${o.urn.firstConsumedAt} | ${o.urn.confidence} | ${o.status} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Consumer mapping");
  lines.push("");
  lines.push(
    'Each URN is registered with the downstream consumers (procedures, system capabilities, policies) that will read it at the named M-phase. Per the brief: "every URN reconciles to at least one downstream consumer". The reconciliation that *every* URN has a *running* downstream consumer is a Vera Wave-4 audit pipeline (M2-phase deliverable); this run discharges the M1 registration step only.',
  );
  lines.push("");
  for (const o of outcomes) {
    if (o.status !== "registered") continue;
    lines.push(`- \`${o.urn.urn}\` →`);
    for (const c of o.urn.consumers) {
      lines.push(`  - ${c}`);
    }
  }
  lines.push("");

  lines.push("## Gaps flagged");
  lines.push("");
  const draft = outcomes.filter((o) => o.urn.confidence === "draft");
  if (draft.length === 0) {
    lines.push(
      "No draft-confidence URNs in this tranche — every URN was hand-cited from the published instrument before registration.",
    );
  } else {
    lines.push(
      `${draft.length} URN${draft.length === 1 ? " is" : "s are"} flagged \`draft\` — pending verification of section / version against the published source. Mira will re-register at \`verified\` confidence once the source is hand-cited:`,
    );
    lines.push("");
    for (const o of draft) {
      lines.push(`- \`${o.urn.urn}\` — ${o.urn.instrument}`);
    }
  }
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    `Triggered event-driven from \`CeoDecision\` (\`${decisionEventId.slice(0, 12)}…\`) for ${TARGET_DECISION_ID}. Each \`ObligationRegistered\` event carries the URN as a self-citation plus the base mandate chain (\`P2-CITATION-DISCIPLINE\`, \`ORG-FC-01\` for Mira's RMCP curatorship, \`GOV-FRAMEWORK-CEO-RESERVED\`). Idempotent — re-running the handler skips URNs whose \`obligationUrn\` already appears in the event store.`,
  );
  lines.push("");
  return lines.join("\n");
}

// Exported for tests.
export { M1_URN_CATALOGUE, TARGET_DECISION_ID, type RegulatorCitationUrn };

export default handler;
