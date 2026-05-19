// _components.js — Scrooge Components (window.SC)
//
// Shared UI primitives for the Fintech Minimal intranet.
// All functions are exported on window.SC.
//
// Author: Atlas (Platform Engineering Lead) — Fintech Minimal rebuild
// under brief:atlas:intranet-rebuild-fintech-minimal-design-all-doma:2026-05-19.

(() => {
  // ── Helpers ────────────────────────────────────────────────────

  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(v) {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  // ── renderBadge ────────────────────────────────────────────────
  // Returns HTML string for a status badge.
  // status: 'ok'|'success'|'warn'|'warning'|'danger'|'error'|
  //         'info'|'draft'|'closed'|'paused'|'active'|'open'|
  //         'overdue'|'pending'|'p1'|'p2'|'p3'|'idle'|'failed'|
  //         'populated'|'in-progress'|'critical'|'retired'
  function renderBadge(status) {
    if (!status) return "";
    const s = String(status).toLowerCase().replace(/\s+/g, "-");
    return `<span class="badge badge-${esc(s)}">${esc(status)}</span>`;
  }

  // ── renderTile ─────────────────────────────────────────────────
  // Returns DOM element for a metric tile.
  // opts: { label, value, sub, href, status, onClick }
  function renderTile({ label, value, sub, href, status, onClick } = {}) {
    const el = document.createElement("div");
    el.className = "tile";
    if (status) el.dataset.status = status;
    if (href) {
      el.dataset.href = href;
      el.style.cursor = "pointer";
      el.addEventListener("click", () => { window.location.href = href; });
    } else if (typeof onClick === "function") {
      el.dataset.clickable = "1";
      el.addEventListener("click", onClick);
    }
    el.innerHTML = `
      <span class="tile-label">${esc(label || "")}</span>
      <span class="tile-value">${esc(fmt(value))}</span>
      ${sub ? `<span class="tile-sub">${esc(fmt(sub))}</span>` : ""}`;
    return el;
  }

  // ── openModal / closeModal ─────────────────────────────────────
  let _overlay = null;

  function ensureOverlay() {
    if (_overlay) return _overlay;
    _overlay = document.createElement("div");
    _overlay.className = "modal-overlay hidden";
    _overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="sc-modal-title">
        <div class="modal-header">
          <span class="modal-title" id="sc-modal-title"></span>
          <button class="modal-close" aria-label="Close" id="sc-modal-close">&times;</button>
        </div>
        <div class="modal-body" id="sc-modal-body"></div>
      </div>`;
    document.body.appendChild(_overlay);

    _overlay.addEventListener("click", (e) => {
      if (e.target === _overlay) closeModal();
    });
    document.getElementById("sc-modal-close").addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
    return _overlay;
  }

  function openModal({ title, body } = {}) {
    const overlay = ensureOverlay();
    document.getElementById("sc-modal-title").textContent = title || "";
    const bodyEl = document.getElementById("sc-modal-body");
    if (typeof body === "string") {
      bodyEl.innerHTML = body;
    } else if (body instanceof HTMLElement) {
      bodyEl.innerHTML = "";
      bodyEl.appendChild(body);
    } else {
      bodyEl.innerHTML = "";
    }
    overlay.classList.remove("hidden");
  }

  function closeModal() {
    if (_overlay) _overlay.classList.add("hidden");
  }

  // ── renderDefList ──────────────────────────────────────────────
  // Renders an object as a definition list HTML string.
  function renderDefList(obj) {
    if (!obj || typeof obj !== "object") return `<p>${esc(fmt(obj))}</p>`;
    const rows = Object.entries(obj).map(([k, v]) => {
      const val = typeof v === "object" && v !== null
        ? `<pre>${esc(JSON.stringify(v, null, 2))}</pre>`
        : esc(fmt(v));
      return `<dt>${esc(k)}</dt><dd>${val}</dd>`;
    });
    return `<dl class="def-list">${rows.join("")}</dl>`;
  }

  // ── renderTable ────────────────────────────────────────────────
  // Renders a full table into a container element.
  // headers: string[]
  // rows: Array<{cells: string[], data: any}>
  // onRowClick: (data) => void
  // emptyMessage: string
  function renderTable({ container, headers, rows, onRowClick, emptyMessage } = {}) {
    if (!container) return;

    if (!rows || rows.length === 0) {
      container.innerHTML = `<div class="table-wrap"><div class="table-empty">${esc(emptyMessage || "No data")}</div></div>`;
      return;
    }

    const ths = headers.map(h => `<th>${esc(h)}</th>`).join("");
    const trs = rows.map(row => {
      const tds = row.cells.map(c => `<td>${c}</td>`).join("");
      const clickable = typeof onRowClick === "function" ? ' data-clickable="1"' : "";
      return `<tr${clickable}>${tds}</tr>`;
    }).join("");

    container.innerHTML = `<div class="table-wrap"><table>
      <thead><tr>${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table></div>`;

    if (typeof onRowClick === "function") {
      container.querySelectorAll("tbody tr[data-clickable]").forEach((tr, i) => {
        tr.addEventListener("click", () => onRowClick(rows[i].data));
      });
    }
  }

  // ── renderSkeleton ─────────────────────────────────────────────
  // Returns HTML string for loading skeleton rows.
  function renderSkeleton(rows = 5) {
    let html = "";
    for (let i = 0; i < rows; i++) {
      html += `<div class="skeleton skeleton-row"></div>`;
    }
    return html;
  }

  // ── renderSectionHeader ────────────────────────────────────────
  // Returns HTML string for a section header with optional action link.
  // action: { label, href } or null
  function renderSectionHeader(title, action) {
    const actionHtml = action
      ? `<a class="section-action" href="${esc(action.href)}">${esc(action.label)}</a>`
      : "";
    return `<div class="section-header">
      <h2 class="section-title">${esc(title)}</h2>
      ${actionHtml}
    </div>`;
  }

  // ── Export as window.SC ────────────────────────────────────────
  window.SC = {
    renderBadge,
    renderTile,
    openModal,
    closeModal,
    renderDefList,
    renderTable,
    renderSkeleton,
    renderSectionHeader,
    esc,
    fmt,
  };
})();
