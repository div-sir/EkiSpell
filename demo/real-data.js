import { buildStationApiCatalog } from '../dist/index.js';
export async function loadRealCatalog() {
  const base = '../data/stationapi/';
  const response = await fetch(base + 'manifest.json');
  if (!response.ok) throw new Error('無法載入資料版本資訊');
  const manifest = await response.json();
  const read = async name => {
    const result = await fetch(base + name);
    if (!result.ok) throw new Error(`無法載入 ${name}`);
    const bytes = await result.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,'0')).join('');
    if (hex !== manifest.files[name]?.sha256) throw new Error(`資料校驗失敗：${name}`);
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const [companies, lines, ...shards] = await Promise.all([
    read('companies.json'),read('lines.json'),...manifest.prefectures.map(pref => read(`pref-${String(pref).padStart(2,'0')}.json`))
  ]);
  const prefectures = Object.fromEntries(manifest.prefectures.map((pref,i) => [String(pref).padStart(2,'0'),shards[i]]));
  return buildStationApiCatalog(manifest,{companies,lines,prefectures},manifest.licenseText);
}
