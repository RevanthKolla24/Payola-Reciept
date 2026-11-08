// Shared by the optional browser suites; no browser dependency in production.
export async function launchBrowser() {
  const name = process.env.TEST_BROWSER || 'chromium';
  if (!['chromium', 'firefox', 'webkit'].includes(name)) throw new Error(`Unsupported TEST_BROWSER: ${name}`);
  const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  console.log(`Browser engine: ${name}`);
  return playwright[name].launch();
}