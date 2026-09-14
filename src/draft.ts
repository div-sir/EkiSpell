import { matchMessage, buildSequence, renderPreview, graphemes, type MatchOptions, type PrintProfile, type Preview } from './index.js';
import { validateBundle, validateProfile, type CatalogBundle } from './catalog.js';
interface SelectionRef { stationId: string; labelId: string; text: string; graphemeIndex: number }
/** Store identities, not candidate array indexes. All results are recomputed on restore. */
export interface SavedDraft {
  schemaVersion: 2;
  catalog: { id: string; version: string };
  message: string;
  profile: PrintProfile;
  options: MatchOptions;
  field: 'entry' | 'exit';
  choices: (SelectionRef | null)[];
}
export interface RestoredDraft {
  draft: SavedDraft;
  selections: Record<number, number>;
  preview: Preview;
}
function profileFor(bundle: CatalogBundle, options: MatchOptions, order?: PrintProfile['order']): PrintProfile {
  const base = bundle.profiles.find(profile => profile.id === options.profileId);
  if (!base) throw new Error('Selected profile is missing from the catalog');
  return { ...base, order: order ?? base.order, ...(order !== undefined && order !== base.order ? { verification: 'unverified' as const } : {}) };
}
export function createDraft(message: string, bundle: CatalogBundle, options: MatchOptions,
  selections: Readonly<Record<number, number>> = {}, field: 'entry' | 'exit' = 'entry', order?: PrintProfile['order']): SavedDraft {
  validateBundle(bundle);
  validateOptions(options);
  const profile = profileFor(bundle, options, order);
  const sequence = buildSequence(matchMessage(message, bundle.stations, options), selections);
  renderPreview(sequence, profile, field);
  return { schemaVersion: 2, catalog: { id: bundle.id, version: bundle.version }, message: message.normalize('NFC'),
    profile, options: { ...options }, field, choices: sequence.map(row => row.selected ? {
      stationId: row.selected.stationId, labelId: row.selected.labelId, text: row.selected.text,
      graphemeIndex: row.selected.graphemeIndex
    } : null) };
}
function validateOptions(value: unknown): asserts value is MatchOptions {
  if (!value || typeof value !== 'object') throw new Error('Missing matching options');
  const o = value as Record<string, unknown>;
  if (typeof o.profileId !== 'string' || !o.profileId) throw new Error('Missing profile ID');
  if (o.region !== undefined && typeof o.region !== 'string') throw new Error('Region must be a string');
  if (o.icCard !== undefined && (typeof o.icCard !== 'string' || !o.icCard.trim())) throw new Error('Invalid IC card');
  if (o.icSupportedOnly !== undefined && typeof o.icSupportedOnly !== 'boolean') throw new Error('icSupportedOnly must be boolean');
  if (o.verifiedOnly !== undefined && typeof o.verifiedOnly !== 'boolean') throw new Error('verifiedOnly must be boolean');
  if (o.column !== undefined && (typeof o.column !== 'number' || !Number.isSafeInteger(o.column) || o.column < 0)) throw new Error('Invalid column');
}
export function restoreDraft(input: unknown, bundle: CatalogBundle): RestoredDraft {
  validateBundle(bundle);
  if (!input || typeof input !== 'object') throw new Error('Draft must be an object');
  const d = input as Record<string, unknown>;
  if (d.schemaVersion !== 1 && d.schemaVersion !== 2) throw new Error('Unsupported draft schema version');
  if (typeof d.message !== 'string') throw new Error('Draft message must be a string');
  if (d.field !== 'entry' && d.field !== 'exit') throw new Error('Invalid history field');
  validateOptions(d.options); validateProfile(d.profile);
  if (d.profile.id !== d.options.profileId) throw new Error('Draft profile and options disagree');
  const profile = profileFor(bundle, d.options, d.profile.order);
  if (profile.maxRows !== d.profile.maxRows || profile.fieldCells !== d.profile.fieldCells) throw new Error('Print profile has changed; review the draft with its original catalog');
  let refs: unknown[];
  if (d.schemaVersion === 2) {
    const catalog = d.catalog as Record<string, unknown> | null;
    if (!catalog || catalog.id !== bundle.id || catalog.version !== bundle.version) throw new Error('Catalog ID or version mismatch; import the original catalog first');
    if (!Array.isArray(d.choices)) throw new Error('Missing draft choices');
    refs = d.choices;
  } else {
    // v0.1 exports had no catalog version. Revalidate every selected label against the active data.
    if (!Array.isArray(d.rows)) throw new Error('Missing legacy draft rows');
    const chars = graphemes(d.message);
    refs = d.rows.map((row, i) => {
      if (!row || row.messageIndex !== i || row.character !== chars[i] || !Object.hasOwn(row, 'selected')) throw new Error('Invalid legacy row');
      return row.selected;
    });
  }
  const slots = matchMessage(d.message, bundle.stations, d.options);
  if (refs.length !== slots.length) throw new Error('Draft choices do not match message length');
  const selections: Record<number, number> = {};
  slots.forEach((slot, i) => {
    const ref = refs[i];
    if (ref === null) {
      if (slot.candidates.length) throw new Error('Previously missing character now has candidates; review this draft');
      return;
    }
    if (!ref || typeof ref !== 'object') throw new Error('Invalid selection reference');
    const r = ref as Record<string, unknown>;
    const index = slot.candidates.findIndex(candidate => candidate.stationId === r.stationId && candidate.labelId === r.labelId && candidate.text === r.text && candidate.graphemeIndex === r.graphemeIndex);
    if (index < 0) throw new Error(`Selected label for character ${i + 1} is missing or changed`);
    selections[i] = index;
  });
  const draft = createDraft(d.message, bundle, d.options, selections, d.field, profile.order);
  const preview = renderPreview(buildSequence(slots, selections), profile, d.field);
  return { draft, selections, preview };
}
