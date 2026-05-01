# AGENTS.md

Project context for any AI coding agent (Claude Code, Cursor, Cline,
Continue, Aider, etc.) working on this repo. Mirrors `CLAUDE.md` minus
vendor-specific notes.

## Project at a glance

A self-playing 2D top-down soccer simulator. 22 AI players in a 4-3-3
formation, broadcast-style HUD, slow-motion goal replays, procedural audio.
The whole thing is one `index.html` file using Canvas 2D and Web Audio —
no build step, no dependencies, no external assets. Hosted on GitHub Pages.

## File map

```
index.html        # the entire game (~1100 lines: HTML/CSS/JS)
README.md         # public-facing description, English, with live-demo link
LICENSE           # MIT
screenshot.png    # README hero image
CLAUDE.md         # context for Claude Code
AGENTS.md         # this file — context for any other agent
```

No tests, no linter config, no `package.json` in this repo. Inspection
tooling lives outside the project at `/tmp/soccer_inspect/` (Playwright
script that captures console/runtime errors via Chrome DevTools Protocol).

## Run / test / deploy

```bash
# local dev server (file:// loads but blocks some Web APIs)
python3 -m http.server 8765
# → http://localhost:8765/

# diagnostic via Playwright + CDP — captures console messages, runtime
# exceptions, network failures, performance metrics, screenshot
node /tmp/soccer_inspect/inspect.js http://localhost:8765/ 12

# deploy = git push to main; GitHub Pages rebuilds automatically (~1min)
git push
```

## Architecture

### Single-file rule

Everything lives in `index.html`. This is a deliberate choice — keeps the
project trivial to deploy, fork, copy into a Codepen, or read end-to-end.
**Do not** suggest splitting into modules, adding a build step, or
introducing frameworks unless the user explicitly asks. **Do not** suggest
Three.js / PixiJS — Canvas 2D is the right tool for this scale of 2D.

### Game loop

`requestAnimationFrame(loop)` cycles through three exclusive states:

1. **Replay** — drawing from `replayBuf` snapshots at `slowFactor` per frame
2. **Celebrating** — frozen world during goal celebration; queues a replay
3. **Live** — calls `update()` one or more sub-steps based on `speedMul`

The whole loop body is wrapped in `try/catch/finally` with the next
`requestAnimationFrame` queued in `finally`. This keeps the rAF chain alive
even if a frame throws. Do not remove this guard.

### Speed / time scaling

Two distinct concepts:

- `dt` — game-time seconds elapsed in this update step
- `ds = dt * 60` — frame scale; 1.0 means "one standard 60fps frame's worth"

**Per-frame accumulators** (positions += velocity, ball friction `*= 0.985`,
inertia `ACCEL` lerp, facing rotation, particle gravity / drag) all
multiply by `ds` so the simulation genuinely runs slower at low `speedMul`.
**Per-second values** (timeLeft, kickCD, totalTime, toast life, particle
life) use `dt` directly.

Default `speedMul = 0.1`. Keys `+`/`-` multiply / divide by 1.5×
(multiplicative — gives even resolution at any scale). For `speedMul > 1`
the loop sub-steps via `Math.ceil(speedMul)` to avoid tunneling.

### Referee + set pieces

A `referee` object follows the ball on the opposite half (so it stays
out of the play) and is rendered with `drawHumanoid` using a `REF_TEAM`
kit (yellow shirt). It blows the whistle on fouls.

**Foul heuristic** is "first contact": two opposing players overlap,
the one further from the ball is the aggressor. If relative velocity
exceeds `FOUL_REL_SPEED`, aggressor's velocity is aimed into the victim
(dot-product gate), and `FOUL_PROBABILITY` rolls true, the ref calls a
foul. `lastFoulAt` provides a cooldown.

**Penalty rule**: foul inside the offending team's own penalty box →
ball is placed on that team's penalty spot, the attacking team's
nearest outfield player becomes the taker, both teams' outfielders are
pushed outside the box.

State: `whistle = { type, team, x, y, t }` joins `celebrating` and
`replay` as a pause state. While set, the loop stops calling `update()`
and counts down `t`. When it expires, `executeSetPiece()` repositions
the ball and players, then clears `whistle`. Live play resumes from
there. Detection lives in `checkFoul()` inside
`resolvePlayerCollisions()`.

### Replay buffer

`recordSnapshot()` runs every `update()` and pushes to a 180-frame ring
buffer. Each snapshot stores `{x, y, vx, vy, facing, role, num, name,
phaseOff}` per player and `{x, y}` for the ball. On goal, `goalScored()`
sets `celebrating = { team, t: 1.2, replayQueued: true }`. After 0.8s,
`startReplay()` slices the buffer; the replay branch advances
`replay.idx += 0.45` each frame.

`lastGoalAt` (a `performance.now()` timestamp) enforces a 500ms cooldown
between goals. `goalScored()` also recenters the ball immediately.
Belt-and-suspenders against a runaway-score bug where a stuck ball
incremented the score every frame. Do not remove without understanding the
history.

### Audio

`AudioContext` is created lazily on the first `keydown` or document
`click` (browsers block audio without a user gesture). All sounds are
procedural via `OscillatorNode` and noise buffers — there are no asset
files. `setMuted(bool)` controls a master gain on the crowd ambient; SFX
helpers check the `muted` flag before playing.

### Drawing

- `drawHumanoid()` draws a procedural top-down character: shadow, two
  swinging legs (sin-wave walk cycle), white shorts, jersey-colored torso
  with gradient, swinging arms (counter-phase to legs; GK has arms
  outstretched), head with hair patch indicating direction. Sprite is
  designed facing east (+X local), rotated by `facing`. The jersey number
  is counter-rotated so it stays upright in screen space.
- `standsCanvas` — 4500 colored dots pre-rendered to an offscreen canvas
  in `buildStandsCache()`. Drawn once per frame, no per-frame cost.
- `roundRect()` builds a path (caller fills/strokes); `drawRoundRect()`
  fills in one call.

Walk-cycle phase = `totalTime * 14 * walkSpeed + p.phaseOff`. Each player
has a unique `phaseOff` so the team isn't synchronized. `totalTime` keeps
advancing during replay/celebration (at half speed) so animation doesn't
freeze.

## Conventions

- **i18n**: in-game text is bilingual (en / pt-br). Auto-detected from
  `navigator.language`; `?lang=en` or `?lang=pt` overrides. All visible
  strings live in `LANG_DICT` near the top of the script — add new
  strings there and reference via `T.key` (or `T.fn(arg)` for templates).
  Keep English as the default fallback for non-pt locales.
- Source code, comments, commit messages, README → English.
- **No emojis** in code or files unless the user asks.
- **Commits** include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
  on the last line. Use the project email/name:
  `git -c user.email=cfpperche@gmail.com -c user.name=cfpperche commit ...`
- **No new files** unless required (README, LICENSE, screenshot are the
  only ones besides this one and `index.html`).

## Common pitfalls

- **The `try/catch` in `loop()` swallows runtime exceptions.** A broken
  refactor can flood the console without breaking the visible game. Run
  the inspector after any non-trivial change.
- **Don't refactor speed to raw `dt` units** without also retuning every
  speed/accel constant — `p.speed`, `ACCEL`, kick powers are all in
  "px per standard frame". `ds` scaling preserves them.
- **Don't bind global `click` to skip replay.** Stray clicks elsewhere on
  the page (devtools focus, scroll bar, anywhere) used to end the
  celebration prematurely and trigger a goal-cascade bug. Keep the skip
  bound to the canvas only.
- **GitHub Pages caches aggressively.** After deploy, verify with the
  inspector against the live URL and remind the user to hard-reload.

## Style

- Match existing code style — no semicolon-vs-no-semicolon flips, no
  Prettier reformat, no rename-spree.
- Keep additions minimal and surgical. Most polish lives in `drawHumanoid`
  or in the AI of `decideKick` / `updateTeam`.
- Don't add abstractions for hypothetical future features. The roadmap in
  `README.md` lists actual asks; ignore everything else.

## Repo / deploy

- GitHub: `https://github.com/cfpperche/2d-soccer-ai`
- Live: `https://cfpperche.github.io/2d-soccer-ai/`
- `gh` CLI authenticated as `cfpperche` over SSH
- Pages source: `main` branch, `/` root
