// ── Changelog ──────────────────────────────────────────────────────────────
// Version format: YYYY.xxx  (xxx is a zero-padded int, resets each calendar year)
// Keep newest entry first. After adding an entry, bump CHANGELOG_VERSION to match.
// This file is loaded before main.js (index.html) and standalone (about/changelog/).

const CHANGELOG_VERSION = '2026.002';

const CHANGELOG = [
  {
    version: '2026.002',
    date: '2026-04-01',
    title: 'Image mode',
    items: [
      'New image mode in Today\'s Words — paste or upload a screenshot of the puzzle instead of typing',
      'Crop tool lets you drag two corner handles to align the grid to the puzzle tiles; a 4×4 overlay previews the split',
      'Cropped tiles appear in the workbench as images — all drag, drop, and grouping features work as normal',
      'Paste via Ctrl/Cmd+V, the Paste image button (uses Clipboard API), or Upload / Photo Library (works on iOS)',
      'Image tiles are session-only and will not be restored if the tab is closed — a warning is shown before you start',
    ],
  },
  {
    version: '2026.001',
    date: '2026-03-27',
    title: 'Quality of life improvements',
    items: [
      'Stale words detection — prompted on load to clear words entered on a previous day',
      'Reset and Start Over now land on Today\'s Words instead of Instructions',
      'Reset and Start Over use an in-page confirmation dialog (fixes Brave Shields blocking browser confirm)',
      'Double-click a pool tile to send it straight to the focused group; double-click a group tile to return it to the pool',
      'Clicking any group area sets it as the focused group; the next open slot is highlighted',
    ],
  },
  {
    version: '2026.000',
    date: '2026-03-22',
    title: 'Initial feature set',
    items: [
      '4×4 word entry grid with paste support (comma, semicolon, pipe, tab, or newline delimited)',
      'Bulk entry textarea as an alternative to the grid',
      'Workbench with draggable tiles, four group slots, group naming, and difficulty colour picker',
      'Groups animate into colour order (Purple hardest at top) as colours are assigned',
      'Live sync — edits to words in Today\'s Words update workbench tiles instantly',
      'Session persists across page refreshes via localStorage; Start Over clears everything',
    ],
  },
];
