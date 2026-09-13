# MVP validation

Date: 2026-09-13

## Passed locally

- Node.js 24.19.0; TypeScript 5.9.3 strict compilation.
- 16 core tests: label-only matching, cell offsets, repeated glyphs, NFC normalization, unsupported glyphs, missing slots, filters, evidence requirements, invalid metadata, manual selection, history order, overflow, field width, and profile mismatch.
- npm package dry run: JavaScript, declarations, README, and MIT license are included.
- `git diff --check`.

## Not yet verified

- Desktop/mobile browser interaction and visual layout. agent-browser 0.37.1 exited during daemon startup, including one diagnostic retry. The Chromium fallback download timed out. Do not count browser checks as passed.
- Node 22 is configured in CI, but was not run locally.
- Real printer output, travel feasibility, fare calculations, and full regional coverage are outside the implemented MVP.

## Browser review procedure

1. Run `npm ci` and `npm run dev`.
2. Open the demo at desktop size and at 390 px width.
3. Enter `東京`. Expect 2 matched rows.
4. Change the first character's candidate. Expect the preview to update.
5. Enter `新上`. Select fixed position 6. Expect both characters to align.
6. Select the exit field. Expect the entry field to contain dashes.
7. Select newest-first. Expect displayed text to remain `新上` and creation order to be 上野 then 新宿.
8. Enable verified-only. Expect zero matches in the sample catalog.
9. Disable verified-only and enter `新☆`. Expect the missing second row to remain visible.
10. Download JSON. Check the text, selected field, and chronological order.
11. Import malformed JSON. Expect an error and retention of the previous catalog.
12. Check keyboard focus, console errors, and horizontal overflow on mobile.
