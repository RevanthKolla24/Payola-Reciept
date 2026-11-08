import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeYouTubeActivity } from '../service-history.js';
import { STREAMING_SERVICES, attribution } from '../attribution.js';
import { serviceGuide } from '../service-catalog.js';
import { normalizeCSV, eventTime } from '../csv-history.js';
import { parseSession, sessionText } from '../session.js';
import { encodeCloud, decodeCloud } from '../cloud.js';
import { runImport } from '../import-job.js';
import { summarize } from '../lib.js';
import { makeZip } from './zip-fixture.js';
import { validateActivityAudit, mergeActivityAudit } from '../import-audit.js';
import { safeDiagnostics, qualityReport, compareSessions } from '../explore.js';
import { summaryCSV } from '../reports.js';
import { YOUTUBE_ACTIVITY_DISCLOSURE } from '../service-history.js';

const event = { header: 'YouTube', title: 'Watched A Song', titleUrl: 'https://music.youtube.com/watch?v=abcdefghijk', time: '2026-01-02T01:02:03Z', subtitles: [{ name: '<Artist Channel>', url: 'https://www.youtube.com/channel/private' }], ip: 'discard' };
const empty = (service = 'youtube', format = 'youtube') => ({ records: [], hashes: new Set(), occurrences: new Map(), bytes: 0, duplicates: 0, csv: true, service, format });
test('all seven services support unpriced event/manual backups and bounded cloud round trips', () => {
  assert.equal(Object.keys(STREAMING_SERVICES).length, 7);
  for (const selectedService of Object.keys(STREAMING_SERVICES)) {
    assert.ok(serviceGuide(selectedService).steps);
    assert.equal(attribution(selectedService, true, true).scenario, selectedService === 'spotify');
    for (const manual of [{ artist: 'A', plays: 3 }, { artists: [{ artist: 'A', plays: 3 }, { artist: 'B', plays: 2 }] }]) {
      const text = sessionText({ mode: 'manual', selectedService, records: [], filters: { from: '', to: '' }, duplicates: 0, manual });
      assert.equal(JSON.parse(text).version, manual.artists ? 2 : 1);
      const restored = parseSession(text);
      assert.equal(restored.manual.amount === null, selectedService !== 'spotify');
    }
    const text = sessionText({ mode: 'csv', selectedService, records: normalizeCSV('date,artist,track\n2026-01-02,A,T', { date: 'date', artist: 'artist', track: 'track', ms: '' }), filters: { from: '', to: '' }, duplicates: 0 });
    const encoded = encodeCloud(text);
    assert.equal(decodeCloud({ schema: 1, version: 1, deleted: false, chunks: encoded.chunks.length, bytes: encoded.bytes }, encoded.chunks.map(data => ({ version: 1, data }))), text);
    assert.equal(summarize(parseSession(text).records).amount, null);
    const scrobbles = parseSession(sessionText({ mode: 'lastfm', selectedService, records: [{ source: 'lastfm', date: '2026-01-02', artist: 'A', track: 'T', supported: true, ms: null }], filters: { from: '', to: '' }, duplicates: 0, attribution: { ...attribution(selectedService, true, true), from: '2026-01-01', to: '2026-01-03' }, lastfm: { skipped: 0, duplicates: 0 } }));
    assert.equal(scrobbles.attribution.service, selectedService); assert.equal(scrobbles.attribution.scenario, false);
  }
  assert.throws(() => serviceGuide('unsupported'));
});
test('CSV dates accept explicit timezone timestamps and explicit seconds, never locale guesses or rolled dates', () => {
  assert.deepEqual(eventTime('2026-01-02T01:00:00+02:00'), { date: '2026-01-01', timestamp: '2026-01-01T23:00:00.000Z' });
  for (const bad of ['2026-02-30T01:00:00Z', '2026-01-01T24:00:00Z', '01/02/2026', '2026-01-01T01:00:00', '+010000-01-01T00:00:00Z']) assert.equal(eventTime(bad), null);
  const records = normalizeCSV('When,Who,Song,Played\n2026-01-02T01:00:00+02:00,A,T,45', { date: 'When', artist: 'Who', track: 'Song', ms: 'Played', durationUnit: 'seconds' });
  assert.equal(records[0].ms, 45000); assert.equal(records[0].timestamp, '2026-01-01T23:00:00.000Z');
  assert.throws(() => normalizeCSV('date,artist,track\n2026-01-01,A,T', { durationUnit: 'minutes' }), /milliseconds or seconds/);
});
test('YouTube importer accepts only explicitly music-marked activity, strips private metadata and never infers duration', () => {
  const result = normalizeYouTubeActivity([event, { ...event, titleUrl: 'https://www.youtube.com/watch?v=abcdefghijk', header: 'YouTube Music' }]);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].ms, null); assert.equal(result.records[0].artist, '<Artist Channel>');
  assert.equal(result.records[0].ip, undefined); assert.equal(result.records[0].titleUrl, undefined);
  assert.equal(summarize(result.records).amount, null);
  const restored = parseSession(sessionText({ mode: 'csv', selectedService: 'youtube', records: result.records, filters: { from: '', to: '' }, duplicates: 0 }));
  assert.equal(restored.records[0].origin, 'youtube-takeout');
  assert.throws(() => sessionText({ ...restored, selectedService: 'apple' }));
});
test('general watch history, unsafe URLs, ads, localized actions, missing metadata and libraries are not listening', () => {
  const rows = [
    { ...event, titleUrl: 'https://www.youtube.com/watch?v=abcdefghijk' },
    { ...event, titleUrl: 'https://music.youtube.com.evil.test/watch?v=abcdefghijk' },
    { ...event, titleUrl: 'https://user@music.youtube.com/watch?v=abcdefghijk' },
    { ...event, title: 'Searched for A Song' }, { ...event, title: 'Regardé A Song' },
    { ...event, details: [{ name: 'From Google Ads' }] }, { ...event, subtitles: [] },
    { ...event, time: '2026-02-30T00:00:00Z' }, { ...event, time: '2026-01-02' },
    { ...event, titleUrl: 'javascript:alert(1)' }
  ];
  const result = normalizeYouTubeActivity(rows);
  assert.equal(result.records.length, 0); assert.equal(result.counts.ambiguous, 1);
  assert.equal(Object.values(result.counts).reduce((a, b) => a + b), rows.length);
  assert.throws(() => normalizeYouTubeActivity({ playlists: [] }), /not a library/);
});
test('activity JSON and ZIP run through bounded review/dedup pipeline with exclusion reports', async () => {
  for (const file of [new File([JSON.stringify([event, { ...event, titleUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }])], 'watch-history.json'), new File([makeZip({ 'Takeout/history/watch-history.json': JSON.stringify([event]), 'playlists/library.json': '{}' })], 'takeout.zip')]) {
    const original = empty(); const imported = await runImport([file], original);
    assert.equal(original.records.length, 0); assert.equal(imported.records.length, 1);
    assert.match(imported.messages.join(' '), /excluded/);
    assert.equal((await runImport([file], { ...imported, ...empty(), records: imported.records, hashes: imported.hashes, occurrences: imported.occurrences })).records.length, 1);
  }
  await assert.rejects(runImport([], { ...empty(), service: 'spotify' }), /YouTube Music/);
});
test('CSV remapping is rejected without mutation and Replace permits corrected duration units', async () => {
  const file = new File(['date,artist,track,ms_played\n2026-01-01,A,T,45'], 'events.csv');
  const first = await runImport([file], empty('apple', 'csv'));
  const next = await runImport([file], { ...first, csv: true, service: 'apple', mapping: { date: 'date', artist: 'artist', track: 'track', ms: 'ms_played', durationUnit: 'seconds' } });
  assert.equal(next.records.length, 1); assert.equal(next.added, 0);
  assert.deepEqual(next.records, first.records); assert.deepEqual(next.hashes, first.hashes);
  assert.deepEqual(next.occurrences, first.occurrences); assert.equal(next.bytes, first.bytes);
  assert.match(next.messages.join(' '), /Add was blocked.*Replace/);
  const corrected = await runImport([file], { ...empty('apple', 'csv'), mapping: { date: 'date', artist: 'artist', track: 'track', ms: 'ms_played', durationUnit: 'seconds' } });
  assert.equal(corrected.records.length, 1); assert.equal(corrected.records[0].ms, 45000);
  assert.equal(summarize(corrected.records).plays, 1);
});

test('confirmed activity audit survives local/cloud backup, excludes duplicate/rejected files and strips metadata', async () => {
  const file = new File([JSON.stringify([event, { ...event, titleUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }, { ...event, title: 'Searched for something' }, { ...event, subtitles: [] }])], 'private.json');
  const imported = await runImport([file], empty());
  const expected = { files: 1, records: 4, accepted: 1, ambiguous: 1, nonListening: 1, invalid: 1 };
  assert.deepEqual(imported.activityAudit, expected); assert.equal(imported.previews[0].inputRecords, 4);
  assert.equal(imported.previews[0].exclusions.ambiguous, 1);
  const repeated = await runImport([file, new File(['{}'], 'bad.json')], { ...imported, csv: true, service: 'youtube', format: 'youtube' });
  assert.deepEqual(repeated.activityAudit, expected);
  const text = sessionText({ mode: 'csv', selectedService: 'youtube', records: imported.records, filters: { from: '', to: '' }, duplicates: 0, activityAudit: { ...expected, filename: 'private.json' } });
  assert.deepEqual(parseSession(text).activityAudit, expected);
  assert.doesNotMatch(text, /private\.json/);
  const encoded = encodeCloud(text);
  assert.deepEqual(parseSession(decodeCloud({ schema: 1, version: 1, deleted: false, chunks: encoded.chunks.length, bytes: encoded.bytes }, encoded.chunks.map(data => ({ version: 1, data })))).activityAudit, expected);
  const diagnostic = safeDiagnostics(qualityReport(imported.records), imported.previews, { ...expected, filename: 'private.json' });
  assert.deepEqual(diagnostic.activityAudit, expected);
  assert.doesNotMatch(JSON.stringify(diagnostic), /private.json|Artist Channel|A Song/);
  const csv = summaryCSV(summarize(imported.records), { sourceType: 'csv', source: 'YouTube Music', youtubeActivity: true, activityAudit: expected });
  assert.ok(csv.includes(YOUTUBE_ACTIVITY_DISCLOSURE)); assert.match(csv, /excluded general\/ambiguous: 1/);
  const old = JSON.parse(text); delete old.activityAudit;
  assert.equal(parseSession(JSON.stringify(old)).activityAudit, undefined);
  const next = await runImport([new File([JSON.stringify([event, event])], 'overlap.json')], { ...imported, csv: true, service: 'youtube', format: 'youtube' });
  assert.deepEqual(next.activityAudit, { files: 2, records: 6, accepted: 3, ambiguous: 1, nonListening: 1, invalid: 1 });
  assert.equal(next.duplicates, 1);
  const rejectedOnly = await runImport([new File([JSON.stringify([{ ...event, title: 'Searched for A Song' }])], 'search.json')], empty());
  assert.equal(rejectedOnly.activityAudit, undefined); assert.equal(rejectedOnly.records.length, 0);
});

test('activity audit validation rejects malformed or unbounded counters and wrong source modes', () => {
  const audit = { files: 1, records: 2, accepted: 1, ambiguous: 1, nonListening: 0, invalid: 0 };
  for (const patch of [{ files: 0 }, { records: 3 }, { accepted: -1 }, { invalid: 0.5 }, { ambiguous: '1' }, { records: 20000001 }, { accepted: 0, ambiguous: 2 }]) assert.throws(() => validateActivityAudit({ ...audit, ...patch }), /audit/);
  assert.deepEqual(mergeActivityAudit(audit, audit), { files: 2, records: 4, accepted: 2, ambiguous: 2, nonListening: 0, invalid: 0 });
  assert.throws(() => sessionText({ mode: 'manual', selectedService: 'youtube', records: [], filters: { from: '', to: '' }, duplicates: 0, manual: { artist: 'A', plays: 1 }, activityAudit: audit }));
});

test('Last.fm comparisons use independently confirmed source rather than onboarding selection', () => {
  const make = service => parseSession(sessionText({ mode: 'lastfm', selectedService: 'apple', records: [], filters: { from: '', to: '' }, duplicates: 0, attribution: { ...attribution(service, service !== 'unknown'), from: '2026-01-01', to: '2026-01-02' }, lastfm: { skipped: 0, duplicates: 0 } }));
  const comparison = compareSessions(make('spotify'), make('unknown'));
  assert.equal(comparison.left.service, 'spotify'); assert.equal(comparison.right.service, 'unknown');
  assert.equal(comparison.left.declaration.service, 'spotify');
});