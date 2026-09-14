import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';

const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
try {
  await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error(`Server exited: ${code}`))); });
  const launch = { headless: true };
  if (process.env.EKISPELL_CHROMIUM_PATH) {
    launch.executablePath = process.env.EKISPELL_CHROMIUM_PATH;
    launch.args = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  }
  browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1365, height: 1050 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/demo/');
  assert.match(await page.locator('#status').innerText(), /2 \/ 2/);
  await page.locator('#candidate-0').selectOption('1');
  await page.locator('#field').selectOption('exit');
  await page.locator('#order').selectOption('newest-first');
  assert.equal(await page.locator('#candidate-0').inputValue(), '1', 'field/order changes must preserve a manual choice');
  assert.equal(await page.locator('#rows tr').first().locator('td').nth(1).innerText(), '—');
  assert.ok(await page.locator('.source a').count() > 0);

  const download = async id => {
    const pending = page.waitForEvent('download'); await page.locator(id).click();
    return JSON.parse(await readFile(await (await pending).path(), 'utf8'));
  };
  const saved = await download('#download');
  assert.equal(saved.schemaVersion, 2); assert.equal(saved.field, 'exit');
  const importJson = async (id, value) => page.locator(id).setInputFiles({ name: 'data.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.locator('details').nth(1).locator('summary').click();
  await page.locator('#message').fill('上野');
  await importJson('#draft-file', saved);
  await page.waitForFunction(() => document.getElementById('message').value === '東京');
  assert.equal(await page.locator('#candidate-0').inputValue(), '1');
  const mismatch = structuredClone(saved); mismatch.catalog.version = 'missing-version';
  await importJson('#draft-file', mismatch);
  await page.waitForFunction(() => document.getElementById('error').textContent.includes('version mismatch'));
  assert.equal(await page.locator('#message').inputValue(), '東京');

  await page.locator('#profile').selectOption('name-only-demo');
  assert.equal(await page.locator('#candidate-0 option').count(), 1);
  assert.equal(await page.locator('#order').inputValue(), 'newest-first');
  await page.locator('#profile').selectOption('illustrative-v1');
  await page.locator('#message').fill('新上');
  await page.locator('#alignment').selectOption('fixed');
  assert.match(await page.locator('#status').innerText(), /2 \/ 2/);
  await page.locator('#verified').check();
  assert.match(await page.locator('#status').innerText(), /0 \/ 2/);
  await page.locator('#verified').uncheck();
  await page.locator('#message').fill('新☆');
  assert.equal(await page.locator('#rows tr').count(), 2);
  assert.match(await page.locator('#rows').innerText(), /未匹配/);

  await page.locator('details').first().locator('summary').click();
  await importJson('#catalog', [null]);
  await page.waitForFunction(() => document.getElementById('error').textContent.includes('匯入失敗'));
  assert.match(await page.locator('#status').innerText(), /1 \/ 2/);
  const bundle = await download('#export-catalog');
  bundle.id = 'browser-fixture'; bundle.version = '1';
  bundle.stations[0].nameSource = 'javascript:alert(1)';
  await importJson('#catalog', bundle);
  await page.waitForFunction(() => document.getElementById('catalog-note').textContent.includes('browser-fixture'));
  await page.locator('#alignment').selectOption('any');
  await page.locator('#message').fill('京');
  assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
  const custom = await download('#download');
  await page.locator('#reset').click();
  await importJson('#catalog', bundle);
  await page.waitForFunction(() => document.getElementById('catalog-note').textContent.includes('browser-fixture'));
  await importJson('#draft-file', custom);
  await page.waitForFunction(() => document.getElementById('import-status').textContent.includes('候選站已重新驗證'));
  assert.match(await page.locator('#status').innerText(), /1 \/ 1/);

  await page.locator('#load-real').click();
  await page.waitForFunction(() => document.getElementById('catalog-note').textContent.includes('stationapi-japan'));
  await page.locator('#region').selectOption('JP-13');
  await page.locator('#message').fill('東京');
  assert.match(await page.locator('#status').innerText(), /2 \/ 2/);
  assert.ok(await page.locator('.source').count() > 0);
  const realDraft = await download('#download');
  assert.equal(realDraft.catalog.id, 'stationapi-japan');
  await page.locator('#message').fill('上野');
  await importJson('#draft-file', realDraft);
  await page.waitForFunction(() => document.getElementById('message').value === '東京');
  assert.equal(await page.locator('#region').inputValue(), 'JP-13');
  await page.locator('#reset').click();
  await page.locator('#message').fill('東京');
  await page.locator('#field').selectOption('entry');
  await page.locator('details').evaluateAll(nodes => nodes.forEach(node => node.open = false));
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile, selection preservation, profile switching, safe source links, draft/catalog round-trip, invalid imports, alignment, filters, missing glyphs, JSON export, and console errors.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
