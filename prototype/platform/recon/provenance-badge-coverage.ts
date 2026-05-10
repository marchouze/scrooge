// platform/recon/provenance-badge-coverage.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 3 — recon (Vera, owned).
//
// Asserts: every dashboard render path emits a `<ProvenanceBadge>`. The
// badge is *not* a tooltip — per pack §6.1 + §6.3 it sits visibly in the
// page chrome, and silent provenance is a P1 audit-integrity risk.
//
// Scope (per pack §6.3 + Slice 3 dispatch brief):
//   - All `prototype/dashboard/public/**/*.html` files must:
//       1. link the badge stylesheet (`/provenance-badge.css`),
//       2. include the badge script (`/provenance-badge.js`),
//       3. carry at least one explicit `[data-provenance-badge]` marker
//          OR fall through to the runtime auto-mount path. The runtime
//          path is best-effort; this recon insists on the explicit marker
//          so authors don't quietly rely on chrome-injection (which can
//          mis-place the badge if the page chrome differs from the shell).
//
//   - PDF templates (`prototype/reporting/**`) — out of scope today
//     (substrate gap §11; no reporting templates exist yet — Bea+Atlas
//     M2/M3 reporting capability lands these). The recon notes the gap
//     in info severity rather than failing.
//
//   - RMS Correspondence records — out of scope here (Slice 5 graph-walk
//     recon owns cross-reference rules; the badge is a render-layer
//     concern handled by the dashboard register render of Slice 4).
//
// Severity: `fail` for missing badge wiring on a dashboard HTML page;
// `info` for the deferred PDF / Correspondence scopes.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer) on behalf of Vera (Internal audit / continuous-
//   assurance engineer).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:provenance-badge-coverage";

const REQUIRED_CSS = "/provenance-badge.css";
const REQUIRED_JS = "/provenance-badge.js";
const REQUIRED_MARKER = "data-provenance-badge";

/** Walk a directory and yield every `.html` file under it. */
function* walkHtml(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walkHtml(full);
    } else if (st.isFile() && entry.endsWith(".html")) {
      yield full;
    }
  }
}

interface PageCheck {
  readonly path: string;
  readonly hasCss: boolean;
  readonly hasJs: boolean;
  readonly hasMarker: boolean;
}

function checkPage(file: string): PageCheck {
  const content = readFileSync(file, "utf8");
  return {
    path: file,
    hasCss: content.includes(REQUIRED_CSS),
    hasJs: content.includes(REQUIRED_JS),
    hasMarker: content.includes(REQUIRED_MARKER),
  };
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const repoRoot = resolve(import.meta.dir, "..", "..");
  const publicDir = resolve(repoRoot, "dashboard", "public");
  const reportingDir = resolve(repoRoot, "reporting");

  const violations: ReconViolation[] = [];

  // ---------------- Dashboard HTML pages ----------------
  let dashboardChecked = 0;
  for (const file of walkHtml(publicDir)) {
    const check = checkPage(file);
    dashboardChecked += 1;
    const rel = relative(repoRoot, file);
    if (!check.hasCss) {
      violations.push({
        subject: rel,
        message: `missing <link rel="stylesheet" href="${REQUIRED_CSS}"> — badge styles will not load.`,
        severity: "fail",
      });
    }
    if (!check.hasJs) {
      violations.push({
        subject: rel,
        message: `missing <script src="${REQUIRED_JS}"> — badge will not render.`,
        severity: "fail",
      });
    }
    if (!check.hasMarker) {
      violations.push({
        subject: rel,
        message: `missing [${REQUIRED_MARKER}] marker — page relies on chrome auto-injection only; add an explicit <span data-provenance-badge="page-top"> in the page header so the badge placement is intentional, not implicit.`,
        severity: "fail",
      });
    }
  }

  // ---------------- PDF / reporting templates (deferred) ----------------
  if (existsSync(reportingDir)) {
    // Reporting layer exists — assert basic watermark presence on PDF templates
    // would land here. Today the directory does not exist; the info note
    // below records the substrate gap.
    violations.push({
      subject: "prototype/reporting/",
      message:
        "reporting directory present but per-template watermark assertions are not yet implemented — extend this recon when Bea+Atlas M2/M3 reporting templates land.",
      severity: "info",
    });
  } else {
    violations.push({
      subject: "prototype/reporting/ (absent)",
      message:
        "no PDF / reporting templates exist yet — per pack §11 substrate gap. Bea+Atlas M2/M3 reporting capability will introduce templates that this recon must cover at that point.",
      severity: "info",
    });
  }

  result.asserted = dashboardChecked;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    process.stdout.write(
      `${PIPELINE}: ok — asserted ${r.asserted} dashboard HTML page(s) carry the provenance badge wiring\n`,
    );
    for (const v of r.violations) {
      process.stdout.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
    }
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL\n`);
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
