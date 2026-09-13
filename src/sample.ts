import type { Station, PrintProfile } from './index.js';

/** Illustrative layout, NOT a claim about any card or printing device. */
export const demoProfile: PrintProfile = {
  id: 'illustrative-v1', name: '示意格式（尚未驗證設備）',
  maxRows: 20, fieldCells: 12, order: 'oldest-first'
};
// Official sources establish station names only. Prefix and layout are invented for the demo.
export const sampleStations: Station[] = [
  ['tokyo', '東京', 'https://www.jreast.co.jp/estation/stations/1039.html'],
  ['shinjuku', '新宿', 'https://www.jreast.co.jp/estation/stations/866.html'],
  ['shinagawa', '品川', 'https://www.jreast.co.jp/estation/stations/788.html'],
  ['shibuya', '渋谷', 'https://www.jreast.co.jp/estation/'],
  ['yokohama', '横浜', 'https://www.jreast.co.jp/estation/'],
  ['ueno', '上野', 'https://www.jreast.co.jp/estation/'],
  ['sendai', '仙台', 'https://www.jreast.co.jp/estation/']
].map(([id, name, nameSource]) => ({
  id: `jr-east:${id!}`, name: name!, nameSource: nameSource!,
  region: id === 'sendai' ? 'tohoku' : 'kanto', operator: 'JR East',
  labels: [{ id: 'demo', text: `JR東 ${name!}`, profileId: demoProfile.id, verification: 'unverified' }]
}));
