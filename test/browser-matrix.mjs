import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const suites = ['browser', 'features-browser', 'services-browser', 'cloud-browser', 'navigation-browser'];
const failures = [];
for (const engine of ['chromium', 'firefox', 'webkit']) {
  for (const suite of suites) {
    console.log(`\n=== ${engine} / ${suite} ===`);
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(new URL(`./${suite}.mjs`, import.meta.url))], {
        env: { ...process.env, TEST_BROWSER: engine }, stdio: 'inherit'
      });
      child.once('error', reject);
      child.once('exit', code => resolve(code));
    });
    if (code !== 0) failures.push(`${engine}/${suite}`);
  }
}
console.log(failures.length ? `FAIL: ${failures.join(', ')}` : 'PASS: all 15 engine/suite combinations');
if (failures.length) process.exitCode = 1;