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
      el.addEventListener("click", () => {
        window.location.href = href;
      });
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
      const val =
        typeof v === "object" && v !== null
          ? `<pre>${esc(JSON.stringify(v, null, 2))}</pre>`
          : esc(fmt(v));
      return `<dt>${esc(k)}</dt><dd>${val}</dd>`;
    });
    return `<dl class="def-list">${rows.join("")}</dl>`;
  }

  // ── renderTable ────────────────────────────────────────────────
  // Renders a sortable table into a container element.
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

    let sortCol = -1;
    let sortDir = "asc";

    function sortedRows() {
      if (sortCol < 0) return rows;
      return [...rows].sort((a, b) => {
        const av = (a.cells[sortCol] ?? "").replace(/<[^>]+>/g, "").trim();
        const bv = (b.cells[sortCol] ?? "").replace(/<[^>]+>/g, "").trim();
        const an = Number(av.replace(/[^0-9.-]/g, ""));
        const bn = Number(bv.replace(/[^0-9.-]/g, ""));
        const cmp =
          !Number.isNaN(an) && !Number.isNaN(bn) && av !== "" && bv !== ""
            ? an - bn
            : av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    function renderBody(table) {
      const clickable = typeof onRowClick === "function";
      const sorted = sortedRows();
      const trs = sorted
        .map((row) => {
          const tds = row.cells.map((c) => `<td>${c}</td>`).join("");
          return `<tr${clickable ? ' data-clickable="1"' : ""}>${tds}</tr>`;
        })
        .join("");
      table.querySelector("tbody").innerHTML = trs;
      if (clickable) {
        for (const [i, tr] of [...table.querySelectorAll("tbody tr[data-clickable]")].entries()) {
          tr.addEventListener("click", () => onRowClick(sorted[i].data));
        }
      }
    }

    const ths = headers.map((h, i) => `<th data-col="${i}" data-sortable>${esc(h)}</th>`).join("");

    container.innerHTML = `<div class="table-wrap"><table>
      <thead><tr>${ths}</tr></thead>
      <tbody></tbody>
    </table></div>`;

    const table = container.querySelector("table");
    renderBody(table);

    for (const th of table.querySelectorAll("th[data-sortable]")) {
      th.addEventListener("click", () => {
        const col = Number(th.dataset.col);
        if (sortCol === col) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortCol = col;
          sortDir = "asc";
        }
        for (const t of table.querySelectorAll("th[data-sortable]")) {
          t.removeAttribute("data-sort");
        }
        th.setAttribute("data-sort", sortDir);
        renderBody(table);
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

  // ── renderMarkdown ─────────────────────────────────────────────
  // Minimal markdown → HTML renderer covering: H1-H3, paragraphs,
  // unordered + ordered lists, fenced code blocks, blockquotes, GFM
  // tables, bold/italic/inline-code/links. Strips a leading YAML
  // frontmatter block. Same shape as the legacy renderMarkdownLite
  // in policies.js / procedures.js; centralised here so any page can
  // open a full markdown document. No external lib.
  function renderMarkdown(md) {
    const src = String(md ?? "");
    let body = src;
    if (body.startsWith("---")) {
      const end = body.indexOf("\n---", 3);
      if (end !== -1) body = body.slice(end + 4);
    }
    const lines = body.split(/\r?\n/);
    const out = [];
    let inCode = false;
    let codeBuf = [];
    let inList = false;
    let listType = null;
    let inTable = false;
    let tableRows = [];
    const closeList = () => {
      if (inList) {
        out.push(listType === "ol" ? "</ol>" : "</ul>");
        inList = false;
        listType = null;
      }
    };
    const isTableSep = (r) => /^\|[\s\-:| ]+\|$/.test(r);
    const parseTableCells = (r) =>
      r
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
    const closeTable = () => {
      if (!inTable || tableRows.length === 0) {
        inTable = false;
        tableRows = [];
        return;
      }
      const sepIdx = tableRows.findIndex((r) => isTableSep(r));
      const headRows = sepIdx === -1 ? [] : tableRows.slice(0, sepIdx);
      const bodyRows = sepIdx === -1 ? tableRows : tableRows.slice(sepIdx + 1);
      let html = '<div class="md-table-wrap"><table>';
      if (headRows.length > 0) {
        html += "<thead>";
        for (const r of headRows)
          html += `<tr>${parseTableCells(r)
            .map((c) => `<th>${inlineFormat(c)}</th>`)
            .join("")}</tr>`;
        html += "</thead>";
      }
      if (bodyRows.length > 0) {
        html += "<tbody>";
        for (const r of bodyRows)
          html += `<tr>${parseTableCells(r)
            .map((c) => `<td>${inlineFormat(c)}</td>`)
            .join("")}</tr>`;
        html += "</tbody>";
      }
      html += "</table></div>";
      out.push(html);
      inTable = false;
      tableRows = [];
    };
    const inlineFormat = (line) => {
      let s = esc(line);
      s = s.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
      s = s.replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${t}</strong>`);
      s = s.replace(/(^|\W)\*([^*]+)\*(\W|$)/g, (_m, a, t, b) => `${a}<em>${t}</em>${b}`);
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
        const safe = /^(https?:|\/|\.\.?\/)/i.test(href) ? href : "#";
        return `<a href="${safe}" target="_blank" rel="noopener">${text}</a>`;
      });
      return s;
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (line.startsWith("```")) {
        if (inCode) {
          out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
          codeBuf = [];
          inCode = false;
        } else {
          closeList();
          closeTable();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }
      if (!line.trim()) {
        closeList();
        closeTable();
        continue;
      }
      const h1 = line.match(/^# (.+)$/);
      if (h1) {
        closeList();
        closeTable();
        out.push(`<h2>${inlineFormat(h1[1])}</h2>`);
        continue;
      }
      const h2 = line.match(/^## (.+)$/);
      if (h2) {
        closeList();
        closeTable();
        out.push(`<h3>${inlineFormat(h2[1])}</h3>`);
        continue;
      }
      const h3 = line.match(/^### (.+)$/);
      if (h3) {
        closeList();
        closeTable();
        out.push(`<h4>${inlineFormat(h3[1])}</h4>`);
        continue;
      }
      const ul = line.match(/^[-*]\s+(.+)$/);
      if (ul) {
        if (!inList || listType !== "ul") {
          closeList();
          closeTable();
          out.push("<ul>");
          inList = true;
          listType = "ul";
        }
        out.push(`<li>${inlineFormat(ul[1])}</li>`);
        continue;
      }
      const ol = line.match(/^\d+\.\s+(.+)$/);
      if (ol) {
        if (!inList || listType !== "ol") {
          closeList();
          closeTable();
          out.push("<ol>");
          inList = true;
          listType = "ol";
        }
        out.push(`<li>${inlineFormat(ol[1])}</li>`);
        continue;
      }
      if (line.startsWith("> ")) {
        closeList();
        closeTable();
        out.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`);
        continue;
      }
      if (line.startsWith("|")) {
        closeList();
        inTable = true;
        tableRows.push(line);
        continue;
      }
      closeList();
      closeTable();
      out.push(`<p>${inlineFormat(line)}</p>`);
    }
    if (inCode) {
      out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
    }
    closeList();
    closeTable();
    return out.join("\n");
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
    renderMarkdown,
    esc,
    fmt,
  };
})();
