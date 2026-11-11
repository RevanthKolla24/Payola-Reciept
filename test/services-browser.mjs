import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STREAMING_SERVICES } from '../attribution.js';
import { YOUTUBE_ACTIVITY_DISCLOSURE_LINES } from '../service-history.js';
import { sessionText } from '../session.js';
import { visitControl } from './page-helpers.mjs';
import { launchBrowser } from './browser-engine.mjs';
const browser = await launchBrowser();
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(base + '/') && !request.url().startsWith('blob:')) external.push(request.url()); });
  await page.route('**/api/integrations', route => route.fulfill({ json: { lastfm: false, apple: false } }));
  page.on('dialog', dialog => dialog.accept());
  for (const [service, name] of Object.entries(STREAMING_SERVICES)) {
    await page.goto(base + '/import');
    if (service !== 'spotify') await page.locator('#service-picker').selectOption(service);
    if (service !== 'spotify') {
      assert.match(await page.locator('#calculation-formula').textContent(), /No history loaded/);
      assert.equal(await page.locator('.amount-head').textContent(), 'UNPRICED');
    }
    assert.match(await page.locator('#service-guide-title').textContent(), new RegExp(name));
    await page.locator('[data-mode="manual"]').click();
    await page.locator('#manual-form [name="artist"]').fill('Seven Services Artist');
    await page.locator('#manual-form [name="plays"]').fill('25');
    await page.locator('#manual-form [type="submit"]').click();
    await page.locator('nav a[href="/receipt"]').click();
    assert.match(await page.locator('#receipt').textContent(), new RegExp(name, 'i'));
    if (service !== 'spotify') assert.match(await page.locator('#receipt .currency-label').textContent(), /UNPRICED/);
    await page.locator('nav a[href="/history"]').click();
    const download = page.waitForEvent('download'); await page.locator('#save-session').click();
    const saved = await download, text = await readFile(await saved.path(), 'utf8');
    assert.equal(JSON.parse(text).selectedService, service);
    await page.goto(base + '/import');
    await page.locator('[data-mode="manual"]').click();
    await page.locator('#manual-form [name="artist"]').fill('Replacement artist');
    await page.locator('#manual-form [name="plays"]').fill('7');
    await page.locator('#manual-form [type="submit"]').click();
    assert.equal(await page.locator('#stat-plays').textContent(), '7');
    await page.locator('nav a[href="/history"]').click();
    await page.locator('#restore-session').setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await page.waitForFunction(service => document.querySelector('#service-picker').value === service && document.querySelector('#stat-plays').textContent === '25', service);
    await page.waitForFunction(() => document.querySelector('#session-feedback').textContent.includes('restored'));
    assert.match(await page.locator('#history-warning').textContent(), /Restored from a user-editable/);
    assert.equal(await page.locator('#manual-form [name="artist"]').inputValue(), 'Seven Services Artist');
    await page.goto(base + '/import');
    if (service !== 'spotify') await page.locator('#service-picker').selectOption(service);
    await page.locator('[data-mode="csv"]').click();
    await page.locator('#csv-duration-unit').selectOption('seconds');
    await page.locator('#history-files').setInputFiles({ name: 'events.csv', mimeType: 'text/csv', buffer: Buffer.from('date,artist,track,ms_played\n2026-01-02T01:00:00+02:00,Seven Services Artist,Song,45') });
    await page.locator('#csv-refresh-preview').click();
    await page.waitForFunction(() => !document.querySelector('#csv-stage').disabled);
    assert.match(await page.locator('#csv-preview').textContent(), /45,000/);
    await page.locator('#csv-stage').click(); await page.locator('#confirm-import').click();
    await page.locator('nav a[href="/receipt"]').click();
    assert.match(await page.locator('#receipt').textContent(), new RegExp(name, 'i'));
    assert.match(await page.locator('#receipt .currency-label').textContent(), /UNPRICED/);
    if (service === 'spotify') {
      await page.evaluate(() => {
        window.csvCardText = [];
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function(...args) { window.csvCardText.push(args[0]); return original.apply(this, args); };
      });
      await page.locator('#preview-receipt').click();
      await page.locator('#receipt-preview-dialog').waitFor({ state: 'visible' });
      assert.match((await page.evaluate(() => window.csvCardText)).join(' '), /service self-reported, not verified/);
      assert.match((await page.evaluate(() => window.csvCardText)).join(' '), /Duration and coverage unverified/);
      await page.locator('#close-receipt-preview').click();
      assert.equal(await page.locator('#preview-receipt').evaluate(el => el === document.activeElement), true);
    }
  }
  await page.goto(base + '/import'); await page.locator('#service-picker').selectOption('youtube');
  await page.locator('[data-mode="csv"]').click(); await page.locator('#event-format').selectOption('youtube');
  assert.equal(await page.locator('#mapped-csv-fields').isVisible(), false);
  const event = { title: 'Watched Music <safe>', titleUrl: 'https://music.youtube.com/watch?v=abcdefghijk', time: '2026-01-02T00:00:00Z', subtitles: [{ name: '<Channel>' }] };
  await page.locator('#history-files').setInputFiles({ name: 'watch-history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([event, { ...event, titleUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }])) });
  await page.locator('#confirm-import').waitFor();
  assert.equal(await page.locator('#event-format').isDisabled(), true);
  assert.match(await page.locator('#import-feedback').textContent(), /1 ambiguous/);
  assert.equal(await page.locator('#stat-plays').textContent(), '0');
  await page.locator('#confirm-import').click();
  await page.locator('nav a[href="/receipt"]').click();
  assert.equal(await page.locator('#receipt-plays').textContent(), '1');
  assert.match(await page.locator('#receipt').textContent(), /channel names are not verified artists/);
  await page.evaluate(() => {
    window.serviceCardText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(...args) { window.serviceCardText.push(args[0]); return original.apply(this, args); };
  });
  await page.locator('#preview-receipt').click();
  await page.locator('#receipt-preview-dialog').waitFor({ state: 'visible' });
  const drawn = await page.evaluate(() => window.serviceCardText);
  for (const line of YOUTUBE_ACTIVITY_DISCLOSURE_LINES) assert.ok(drawn.includes(line), `Missing PNG disclosure: ${line}`);
  await page.locator('#close-receipt-preview').click();
  await page.locator('nav a[href="/history"]').click();
  const download = page.waitForEvent('download'); await page.locator('#save-session').click();
  const saved = await download, data = JSON.parse(await readFile(await saved.path(), 'utf8'));
  assert.equal(data.records[0].origin, 'youtube-takeout'); assert.equal(data.records[0].ms, null);
  assert.equal(data.activityAudit.ambiguous, 1);
  await page.goto(base + '/import');
  await page.locator('nav a[href="/history"]').click();
  await page.locator('#restore-session').setInputFiles({ name: 'activity.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.waitForFunction(() => document.querySelector('#history-warning').textContent.includes('not verified recording artists'));
  assert.match(await page.locator('#history-details').textContent(), /excluded general\/ambiguous: 1/);
  await visitControl(page, '#quality-report');
  assert.match(await page.locator('#quality-report').textContent(), /excluded general\/ambiguous: 1/);
  await visitControl(page, '#download-diagnostics');
  const diagnosticsDownload = page.waitForEvent('download'); await page.locator('#download-diagnostics').click();
  const diagnostic = JSON.parse(await readFile(await (await diagnosticsDownload).path(), 'utf8'));
  assert.equal(diagnostic.activityAudit.ambiguous, 1);
  await visitControl(page, '#compare-file-a');
  const scrobbles = service => sessionText({ mode: 'lastfm', selectedService: 'apple', records: [], filters: { from: '', to: '' }, duplicates: 0, attribution: { service, confirmed: service !== 'unknown', scenario: false, from: '2026-01-01', to: '2026-01-02' }, lastfm: { skipped: 0, duplicates: 0 } });
  for (const [side, service] of [['a', 'spotify'], ['b', 'unknown']]) await page.locator(`#compare-file-${side}`).setInputFiles({ name: side + '.json', mimeType: 'application/json', buffer: Buffer.from(scrobbles(service)) });
  await page.locator('#compare-sessions').click();
  await page.waitForFunction(() => document.querySelector('#session-comparison').textContent.includes('A: Spotify'));
  assert.match(await page.locator('#session-comparison').textContent(), /B: Multiple services \/ Not sure/);
  const oldActivity = { ...data }; delete oldActivity.activityAudit;
  await page.goto(base + '/import'); await visitControl(page, '#restore-session');
  await page.locator('#restore-session').setInputFiles({ name: 'older-activity.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldActivity)) });
  await page.waitForFunction(() => document.querySelector('#history-details').textContent.includes('Unavailable in this older backup'));
  await visitControl(page, '#quality-report');
  assert.match(await page.locator('#quality-report').textContent(), /zero exclusions must not be inferred/);
  await visitControl(page, '#compare-file-a');
  for (const side of ['a', 'b']) await page.locator(`#compare-file-${side}`).setInputFiles({ name: `${side}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldActivity)) });
  await page.locator('#compare-sessions').click();
  await page.waitForFunction(() => !document.querySelector('#download-comparison').hidden);
  assert.match(await page.locator('#session-comparison').textContent(), /channel names are not verified artists/);
  assert.match(await page.locator('#session-comparison').textContent(), /provenance is not authenticated/);
  assert.match(await page.locator('#session-comparison').textContent(), /exclusion counts are unavailable/);
  // A restored declaration must be explicitly opted in again; scenario images
  // must retain Last.fm's unknown-duration/eligibility warning.
  const scenario = sessionText({ mode: 'lastfm', selectedService: 'spotify', records: [{ source: 'lastfm', date: '2026-01-01', artist: 'Scenario artist', track: 'Track', ms: null, supported: true }], filters: { from: '', to: '' }, duplicates: 0,
    attribution: { service: 'spotify', confirmed: true, scenario: true, from: '2026-01-01', to: '2026-01-02' }, lastfm: { skipped: 0, duplicates: 0 } });
  await page.locator('#restore-session').setInputFiles({ name: 'scenario.json', mimeType: 'application/json', buffer: Buffer.from(scenario) });
  await page.waitForFunction(() => !document.querySelector('#restore-scenario').hidden);
  await page.locator('#restore-scenario').click();
  await visitControl(page, '#preview-receipt');
  await page.evaluate(() => {
    window.scenarioCardText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(...args) { window.scenarioCardText.push(args[0]); return original.apply(this, args); };
  });
  await page.locator('#preview-receipt').click();
  await page.locator('#receipt-preview-dialog').waitFor({ state: 'visible' });
  assert.match((await page.evaluate(() => window.scenarioCardText)).join(' '), /Actual duration and eligibility unknown/);
  await page.locator('#close-receipt-preview').click();
  // Imported metadata may contain display controls; normalize only the summary,
  // preserving the original history in the session.
  const controls = sessionText({ mode: 'manual', selectedService: 'spotify', records: [], filters: { from: '', to: '' }, duplicates: 0, manual: { artist: 'Artist\u0001Name', plays: 1 } });
  await visitControl(page, '#restore-session');
  await page.locator('#restore-session').setInputFiles({ name: 'controls.json', mimeType: 'application/json', buffer: Buffer.from(controls) });
  await page.waitForFunction(() => document.querySelector('#stat-plays').textContent === '1' && document.querySelector('#view-badge').textContent === 'Self-reported counts');
  await visitControl(page, '#keep-receipt');
  await page.locator('#keep-receipt').click();
  assert.equal(await page.locator('#receipt-editor').isVisible(), true);
  assert.match(await page.locator('#receipt-pending-preview').textContent(), /Artist Name/);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(base + '/import');
    for (const service of Object.keys(STREAMING_SERVICES)) {
      await page.locator('#service-picker').selectOption(service);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${service} ${width}px overflow`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/import'); await page.locator('#service-picker').selectOption('apple');
  await page.locator('[data-mode="csv"]').click(); await page.locator('#csv-guided').uncheck();
  const remapFile = { name: 'remap.csv', mimeType: 'text/csv', buffer: Buffer.from('date,artist,track,ms_played\n2026-01-02,A,T,30000') };
  await page.locator('#history-files').setInputFiles(remapFile); await page.locator('#confirm-import').click();
  assert.equal(await page.locator('#stat-plays').textContent(), '1');
  await page.locator('#csv-duration-unit').selectOption('seconds');
  await page.locator('#history-files').setInputFiles(remapFile);
  await page.waitForFunction(() => document.querySelector('#import-feedback').textContent.includes('Add was blocked'));
  assert.equal(await page.locator('#confirm-import').count(), 0);
  assert.equal(await page.locator('#stat-plays').textContent(), '1');
  await page.locator('#import-action').selectOption('replace');
  await page.locator('#history-files').setInputFiles(remapFile); await page.locator('#confirm-import').waitFor();
  await page.locator('#cancel-import').click();
  assert.equal(await page.locator('#stat-plays').textContent(), '1');
  await page.locator('#history-files').setInputFiles(remapFile); await page.locator('#confirm-import').click();
  assert.equal(await page.locator('#stat-plays').textContent(), '1');
  await page.locator('nav a[href="/history"]').click();
  const correctedDownload = page.waitForEvent('download'); await page.locator('#save-session').click();
  const corrected = JSON.parse(await readFile(await (await correctedDownload).path(), 'utf8'));
  assert.equal(corrected.records.length, 1); assert.equal(corrected.records[0].ms, 30000000);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log('PASS: seven-service workflows, changed-view backup restoration, shared PNG disclosures, durable activity audits/diagnostics, independent Last.fm comparison labels, remap rejection/Replace/cancellation, 28 responsive service checks and no external requests.');
} finally { await browser.close(); }