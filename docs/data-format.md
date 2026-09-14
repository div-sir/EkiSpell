# Station and print data

Keep station identity separate from printer output. A station can have multiple labels for different devices. Do not derive a verified printed label from an official station name.

## Station[] catalog

The browser imports a JSON array. File size is limited to 12 MB and 10,000 stations.

```json
[
  {
    "id": "jr-east:tokyo",
    "name": "東京",
    "region": "kanto",
    "operator": "JR East",
    "nameSource": "https://www.jreast.co.jp/estation/stations/1039.html",
    "labels": [
      {
        "id": "demo",
        "text": "JR東 東京",
        "profileId": "illustrative-v1",
        "verification": "unverified"
      }
    ]
  }
]
```

This printed text is invented for demonstration. It is not receipt evidence.

- `id` MUST be nonempty and unique across stations. Use an operator namespace.
- `name`, `region`, `operator`, and `nameSource` MUST be nonempty strings.
- `labels` MUST be an array. An empty array means no known print variant.
- Each label ID MUST be unique within its station.
- `text` MUST retain printed prefixes and spaces. Matching normalizes to NFC, not NFKC.
- `profileId` MUST identify the device/format context. The initial demo uses only `illustrative-v1`.
- `verification` MUST be `unverified` or `receipt-verified`.
- `evidence` MUST be nonempty for `receipt-verified`. Link to a reviewed, redacted specimen or repository evidence record. The validator checks presence, not authenticity.

The runtime validator checks structural requirements and supported label glyphs. It does not verify URLs, source licensing, travel rules, or whether a receipt supports a claim.

## PrintProfile

| Field | Meaning |
| --- | --- |
| `id` | Stable format identifier matching a label's profileId |
| `name` | Human-readable device/format description |
| `maxRows` | Positive integer history-row budget |
| `fieldCells` | Positive integer width of one station field |
| `order` | `oldest-first` or `newest-first` |

The MVP cell model supports ASCII and common full-width Japanese/CJK glyphs. An ASCII character uses 1 cell, and a Japanese character uses 2 cells. Half-width kana, emoji, supplementary ideographs, and unhandled combining sequences are rejected in printed labels. Add an explicit width model and tests before supporting another character set.

Row capacity applies to the draft's selected rows only. A future travel planner MUST also count positioning trips, intermediate transactions, and any other records created by the journey.

## CatalogBundle

Prefer a versioned bundle over a bare station array:

```json
{
  "schemaVersion": 1,
  "id": "my-stations",
  "version": "2026-09-13.1",
  "profiles": [{
    "id": "illustrative-v1",
    "name": "Illustrative only",
    "maxRows": 20,
    "fieldCells": 12,
    "order": "oldest-first"
  }],
  "stations": []
}
```

Every label profileId MUST resolve to exactly one profile. A bundle requires 1–100 profiles and at most 10,000 stations. Change the catalog version whenever its content changes. Bundle import replaces the active catalog after validation.

Legacy Station[] imports use the illustrative-v1 profile, a `legacy-local` ID, and a SHA-256 version of JSON.stringify(data). Other profile IDs require a full bundle. Export the bundle after import to preserve its identity.

A profile CAN include `verification`, `device`, `observedAt` (YYYY-MM-DD), and `evidence`. `receipt-verified` profiles MUST supply the other three fields. This is a contributor assertion, not independent verification by EkiSpell. A verified station label does not automatically verify its printer profile.

## Draft JSON v2

The demo exports `schemaVersion: 2`, `catalog: { id, version }`, message, options, profile, field, and choices. Each choice is null or `{ stationId, labelId, text, graphemeIndex }`. Store character occurrence identity, not candidate-array indexes.

`restoreDraft` validates the active catalog, matching options, profile dimensions, and every selected label. It then recomputes the preview and warnings. Catalog/version mismatches or stale choices cause an error. A previously unmatched character that now has candidates also requires review. Cached completion or verification claims are not trusted.

Legacy v1 drafts are accepted by validating their rows against the current catalog. They have no catalog version, so migration checks selected label identity/text/position and printer dimensions. New exports always use v2.

Drafts contain no connected route. Do not use them as tickets, proof of travel, or routing results. Source links are displayed as clickable links only for HTTP(S); other evidence references remain plain text.

Changing the order of a receipt-verified profile produces an unverified draft profile. The original device evidence does not verify an altered layout.

Station records may also retain `lines`, `sourceStationIds`, and `sourceGroupId`. CatalogBundle may retain `attribution` entries containing name, source URL, license, full license text, and revision. Real-data exports preserve these fields.
