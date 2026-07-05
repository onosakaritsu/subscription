# Subscription Manager Web

A local-first personal subscription manager web app for tracking, summarizing, and reminding recurring subscriptions such as software, memberships, cloud services, and AI tools.

Chinese documentation is the default GitHub README: [README.md](README.md).

## Features

- Add, edit, and delete subscriptions.
- Track name, category, amount, currency, billing cycle, start date, next renewal date, enabled state, and notes.
- Automatically calculate the next renewal date from start date and billing cycle.
- Manually override the next renewal date when needed.
- Renewal status labels: overdue, today, within 3 days, within 7 days, this month, normal, disabled.
- Enabled subscriptions are sorted first; disabled subscriptions stay at the bottom.
- Dashboard cards for monthly renewals, renewals within 7 days, enabled count, disabled count, monthly equivalent, and yearly equivalent.
- Multi-currency summaries without exchange-rate conversion.
- Urgent renewal summary showing up to 5 enabled subscriptions.
- JSON import and export.
- Automatic local backups after every successful save, keeping the newest 20 backups.
- Backup list, preview, and restore workflow in the web UI.
- Before restoring or importing data, the current local data is backed up first.
- Lightweight renewal calendar view for current-month and next-month enabled subscriptions.
- Narrow-window friendly UI for desktop side-panel usage.

## Tech Stack

- Node.js native HTTP backend
- Static HTML/CSS/JavaScript frontend
- Local JSON storage
- No database
- No third-party framework
- No Apple Development Team
- No WidgetKit

## Requirements

- Node.js 20 or newer

## Start Locally

Using npm:

```bash
npm start
```

Using the helper script:

```bash
./start-subscription-manager.sh
```

Open:

```text
http://127.0.0.1:5173
```

## Data and Backups

Main data file:

```text
data/subscriptions.json
```

Automatic backups:

```text
data/backups/
```

Backups are named `subscriptions-backup-YYYY-MM-DD-HH-mm-ss.json` and the newest 20 files are kept. Restore operations create `subscriptions-before-restore-YYYY-MM-DD-HH-mm-ss.json`; JSON imports create `subscriptions-before-import-YYYY-MM-DD-HH-mm-ss.json` before replacing current data.

## JSON Import and Export

Exports download as `subscriptions-backup-YYYY-MM-DD.json` and remain compatible with import. Import validates JSON format and subscription structure before replacing data.

## Backup Restore

The UI includes a backup and restore panel. It can list local backups, preview a backup, and restore a selected valid backup after confirmation. Damaged backups are shown but cannot be restored.

## Renewal Calendar

The renewal calendar shows enabled subscriptions renewing in the current month and next month. Overdue items stay in the urgent renewal summary instead of being forced into the calendar.

## Testing

```bash
npm test
```

## Out of Scope

- Login system
- Multi-user permissions
- Database
- Cloud sync
- Native macOS Widget
- Electron packaging
- Automatic exchange-rate conversion

## License

MIT License. See [LICENSE](LICENSE).
