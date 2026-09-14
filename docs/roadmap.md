# Roadmap

## v0.1 — Layout MVP

Goal: turn text into an inspectable station-label layout.

- [x] Strict TypeScript core and declaration output.
- [x] Printed-label matching with NFC and explicit cell positions.
- [x] Region, profile, fixed-column, and verification filters.
- [x] Manual candidate selection; retain unmatched characters.
- [x] Entry/exit preview and chronological ordering.
- [x] Local catalog import and draft JSON export.
- [x] Small sourced station-name dataset with unverified demo labels.
- [x] Core regression tests and Node 22/24 CI configuration.
- [x] Reproducible desktop/mobile browser checks and screenshot CI job.
- [x] MIT license, contribution guide, and data contract.
- [ ] Merge reviewed MVP and tag release after review.

Acceptance: a fresh checkout passes npm ci and npm test. The demo supports keyboard and mobile input. No unverified label is presented as confirmed, and incomplete text stays visible.

## v0.2 — Verified print data

- [x] Integrate a licensed, pinned real station-name dataset with operator/line membership (TrainLCD/StationAPI).
- [x] Add nationwide loading, prefecture filters, attribution, checksums, and deterministic update tooling.
- [ ] Collect verified IC printer labels for these real stations.

- [ ] Define device profiles with operator, model/location context, capture date, ordering, field width, row limits, and evidence.
- [ ] Collect redacted receipt examples under contributor-approved terms.
- [ ] Verify a useful regional station catalog with prefixes and abbreviations.
- [ ] Add validation tooling and duplicate/conflicting-evidence reports.
- [x] Make profiles selectable and show each label's source in the demo.
- [x] Add saved-draft import and catalog version references.

Acceptance: at least one device profile and 50 labels have reviewed evidence. Two contributors can independently reproduce representative layouts. Coverage gaps remain explicit.

## v0.3 — Feasible journeys

- [ ] Select a licensed network data source; record provenance and update method.
- [x] Model each entry/exit transaction, not just a station visit (supplied networks).
- [x] Add start/end stations and verify connectivity between successive transactions (supplied networks).
- [x] Include positioning trips and intermediate history rows in layout constraints.
- [x] Return infeasible results for exhausted networks; budget exhaustion remains unknown.
- [x] Separate model feasibility from fare and timetable availability.

Acceptance: small reference networks cover disconnected stations, extra transactions, reversals, and insufficient row capacity. Real journeys are reviewed against operator rules before being described as feasible.

## v0.4 — Ranking and trip planning

- [ ] Add bounded search over candidate combinations with cancellation and progress.
- [ ] Compare transfers, estimated travel time, walking, and cost.
- [ ] Display the source and timestamp for each fare/time estimate.
- [ ] Add arrival/departure dates and operating-hour constraints.
- [ ] Re-check the entire resulting printed history after each manual change.

Acceptance: ranking explains tradeoffs and never calls an unpriced route free. Search bounds and incomplete results are visible.

## v1.0 — Stable library

- [ ] Stabilize schemas, API naming, error codes, and migration policy.
- [ ] Add Japanese and English UI translations and accessibility review.
- [ ] Add property-based matching tests and a large-catalog performance budget.
- [ ] Publish npm package and versioned documentation after name availability review.
- [ ] Add reproducible release provenance and maintainer instructions.

Not in scope: changing card records, impersonating operator receipts, account scraping, or selling tickets.
