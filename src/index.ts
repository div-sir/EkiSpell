/** All column offsets are zero-based half-width print cells, not UTF-16 offsets. */
export interface Station {
  id: string;
  name: string;
  region: string;
  operator: string;
  nameSource: string;
  labels: PrintedLabel[];
}
export interface PrintedLabel {
  id: string;
  text: string;
  profileId: string;
  verification: 'unverified' | 'receipt-verified';
  evidence?: string;
}
export interface PrintProfile {
  id: string;
  name: string;
  maxRows: number;
  fieldCells: number;
  order: 'oldest-first' | 'newest-first';
}
export interface Candidate {
  stationId: string;
  stationName: string;
  profileId: string;
  labelId: string;
  text: string;
  character: string;
  graphemeIndex: number;
  column: number;
  verification: PrintedLabel['verification'];
}
export interface MatchOptions {
  profileId: string;
  region?: string;
  column?: number;
  verifiedOnly?: boolean;
}
export interface MessageSlot { character: string; candidates: Candidate[] }
export interface SequenceRow {
  messageIndex: number;
  character: string;
  selected: Candidate | null;
}
export interface Preview {
  field: 'entry' | 'exit';
  rows: SequenceRow[];
  chronologicalRows: SequenceRow[];
  complete: boolean;
  overflow: boolean;
  warnings: string[];
}
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text.normalize('NFC')), part => part.segment);
}
/** Conservative MVP model: ASCII=1 cell; kana/CJK/full-width forms=2 cells.
 * Unsupported glyphs fail explicitly. Actual printer metrics require a verified profile. */
export function cellWidth(glyph: string): number {
  if (/^[\x20-\x7e]$/.test(glyph)) return 1;
  if (/^[\u3000-\u303f\u3041-\u3096\u309d-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff01-\uff60]$/u.test(glyph.normalize('NFC'))) return 2;
  throw new Error(`Unsupported print glyph: ${glyph}`);
}
function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
}
export function validateCatalog(stations: unknown): asserts stations is Station[] {
  if (!Array.isArray(stations)) throw new Error('Catalog must be an array');
  const stationIds = new Set<string>();
  for (const station of stations) {
    if (!station || typeof station !== 'object' || !Array.isArray(station.labels)) throw new Error('Invalid station record');
    if (!['id', 'name', 'region', 'operator', 'nameSource'].every(key => typeof station[key] === 'string' && station[key].trim())) throw new Error('Station metadata must contain nonempty strings');
    if (!station.id || stationIds.has(station.id)) throw new Error('Station IDs must be unique and nonempty');
    stationIds.add(station.id);
    if (!station.name || !station.region || !station.operator || !station.nameSource) throw new Error('Station metadata is incomplete');
    const labels = new Set<string>();
    for (const label of station.labels) {
      if (!label || typeof label !== 'object' || !['id', 'text', 'profileId'].every(key => typeof label[key] === 'string' && label[key].length > 0)) throw new Error('Invalid printed label');
      if (label.evidence !== undefined && typeof label.evidence !== 'string') throw new Error('Evidence must be a string');
      if (!label.id || labels.has(label.id) || !label.profileId || !label.text) throw new Error('Invalid printed label');
      labels.add(label.id);
      if (!['unverified', 'receipt-verified'].includes(label.verification)) throw new Error('Invalid verification status');
      if (label.verification === 'receipt-verified' && !label.evidence?.trim()) throw new Error('Verified labels require evidence');
      graphemes(label.text).forEach(cellWidth);
    }
  }
}
export function findCandidates(character: string, stations: readonly Station[], options: MatchOptions): Candidate[] {
  const glyphs = graphemes(character);
  if (glyphs.length !== 1) throw new Error('Match exactly one grapheme at a time');
  if (options.column !== undefined && (!Number.isInteger(options.column) || options.column < 0)) throw new Error('Column must be a nonnegative integer');
  const target = glyphs[0]!;
  const matches: Candidate[] = [];
  for (const station of stations) {
    if (options.region && station.region !== options.region) continue;
    for (const label of station.labels) {
      if (label.profileId !== options.profileId || (options.verifiedOnly && label.verification !== 'receipt-verified')) continue;
      let column = 0;
      graphemes(label.text).forEach((glyph, graphemeIndex) => {
        if (glyph === target && (options.column === undefined || options.column === column)) {
          matches.push({ stationId: station.id, stationName: station.name, profileId: label.profileId, labelId: label.id, text: label.text,
            character: target, graphemeIndex, column, verification: label.verification });
        }
        column += cellWidth(glyph);
      });
    }
  }
  return matches.sort((a, b) => Number(b.verification === 'receipt-verified') - Number(a.verification === 'receipt-verified') || a.column - b.column || a.stationId.localeCompare(b.stationId, 'en') || a.labelId.localeCompare(b.labelId, 'en'));
}
export function matchMessage(message: string, stations: readonly Station[], options: MatchOptions): MessageSlot[] {
  validateCatalog(stations);
  const glyphs = graphemes(message);
  if (glyphs.length > 100) throw new Error('Message exceeds 100 graphemes');
  // Preserve spaces and punctuation. A missing character must not silently disappear.
  return glyphs.map(character => ({ character, candidates: findCandidates(character, stations, options) }));
}
export function buildSequence(slots: readonly MessageSlot[], selections: Readonly<Record<number, number>> = {}): SequenceRow[] {
  return slots.map((slot, messageIndex) => {
    const selection = selections[messageIndex] ?? 0;
    if (!Number.isInteger(selection) || selection < 0 || (slot.candidates.length > 0 && selection >= slot.candidates.length) || (slot.candidates.length === 0 && selection !== 0)) throw new Error('Invalid candidate selection');
    return { messageIndex, character: slot.character, selected: slot.candidates[selection] ?? null };
  });
}
export function renderPreview(sequence: readonly SequenceRow[], profile: PrintProfile, field: 'entry' | 'exit' = 'entry'): Preview {
  positiveInteger(profile.maxRows, 'maxRows');
  positiveInteger(profile.fieldCells, 'fieldCells');
  if (!['oldest-first', 'newest-first'].includes(profile.order)) throw new Error('Invalid print order');
  if (!['entry', 'exit'].includes(field)) throw new Error('Invalid history field');
  const rows = sequence.map(row => ({ ...row, selected: row.selected ? { ...row.selected } : null }));
  if (rows.some(row => row.selected && row.selected.profileId !== profile.id)) throw new Error('Candidate belongs to a different print profile');
  const warnings: string[] = ['Layout draft only. Opposite stations and travel connections are not planned.'];
  const overflow = rows.length > profile.maxRows;
  const complete = rows.length > 0 && rows.every(row => row.selected !== null);
  if (!complete) warnings.push('Some message characters have no selected station, or the message is empty.');
  if (overflow) warnings.push(`Message exceeds the profile limit of ${profile.maxRows} rows. No rows were silently removed.`);
  if (rows.some(row => row.selected?.verification === 'unverified')) warnings.push('Printed names are unverified. Confirm them with the target printer.');
  if (rows.some(row => row.selected && graphemes(row.selected.text).reduce((n, g) => n + cellWidth(g), 0) > profile.fieldCells)) warnings.push('A printed name exceeds the field width. No truncation has been assumed.');
  return { field, rows, chronologicalRows: profile.order === 'newest-first' ? [...rows].reverse() : [...rows], complete, overflow, warnings };
}
