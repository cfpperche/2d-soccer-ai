# 2D Soccer — AI vs AI

> 🎮 **[Play now →](https://cfpperche.github.io/2d-soccer-ai/)**

A 2D top-down soccer simulator in **plain HTML + Canvas**, no dependencies, no build step, no server. All 22 players are AI-controlled — you just watch.

Inspired by [this tweet](https://twitter.com/soya_da_yoot) where the author asked Codex to build a 2D simulator that would play itself "until it feels enjoyable to a user."

[![Screenshot](screenshot.png)](https://cfpperche.github.io/2d-soccer-ai/)

## How to run

Nothing to install. Three options:

```bash
# 1) Open the file directly
xdg-open index.html        # linux
open index.html            # mac

# 2) Simple local server (recommended)
python3 -m http.server 8765
# then open http://localhost:8765

# 3) Any static host (GitHub Pages, Netlify, Vercel, etc.)
```

## Features

**Gameplay**
- 11 vs 11 with a 4-3-3 formation (GK / 4 DEF / 3 MID / 3 FWD)
- Role-based AI: closest player chases the ball, the rest hold formation with possession bias
- Decision making: **shoot** (if in range and lane is clear) → **pass** (looks for the most advanced teammate with a clear lane) → **dribble**
- Goalkeeper tracks the ball's Y axis and steps out slightly when the ball comes close
- Gradual defensive press scaled by distance
- Player inertia (smoothed movement, no direction snap)

**Visual & "juice"**
- Grass stripes, vignette, penalty boxes, penalty spot, corner arcs, nets
- Stadium with 4500 colored pixels simulating a crowd
- Screen shake on goals and shots
- Particles: kick burst on touches, **colored confetti** on goals
- Ball trail
- Squash & stretch on players when the ball hits them
- Possession indicator (yellow ring on the player with the ball)
- Player name floating above whoever has possession

**Broadcast / TV feel**
- Center scoreboard with team color blocks
- Live **possession bar**
- **Shot count** per team
- Commentary toasts: `CHUTOU!`, `LANÇAMENTO!`, `GOOOL — RUBRO!` (Portuguese, kept for flavor)

**Automatic slow-motion replay**
- 3-second buffer recorded every frame
- Every goal triggers a replay at 0.45× with scanlines and a `REPLAY · espaço pula` label
- Skip anytime with `space` or click

**Procedural audio (Web Audio API, zero assets)**
- Ambient crowd loop (filtered pink noise)
- Goal cheer
- Whistle on kickoff/full-time
- Kick and shot sounds

## Controls

| Key | Action |
|-------|------|
| `space` | Pause / skip replay |
| `R` | Restart match |
| `+` / `-` | Speed up / slow down (0.5× to 4×) |
| `M` | Mute |
| `P` | Manually replay the last 3 seconds |
| click | Unlock audio + skip replay |

## Stack

- **HTML + Canvas 2D + vanilla JS** — single `index.html` file, ~750 lines
- No framework, no build step, no `node_modules`
- Web Audio API for all sound (no audio files)
- Everything pre-rendered into `<canvas>` — the crowd is cached on an offscreen canvas

Conscious choice not to use Three.js or PixiJS: for a simple top-down 2D game, plain Canvas 2D is the lightest, most direct tool. The whole thing is ~24KB.

## Roadmap

Things that would add more flavor:
- [ ] Set pieces: corner kick, throw-in, free kick
- [ ] Stamina and per-player skill variation
- [ ] End-of-match possession heatmap
- [ ] "Share clip" button (export the replay as WebM)
- [ ] Custom team colors/names
- [ ] Mobile touch support

PRs welcome.

## Origin

Built iteratively in Claude Code following the spirit of the original tweet: keep tweaking until it's actually fun to watch. The first version was 4v4, human-controlled, and visually raw. The current one is pure AI, 11v11, with layers of polish (replay, audio, particles, broadcast HUD) discovered after each match that felt too lifeless to be worth watching.

The in-game text is intentionally kept in Portuguese (`GOOOL`, `LANÇAMENTO`, `RUBRO`/`AZUL`) — partly for flavor, partly because that's how it was built.

## License

MIT — use it, fork it, modify it, do whatever.
