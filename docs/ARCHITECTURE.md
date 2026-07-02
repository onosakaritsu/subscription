# Architecture

Subscription Manager Web is intentionally small and local-first.

## Runtime

- `src/server.mjs` provides the HTTP server, JSON API, static file serving, and file persistence.
- `src/domain/subscriptions.mjs` contains subscription calculations, normalization, sorting, and summary metrics.
- `public/` contains the browser UI.
- `data/subscriptions.json` is created locally at runtime and ignored by Git.

## Design Decisions

- No Apple Development Team dependency.
- No WidgetKit or App Group.
- No third-party runtime dependencies.
- Local JSON is the first storage layer because it is easy to inspect, back up, import, and export.

## Upgrade Paths

- SQLite adapter for larger local datasets.
- React/Vite frontend if UI complexity grows.
- Tauri or Electron if a packaged desktop app becomes necessary.
- Optional browser notifications or calendar export for renewal reminders.
