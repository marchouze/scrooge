// runtime/agents/mira-obligations-snapshot.ts
//
// Mira's weekly obligations-register snapshot. Reads the obligations
// register and the regulations index, summarises by status / owner /
// regulator-instrument, and reports regulatory-coverage health.
//
// Per Mira's spec § Cadence: weekly RMCP-monitoring cycle; the
// obligations-register snapshot is a foundational input to that cycle.
//
// MVP scope: count + summarise. V2 will surface deltas vs the previous
// snapshot (gated on the snapshot events accumulating; the host event
// store is enough to track this once we have ≥2 weeks of runs).
//
// Author: Mira (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["FIC-ACT-38-2001", "FAIS-ACT-37-2002", "BANKS-ACT-94-1990"];

interface ObligationRow {
  id: string;
  citation: string;
  requirement: string;
  fulfilmentPolicy: string;
  owner: string;
  status: string;
}

interface RegulationRow {
  instrument: string;
  status: string;
}

function parseObligations(content: string): ObligationRow[] {
  const out: ObligationRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(ORG-[A-Za-z0-9()/-]+)\s*\|/);
    if (!m) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 6) continue;
    out.push({
      id: cells[0] ?? "",
      citation: cells[1] ?? "",
      requirement: cells[2] ?? "",
      fulfilmentPolicy: cells[3] ?? "",
      owner: cells[4] ?? "",
      status: cells[5] ?? "",
    });
  }
  return out;
}

function parseRegulationsIndex(content: string): RegulationRow[] {
  const out: RegulationRow[] = [];
  // Index format: | Instrument | File | Status | Source |
  for (const line of content.split(/\r?\n/)) {
    if (!/^\|/.test(line)) continue;
    if (/^\|\s*-+/.test(line)) continue; // separator
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    const instrument = cells[0] ?? "";
    const status = cells[2] ?? "";
    if (instrument === "" || /^Instrument$/i.test(instrument)) continue;
    out.push({ instrument, status });
  }
  return out;
}

interface Bucket {
  label: string;
  count: number;
}

function countBy<T>(rows: readonly T[], pick: (r: T) => string): Bucket[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = pick(r) || "(unknown)";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  obligations: readonly ObligationRow[],
  regulations: readonly RegulationRow[],
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Mira", "obligations-snapshot", ctx.asOf));
  lines.push(`# Mira — obligations register snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Mira's weekly obligations-register snapshot per `Team/Mira.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Feeds Mira's RMCP-monitoring cycle and Owen's combined-assurance map.",
  );
  lines.push("");

  const populated = regulations.filter((r) => /POPULATED/i.test(r.status)).length;
  lines.push(
    `**Headline:** ${obligations.length} obligation${obligations.length === 1 ? "" : "s"} registered · ${regulations.length} regulator instrument${regulations.length === 1 ? "" : "s"} indexed (${populated} populated).`,
  );
  lines.push("");

  lines.push("## Obligations by status");
  lines.push("");
  const byStatus = countBy(obligations, (o) => o.status);
  if (byStatus.length === 0) {
    lines.push("_No obligation rows parsed._");
  } else {
    lines.push("| Status | Count |");
    lines.push("|---|---|");
    for (const b of byStatus) lines.push(`| ${b.label} | ${b.count} |`);
  }
  lines.push("");

  lines.push("## Obligations by owner");
  lines.push("");
  const byOwner = countBy(obligations, (o) => o.owner);
  if (byOwner.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Owner | Count |");
    lines.push("|---|---|");
    for (const b of byOwner) lines.push(`| ${b.label} | ${b.count} |`);
  }
  lines.push("");

  lines.push("## Regulator instruments by status");
  lines.push("");
  const byRegStatus = countBy(regulations, (r) => r.status.replace(/\*/g, "").trim());
  if (byRegStatus.length === 0) {
    lines.push("_No regulator-instrument rows parsed._");
  } else {
    lines.push("| Status | Count |");
    lines.push("|---|---|");
    for (const b of byRegStatus) lines.push(`| ${b.label} | ${b.count} |`);
  }
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `Regulations/_obligations-register.md` (ORG-* rows) and `Regulations/_index.md` (instrument rows). Counts only — no judgement on individual obligations. Vera's mandate-ownership recon and the prose-duplication recon test the integrity of the register itself.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const obligationsPath = resolve(ctx.repoRoot, "Regulations", "_obligations-register.md");
  const regulationsPath = resolve(ctx.repoRoot, "Regulations", "_index.md");
  const obligations = existsSync(obligationsPath)
    ? parseObligations(readFileSync(obligationsPath, "utf8"))
    : [];
  const regulations = existsSync(regulationsPath)
    ? parseRegulationsIndex(readFileSync(regulationsPath, "utf8"))
    : [];

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "ObligationsRegisterSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:mira:obligations-snapshot" },
      citations: EVENT_CITATIONS,
      payload: {
        obligationsCount: obligations.length,
        regulatorInstrumentsCount: regulations.length,
        regulatorInstrumentsPopulated: regulations.filter((r) => /POPULATED/i.test(r.status)).length,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_mira_obligations-snapshot.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, obligations, regulations),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    { obligations: obligations.length, regulations: regulations.length },
    "mira:obligations-snapshot — counts read",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${obligations.length} obligations · ${regulations.length} regulator instruments.`,
    ok: true,
  };
};

export default handler;
