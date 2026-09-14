# Transaction routing

`planJourney` searches a supplied, directed **transaction network** for a fixed selection of station labels. It is a model checker, not a railway journey guarantee.

Run `npm run example:route` for a fully fictional example.

## Edges

- `ride`: one complete, permitted entry/exit transaction. It creates exactly one history record. Its endpoints are the entry and exit stations. Intermediate track stops do not create records.
- `walk`: an external connection that creates no card history record.

A network adapter MUST encode mandatory exit/re-entry as separate ride edges. Do not feed raw track adjacency into this API: that would incorrectly count each station-to-station segment as a separate payment. Edges are directed; reverse journeys require separate edges. Same-station transactions are unsupported.

The network requires ID, version, source, license, currency, verification (`synthetic` or `unverified`), station IDs, and edges. These metadata fields record provenance; they do not validate licenses or travel rules.

## Input

```js
const result = planJourney(sequence, profile, network, {
  start: 'station-id',
  end: 'station-id',
  field: 'entry',
  allowInterleavedRecords: false,
  maxExpansions: 10000,
  maxStates: 50000,
});
```

Create `sequence` with `matchMessage` and `buildSequence`. Selected station IDs must exist in the network. Printer profile IDs and cell widths must match. Use a validated catalog to construct selections; routing does not independently verify their evidence.

All generated paid records count against `profile.maxRows`, including initial positioning and final trips. An external walk cannot satisfy a message character.

By default, selected letters occupy consecutive **paid records**. Extra paid records are permitted before the message starts and after it ends. Set `allowInterleavedRecords` only if gaps between letters are acceptable. Such extra rows remain in the result; they are never removed from the printed history.

For newest-first printing, chronological target order is reversed before searching. `records` contains chronological paid records. `displayRecords` contains all paid records in printer order. A record's `messageIndex` identifies the original message character, or is null for an extra record. `steps` also includes walks.

## Outcomes

| Status | Meaning |
| --- | --- |
| `found` | A route satisfies the supplied model and selected constraints |
| `infeasible` | No route satisfies this supplied model, or a required input selection is incomplete |
| `limit-reached` | Search stopped at its expansion/state budget; feasibility is unknown |

Malformed networks or options throw an error. Failure outcomes contain no partial route to avoid confusing a search fragment with a finished journey.

The search minimizes paid history records, then edge count. It does not optimize fares or travel time. Known edge estimates are summed. `totalFare` and `totalMinutes` remain null if required values are missing. Walking has zero **card fare**, not an assertion that every aspect of walking is costless. Currency applies to all fare values in one network.

Limits: 5,000 stations, 50,000 edges, 100 history/message rows, up to 100,000 state expansions, and up to 200,000 discovered states. The default limits are lower. Walk cycles terminate because revisiting an identical state with more steps cannot improve the result.

## Not yet modeled

- Live operating hours, trains, closures, fare validity, and same-station entry/exit rules.
- Additional purchases, top-ups, or other history records outside the supplied edges.
- Whether another transaction label fits the intended printer field.
- Real printer row retention and availability.
- Search over alternative station candidates, cancellation, and ranking tradeoffs.

Use the result to test a network adapter. Do not label an unverified network result as a travel-ready itinerary.
