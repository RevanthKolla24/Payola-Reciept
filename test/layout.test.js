import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workspace separates import, results, backups and optional accounts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const positions = ['id="add-listening"', 'id="dashboard"', 'id="history-workspace"', 'id="accounts"', 'id="help-privacy"'].map(id => html.indexOf(id));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /id="open-account" aria-controls="accounts"/);
  assert.match(html, /<details class="history-info">/);
  assert.match(html, /<details class="track-disclosure">/);
  assert.match(html, /<dialog id="artist-dialog" aria-labelledby="artist-dialog-heading">/);
  assert.match(html, /PLAY RANK<\/th>/);
  assert.match(html, /href="\/workspace.css"/);
  const server = await readFile(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(server, /publicFiles.add\('workspace.css'\)/);
  for (const page of ['/', '/dashboard', '/import', '/receipt', '/history', '/account', '/help']) {
    assert.ok(html.includes(`data-page="${page}"`));
  }
  assert.match(html, /href="\/pages.css"/);
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /scrollIntoView/);
});

test('Help uses one page heading and shared accessible FAQ panels', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const help = html.slice(html.indexOf('<div data-page="/help"'), html.indexOf('</main>'));
  assert.equal((help.match(/<h2\b/g) || []).length, 1);
  assert.match(help, /id="help-heading">Help &amp; Privacy/);
  assert.match(help, /class="help-grid"/);
  assert.equal((help.match(/class="help-panel"/g) || []).length, 2);
  assert.equal((help.match(/class="help-faq"/g) || []).length, 11);
  assert.equal((help.match(/class="faq-icon" aria-hidden="true"/g) || []).length, 11);
  assert.doesNotMatch(help, /<details[^>]*\bopen\b/);
  assert.match(help, /id="audit"/);
  assert.match(help, /Saving a receipt is not a history backup/);
  assert.match(help, /cleanup is not automatic/);
  assert.match(help, /Missing duration stays unknown/);
});