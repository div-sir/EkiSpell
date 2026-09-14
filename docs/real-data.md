# Real railway data integration

Research and integration date: 2026-09-14.

## Sources evaluated

| Source | Content found | Decision |
| --- | --- | --- |
| [TrainLCD / StationAPI](https://github.com/TrainLCD/StationAPI) | Community-maintained station, company and line CSVs; root MIT license | Integrated pinned station-name and membership projection |
| [MLIT National Land Numerical Information N02](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v3_1.html) | Nationwide railway/station geometry; the inspected page describes a 2022-12-31 snapshot | Candidate for future spatial validation; geometry is not a transaction network |
| [ODPT](https://ckan.odpt.org/) | Operator-specific transport datasets with dataset-specific licensing conditions | Candidate for timetable and operator adapters; not bundled in this change |
| [piuccio station database](https://github.com/piuccio/open-data-jp-railway-stations) | Combined ekidata/ODPT dataset; author notes incomplete source matching | Not chosen over the maintained, explicitly licensed StationAPI source |

No reusable database inspected here establishes exact IC printer prefixes, abbreviation, padding, or per-device row layout. Station-code lookup tables are not proof of printed output. Consequently, all generated labels use the exact source station name and remain `unverified` under a clearly named **station-name-only** profile.

## Snapshot

Source: `TrainLCD/StationAPI` at `bf6f92d08c6346253713a754944085c526ec6645`.

- 11,148 source station/line rows.
- 10,598 rows remain when station, line, and company all have upstream `e_status=0`.
- 9,485 groups by operator + station group + exact station name.
- 47 prefectures, 601 used lines, 162 used operators.

These are dataset counts, not a claim that all stations operate today. Different operators at an interchange stay separate. Source station IDs and line memberships are preserved. No IC eligibility is inferred, so stations without IC service may appear.

## Use

In the demo, click **載入日本真實站名**. Choose a prefecture and enter text. Candidate details show operator, line memberships, and a pinned source link. The original 7-station demonstration remains available through reset.

The loader fetches the bundled snapshot, checks each file's SHA-256, converts it into a CatalogBundle, and replaces the editor's data only after validation succeeds. Failures preserve current work. There is no dependency on a live upstream API or API key.

For library consumers, `buildStationApiCatalog(manifest, data, licenseText)` accepts the compact dataset. Packaged data is exposed under `ekispell/data/*`. Follow `demo/real-data.js` for assembly and integrity checking. It returns a standard CatalogBundle, so matching and saved drafts use the existing API.

Unsupported print glyphs retain their station identity and source metadata but receive no generated label. They are not silently rewritten. Printer widths and capacity are illustrative, not sourced facts.

## Reproduce or update

```sh
git clone https://github.com/TrainLCD/StationAPI.git /tmp/stationapi
# Check out and review the desired full commit, including its license and schema.
git -C /tmp/stationapi checkout bf6f92d08c6346253713a754944085c526ec6645
python scripts/sync-stationapi.py --source /tmp/stationapi --revision bf6f92d08c6346253713a754944085c526ec6645
npm test
npm run test:browser
```

The sync script requires a clean checkout and exact revision. It uses Python's standard library CSV parser and emits deterministic compact JSON plus checksums. Review changes to station counts, schema, license, and status flags before updating the recorded version. Update dataset assertions when intentionally accepting a new snapshot.

## Routing boundary

Line membership alone does not identify a permitted IC entry/exit transaction. StationAPI's own data guide marks its connections file as unused and evolving. This integration therefore does **not** turn adjacent stops or shared line membership into `JourneyEdge` records. The transaction planner remains ready for an independently validated operator adapter; fares and live schedules are still absent.
