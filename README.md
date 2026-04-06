# Connections Workbench

A browser-based thinking tool to help you work through the daily [NYT Connections](https://www.nytimes.com/games/connections) puzzle.

## What it does

Connections Workbench gives you a structured workspace to reason about potential groupings before committing to an answer in the real game.

The app lives on a single page with three collapsible sections that guide you through the flow:

### 1. Instructions
An overview of how to use the tool. Defaults open on first visit, collapsed thereafter.

### 2. Enter Today's Words
Enter the 16 words or phrases from today's puzzle using any of:
- **Type directly** into the 4×4 grid of inputs
- **Paste a delimited list** into any box — the app splits on commas, semicolons, tabs, pipes, or newlines (hyphens are treated as part of words)
- **Paste / type one per line** into the text area below the grid
- **Image mode** — paste or upload a screenshot of the puzzle; a crop tool lets you align a 4×4 grid to the tiles, then splits the image into 16 draggable image tiles in the workbench

Words can be edited at any time, even after the workbench is open. Changes sync live to the workbench tiles. Defaults open when fewer than 16 words are entered.

> **Image mode note:** image tiles are session-only — they are stored in `sessionStorage` and will not survive closing the tab.

### 3. Workbench
The main thinking workspace. Defaults open when 16 words are entered.

- **Left panel:** all 16 words as draggable tiles
- **Right panel:** four group slots — drag tiles in to build your hypotheses
- **Name each group** using the text field above it
- **Predict the difficulty colour** — Yellow (easiest) → Green → Blue → Purple (hardest). Groups animate into colour order (Purple at top) as you assign them.
- **Double-click** any tile in the word pool to send it to the **focused group** — click any group area to set which group receives double-clicked tiles; the next open slot in the focused group is highlighted
- **Double-click** any tile in a group to return it instantly to the word pool
- **Personal Hints panel** — below the word pool on desktop/tablet, below the groups on mobile; click a hint to highlight it while thinking

### 4. Personal Hints
A persistent library of connection-type reminders. Add notes like *"Last names of related people"* or *"Things that precede a word"* — they appear in the Workbench and survive Start Over and page refreshes. Manage, edit, and reorder them in section 4.

## User flow

```
[Instructions] → Start entering today's words
      ↓
[Enter Words]  → Move to Workbench  (button active only when all 16 filled)
      ↓
[Workbench]    ← can return to Enter Words to fix typos at any time
```

Each section is independently collapsible. Opening one via a button closes the previous.

## Privacy

Connections Workbench uses **localStorage** only — nothing is sent to any server. Multiple users can use the same deployed instance simultaneously without seeing or interfering with each other's work. Sessions persist across page refreshes until the user clicks *Start Over*.

Image mode uses **sessionStorage** for the cropped tile data — also local-only, but cleared when the tab is closed.

## Tech stack

- Plain HTML, CSS, and JavaScript — no build step, no framework
- Deployed via [Cloudflare Pages](https://pages.cloudflare.com/)

## Architecture notes

### State model
Tiles are identified by **index** (0–15), not by their text. This means:

- `state.words[i]` — the canonical text for tile `i`
- `state.leftWords` — array of tile indices currently in the word pool
- `state.groups[g].words` — array of tile indices in each group

Separating identity from content means edits to a word in section 2 only need to update `state.words[i]`; the tile re-renders with new text wherever it sits in the workbench without any search-and-replace across the state tree. It also means two tiles can legitimately share the same text without collision.

### localStorage
All state is persisted as JSON under a single key. No server calls are made at any point.

## Getting started

```bash
git clone https://github.com/<your-username>/Connections Workbench.git
cd Connections Workbench
# Serve locally — file:// won't work due to absolute asset paths
npx serve .
```

## Project structure

```
Connections Workbench/
├── index.html          # Single-page app (sections 1–4)
├── about/
│   ├── index.html      # About page
│   └── changelog/
│       └── index.html  # Dynamic changelog page
└── assets/
    ├── css/
    │   └── styles.css
    └── js/
        ├── changelog.js
        └── main.js
```
