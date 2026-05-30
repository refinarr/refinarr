## Summary

<!-- 1-2 sentences: what changed and why -->

## Related issues

<!-- Closes #123, Refs #456, or "none" -->

## Type of change

- [ ] Bug fix (`fix:`)
- [ ] New feature (`feat:`)
- [ ] Breaking change (`feat!:` or `BREAKING CHANGE:` footer)
- [ ] Refactor / chore / docs / test (`refactor:` / `chore:` / `docs:` / `test:` — no release impact)

## Test plan

<!-- How did you verify? -->

- [ ] `yarn lint` passes
- [ ] `yarn tsc --noEmit` passes
- [ ] `yarn test` passes (coverage stays ≥ 85%)
- [ ] `yarn build` passes (RSC boundary check)
- [ ] Manually verified the change in the browser / via the CLI (describe what you tested)

## Screenshots

<!-- For UI changes — before/after if you have them -->

## Checklist

- [ ] PR title follows [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `chore:` etc.)
- [ ] User-facing strings added/changed → keys in `messages/en.json`
- [ ] New API routes wrapped with `createApiHandler()` + validated with zod
- [ ] No new exception classes — use `HttpError` helpers from `src/server/lib/api-errors.ts`
- [ ] No raw `toast.*` calls — use `withToast()`
- [ ] Read [CONTRIBUTING.md](/CONTRIBUTING.md) if you haven't already
