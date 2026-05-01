# HANDOFF

> Read at session start (auto-printed by `.claude/settings.json` hook).
> Update at session end before committing.

**Last updated**: 2026-05-01 — session "soccer"
**HEAD commit**: see `git log -1 --oneline` (most recent should be the project-relocation commit)

## Where things stand

- Project moved from `/tmp/soccer_v2` to `~/2d-soccer-ai` this session.
  Inspector tooling that used to live in `/tmp/soccer_inspect/` now sits
  inside the repo at `tools/`. Run via `npm run inspect`,
  `npm run inspect:fouls`, `npm run inspect:live`.
- Game features shipped recently:
  - i18n EN / pt-br with browser autodetect + `?lang=` override + visible
    EN/PT switcher in the top-right.
  - Referee figure (yellow kit) with foul + penalty detection (Tier 1+2+4
    of the rules-implementation plan).
  - Goalkeepers in distinct kits (RUB → lime green, AZU → orange) with
    bright yellow gloves so they read instantly. GK saves now trigger a
    formal goal-kick set piece (Law 16) instead of the keeper just
    dribbling out.
  - Predictive GK AI: keeper aims at where the ball will arrive at his
    x-line, not where it currently is. Saves are now common.
- Game runs on default `speedMul = 0.1` so the world is genuinely
  watchable. `+`/`-` multiply by 1.5×.

## Disabled / in-progress

- **Goal replays** — currently OFF via `const REPLAYS_ENABLED = false`
  near the top of `index.html`. User reported the slow-motion replay was
  perceived as the goal counting twice. The buffer is still being
  recorded so re-enabling is one flag flip; before flipping back, fix
  the perceived double-goal — likely needs the goal toast to clear
  before the replay starts and the score readout to be visually frozen
  during the replay so it's unambiguous.
- **Tier 3 cards** (yellow/red persistent) — postponed. It was deferred
  because cards mutate the player roster (red = ejected for the rest of
  the match) which complicates the replay snapshot format and the AI
  team accessors. Plan it explicitly before implementing.
- **Out-of-bounds proper handling** — when the ball crosses a side
  touchline or a goal line outside the goal mouth it currently just
  bounces off the field edge. Real soccer would call a throw-in /
  corner kick / goal kick depending on which line and who touched
  last. Not on the immediate roadmap.

## Next combined item

Plan Tier 3 (cards) before implementing — write down the exact data
shape (`yellowCount` per player? roster filter for ejected?) and which
flows touch ejected players (snapshot serialization, `findClosestToBall`,
collision resolution, drawing).

## Tuning knobs worth remembering

- Foul detection — five gates in `checkFoul()`:
  `FOUL_REL_SPEED=3.5`, `FOUL_PROBABILITY=0.4`, `FOUL_VIC_MAX_DIST=22`,
  `FOUL_DIST_GAP=12`, `FOUL_DOT_MIN=1.0`, `FOUL_COOLDOWN_MS=2500`.
  Loosening any of these used to make the kickoff loop a foul cascade —
  re-tune with `npm run inspect:fouls` before merging changes.
- GK save: triggered when GK is within 28 px of a ball moving toward
  his goal at speed > 5. After save, ball is parked at the corner of
  the small box on the side it came from.

## Workflow checklist before ending a session

1. Run `npm run inspect` — confirm 0 errors.
2. Run `npm run inspect:fouls` — confirm event counts look reasonable.
3. Update `HANDOFF.md` (this file) with what landed and what's next.
4. Commit + push.
