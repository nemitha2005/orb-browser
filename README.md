# 🔮 Orb Browser

> A focus-first, project-based open source browser built with Electron + TypeScript.

---

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start electron-vite dev pipeline with renderer HMR |
| `npm run build` | Build optimized production bundles for main, preload, and renderer |
| `npm run lint` | Run ESLint across TypeScript source and tests |
| `npm run typecheck` | Run strict TS type-check without emitting files |
| `npm test` | Run the baseline unit test suite |
| `npm run test:smoke` | Run renderer interaction smoke checks (tab/search flow + renderer contract) |
| `npm run quality` | Run production quality gate (`lint` + `typecheck` + `test` + build) |
| `npm run security:audit` | Fail if high-severity npm vulnerabilities are found |
| `npm start` | Preview the production build with electron-vite |
| `npm run package:win` | Build Windows installer |
| `npm run package:mac` | Build macOS .dmg |
| `npm run package:linux` | Build Linux AppImage |

## Renderer Structure

- Renderer pages now live in `src/renderer/` and are built by electron-vite.
- Styling uses Tailwind CSS via `src/renderer/styles/tailwind.css`.
- Main page entry: `src/renderer/index.html` + `src/renderer/main.ts`
- Float page entry: `src/renderer/float.html` + `src/renderer/float.ts`
- Last browser session tabs are restored on startup (up to 20 tabs).
- Renderer supports a coder-focused orange light/dark theme toggle (persisted per user).
- Bookmarks MVP is wired to SQLite: star action opens a name+URL save prompt (prefilled defaults), plus favicon bookmark bar and sidebar open/remove flow.
- History MVP records visits automatically and exposes a sidebar with recent entries and clear action.

## Storage Foundation

- Main-process SQLite storage foundation is initialized from `src/main/storage`.
- Versioned migrations create core tables for bookmarks, history, and session tabs.
- Repository interfaces are ready for feature-layer integration.

## Commit Format Checker

This project enforces Conventional Commits through Husky + commitlint.

Allowed examples:

- `feat: add tab pinning`
- `fix: prevent crash on empty URL`
- `docs: update keyboard shortcuts`
- `chore(ci): add security audit step`

Invalid example:

- `updated stuff`

Hooks enabled:

- `pre-commit`: runs `npm run lint && npm run typecheck`
- `commit-msg`: validates the commit message format

If hooks do not run after clone, execute:

```bash
npm run prepare
```

## Production Readiness Checklist

Before shipping a production app, make sure you have:

1. Build and type safety: `npm run quality` must pass in CI and locally.
2. Security hygiene: `npm run security:audit` clean at high severity (or documented, accepted risk).
3. Crash and error telemetry: global error capture in main and renderer with reporting.
4. Auto-update strategy: signed update channel with rollback plan.
5. Code signing + notarization: required for trust on Windows/macOS.
6. Release process: versioning, changelog, release notes, and rollback runbook.
7. Secrets handling: no secrets in source; environment-based config and rotation policy.
8. Data/privacy policy: define what user data is collected, stored, and encrypted.
9. Performance budget: startup time, memory ceiling, and regression checks.
10. Testing baseline: smoke tests for startup, tab actions, navigation, and packaging.
11. Monitoring: alerting for crash spikes, startup failures, and update failures.
12. Dependency maintenance: regular upgrades and vulnerability triage.

## Release Gate

Use this gate before cutting a release branch or tag.

1. CI policy:
	- PRs to `develop` and `main` must pass quality, smoke, security audit, and Linux package smoke jobs.
2. Local verification:
	- `npm run quality`
	- `npm run test:smoke`
	- `npm run security:audit`
3. Packaging check:
	- CI runs `npm run package:smoke:linux` (unpacked package sanity check)
	- Optional local Windows check: `npm run package:smoke:win` (requires symlink privilege)
4. Merge policy:
	- Feature branches merge to `develop` only.
	- `develop` merges to `main` only after release gate is green.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd/Ctrl + T | New tab |
| Cmd/Ctrl + W | Close tab |
| Cmd/Ctrl + L | Focus address bar |
| Cmd/Ctrl + R | Reload |
| Cmd/Ctrl + D | Toggle bookmark for active page |
| Cmd/Ctrl + H | Toggle history sidebar |
| Cmd/Ctrl + Shift + B | Toggle bookmark bar |
| Cmd/Ctrl + Shift + O | Toggle floating window |

## License
MIT
