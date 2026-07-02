# Architecture

Subscription Manager Web is intentionally small and local-first.

## Runtime

- `src/server.mjs` provides the HTTP server, JSON API, static file serving, file persistence, and backup trigger.
- `src/domain/subscriptions.mjs` contains subscription calculations, renewal status, sorting, and summary metrics.
- `src/storage/backups.mjs` contains local backup file naming, creation, and pruning.
- `public/` contains the browser UI.
- `data/subscriptions.json` is created locally at runtime and ignored by Git.
- `data/backups/` stores automatic backups and keeps only the newest 20 JSON files.

## Design Decisions

- No Apple Development Team dependency.
- No WidgetKit or App Group.
- No third-party runtime dependencies.
- Local JSON is the first storage layer because it is easy to inspect, back up, import, and export.
- Renewal status and sorting live in the domain layer rather than DOM rendering.
- Backups are best-effort: backup failures are logged but do not block the main save path.

## Upgrade Paths

- Manual backup restore UI.
- SQLite adapter for larger local datasets.
- Browser notifications or calendar export for renewal reminders.
- React/Vite frontend if UI complexity grows.
- Tauri or Electron only if a packaged desktop app becomes necessary.
