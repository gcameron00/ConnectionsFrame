# ConnectionsFrame

A browser-based thinking tool to help you work through the daily [NYT Connections](https://www.nytimes.com/games/connections) puzzle.

## What it does

ConnectionsFrame gives you a structured workspace to reason about potential groupings before committing to an answer in the real game.

1. **Enter the words** — type in the 16 words or short phrases from today's puzzle.
2. **Explore connections** — a split-screen view shows:
   - **Left:** the 16 tiles in the standard 4×4 grid
   - **Right:** four empty group slots for your working hypotheses
3. **Drag and drop** tiles from the left grid into the right-hand groups to test potential connections.
4. **Name your groups** — a text field above each right-hand group lets you label what you think the connection is.
5. **Predict the difficulty** — to the right of each group, mark your predicted colour: Yellow, Green, Blue, or Purple.

## Privacy

ConnectionsFrame uses **localStorage** only — your thinking stays in your own browser. Multiple users can use the same deployed instance simultaneously without seeing or interfering with each other's work.

## Tech stack

- Plain HTML, CSS, and JavaScript (no framework dependencies)
- Deployed via [Cloudflare Pages](https://pages.cloudflare.com/)

## Getting started

Clone the repo and open `index.html` in a browser, or visit the deployed site.

```bash
git clone https://github.com/<your-username>/ConnectionsFrame.git
cd ConnectionsFrame
open index.html
```

## Project structure

```
ConnectionsFrame/
├── index.html          # Main app
├── about/
│   └── index.html      # About page
└── assets/
    └── css/
        └── styles.css  # Styles
```
