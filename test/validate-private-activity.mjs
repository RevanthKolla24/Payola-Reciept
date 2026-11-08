// Local-only diagnostic; never prints paths, records or parser error contents.
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { normalizeYouTubeActivity } from '../service-history.js';
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Provide one absolute path to a redacted YouTube activity JSON file (not ZIP).');
  process.exitCode = 1;
} else {
  try {
    if (!isAbsolute(args[0]) || (await stat(args[0])).size > 100 * 1024 * 1024) throw new Error();
    const data = JSON.parse(await readFile(args[0], 'utf8'));
    const { records, counts } = normalizeYouTubeActivity(data);
    console.log(JSON.stringify({ records: data.length, accepted: records.length, ...counts }));
    console.log('Diagnostic only: counts do not certify native compatibility or artist attribution.');
  } catch {
    console.error('Validation failed: use a JSON activity array under 100 MiB; details withheld for privacy.');
    process.exitCode = 1;
  }
}