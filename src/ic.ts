import { cellWidth, graphemes, type PrintedLabel } from './index.js';
export type IcEligibility = { status: 'unknown' } | {
  status: 'supported' | 'unsupported';
  cards: string[];
  source: string;
  checkedAt: string;
  scope: string;
};
const nationwideCards = ['Kitaca','Suica','PASMO','TOICA','manaca','ICOCA','PiTaPa','SUGOCA','nimoca','はやかけん'];
// Explicit, reviewed StationAPI IDs. Do not auto-include future lines or other operators.
const pasmoLines: Record<string, readonly string[]> = {
  '11':['21001','21002','21003','21004','21005','21006','21007','21008','21009','21010','21011','21012'],
  '12':['22001','22002','22003','22004','22005','22006','22007','22008','22009','22010','22011','22012'],
  '13':['23001','23002','23003','23004','23005','23006','99329'],
  '14':['24001','24002','24003','24004','24005','24006','24007'],
  '15':['25001','25002','25003'],
  '16':['26001','26002','26003','26004','26005','26006','26007','26008','26009'],
  '17':['27001','27002','27003','27004','27005'],
  '18':['28001','28002','28003','28004','28005','28006','28008','28009','28010'],
  '19':['29001','29002','29004'],
  '100':['11345'],
  '119':['99301','99302','99303','99304','99305','99342'],
  '120':['99306'],'121':['99307'],'123':['99309'],'124':['99310'],'125':['99311'],
  '128':['99314'],'130':['99316','99343'],'131':['99317'],'132':['99318','99319'],
  '133':['99320'],'139':['99326'],'144':['99331','99332'],'146':['99334'],
  '150':['99338'],'151':['99339'],'152':['99340']
};
/** Rule coverage, not a station/gate inspection or an end-to-end journey guarantee. */
export function stationApiIcEligibility(companyId: string, lineIds: readonly string[]): IcEligibility {
  const allowed = Object.hasOwn(pasmoLines, companyId) ? pasmoLines[companyId] : undefined;
  if (!allowed || !lineIds.length || !lineIds.every(id => allowed.includes(id))) return {status:'unknown'};
  return {status:'supported',cards:companyId === '132' ? ['PASMO','Suica'] : [...nationwideCards],
    source:'https://www.pasmo.co.jp/area/train/',checkedAt:'2026-09-14',
    scope:'PASMO 官方所列路線一般乘車；依社群路線對照，非逐站實測。卡種依 https://www.pasmo.co.jp/about/sharing/（關東鐵道僅 PASMO／Suica）。不含特別票種，不代表可跨 IC 區域直達或本站可列印。'};
}
/** A user-selected hypothesis, never an observed printer abbreviation. */
export function inferPrintedLabel(name: string, options: {profileId: string; prefix?: string; nameCells?: number}): PrintedLabel {
  const prefix = options.prefix ?? '';
  const limit = options.nameCells ?? 8;
  if (!options.profileId || !Number.isSafeInteger(limit) || limit < 2 || limit > 40) throw new Error('Invalid inference options');
  graphemes(prefix).forEach(cellWidth);
  let text = '', cells = 0;
  for (const glyph of graphemes(name)) {
    const width = cellWidth(glyph);
    if (cells + width > limit) break;
    text += glyph; cells += width;
  }
  if (!text) throw new Error('Missing station name');
  return {id:'inferred-prefix-truncate',profileId:options.profileId,text:prefix+text,verification:'unverified',
    inference:`假設前綴「${prefix || '無'}」＋站名左起最多 ${limit} 半形格；低信心，未套用設備字典或特殊簡稱。`};
}
