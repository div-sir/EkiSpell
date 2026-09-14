import test from 'node:test';
import assert from 'node:assert/strict';
import { matchMessage, findCandidates, buildSequence, renderPreview, validateCatalog, cellWidth, graphemes } from '../dist/index.js';
import { sampleStations, demoProfile } from '../dist/sample.js';
const options = { profileId: demoProfile.id };
const fixture = text => [{ id: 'fixture', name: '架空駅', region: 'test', operator: 'test', nameSource: 'synthetic:test', labels: [{ id: 'one', text, profileId: demoProfile.id, verification: 'unverified' }] }];
test('sample catalog is valid and all print names are explicitly unverified', () => {
  validateCatalog(sampleStations);
  assert.equal(sampleStations.length, 7);
  assert.ok(sampleStations.every(s => s.labels.every(l => l.verification === 'unverified')));
});
test('matches printed labels, never silently matches official names', () => {
  const data = fixture('AB'); data[0].name = '東京';
  assert.equal(findCandidates('東', data, options).length, 0);
});
test('counts half-width prefix and Japanese characters in physical cells', () => {
  const matches = findCandidates('京', sampleStations, { ...options, column: 7 });
  assert.equal(matches.length, 1); assert.equal(matches[0].stationName, '東京');
  assert.equal(findCandidates('京', sampleStations, { ...options, column: 6 }).length, 0);
});
test('repeated occurrences remain separate choices', () => {
  assert.deepEqual(findCandidates('東', fixture('東東'), options).map(m => m.column), [0, 2]);
});
test('canonical normalization matches decomposed kana without folding different glyphs', () => {
  assert.equal(findCandidates('か\u3099', fixture('が'), options).length, 1);
  assert.equal(findCandidates('カ', fixture('か'), options).length, 0);
});
test('unsupported emoji cannot silently distort print cells', () => {
  assert.deepEqual(graphemes('👩‍✈️'), ['👩‍✈️']);
  assert.throws(() => cellWidth('👩‍✈️'), /Unsupported/);
  assert.equal(matchMessage('👩‍✈️', sampleStations, options)[0].candidates.length, 0);
});
test('keeps spaces and missing characters as explicit slots', () => {
  const sequence = buildSequence(matchMessage('京☆\n', sampleStations, options));
  assert.equal(sequence.length, 3); assert.equal(sequence[1].selected, null); assert.equal(sequence[2].selected, null);
  assert.equal(matchMessage(' 京 ', sampleStations, options).length, 3);
});
test('filters region, profile and verified-only independently', () => {
  assert.equal(findCandidates('仙', sampleStations, { ...options, region: 'kanto' }).length, 0);
  assert.equal(findCandidates('東', sampleStations, { profileId: 'other' }).length, 0);
  assert.equal(findCandidates('東', sampleStations, { ...options, verifiedOnly: true }).length, 0);
});
test('verified data requires evidence and ranks before unverified data', () => {
  const data = fixture('東'); data[0].labels[0].verification = 'receipt-verified';
  assert.throws(() => validateCatalog(data), /evidence/);
  data[0].labels[0].evidence = 'synthetic:test';
  validateCatalog(data);
  assert.equal(findCandidates('東', [...sampleStations, ...data], options)[0].stationId, 'fixture');
});
test('duplicate IDs and invalid widths/columns are rejected', () => {
  assert.throws(() => validateCatalog([...sampleStations, sampleStations[0]]), /unique/);
  assert.throws(() => findCandidates('東', sampleStations, { ...options, column: -1 }), /Column/);
  assert.throws(() => renderPreview([], { ...demoProfile, maxRows: 0 }), /positive/);
});
test('manual selections are applied and invalid indexes are rejected', () => {
  const slots = matchMessage('東', sampleStations, options);
  assert.equal(buildSequence(slots, { 0: 1 })[0].selected.stationId, slots[0].candidates[1].stationId);
  assert.throws(() => buildSequence(slots, { 0: 999 }), /selection/);
});
test('newest-first reverses creation order while preserving top-to-bottom message', () => {
  const sequence = buildSequence(matchMessage('東京', sampleStations, options));
  const result = renderPreview(sequence, { ...demoProfile, order: 'newest-first' }, 'exit');
  assert.equal(result.field, 'exit'); assert.equal(result.rows.map(r => r.character).join(''), '東京');
  assert.equal(result.chronologicalRows.map(r => r.character).join(''), '京東');
  assert.equal(sequence[0].character, '東');
});
test('overflow preserves every row and empty text is incomplete', () => {
  const rows = buildSequence(matchMessage('東'.repeat(21), sampleStations, options));
  const result = renderPreview(rows, demoProfile);
  assert.equal(result.overflow, true); assert.equal(result.rows.length, 21);
  assert.equal(renderPreview([], demoProfile).complete, false);
  assert.throws(() => matchMessage('東'.repeat(101), sampleStations, options), /100/);
});
test('warns about long fields without inventing truncation', () => {
  const sequence = buildSequence(matchMessage('東', fixture('東京東京東京東京'), options));
  assert.ok(renderPreview(sequence, demoProfile).warnings.some(w => w.includes('field width')));
});
test('preview rejects a different printer profile', () => {
  const sequence = buildSequence(matchMessage('京', sampleStations, options));
  assert.throws(() => renderPreview(sequence, { ...demoProfile, id: 'other' }), /different print profile/);
});
test('catalog import rejects malformed data before matching', () => {
  for (const data of [null, {}, [null], [{ labels: [] }], [{ ...sampleStations[0], name: 42 }], [{ ...sampleStations[0], labels: [null] }]]) assert.throws(() => validateCatalog(data));
});
