import { eventTime } from './csv-history.js';
import { validListeningRecord } from './lib.js';

export const YOUTUBE_ACTIVITY_DISCLOSURE_LINES = [
  'Includes YouTube Music-marked activity.',
  'General watch history excluded; channel names are not verified artists.',
  'Activity duration unknown; coverage incomplete; no royalty estimate.'
];
export const YOUTUBE_ACTIVITY_DISCLOSURE = YOUTUBE_ACTIVITY_DISCLOSURE_LINES.join(' ');

// A conservative subset of Google's Activity JSON, not a general video-to-music classifier.
// Never fetch titles, channels, thumbnails or URLs from the network.
export function normalizeYouTubeActivity(data) {
  if (!Array.isArray(data) || data.length > 200000) throw new Error('Choose a YouTube activity JSON array with at most 200,000 records, not a library or playlist.');
  const records = [], counts = { ambiguous: 0, nonListening: 0, invalid: 0 };
  for (const item of data) {
    if (!item || typeof item !== 'object') { counts.invalid++; continue; }
    let url;
    try { url = new URL(item.titleUrl); } catch { counts.invalid++; continue; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !['music.youtube.com', 'www.youtube.com', 'youtube.com'].includes(url.hostname) || url.pathname !== '/watch' || !/^[\w-]{11}$/.test(url.searchParams.get('v') || '')) { counts.nonListening++; continue; }
    if (url.hostname !== 'music.youtube.com' && item.header !== 'YouTube Music') { counts.ambiguous++; continue; }
    // Localized actions are deliberately not guessed. Search, ads and visits aren't plays.
    const action = typeof item.title === 'string' && /^(?:Watched|Listened to) (.+)$/.exec(item.title);
    if (!action || /\bads?\b/i.test(JSON.stringify(item.details || ''))) { counts.nonListening++; continue; }
    const time = typeof item.time === 'string' ? eventTime(item.time) : null;
    const artist = Array.isArray(item.subtitles) && typeof item.subtitles[0]?.name === 'string' ? item.subtitles[0].name.trim() : '';
    const record = { source: 'csv', origin: 'youtube-takeout', ...time, artist, track: action[1].trim(), ms: null, supported: true };
    record.eventKey = JSON.stringify(['youtube-takeout', time?.timestamp, url.searchParams.get('v'), artist, record.track]);
    if (!time?.timestamp || !validListeningRecord(record)) { counts.invalid++; continue; }
    records.push(record);
  }
  return { records, counts };
}