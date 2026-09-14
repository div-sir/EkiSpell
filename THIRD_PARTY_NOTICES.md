# Third-party data

`data/stationapi/` is a transformed projection of **TrainLCD / StationAPI**:

- Source: https://github.com/TrainLCD/StationAPI
- Revision: `bf6f92d08c6346253713a754944085c526ec6645`
- Upstream license: MIT, Copyright (c) 2019 TinyKitten.
- Full upstream license: [data/stationapi/LICENSE](data/stationapi/LICENSE).

The projection uses station names, status flags, operator identities, prefecture codes, station/group identifiers, and line memberships from `1!companies.csv`, `2!lines.csv`, and `3!stations.csv`. It excludes OSM-derived distance fields, coordinates, fares, and schedules. This is community-maintained information, not an operator certification of current service or IC compatibility.

The generated catalog includes source attribution and the full license text when exported from the browser. EkiSpell code remains under the project's MIT License. Do not remove the upstream notice when redistributing this dataset.
