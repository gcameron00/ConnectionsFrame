// ── State ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'connectionsframe_v1';

let state = {
  words: [],
  leftWords: [],
  groups: [
    { name: '', color: null, words: [] },
    { name: '', color: null, words: [] },
    { name: '', color: null, words: [] },
    { name: '', color: null, words: [] },
  ],
};

// Word currently being dragged
let draggedWord = null;

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
    words: [],
    leftWords: [],
    groups: [
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
    ],
  };
}

// ── Entry screen ───────────────────────────────────────────────────────────

// Split on any run of characters that are not alphanumeric, space, or apostrophe.
// Covers: comma, semicolon, pipe, slash, tab, newline, dash-used-as-separator, etc.
const DELIM_RE = /[^a-zA-Z0-9 ']+/;

function buildEntryForm() {
  const container = document.getElementById('word-inputs');
  for (let i = 0; i < 16; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Word ${i + 1}`;
    input.className = 'word-input';
    input.maxLength = 40;
    input.autocomplete = 'off';

    input.addEventListener('input', (e) => {
      e.target.classList.toggle('filled', e.target.value.trim() !== '');
      updateStartButton();
    });

    // Paste into any input: if the pasted text contains a delimiter, auto-fill all boxes
    input.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const parts = text.split(DELIM_RE).map(s => s.trim()).filter(s => s !== '');
      if (parts.length > 1) {
        e.preventDefault();
        fillGridFromArray(parts, i);
      }
      // Single word — let the browser handle it normally
    });

    // Enter advances to next input
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const inputs = [...document.querySelectorAll('.word-input')];
        const next = inputs[i + 1];
        if (next) next.focus(); else document.getElementById('start-btn').focus();
      }
    });

    container.appendChild(input);
  }
}

// Fill grid inputs starting at offset, up to 16 total
function fillGridFromArray(words, offset = 0) {
  const inputs = [...document.querySelectorAll('.word-input')];
  words.forEach((word, j) => {
    const idx = offset + j;
    if (idx < 16) {
      inputs[idx].value = word;
      inputs[idx].classList.toggle('filled', word !== '');
    }
  });
  updateStartButton();
  // Focus the next unfilled input (or start button)
  const next = inputs.find(inp => inp.value.trim() === '');
  if (next) next.focus(); else document.getElementById('start-btn').focus();
}

function updateStartButton() {
  const inputs = document.querySelectorAll('.word-input');
  const allFilled = [...inputs].every(inp => inp.value.trim() !== '');
  document.getElementById('start-btn').disabled = !allFilled;
}

function readEntryWords() {
  return [...document.querySelectorAll('.word-input')].map(inp => inp.value.trim());
}

// ── Bulk textarea ───────────────────────────────────────────────────────────

function initBulkInput() {
  const textarea = document.getElementById('bulk-input');
  const countEl  = document.getElementById('bulk-count');

  textarea.addEventListener('input', () => {
    const lines = textarea.value
      .split('\n')
      .map(l => l.trim())
      .filter(l => l !== '');

    const count = Math.min(lines.length, 16);
    countEl.textContent = `${count} / 16`;
    countEl.classList.toggle('complete', count === 16);

    fillGridFromArray(lines.slice(0, 16), 0);
  });
}

// ── Group sort order ────────────────────────────────────────────────────────

// Purple → Blue → Green → Yellow → uncoloured (stable by original index)
const COLOR_ORDER = { purple: 0, blue: 1, green: 2, yellow: 3 };

function getSortedGroupIndices() {
  return [0, 1, 2, 3].sort((a, b) => {
    const ca = COLOR_ORDER[state.groups[a].color] ?? 4;
    const cb = COLOR_ORDER[state.groups[b].color] ?? 4;
    return ca !== cb ? ca - cb : a - b;
  });
}

// ── Workspace ──────────────────────────────────────────────────────────────

function renderWorkspace() {
  // Left pool
  const sourceGrid = document.getElementById('source-grid');
  sourceGrid.innerHTML = '';
  state.leftWords.forEach(word => sourceGrid.appendChild(createTile(word, false)));
  setupDropZone(sourceGrid, 'source');

  // Right groups — rendered in colour-sorted order
  const container = document.getElementById('groups-container');
  container.innerHTML = '';

  getSortedGroupIndices().forEach(idx => {
    const group = state.groups[idx];
    const groupEl = document.createElement('div');
    groupEl.className = 'group';
    groupEl.dataset.color = group.color || '';
    groupEl.dataset.groupIdx = String(idx);

    // ── Header: name input + colour picker ──
    const header = document.createElement('div');
    header.className = 'group-header';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'group-name';
    nameInput.placeholder = 'Name this group…';
    nameInput.value = group.name;
    nameInput.addEventListener('input', (e) => {
      state.groups[idx].name = e.target.value;
      saveState();
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
        state.groups[idx].color = (state.groups[idx].color === color) ? null : color;
        saveState();
        // Update colour indicator in-place, then animate the reorder
        groupEl.dataset.color = state.groups[idx].color || '';
        picker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
        if (state.groups[idx].color) btn.classList.add('selected');
        animateGroupReorder();
      });

      picker.appendChild(btn);
    });

    header.appendChild(nameInput);
    header.appendChild(picker);

    // ── Drop zone ──
    const dropZone = document.createElement('div');
    dropZone.className = 'tile-grid drop-zone';
    dropZone.dataset.zone = `group-${idx}`;
    dropZone.dataset.group = String(idx);

    group.words.forEach(word => dropZone.appendChild(createTile(word, true)));
    setupDropZone(dropZone, `group-${idx}`);

    groupEl.appendChild(header);
    groupEl.appendChild(dropZone);
    container.appendChild(groupEl);
  });
}

// FLIP animation: reorder group elements in the DOM by colour, animating the transition.
function animateGroupReorder() {
  const container = document.getElementById('groups-container');
  const groupEls = [...container.children];

  // Step 1 — record current positions (First)
  const firstTops = new Map(groupEls.map(el => [el, el.getBoundingClientRect().top]));

  // Step 2 — sort by colour priority and reorder in DOM (Last)
  groupEls.sort((a, b) => {
    const ca = COLOR_ORDER[a.dataset.color] ?? 4;
    const cb = COLOR_ORDER[b.dataset.color] ?? 4;
    if (ca !== cb) return ca - cb;
    // tiebreak: original group index
    return parseInt(a.dataset.groupIdx) - parseInt(b.dataset.groupIdx);
  });
  groupEls.forEach(el => container.appendChild(el));

  // Step 3 — invert: push each element back to where it was, then play to zero
  groupEls.forEach(el => {
    const dy = firstTops.get(el) - el.getBoundingClientRect().top;
    if (dy === 0) return;

    el.style.transition = 'none';
    el.style.transform = `translateY(${dy}px)`;

    // Double rAF ensures the browser has committed the style before we start the transition
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

// inGroup: true when the tile lives in a right-hand group (enables double-click to pool)
function createTile(word, inGroup) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.textContent = word;
  tile.draggable = true;
  tile.dataset.word = word;

  if (inGroup) {
    tile.title = 'Double-click to return to word pool';
    tile.classList.add('tile--in-group');
  }

  tile.addEventListener('dragstart', (e) => {
    draggedWord = word;
    tile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', word); // required for Firefox
  });

  tile.addEventListener('dragend', () => {
    draggedWord = null;
    tile.classList.remove('dragging');
  });

  // Double-click on a group tile sends it back to the word pool
  if (inGroup) {
    tile.addEventListener('dblclick', () => {
      removeWordFromState(word);
      state.leftWords.push(word);
      saveState();
      renderWorkspace();
    });
  }

  return tile;
}

// ── Drop zones ─────────────────────────────────────────────────────────────

function setupDropZone(zone, zoneName) {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('drag-over');
    }
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (!draggedWord) return;

    const word = draggedWord;

    // No-op if dropped in the same zone it came from
    const currentZone = findWordZone(word);
    if (currentZone === zoneName) return;

    // Remove from current location
    removeWordFromState(word);

    // Add to new location
    if (zoneName === 'source') {
      state.leftWords.push(word);
    } else {
      const idx = parseInt(zone.dataset.group, 10);
      state.groups[idx].words.push(word);
    }

    saveState();
    renderWorkspace();
  });
}

function findWordZone(word) {
  if (state.leftWords.includes(word)) return 'source';
  for (let i = 0; i < state.groups.length; i++) {
    if (state.groups[i].words.includes(word)) return `group-${i}`;
  }
  return null;
}

function removeWordFromState(word) {
  state.leftWords = state.leftWords.filter(w => w !== word);
  state.groups.forEach(g => { g.words = g.words.filter(w => w !== word); });
}

// ── Screen management ──────────────────────────────────────────────────────

function showEntry() {
  document.getElementById('entry-screen').style.display = '';
  document.getElementById('workspace-screen').style.display = 'none';
}

function showWorkspace() {
  document.getElementById('entry-screen').style.display = 'none';
  document.getElementById('workspace-screen').style.display = '';
  renderWorkspace();
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  buildEntryForm();
  initBulkInput();

  document.getElementById('start-btn').addEventListener('click', () => {
    state.words = readEntryWords();
    state.leftWords = [...state.words];
    state.groups = [
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
    ];
    saveState();
    showWorkspace();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Start over? This will clear your current work.')) return;
    clearState();
    document.querySelectorAll('.word-input').forEach(inp => {
      inp.value = '';
      inp.classList.remove('filled');
    });
    document.getElementById('start-btn').disabled = true;
    showEntry();
  });

  // Restore previous session if present
  if (loadState() && state.words.length === 16) {
    showWorkspace();
  }
});
