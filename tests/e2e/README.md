# Browser flows (Playwright)

Build the web version and serve it on port 8099, then run a flow:

```bash
npx expo export --platform web --output-dir /tmp/vibe-web
```
```bash
python3 -m http.server 8099 --directory /tmp/vibe-web
```
```bash
node tests/e2e/core_e2e.js /tmp/shots
```

Flows: `core_e2e` (Phase 1-2, store migration), `voice_e2e`, `studio_e2e` (needs `face.png` as 2nd arg),
`docs_e2e`, `team_e2e`, `booking_e2e` (serve `booking-page/` on port 8098).
Each prints its checks and `ERRORS: []` when the page had no runtime errors.
