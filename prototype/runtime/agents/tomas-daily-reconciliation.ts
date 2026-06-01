// runtime/agents/tomas-daily-reconciliation.ts
//
// Tomas's daily three-way reconciliation handler (PROC-PAY-RBH-01).
//
// Runs the trade-leg ↔ payment-leg ↔ ledger-leg three-way reconciliation
// against the event store, emits ReconciliationBreak events for each break
// found, and emits a DailyReconciliationReport summary.
//
// What this handler does:
//   1. Replays SettlementInstructionReceived, PaymentSettled, JournalEntryPosted
//      from the event store up to `asOf`.
//   2. For each trade ID: classifies match vs break (amount / timing / nostro).
//   3. Emits ReconciliationBreak events for each break (via reconciliation.ts).
//   4. Emits DailyReconciliationReport summary event.
//   5. Writes an Owner Inbox deliverable.
//
// Authority:
//   - PROC-PAY-RBH-01 (three-way reconciliation procedure)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - NPS-ACT-78-1998, BANKS-ACT-94-1990, ISO-20022
//
// Author: Tomas (Operations & payments engineer) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { logger } from "../../platform/composition";
import { runThreeWayReconciliation } from "../../platform/payments/reconciliation";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

function buildReportMarkdown(
  ctx: AgentRunContext,
  matchedCount: number,
  breakCount: number,
  breaks: Array<{
    tradeId: string;
    kind: string;
    description: string;
    tradeAmount?: number | undefined;
    paymentAmount?: number | undefined;
    detectedAt: string;
  }>,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Tomas", "daily-reconciliation", ctx.asOf));
  lines.push(`# Tomas — daily three-way reconciliation, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of the three-way reconciliation (PROC-PAY-RBH-01): trade-leg (SettlementInstructionReceived) ↔ payment-leg (PaymentSettled) ↔ ledger-leg (JournalEntryPosted). Events emitted: ReconciliationBreak (per break) + DailyReconciliationReport (summary).",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${matchedCount + breakCount} trade IDs processed · ${matchedCount} matched · ${breakCount} break${breakCount === 1 ? "" : "s"} detected`,
  );
  lines.push("");

  if (breakCount === 0) {
    lines.push("## Result: Clean");
    lines.push("");
    lines.push(
      "_All trade IDs present in the event store have matching payment and ledger legs with consistent amounts. No ReconciliationBreak events emitted._",
    );
    lines.push("");
  } else {
    lines.push(`## Breaks detected (${breakCount})`);
    lines.push("");
    lines.push("| Trade ID | Kind | Description | Trade Amount | Payment Amount |");
    lines.push("|---|---|---|---|---|");
    for (const b of breaks) {
      const tradeAmt = b.tradeAmount !== undefined ? String(b.tradeAmount) : "—";
      const payAmt = b.paymentAmount !== undefined ? String(b.paymentAmount) : "—";
      lines.push(`| \`${b.tradeId}\` | ${b.kind} | ${b.description} | ${tradeAmt} | ${payAmt} |`);
    }
    lines.push("");
    lines.push("**Break classifications:**");
    lines.push(
      "- `timing` — a leg is missing but within 4h of settlement; self-correcting. No manual action required.",
    );
    lines.push(
      "- `amount` — netCash mismatch between settlement instruction and payment settled. Requires investigation with correspondent.",
    );
    lines.push(
      "- `nostro` — payment settled (or settlement date passed) >4h ago but ledger leg missing. GL posting gap; escalate to Bea.",
    );
    lines.push("");
  }

  lines.push("## Build-phase posture");
  lines.push("");
  lines.push(
    "The bank is an indirect payments participant (memory: project_indirect_participant_posture.md). Correspondent bank model — NPS RTGS / BankservAfrica / CLS access is via sponsor banks. Live event flows (SettlementInstructionReceived, PaymentSettled, JournalEntryPosted) activate at licence-day. In build phase, counts reflect synthetic or seeded events only.",
  );
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    `Event store replay up to \`asOf=${ctx.asOf}\` for types: \`SettlementInstructionReceived\`, \`PaymentSettled\`, \`JournalEntryPosted\`. Authority: PROC-PAY-RBH-01, NPS-ACT-78-1998, BANKS-ACT-94-1990, ISO-20022.`,
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const result = runThreeWayReconciliation(ctx.asOf, ctx.dryRun);

  logger.info(
    {
      matchedCount: result.matchedCount,
      breakCount: result.breakCount,
      breakKinds: result.breaks.map((b) => b.kind),
      asOf: ctx.asOf,
      dryRun: ctx.dryRun,
    },
    "tomas:daily-reconciliation — run complete",
  );

  // In dry-run mode, no events are emitted and no file is written.
  // ReconciliationBreak events + DailyReconciliationReport are emitted inside
  // runThreeWayReconciliation when dryRun=false.
  const eventsEmitted = ctx.dryRun ? 0 : result.breakCount + 1; // breaks + 1 DailyReconciliationReport

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_tomas_daily-reconciliation.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, result.matchedCount, result.breakCount, result.breaks),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `three-way recon: ${result.matchedCount + result.breakCount} trade IDs · ${result.matchedCount} matched · ${result.breakCount} break${result.breakCount === 1 ? "" : "s"} (${result.breaks.filter((b) => b.kind === "amount").length} amount, ${result.breaks.filter((b) => b.kind === "timing").length} timing, ${result.breaks.filter((b) => b.kind === "nostro").length} nostro).`,
    ok: true,
  };
};

export default handler;
