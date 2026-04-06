# Connections Workbench — Claude Code instructions

## Changelog

**Always update the changelog when making a user-facing change** — new features, behaviour changes, or bug fixes that affect how the app works. Do not add entries for internal refactors, code style changes, or documentation-only edits.

### File
`assets/js/changelog.js`

### Version format
`YYYY.xxx` — four-digit year, dot, three-digit incrementing integer (zero-padded). The counter resets to `001` each calendar year.

Examples: `2026.001`, `2026.002`, `2027.001`

### Steps when adding a changelog entry
1. Add a new object to the **top** of the `CHANGELOG` array in `assets/js/changelog.js`.
2. Set `version` to the next version in sequence for the current year.
3. Set `date` to today's date in `YYYY-MM-DD` format.
4. Set `title` to a short phrase describing the theme of the release.
5. Add one bullet per distinct user-facing change in `items`.
6. Update `CHANGELOG_VERSION` at the top of the file to match the new version.

### What counts as a changelog entry
- New user-visible features
- Changes to existing behaviour
- Bug fixes the user would notice
- Anything that warrants notifying returning users via the "What's new" dialog

## Tech stack
- Plain HTML, CSS, JavaScript — no build step, no framework
- All state in `localStorage` under key `connectionsworkbench_v1` (migrated from `connectionsframe_v2` on first load)
- Deployed via Cloudflare Pages

## Key files
- `index.html` — single-page app
- `assets/js/main.js` — all app logic
- `assets/js/changelog.js` — changelog data (loaded before main.js)
- `assets/css/styles.css` — all styles
- `about/index.html` — About page
- `about/changelog/index.html` — dynamic changelog page (renders from changelog.js)
