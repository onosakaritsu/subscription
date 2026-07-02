# Contributing

Thanks for considering a contribution to Subscription Manager Web.

## Development

Requirements:

- Node.js 20 or newer
- No package install is required for the current zero-dependency version

Run locally:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## Pull Request Guidelines

- Keep changes focused and easy to review.
- Add or update tests when changing subscription calculation, storage, or API behavior.
- Update `README.md` when user-facing behavior changes.
- Do not commit local subscription data from `data/subscriptions.json`.
- Prefer dependency-free changes unless a dependency clearly improves maintainability.

## Project Scope

This project is a local-first web app. Native macOS WidgetKit support is intentionally out of scope for now because it requires Apple Development Team and App Group signing.
