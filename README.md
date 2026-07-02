# Subscription Manager Web

A local-first subscription manager web app with a zero-dependency Node.js backend, static frontend, and JSON file storage.

This project was migrated from an earlier macOS SwiftUI / WidgetKit direction. The current open-source version is a pure web application, so it does not require Apple Development Team, App Group, signing certificates, or native macOS widgets.

## Features

- Add, edit, and delete subscriptions.
- Track name, category, amount, currency, billing cycle, start date, next renewal date, enabled state, and notes.
- Automatically calculate the next renewal date from start date and billing cycle.
- Manually override the next renewal date when needed.
- Keep disabled subscriptions visible in the management list.
- Search subscriptions by name, category, or notes.
- Filter by category and enabled/disabled state.
- Show summary metrics for total, enabled, disabled, nearest renewal, and monthly-equivalent spend by currency.
- Import and export subscription data as JSON.
- Store data locally in a readable JSON file.
- Run without installing third-party dependencies.

## Tech Stack

- Backend: Node.js native HTTP server
- Frontend: HTML, CSS, and browser JavaScript
- Storage: local JSON file
- Tests: Node.js built-in test runner

## Why This Stack

The project is designed for a local-first, easy-to-run workflow:

- No Apple Developer account or signing setup is required.
- No external npm packages are required.
- Data remains inspectable and portable.
- The codebase stays small enough for straightforward maintenance.
- Future upgrades to SQLite, React/Vite, Tauri, or Electron remain possible.

## Requirements

- Node.js 20 or newer

## Quick Start

```bash
git clone https://github.com/onosakaritsu/subscription.git
cd subscription
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Configuration

Optional environment variables:

```bash
HOST=127.0.0.1
PORT=5173
SUBSCRIPTIONS_DATA_FILE=./data/subscriptions.json
```

You can copy `.env.example` as a reference. The app does not load `.env` automatically; pass variables through your shell when needed:

```bash
PORT=8080 npm run dev
```

## Testing

```bash
npm test
```

## Data Storage

By default, subscription data is stored at:

```text
data/subscriptions.json
```

The file is ignored by Git to prevent personal subscription data from being committed. The server creates it automatically when needed.

## API

See [docs/API.md](docs/API.md).

Main endpoints:

- `GET /api/health`
- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `PUT /api/subscriptions/:id`
- `DELETE /api/subscriptions/:id`
- `GET /api/export`
- `POST /api/import`

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Core files:

- `src/server.mjs`: HTTP server, API routing, static file serving, JSON persistence
- `src/domain/subscriptions.mjs`: normalization, renewal calculation, sorting, summaries
- `public/`: browser UI
- `tests/`: domain tests

## Roadmap

- Optional local backup and restore workflow.
- SQLite storage adapter for larger datasets.
- Renewal reminders through browser notifications or calendar export.
- Charts for monthly and yearly spending trends.
- Optional packaged desktop app through Tauri or Electron.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please do not publish real personal subscription data. See [SECURITY.md](SECURITY.md).

## License

MIT License. See [LICENSE](LICENSE).
