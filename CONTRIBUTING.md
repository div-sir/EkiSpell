# Contributing

Run `npm ci`, then `npm test`. Use `npm run dev` to inspect the demo.

Keep changes focused. Describe the behavior, reason, and validation in the pull request. Use short sentences and consistent technical terms.

## Station data

1. Identify the station and operator.
2. Link to an official source for the station name.
3. Record the printed label separately.
4. Keep an inferred label `unverified`.
5. Supply a redacted specimen and device context before using `receipt-verified`.

Do not commit card numbers, balances, identifiable journey histories, or a contributor's original receipt without permission. Crop to the necessary label where possible. Record the source license and permission for redistributed evidence. Official web pages prove station names, not printer output.

## Core changes

Add tests when behavior changes. Cover missing characters, normalization, physical columns, repeated matches, and invalid inputs where relevant. Do not silently rewrite text or discard records to make a layout appear successful.

Prefer pure functions in `src/`. Keep the browser demo separate. Do not add runtime dependencies without explaining their purpose.

## Releases

Use a reviewed pull request. Maintainers decide when to merge, tag, and publish. An npm package version in package.json does not mean that version has been released.
