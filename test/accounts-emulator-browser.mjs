// Real production adapter + locally installed Firebase browser SDK + demo emulators.
// Test-only response routing; no emulator switch or weakened CSP in the shipped app.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser-engine.mjs';
const project = 'demo-payola-shared';
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099', 'Run through test:accounts:emulator');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080', 'Run through test:accounts:emulator');
const base = process.env.TEST_URL || 'http://127.0.0.1:3099';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local app only');
const modules = process.env.FIREBASE_TEST_MODULES || fileURLToPath(new URL('../node_modules/', import.meta.url));
const sdkVersion = JSON.parse(await readFile(`${modules}/firebase/package.json`, 'utf8')).version;
const adapter = await readFile(new URL('../firebase-client.js', import.meta.url), 'utf8');
assert.ok(adapter.includes(`/firebasejs/${sdkVersion}/`), 'Local SDK must match production SDK version');
const marker = 'await auth.authStateReady();';
assert.equal(adapter.split(marker).length, 2, 'Adapter initialization marker must remain unique');
const emulatorAdapter = adapter.replace(marker, `
  if (config.projectId !== '${project}') throw new Error('Demo project required');
  authSDK.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  dbSDK.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  ${marker}`);
const browser = await launchBrowser();
const blocked = [], errors = [];
const context = await browser.newContext();
if ((process.env.TEST_BROWSER || 'chromium') === 'chromium') await context.grantPermissions(['local-network-access']);
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin === new URL(base).origin) {
    if (url.pathname === '/api/accounts') return route.fulfill({ json: { enabled: true, firebase: { apiKey: 'demo-key', projectId: project, authDomain: `${project}.firebaseapp.com`, appId: 'demo-app' } } });
    if (url.pathname === '/firebase-client.js') return route.fulfill({ contentType: 'text/javascript', body: emulatorAdapter });
    const response = await route.fetch();
    const headers = { ...response.headers() };
    // Allow loopback emulators only in these test responses.
    headers['content-security-policy'] = headers['content-security-policy']?.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8080");
    return route.fulfill({ response, headers });
  }
  if (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith(`/firebasejs/${sdkVersion}/`)) {
    const filename = url.pathname.split('/').at(-1);
    assert.ok(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].includes(filename));
    return route.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: await readFile(`${modules}/firebase/${filename}`, 'utf8') });
  }
  if (['http://127.0.0.1:9099', 'http://127.0.0.1:8080'].includes(url.origin)) return route.continue();
  blocked.push(url.origin + url.pathname);
  return route.abort();
});
const page = await context.newPage();
page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
page.on('requestfailed', request => console.error('Failed request:', new URL(request.url()).origin, request.failure()?.errorText));
page.setDefaultTimeout(20000);
const email = `browser-${Date.now()}@example.com`, password = 'Demo-only-password-123', nextPassword = 'Demo-reset-password-456';
const idle = () => page.waitForFunction(() => document.querySelector('#accounts').getAttribute('aria-busy') === 'false');
async function connect() {
  await page.locator('#account-connect').click();
  await page.waitForFunction(() => document.querySelector('#account-connect').hidden && document.querySelector('#accounts').getAttribute('aria-busy') === 'false');
}
async function signIn(remember = false, value = password) {
  await page.locator('[data-auth-view="signin"]').click();
  await page.locator('#account-email').fill(email);
  await page.locator('#account-password').fill(value);
  await page.locator('#account-remember').setChecked(remember);
  await page.locator('#account-submit').click();
  await page.waitForFunction(() => !document.querySelector('#account-user').hidden && document.querySelector('#accounts').getAttribute('aria-busy') === 'false');
}
async function code(type) {
  const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${project}/oobCodes`);
  assert.equal(response.status, 200);
  const item = (await response.json()).oobCodes.findLast(item => item.email === email && item.requestType === type);
  assert.ok(item, `Missing ${type} action`);
  assert.equal(new URL(new URL(item.oobLink).searchParams.get('continueUrl')).origin, new URL(base).origin);
  return item.oobCode;
}
async function documents(collection) {
  return page.evaluate(async collection => {
    const { connectFirebase } = await import('/firebase-client.js');
    const { auth, db, dbSDK } = await connectFirebase();
    const ids = collection === 'state' ? ['current'] : Array.from({ length: 20 }, (_, i) => String(i));
    const snapshots = await Promise.all(ids.map(id => dbSDK.getDocFromServer(dbSDK.doc(db, 'payolaUsers', auth.currentUser.uid, collection, id))));
    return snapshots.filter(doc => doc.exists()).map(doc => ({ id: doc.id, ...doc.data() }));
  }, collection);
}
async function confirmed(selector) {
  page.once('dialog', dialog => dialog.accept());
  await page.locator(selector).click();
  await idle();
}
try {
  await page.goto(base);
  await page.locator('#start-sample').click();
  await page.locator('nav a[href="/account"]').click();
  await connect();
  await page.locator('[data-auth-view="signup"]').click();
  await page.locator('#account-email').fill(email);
  await page.locator('#account-password').fill(password);
  await page.locator('#account-confirm').fill(password);
  await page.locator('#account-first').fill('Demo');
  await page.locator('#account-last').fill('Browser');
  await page.locator('#account-submit').click();
  await page.waitForFunction(() => document.querySelector('#account-identity').textContent.includes('verification required') && document.querySelector('#accounts').getAttribute('aria-busy') === 'false');
  assert.equal(await page.locator('#cloud-save').isDisabled(), true);
  assert.match(await page.locator('#account-profile-status').textContent(), /Shared profile exists/);
  const verification = await code('VERIFY_EMAIL');
  await page.evaluate(async code => {
    const { connectFirebase } = await import('/firebase-client.js');
    const { auth, authSDK } = await connectFirebase();
    await authSDK.applyActionCode(auth, code);
  }, verification);
  await page.locator('#account-refresh').click();
  await page.waitForFunction(() => !document.querySelector('#cloud-save').disabled);
  assert.deepEqual(await documents('state'), [], 'Registration and verification must not upload history');
  assert.deepEqual(await documents('receipts'), [], 'No automatic receipt saves');
  await confirmed('#cloud-save');
  const saved = await documents('state');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].deleted, false);
  // Change the local view before loading, so this is a genuine restore assertion.
  await page.locator('nav a[href="/import"]').click();
  await page.locator('[data-mode="manual"]').click();
  await page.locator('#manual-form [name="artist"]').fill('Different local artist');
  await page.locator('#manual-form [name="plays"]').fill('9');
  await page.locator('#manual-form [type="submit"]').click();
  await page.locator('nav a[href="/account"]').click();
  await confirmed('#cloud-load');
  assert.match(await page.locator('#cloud-status').textContent(), /Loaded cloud version/);
  await page.locator('nav a[href="/dashboard"]').click();
  assert.equal(await page.locator('#stat-plays').textContent(), '2,727');
  await page.locator('nav a[href="/receipt"]').click();
  assert.equal(await page.locator('body').innerText().then(text => text.includes('Different local artist')), false);
  await page.locator('#keep-receipt').click();
  await page.locator('#receipt-title').fill('Emulator receipt');
  await page.locator('#collection-refresh').click();
  await page.waitForFunction(() => !document.querySelector('#collection-save').disabled);
  await confirmed('#collection-save');
  assert.equal((await documents('receipts')).filter(doc => !doc.deleted).length, 1);
  await confirmed('.collection-card button:has-text("Delete")');
  assert.equal((await documents('receipts')).filter(doc => !doc.deleted).length, 0);
  await page.locator('nav a[href="/account"]').click();
  await page.locator('#cloud-controls .danger-zone summary').click();
  await confirmed('#cloud-delete');
  assert.equal((await documents('state'))[0].deleted, true);
  await page.locator('#account-signout').click(); await idle();
  await signIn();
  await page.reload(); await connect();
  assert.equal(await page.locator('#account-user').isVisible(), false, 'Temporary session ends on reload');
  await signIn(true);
  await page.reload(); await connect();
  assert.equal(await page.locator('#account-user').isVisible(), true, 'Remembered session survives reload');
  await page.locator('#account-security-reset').click(); await idle();
  const reset = await code('PASSWORD_RESET');
  await page.evaluate(async ({ reset, nextPassword }) => {
    const { connectFirebase } = await import('/firebase-client.js');
    const { auth, authSDK } = await connectFirebase();
    await authSDK.verifyPasswordResetCode(auth, reset);
    await authSDK.confirmPasswordReset(auth, reset, nextPassword);
    await authSDK.signOut(auth);
  }, { reset, nextPassword });
  await idle();
  await signIn(false, nextPassword);
  // A failed network sign-in must be recoverable, without changing local history.
  await page.locator('#account-signout').click(); await idle();
  await context.setOffline(true);
  await page.locator('#account-email').fill(email);
  await page.locator('#account-password').fill(nextPassword);
  await page.locator('#account-submit').click(); await idle();
  assert.match(await page.locator('#account-status').textContent(), /Connection failed/);
  await context.setOffline(false);
  await signIn(false, nextPassword);
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, [], 'No production or unrelated network requests');
  console.log('PASS: real SDK demo registration/profile, verification, explicit snapshot/receipt save/load/delete, persistence, password reset, offline sign-in retry; no production requests');
} catch (error) {
  console.error('Account diagnostic:', await page.locator('#account-status').textContent(), errors, blocked);
  throw error;
} finally { await browser.close(); }