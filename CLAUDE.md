**Linear team: Opus Dev | Linear project: lirr-ticket-calculator**

> This project follows the workspace rules in `/Users/stevescher/claude/CLAUDE.md`. Claude Code loads that file automatically for any session in this folder.

## Project
Static web app. No build framework.

## Development & Verification

### Service worker
The SW is configured to bypass caching entirely on localhost — dev always gets fresh files, no cache-busting needed. Only bump `CACHE` version in `sw.js` when deploying a breaking change that requires invalidating production caches.

### Verifying changes
- Verify visual changes at `http://localhost:8080` (the "Python static server" entry in `.claude/launch.json`). The in-app browser renders this app normally (checked 2026-09-25; an earlier note said its viewport was broken, which no longer holds). Hard-refresh with `Cmd+Shift+R` if a change does not show.
- After any structural HTML edit (wrapping/unwrapping elements, changing nesting), re-read the file before reporting done. Confirm open/close tags match what was intended.

### Layout changes
Think through the full DOM impact before touching code. Ask: does this change affect grid row sizing? Does it affect what's a sibling vs. a child? Sketch the intended structure in the response before making edits. Don't make a first change and then reactively patch the problems it reveals — plan the complete solution first.
