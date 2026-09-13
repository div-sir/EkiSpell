import { matchMessage, buildSequence, renderPreview, graphemes, cellWidth, validateCatalog } from '../dist/index.js';
import { sampleStations, demoProfile } from '../dist/sample.js';
const $ = id => document.getElementById(id);
let stations = sampleStations;
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
    const options = { profileId: demoProfile.id, region: $('region').value, verifiedOnly: $('verified').checked };
    if ($('alignment').value === 'fixed') options.column = Number($('column').value) - 1;
    const slots = matchMessage($('message').value, stations, options);
    const sequence = buildSequence(slots, selections);
    const profile = { ...demoProfile, order: $('order').value };
    const preview = renderPreview(sequence, profile, $('field').value);
    draft = { schemaVersion: 1, message: $('message').value.normalize('NFC'), profile, options, ...preview };
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
    if (preview.overflow) $('warnings').append(element('li', '超過此示意格式的 20 筆上限；所有列仍保留供檢查。'));
    if (preview.warnings.some(w => w.includes('field width'))) $('warnings').append(element('li', '部分名稱超過欄位寬度。請確認設備的截斷規則。'));
    $('download').disabled = !sequence.length;
  } catch (error) {
    draft = null; $('error').textContent = error.message;
    $('rows').replaceChildren(); $('candidates').replaceChildren(); $('warnings').replaceChildren();
    $('status').textContent = '無法建立預覽'; $('sequence').textContent = ''; $('download').disabled = true;
  }
}
for (const id of ['message', 'region', 'field', 'alignment', 'column', 'order', 'verified']) {
  $(id).addEventListener(id === 'message' || id === 'column' ? 'input' : 'change', () => { selections = {}; render(); });
}
$('catalog').addEventListener('change', async () => {
  const file = $('catalog').files[0]; if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('資料檔上限為 2 MB');
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data) || data.length > 10000) throw new Error('資料必須是最多 10,000 站的陣列');
    validateCatalog(data);
    stations = data; selections = {}; updateRegions(); render();
    $('catalog-note').textContent = `已匯入 ${data.length} 站。只匹配 illustrative-v1 格式；詳見資料文件。`;
  } catch (error) { $('error').textContent = `匯入失敗，保留原資料：${error.message}`; }
  $('catalog').value = '';
});
function updateRegions() {
  $('region').replaceChildren(new Option('全部', ''), ...[...new Set(stations.map(s => s.region))].map(r => new Option(r, r)));
}
$('reset').addEventListener('click', () => {
  stations = sampleStations; selections = {}; updateRegions();
  $('catalog-note').textContent = '已恢復 7 站示範資料。可試「東京」「新宿」「上野」。'; render();
});
$('download').addEventListener('click', () => {
  if (!draft) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
  const link = element('a'); link.href = url; link.download = 'ekispell-draft.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
render();
