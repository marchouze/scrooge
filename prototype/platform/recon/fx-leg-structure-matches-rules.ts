// platform/recon/fx-leg-structure-matches-rules.ts
//
// gate: recon:fx-leg-structure-matches-rules
//
// ROOT-CAUSE DRIFT GATE for the FX lifecycle leg-structure DECLARATION
// (`v2-core/posting-rules/fx-lifecycle-leg-structure.ts`) — the hand-mirror of
// the FX posting rules that the NPA "Accounting / CFO perspective" tab renders.
//
// WHY THIS GATE EXISTS
// --------------------
// The declaration `FX_RULE_STAGE_LEG_STRUCTURES` states, per FX posting rule,
// the ordered Dr/Cr legs by ACCOUNT ROLE. It is a HAND-MIRROR of the pure rule
// functions `postFx*Legs` (fx.ts / fx-settlement.ts) — and, until this gate, it
// had NO automated check that it actually agreed with them. That is exactly why
// it DRIFTED: when D-FX-TRADE-DATE-FVTPL-OBS (#1534) replaced the trade-date
// gross-up (Dr receivable / Cr payable) with the off-balance-sheet memorandum
// model, the rule function changed but the declaration kept asserting the OLD
// legs — so the NPA Accounting tab silently showed a model the bank no longer
// books. (D-AGENT-DOMAIN-COMPETENCE: lessons-to-gates.)
//
// WHAT IT ASSERTS
// ---------------
// For every (postingRuleId, stage) entry in the declaration, this gate DRIVES
// the ACTUAL pure rule function over a representative payload, extracts the real
// leg set the function emits — each leg's concrete CoA account code + Dr/Cr — and
// CLASSIFIES each code back to its account ROLE (via the same `resolveFxAccountRole`
// resolver the declaration + the page use). It then asserts the declaration's
// ordered (role, drCr) sequence MATCHES the function's ordered (role, drCr)
// sequence EXACTLY — same length, same roles, same directions, same order.
//
// Comparison is at the ROLE level (not the raw code) so it is currency-invariant:
// the declaration is currency-parametric (a role resolves to a per-currency code
// at render time) and a single FX agreement necessarily spans two currencies, so
// the bought-leg nostro and the sold-leg nostro are DIFFERENT codes but the SAME
// role. The brief permits matching on `accountRole/accountCode` — role is the
// faithful, currency-robust axis.
//
// Fail-closed on ANY divergence: a missing declared rule, an extra declared rule,
// a wrong account role, a wrong Dr/Cr direction, a wrong leg count, or a wrong
// leg order — each is a FAIL. The declaration can no longer silently drift from
// the rules.
//
// The settlement rule (PR-FX-SETTLE-V2) settles BOTH movements in one function
// call, but the declaration splits it into the Payment (b, sold/pay movement) and
// Receipt (c, bought/receive movement) stages; the swap near/far legs are the pay
// and receive movements respectively. The driver isolates the relevant movement
// subset per (ruleId, stage), so the comparison is exact per declared stage.
//
// Severity: FAIL (ENFORCING). Wired into `bun run ci` (domain suite).
//
// Store-independent: the assertion is over the declaration + the pure rule
// functions + the CoA — all source-of-truth, no DB needed.
//
// Authority: D-FX-TRADE-DATE-FVTPL-OBS; D-FX-PNL-FCY-EXPOSURE-REVALUATION;
//   D-V2-UI-OVERSIGHT-STANDARD; D-NPA-PAGE-DE-INVENTION; D-AGENT-DOMAIN-COMPETENCE;
//   D-ENGINEERING-INTEGRITY-CHARTER (cmd 2 fail-closed, cmd 3 lessons-to-gates).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  filInstrumentAmendedPayloadSchema,
  filInstrumentCreatedPayloadSchema,
} from "../../v2-core/fil-instances/events";
import {
  type FxPostingLeg,
  postFxInitialRecognitionLegs,
  postFxObsCommitmentReleaseLegs,
  postFxRevaluationLegs,
} from "../../v2-core/posting-rules/fx";
import {
  FX_RULE_STAGE_LEG_STRUCTURES,
  type FxAccountRole,
  type FxLifecycleStageId,
  resolveFxAccountRole,
} from "../../v2-core/posting-rules/fx-lifecycle-leg-structure";
import {
  type FxConversionInput,
  type FxSettlementInput,
  postFxConversionLegs,
  postFxDerecognitionLegs,
  postFxFvociReclassLegs,
  postFxNdfFixingLegs,
  postFxSettlementLegs,
  postFxSwapFarLegLegs,
  postFxSwapNearLegLegs,
} from "../../v2-core/posting-rules/fx-settlement";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-leg-structure-matches-rules";

// ---------------------------------------------------------------------------
// Representative payload context — a coherent USD/ZAR FX agreement. The bank
// BUYS USD and SELLS ZAR (long). Currencies are the two distinct legs an FX
// agreement requires; the comparison is at the ROLE level so the specific
// currencies do not matter beyond yielding a valid, two-currency trade.
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = "tenant:za-bank";
const INSTANCE = `fil:inst:${ENTITY}:fx-leg-structure-probe`;
const TYPE = "fil:type:fx:spot:otc-vanilla@1.0";
const AS_OF = "2026-02-01T00:00:00.000Z";
const POSTING_DATE = AS_OF.slice(0, 10);
const ORIGINATING = { eventType: "FxTradeExecuted", eventId: "ev-fx-leg-structure-probe" } as const;
const NOTIONAL = "1000";
const BOUGHT_CURRENCY = "USD";
const SOLD_CURRENCY = "ZAR";

const CREATED = filInstrumentCreatedPayloadSchema.parse({
  kind: "FilInstrumentCreated",
  instance: INSTANCE,
  type: TYPE,
  tenant: TENANT,
  asOf: AS_OF,
  originatingEvent: ORIGINATING,
  initialStage: "active",
  economicTerms: {
    assetClass: "fx",
    notional: { currency: SOLD_CURRENCY, amount: NOTIONAL },
    direction: "long",
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    nettingSetId: "NS-probe-ZAR",
    currency: SOLD_CURRENCY,
    settlementDate: POSTING_DATE,
    hedgingSetTag: `${BOUGHT_CURRENCY}/${SOLD_CURRENCY}`,
    fxAgreement: {
      buy: { currency: BOUGHT_CURRENCY, amount: NOTIONAL },
      sell: { currency: SOLD_CURRENCY, amount: NOTIONAL },
    },
  },
});

const AMENDED = filInstrumentAmendedPayloadSchema.parse({
  kind: "FilInstrumentAmended",
  instance: INSTANCE,
  type: TYPE,
  tenant: TENANT,
  asOf: AS_OF,
  originatingEvent: ORIGINATING,
  amendmentVia: "FxPositionRevalued",
  economicTerms: {
    assetClass: "fx",
    notional: { currency: SOLD_CURRENCY, amount: NOTIONAL },
    direction: "long",
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    nettingSetId: "NS-probe-ZAR",
    currency: SOLD_CURRENCY,
    settlementDate: POSTING_DATE,
    hedgingSetTag: `${BOUGHT_CURRENCY}/${SOLD_CURRENCY}`,
    fxAgreement: {
      buy: { currency: BOUGHT_CURRENCY, amount: NOTIONAL },
      sell: { currency: SOLD_CURRENCY, amount: NOTIONAL },
    },
    // A non-zero delta so the reval rule posts the real (non-memo) legs.
    fairValueDeltaSinceLastMeasurement: { currency: SOLD_CURRENCY, amount: "50" },
  },
});

const SETTLEMENT_INPUT: FxSettlementInput = {
  instanceId: INSTANCE,
  tenantId: TENANT,
  postingDate: POSTING_DATE,
  boughtCurrency: BOUGHT_CURRENCY,
  boughtBookedAmount: NOTIONAL,
  boughtSettledAmount: NOTIONAL,
  soldCurrency: SOLD_CURRENCY,
  soldBookedAmount: NOTIONAL,
  soldSettledAmount: NOTIONAL,
};

const CONVERSION_INPUT: FxConversionInput = {
  instanceId: INSTANCE,
  tenantId: TENANT,
  postingDate: POSTING_DATE,
  fcyCurrency: BOUGHT_CURRENCY,
  reportingCurrency: SOLD_CURRENCY,
  fcyAmount: NOTIONAL,
  // Non-zero realised + non-zero accumulated unrealised so BOTH pairs fire.
  zarProceeds: "1100",
  zarCostBasis: NOTIONAL,
  accumulatedUnrealised: "50",
};

// ---------------------------------------------------------------------------
// Inverse resolver — concrete CoA code → account role. Built from the SAME
// `resolveFxAccountRole` the declaration + page use, over the two representative
// currencies (bought + sold), so every code a rule function can emit in this
// context classifies back to exactly one role. Fail-closed: a code with no role
// is an UNCLASSIFIABLE leg — the rule emitted an account the declaration's role
// vocabulary cannot express, which is itself drift.
// ---------------------------------------------------------------------------

const ALL_ROLES: readonly FxAccountRole[] = [
  "receivable",
  "payable",
  "unrealised-pnl",
  "realised-pnl",
  "oci-reserve",
  "nostro",
  "settlement-clearing",
  "obs-bought-commitment",
  "obs-sold-commitment",
  "obs-commitment-contra",
];

function buildCodeToRole(): ReadonlyMap<string, FxAccountRole> {
  const map = new Map<string, FxAccountRole>();
  for (const ccy of [BOUGHT_CURRENCY, SOLD_CURRENCY]) {
    for (const role of ALL_ROLES) {
      const code = resolveFxAccountRole(role, ccy);
      const existing = map.get(code);
      // A code must classify to a SINGLE role. The FX role→code resolver is
      // injective per role family (nostro per ccy, OBS/clearing/oci named
      // constants, receivable/payable/pnl per ccy), so a collision would mean two
      // distinct roles share a code — which would make the inverse classification
      // ambiguous. The currency-agnostic named-constant roles (oci/clearing/obs)
      // map to the same code across currencies (that is fine — same role); a
      // cross-ROLE collision is a setup defect surfaced as a violation at run().
      if (existing !== undefined && existing !== role) {
        // Record the collision under a sentinel so run() can surface it.
        map.set(`__collision__${code}`, role);
      }
      if (existing === undefined) map.set(code, role);
    }
  }
  return map;
}

const CODE_TO_ROLE = buildCodeToRole();

// ---------------------------------------------------------------------------
// Per-(ruleId, stage) ACTUAL leg producer. Drives the real pure rule function
// and returns the leg subset that the declaration's (ruleId, stage) entry mirrors.
// Settlement is split into the pay (sold) movement → stage b and the receive
// (bought) movement → stage c; swap near = pay movement, swap far = receive.
// ---------------------------------------------------------------------------

type StageKey = `${string}::${FxLifecycleStageId}`;

function key(ruleId: string, stage: FxLifecycleStageId): StageKey {
  return `${ruleId}::${stage}`;
}

/** Settlement pay movement = the legs whose nostro is the SOLD currency. */
function payMovement(legs: readonly FxPostingLeg[]): FxPostingLeg[] {
  // The pay movement is the sold-currency cash leg + its clearing contra. The
  // sold-currency nostro identifies it.
  const soldNostro = resolveFxAccountRole("nostro", SOLD_CURRENCY);
  return legs.filter((l) => l.accountCode === soldNostro || isPayClearing(legs, l));
}

/** Settlement receive movement = the legs whose nostro is the BOUGHT currency. */
function receiveMovement(legs: readonly FxPostingLeg[]): FxPostingLeg[] {
  const boughtNostro = resolveFxAccountRole("nostro", BOUGHT_CURRENCY);
  return legs.filter((l) => l.accountCode === boughtNostro || isReceiveClearing(legs, l));
}

const CLEARING_CODE = resolveFxAccountRole("settlement-clearing", SOLD_CURRENCY);

// The clearing legs are tied to their movement by DIRECTION: the receive movement
// is Dr cash / Cr clearing; the pay movement is Cr cash / Dr clearing. So the
// receive clearing leg is the credit-clearing one, the pay clearing leg is the
// debit-clearing one.
function isReceiveClearing(_legs: readonly FxPostingLeg[], l: FxPostingLeg): boolean {
  return l.accountCode === CLEARING_CODE && l.creditDebit === "credit";
}
function isPayClearing(_legs: readonly FxPostingLeg[], l: FxPostingLeg): boolean {
  return l.accountCode === CLEARING_CODE && l.creditDebit === "debit";
}

/**
 * Build the map of (ruleId, stage) → actual emitted leg subset, by DRIVING the
 * real pure rule functions. This is the single source of truth the declaration
 * is asserted against.
 */
function buildActualLegsByStage(): ReadonlyMap<StageKey, readonly FxPostingLeg[]> {
  const m = new Map<StageKey, readonly FxPostingLeg[]>();

  // a · Initiation — OBS memorandum.
  m.set(key("PR-FX-001-V2", "a"), postFxInitialRecognitionLegs(CREATED));

  // revaluation — FVTPL delta.
  m.set(key("PR-FX-REVAL-V2", "revaluation"), postFxRevaluationLegs(AMENDED));

  // b · Payment — settlement pay (sold) movement + swap near leg (pay).
  const settle = postFxSettlementLegs(SETTLEMENT_INPUT);
  m.set(key("PR-FX-SETTLE-V2", "b"), payMovement(settle));
  m.set(key("PR-FX-SWAP-NEAR-V2", "b"), payMovement(postFxSwapNearLegLegs(SETTLEMENT_INPUT)));

  // c · Receipt — settlement receive (bought) movement + swap far leg (receive)
  // + NDF cash-settled fixing.
  m.set(key("PR-FX-SETTLE-V2", "c"), receiveMovement(settle));
  m.set(key("PR-FX-SWAP-FAR-V2", "c"), receiveMovement(postFxSwapFarLegLegs(SETTLEMENT_INPUT)));
  m.set(
    key("PR-FX-NDF-FIX-V2", "c"),
    postFxNdfFixingLegs({
      instanceId: INSTANCE,
      tenantId: TENANT,
      postingDate: POSTING_DATE,
      settlementCurrency: SOLD_CURRENCY,
      netCashDifference: "50",
    }),
  );

  // d · Termination — derecognition reversal + FVOCI reclass + OBS release.
  m.set(
    key("PR-FX-CLOSE-V2", "d"),
    postFxDerecognitionLegs({
      instanceId: INSTANCE,
      tenantId: TENANT,
      postingDate: POSTING_DATE,
      currency: SOLD_CURRENCY,
      accumulatedUnrealised: "50",
    }),
  );
  m.set(
    key("PR-FX-FVOCI-RECLASS-V2", "d"),
    postFxFvociReclassLegs({
      instanceId: INSTANCE,
      tenantId: TENANT,
      postingDate: POSTING_DATE,
      currency: SOLD_CURRENCY,
      accumulatedOci: "50",
    }),
  );
  m.set(
    key("PR-FX-OBS-RELEASE-V2", "d"),
    postFxObsCommitmentReleaseLegs(postFxInitialRecognitionLegs(CREATED), {
      instance: INSTANCE,
      tenant: TENANT,
      asOf: AS_OF,
    }),
  );

  // realisation — FCY→ZAR conversion.
  m.set(key("PR-FX-CONVERT-V2", "realisation"), postFxConversionLegs(CONVERSION_INPUT));

  return m;
}

// ---------------------------------------------------------------------------
// Assertion.
// ---------------------------------------------------------------------------

/** A leg reduced to its comparable identity: (role, direction). */
interface RoleLeg {
  readonly role: FxAccountRole;
  readonly drCr: "debit" | "credit";
}

function fmt(legs: readonly RoleLeg[]): string {
  return legs.map((l) => `${l.drCr === "debit" ? "Dr" : "Cr"}:${l.role}`).join(", ");
}

/** One (rule, stage) declaration entry reduced to what the gate compares. */
export interface DeclaredStageEntry {
  readonly postingRuleId: string;
  readonly stage: FxLifecycleStageId;
  readonly legs: readonly RoleLeg[];
}

/**
 * The pure assertion core: compare a declaration (list of (rule, stage) entries
 * each with its ordered (role, drCr) legs) against the actual driven legs. Pure +
 * injectable so the negative test can feed a MUTATED declaration and prove the
 * gate bites. The default `run()` passes the REAL declaration.
 */
export function assertDeclarationMatchesRules(
  declared: readonly DeclaredStageEntry[],
  actualByStage: ReadonlyMap<StageKey, readonly FxPostingLeg[]>,
  codeToRole: ReadonlyMap<string, FxAccountRole>,
): ReconViolation[] {
  const violations: ReconViolation[] = [];
  const declaredKeys = new Set<StageKey>();

  // Surface any cross-role code collision the inverse resolver hit (setup defect).
  for (const k of codeToRole.keys()) {
    if (k.startsWith("__collision__")) {
      violations.push({
        subject: `inverse-resolver:${k.replace("__collision__", "")}`,
        severity: "fail",
        message: `account code "${k.replace("__collision__", "")}" classifies to MORE THAN ONE FX account role — the inverse code→role resolver is ambiguous; the leg-structure role vocabulary or the account resolver has drifted.`,
      });
    }
  }

  for (const decl of declared) {
    const k = key(decl.postingRuleId, decl.stage);
    declaredKeys.add(k);

    const actualLegs = actualByStage.get(k);
    if (actualLegs === undefined) {
      violations.push({
        subject: `${decl.postingRuleId}:${decl.stage}:no-driver`,
        severity: "fail",
        message: `the declaration names posting rule "${decl.postingRuleId}" at stage "${decl.stage}", but the drift gate has NO driver that produces the actual legs for it — every declared (rule, stage) must be driven from a real pure rule function (the declaration cannot assert a firing the gate cannot verify).`,
      });
      continue;
    }

    // Reduce both sides to (role, drCr). The declared side is already role-level.
    const declaredRoleLegs: readonly RoleLeg[] = decl.legs;
    const actualRoleLegs: RoleLeg[] = [];
    let unclassifiable = false;
    for (const leg of actualLegs) {
      const role = codeToRole.get(leg.accountCode);
      if (role === undefined) {
        unclassifiable = true;
        violations.push({
          subject: `${decl.postingRuleId}:${decl.stage}:unclassifiable:${leg.accountCode}`,
          severity: "fail",
          message: `posting rule "${decl.postingRuleId}" emits a leg on account "${leg.accountCode}" that the leg-structure role vocabulary cannot classify — the rule posts to an account the declaration has no role for (the declaration cannot mirror it).`,
        });
        continue;
      }
      actualRoleLegs.push({ role, drCr: leg.creditDebit });
    }
    if (unclassifiable) continue;

    if (declaredRoleLegs.length !== actualRoleLegs.length) {
      violations.push({
        subject: `${decl.postingRuleId}:${decl.stage}:leg-count`,
        severity: "fail",
        message: `leg count mismatch for "${decl.postingRuleId}" at stage "${decl.stage}": declaration has ${declaredRoleLegs.length} legs [${fmt(declaredRoleLegs)}] but the rule function emits ${actualRoleLegs.length} [${fmt(actualRoleLegs)}] — the declaration has drifted from the rule.`,
      });
      continue;
    }

    for (let i = 0; i < declaredRoleLegs.length; i++) {
      const d = declaredRoleLegs[i];
      const a = actualRoleLegs[i];
      if (d === undefined || a === undefined) continue; // lengths equal — guarded above.
      if (d.role !== a.role || d.drCr !== a.drCr) {
        violations.push({
          subject: `${decl.postingRuleId}:${decl.stage}:leg-${i}`,
          severity: "fail",
          message: `leg ${i} mismatch for "${decl.postingRuleId}" at stage "${decl.stage}": declaration says ${d.drCr} ${d.role}, but the rule function emits ${a.drCr} ${a.role} — the declaration has drifted from the rule (full declared [${fmt(declaredRoleLegs)}] vs actual [${fmt(actualRoleLegs)}]).`,
        });
      }
    }
  }

  // Reverse direction: every driven (ruleId, stage) MUST be declared. A rule the
  // gate can drive but the declaration omits is a silent gap on the NPA page.
  for (const k of actualByStage.keys()) {
    if (!declaredKeys.has(k)) {
      const [ruleId, stage] = k.split("::");
      violations.push({
        subject: `${ruleId}:${stage}:undeclared`,
        severity: "fail",
        message: `the rule function for "${ruleId}" at stage "${stage}" emits legs, but the leg-structure declaration does NOT include it — the NPA Accounting perspective would silently omit this firing.`,
      });
    }
  }

  return violations;
}

/** The real declaration reduced to the gate's comparison shape. */
function realDeclaration(): readonly DeclaredStageEntry[] {
  return FX_RULE_STAGE_LEG_STRUCTURES.map((s) => ({
    postingRuleId: s.postingRuleId,
    stage: s.stage,
    legs: s.legs.map((l) => ({ role: l.accountRole, drCr: l.drCr })),
  }));
}

export interface RunResult extends ReconResult {}

export function run(): RunResult {
  const base = emptyResult(PIPELINE);
  const declared = realDeclaration();
  const actualByStage = buildActualLegsByStage();
  const violations = assertDeclarationMatchesRules(declared, actualByStage, CODE_TO_ROLE);
  // One assertion per declared (rule, stage) + one per driven (rule, stage).
  const asserted = declared.length + actualByStage.size;
  return {
    ...base,
    asserted,
    violations,
    ok: violations.every((v) => v.severity !== "fail"),
  };
}

/** Exposed for the negative test: the actual driven legs + inverse resolver. */
export function actualLegsForTest(): {
  actualByStage: ReadonlyMap<StageKey, readonly FxPostingLeg[]>;
  codeToRole: ReadonlyMap<string, FxAccountRole>;
  realDeclaration: readonly DeclaredStageEntry[];
} {
  return {
    actualByStage: buildActualLegsByStage(),
    codeToRole: CODE_TO_ROLE,
    realDeclaration: realDeclaration(),
  };
}

export default run;

// CLI entrypoint
if (import.meta.main) {
  const r = run();
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  console.log(
    JSON.stringify({
      level: failCount === 0 ? "info" : "error",
      pipeline: r.pipeline,
      ok: r.ok,
      asserted: r.asserted,
      violations: r.violations.length,
      msg:
        failCount === 0
          ? "fx-leg-structure-matches-rules: ok — every declared FX leg structure matches the pure rule function it mirrors"
          : "fx-leg-structure-matches-rules: FAILED — the FX leg-structure declaration has drifted from the posting rules it mirrors",
      details: r.violations.map((v) => `[${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`),
    }),
  );
  if (!r.ok) process.exit(1);
}
