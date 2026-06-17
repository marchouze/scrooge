/**
 * _v2-data.js — shared data client for the clean /api/v2/* layer.
 *
 * Standing UI guidance (D-V2-UI-OVERSIGHT-STANDARD): every V2 data surface
 * fetches through here so provenance is consistent and explicit:
 *   - the current Prod / +Sim toggle (getProvenance() from _v2-shell.js) is
 *     sent as ?provenance=…; the endpoint counts only matching events;
 *   - the response carries pageProvenance, which we repaint onto the badge so
 *     the watermark always matches what the human is viewing;
 *   - toggling Prod / +Sim re-runs the page's loader (v2:provenance-changed).
 */

/** Fetch a /api/v2/* endpoint with the active provenance mode applied. */
// biome-ignore lint/correctness/noUnusedVariables: global API used by inline page scripts
async function v2Fetch(path) {
  const mode = typeof getProvenance === "function" ? getProvenance() : "prod";
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}provenance=${encodeURIComponent(mode)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  const body = await res.json();
  if (body && body.pageProvenance !== undefined) v2RepaintBadge(body.pageProvenance);
  return body;
}

/**
 * Repaint the provenance badge to match a response's pageProvenance filter.
 *
 * The shared provenance-badge.js auto-mounts on DOMContentLoaded by fetching
 * the page's data-provenance-source WITHOUT the toggle's ?provenance param, so
 * its paint can race ours and win (it resolves later on detail pages, whose own
 * fetch is small/fast). We must stay authoritative: a MutationObserver
 * re-asserts the toggle-correct mode if anything repaints the badge to a
 * different mode. Re-asserting our own mode is a no-op (terminates the loop).
 */
let v2DesiredProvenance = null;
let v2BadgeObserving = false;

function v2RepaintBadge(pageProvenance) {
  if (!window.provenanceBadge) return;
  const marker = document.querySelector("[data-provenance-badge]");
  if (!marker) return;
  v2DesiredProvenance = pageProvenance;
  window.provenanceBadge.mount(marker, { filter: pageProvenance });

  if (!v2BadgeObserving && typeof MutationObserver === "function") {
    v2BadgeObserving = true;
    const observer = new MutationObserver(() => {
      const desiredMode = v2DesiredProvenance?.mode;
      if (!desiredMode) return;
      const badge = marker.querySelector(".provenance-badge");
      if (badge && badge.getAttribute("data-mode") !== desiredMode) {
        window.provenanceBadge.mount(marker, { filter: v2DesiredProvenance });
      }
    });
    observer.observe(marker, { childList: true, subtree: true });
  }
}

/**
 * Wire a page loader: run it once now, and again whenever the provenance
 * toggle changes. `loader` is an async function that fetches + renders.
 */
// biome-ignore lint/correctness/noUnusedVariables: global API used by inline page scripts
function v2WireLoader(loader) {
  const run = () => {
    Promise.resolve(loader()).catch((err) => {
      console.warn("[v2-data] loader failed", err);
    });
  };
  document.addEventListener("v2:provenance-changed", run);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}

/**
 * Render an explicit failure state into a container — never a silent blank.
 * (The dedicated Errors / Decision-Required surface is a later slice; until
 * then a failed data source is surfaced inline.)
 */
// biome-ignore lint/correctness/noUnusedVariables: global API used by inline page scripts
function v2RenderError(container, message) {
  const el = document.createElement("div");
  el.className = "v2-empty";
  el.innerHTML = `<div class="v2-empty-icon">⚠</div><div class="v2-empty-msg">Could not load data — ${message}</div>`;
  container.appendChild(el);
}

/** Escape a value for safe insertion into innerHTML cells. */
// biome-ignore lint/correctness/noUnusedVariables: global API used by inline page scripts
function v2Esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
