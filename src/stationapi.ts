import { inferPrintedLabel, stationApiIcEligibility } from './ic.js';
import { cellWidth, graphemes, type Station } from './index.js';
import { validateBundle, type CatalogBundle } from './catalog.js';
export interface StationApiManifest {
  revision: string;
  stationCount: number;
  sourceCommitDate: string;
}
export type StationApiRow = [string, string, string, string, [string, string][]];
export interface StationApiData {
  companies: Record<string, string>;
  lines: Record<string, [string, string]>;
  prefectures: Record<string, StationApiRow[]>;
}
/** Convert the pinned projection. Original station names are never receipt-verified. */
export function buildStationApiCatalog(manifest: StationApiManifest, data: StationApiData, licenseText: string): CatalogBundle {
  if (!/^[a-f0-9]{40}$/.test(manifest.revision)) throw new Error('Expected full source revision');
  const stations: Station[] = [];
  for (const [pref, rows] of Object.entries(data.prefectures)) {
    if (!/^\d{2}$/.test(pref) || Number(pref) < 1 || Number(pref) > 47) throw new Error('Invalid prefecture');
    for (const [id, name, companyId, groupId, members] of rows) {
      const operator = data.companies[companyId];
      if (!operator || !members.length) throw new Error('Missing station company or membership');
      const lines = [...new Set(members.map(m => m[1]))].map(lineId => {
        const line = data.lines[lineId];
        if (!line || line[1] !== companyId) throw new Error('Invalid station-line-company relationship');
        return { id: `stationapi:${lineId}`, name: line[0] };
      });
      let supported = true;
      try { graphemes(name).forEach(cellWidth); } catch { supported = false; }
      stations.push({ id: `stationapi:${id}`, name, operator, region: `JP-${pref}`,
        nameSource: `https://github.com/TrainLCD/StationAPI/blob/${manifest.revision}/data/3!stations.csv`,
        ic: stationApiIcEligibility(companyId, members.map(m => m[1])),
        lines, sourceStationIds: members.map(m => m[0]), sourceGroupId: groupId,
        labels: supported ? [{ id:'source-name',text:name,profileId:'stationapi-name-only',verification:'unverified' }, inferPrintedLabel(name, {profileId:'ic-inferred-8'})] : []
      });
    }
  }
  if (stations.length !== manifest.stationCount) throw new Error('Incomplete source snapshot');
  const bundle: CatalogBundle = {
    schemaVersion:1,id:'stationapi-japan',version:manifest.revision + ':ic-v2',
    attribution:[{name:'TrainLCD / StationAPI',url:'https://github.com/TrainLCD/StationAPI',license:'MIT',licenseText,revision:manifest.revision}],
    profiles:[{id:'stationapi-name-only',name:'真實站名原文（非 IC 列印格式）',maxRows:20,fieldCells:40,order:'oldest-first',verification:'unverified'}, {id:'ic-inferred-8',name:'IC 印字推測（無前綴／站名最多 8 格；低信心）',maxRows:20,fieldCells:8,order:'oldest-first',verification:'unverified'}],
    stations
  };
  validateBundle(bundle);
  return bundle;
}
