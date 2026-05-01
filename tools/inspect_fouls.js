// Hooks into game state every 200ms to count fouls / penalties / goals
// across a long simulated run. Useful to tune detection thresholds.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'http://localhost:8765/';
const RUN_SECONDS = parseInt(process.argv[3] || '30', 10);
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

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(URL, { waitUntil: 'load' });
  // bump speed
  for (let i = 0; i < 8; i++) await page.keyboard.press('Equal');

  const events = { foul: 0, penalty: 0, goal: 0, screenshots: [] };
  let lastWhistle = null;
  let lastScore = '0:0';
  let foulSnapsTaken = 0, pkSnapsTaken = 0, gkSnapsTaken = 0;

  const startedAt = Date.now();
  while (Date.now() - startedAt < RUN_SECONDS * 1000) {
    const snap = await page.evaluate(() => ({
      score: `${scoreA}:${scoreB}`,
      whistleType: typeof whistle !== 'undefined' && whistle ? whistle.type : null,
      whistleT: typeof whistle !== 'undefined' && whistle ? whistle.t : null,
    })).catch(() => null);
    if (!snap) break;

    if (snap.score !== lastScore) { events.goal++; lastScore = snap.score; }
    if (snap.whistleType && snap.whistleType !== lastWhistle) {
      events[snap.whistleType] = (events[snap.whistleType] || 0) + 1;
      lastWhistle = snap.whistleType;
      // capture a screenshot of this event
      if (snap.whistleType === 'foul' && foulSnapsTaken < 1) {
        const p = path.join(SHOT_DIR, 'foul_event.png');
        await page.screenshot({ path: p });
        events.screenshots.push(p);
        foulSnapsTaken++;
      } else if (snap.whistleType === 'penalty' && pkSnapsTaken < 1) {
        const p = path.join(SHOT_DIR, 'penalty_event.png');
        await page.screenshot({ path: p });
        events.screenshots.push(p);
        pkSnapsTaken++;
      } else if (snap.whistleType === 'goalkick' && gkSnapsTaken < 1) {
        const p = path.join(SHOT_DIR, 'goalkick_event.png');
        await page.screenshot({ path: p });
        events.screenshots.push(p);
        gkSnapsTaken++;
      }
    }
    if (!snap.whistleType) lastWhistle = null;
    await page.waitForTimeout(150);
  }

  await browser.close();

  console.log(`run: ${RUN_SECONDS}s real, errors: ${errors.length}`);
  console.log(`  goals:      ${events.goal}`);
  console.log(`  fouls:      ${events.foul || 0}`);
  console.log(`  penalties:  ${events.penalty || 0}`);
  console.log(`  goal kicks: ${events.goalkick || 0}`);
  if (events.screenshots.length) {
    console.log(`  screenshots: ${events.screenshots.join(', ')}`);
  }
  if (errors.length) {
    console.log('errors:');
    for (const e of errors.slice(0, 5)) console.log('  - ' + e);
  }
  process.exit(errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
