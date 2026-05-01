# CLAUDE.md

Context for Claude Code sessions on this repo.

## What this is

A 2D top-down soccer simulator that plays itself (AI vs AI, no human input).
The whole game is a single `index.html` file using Canvas 2D and Web Audio —
no build step, no `node_modules`, no external assets. Hosted on GitHub Pages.

Inspired by Soya da Yoot's tweet about asking Codex to keep iterating on a
2D soccer simulator until it felt fun to watch. The project's spirit is the
same: keep adding small layers of polish until each match is satisfying.

## File map

```
index.html        # the entire game — ~1100 lines of HTML/CSS/JS
README.md         # public-facing description (English, with live-demo link)
LICENSE           # MIT
screenshot.png    # README hero image
.gitignore        # editor noise
CLAUDE.md         # this file
AGENTS.md         # vendor-neutral mirror of this file for other agentic tools
```

There are no tests, no lint config, no package.json in the project itself.
Inspection tooling lives outside the repo at `/tmp/soccer_inspect/`.

## Run, test, deploy

```bash
# local dev — python http server (file:// also works but blocks some APIs)
python3 -m http.server 8765
# → http://localhost:8765/

# inspect a running instance via Playwright + Chrome DevTools Protocol
node /tmp/soccer_inspect/inspect.js http://localhost:8765/ 12
node /tmp/soccer_inspect/inspect.js https://cfpperche.github.io/2d-soccer-ai/ 8

# deploy = git push to main; GitHub Pages rebuilds automatically
git push                                           # ~30-90s rebuild
gh api repos/cfpperche/2d-soccer-ai/pages          # check status
```

The `inspect.js` script captures console messages, page errors via CDP
`Runtime.exceptionThrown`, request failures, performance metrics, and a
screenshot. Use it to verify changes — the main loop has a try/catch that
**swallows exceptions silently** (so the game keeps running even if
something throws), which means a broken refactor can flood the console
without breaking the visible game. Always run the inspector after non-trivial
changes.

## Architecture

### Single-file philosophy

Everything is in `index.html`: HTML shell, CSS, all JS. Conscious decision —
keeps the project trivial to deploy, fork, and inspect. Don't suggest
splitting into modules unless the user explicitly asks. Don't suggest
Three.js / PixiJS / React etc. — Canvas 2D is the right tool for 2D
top-down at this scale.

### Game loop

`requestAnimationFrame(loop)` with three exclusive states:

1. **Replay** — drawing from `replayBuf` snapshots at `slowFactor` per frame
2. **Celebrating** — frozen world while goal is celebrated, fires replay at t≤0.4
3. **Live** — calls `update(dt)` one or more sub-steps based on `speedMul`

The whole loop body is wrapped in `try/catch/finally` with a guaranteed
`requestAnimationFrame(loop)` in `finally`. This protects against any single
frame's exception killing the rAF chain. Don't remove this guard.

### Speed / time scaling

Two concepts that look similar but aren't:

- `dt` — game-time seconds elapsed in this update step
- `ds = dt * 60` — frame scale; 1.0 means "one standard 60fps frame"

Anything that's a per-frame accumulator (player position += vx, ball
friction `*= 0.985`, ACCEL lerp, facing rotation, particle gravity) **must
be multiplied by `ds`** so the world genuinely runs slower at low
`speedMul`. Things that are per-second (timeLeft, kickCD, totalTime, toast
timers, particle life) use `dt` directly.

Default `speedMul = 0.1`. The `+`/`-` keys multiply/divide by 1.5×
(multiplicative scaling — works at both 0.1× and 4×). Loop sub-steps with
`Math.ceil(speedMul)` when speedMul > 1 to avoid tunneling.

### Replay system

`recordSnapshot()` runs every `update()` and pushes to `replayBuf` (ring
buffer of 180 frames = 3s of game time). On goal, `goalScored` sets
`celebrating = { team, t: 1.2, replayQueued: true }`. After 0.8s of
celebration, `startReplay()` slices the buffer, then the loop's replay
branch advances `replay.idx` by `slowFactor` (0.45) each frame.

Snapshot includes `vx, vy, facing, role, phaseOff` so the humanoid sprite
animation works during replay.

**Goal cooldown** — `lastGoalAt` (`performance.now()` timestamp) blocks
re-entry within 500ms. Plus `goalScored` immediately recenters the ball.
This is **belt-and-suspenders** against an old bug where a stuck ball
caused the score to run away to 87. Don't remove without understanding why.

### Audio

`AudioContext` is created lazily on first user gesture (`keydown` or `click`
on the document). Browsers block audio without a gesture, so don't move
this. All sounds are procedural via oscillators / noise buffers — no asset
files. `setMuted(bool)` controls a master gain on the crowd ambient; SFX
respect the `muted` flag.

### Drawing

- `drawHumanoid()` — procedural top-down character with shadow, legs, shorts,
  torso, swinging arms, head, hair. Sprite is designed facing east (+X) in
  local coords and rotated by `facing`. The jersey number is
  counter-rotated so it stays upright in screen space.
- `standsCanvas` — 4500 random colored dots pre-rendered offscreen at init
  for the crowd background. Built once in `buildStandsCache()`.
- `roundRect()` returns a path (caller must `fill()`/`stroke()`).
  `drawRoundRect()` fills in one go.

Walk-cycle phase is `totalTime * 14 * walkSpeed + p.phaseOff`. Each player
has a unique `phaseOff` so the team isn't synchronized. `totalTime` keeps
ticking during replay/celebration (at half speed) so animation doesn't
freeze.

## Conventions

- **Portuguese in-game text** (`GOOOL`, `LANÇAMENTO`, `RUBRO`, `AZUL`,
  `PAUSADO`) is intentional flavor. Don't translate to English unless the
  user asks. README, comments, commit messages stay in English.
- **No emojis in code or files** unless the user explicitly asks.
- **Commits** must include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
  on the last line, set `git -c user.email=cfpperche@gmail.com -c user.name=cfpperche`.
- **README screenshot** is `screenshot.png`. Regenerate with:
  ```
  google-chrome --headless --disable-gpu --no-sandbox \
    --virtual-time-budget=6000 --window-size=1340,840 \
    --screenshot=/tmp/soccer_v2/screenshot.png http://localhost:8765/
  ```

## Common pitfalls

- **Don't add error handling for "what if ball is null"** — the game state
  is fully owned by this file, so trust it. Defensive null-checks just hide
  real bugs.
- **Don't refactor the speed system to use raw `dt` everywhere** without
  retuning `p.speed`, `ACCEL`, kick power constants, etc. They're all in
  "px per standard frame" units; converting to "px per second" means
  multiplying by 60 throughout. The current `ds` scaling preserves the
  existing constants.
- **Don't bind global `click` to skip replay** — that broke when stray
  clicks elsewhere on the page (or devtools focus changes) ended the
  celebration prematurely. Keep the skip on the canvas only.
- **The `try/catch` in `loop()` swallows exceptions** — convenient at
  runtime but easy to miss bugs. After any non-trivial change, run the
  inspector before claiming "it works".
- **GitHub Pages caches aggressively** — verify with the inspector against
  the live URL after `git push`, and tell the user to Ctrl+F5.

## Repo / deploy

- GitHub: `https://github.com/cfpperche/2d-soccer-ai`
- Live: `https://cfpperche.github.io/2d-soccer-ai/`
- `gh` CLI is authenticated as `cfpperche` over SSH
- Pages source: `main` branch, `/` root
