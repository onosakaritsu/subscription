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
- Add/edit subscriptions now use a modal form.
- Quick enable/disable, mark as renewed, and duplicate subscription actions.
- Status filter, currency filter, and user-selectable sorting.
- Manual backups, backup download, and restoring from an external backup JSON file.
- Unified status badge system across subscription list, urgent summary, and renewal calendar.
- Narrow-window friendly desktop-style UI with dark-mode readable status colors.

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

Automatic backups are named `subscriptions-backup-YYYY-MM-DD-HH-mm-ss.json`; manual backups are named `subscriptions-manual-backup-YYYY-MM-DD-HH-mm-ss.json`; the newest 20 managed backup files are kept. Restore operations create `subscriptions-before-restore-YYYY-MM-DD-HH-mm-ss.json`; JSON imports create `subscriptions-before-import-YYYY-MM-DD-HH-mm-ss.json` before replacing current data.

## JSON Import and Export

Exports download as `subscriptions-export-YYYY-MM-DD.json` and remain compatible with import. Import validates JSON format and subscription structure before replacing data.

## Status Badges

Phase 4 adds a unified visual status system for overdue, today, within 3 days, within 7 days, this month, normal, disabled, and one-time items. The same badge colors and text labels are used in the subscription list, urgent renewal summary, and renewal calendar. Dark mode uses adjusted variables for readability.

## Backup Restore

The UI includes a backup and restore panel. It can list local backups, create a manual backup, preview a backup, download any backup JSON file, restore a selected valid backup after confirmation, and restore from an external backup JSON file. Damaged backups are shown but cannot be restored.

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

## License and Disclaimer

This project is released under the Apache License 2.0. See [LICENSE](./LICENSE) for details.

This project is provided on an “AS IS” basis, without warranties or representations of any kind, express or implied, including but not limited to availability, accuracy, fitness, security, stability, legality, compliance, or suitability for any particular purpose.

Users are solely responsible for determining whether this project is appropriate for their use case and assume all risks arising from the use, modification, derivative creation, redistribution, deployment, commercialization, or other use of this project and its derivative works. Any individual or organization that modifies, redistributes, deploys, or commercializes this project is solely responsible for ensuring compliance with applicable laws and regulations, third-party platform rules, data compliance requirements, and relevant open-source license obligations.

This project does not constitute legal, compliance, financial, business, or professional advice. See [DISCLAIMER.md](./DISCLAIMER.md) for details.
