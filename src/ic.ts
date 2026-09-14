import { cellWidth, graphemes, type PrintedLabel } from './index.js';
export type IcEligibility = { status: 'unknown' } | {
  status: 'supported' | 'unsupported';
  cards: string[];
  source: string;
  checkedAt: string;
  scope: string;
};
/** Rule coverage, not a station/gate inspection or an end-to-end journey guarantee. */
export function stationApiIcEligibility(companyId: string, lineIds: readonly string[]): IcEligibility {
  const metro = new Set(['28001','28002','28003','28004','28005','28006','28008','28009','28010']);
  if (companyId !== '18' || !lineIds.length || !lineIds.every(id => metro.has(id))) return {status:'unknown'};
  return {status:'supported',cards:['Kitaca','Suica','PASMO','TOICA','manaca','ICOCA','PiTaPa','SUGOCA','nimoca','はやかけん'],
    source:'https://www.tokyometro.jp/ticket/types/pasmo/index.html',checkedAt:'2026-09-14',
    scope:'東京 Metro 9 線一般乘車；依官方業者規則及社群路線對照，非逐站實測。不代表可跨 IC 區域直達或本站可列印。'};
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
