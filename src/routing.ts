import { cellWidth, graphemes, renderPreview, type SequenceRow, type PrintProfile } from './index.js';
import { validateProfile } from './catalog.js';

/** Edges represent complete permitted transactions or external walks, not track segments. */
export interface JourneyEdge {
  id: string;
  from: string;
  to: string;
  kind: 'ride' | 'walk';
  minutes?: number;
  fare?: number;
}
export interface JourneyNetwork {
  id: string;
  version: string;
  source: string;
  license: string;
  verification: 'synthetic' | 'unverified';
  currency: string;
  stations: string[];
  edges: JourneyEdge[];
}
export interface RouteOptions {
  start: string;
  end: string;
  field?: 'entry' | 'exit';
  /** Allow paid records between selected message rows. Default false. */
  allowInterleavedRecords?: boolean;
  maxExpansions?: number;
  maxStates?: number;
}
export interface JourneyStep { edge: JourneyEdge; messageIndex: number | null }
export interface JourneyRecord { entry: string; exit: string; edgeId: string; messageIndex: number | null }
export interface RouteResult {
  status: 'found' | 'infeasible' | 'limit-reached';
  reason: string;
  steps: JourneyStep[];
  records: JourneyRecord[];
  displayRecords: JourneyRecord[];
  expanded: number;
  totalMinutes: number | null;
  totalFare: number | null;
  currency: string;
  warnings: string[];
}
export function validateNetwork(value: unknown): asserts value is JourneyNetwork {
  if (!value || typeof value !== 'object') throw new Error('Network must be an object');
  const n = value as Record<string, unknown>;
  for (const key of ['id', 'version', 'source', 'license', 'currency']) if (typeof n[key] !== 'string' || !n[key].trim()) throw new Error(`Network requires ${key}`);
  if (n.verification !== 'synthetic' && n.verification !== 'unverified') throw new Error('Network verification must be synthetic or unverified');
  if (!Array.isArray(n.stations) || !n.stations.length || n.stations.length > 5000) throw new Error('Network requires 1–5000 station IDs');
  const ids = new Set<string>();
  for (const id of n.stations) {
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) throw new Error('Station IDs must be nonempty and unique');
    ids.add(id);
  }
  if (!Array.isArray(n.edges) || n.edges.length > 50000) throw new Error('Network exceeds 50,000 edges');
  const edgeIds = new Set<string>();
  for (const e of n.edges) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id.trim() || edgeIds.has(e.id)) throw new Error('Edge IDs must be nonempty and unique');
    edgeIds.add(e.id);
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) throw new Error('Edge endpoints must be distinct known stations');
    if (e.kind !== 'ride' && e.kind !== 'walk') throw new Error('Invalid edge kind');
    for (const key of ['minutes', 'fare']) if (e[key] !== undefined && (typeof e[key] !== 'number' || !Number.isFinite(e[key]) || e[key] < 0)) throw new Error(`Invalid edge ${key}`);
    if (e.kind === 'walk' && e.fare !== undefined && e.fare !== 0) throw new Error('External walks cannot have a card fare');
  }
}
interface State { station: string; next: number; count: number; steps: number; parent: State | null; action: JourneyStep | null }
// Binary min-heap: minimize generated records first, then edge count. No unknown fare/time is treated as zero.
class Frontier {
  private items: State[] = [];
  private before(a: State, b: State): boolean { return a.count < b.count || (a.count === b.count && a.steps < b.steps); }
  get size(): number { return this.items.length; }
  push(value: State): void {
    let i = this.items.push(value) - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(value, this.items[parent]!)) break;
      this.items[i] = this.items[parent]!; i = parent;
    }
    this.items[i] = value;
  }
  pop(): State {
    const first = this.items[0]!;
    const last = this.items.pop()!;
    if (this.items.length) {
      let i = 0;
      while (2 * i + 1 < this.items.length) {
        let child = 2 * i + 1;
        if (child + 1 < this.items.length && this.before(this.items[child + 1]!, this.items[child]!)) child++;
        if (!this.before(this.items[child]!, last)) break;
        this.items[i] = this.items[child]!; i = child;
      }
      this.items[i] = last;
    }
    return first;
  }
}
/** Search fixed selected labels. A found route is valid only in the supplied transaction model. */
export function planJourney(sequence: readonly SequenceRow[], profile: PrintProfile, network: JourneyNetwork, options: RouteOptions): RouteResult {
  validateNetwork(network); validateProfile(profile);
  const field = options.field ?? 'entry';
  if (!network.stations.includes(options.start) || !network.stations.includes(options.end)) throw new Error('Start and end must be in the network');
  if (options.allowInterleavedRecords !== undefined && typeof options.allowInterleavedRecords !== 'boolean') throw new Error('allowInterleavedRecords must be boolean');
  const cap = options.maxExpansions ?? 10000;
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 100000) throw new Error('maxExpansions must be between 1 and 100000');
  const stateCap = options.maxStates ?? 50000;
  if (!Number.isSafeInteger(stateCap) || stateCap < 1 || stateCap > 200000) throw new Error('maxStates must be between 1 and 200000');
  if (sequence.length > 100 || profile.maxRows > 100) throw new Error('Routing supports at most 100 message/history rows');
  const preview = renderPreview(sequence, profile, field);
  const warnings = ['Model-only result. Operating hours, fare rules, printer availability, and other card transactions are not validated.',
    network.verification === 'synthetic' ? 'Synthetic network. Do not use this result for travel.' : 'Network has not been independently verified.'];
  if (profile.verification !== 'receipt-verified' || sequence.some(r => r.selected?.verification !== 'receipt-verified')) warnings.push('Print format or selected labels are unverified.');
  const base = { steps: [], records: [], displayRecords: [], expanded: 0, totalMinutes: null, totalFare: null, currency: network.currency, warnings };
  const fail = (reason: string): RouteResult => ({ ...base, status: 'infeasible', reason });
  if (!preview.complete) return fail('Message is empty or has unmatched characters');
  if (preview.overflow) return fail('Message exceeds the history capacity');
  for (let i = 0; i < sequence.length; i++) {
    const row = sequence[i]!; const selected = row.selected!;
    const gs = graphemes(selected.text);
    if (row.messageIndex !== i || selected.character !== row.character || gs[selected.graphemeIndex] !== row.character || selected.column !== gs.slice(0, selected.graphemeIndex).reduce((sum, g) => sum + cellWidth(g), 0)) throw new Error('Invalid selected message row');
    if (!network.stations.includes(selected.stationId)) return fail('Selected station is absent from the network');
    if (gs.reduce((sum, g) => sum + cellWidth(g), 0) > profile.fieldCells) return fail('Selected label exceeds printer field width');
  }
  const targets = preview.chronologicalRows;
  const adjacent = new Map<string, JourneyEdge[]>();
  for (const e of network.edges) { const list = adjacent.get(e.from) ?? []; list.push(e); adjacent.set(e.from, list); }
  const key = (s: State) => JSON.stringify([s.station, s.next, s.count]);
  const frontier = new Frontier();
  const start: State = { station: options.start, next: 0, count: 0, steps: 0, parent: null, action: null };
  const best = new Map([[key(start), 0]]); frontier.push(start);
  let expanded = 0;
  while (frontier.size) {
    const state = frontier.pop();
    if (best.get(key(state)) !== state.steps) continue;
    if (state.next === targets.length && state.station === options.end) {
      const steps: JourneyStep[] = [];
      for (let cursor: State | null = state; cursor?.action; cursor = cursor.parent) steps.push(cursor.action);
      steps.reverse();
      const records = steps.filter(s => s.edge.kind === 'ride').map(s => ({ entry: s.edge.from, exit: s.edge.to, edgeId: s.edge.id, messageIndex: s.messageIndex }));
      return { status: 'found', reason: 'Found in the supplied transaction model; fewest records, then fewest edges', steps,
        records, displayRecords: profile.order === 'newest-first' ? [...records].reverse() : [...records], expanded,
        totalMinutes: steps.every(s => s.edge.minutes !== undefined) ? steps.reduce((sum, s) => sum + s.edge.minutes!, 0) : null,
        totalFare: steps.every(s => s.edge.kind === 'walk' || s.edge.fare !== undefined) ? steps.reduce((sum, s) => sum + (s.edge.kind === 'walk' ? 0 : s.edge.fare!), 0) : null,
        currency: network.currency, warnings };
    }
    if (expanded >= cap) return { ...base, expanded, status: 'limit-reached', reason: 'Search budget exhausted; feasibility remains unknown' };
    expanded++;
    for (const edge of adjacent.get(state.station) ?? []) {
      const count = state.count + Number(edge.kind === 'ride');
      if (count > profile.maxRows) continue;
      const target = targets[state.next];
      const matches = edge.kind === 'ride' && target?.selected?.stationId === (field === 'entry' ? edge.from : edge.to);
      // Branch both ways: an early matching record can be positioning; consuming it greedily can block a later contiguous message.
      const consumeChoices = matches ? [true, false] : [false];
      for (const consume of consumeChoices) {
        if (edge.kind === 'ride' && !consume && state.next > 0 && state.next < targets.length && !options.allowInterleavedRecords) continue;
        const next: State = { station: edge.to, next: state.next + Number(consume), count, steps: state.steps + 1, parent: state,
          action: { edge: { ...edge }, messageIndex: consume ? target!.messageIndex : null } };
        const id = key(next);
        if ((best.get(id) ?? Infinity) <= next.steps) continue;
        if (!best.has(id) && best.size >= stateCap) return { ...base, expanded, status: 'limit-reached', reason: 'State budget exhausted; feasibility remains unknown' };
        best.set(id, next.steps); frontier.push(next);
      }
    }
  }
  return { ...base, expanded, status: 'infeasible', reason: 'No journey satisfies the selected labels, connectivity, row capacity, and interleaving rules in this network' };
}
