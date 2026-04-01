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
  focusedGroup: 0,   // group that receives double-clicked pool tiles
  wordsDate: null,      // YYYY-MM-DD when first word was added to a blank list
  staleDateAsked: null, // YYYY-MM-DD we last prompted about stale words
  lastSeenVersion: null, // changelog version last acknowledged by the user
};

let draggedIdx = null; // index of the tile currently being dragged

// ── Persistence ────────────────────────────────────────────────────────────

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      if (state.focusedGroup === undefined) state.focusedGroup = 0; // migrate old saves
      return true;
    }
  } catch (_) {}
  return false;
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  clearImageTiles();
  imageMode = false;
  state = {
    words: Array(16).fill(''),
    leftWords: [],
    groups: [
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
      { name: '', color: null, words: [] },
    ],
    focusedGroup: 0,
    wordsDate: null,
    staleDateAsked: null,
    lastSeenVersion: null,
  };
}

// ── Guards ─────────────────────────────────────────────────────────────────

function canOpenWorkbench() {
  if (imageMode && getImageTiles()) return true;
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
  state.focusedGroup = 0;
  saveState();
}

// ── Date tracking ──────────────────────────────────────────────────────────

function getToday() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Call after any word update — stamps the date the first time words are added to a blank list.
function maybeSetWordsDate() {
  if (state.wordsDate) return;
  if (state.words.some(w => w && w.trim() !== '')) {
    state.wordsDate = getToday();
  }
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
  const wordsEl = document.getElementById('words-status');
  if (imageMode && getImageTiles()) {
    wordsEl.textContent = 'Image';
    wordsEl.classList.add('status--complete');
  } else {
    const filled = state.words.filter(w => w && w.trim() !== '').length;
    wordsEl.textContent = filled > 0 ? `${filled} / 16` : '';
    wordsEl.classList.toggle('status--complete', filled === 16);
  }

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

      maybeSetWordsDate();
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

  maybeSetWordsDate();
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
    // Fill remaining slots with dashed placeholders (groups always hold 4 tiles)
    for (let p = group.words.length; p < 4; p++) {
      const ph = document.createElement('div');
      ph.className = 'tile-placeholder';
      // Highlight only the very next slot in the focused group
      if (g === state.focusedGroup && p === group.words.length) {
        ph.classList.add('tile-placeholder--focused');
      }
      dropZone.appendChild(ph);
    }
    setupDropZone(dropZone, `group-${g}`);

    // Clicking the group area (not a tile/input/button) sets it as the focus target
    groupEl.addEventListener('click', e => {
      if (e.target.closest('input, button, .tile')) return;
      if (state.focusedGroup === g) return;
      state.focusedGroup = g;
      saveState();
      renderWorkbench();
    });

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
  tile.draggable = true;
  tile.dataset.tileIdx = String(idx);

  const imageTiles = imageMode ? getImageTiles() : null;
  if (imageTiles && imageTiles[idx]) {
    tile.classList.add('tile--image');
    const img = document.createElement('img');
    img.src = imageTiles[idx];
    img.className = 'tile-img';
    img.draggable = false;
    tile.appendChild(img);
  } else {
    tile.textContent = state.words[idx];
  }

  if (inGroup) {
    tile.classList.add('tile--in-group');
    tile.title = 'Double-click to return to word pool';
  } else {
    tile.title = 'Double-click to send to focused group';
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
  } else {
    tile.addEventListener('dblclick', () => {
      const fg = state.focusedGroup;
      if (state.groups[fg].words.length >= 4) return; // focused group is full
      state.leftWords = state.leftWords.filter(i => i !== idx);
      state.groups[fg].words.push(idx);
      // If focused group is now full, advance focus to next group with space
      if (state.groups[fg].words.length === 4) {
        const next = getSortedGroupIndices().find(i => state.groups[i].words.length < 4);
        if (next !== undefined) state.focusedGroup = next;
      }
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

// ── Image mode ─────────────────────────────────────────────────────────────

const IMAGE_STORAGE_KEY = 'connectionsframe_images';
let imageMode = false;

function getImageTiles() {
  try {
    const raw = sessionStorage.getItem(IMAGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
function saveImageTiles(tiles) {
  sessionStorage.setItem(IMAGE_STORAGE_KEY, JSON.stringify(tiles));
}
function clearImageTiles() {
  sessionStorage.removeItem(IMAGE_STORAGE_KEY);
}

function enterImageMode() {
  imageMode = true;
  document.getElementById('text-entry-ui').hidden = true;
  document.getElementById('image-entry-ui').hidden = false;
  const hasTiles = !!getImageTiles();
  document.getElementById('btn-image-to-workbench').hidden = !hasTiles;
}

function exitImageMode() {
  imageMode = false;
  clearImageTiles();
  document.getElementById('text-entry-ui').hidden = false;
  document.getElementById('image-entry-ui').hidden = true;
  // Reset state so text entry starts fresh
  state.words = Array(16).fill('');
  state.wordsDate = null;
  state.staleDateAsked = null;
  state.leftWords = [];
  state.groups.forEach(g => { g.words = []; g.name = ''; g.color = null; });
  saveState();
  buildWordInputs();
  syncBulkTextarea();
  updateStatus();
}

// ── Crop tool ───────────────────────────────────────────────────────────────

let cropHandles = { x1: 0, y1: 0, x2: 0, y2: 0 };
let draggingHandle = null;
let dragOffset = { x: 0, y: 0 };

function openCropTool(imageUrl) {
  const img = document.getElementById('crop-source-img');
  img.onload = () => {
    // Init handles to 5% inset from each edge
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    cropHandles = {
      x1: Math.round(w * 0.05), y1: Math.round(h * 0.05),
      x2: Math.round(w * 0.95), y2: Math.round(h * 0.95),
    };
    positionHandles();
    drawCropOverlay();
  };
  img.src = imageUrl;
  document.getElementById('image-crop-overlay').hidden = false;
}

function closeCropTool() {
  document.getElementById('image-crop-overlay').hidden = true;
}

function positionHandles() {
  const tl = document.getElementById('handle-tl');
  const br = document.getElementById('handle-br');
  tl.style.left = cropHandles.x1 + 'px';
  tl.style.top  = cropHandles.y1 + 'px';
  br.style.left = cropHandles.x2 + 'px';
  br.style.top  = cropHandles.y2 + 'px';
}

function drawCropOverlay() {
  const canvas = document.getElementById('crop-canvas');
  const img    = document.getElementById('crop-source-img');
  canvas.width  = img.offsetWidth;
  canvas.height = img.offsetHeight;
  const ctx = canvas.getContext('2d');
  const { x1, y1, x2, y2 } = cropHandles;

  // Darken outside selection
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(x1, y1, x2 - x1, y2 - y1);

  // Inner grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  const cw = (x2 - x1) / 4;
  const rh = (y2 - y1) / 4;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(x1 + i * cw, y1); ctx.lineTo(x1 + i * cw, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1 + i * rh); ctx.lineTo(x2, y1 + i * rh); ctx.stroke();
  }
  // Outer border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
}

function initCropTool() {
  // Handle dragging — mouse
  ['handle-tl', 'handle-br'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('mousedown', e => {
      draggingHandle = id;
      dragOffset.x = e.clientX - parseInt(el.style.left || 0);
      dragOffset.y = e.clientY - parseInt(el.style.top  || 0);
      e.preventDefault();
    });
    el.addEventListener('touchstart', e => {
      draggingHandle = id;
      const t = e.touches[0];
      dragOffset.x = t.clientX - parseInt(el.style.left || 0);
      dragOffset.y = t.clientY - parseInt(el.style.top  || 0);
      e.preventDefault();
    }, { passive: false });
  });

  document.addEventListener('mousemove', e => {
    if (!draggingHandle) return;
    moveHandle(draggingHandle, e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', () => { draggingHandle = null; });
  document.addEventListener('touchmove', e => {
    if (!draggingHandle) return;
    moveHandle(draggingHandle, e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { draggingHandle = null; });

  document.getElementById('crop-cancel-btn').addEventListener('click', closeCropTool);
  document.getElementById('crop-confirm-btn').addEventListener('click', confirmCrop);
}

function moveHandle(id, clientX, clientY) {
  const stage     = document.getElementById('image-crop-stage');
  const stageRect = stage.getBoundingClientRect();
  const img       = document.getElementById('crop-source-img');
  const MIN = 40;

  let x = Math.max(0, Math.min(clientX - stageRect.left - dragOffset.x, img.offsetWidth));
  let y = Math.max(0, Math.min(clientY - stageRect.top  - dragOffset.y, img.offsetHeight));

  if (id === 'handle-tl') {
    cropHandles.x1 = Math.min(x, cropHandles.x2 - MIN);
    cropHandles.y1 = Math.min(y, cropHandles.y2 - MIN);
  } else {
    cropHandles.x2 = Math.max(x, cropHandles.x1 + MIN);
    cropHandles.y2 = Math.max(y, cropHandles.y1 + MIN);
  }
  positionHandles();
  drawCropOverlay();
}

function confirmCrop() {
  const img = document.getElementById('crop-source-img');
  const { x1, y1, x2, y2 } = cropHandles;
  const sx = img.naturalWidth  / img.offsetWidth;
  const sy = img.naturalHeight / img.offsetHeight;
  const ax1 = x1 * sx, ay1 = y1 * sy;
  const tw  = (x2 - x1) * sx / 4;
  const th  = (y2 - y1) * sy / 4;

  const tiles = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const c = document.createElement('canvas');
      c.width = Math.round(tw); c.height = Math.round(th);
      c.getContext('2d').drawImage(img,
        ax1 + col * tw, ay1 + row * th, tw, th,
        0, 0, c.width, c.height);
      tiles.push(c.toDataURL('image/jpeg', 0.85));
    }
  }

  saveImageTiles(tiles);
  closeCropTool();

  // Stamp date and initialise workbench
  state.wordsDate = getToday();
  if (!isWorkbenchInitialized()) initWorkbenchTiles();
  saveState();
  updateStatus();

  // Show "View in Workbench" button and jump there
  document.getElementById('btn-image-to-workbench').hidden = false;
  renderWorkbench();
  openSection('workbench');
}

// Attach global paste listener for images (only active in image mode)
function initImagePaste() {
  document.addEventListener('paste', e => {
    if (!imageMode) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        openCropTool(URL.createObjectURL(item.getAsFile()));
        break;
      }
    }
  });
}

// ── Stale-words message ────────────────────────────────────────────────────

function formatStaleMessage() {
  const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const COUNT_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];

  // Parse as local time to get the correct day-of-week for the user's timezone
  const [wy, wm, wd] = state.wordsDate.split('-').map(Number);
  const wordsLocal = new Date(wy, wm - 1, wd);
  const [ty, tm, td] = getToday().split('-').map(Number);
  const todayLocal  = new Date(ty, tm - 1, td);

  const diffDays = Math.round((todayLocal - wordsLocal) / 864e5);
  const dayName   = DAY_NAMES[wordsLocal.getDay()];
  const monthName = MONTH_NAMES[wordsLocal.getMonth()];
  const dayNum    = wordsLocal.getDate();
  const suffix    = `Clear them for today's puzzle?`;

  if (diffDays === 1) {
    return `The current words were entered yesterday, ${dayName} ${dayNum} ${monthName}. ${suffix}`;
  } else if (diffDays <= 6) {
    return `The current words were entered ${COUNT_WORDS[diffDays]} days ago, on ${dayName} ${dayNum} ${monthName}. ${suffix}`;
  } else {
    return `The current words are very old, entered on ${dayName} ${dayNum} ${monthName} ${wy}. ${suffix}`;
  }
}

// ── Stale-words check ──────────────────────────────────────────────────────

// Called on load. If saved words are from a previous day and we haven't already
// asked today, prompts the user to clear. Returns true if cleared.
async function checkStaleWords() {
  if (!state.wordsDate) return false;
  const today = getToday();
  if (state.wordsDate >= today) return false;       // same day or future (clock skew)
  if (state.staleDateAsked === today) return false; // already asked today
  if (!state.words.some(w => w && w.trim() !== '')) return false; // nothing to clear

  const accepted = await customConfirm(formatStaleMessage());
  if (accepted) {
    state.words = Array(16).fill('');
    state.wordsDate = null;
    state.staleDateAsked = null;
    state.leftWords = [];
    state.groups.forEach(g => { g.words = []; g.name = ''; g.color = null; });
    saveState();
    buildWordInputs();
    document.getElementById('bulk-input').value = '';
    document.getElementById('bulk-count').textContent = '0 / 16';
    updateStatus();
    return true;
  } else {
    state.staleDateAsked = today;
    saveState();
    return false;
  }
}

// ── New-version notification ────────────────────────────────────────────────

// Called on load after checkStaleWords. Shows a "What's new" dialog for any
// changelog entries newer than what the user last acknowledged.
async function checkNewVersion() {
  // First visit with this feature — treat as having seen 2026.000 so existing
  // users will be shown 2026.001 and any future entries, but not a blank dialog.
  if (!state.lastSeenVersion) {
    state.lastSeenVersion = '2026.000';
    saveState();
  }
  if (state.lastSeenVersion >= CHANGELOG_VERSION) return; // nothing new

  const newEntries = CHANGELOG.filter(e => e.version > state.lastSeenVersion);
  if (newEntries.length === 0) return;

  const body = document.getElementById('whats-new-body');
  body.innerHTML = '';
  newEntries.forEach(entry => {
    if (newEntries.length > 1) {
      const ver = document.createElement('p');
      ver.className = 'whats-new-version';
      ver.textContent = `${entry.version} — ${entry.date}`;
      body.appendChild(ver);
    }
    const ul = document.createElement('ul');
    ul.className = 'whats-new-list';
    entry.items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    body.appendChild(ul);
  });

  await new Promise(resolve => {
    const dialog = document.getElementById('whats-new-dialog');
    const ok = document.getElementById('whats-new-ok');
    function onOk() {
      dialog.close();
      ok.removeEventListener('click', onOk);
      resolve();
    }
    ok.addEventListener('click', onOk);
    dialog.showModal();
  });

  state.lastSeenVersion = CHANGELOG_VERSION;
  saveState();
}

// ── Custom confirm (replaces window.confirm, blocked by some mobile browsers) ──

function customConfirm(message) {
  return new Promise(resolve => {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-message').textContent = message;
    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');

    function cleanup(result) {
      dialog.close();
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onNativeCancel);
      resolve(result);
    }
    function onOk()           { cleanup(true);  }
    function onCancel()       { cleanup(false); }
    function onNativeCancel() { cleanup(false); } // ESC key

    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onNativeCancel);
    dialog.showModal();
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const hasState = loadState();

  // Restore image mode if tiles survived the session
  if (getImageTiles()) {
    imageMode = true;
    document.getElementById('text-entry-ui').hidden = true;
    document.getElementById('image-entry-ui').hidden = false;
    document.getElementById('btn-image-to-workbench').hidden = false;
  }

  buildWordInputs(); // populates inputs from state.words
  syncBulkTextarea(); // populate textarea to match any restored state
  initBulkInput();
  initAccordion();
  initCropTool();
  initImagePaste();
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

  document.getElementById('btn-image-mode').addEventListener('click', enterImageMode);
  document.getElementById('btn-exit-image-mode').addEventListener('click', exitImageMode);
  document.getElementById('btn-image-to-workbench').addEventListener('click', () => {
    if (!isWorkbenchInitialized()) initWorkbenchTiles();
    renderWorkbench();
    openSection('workbench');
  });

  document.getElementById('reset-words-btn').addEventListener('click', async () => {
    if (!await customConfirm('Reset all words? This will also clear your workbench.')) return;
    clearImageTiles();
    imageMode = false;
    document.getElementById('text-entry-ui').hidden = false;
    document.getElementById('image-entry-ui').hidden = true;
    state.words = Array(16).fill('');
    state.wordsDate = null;
    state.staleDateAsked = null;
    state.leftWords = [];
    state.groups.forEach(g => { g.words = []; });
    saveState();
    buildWordInputs();
    document.getElementById('bulk-input').value = '';
    document.getElementById('bulk-count').textContent = '0 / 16';
    updateStatus();
  });

  document.getElementById('reset-workbench-btn').addEventListener('click', async () => {
    if (!await customConfirm('Reset workbench? All tiles will return to the pool and groups will be cleared.')) return;
    state.leftWords = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
    state.groups.forEach(g => { g.words = []; g.name = ''; g.color = null; });
    state.focusedGroup = 0;
    saveState();
    renderWorkbench();
  });

  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!await customConfirm('Start over? This will clear all words and your workbench.')) return;
    clearState();
    buildWordInputs(); // rebuild inputs with empty state
    document.getElementById('bulk-input').value = '';
    document.getElementById('bulk-count').textContent = '0 / 16';
    updateStatus();
    openSection('words');
  });

  // ── Decide which section to open on load ──
  const wasCleared = await checkStaleWords();
  await checkNewVersion();

  const hasTiles = imageMode && getImageTiles();
  if (wasCleared) {
    openSection('words', false);
  } else if (hasTiles || (hasState && state.words.some(w => w && w.trim() !== ''))) {
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
