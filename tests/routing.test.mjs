import test from 'node:test';
import assert from 'node:assert/strict';
import { matchMessage, buildSequence, planJourney, validateNetwork } from '../dist/index.js';
const profile = { id: 'fixture', name: 'Synthetic', maxRows: 10, fieldCells: 4, order: 'oldest-first' };
const stations = ['A', 'B', 'C', 'D', 'S', 'T'].map(id => ({ id, name: id, region: 'test', operator: 'fixture', nameSource: 'synthetic:test', labels: [{ id: 'label', text: id, profileId: profile.id, verification: 'unverified' }] }));
const sequence = message => buildSequence(matchMessage(message, stations, { profileId: profile.id }));
const ride = (from, to, extra = {}) => ({ id: `${from}-${to}`, from, to, kind: 'ride', ...extra });
const walk = (from, to) => ({ id: `${from}-${to}-walk`, from, to, kind: 'walk' });
const network = edges => ({ id: 'fixture', version: '1', source: 'synthetic:test', license: 'MIT', verification: 'synthetic', currency: 'JPY', stations: stations.map(s => s.id), edges });
test('entry targets create real transactions and retain positioning records', () => {
  const result = planJourney(sequence('AB'), profile, network([ride('S','A'), ride('A','B'), ride('B','T')]), { start: 'S', end: 'T' });
  assert.equal(result.status, 'found');
  assert.deepEqual(result.records.map(r => r.messageIndex), [null, 0, 1]);
  assert.equal(result.totalFare, null); assert.equal(result.totalMinutes, null);
});
test('exit targets use arrival stations, including a final positioning record', () => {
  const result = planJourney(sequence('AB'), profile, network([ride('S','A'), ride('A','B'), ride('B','T')]), { start: 'S', end: 'T', field: 'exit' });
  assert.deepEqual(result.records.map(r => r.messageIndex), [0, 1, null]);
});
test('external walks connect targets without adding history records', () => {
  const result = planJourney(sequence('AB'), profile, network([ride('A','C'), walk('C','B'), ride('B','T')]), { start: 'A', end: 'T' });
  assert.equal(result.status, 'found'); assert.equal(result.steps.length, 3); assert.equal(result.records.length, 2);
});
test('a station visited only on foot cannot satisfy a printed character', () => {
  const result = planJourney(sequence('A'), profile, network([walk('S','A'), walk('A','T')]), { start: 'S', end: 'T' });
  assert.equal(result.status, 'infeasible');
});
test('extra paid records between letters are rejected unless explicitly allowed', () => {
  const net = network([ride('A','C'), ride('C','B'), ride('B','T')]);
  assert.equal(planJourney(sequence('AB'), profile, net, { start:'A', end:'T' }).status, 'infeasible');
  const result = planJourney(sequence('AB'), profile, net, { start:'A', end:'T', allowInterleavedRecords:true });
  assert.equal(result.status, 'found'); assert.deepEqual(result.records.map(r => r.messageIndex), [0,null,1]);
});
test('row capacity includes positioning and terminal trips', () => {
  const net = network([ride('S','A'), ride('A','B'), ride('B','T')]);
  assert.equal(planJourney(sequence('AB'), { ...profile, maxRows:2 }, net, { start:'S', end:'T' }).status, 'infeasible');
});
test('newest-first reverses target creation order, not the visible message', () => {
  const result = planJourney(sequence('AB'), { ...profile, order:'newest-first' }, network([ride('B','A'), ride('A','T')]), { start:'B', end:'T' });
  assert.equal(result.status, 'found'); assert.deepEqual(result.records.map(r => r.messageIndex), [1,0]);
  assert.deepEqual(result.displayRecords.map(r => r.messageIndex), [0,1]);
});
test('disconnected destinations produce infeasible rather than a partial route', () => {
  const result = planJourney(sequence('A'), profile, network([ride('A','B')]), { start:'A', end:'T' });
  assert.equal(result.status, 'infeasible'); assert.deepEqual(result.steps, []);
});
test('search budget exhaustion is not reported as infeasibility', () => {
  const result = planJourney(sequence('AB'), profile, network([ride('A','B'),ride('B','T')]), { start:'A', end:'T', maxExpansions:1 });
  assert.equal(result.status, 'limit-reached');
});
test('known totals are summed; unknown fare or duration remains unknown', () => {
  const result = planJourney(sequence('A'), profile, network([ride('A','B',{fare:150,minutes:5}), {...walk('B','T'),minutes:3}]), { start:'A', end:'T' });
  assert.equal(result.totalFare, 150); assert.equal(result.totalMinutes, 8);
});
test('minimizes record count ahead of elapsed time', () => {
  const net = network([ride('A','T',{minutes:100}), ride('A','B',{minutes:1}), ride('B','T',{minutes:1})]);
  const result = planJourney(sequence('A'), profile, net, { start:'A',end:'T' });
  assert.equal(result.records.length,1); assert.equal(result.totalMinutes,100);
});
test('zero-cost walk cycles terminate', () => {
  const result = planJourney(sequence('A'), profile, network([walk('S','C'),walk('C','S'),walk('C','A'),ride('A','T')]), { start:'S',end:'T' });
  assert.equal(result.status,'found'); assert.equal(result.steps.length,3);
});
test('repeated station letters require separate rides', () => {
  const result = planJourney(sequence('AA'), profile, network([ride('A','B'),walk('B','A'),ride('A','T')]), {start:'A',end:'T'});
  assert.equal(result.status,'found'); assert.deepEqual(result.records.map(r=>r.messageIndex),[0,1]);
});
test('state budget exhaustion remains explicitly unknown', () => {
  const result = planJourney(sequence('A'), profile, network([ride('A','T')]), {start:'A',end:'T',maxStates:1});
  assert.equal(result.status,'limit-reached'); assert.match(result.reason,/State budget/);
});
test('unmatched text and over-wide labels cannot produce a found route', () => {
  const net = network([ride('A','T')]);
  assert.equal(planJourney(sequence('☆'),profile,net,{start:'A',end:'T'}).status,'infeasible');
  const rows = sequence('A'); rows[0].selected.text = 'AAAAA';
  assert.equal(planJourney(rows,profile,net,{start:'A',end:'T'}).status,'infeasible');
});
test('invalid graph references, costs, claims, and duplicate IDs are rejected', () => {
  for (const edges of [[ride('A','unknown')],[ride('A','A')],[ride('A','T',{fare:-1})],[ride('A','T',{minutes:NaN})],[ride('A','T'),ride('A','T')]]) assert.throws(()=>validateNetwork(network(edges)));
  assert.throws(()=>validateNetwork({...network([]),verification:'verified'}));
  assert.throws(()=>validateNetwork(network([{...walk('A','T'),fare:2}])));
});
test('invalid selection metadata and options are rejected', () => {
  const net=network([ride('A','T')]); const rows=sequence('A'); rows[0].selected.column=2;
  assert.throws(()=>planJourney(rows,profile,net,{start:'A',end:'T'}),/Invalid selected/);
  assert.throws(()=>planJourney(sequence('A'),profile,net,{start:'A',end:'T',maxExpansions:0}));
});
