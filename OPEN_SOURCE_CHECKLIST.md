# Open-source release checklist

## Required before publishing

- [ ] Select and add an explicit `LICENSE` file.
- [ ] Create the public repository and add its URL to `package.json`.
- [ ] Enable GitHub private vulnerability reporting and update `SECURITY.md` with the final contact path.
- [ ] Review every bundled font, icon, template, and fixture for redistribution terms.
- [ ] Confirm `.reference/`, `.codex-tmp/`, `.dev.vars`, `.env*`, build output, coverage, and test artifacts are absent from the first commit.
- [ ] Run a secret scan across the complete initial commit.
- [ ] Run `npm run test:all` from a fresh clone.
- [ ] Confirm the public deployment does not contain private API keys or R2 signing credentials.

## Recommended repository settings

- [ ] Protect the default branch and require CI checks.
- [x] Add Dependabot configuration for frontend, Worker, and GitHub Actions dependencies.
- [x] Add a pull-request template and CI workflow for unit, Worker, build, desktop, and mobile checks.
- [ ] Add issue forms after the public triage labels and contributor workflow are settled.
- [ ] Add a release process and changelog policy before version `1.0.0`.
- [ ] Document browser support, including the experimental status of WebMCP.
