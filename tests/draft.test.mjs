import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraft, restoreDraft, validateBundle, validateProfile, matchMessage, buildSequence, renderPreview } from '../dist/index.js';
import { sampleBundle, demoProfile } from '../dist/sample.js';
const options = { profileId: demoProfile.id };
const copy = value => JSON.parse(JSON.stringify(value));
test('bundle supports multiple isolated print formats', () => {
  validateBundle(sampleBundle);
  assert.equal(matchMessage('東', sampleBundle.stations, options)[0].candidates.length, 8);
  assert.equal(matchMessage('東', sampleBundle.stations, { profileId: 'name-only-demo' })[0].candidates.length, 1);
});
test('duplicate and orphan profiles are rejected', () => {
  const duplicate = copy(sampleBundle); duplicate.profiles.push(duplicate.profiles[0]);
  assert.throws(() => validateBundle(duplicate), /Duplicate/);
  const orphan = copy(sampleBundle); orphan.profiles.pop();
  assert.throws(() => validateBundle(orphan), /Unknown profile/);
  assert.throws(() => validateBundle({ ...sampleBundle, version: '' }), /version/);
});
test('verified profiles require device context, evidence, and valid date', () => {
  assert.throws(() => validateProfile({ ...demoProfile, verification: 'receipt-verified' }), /requires/);
  const profile = { ...demoProfile, verification: 'receipt-verified', device: 'test fixture', evidence: 'synthetic:test', observedAt: '2026-02-30' };
  assert.throws(() => validateProfile(profile), /date/);
  validateProfile({ ...profile, observedAt: '2026-02-28' });
});
test('saved drafts round-trip manual selection, options, field, and order', () => {
  const saved = createDraft('東京', sampleBundle, options, { 0: 2 }, 'exit', 'newest-first');
  const restored = restoreDraft(copy(saved), sampleBundle);
  assert.deepEqual(restored.draft, saved);
  assert.equal(restored.selections[0], 2);
  assert.equal(restored.preview.field, 'exit');
  assert.equal(restored.preview.chronologicalRows[0].character, '京');
});
test('identity references survive station-array reordering', () => {
  const saved = createDraft('東', sampleBundle, options, { 0: 3 });
  const reordered = copy(sampleBundle); reordered.stations.reverse();
  const restored = restoreDraft(saved, reordered);
  assert.equal(restored.preview.rows[0].selected.stationId, saved.choices[0].stationId);
});
test('changed label or catalog version cannot silently substitute a station', () => {
  const saved = createDraft('京', sampleBundle, options);
  assert.throws(() => restoreDraft(saved, { ...sampleBundle, version: 'other' }), /version mismatch/);
  const changed = copy(sampleBundle); changed.stations[0].labels[0].text = 'JR東 京';
  assert.throws(() => restoreDraft(saved, changed), /missing or changed/);
});
test('profile capacity changes require review', () => {
  const saved = createDraft('京', sampleBundle, options);
  const changed = copy(sampleBundle); changed.profiles[0].maxRows = 5;
  assert.throws(() => restoreDraft(saved, changed), /profile has changed/);
});
test('missing characters stay missing and newly available candidates require review', () => {
  const saved = createDraft('☆', sampleBundle, options);
  assert.equal(restoreDraft(saved, sampleBundle).preview.rows[0].selected, null);
  const forged = createDraft('京', sampleBundle, options); forged.choices = [null];
  assert.throws(() => restoreDraft(forged, sampleBundle), /now has candidates/);
});
test('malformed and future draft versions are rejected', () => {
  const saved = createDraft('京', sampleBundle, options);
  for (const malformed of [null, { ...saved, schemaVersion: 999 }, { ...saved, options: null }, { ...saved, field: 'bad' }, { ...saved, choices: [] }, { ...saved, choices: [{}] }, { ...saved, options: { ...options, verifiedOnly: 'false' } }]) assert.throws(() => restoreDraft(malformed, sampleBundle));
});
test('legacy v1 export migrates while ignoring untrusted cached results', () => {
  const rows = buildSequence(matchMessage('東京', sampleBundle.stations, options), { 0: 1 });
  const legacy = { schemaVersion: 1, message: '東京', profile: demoProfile, options, ...renderPreview(rows, demoProfile), complete: false, warnings: ['forged'] };
  const restored = restoreDraft(legacy, sampleBundle);
  assert.equal(restored.draft.schemaVersion, 2); assert.equal(restored.preview.complete, true);
  assert.equal(restored.selections[0], 1); assert.ok(!restored.preview.warnings.includes('forged'));
});
test('legacy rows with wrong message positions fail', () => {
  const rows = buildSequence(matchMessage('京', sampleBundle.stations, options));
  rows[0].character = '東';
  assert.throws(() => restoreDraft({ schemaVersion: 1, message: '京', profile: demoProfile, options, field: 'entry', rows }, sampleBundle), /Invalid legacy/);
});
test('overriding observed print order removes the profile verification claim', () => {
  const bundle = copy(sampleBundle);
  Object.assign(bundle.profiles[0], { verification: 'receipt-verified', device: 'fixture', evidence: 'synthetic:test', observedAt: '2026-09-13' });
  const draft = createDraft('京', bundle, options, {}, 'entry', 'newest-first');
  assert.equal(draft.profile.verification, 'unverified');
  assert.equal(restoreDraft(draft, bundle).draft.profile.verification, 'unverified');
});
