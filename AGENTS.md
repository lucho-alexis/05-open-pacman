# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man clone. No package.json, no bundler, no tests, no linter, no CI — do not look for or invent npm scripts.

## Run

Open `src/index.html` directly in a browser, or serve the repo statically (e.g. `python3 -m http.server` from `src/`). Verification is manual gameplay — there is no automated test suite.

## Architecture: script order + window globals (no ES modules)

`src/index.html` loads classic scripts in this exact order; each file depends on globals exposed by the previous ones via `window.*`:

1. `maze.js` → `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`
2. `game.js` → `createGame()`, `update(game)`, `DIRS`
3. `render.js` → `draw(ctx, game, frame)`
4. `main.js` → game loop, keyboard, overlay screens

Adding a JS file means adding a `<script>` tag to `index.html` in the right position and following the same global-exposure pattern. Do not introduce imports/bundlers.

## Maze invariants (`src/js/maze.js`)

- Grid is 28×31, parsed from strings: `#`=wall(1), `.`=dot(2), ` `=walkable(0), `-`=pen door(3).
- `MAZE` is pristine and never mutated; `createGame()` copies it to `game.grid`, which is what gets mutated (dots eaten) and rendered.
- The pen door (3) blocks Pac-Man but not ghosts (`isWall` in `game.js`).
- Row 14 is the wrap-around tunnel; the maze must stay symmetric about the axis between columns 13 and 14.
- Canvas is `TILE * grid` (560×620, TILE=20 in `render.js`).

## Conventions

- Code comments and UI text are in Spanish — keep new code that way.
- Positions are fractional cell coordinates (speeds like 0.125/frame); actors only turn when aligned (`aligned()` in `game.js`).

## Workflow: spec-driven development

This repo exists to practice this method (see `README.md`). New features should go through the repo skills, not straight to code:

1. `/spec <description>` — clarifying questions, then saves `specs/NN-slug.md` (zero-padded, next sequential number) in `Draft` state.
2. User reviews and marks the spec `Approved`.
3. `/spec-impl NN-slug` — implements it on a branch named `spec-NN-slug` (auto-created unless `specs/.spec-config.yml` sets `AutoCreateBranch: false`).

`specs/` does not exist yet; the first spec would be `01-`.
