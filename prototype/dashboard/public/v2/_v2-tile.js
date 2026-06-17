/**
 * _v2-tile.js — Tile rendering helpers.
 * All tiles are <a> elements; no onclick/modal patterns.
 */

/**
 * Render a single clickable metric tile into `container`.
 * @param {HTMLElement} container
 * @param {{ label: string, value?: string, unit?: string, secondary?: string, href: string, variant?: string }} opts
 */
function renderTile(container, opts) {
  const { label, value = "—", unit = "", secondary = "", href, variant = "" } = opts;
  const variantClass = variant ? ` v2-tile--${variant}` : "";
  const valueClass = value === "—" ? " pending" : "";

  const el = document.createElement("a");
  el.className = `v2-tile${variantClass}`;
  el.href = href;
  el.innerHTML = `
    <div class="v2-tile__label">${label}</div>
    <div class="v2-tile__value${valueClass}">${value}</div>
    ${unit ? `<div class="v2-tile__unit">${unit}</div>` : ""}
    ${secondary ? `<div class="v2-tile__secondary">${secondary}</div>` : ""}
  `;
  container.appendChild(el);
}

/**
 * Render a group of tiles under an optional section title.
 * @param {HTMLElement} parent
 * @param {{ title?: string, tiles: Array, wide?: boolean }} opts
 */
// biome-ignore lint/correctness/noUnusedVariables: global API called by inline page scripts
function renderTileGroup(parent, opts) {
  const { title, tiles, wide = false } = opts;

  if (title) {
    const h = document.createElement("h2");
    h.className = "v2-section-title";
    h.textContent = title;
    parent.appendChild(h);
  }

  const grid = document.createElement("div");
  grid.className = `v2-tile-group${wide ? " v2-tile-group-wide" : ""}`;
  for (const t of tiles) renderTile(grid, t);
  parent.appendChild(grid);
}

/**
 * Render a placeholder table with pre-defined columns.
 * @param {HTMLElement} parent
 * @param {{ columns: string[], caption?: string, emptyMsg?: string }} opts
 */
// biome-ignore lint/correctness/noUnusedVariables: global API called by inline page scripts
function renderTable(parent, opts) {
  const { columns, emptyMsg = "No data yet — wired in a future build." } = opts;

  const wrapper = document.createElement("div");
  wrapper.className = "v2-table-wrapper";

  const table = document.createElement("table");
  table.className = "v2-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  tbody.innerHTML = `<tr><td colspan="${columns.length}" class="v2-table-empty">${emptyMsg}</td></tr>`;
  table.appendChild(tbody);

  wrapper.appendChild(table);
  parent.appendChild(wrapper);
}

/**
 * Render a formula block showing numerator / denominator and result.
 * @param {HTMLElement} parent
 * @param {{ name: string, numLabel: string, denLabel: string, resultLabel: string, reference?: string }} opts
 */
// biome-ignore lint/correctness/noUnusedVariables: global API called by inline page scripts
function renderFormula(parent, opts) {
  const { name, numLabel, denLabel, reference } = opts;

  const block = document.createElement("div");
  block.className = "v2-formula";
  block.innerHTML = `
    <div class="v2-formula-title">How this is calculated</div>
    <div class="v2-formula-expr">
      <div class="v2-formula-fraction">
        <div class="v2-formula-num">
          <div class="v2-formula-label">${numLabel}</div>
          <div class="v2-formula-value">—</div>
        </div>
        <div class="v2-formula-den">
          <div class="v2-formula-label">${denLabel}</div>
          <div class="v2-formula-value">—</div>
        </div>
      </div>
      <span class="v2-formula-op">=</span>
      <div class="v2-formula-result">
        <div class="v2-formula-result-label">${name}</div>
        <div class="v2-formula-result-value">—</div>
        ${reference ? `<div class="v2-formula-label" style="margin-top:4px">Ref: ${reference}</div>` : ""}
      </div>
    </div>
  `;
  parent.appendChild(block);
}

/**
 * Render a references list.
 * @param {HTMLElement} parent
 * @param {{ title?: string, refs: Array<{label:string, href:string}> }} opts
 */
// biome-ignore lint/correctness/noUnusedVariables: global API called by inline page scripts
function renderRefs(parent, opts) {
  const { title = "References", refs } = opts;

  const section = document.createElement("div");
  section.className = "v2-references";

  const h = document.createElement("h3");
  h.className = "v2-section-title";
  h.textContent = title;
  section.appendChild(h);

  const ul = document.createElement("ul");
  for (const r of refs) {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${r.href}" target="_blank" rel="noopener">${r.label}</a>`;
    ul.appendChild(li);
  }
  section.appendChild(ul);
  parent.appendChild(section);
}

/**
 * Standard page header with breadcrumb.
 * @param {HTMLElement} parent
 * @param {{ crumbs: Array<{label:string,href?:string}>, title: string, seat?: string }} opts
 */
// biome-ignore lint/correctness/noUnusedVariables: global API called by inline page scripts
function renderPageHeader(parent, opts) {
  const { crumbs, title, seat } = opts;

  const header = document.createElement("div");
  header.className = "v2-page-header";

  const bc = crumbs
    .map((c, i) => {
      const sep = i < crumbs.length - 1 ? `<span class="v2-breadcrumb-sep">›</span>` : "";
      return c.href ? `<a href="${c.href}">${c.label}</a>${sep}` : `<span>${c.label}</span>${sep}`;
    })
    .join(" ");

  header.innerHTML = `
    <div class="v2-breadcrumb">${bc}</div>
    <h1 class="v2-page-title">${title}</h1>
    ${seat ? `<div class="v2-page-seat">${seat}</div>` : ""}
  `;
  parent.appendChild(header);
}
