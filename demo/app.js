import { matchMessage, buildSequence, renderPreview, graphemes, cellWidth, validateCatalog, validateBundle, createDraft, restoreDraft } from '../dist/index.js';
import { sampleBundle, demoProfile } from '../dist/sample.js';
import { loadRealCatalog } from './real-data.js';
const prefectureNames = '北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 靜岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 廣島 山口 德島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿兒島 沖繩'.split(' ');
const regionName = r => /^JP-\d{2}$/.test(r) ? prefectureNames[Number(r.slice(3))-1] ?? r : r;
const $ = id => document.getElementById(id);
let bundle = sampleBundle;
let stations = bundle.stations;
let selections = {};
let draft = null;
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function render() {
  $('error').textContent = '';
  $('column').disabled = $('alignment').value !== 'fixed';
  try {
    const activeProfile = bundle.profiles.find(p => p.id === $('profile').value);
    if (!activeProfile) throw new Error('請選擇列印格式');
    const options = { profileId: activeProfile.id, region: $('region').value, verifiedOnly: $('verified').checked, icSupportedOnly: $('ic-supported').checked };
    if ($('alignment').value === 'fixed') options.column = Number($('column').value) - 1;
    const slots = matchMessage($('message').value, stations, options);
    const sequence = buildSequence(slots, selections);
    const profile = { ...activeProfile, order: $('order').value };
    const preview = renderPreview(sequence, profile, $('field').value);
    draft = createDraft($('message').value, bundle, options, selections, $('field').value, profile.order);
    $('receipt-profile').textContent = profile.name;
    $('profile-note').replaceChildren(document.createTextNode(`${profile.maxRows} 筆 · 每欄 ${profile.fieldCells} 格 · ${draft.profile.verification === 'receipt-verified' ? '有收據佐證（資料提供者標記）' : '格式未驗證'}`));
    if (profile.evidence) $('profile-note').append(sourceLink('格式佐證', profile.evidence));
    $('candidates').replaceChildren();
    slots.forEach((slot, index) => {
      const row = element('div', undefined, 'candidate');
      row.append(element('span', slot.character === ' ' ? '␠' : slot.character, 'glyph'));
      const content = element('div');
      if (!slot.candidates.length) content.append(element('p', '沒有符合的站名。請更換文字、條件或匯入資料。', 'missing'));
      else {
        const label = element('label', `第 ${index + 1} 字 · ${slot.candidates.length} 個候選`);
        label.htmlFor = `candidate-${index}`;
        const select = element('select'); select.id = label.htmlFor;
        slot.candidates.forEach((candidate, i) => {
          const option = element('option', `${candidate.text} · 第 ${candidate.column + 1} 格 · ${candidate.verification === 'unverified' ? '未驗證' : '已驗證'}`);
          option.value = String(i); select.append(option);
        });
        select.value = String(selections[index] ?? 0);
        select.addEventListener('change', () => { selections[index] = Number(select.value); render(); $(`candidate-${index}`).focus(); });
        content.append(label, select);
        const selected = slot.candidates[selections[index] ?? 0];
        const station = stations.find(s => s.id === selected.stationId);
        const printed = station.labels.find(l => l.id === selected.labelId);
        const source = element('p', `${station.operator} · ${station.name}${station.lines?.length ? " · " + station.lines.map(l => l.name).join("／") : ""} · `, 'source');
        source.append(sourceLink('正式站名來源', station.nameSource));
        if (printed.evidence) source.append(document.createTextNode(' · '), sourceLink('列印佐證', printed.evidence));
        else source.append(document.createTextNode(' · 列印名稱尚無佐證'));
        if (printed.inference) source.append(document.createTextNode(' · ' + printed.inference));
        const ic = station.ic;
        source.append(document.createTextNode(ic?.status === 'supported' ? ' · IC：官方規則涵蓋（資料提供者標記）' : ic?.status === 'unsupported' ? ' · IC：指定卡種不支援' : ' · IC：未知'));
        if (ic && ic.status !== 'unknown') {
          source.append(document.createTextNode(` · ${ic.cards.join('／')} · 查核 ${ic.checkedAt} · ${ic.scope} · `), sourceLink('IC 依據', ic.source));
        }
        content.append(source);
      }
      row.append(content); $('candidates').append(row);
    });
    $('rows').replaceChildren();
    preview.rows.forEach((row, i) => {
      const tr = element('tr'); tr.append(element('td', String(i + 1).padStart(2, '0')));
      for (const field of ['entry', 'exit']) {
        const td = element('td');
        if (field !== preview.field) td.textContent = '—';
        else if (!row.selected) td.textContent = '［未匹配］';
        else {
          const label = element('span', undefined, 'print-label');
          graphemes(row.selected.text).forEach((g, index) => {
            const cell = element('span'); cell.style.width = `${cellWidth(g)}ch`;
            cell.append(element(index === row.selected.graphemeIndex ? 'mark' : 'span', g)); label.append(cell);
          }); td.append(label);
        }
        tr.append(td);
      }
      $('rows').append(tr);
    });
    const count = sequence.filter(row => row.selected).length;
    $('status').textContent = `${count} / ${sequence.length} 字已匹配 · ${preview.overflow ? '超過示意格式筆數' : '預覽由上往下閱讀'}`;
    $('sequence').textContent = `紀錄建立順序（僅排字）：${preview.chronologicalRows.map(row => row.selected?.stationName ?? '？').join(' → ') || '請輸入文字'}`;
    $('warnings').replaceChildren();
    if (preview.overflow) $('warnings').append(element('li', `超過此格式的 ${profile.maxRows} 筆上限；所有列仍保留供檢查。`));
    if (preview.warnings.some(w => w.includes('field width'))) $('warnings').append(element('li', '部分名稱超過欄位寬度。請確認設備的截斷規則。'));
    $('download').disabled = !sequence.length;
  } catch (error) {
    draft = null; $('error').textContent = error.message;
    $('rows').replaceChildren(); $('candidates').replaceChildren(); $('warnings').replaceChildren();
    $('status').textContent = '無法建立預覽'; $('sequence').textContent = ''; $('download').disabled = true;
  }
}
function sourceLink(title, value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Not a web link');
    const link = element('a', title); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
  } catch { return element('span', `${title}：${value}`); }
}
function updateControls(profileId = bundle.profiles[0].id) {
  $('profile').replaceChildren(...bundle.profiles.map(p => new Option(p.name, p.id)));
  $('profile').value = profileId;
  $('region').replaceChildren(new Option('全部', ''), ...[...new Set(stations.map(s => s.region))].map(r => new Option(regionName(r), r)));
  const profile = bundle.profiles.find(p => p.id === profileId);
  $('order').value = profile.order;
  $('column').max = String(profile.fieldCells);
  $('catalog-note').textContent = `${stations.length} 站 · ${bundle.id} / ${bundle.version}。未匹配的字會保留空位。`;
}
for (const id of ['message', 'region', 'alignment', 'column', 'verified', 'ic-supported']) {
  $(id).addEventListener(id === 'message' || id === 'column' ? 'input' : 'change', () => { selections = {}; $('import-status').textContent = ''; render(); });
}
for (const id of ['field', 'order']) $(id).addEventListener('change', render);
$('profile').addEventListener('change', () => {
  selections = {}; const profile = bundle.profiles.find(p => p.id === $('profile').value);
  $('order').value = profile.order; $('column').max = String(profile.fieldCells); render();
});
async function readJson(input) {
  const file = input.files[0];
  if (!file) return undefined;
  if (file.size > 12_000_000) throw new Error('資料檔上限為 12 MB');
  return JSON.parse(await file.text());
}
$('catalog').addEventListener('change', async () => {
  try {
    const data = await readJson($('catalog')); if (data === undefined) return;
    let next = data;
    if (Array.isArray(data)) {
      validateCatalog(data);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
      const version = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
      next = { schemaVersion: 1, id: 'legacy-local', version, profiles: [demoProfile], stations: data };
    }
    validateBundle(next);
    bundle = next; stations = bundle.stations; selections = {}; updateControls(); render();
    $('import-status').textContent = '站名資料已載入。';
  } catch (error) { $('error').textContent = `匯入失敗，保留原資料：${error.message}`; }
  $('catalog').value = '';
});
$('draft-file').addEventListener('change', async () => {
  try {
    const data = await readJson($('draft-file')); if (data === undefined) return;
    const restored = restoreDraft(data, bundle);
    const d = restored.draft;
    // Commit UI state only after the complete draft has validated.
    updateControls(d.profile.id);
    if (d.options.region && ![...$('region').options].some(o => o.value === d.options.region)) $('region').add(new Option(d.options.region, d.options.region));
    $('message').value = d.message; $('region').value = d.options.region ?? '';
    $('field').value = d.field; $('order').value = d.profile.order;
    $('alignment').value = d.options.column === undefined ? 'any' : 'fixed';
    $('column').value = String((d.options.column ?? 5) + 1);
    $('ic-supported').checked = d.options.icSupportedOnly ?? false;
    $('verified').checked = d.options.verifiedOnly ?? false;
    selections = restored.selections; render();
    $('import-status').textContent = data.schemaVersion === 1 ? '舊版草稿已重新驗證並轉為新版。' : '草稿已還原，候選站已重新驗證。';
  } catch (error) { $('error').textContent = `草稿匯入失敗，保留目前內容：${error.message}`; }
  $('draft-file').value = '';
});
$('reset').addEventListener('click', () => {
  bundle = sampleBundle; stations = bundle.stations; selections = {}; updateControls(); render();
  $('import-status').textContent = '已恢復示範資料。';
});
function downloadJson(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = element('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('load-real').addEventListener('click', async () => {
  $('load-real').disabled = true; $('real-status').textContent = '正在載入及校驗全國站名資料…';
  try {
    const next = await loadRealCatalog();
    bundle = next; stations = bundle.stations; selections = {}; updateControls(); render();
    $('real-status').textContent = `已載入 ${stations.length.toLocaleString()} 筆車站資料（依營運公司分組）。站名為社群資料；IC 列印未驗證。`;
  } catch (error) { $('real-status').textContent = `載入失敗，保留目前資料：${error.message}`; }
  finally { $('load-real').disabled = false; }
});
$('download').addEventListener('click', () => { if (draft) downloadJson(draft, 'ekispell-draft.json'); });
$('export-catalog').addEventListener('click', () => downloadJson(bundle, 'ekispell-catalog.json'));
updateControls();
render();
