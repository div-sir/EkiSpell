"""Generate compact, attributed station data from a pinned StationAPI checkout.
Usage: python scripts/sync-stationapi.py --source /path/to/StationAPI --revision FULL_SHA
Only source columns listed below are used. No OSM-derived distance columns are copied.
"""
import argparse, csv, hashlib, json, pathlib, subprocess
from collections import defaultdict

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, type=pathlib.Path)
parser.add_argument('--revision', required=True)
args = parser.parse_args()
revision = subprocess.check_output(['git','-C',str(args.source),'rev-parse','HEAD'],text=True).strip()
if revision != args.revision or len(revision) != 40:
    raise SystemExit('Source HEAD must equal the full requested revision')
if subprocess.check_output(['git','-C',str(args.source),'status','--porcelain'],text=True).strip():
    raise SystemExit('Source checkout must be clean')
root = pathlib.Path(__file__).resolve().parents[1] / 'data' / 'stationapi'
root.mkdir(parents=True, exist_ok=True)
source = args.source / 'data'
def read(name):
    with (source / name).open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))
companies = {r['company_cd']:r for r in read('1!companies.csv')}
lines = {r['line_cd']:r for r in read('2!lines.csv')}
rows = read('3!stations.csv')
groups = {}
active = 0
for row in rows:
    line = lines[row['line_cd']]
    company = companies[line['company_cd']]
    if any(r['e_status'] != '0' for r in [row, line, company]):
        continue
    active += 1
    key = (row['station_g_cd'], company['company_cd'], row['station_name'])
    record = groups.setdefault(key, {'name':row['station_name'],'company':company['company_cd'],'pref':int(row['pref_cd']), 'group':row['station_g_cd'], 'members':[]})
    if record['pref'] != int(row['pref_cd']):
        raise ValueError('Cross-prefecture station group needs manual review')
    record['members'].append([row['station_cd'],row['line_cd']])
shards = defaultdict(list)
for row in groups.values():
    members=sorted(row['members'],key=lambda x:int(x[0]))
    # Stable operator/group/name identity avoids merging distinct operators at an interchange.
    suffix=hashlib.sha256(row['name'].encode()).hexdigest()[:12]
    identity=f"{row['company']}:{row['group']}:{suffix}"
    shards[row['pref']].append([identity,row['name'],row['company'],row['group'],members])
files = {}
def write(name, data):
    body = (json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    (root/name).write_bytes(body)
    files[name]={'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body)}
used_lines={m[1] for r in groups.values() for m in r['members']}
used_companies={r['company'] for r in groups.values()}
write('companies.json', {k:companies[k]['company_name'] for k in sorted(used_companies,key=int)})
write('lines.json', {k:[lines[k]['line_name'],lines[k]['company_cd']] for k in sorted(used_lines,key=int)})
for pref,items in sorted(shards.items()):
    write(f'pref-{pref:02d}.json', sorted(items,key=lambda r:r[0]))
license_text=(args.source/'LICENSE').read_text()
if 'MIT License' not in license_text:
    raise ValueError('Review the changed upstream license before importing')
(root/'LICENSE').write_text(license_text)
manifest={
    'schemaVersion':1,'source':'https://github.com/TrainLCD/StationAPI','revision':revision,
    'sourceCommitDate':subprocess.check_output(['git','-C',str(args.source),'show','-s','--format=%cI','HEAD'],text=True).strip(),
    'license':'MIT','licenseText':license_text,'copyright':'Copyright (c) 2019 TinyKitten',
    'inputRows':len(rows),'activeRows':active,'stationCount':len(groups),'lineCount':len(used_lines),'companyCount':len(used_companies),
    'prefectures':sorted(shards),'files':files,
    'notes':['Community station names, not verified IC printed labels.','Grouped by operator, source station group, and exact name.','Only source e_status=0 stations, lines, and companies are included.','Source may contain stale or incomplete status flags. No live service claim.','No fare, timetable, IC eligibility, or transaction edges are inferred.']
}
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ['revision','activeRows','stationCount','lineCount','companyCount']}))
