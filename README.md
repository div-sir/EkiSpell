# EkiSpell · 駅スペル

把想說的話，藏進乘車履歷的站名裡。

EkiSpell is an experimental TypeScript library for station-name letterplay. Match each character to a printed station label, choose candidates, and preview the message in an IC-card history column.

**Status: MVP layout prototype. It does not produce a validated travel itinerary.**

## Quick start

Requires Node.js 22 or later.

```sh
git clone https://github.com/div-sir/EkiSpell.git
cd EkiSpell
npm ci
npm test
npm run dev
```

Open <http://127.0.0.1:4173/demo/>. Try `東京`, `新宿`, or `上野`.

## What works

- Exact printed-character matching, with NFC normalization.
- Region, printer profile, and receipt-verification filters.
- Any-position or fixed-column matching using half-width cells.
- Separate candidates for repeated characters in a label.
- Manual candidate selection and explicit unmatched slots.
- Entry/exit column previews and oldest/newest-first creation order.
- Row-limit and field-width warnings without silent truncation.
- Versioned catalog bundles and selectable print profiles.
- Station-name sources and print-evidence links beside each selected candidate.
- Local catalog import/export and draft save/restore, including v0.1 draft migration.
- Manual station choices survive entry/exit and history-order changes.
- No runtime dependencies, account, tracking, or backend API.

## Library example

Build the repository first. The package is not published to npm yet.

```js
import { matchMessage, buildSequence, renderPreview } from './dist/index.js';
import { sampleStations, demoProfile } from './dist/sample.js';

const slots = matchMessage('東京', sampleStations, {
  profileId: demoProfile.id,
  region: 'kanto',
});
const sequence = buildSequence(slots); // First candidate for each character.
const preview = renderPreview(sequence, demoProfile, 'entry');
console.log(preview.rows, preview.warnings);
```

`buildSequence(slots, { 0: 1 })` selects candidate index 1 for character index 0.
`column` uses **zero-based half-width print cells**. The demo shows these positions starting at 1. ASCII consumes one cell. Supported Japanese/full-width glyphs consume two. Unsupported print glyphs throw an error; EkiSpell does not guess their width.

`preview.complete` means every character has a selection. It does **not** mean the route, print format, or row count is valid. Inspect `overflow` and `warnings`. `rows` always preserve the intended top-to-bottom message. `chronologicalRows` reverse that order for a newest-first profile.

## Real Japanese station data

Click **載入日本真實站名** in the demo to load the pinned TrainLCD/StationAPI dataset: **9,485 operator/station groups across 47 prefectures**, with 601 line memberships and 162 operators. No API key is required. Each candidate keeps its source and line information.

The bundled source is MIT-licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Files are versioned and checked with SHA-256. [Integration details and update instructions](docs/real-data.md).

These are real **station names**, not verified IC printer labels. The source does not establish IC eligibility, permitted paid journeys, fares, or current train service. All generated labels remain unverified.

## Data and limits

The small reset dataset contains **7 official station names**. Their printed labels use an **invented `JR東 ` prefix**. Every label is `unverified`. These are not transcriptions of the supplied reference photo. The photo, card number, balances, and journey history are not included.

Both sample profiles are illustrative: 20 rows / 12 cells with a synthetic prefix, and 10 rows / 8 cells with station names only. They do not establish the limits of any card or machine. Different devices need separately verified profiles. The matcher uses printed text, not station readings; it does not substitute hiragana, katakana, or similar kanji.

The other end of each trip remains `—`. Travel connections, intermediate transactions, fare validity, schedules, and print availability are not checked. Do not treat a layout draft as travel instructions.

Official station-name sources (not printed-label evidence):

- [JR East Tokyo](https://www.jreast.co.jp/estation/stations/1039.html)
- [JR East Shinjuku](https://www.jreast.co.jp/estation/stations/866.html)
- [JR East Shinagawa](https://www.jreast.co.jp/estation/stations/788.html)
- [JR East station index: Shibuya, Yokohama, Ueno, Sendai](https://www.jreast.co.jp/estation/)

## Experimental transaction routing

`planJourney` connects fixed selected labels using a supplied directed transaction network. It counts initial/final trips and any allowed intermediate paid records against the history limit. Search returns `found`, `infeasible`, or `limit-reached`; missing time/fare data remains null.

```sh
npm run example:route
```

The example is entirely fictional. No real railway network is bundled, and the browser remains a layout editor. See [docs/routing.md](docs/routing.md) for the API, network contract, and limits.

## Save and restore

```js
import { createDraft, restoreDraft } from './dist/index.js';
import { sampleBundle } from './dist/sample.js';

const draft = createDraft('東京', sampleBundle, { profileId: 'illustrative-v1' });
const restored = restoreDraft(JSON.parse(JSON.stringify(draft)), sampleBundle);
console.log(restored.preview);
```

Drafts reference the catalog ID/version and selected label identities. Import the original catalog before opening a saved draft. A changed label or version causes an explicit error. The browser retains your current work if import fails. Export the catalog as well when you use custom data.

## Browser checks

```sh
npx playwright install --with-deps chromium
npm run test:browser
```

CI runs this check and saves desktop/mobile screenshots. The local test runner can use an existing Chromium executable through `EKISPELL_CHROMIUM_PATH`. Playwright is a development dependency only.

## Project files

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Public matching and layout API |
| `src/routing.ts` | Bounded transaction-network search |
| `src/catalog.ts` | Versioned catalogs and printer-profile validation |
| `src/draft.ts` | Draft serialization and verified restoration |
| `src/sample.ts` | Small, explicitly unverified sample catalog |
| `demo/` | Browser demo in Traditional Chinese |
| `tests/` | Core behavior and edge cases |
| `docs/data-format.md` | Data contract and evidence rules |
| `docs/roadmap.md` | Milestones and acceptance criteria |
| `docs/validation.md` | Verification results and remaining limits |

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a station or printer profile. Code and original project material use the [MIT License](LICENSE). Third-party evidence retains its source license.
