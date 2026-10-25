# Contributing to Gainalytics

Thanks for your interest in improving Gainalytics. This document explains how to propose changes and
what we expect from a pull request. It applies to human contributors and to AI coding agents alike.

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs and features**: open an issue first for anything larger than a small fix, so we can agree on
  the approach before you invest time.
- **Security issues**: do not open a public issue. See [SECURITY.md](SECURITY.md).
- **Setup**: follow [docs/building.md](docs/building.md) to build and run the app.

## Workflow

1. Fork the repository and create a branch from `master`. Name it after the issue, for example
   `feature/GH-123` or `fix/GH-123-short-description`.
2. Make focused commits with clear messages. Reference the issue (`GH-123: ...`).
3. Run the checks below.
4. Open a pull request against `master`. Fill in what changed, why, and how you tested it, and link
   the issue (`Closes #123`). Open it as a draft while it is still in progress.
5. A maintainer reviews the change. Please keep the branch up to date by rebasing on `master` rather
   than merging `master` into it.

## Checks before opening a pull request

```bash
npm test               # Jest must be green
npm run typecheck      # do not add new TypeScript errors
npm run lint           # do not add new ESLint findings
```

For UI changes, also run the app on a device or emulator and add screenshots to the pull request.
Use synthetic data in screenshots, never a real training log, and hide status bar notifications.
If you have [Maestro](https://maestro.mobile.dev/) set up, run the relevant flows in
`__tests__/e2e/maestro/flows/` (see [docs/building.md](docs/building.md#6-end-to-end-tests-with-maestro-optional)).

## Coding rules

These rules come from the project's agent instructions and apply to every change.

### General

- TypeScript, functional programming where possible, separation of UI and business logic.
- App language is English only (UI texts, labels, messages).
- Do not introduce new frameworks or libraries without prior agreement in the issue.
- Reuse existing models in `app/models/entities`; never duplicate a model definition.
- Put files in the right place: screens in `app/tabs`, reusable UI in `app/components`, logic in
  `app/utils`, state in `app/redux`, navigation in `app/routing`. No business logic in navigation
  files.

### Components

- Functional components with a `Props` interface declared above the component.
- Styles at the end of the file via `StyleSheet.create`.
- Keep components below about 200 lines; extract subcomponents when they grow.
- Use React Native Paper components (`Button`, `Card`, `Text`, ...) and `theme.colors`. Do not hard-code
  colors and avoid inline style objects except for trivial layout.
- Use `memo()` for pure components, `useCallback` for handlers, `useMemo` for expensive derived
  values, and `FlashList` instead of `FlatList` for long lists.

### State

- Global state lives in Redux using the normalized pattern (`byId`, `allIds`). Read it through
  selectors, never access the store directly.
- Reducers must be pure; do not mutate state.
- Do not spread class instances (for example `Range`, `NullableRange`) when updating them; spreading
  produces a plain object and breaks `instanceof` checks. Construct a new instance instead.
- No global mutable state outside Redux.

### Naming

- Components: `PascalCase`, files `PascalCase.tsx`.
- Logic, reducers and utils: files `kebab-case.ts`.
- Variables and functions: `camelCase`; constants: `UPPER_CASE`.

### Tests

- Add tests for new logic: business logic, reducers and components (Jest and React Native Testing
  Library), plus a happy-path Maestro flow for new user-facing features where practical.
- Assert the whole expected object rather than single properties.
- Do not use `as` for type assertions in tests; use `satisfies`.
- Test data must be synthetic. Never commit real training logs, device serial numbers, local paths,
  IP addresses or other personal data.

## Developer Certificate of Origin (DCO)

Gainalytics uses the [Developer Certificate of Origin 1.1](https://developercertificate.org/)
instead of a contributor license agreement. By signing off a commit you certify that you wrote the
change or otherwise have the right to submit it under the project's license (AGPL-3.0-or-later).

Sign off every commit with `git commit -s`, which adds a line like this to the message:

```
Signed-off-by: Jane Doe <jane@example.com>
```

Use your real name and an e-mail address you control. Pull requests with unsigned commits cannot be
merged; fix them with `git rebase --signoff master` and force-push your branch.

Commits written with the help of an AI tool are welcome. The human who signs off is responsible for
the change and for its license compliance.

## License

Contributions are licensed under the GNU Affero General Public License v3.0 or later, with the
additional permission described in [LICENSE](LICENSE). If you add a third-party dependency or asset,
make sure its license is compatible and run `node scripts/third-party-notices/generate.js` to update
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
