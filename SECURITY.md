# Security policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue. Once the repository is published, use its private GitHub Security Advisory reporting flow. Include reproduction steps, affected versions, impact, and any suggested mitigation.

Until a private reporting channel is configured, do not publish the repository as accepting security reports.

## Security boundaries

- Browser AI credentials are memory-only and must never enter persisted state.
- Uploads use short-lived presigned URLs; the Worker must not proxy file bodies.
- R2 credentials and optional presign bearer tokens belong in Cloudflare secrets, never source files or frontend environment variables.
- Imported project data is untrusted and must pass through `importProject` validation.
- WebMCP mutations use allowlisted fields. Destructive operations and project replacement require explicit confirmation.
- Dependency upgrades that affect parsers, exporters, Konva, ffmpeg.wasm, or the Worker require the complete test gate.

Supported-version details will be added when the project makes its first public release.

