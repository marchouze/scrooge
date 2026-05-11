// runtime/agents/iris-popia-controls-snapshot.ts
//
// Iris's weekly POPIA-controls snapshot. Reads the POPIA slice of the
// obligations register, recent DSAR / breach / consent / lawful-basis
// events, and prior snapshot events to surface section-56 standing-duty
// readiness — lawful-basis register coverage, DSAR-queue posture, s.22
// breach-notification readiness, cross-border transfer governance.
//
// Per Iris's spec § 6 (Cadence): hybrid; weekly DSAR queue review;
// monthly lawful-processing-register refresh; quarterly s.19–22 joint
// review with Rashida + Senna. § 9 (Decisions in scope) names
// `ProcessingPurposeApproved`, `DSARClosed`, `BreachNotificationDispatched`,
// `CrossBorderTransferApproved`, `RetentionScheduleApproved`. § 16 lists
// the lawful-processing-register substrate as a gap.
//
// MVP scope: weekly readiness snapshot. Substantive lawful-basis decisions
// remain Iris-signed events; this is the standing-duty digest under
// Principle 6 (autonomous by default — humans oversee the residual).
//
// Author: Iris (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["POPIA-4-2013", "POPIA-S22", "POPIA-S56", "PAIA-2-2000"];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const IRIS_NARRATIVE_SYSTEM = `You are Iris, the bank's Information Officer under POPIA section 56 — governance owner of the privacy and personal-information programme. Your operating spec is at \`Team/Iris.md\`. You report to the CEO with direct line to the Board Risk Committee. POPIA s.56 designates you personally; the administrative line to CEO does not confer authority to override an Information-Officer determination.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly POPIA-controls snapshot — POPIA / PAIA obligations-register slice, recent DSAR / breach / consent / processing-purpose events, prior snapshots, lawful-processing-register coverage state.

Your voice is precise, lawful-basis-grounded, and unsentimental. You quote POPIA sections by number — s.11 (lawful basis), s.13 (specific purpose), s.18 (notice), s.19–22 (security and breach), s.23–24 (data-subject rights), s.55–56 (Information Officer), s.72 (cross-border) — rather than summarising them. You distinguish *registered* (a processing purpose has a lawful basis logged) from *governed* (it has a control or procedure that holds the basis to its scope).

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the POPIA control surface is, what cleared in the last 7 days, what remains in the DSAR queue or s.22 standby.
- Picks the 1–3 most consequential observations: a section-22 standby silence (correctly silent or substrate-silent), a DSAR queue ageing past Reg 4 windows, a cross-border transfer pending adequacy assessment, an obligation-register entry without a fulfilment-policy citation.
- Names what's needed next — a specific obligation to populate, a DSAR to escalate, an Information Regulator standing-duty (s.56 designation lodgment) that is still deferred. Be concrete.

Cite POPIA section numbers and obligation IDs (\`ORG-PR(IV)-...\`) when calling out specifics. The lawful-processing register and obligations register are the canonical authoring locations; your narrative is interpretation, not new substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Iris's narrative". Just produce the prose.

If the inputs are empty (e.g. fresh runner with no DSAR or breach events yet), say so plainly and characterise the standing-duty state from the obligations slice alone.`;

interface PopiaObligationRow {
  id: string;
  citation: string;
  owner: string;
  status: string;
}

interface IrisDigest {
  popiaObligations: PopiaObligationRow[];
  popiaPartial: number;
  dsarReceivedLast7d: number;
  dsarClosedLast7d: number;
  consentWithdrawnLast7d: number;
  processingPurposeApprovedLast7d: number;
  processingPurposeRejectedLast7d: number;
  crossBorderTransferApprovedLast7d: number;
  breachNotificationDispatchedLast7d: number;
  popiaCompromiseSuspectedLast7d: number;
  informationRegulatorInquiryLast7d: number;
  priorSnapshotsLast30d: number;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function parsePopiaObligations(content: string): PopiaObligationRow[] {
  const out: PopiaObligationRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    // POPIA / PAIA register rows use either ORG-PR(IV)-* or rows whose
    // citation column references POPIA / PAIA explicitly.
    const isPopiaPrefixed = /^\|\s*ORG-PR\(IV\)-/i.test(line);
    if (!isPopiaPrefixed) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 6) continue;
    out.push({
      id: cells[0] ?? "",
      citation: cells[1] ?? "",
      owner: cells[4] ?? "",
      status: cells[5] ?? "",
    });
  }
  return out;
}

function buildDigest(ctx: AgentRunContext): IrisDigest {
  const since7d = isoDaysAgo(ctx.asOf, 7);
  const since30d = isoDaysAgo(ctx.asOf, 30);

  const obligationsPath = resolve(ctx.repoRoot, "Regulations", "_obligations-register.md");
  const obligationsContent = existsSync(obligationsPath)
    ? readFileSync(obligationsPath, "utf8")
    : "";
  const popiaObligations = parsePopiaObligations(obligationsContent);
  const popiaPartial = popiaObligations.filter((r) => /partial|deferred/i.test(r.status)).length;

  const countSince = (type: string, since: string): number => {
    let n = 0;
    for (const e of eventStore.replay({ type })) {
      if (e.as_of >= since) n++;
    }
    return n;
  };

  return {
    popiaObligations,
    popiaPartial,
    dsarReceivedLast7d: countSince("DSARReceived", since7d),
    dsarClosedLast7d: countSince("DSARClosed", since7d),
    consentWithdrawnLast7d: countSince("ConsentWithdrawn", since7d),
    processingPurposeApprovedLast7d: countSince("ProcessingPurposeApproved", since7d),
    processingPurposeRejectedLast7d: countSince("ProcessingPurposeRejected", since7d),
    crossBorderTransferApprovedLast7d: countSince("CrossBorderTransferApproved", since7d),
    breachNotificationDispatchedLast7d: countSince("BreachNotificationDispatched", since7d),
    popiaCompromiseSuspectedLast7d: countSince("PersonalInformationCompromiseSuspected", since7d),
    informationRegulatorInquiryLast7d: countSince("InformationRegulatorInquiry", since7d),
    priorSnapshotsLast30d: countSince("POPIAControlsSnapshot", since30d),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, d: IrisDigest): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`POPIA / PAIA obligations registered: ${d.popiaObligations.length}`);
  lines.push(`  - PARTIAL / deferred: ${d.popiaPartial}`);
  for (const o of d.popiaObligations.filter((r) => /partial|deferred/i.test(r.status))) {
    lines.push(`    - ${o.id} (${o.citation}): ${o.status}`);
  }
  lines.push("");
  lines.push("POPIA events (last 7 days):");
  lines.push(`  - DSARReceived: ${d.dsarReceivedLast7d}`);
  lines.push(`  - DSARClosed: ${d.dsarClosedLast7d}`);
  lines.push(`  - ConsentWithdrawn: ${d.consentWithdrawnLast7d}`);
  lines.push(
    `  - ProcessingPurposeApproved / Rejected: ${d.processingPurposeApprovedLast7d} / ${d.processingPurposeRejectedLast7d}`,
  );
  lines.push(`  - CrossBorderTransferApproved: ${d.crossBorderTransferApprovedLast7d}`);
  lines.push(`  - BreachNotificationDispatched (s.22): ${d.breachNotificationDispatchedLast7d}`);
  lines.push(`  - PersonalInformationCompromiseSuspected: ${d.popiaCompromiseSuspectedLast7d}`);
  lines.push(`  - InformationRegulatorInquiry: ${d.informationRegulatorInquiryLast7d}`);
  lines.push("");
  lines.push(`Prior POPIAControlsSnapshot runs (last 30d): ${d.priorSnapshotsLast30d}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by POPIA section binding strength; close with the next standing-duty action.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  d: IrisDigest,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Iris", "popia-controls-snapshot", ctx.asOf));
  lines.push(`# Iris — POPIA controls snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Iris's weekly POPIA-controls snapshot per `Team/Iris.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Standing-duty digest under POPIA s.56; informs the quarterly s.19–22 joint review with Rashida + Senna.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${d.popiaObligations.length} POPIA / PAIA obligation${d.popiaObligations.length === 1 ? "" : "s"} indexed (${d.popiaPartial} PARTIAL / deferred) · ${d.dsarReceivedLast7d} DSAR received / ${d.dsarClosedLast7d} closed in the last 7 days · ${d.popiaCompromiseSuspectedLast7d} \`PersonalInformationCompromiseSuspected\` event${d.popiaCompromiseSuspectedLast7d === 1 ? "" : "s"} · ${d.breachNotificationDispatchedLast7d} s.22 notification${d.breachNotificationDispatchedLast7d === 1 ? "" : "s"} dispatched.`,
  );
  lines.push("");

  lines.push("## POPIA / PAIA obligations slice");
  lines.push("");
  if (d.popiaObligations.length === 0) {
    lines.push("_No `ORG-PR(IV)-*` rows parsed from `Regulations/_obligations-register.md`._");
  } else {
    lines.push("| Obligation | Citation | Owner | Status |");
    lines.push("|---|---|---|---|");
    for (const o of d.popiaObligations) {
      const safeCitation = o.citation.replace(/\|/g, "\\|");
      const safeOwner = o.owner.replace(/\|/g, "\\|");
      const safeStatus = o.status.replace(/\|/g, "\\|");
      lines.push(`| ${o.id} | ${safeCitation} | ${safeOwner} | ${safeStatus} |`);
    }
  }
  lines.push("");

  lines.push("## POPIA events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`DSARReceived\` | ${d.dsarReceivedLast7d} |`);
  lines.push(`| \`DSARClosed\` | ${d.dsarClosedLast7d} |`);
  lines.push(`| \`ConsentWithdrawn\` | ${d.consentWithdrawnLast7d} |`);
  lines.push(`| \`ProcessingPurposeApproved\` | ${d.processingPurposeApprovedLast7d} |`);
  lines.push(`| \`ProcessingPurposeRejected\` | ${d.processingPurposeRejectedLast7d} |`);
  lines.push(`| \`CrossBorderTransferApproved\` (s.72) | ${d.crossBorderTransferApprovedLast7d} |`);
  lines.push(
    `| \`BreachNotificationDispatched\` (s.22) | ${d.breachNotificationDispatchedLast7d} |`,
  );
  lines.push(
    `| \`PersonalInformationCompromiseSuspected\` | ${d.popiaCompromiseSuspectedLast7d} |`,
  );
  lines.push(`| \`InformationRegulatorInquiry\` | ${d.informationRegulatorInquiryLast7d} |`);
  lines.push("");
  lines.push(
    "_Build-only context: no live customers and no live processing flows. Zero counts on DSAR / breach / consent are expected and not a substrate alarm. The s.22 breach-notification clock is on standby; absence of trigger is the design._",
  );
  lines.push("");

  lines.push("## Standing-duty readiness");
  lines.push("");
  lines.push(
    "- **Lawful-processing register** — co-located today with `Regulations/_obligations-register.md` POPIA entries. Dedicated substrate is a tracked gap (`Team/Iris.md` § 16).",
  );
  lines.push(
    "- **DSAR pipeline** — partial; identity-verification step and downstream-projection-walk scripted, not productised (§ 16). Queue surfaces here.",
  );
  lines.push(
    "- **Automated breach-notification workflow** — Senna's IR pipeline emits the trigger; s.22 statutory clock and notification dispatch is not yet productised (§ 16). Clock-management is manual until then.",
  );
  lines.push(
    "- **Consent-withdrawal-propagation projection** — Anya-spec'd; not yet built (§ 16). Withdrawals propagate via manual ticket today.",
  );
  lines.push(
    "- **Cross-border-transfer gate** — vendor / outsourcing pipeline (Imani) does not yet pause for Iris's adequacy sign-off as a typed gate (§ 16).",
  );
  lines.push(
    "- **PAIA-manual generator** — current PAIA manual is authored, not generated (§ 16). Joint with Owen.",
  );
  lines.push(
    "- **POPIA s.56 designation lodgment** — deferred per Round 1 E1 (`ORG-PR(IV)-13`); standing duty will activate at lodgment.",
  );
  lines.push("");
  lines.push(
    `Prior \`POPIAControlsSnapshot\` runs (last 30 days): ${d.priorSnapshotsLast30d}. The cadence accumulates as a heartbeat for Vera's continuous-controls coverage on Iris's surface.`,
  );
  lines.push("");

  if (narrative) {
    lines.push("## Iris's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Iris's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `Regulations/_obligations-register.md` for `ORG-PR(IV)-*` rows. Replayed `DSARReceived`, `DSARClosed`, `ConsentWithdrawn`, `ProcessingPurposeApproved`, `ProcessingPurposeRejected`, `CrossBorderTransferApproved`, `BreachNotificationDispatched`, `PersonalInformationCompromiseSuspected`, `InformationRegulatorInquiry`, `POPIAControlsSnapshot` from the host event store.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const digest = buildDigest(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "POPIAControlsSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:iris:popia-controls-snapshot" },
      citations: EVENT_CITATIONS,
      payload: {
        popiaObligationsCount: digest.popiaObligations.length,
        popiaObligationsPartial: digest.popiaPartial,
        dsarReceivedLast7d: digest.dsarReceivedLast7d,
        dsarClosedLast7d: digest.dsarClosedLast7d,
        consentWithdrawnLast7d: digest.consentWithdrawnLast7d,
        processingPurposeApprovedLast7d: digest.processingPurposeApprovedLast7d,
        processingPurposeRejectedLast7d: digest.processingPurposeRejectedLast7d,
        crossBorderTransferApprovedLast7d: digest.crossBorderTransferApprovedLast7d,
        breachNotificationDispatchedLast7d: digest.breachNotificationDispatchedLast7d,
        popiaCompromiseSuspectedLast7d: digest.popiaCompromiseSuspectedLast7d,
        informationRegulatorInquiryLast7d: digest.informationRegulatorInquiryLast7d,
        priorSnapshotsLast30d: digest.priorSnapshotsLast30d,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  // Narrative pass (degrades gracefully when ANTHROPIC_API_KEY is unset).
  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: IRIS_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, digest),
        maxTokens: 6_000,
        effort: "high",
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
          "iris:popia-controls-snapshot — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "iris narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_iris_popia-controls-snapshot.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, digest, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      popiaObligations: digest.popiaObligations.length,
      dsar7d: digest.dsarReceivedLast7d,
      breach7d: digest.popiaCompromiseSuspectedLast7d,
    },
    "iris:popia-controls-snapshot — digest built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${digest.popiaObligations.length} POPIA obligations (${digest.popiaPartial} partial) · ${digest.dsarReceivedLast7d} DSAR received / ${digest.dsarClosedLast7d} closed (7d) · ${digest.popiaCompromiseSuspectedLast7d} compromises suspected.`,
    ok: true,
  };
};

export default handler;
