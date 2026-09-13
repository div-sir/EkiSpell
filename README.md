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
- Local JSON catalog import and draft export in the browser.
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

## Data and limits

The demo contains **7 official station names**. Their printed labels use an **invented `JR東 ` prefix**. Every label is `unverified`. These are not transcriptions of the supplied reference photo. The photo, card number, balances, and journey history are not included.

The sample profile's 20-row / 12-cell limits are illustrative. They do not establish the limits of any card or machine. Different devices need separately verified profiles. The matcher uses printed text, not station readings; it does not substitute hiragana, katakana, or similar kanji.

The other end of each trip remains `—`. Travel connections, intermediate transactions, fare validity, schedules, and print availability are not checked. Do not treat a layout draft as travel instructions.

Official station-name sources (not printed-label evidence):

- [JR East Tokyo](https://www.jreast.co.jp/estation/stations/1039.html)
- [JR East Shinjuku](https://www.jreast.co.jp/estation/stations/866.html)
- [JR East Shinagawa](https://www.jreast.co.jp/estation/stations/788.html)
- [JR East station index: Shibuya, Yokohama, Ueno, Sendai](https://www.jreast.co.jp/estation/)

## Project files

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Public matching and layout API |
| `src/sample.ts` | Small, explicitly unverified sample catalog |
| `demo/` | Browser demo in Traditional Chinese |
| `tests/` | Core behavior and edge cases |
| `docs/data-format.md` | Data contract and evidence rules |
| `docs/roadmap.md` | Milestones and acceptance criteria |
| `docs/validation.md` | Verification results and remaining limits |

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a station or printer profile. Code and original project material use the [MIT License](LICENSE). Third-party evidence retains its source license.
