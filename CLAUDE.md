**Linear team: Opus Dev | Linear project: lirr-ticket-calculator**

## Project
Static web app. No build framework.

## Development & Verification

### Service worker
The SW is configured to bypass caching entirely on localhost — dev always gets fresh files, no cache-busting needed. Only bump `CACHE` version in `sw.js` when deploying a breaking change that requires invalidating production caches.

### Verifying changes
- **Do not rely on the preview tool for visual verification.** The preview tool has a broken 1px-wide viewport — screenshots are useless. Use the browser at `http://localhost:8080` with `Cmd+Shift+R` to hard-refresh and verify visually.
- After any structural HTML edit (wrapping/unwrapping elements, changing nesting), re-read the file before reporting done. Confirm open/close tags match what was intended.

### Layout changes
Think through the full DOM impact before touching code. Ask: does this change affect grid row sizing? Does it affect what's a sibling vs. a child? Sketch the intended structure in the response before making edits. Don't make a first change and then reactively patch the problems it reveals — plan the complete solution first.
