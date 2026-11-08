import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('./validate-private-activity.mjs', import.meta.url));
test('private activity diagnostic prints counts only and withholds private parse errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'payola-private-fixture-'));
  const path = join(directory, 'private-account.json');
  try {
    await writeFile(path, JSON.stringify([{ header: 'YouTube Music', title: 'Watched Private song', titleUrl: 'https://music.youtube.com/watch?v=abcdefghijk', time: '2026-01-01T00:00:00Z', subtitles: [{ name: 'Private artist' }] }, null]));
    const output = execFileSync(process.execPath, [script, path], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output.split('\n')[0]), { records: 2, accepted: 1, ambiguous: 0, nonListening: 0, invalid: 1 });
    assert.doesNotMatch(output, /Private song|Private artist|abcdefghijk|private-account/);
    await writeFile(path, 'private-secret-invalid-json');
    const result = spawnSync(process.execPath, [script, path], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /private-secret|private-account|SyntaxError/);
    assert.match(result.stderr, /details withheld/);
    assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});