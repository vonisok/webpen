/* ============================================================
   App logic: rendering + search filtering.
   This is a static reference site — nothing here ever executes
   a scan or contacts a target. Every "command" shown is plain
   text meant to be copied into your own tooling.
   ============================================================ */

const state = {
  activePhase: 'overview',
  query: '',
  osintQuery: '',
  osintCategory: 'all',
  cheatQuery: '',
  cheatCategory: 'all',
  payloadQuery: '',
  payloadCategory: 'all',
  githubQuery: '',
  githubCategory: 'all',
};

/* Populated fresh on every renderReferencePage() call; info-btn clicks look themselves up here. */
let infoRegistry = [];

/* ---------- helpers ---------- */

/* {target} is shown as a fixed example domain — there's no live/editable target on this site. */
function sub(str) {
  return str.replaceAll('{target}', 'target.com');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Flatten a phase into a uniform list of rows: {kind:'group', ...} | {kind:'item', text, cmds, tags} */
function flattenPhase(phase) {
  const rows = [];
  if (phase.groups) {
    phase.groups.forEach((g) => {
      rows.push({ kind: 'group', code: g.code, name: g.name, severity: g.severity });
      g.items.forEach((it) => rows.push({ kind: 'item', ...it }));
    });
  } else {
    phase.items.forEach((it) => rows.push({ kind: 'item', ...it }));
  }
  return rows;
}

/* ---------- sidebar ---------- */

function renderSidebar() {
  const nav = document.getElementById('phaseNav');
  nav.innerHTML = '';

  nav.appendChild(navButton({ id: 'overview', title: 'Overview', icon: ICONS.overview, accent: '#9ca3af' }));

  WORKFLOW.forEach((phase) => nav.appendChild(navButton(phase)));

  const sectionLabel = document.createElement('div');
  sectionLabel.className = 'nav-section-label';
  sectionLabel.textContent = 'Reference';
  nav.appendChild(sectionLabel);

  nav.appendChild(navButton({ id: 'osint', title: 'OSINT', icon: ICONS.osint, accent: '#38bdf8' }));
  nav.appendChild(navButton({ id: 'cheatsheet', title: 'Cheatsheet', icon: ICONS.cheatsheet, accent: '#fb923c' }));
  nav.appendChild(navButton({ id: 'payloads', title: 'Payloads', icon: ICONS.payloads, accent: '#f472b6' }));
  nav.appendChild(navButton({ id: 'github', title: 'GitHub Tools', icon: ICONS.github, accent: '#a3e635' }));
}

function navButton(phase) {
  const btn = document.createElement('button');
  btn.className = 'nav-item' + (state.activePhase === phase.id ? ' active' : '');
  btn.style.setProperty('--accent', phase.accent || '#9ca3af');
  btn.innerHTML = `
    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${phase.icon}</svg>
    <span class="nav-label">${phase.title}</span>
  `;
  btn.addEventListener('click', () => {
    state.activePhase = phase.id;
    state.query = '';
    render();
    if (window.innerWidth <= 900) closeMobileNav();
  });
  return btn;
}

/* ---------- main content ---------- */

function renderMain() {
  const main = document.getElementById('mainContent');
  main.scrollTop = 0;

  if (state.activePhase === 'overview') {
    main.innerHTML = renderOverview();
    wireOverview();
    return;
  }

  if (state.activePhase === 'osint') {
    main.innerHTML = renderOsint();
    wireOsint();
    return;
  }

  if (state.activePhase === 'cheatsheet') {
    main.innerHTML = renderCheatsheet();
    wireCheatsheet();
    return;
  }

  if (state.activePhase === 'payloads') {
    main.innerHTML = renderPayloads();
    wirePayloads();
    return;
  }

  if (state.activePhase === 'github') {
    main.innerHTML = renderGithubTools();
    wireGithubTools();
    return;
  }

  const phase = WORKFLOW.find((p) => p.id === state.activePhase);
  if (!phase) return;

  const rows = flattenPhase(phase);
  const q = state.query.trim().toLowerCase();

  main.innerHTML = `
    <header class="phase-header" style="--accent:${phase.accent}">
      <div class="phase-header-top">
        <svg class="phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${phase.icon}</svg>
        <div>
          <h1>${phase.title}</h1>
          <p class="phase-subtitle">${phase.subtitle}</p>
        </div>
      </div>
      <p class="phase-intro">${phase.intro}</p>
    </header>

    <div class="toolbar">
      <div class="search-wrap">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>
        <input id="searchInput" type="text" placeholder="Search this phase…" value="${escapeHtml(state.query)}" />
      </div>
    </div>

    <div class="checklist" id="checklist"></div>
  `;

  const list = document.getElementById('checklist');
  let anyVisible = false;

  rows.forEach((row) => {
    if (row.kind === 'group') {
      const el = document.createElement('div');
      el.className = `group-header sev-${row.severity}`;
      el.innerHTML = `<span class="group-code">${row.code}</span><span class="group-name">${row.name}</span><span class="sev-badge">${row.severity}</span>`;
      list.appendChild(el);
      return;
    }
    const text = row.t.toLowerCase();
    const visible = !q || text.includes(q);
    if (visible) anyVisible = true;
    list.appendChild(renderItem(row, visible));
  });

  if (!anyVisible) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No items match your search.';
    list.appendChild(empty);
  }

  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderMain();
    const inp = document.getElementById('searchInput');
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  });
}

function renderItem(item, visible) {
  const wrap = document.createElement('div');
  wrap.className = 'item-card' + (visible ? '' : ' hidden');

  const cmdsHtml = (item.cmds || [])
    .map(
      (c) => `
      <div class="cmd-row">
        <code>${escapeHtml(sub(c))}</code>
        <button class="copy-btn" data-cmd="${encodeURIComponent(sub(c))}" title="Copy command">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>
        </button>
      </div>`
    )
    .join('');

  const tagsHtml = (item.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  wrap.innerHTML = `
    <div class="item-body">
      <p class="item-text">${escapeHtml(item.t)}</p>
      ${tagsHtml ? `<div class="tag-row">${tagsHtml}</div>` : ''}
      ${cmdsHtml ? `<div class="cmd-block">${cmdsHtml}</div>` : ''}
    </div>
  `;

  wrap.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = decodeURIComponent(btn.dataset.cmd);
      try {
        await navigator.clipboard.writeText(text);
        flashCopied(btn);
      } catch {
        flashCopied(btn, true);
      }
    });
  });

  return wrap;
}

function flashCopied(btn, failed) {
  const original = btn.innerHTML;
  btn.innerHTML = failed
    ? '<span class="copied-label">!</span>'
    : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12l5 5L20 6"/></svg>';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.innerHTML = original;
    btn.classList.remove('copied');
  }, 1100);
}

/* ---------- overview ---------- */

function renderOverview() {
  const flowSteps = WORKFLOW.map(
    (p, i) => `
      <button class="flow-step" data-goto="${p.id}" style="--accent:${p.accent}">
        <span class="flow-num">${String(i + 1).padStart(2, '0')}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p.icon}</svg>
        <span>${p.title}</span>
      </button>
      ${i < WORKFLOW.length - 1 ? '<span class="flow-arrow">›</span>' : ''}
    `
  ).join('');

  const resourceList = RESOURCES.map(
    (r) => `<li><a href="${r.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.name)}</a></li>`
  ).join('');

  const referencePages = [
    { id: 'osint', icon: ICONS.osint, accent: '#38bdf8', title: 'OSINT', desc: `${OSINT.length} passive intel-gathering techniques, before anything active begins.` },
    { id: 'cheatsheet', icon: ICONS.cheatsheet, accent: '#fb923c', title: 'Cheatsheet', desc: `${CHEATSHEET.length} tools, copy-paste commands for every phase.` },
    { id: 'payloads', icon: ICONS.payloads, accent: '#f472b6', title: 'Payloads', desc: `${PAYLOADS.length} vulnerability classes, ready-to-test probes.` },
    { id: 'github', icon: ICONS.github, accent: '#a3e635', title: 'GitHub Tools', desc: `${GITHUB_TOOLS.reduce((n, g) => n + g.tools.length, 0)} curated open-source repos.` },
  ];

  const referenceCards = referencePages
    .map(
      (r) => `
      <button class="tool-card reference-card" data-goto="${r.id}" style="--accent:${r.accent}">
        <div class="tool-card-header">
          <svg class="phase-icon reference-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${r.icon}</svg>
          <h3>${r.title}</h3>
        </div>
        <p class="tool-desc">${r.desc}</p>
      </button>
    `
    )
    .join('');

  return `
    <div class="overview">
      <div class="hero">
        <p class="eyebrow">WEB APPLICATION PENETRATION TESTING</p>
        <h1>A pocket reference, not a control panel.</h1>
        <p class="hero-sub">A structured reference guide covering every phase of an authorized web app engagement, plus a searchable OSINT playbook, tool cheatsheet, payload library, and curated GitHub tools — nothing here runs, scans, or contacts a target on its own.</p>
      </div>

      <div class="legal-banner">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4.5 6v6c0 4.4 3.2 7.6 7.5 9 4.3-1.4 7.5-4.6 7.5-9V6L12 3Z"/><path d="M12 8v5"/><circle cx="12" cy="15.8" r=".9" fill="currentColor" stroke="none"/></svg>
        <p><strong>Authorized use only.</strong> Every command and payload shown here is for reference — copy it into your own tooling. This site assumes you have explicit written permission to test the target in scope. Testing systems without authorization is illegal in most jurisdictions.</p>
      </div>

      <div class="stat-row stat-row-4">
        <div class="stat-card">
          <span class="stat-value">${WORKFLOW.length}</span>
          <span class="stat-label">Methodology phases</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${OSINT.length}</span>
          <span class="stat-label">OSINT techniques</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${CHEATSHEET.length}</span>
          <span class="stat-label">Cheatsheet tools</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${PAYLOADS.length}</span>
          <span class="stat-label">Payload classes</span>
        </div>
      </div>

      <section class="section-block">
        <h2>Methodology flow</h2>
        <div class="flow">${flowSteps}</div>
      </section>

      <section class="section-block">
        <h2>Jump to a reference</h2>
        <div class="reference-grid">${referenceCards}</div>
      </section>

      <section class="section-block">
        <h2>Reference resources</h2>
        <ul class="resource-list">${resourceList}</ul>
      </section>
    </div>
  `;
}

function wireOverview() {
  document.querySelectorAll('.flow-step, .reference-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activePhase = btn.dataset.goto;
      render();
    });
  });
}

/* ---------- shared reference-page renderer (cheatsheet + payloads + github tools) ---------- */

/* entries: [{ name, category, categoryLabel, desc, note?, rows: [{label, text, why?}] }] */
function renderReferencePage({ icon, accent, title, subtitle, intro, categories, activeCategory, query, searchId, searchPlaceholder, entries }) {
  const q = query.trim().toLowerCase();
  infoRegistry = [];

  const matches = (entry) => {
    const catOk = activeCategory === 'all' || entry.category === activeCategory;
    if (!catOk) return false;
    if (!q) return true;
    const haystack = [entry.name, entry.desc, ...entry.rows.map((r) => `${r.label} ${r.text}`)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  };

  const visible = entries.filter(matches);

  const chips = categories
    .map((c) => `<button class="chip${activeCategory === c.id ? ' active' : ''}" data-cat="${c.id}">${c.label}</button>`)
    .join('');

  const cards = visible
    .map((entry) => {
      const rows = entry.rows
        .map((r) => {
          let infoBtn = '';
          if (r.why) {
            const idx = infoRegistry.length;
            infoRegistry.push({ tool: entry.name, label: r.label, text: r.text, why: r.why });
            infoBtn = `
              <button class="info-btn" data-info-idx="${idx}" title="Why this command?">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5"/><path d="M12 8h.01"/></svg>
              </button>`;
          }
          return `
          <div class="cmd-row cmd-row-labeled">
            <div class="cmd-row-main">
              <span class="cmd-label">${escapeHtml(r.label)}</span>
              <code>${escapeHtml(r.text)}</code>
            </div>
            <div class="cmd-row-actions">
              ${infoBtn}
              <button class="copy-btn" data-cmd="${encodeURIComponent(r.text)}" title="Copy">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>
              </button>
            </div>
          </div>`;
        })
        .join('');

      return `
        <div class="tool-card">
          <div class="tool-card-header">
            <h3>${escapeHtml(entry.name)}</h3>
            <span class="cat-badge cat-${entry.category}">${escapeHtml(entry.categoryLabel)}</span>
          </div>
          <p class="tool-desc">${escapeHtml(entry.desc)}</p>
          ${entry.note ? `<p class="tool-note">${escapeHtml(entry.note)}</p>` : ''}
          <div class="cmd-block">${rows}</div>
        </div>
      `;
    })
    .join('');

  return `
    <header class="phase-header" style="--accent:${accent}">
      <div class="phase-header-top">
        <svg class="phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
        <div>
          <h1>${title}</h1>
          <p class="phase-subtitle">${subtitle}</p>
        </div>
      </div>
      <p class="phase-intro">${intro}</p>
    </header>

    <div class="toolbar">
      <div class="search-wrap">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>
        <input id="${searchId}" type="text" placeholder="${escapeHtml(searchPlaceholder)}" value="${escapeHtml(query)}" />
      </div>
    </div>

    <div class="chip-row">${chips}</div>

    <div class="tool-grid">
      ${cards || '<div class="empty-state">Nothing matches your filter.</div>'}
    </div>
  `;
}

function wireReferencePage({ searchId, onQuery, onCategory }) {
  const search = document.getElementById(searchId);
  search.addEventListener('input', (e) => {
    onQuery(e.target.value);
    renderMain();
    const inp = document.getElementById(searchId);
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      onCategory(chip.dataset.cat);
      renderMain();
    });
  });

  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = decodeURIComponent(btn.dataset.cmd);
      try {
        await navigator.clipboard.writeText(text);
        flashCopied(btn);
      } catch {
        flashCopied(btn, true);
      }
    });
  });

  document.querySelectorAll('.info-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const info = infoRegistry[Number(btn.dataset.infoIdx)];
      if (info) openInfoModal(info);
    });
  });
}

/* ---------- info modal ---------- */

function openInfoModal({ tool, label, text, why }) {
  document.getElementById('modalTool').textContent = tool;
  document.getElementById('modalLabel').textContent = label;
  document.getElementById('modalCode').textContent = text;
  document.getElementById('modalWhy').textContent = why;
  document.getElementById('infoModalOverlay').classList.remove('hidden');
}

function closeInfoModal() {
  document.getElementById('infoModalOverlay').classList.add('hidden');
}

/* ---------- osint ---------- */

function renderOsint() {
  const entries = OSINT.map((t) => ({
    name: t.tool,
    category: t.category,
    categoryLabel: t.categoryLabel,
    desc: t.desc,
    note: t.note,
    rows: t.commands.map((c) => ({ label: c.label, text: sub(c.cmd), why: c.why })),
  }));

  return renderReferencePage({
    icon: ICONS.osint,
    accent: '#38bdf8',
    title: 'OSINT',
    subtitle: 'Passive intelligence gathering, before anything active begins',
    intro: 'Everything here mines publicly-available data — no packets sent to the target unless a command explicitly says otherwise. Swap in your real target before running anything, and confirm it\'s in scope first.',
    categories: OSINT_CATEGORIES,
    activeCategory: state.osintCategory,
    query: state.osintQuery,
    searchId: 'osintSearchInput',
    searchPlaceholder: 'Search techniques or commands…',
    entries,
  });
}

function wireOsint() {
  wireReferencePage({
    searchId: 'osintSearchInput',
    onQuery: (v) => (state.osintQuery = v),
    onCategory: (c) => (state.osintCategory = c),
  });
}

/* ---------- cheatsheet ---------- */

function renderCheatsheet() {
  const entries = CHEATSHEET.map((t) => ({
    name: t.tool,
    category: t.category,
    categoryLabel: t.categoryLabel,
    desc: t.desc,
    note: t.note,
    rows: t.commands.map((c) => ({ label: c.label, text: sub(c.cmd), why: c.why })),
  }));

  return renderReferencePage({
    icon: ICONS.cheatsheet,
    accent: '#fb923c',
    title: 'Cheatsheet',
    subtitle: 'Tool commands, ready to copy into your own terminal',
    intro: 'Every command shown here is plain reference text — nothing on this page executes anything. Swap in your real target before running it, and confirm it\'s in scope first.',
    categories: CHEATSHEET_CATEGORIES,
    activeCategory: state.cheatCategory,
    query: state.cheatQuery,
    searchId: 'cheatSearchInput',
    searchPlaceholder: 'Search tools or commands…',
    entries,
  });
}

function wireCheatsheet() {
  wireReferencePage({
    searchId: 'cheatSearchInput',
    onQuery: (v) => (state.cheatQuery = v),
    onCategory: (c) => (state.cheatCategory = c),
  });
}

/* ---------- payloads ---------- */

function renderPayloads() {
  const entries = PAYLOADS.map((g) => ({
    name: g.name,
    category: g.category,
    categoryLabel: g.categoryLabel,
    desc: g.desc,
    note: g.note,
    rows: g.payloads.map((p) => ({ label: p.label, text: sub(p.value) })),
  }));

  return renderReferencePage({
    icon: ICONS.payloads,
    accent: '#f472b6',
    title: 'Payloads',
    subtitle: 'Copy-paste probes, grouped by vulnerability class',
    intro: 'These confirm a vulnerability — they\'re not weapons. Only use them against targets you\'re explicitly authorized to test, and reach for the least destructive variant that proves the point.',
    categories: PAYLOAD_CATEGORIES,
    activeCategory: state.payloadCategory,
    query: state.payloadQuery,
    searchId: 'payloadSearchInput',
    searchPlaceholder: 'Search vulnerability classes or payloads…',
    entries,
  });
}

function wirePayloads() {
  wireReferencePage({
    searchId: 'payloadSearchInput',
    onQuery: (v) => (state.payloadQuery = v),
    onCategory: (c) => (state.payloadCategory = c),
  });
}

/* ---------- github tools (curated links, not commands) ---------- */

function renderGithubTools() {
  const q = state.githubQuery.trim().toLowerCase();
  const cat = state.githubCategory;

  const matches = (group) => {
    const catOk = cat === 'all' || group.category === cat;
    if (!catOk) return false;
    if (!q) return true;
    const haystack = [group.name, group.desc, ...group.tools.map((t) => `${t.name} ${t.desc}`)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  };

  const visible = GITHUB_TOOLS.filter(matches);

  const chips = GITHUB_TOOLS_CATEGORIES.map(
    (c) => `<button class="chip${cat === c.id ? ' active' : ''}" data-cat="${c.id}">${c.label}</button>`
  ).join('');

  const cards = visible
    .map((group) => {
      const links = group.tools
        .map(
          (t) => `
          <li class="gh-link-row">
            <a href="${t.url}" target="_blank" rel="noopener noreferrer">
              <svg class="gh-external" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
              ${escapeHtml(t.name)}
            </a>
            <span class="gh-link-desc">${escapeHtml(t.desc)}</span>
          </li>`
        )
        .join('');

      return `
        <div class="tool-card">
          <div class="tool-card-header">
            <h3>${escapeHtml(group.name)}</h3>
            <span class="cat-badge cat-${group.category}">${escapeHtml(group.categoryLabel)}</span>
          </div>
          <p class="tool-desc">${escapeHtml(group.desc)}</p>
          <ul class="gh-link-list">${links}</ul>
        </div>
      `;
    })
    .join('');

  return `
    <header class="phase-header" style="--accent:#a3e635">
      <div class="phase-header-top">
        <svg class="phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS.github}</svg>
        <div>
          <h1>GitHub Tools</h1>
          <p class="phase-subtitle">Curated open-source tooling for web pentesting &amp; red teaming</p>
        </div>
      </div>
      <p class="phase-intro">Every link goes straight to the real upstream repo. Read each project's license and README before use — a few carry usage or attribution restrictions.</p>
    </header>

    <div class="toolbar">
      <div class="search-wrap">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>
        <input id="githubSearchInput" type="text" placeholder="Search tools or categories…" value="${escapeHtml(state.githubQuery)}" />
      </div>
    </div>

    <div class="chip-row">${chips}</div>

    <div class="tool-grid">
      ${cards || '<div class="empty-state">Nothing matches your filter.</div>'}
    </div>
  `;
}

function wireGithubTools() {
  wireReferencePage({
    searchId: 'githubSearchInput',
    onQuery: (v) => (state.githubQuery = v),
    onCategory: (c) => (state.githubCategory = c),
  });
}

/* ---------- mobile nav ---------- */

function closeMobileNav() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('navOverlay').classList.remove('visible');
}
function openMobileNav() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('navOverlay').classList.add('visible');
}

/* ---------- top-level render ---------- */

function render() {
  renderSidebar();
  renderMain();
}

function init() {
  document.getElementById('menuToggle').addEventListener('click', openMobileNav);
  document.getElementById('navOverlay').addEventListener('click', closeMobileNav);

  document.getElementById('modalCloseBtn').addEventListener('click', closeInfoModal);
  document.getElementById('infoModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'infoModalOverlay') closeInfoModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeInfoModal();
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
