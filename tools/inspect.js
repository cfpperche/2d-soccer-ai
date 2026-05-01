// Run a full diagnostic of the soccer simulator via Playwright + Chrome DevTools Protocol.
// - Captures console messages, page errors, request failures
// - Hooks the CDP Runtime + Network domains
// - Plays for ~12 seconds (simulating goals via fast-forward) then reports

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'http://localhost:8765/';
const RUN_SECONDS = parseInt(process.argv[3] || '12', 10);
const SHOT_DIR = path.join(__dirname, '.screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1340, height: 840 } });
  const page = await ctx.newPage();

  const consoleLogs = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    });
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
  });
  page.on('requestfailed', (req) => {
    requestFailures.push({ url: req.url(), error: req.failure()?.errorText });
  });

  // Use raw CDP for richer Runtime / Performance info
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');

  cdp.on('Runtime.exceptionThrown', (ev) => {
    pageErrors.push({
      via: 'CDP',
      text: ev.exceptionDetails.text,
      exception: ev.exceptionDetails.exception?.description,
    });
  });

  console.log(`→ navigating to ${URL}`);
  await page.goto(URL, { waitUntil: 'load', timeout: 15000 });

  // Speed game up so goals happen, then play
  await page.evaluate(() => {
    // bump speed to 4x via the public global (the script exposes nothing,
    // so we send keypresses instead)
  });
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Equal'); // "+" key, raises speedMul each press
  }

  console.log(`→ playing for ${RUN_SECONDS}s at max speed...`);
  await page.waitForTimeout(RUN_SECONDS * 1000);

  // Snapshot of in-game state
  const state = await page.evaluate(() => ({
    score: typeof scoreA !== 'undefined' ? `${scoreA}:${scoreB}` : 'n/a',
    timeLeft: typeof timeLeft !== 'undefined' ? timeLeft : 'n/a',
    paused: typeof paused !== 'undefined' ? paused : 'n/a',
    celebrating: typeof celebrating !== 'undefined' ? !!celebrating : 'n/a',
    replayActive: typeof replay !== 'undefined' ? !!replay : 'n/a',
    speedMul: typeof speedMul !== 'undefined' ? speedMul : 'n/a',
    totalTime: typeof totalTime !== 'undefined' ? totalTime : 'n/a',
    playerCount: (typeof teamA !== 'undefined' && typeof teamB !== 'undefined')
      ? teamA.length + teamB.length : 'n/a',
  }));

  // Performance metrics via CDP
  const perf = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }));

  await page.screenshot({ path: path.join(SHOT_DIR, 'diagnostic.png'), fullPage: true });

  await browser.close();

  // === Report ===
  console.log('\n========== DIAGNOSTIC REPORT ==========');
  console.log('In-game state after run:', state);

  console.log(`\n[console messages: ${consoleLogs.length}]`);
  // dedupe by text
  const byText = new Map();
  for (const m of consoleLogs) {
    const key = `${m.type}::${m.text}`;
    byText.set(key, (byText.get(key) || 0) + 1);
  }
  for (const [k, count] of byText.entries()) {
    console.log(`  ${count}× ${k}`);
  }

  console.log(`\n[page errors: ${pageErrors.length}]`);
  const errByMsg = new Map();
  for (const e of pageErrors) {
    const key = e.message || e.text || JSON.stringify(e);
    if (!errByMsg.has(key)) errByMsg.set(key, { count: 0, sample: e });
    errByMsg.get(key).count++;
  }
  for (const [msg, { count, sample }] of errByMsg.entries()) {
    console.log(`  ${count}× ${msg}`);
    if (sample.stack) {
      const stackLines = sample.stack.split('\n').slice(0, 3).join('\n      ');
      console.log(`      ${stackLines}`);
    }
  }

  console.log(`\n[request failures: ${requestFailures.length}]`);
  for (const r of requestFailures) {
    console.log(`  ${r.url} — ${r.error}`);
  }

  if (perf.metrics?.length) {
    const m = Object.fromEntries(perf.metrics.map(({ name, value }) => [name, value]));
    console.log('\n[CDP Performance metrics]');
    console.log(`  JSHeapUsedSize: ${(m.JSHeapUsedSize/1024/1024).toFixed(1)} MB`);
    console.log(`  Documents: ${m.Documents}, Frames: ${m.Frames}, JSEventListeners: ${m.JSEventListeners}`);
    console.log(`  TaskDuration (cumulative s): ${m.TaskDuration?.toFixed(2)}`);
  }

  console.log(`\nScreenshot saved → ${path.join(SHOT_DIR, 'diagnostic.png')}`);
  console.log('========================================');

  // Exit with non-zero if any errors detected
  process.exit(pageErrors.length > 0 ? 1 : 0);
})().catch((err) => {
  console.error('inspector crashed:', err);
  process.exit(2);
});
