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
function v2Esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline markdown (escape first): code, bold, italic, links. */
function v2MdInline(text) {
  let s = v2Esc(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) =>
    /^https?:\/\//.test(href)
      ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>`
      : `<span>${label}</span>`,
  );
  return s;
}

/**
 * Render a markdown document body to HTML for the V2 document viewers.
 * Compact subset: front-matter strip, headings, hr, blockquote, fenced code,
 * GFM tables, ordered/unordered lists, paragraphs + inline. The body is the
 * authored governance source — rendered verbatim (escaped).
 */
// biome-ignore lint/correctness/noUnusedVariables: global API used by inline page scripts
function v2Markdown(src) {
  let text = String(src ?? "");
  // Strip a leading YAML front-matter block.
  text = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  let para = [];
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(v2MdInline).join("<br>")}</p>`);
      para = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara();
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(`<pre class="v2-code-block">${v2Esc(buf.join("\n"))}</pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const n = h[1].length;
      out.push(`<h${n} class="v2-md-h${n}">${v2MdInline(h[2])}</h${n}>`);
      i += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      out.push("<hr>");
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(`<blockquote>${buf.map(v2MdInline).join("<br>")}</blockquote>`);
      continue;
    }
    // GFM table: header row, divider row, body rows.
    if (
      /^\s*\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])
    ) {
      flushPara();
      const cells = (r) =>
        r
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        body.push(cells(lines[i]));
        i += 1;
      }
      const thead = `<thead><tr>${head.map((c) => `<th>${v2MdInline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${v2MdInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      out.push(
        `<div class="v2-table-wrapper"><table class="v2-table">${thead}${tbody}</table></div>`,
      );
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      const items = [];
      const re = ul ? /^\s*[-*]\s+(.*)$/ : /^\s*\d+\.\s+(.*)$/;
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].match(re)[1]);
        i += 1;
      }
      out.push(`<${tag}>${items.map((it) => `<li>${v2MdInline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      i += 1;
      continue;
    }
    para.push(line);
    i += 1;
  }
  flushPara();
  return out.join("\n");
}
