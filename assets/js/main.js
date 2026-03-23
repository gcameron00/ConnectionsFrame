// ── State ──────────────────────────────────────────────────────────────────
// v2: tiles identified by index (0-15), not by text string.
//   state.words[i]         — canonical text for tile i
//   state.leftWords        — number[] of indices in the word pool
//   state.groups[g].words  — number[] of indices in each group

const STORAGE_KEY = 'connectionsframe_v2';

let state = {
  words: Array(16).fill(''),
  leftWords: [],
  groups: [
    { name: '', color: null, words: [] },
    { name: '', color: null, words: [] },
    { name: '', color: null, words: [] },
    { name: '', color: null, words: [] },
  ],
};

let draggedIdx = null; // index of the tile currently being dragged

// ── Persistence ────────────────────────────────────────────────────────────

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { state = JSON.parse(raw); return true; }
  } catch (_) {}
  return false;
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  state = {
    words: Array(16).fill(''),
    leftWords: [],
    groups: [
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
    ],
  };
}

// ── Guards ─────────────────────────────────────────────────────────────────

function canOpenWorkbench() {
  return state.words.length === 16 && state.words.every(w => w && w.trim() !== '');
}

// All 16 indices must be accounted for across leftWords + groups
function isWorkbenchInitialized() {
  const total = state.leftWords.length +
    state.groups.reduce((sum, g) => sum + g.words.length, 0);
  return total === 16;
}

function initWorkbenchTiles() {
  state.leftWords = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
  state.groups.forEach(g => { g.words = []; });
  saveState();
}

// ── Accordion ──────────────────────────────────────────────────────────────

const SECTION_IDS = ['instructions', 'words', 'workbench'];

function openSection(id, scroll = true) {
  SECTION_IDS.forEach(s => {
    document.getElementById(`section-${s}`).open = (s === id);
  });
  if (scroll) {
    const target = document.getElementById(`section-${id}`);
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }
}

function initAccordion() {
  SECTION_IDS.forEach(id => {
    const section = document.getElementById(`section-${id}`);
    section.querySelector('summary').addEventListener('click', e => {
      e.preventDefault();
      // Clicking an open section collapses it
      if (section.open) { section.open = false; return; }
      // Guard: workbench needs 16 valid words
      if (id === 'workbench' && !canOpenWorkbench()) return;
      openSection(id);
    });
  });
}

// ── Status indicators ──────────────────────────────────────────────────────

function updateStatus() {
  // Words section badge
  const filled = state.words.filter(w => w && w.trim() !== '').length;
  const wordsEl = document.getElementById('words-status');
  wordsEl.textContent = filled > 0 ? `${filled} / 16` : '';
  wordsEl.classList.toggle('status--complete', filled === 16);

  // Workbench section badge
  const placed = state.groups.reduce((sum, g) => sum + g.words.length, 0);
  const wbEl = document.getElementById('workbench-status');
  wbEl.textContent = placed > 0 ? `${placed} tile${placed !== 1 ? 's' : ''} placed` : '';

  // "Move to Workbench" button
  document.getElementById('btn-to-workbench').disabled = !canOpenWorkbench();

  // If a word was cleared and workbench is open, close it back to words section
  if (!canOpenWorkbench() && document.getElementById('section-workbench').open) {
    document.getElementById('section-workbench').open = false;
    document.getElementById('section-words').open = true;
  }
}

// ── Word entry ─────────────────────────────────────────────────────────────

// Split on explicit separator characters only — hyphens are treated as part of words
const DELIM_RE = /[\n,\t|;]+/;

function buildWordInputs() {
  // Ensure 16 state.words slots exist
  while (state.words.length < 16) state.words.push('');

  const container = document.getElementById('word-inputs');
  container.innerHTML = '';

  for (let i = 0; i < 16; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Word ${i + 1}`;
    input.className = 'word-input';
    input.maxLength = 40;
    input.autocomplete = 'off';
    input.value = state.words[i] || '';
    input.classList.toggle('filled', !!(state.words[i] && state.words[i].trim()));

    input.addEventListener('input', e => {
      const val = e.target.value.trim();
      state.words[i] = val;
      e.target.classList.toggle('filled', val !== '');

      // Live-sync: update any workbench tile(s) that represent index i
      document.querySelectorAll(`[data-tile-idx="${i}"]`).forEach(t => {
        t.textContent = val;
      });

      saveState();
      updateStatus();
      syncBulkTextarea(); // keep textarea in step with the grid
    });

    // Paste a delimited string into any box → auto-fill from that position
    input.addEventListener('paste', e => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const parts = text.split(DELIM_RE).map(s => s.trim()).filter(s => s !== '');
      if (parts.length > 1) {
        e.preventDefault();
        fillGridFromArray(parts, i);
        syncBulkTextarea();
      }
    });

    // Enter key advances focus
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const inputs = [...document.querySelectorAll('.word-input')];
      const next = inputs[i + 1];
      if (next) next.focus(); else document.getElementById('btn-to-workbench').focus();
    });

    container.appendChild(input);
  }
}

// Fill word inputs (and state) starting at offset.
// clearRemainder: when true, clears all inputs/state beyond the supplied words (used by textarea).
function fillGridFromArray(words, offset = 0, clearRemainder = false) {
  const inputs = [...document.querySelectorAll('.word-input')];
  words.forEach((word, j) => {
    const idx = offset + j;
    if (idx >= 16) return;
    inputs[idx].value = word;
    inputs[idx].classList.toggle('filled', word !== '');
    state.words[idx] = word;
    document.querySelectorAll(`[data-tile-idx="${idx}"]`).forEach(t => {
      t.textContent = word;
    });
  });

  // Clear any inputs beyond what was just filled (fixes stale last-word bug)
  if (clearRemainder) {
    const end = Math.min(offset + words.length, 16);
    for (let idx = end; idx < 16; idx++) {
      inputs[idx].value = '';
      inputs[idx].classList.remove('filled');
      state.words[idx] = '';
      document.querySelectorAll(`[data-tile-idx="${idx}"]`).forEach(t => {
        t.textContent = '';
      });
    }
  }

  saveState();
  updateStatus();
  const next = inputs.find(inp => inp.value.trim() === '');
  if (next) next.focus(); else document.getElementById('btn-to-workbench').focus();
}

// Sync the textarea to match the current grid contents.
// Only called when the grid changes — never when the textarea itself is the source,
// to avoid resetting cursor position mid-edit.
function syncBulkTextarea() {
  const textarea = document.getElementById('bulk-input');
  const countEl  = document.getElementById('bulk-count');
  // Show all filled words as a clean list (no blank lines for empty slots)
  const filled = state.words.filter(w => w && w.trim() !== '');
  textarea.value = filled.join('\n');
  const count = filled.length;
  countEl.textContent = `${count} / 16`;
  countEl.classList.toggle('complete', count === 16);
}

function initBulkInput() {
  const textarea = document.getElementById('bulk-input');
  const countEl  = document.getElementById('bulk-count');
  textarea.addEventListener('input', () => {
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l !== '');
    const count = Math.min(lines.length, 16);
    countEl.textContent = `${count} / 16`;
    countEl.classList.toggle('complete', count === 16);
    // clearRemainder=true so deleting a line also clears the now-empty trailing input
    fillGridFromArray(lines.slice(0, 16), 0, true);
    // Do NOT call syncBulkTextarea here — would reset cursor position mid-edit
  });
}

// ── Group sort order ────────────────────────────────────────────────────────

// Purple (hardest) at top → Yellow (easiest) at bottom
const COLOR_ORDER = { purple: 0, blue: 1, green: 2, yellow: 3 };

function getSortedGroupIndices() {
  return [0, 1, 2, 3].sort((a, b) => {
    const ca = COLOR_ORDER[state.groups[a].color] ?? 4;
    const cb = COLOR_ORDER[state.groups[b].color] ?? 4;
    return ca !== cb ? ca - cb : a - b;
  });
}

// ── Workbench rendering ────────────────────────────────────────────────────

function renderWorkbench() {
  // Left pool
  const sourceGrid = document.getElementById('source-grid');
  sourceGrid.innerHTML = '';
  state.leftWords.forEach(idx => sourceGrid.appendChild(createTile(idx, false)));
  setupDropZone(sourceGrid, 'source');

  // Right groups — rendered in colour-priority order
  const container = document.getElementById('groups-container');
  container.innerHTML = '';

  getSortedGroupIndices().forEach(g => {
    const group = state.groups[g];

    const groupEl = document.createElement('div');
    groupEl.className = 'group';
    groupEl.dataset.color = group.color || '';   // used by FLIP sort
    groupEl.dataset.groupIdx = String(g);

    // ── Header: name input + colour picker ──
    const header = document.createElement('div');
    header.className = 'group-header';
    header.dataset.color = group.color || '';    // used by CSS colour indicator

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'group-name';
    nameInput.placeholder = 'Name this group…';
    nameInput.value = group.name;
    nameInput.addEventListener('input', e => {
      state.groups[g].name = e.target.value;
      saveState();
    });

    // Prevent the browser treating the text input as a tile drop target
    nameInput.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
    });
    nameInput.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
    });

    const picker = document.createElement('div');
    picker.className = 'color-picker';
    picker.setAttribute('role', 'radiogroup');
    picker.setAttribute('aria-label', 'Predicted difficulty colour');

    ['yellow', 'green', 'blue', 'purple'].forEach(color => {
      const btn = document.createElement('button');
      btn.className = `color-btn ${color}`;
      btn.title = color.charAt(0).toUpperCase() + color.slice(1);
      btn.setAttribute('aria-label', color);
      if (group.color === color) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        state.groups[g].color = (state.groups[g].color === color) ? null : color;
        saveState();
        groupEl.dataset.color = state.groups[g].color || '';    // for FLIP sort
        header.dataset.color  = state.groups[g].color || '';    // for CSS indicator
        picker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
        if (state.groups[g].color) btn.classList.add('selected');
        animateGroupReorder();
        updateStatus();
      });

      picker.appendChild(btn);
    });

    header.appendChild(nameInput);
    header.appendChild(picker);

    // ── Drop zone ──
    const dropZone = document.createElement('div');
    dropZone.className = 'tile-grid drop-zone';
    dropZone.dataset.zone = `group-${g}`;
    dropZone.dataset.group = String(g);

    group.words.forEach(idx => dropZone.appendChild(createTile(idx, true)));
    setupDropZone(dropZone, `group-${g}`);

    groupEl.appendChild(header);
    groupEl.appendChild(dropZone);
    container.appendChild(groupEl);
  });

  updateStatus();
}

// FLIP animation: reorder group DOM elements by colour with a smooth transition
function animateGroupReorder() {
  const container = document.getElementById('groups-container');
  const groupEls = [...container.children];

  // Step 1 — record positions before reorder (First)
  const firstTops = new Map(groupEls.map(el => [el, el.getBoundingClientRect().top]));

  // Step 2 — sort by colour priority and reorder in DOM (Last)
  groupEls.sort((a, b) => {
    const ca = COLOR_ORDER[a.dataset.color] ?? 4;
    const cb = COLOR_ORDER[b.dataset.color] ?? 4;
    if (ca !== cb) return ca - cb;
    return parseInt(a.dataset.groupIdx) - parseInt(b.dataset.groupIdx);
  });
  groupEls.forEach(el => container.appendChild(el));

  // Steps 3 & 4 — invert and play
  groupEls.forEach(el => {
    const dy = firstTops.get(el) - el.getBoundingClientRect().top;
    if (dy === 0) return;
    el.style.transition = 'none';
    el.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.transform = '';
      el.addEventListener('transitionend', () => {
        el.style.transition = '';
        el.style.transform = '';
      }, { once: true });
    }));
  });
}

// ── Tiles ──────────────────────────────────────────────────────────────────

function createTile(idx, inGroup) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.textContent = state.words[idx];
  tile.draggable = true;
  tile.dataset.tileIdx = String(idx);

  if (inGroup) {
    tile.classList.add('tile--in-group');
    tile.title = 'Double-click to return to word pool';
  }

  tile.addEventListener('dragstart', e => {
    draggedIdx = idx;
    tile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx)); // required for Firefox
  });

  tile.addEventListener('dragend', () => {
    draggedIdx = null;
    tile.classList.remove('dragging');
  });

  if (inGroup) {
    tile.addEventListener('dblclick', () => {
      removeIndexFromState(idx);
      state.leftWords.push(idx);
      saveState();
      renderWorkbench();
    });
  }

  return tile;
}

// ── Drop zones ─────────────────────────────────────────────────────────────

function setupDropZone(zone, zoneName) {
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (draggedIdx === null) return;

    const idx = draggedIdx;
    if (findIndexZone(idx) === zoneName) return; // same zone, no-op

    removeIndexFromState(idx);

    if (zoneName === 'source') {
      state.leftWords.push(idx);
    } else {
      state.groups[parseInt(zone.dataset.group, 10)].words.push(idx);
    }

    saveState();
    renderWorkbench();
  });
}

function findIndexZone(idx) {
  if (state.leftWords.includes(idx)) return 'source';
  for (let g = 0; g < state.groups.length; g++) {
    if (state.groups[g].words.includes(idx)) return `group-${g}`;
  }
  return null;
}

function removeIndexFromState(idx) {
  state.leftWords = state.leftWords.filter(i => i !== idx);
  state.groups.forEach(g => { g.words = g.words.filter(i => i !== idx); });
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const hasState = loadState();

  buildWordInputs(); // populates inputs from state.words
  syncBulkTextarea(); // populate textarea to match any restored state
  initBulkInput();
  initAccordion();
  updateStatus();

  // ── Navigation buttons ──
  document.getElementById('btn-to-words').addEventListener('click', () => {
    openSection('words');
  });

  document.getElementById('btn-to-workbench').addEventListener('click', () => {
    if (!canOpenWorkbench()) return;
    if (!isWorkbenchInitialized()) initWorkbenchTiles();
    renderWorkbench();
    openSection('workbench');
  });

  document.getElementById('reset-words-btn').addEventListener('click', () => {
    if (!confirm('Reset all words? This will also clear your workbench.')) return;
    state.words = Array(16).fill('');
    state.leftWords = [];
    state.groups.forEach(g => { g.words = []; });
    saveState();
    buildWordInputs();
    document.getElementById('bulk-input').value = '';
    document.getElementById('bulk-count').textContent = '0 / 16';
    updateStatus();
  });

  document.getElementById('reset-workbench-btn').addEventListener('click', () => {
    if (!confirm('Reset workbench? All tiles will return to the pool and groups will be cleared.')) return;
    state.leftWords = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
    state.groups.forEach(g => { g.words = []; g.name = ''; g.color = null; });
    saveState();
    renderWorkbench();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Start over? This will clear all words and your workbench.')) return;
    clearState();
    buildWordInputs(); // rebuild inputs with empty state
    document.getElementById('bulk-input').value = '';
    document.getElementById('bulk-count').textContent = '0 / 16';
    updateStatus();
    openSection('instructions');
  });

  // ── Decide which section to open on load ──
  if (hasState && state.words.some(w => w && w.trim() !== '')) {
    if (canOpenWorkbench() && isWorkbenchInitialized()) {
      renderWorkbench();
      openSection('workbench', false);
    } else {
      openSection('words', false);
    }
  } else {
    // First visit or empty state — open Instructions
    openSection('instructions', false);
  }
});
