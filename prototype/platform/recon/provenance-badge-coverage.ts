// platform/recon/provenance-badge-coverage.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 3 — recon (Vera, owned).
//
// Asserts: every dashboard page makes an *explicit* declaration about
// the provenance of its content — either it surfaces no data (prose,
// mermaid diagrams, principles viewers, persona-spec render) and
// declares `data-provenance-content="none"`, OR it surfaces data and
// carries a `[data-provenance-badge]` marker so the badge can paint.
// No fallback / silent-default behaviour — each page is either
// explicitly prose or explicitly data-bearing.
//
// Scope (per pack §6.3 + Slice 3 dispatch brief + Marc's per-page
// resolution complaint 2026-05-10):
//   - All `prototype/dashboard/public/**/*.html` files must:
//       1. link the badge stylesheet (`/provenance-badge.css`),
//       2. include the badge script (`/provenance-badge.js`),
//       3. EITHER:
//          a. declare `data-provenance-content="none"` on `<body>` or
//             a wrapper element (prose pages — no badge mounted), OR
//          b. carry at least one explicit `[data-provenance-badge]`
//             marker (data pages — badge mounts, mode resolved per
//             page-scoped endpoint or the env-derived default).
//
//   - Pages that omit BOTH the `none` declaration AND any badge marker
//     fail the recon at `fail` severity. The previous behaviour
//     (chrome auto-injection of a fallback badge) over-painted prose
//     pages with "Simulated data" in build phase — see Marc's
//     2026-05-10 complaint. This recon now insists on an explicit
//     declaration per page; the runtime fallback is preserved as a
//     defence-in-depth backstop but no page should rely on it.
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
//   - Drift between a page's declared mode and the actual lineages of
//     the data it surfaces is a follow-on for Vera (cross-source
//     graph-walk recon, Slice 5 territory).
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
const PROSE_OPT_OUT = 'data-provenance-content="none"';
const PER_PAGE_SOURCE = "data-provenance-source";

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
  readonly hasProseOptOut: boolean;
  readonly hasPerPageSource: boolean;
}

function checkPage(file: string): PageCheck {
  const content = readFileSync(file, "utf8");
  return {
    path: file,
    hasCss: content.includes(REQUIRED_CSS),
    hasJs: content.includes(REQUIRED_JS),
    hasMarker: content.includes(REQUIRED_MARKER),
    hasProseOptOut: content.includes(PROSE_OPT_OUT),
    hasPerPageSource: content.includes(PER_PAGE_SOURCE),
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
    // Per-page resolution rule (post Marc 2026-05-10 complaint): every
    // page must make an EXPLICIT declaration. Either it surfaces no
    // data (`data-provenance-content="none"`) and the badge is
    // suppressed, OR it carries a `[data-provenance-badge]` marker
    // and the badge mounts. Pages that have neither used to silently
    // hit the chrome auto-injection fallback and paint "Simulated
    // data" on every page regardless of content — that's the bug.
    if (!check.hasMarker && !check.hasProseOptOut) {
      violations.push({
        subject: rel,
        message: `page makes no provenance declaration — add EITHER \`${PROSE_OPT_OUT}\` on <body> (prose page, no data → no badge) OR an explicit <span data-provenance-badge="page-top"> in the page header (data page → badge mounts). Silent fallback to chrome injection is no longer permitted.`,
        severity: "fail",
      });
    } else if (check.hasMarker && check.hasProseOptOut) {
      violations.push({
        subject: rel,
        message: `page declares both \`${PROSE_OPT_OUT}\` AND a [${REQUIRED_MARKER}] marker — pick one. The opt-out wins at runtime; the marker is dead markup.`,
        severity: "fail",
      });
    } else if (check.hasMarker && !check.hasPerPageSource) {
      // Data page with a badge marker but no per-page API source
      // declaration. Falls back to /api/provenance/mode (the env-derived
      // global), which is exactly the over-paint behaviour Marc flagged
      // 2026-05-10. Severity is `warn` rather than `fail` while the
      // per-endpoint `pageProvenance` rollout completes — once every
      // page declares a source, tighten to `fail`.
      violations.push({
        subject: rel,
        message: `data page has a [${REQUIRED_MARKER}] marker but no \`${PER_PAGE_SOURCE}\` attribute — the badge will fall back to /api/provenance/mode (the env-derived global), which paints every page the same. Add \`${PER_PAGE_SOURCE}="/api/<endpoint>"\` to the marker so the badge resolves the mode from the page's primary API response (which now returns \`pageProvenance\`).`,
        severity: "warn",
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
