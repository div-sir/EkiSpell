# Validation

## Passed locally

- Node.js 24.19.0; TypeScript 5.9.3 strict compilation.
- 28 core tests, including versioned catalogs, printer evidence requirements, selection identity, v2 save/restore, v1 migration, and stale-data rejection.
- Browser checks passed at desktop size and at 390 px / 320 px viewport widths.
- Browser coverage: candidate preservation across field/order changes, profile isolation, source links, draft and catalog round-trips, version mismatch, malformed imports, fixed columns, verified-only mode, unmatched glyphs, JSON download, and no JavaScript errors or page-level horizontal overflow.
- Desktop and mobile screenshots inspected with CJK fonts installed in the test environment.
- npm package dry run and `git diff --check`.

The original agent-browser daemon did not start. Validation used Playwright with a local Chromium binary instead. No browser runtime is required by the library or demo users. The CI browser job uses Playwright's standard Chromium installation.

## Reproduce

```sh
npm ci
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

The browser script writes `artifacts/desktop.png` and `artifacts/mobile.png`. CI uploads these screenshots. Install CJK fonts if your environment shows missing-character boxes.

## Remaining limits

Real printer output, travel feasibility, fare calculations, and full regional coverage are not implemented or verified. Both built-in print formats remain illustrative. Evidence fields record contributor assertions; the validator does not independently verify receipts.
