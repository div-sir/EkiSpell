# Station and print data

Keep station identity separate from printer output. A station can have multiple labels for different devices. Do not derive a verified printed label from an official station name.

## Station[] catalog

The browser imports a JSON array. File size is limited to 2 MB and 10,000 stations.

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

## Draft JSON

The demo exports `schemaVersion: 1`, message, matching options, profile, selected rows, chronological rows, and warnings. It is a portable layout draft. Importing a saved draft is not implemented yet. Do not use it as a ticket, a proof of travel, or a routing result.
