# Liftosaur Newbie

Beginner workout programs for [Liftosaur](https://www.liftosaur.com), as copy-paste Liftoscript.

- **Static site** (React + Vite) listing every program, with filters for equipment, days, intensity and session length, plus a "Copy script" button.
- **CLI** to generate new programs from the equipment you own, validate them, and upload them to your Liftosaur account through the official API.
- **GitHub Action** that asks for equipment, intensity, session length and days per week, then generates a program, uploads it to Liftosaur, commits it and republishes the site.

## Quick start

```sh
npm install
npm run dev                      # site at http://localhost:5173
npm run cli -- generate          # interactive prompts
npm run cli -- --help
```

## CLI

```sh
# Generate (non-interactive)
npm run cli -- generate --gear barbell,dumbbell,dualPulley,latPulldown,band,pullUpBar \
  --intensity moderate --duration 60 --days 3

# Three variations, print only
npm run cli -- generate --gear free-weights --intensity light --days 2 --duration 30 --count 3 --print

# Generate and upload in one step
npm run cli -- generate --gear dumbbell --intensity hard --duration 45 --days 4 --upload

npm run cli -- validate                 # lint everything in programs/
npm run cli -- validate --remote        # also validate via the Liftosaur API
npm run cli -- upload programs/<id>.json
npm run cli -- list [--remote]
npm run cli -- starters                 # regenerate the curated starter set
```

Gear values: `barbell` (with rack and bench), `dumbbell`, `kettlebell`, `ezbar`, `trapbar`, `dualPulley` (dual adjustable cable pulley), `latPulldown` (pull-down station), `band`, `pullUpBar`, `machines`. Aliases: `free-weights` (barbell, dumbbell, kettlebell), `all`, `none` (bodyweight only).

Intensity sets the rep scheme and rest:

| Intensity | Main lifts | Accessories | Rest (main / accessory) |
|---|---|---|---|
| light | 2×10 | 2×12 | 90s / 60s |
| moderate | 3×8 | 3×10 | 120s / 75s |
| hard | 3×5 + 1×5+ (AMRAP) | 3×8 | 180s / 90s |

The weekly split depends on days per week:

| Days per week | Split |
|---|---|
| 2–3 | Full body |
| 4 | Upper/lower |
| 5 | Upper/lower/full |

Exercises are added in priority order until the estimated session time is reached. Each program records its seed, so the same options and seed always give the same program.

Progressions:

| Exercise type | Progression | Rule |
|---|---|---|
| Barbell compounds | `lp` | Add weight after every successful session; drop 10% after repeated failures |
| Dumbbell, cable and machine lifts | `dp` | Add reps up to +4, then add weight and reset the reps |
| Bodyweight and band moves | `custom` | Add a rep to every set once all sets hit their target, up to a ceiling |

All weights are in kg.

## Uploading to Liftosaur

Uploading uses Liftosaur's public API (`POST https://www.liftosaur.com/api/v1/programs`), which **requires Liftosaur Premium**. Create a key in the app under **Me → API Keys**; it starts with `lftsk_`. Put it in `.env` (see `.env.example`) or export `LIFTOSAUR_API_KEY`.

Every upload creates a **new** program in your account and doesn't change your active program. Before creating it, the CLI checks the program with `/program-stats`, which validates without saving.

Without Premium, copy the script from the site and paste it into a new program's text editor in the app, or into https://www.liftosaur.com/planner.

## GitHub setup

1. Create a GitHub repo and push this project to `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → New repository secret:** `LIFTOSAUR_API_KEY`. This is optional; without it, programs are published to the site but not uploaded.
4. **Actions → Generate program → Run workflow.** Tick your equipment and pick the intensity, session length and days per week.

`deploy.yml` also rebuilds the site on every push to `main`. It runs typecheck, tests and the program linter first.

## How validity is ensured

Liftosaur's parser is AGPL-3.0, so it isn't copied into this project. Programs are checked at three levels instead:

1. **Local linter** (`src/core/validate.ts`): checks structure and section syntax. It also checks every exercise and equipment name against Liftosaur's 218 built-in exercises in `src/core/data/liftosaur-exercises.json`. It runs on every generate, in tests, and in CI.
2. **Official check** (`scripts/validate-official.sh`, dev only): clones Liftosaur into `~/.cache/liftosaur-src` and runs its own `validate_liftoscript.ts` and evaluator. It also replays every day through Liftosaur's playground, once with all sets completed and once with all sets failed, so the `lp`, `dp` and `custom` progressions actually run.
   - Run it with `scripts/validate-official.sh`. Set `PROGRAMS_DIR=<empty dir>` to test a 576-program matrix instead of `programs/`.
3. **API check**: `/program-stats` before every upload, and `validate --remote`.

## Layout

```
src/core/     generator, exercise catalog, Liftoscript serializer, linter
src/cli/      commander CLI
src/api/      Liftosaur REST client
web/          React site (Vite)
programs/     program JSON files (starters + generated), rendered by the site
scripts/      official-validator harness
docs/research Liftosaur syntax/API research notes
```
