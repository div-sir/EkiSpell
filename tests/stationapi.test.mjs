import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildStationApiCatalog, matchMessage, createDraft, restoreDraft } from '../dist/index.js';
const base=new URL('../data/stationapi/',import.meta.url);
const json=async name=>JSON.parse(await readFile(new URL(name,base),'utf8'));
const manifest=await json('manifest.json');
const data={companies:await json('companies.json'),lines:await json('lines.json'),prefectures:Object.fromEntries(await Promise.all(manifest.prefectures.map(async p=>[String(p).padStart(2,'0'),await json(`pref-${String(p).padStart(2,'0')}.json`)])))};
const bundle=buildStationApiCatalog(manifest,data,manifest.licenseText);
test('pinned source files match every recorded SHA-256',async()=>{
 for(const [name,info] of Object.entries(manifest.files)) {
  const bytes=await readFile(new URL(name,base)); assert.equal(bytes.length,info.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),info.sha256);
 }
});
test('real catalog has 9485 operator/station groups from all 47 prefectures',()=>{
 assert.equal(bundle.stations.length,9485);assert.equal(new Set(bundle.stations.map(s=>s.region)).size,47);
 assert.equal(bundle.stations.reduce((n,s)=>n+s.sourceStationIds.length,0),10598);
 assert.ok(bundle.stations.every(s=>s.labels.every(l=>l.verification==='unverified')));
 assert.ok(bundle.attribution[0].licenseText.includes('2019 TinyKitten'));
});
test('real Tokyo and Kyoto names participate in matching without synthetic prefixes',()=>{
 const matches=matchMessage('京',bundle.stations,{profileId:'stationapi-name-only',region:'JP-13'})[0].candidates;
 assert.ok(matches.some(m=>m.stationName==='東京'));
 assert.ok(matches.every(m=>m.text===m.stationName));
 assert.equal(matchMessage('京',bundle.stations,{profileId:'stationapi-name-only',verifiedOnly:true})[0].candidates.length,0);
});
test('large real catalog supports saved-draft round trip and attribution export',()=>{
 const draft=createDraft('東京',bundle,{profileId:'stationapi-name-only',region:'JP-13'});
 const restored=restoreDraft(JSON.parse(JSON.stringify(draft)),bundle);
 assert.equal(restored.preview.complete,true);assert.deepEqual(restored.draft,draft);
 assert.ok(JSON.stringify(bundle).length<12000000);
});
test('broken line/company references and incomplete snapshots fail',()=>{
 assert.throws(()=>buildStationApiCatalog({...manifest,stationCount:1},data,manifest.licenseText),/Incomplete/);
 const invalid={...data,companies:{}};
 assert.throws(()=>buildStationApiCatalog(manifest,invalid,manifest.licenseText),/Missing/);
});
