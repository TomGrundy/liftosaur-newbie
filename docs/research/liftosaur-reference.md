# Liftosaur reference (research)

Researched 2026-10-13 from the public repo `astashov/liftosaur` (default branch `master`, license AGPL-3.0, ~741 stars) and its docs. Raw base: `https://raw.githubusercontent.com/astashov/liftosaur/master/`. Anything not confirmed in source/docs is marked UNVERIFIED.

Primary sources:
- Language reference: `llms/liftoscript.md` (also rendered as `docs/content/liftoscript.md`)
- Examples: `llms/liftoscript_examples.md`, `programs/builtin/*.md`
- Exercise list: `src/models/exercise.ts`, `llms/exercises.md`, equipment ids in `src/types.ts`
- Planner parser grammar: `src/pages/planner/plannerExercise.grammar`; script-language grammar: `liftoscript.grammar`
- API: `docs/content/api.md`, `docs/content/mcp.md`, `lambda/api/v1.ts`, `lambda/utils/apiKeyAuth.ts`, `lambda/utils/apiv1.ts`

## 1. Liftoscript program syntax

### Structure (full-text mode)
Source: `llms/liftoscript.md` "Full mode, weeks and days".
```
# Week 1
## Day 1
Squat / 5x5 / progress: lp(5lb)

## Day 2
Squat / 3x8
```
- `# Name` = week header, `## Name` = day header (grammar tokens `Week`, `Day`: anything after `#`/`##` to end of line is the name; `plannerExercise.grammar`). A single-week program may omit them in per-day editor mode; the API takes the full text (`text` field).
- Each exercise is one line: `Name / section / section ...`. Sections are separated by `/`, name first, the rest in any order. A trailing `\` at end of a section continues the line on the next line.
- Comments: `// text` before an exercise line is that exercise's description (shown to user, Markdown allowed, carried into later weeks until overwritten; an empty `//` stops carrying). `/// text` is a private comment not shown to the user. Comments above `# Week` / `## Day` lines are week/day descriptions. Inside `{~ ~}` script blocks `//` is an ordinary code comment.
- Empty `## Day` headers in later weeks are REQUIRED for repeated (`[1-N]`) exercises to appear (`.claude/skills/liftoscript/SKILL.md`).

### Exercise name and equipment
- `Name` or `Name, Equipment`, e.g. `Bench Press, Dumbbell`, `Bicep Curl, EZ Bar`. The bare name resolves to the exercise's default equipment (`Bench Press` == `Bench Press, Barbell`). See section 2 for the exact names.
- Lookup (`Exercise_findByNameAndEquipment`, `src/models/exercise.ts`): split on `,`, take the last part, match case-insensitively against the display names (Barbell, Cable, Dumbbell, Smith Machine, Band, Kettlebell, Bodyweight, Leverage Machine, Medicine Ball, EZ Bar, Trap Bar). If it matches, the rest is the exercise name. Otherwise the whole string is the name. Exercise name matching is case-insensitive (`nameToIdMapping[name.toLowerCase()]`).
- Unknown exercise names: API returns a parse error such as `Unknown exercise: Barbell Curl` (`docs/content/api.md` error example). Custom exercises are allowed if defined on the account.
- Labels: `label: Exercise ...`, e.g. `main: Squat / 5x5`, `t1: Squat / ...t1`. Same exercise with different labels are treated as separate for progress purposes.
- Exercise variations (ladder): `Squat, Bodyweight | Pistol Squat | Front Squat / 3x8 / progress: custom() {~ ... exerciseVariationIndex += 1 ~}`; current one marked `!`.

### Sets, reps, weight, RPE, timers
Source: `llms/liftoscript.md` "Basics".
| Syntax | Meaning |
|---|---|
| `3x8` | 3 sets of 8 |
| `3x8-12` | rep range |
| `1x5, 1x3, 1x1, 5x5` | several set groups, comma-separated (8 sets) |
| `1x5+` | last set AMRAP |
| `@8` | RPE 8 (weight inferred from RPE table + 1RM); `@8+` asks user to log RPE |
| `60kg` / `135lb` | explicit weight; `100lb+` asks user for the actual weight; `?+` asks with no target |
| `70%` | percent of 1RM (`70%+` asks weight) |
| `90s` | rest timer for the set(s) |
| `60s\|30s` | active set timer 60s then rest 30s; `60s\|?` keeps default rest; `30s+\|60s` counts up |
| `auto` | auto-advance after rest (EMOM/Tabata): `Power Clean / 5x5 135lb 60s\|0s auto` |
| `4x5 (Main), 1x5 (AMRAP)` | set labels, max 8 chars, in parentheses |
Per-set vs shared: `Bench Press / 1x12 20s 60%, 5x5 20s 60%` equals `Bench Press / 1x12, 5x5 / 20s 60%` (a separate section applies to all sets). Example mixing: `Bench Press / 1x5 @8, 1x3 @9, 1x1 @10, 5x5 50%`. A section with weight and timer can be separate: `Bench Press / 3x8 / 60kg / 90s / progress: lp(2.5kg)` is consistent with this grammar (each of weight/timer is an `ExerciseSet` token group; `plannerExercise.grammar`) - the literal one-liner is the task author's example, not copied from docs (UNVERIFIED as a verbatim doc sample, but grammar-valid).
- Default rest timers (Me -> Timers): warmup 90s, workout 180s, superset empty (uses workout timer); `docs/features/rest-timer.md`.
- Short default alias: no weight given means weight empty (user must enter) unless RPE/percent given.

### Set variations (stage-based, e.g. GZCLP)
`Squat / 5x3 / 6x2 / 10x1 / progress: custom() {~ ... setVariationIndex += 1 ~}`; sets separated by `/` are variations, current marked with `!` (e.g. `/ ! 6x2 /`).

### Warmups
`warmup: 1x5 45lb, 1x5 135lb, 1x3 80%` (percent is of the first working set weight, no timer/RPE). `warmup: none` disables. Default warmups are auto-added when omitted. Use `warmup: none` for bodyweight lifts (SKILL.md).

### progress: built-ins
Applied program-wide per exercise(+label); define once (any week/day); later occurrences inherit. `progress: none` on a day disables it for that day. Conflicting definitions for same exercise+label error out.
- `lp(increase, successesNeeded, currentSuccesses, decrease, failuresNeeded, currentFailures)`; e.g. `lp(5lb)`, `lp(5lb, 2)`, `lp(5lb, 1, 0, 10%, 2, 0)`, `lp(5%)`, `lp(2.5kg)`
- `dp(increase, minReps, maxReps)`; e.g. `dp(5lb, 8, 12)`, `dp(5%, 6, 10)`. Set sets as `3x8` (do not use a rep range with dp - SKILL.md)
- `sum(repsThreshold, increase)`; e.g. `sum(30, 5lb)`
- `custom(stateVar: value, ...) {~ script ~}` - JS-like script. Reads: `weights[n]`/`w`, `completedWeights`/`cw`, `reps`/`r`, `completedReps`/`cr`, `RPE`, `timers`, `rm1`, `bodyweight`, `week`, `day`, `dayInWeek`, `numberOfSets`/`ns`, `setVariationIndex`, `descriptionIndex`, `state.x`, etc. Writes: `weights`, `reps`, `RPE`, `timers`, `rm1`, `numberOfSets`, `state.x`, `setVariationIndex`... Arrays 1-indexed; `weights[week:day:setvariation:set]`. Functions: `floor ceil round sum min max increment decrement sets rpeMultiplier calculate1RM calculateTrainingMax roundWeight zeroOrGte print`. Temp vars `var.x`, loops `for (var.i in completedReps) {}`, `if/else if/else`, ternary, `+= -= *= /=`.
- Reuse script with different params: `progress: custom(increment: 10lb) { ...main }`
- `update: custom() {~ ... ~}` runs during the workout (before any set with `setIndex == 0`, and on each set tap); can write `weights reps minReps RPE timers numberOfSets amraps logrpes askweights`, can call `sets(from,to,minReps,maxReps,isAmrap,weight,timer,rpe,logRpe)`.
- Tags: `id: tags(1, 100)` and `state[1].var = x` to alter other exercises' state.

### Reuse, templates, repeat
- `...Other Exercise` reuses sets/reps/weight/RPE/timers/warmup/progress/update of another exercise in the same week; `...Bench Press[2]` = day 2 same week; `...Bench Press[2:1]` = week 2 day 1. Override by adding sections after: `Bench Press / ...Squat / 150lb`.
- Template (unused) exercise: `t1 / used: none / 3x5 / 75% / progress: lp(5lb)` then `Squat / ...t1`. Template names are arbitrary. Declare `used: none` only once (week 1); do not repeat it on later-week redefinitions.
- Repeat across weeks: `Squat[1-4] / ...t1` (weeks 1-4); `Squat[order,1-4]` forced order. `[1,3,5]` is NOT week selection.
- Rest timers are NOT inherited across week redefinitions of a template (SKILL.md common mistake 10).
- Description reuse: `// ...Squat`.

### Supersets
`Squat / 3x8 / superset: A`, `Deadlift / 3x8 / superset: A` - same group name = superset within a day (`docs/features/supersets.md`, grammar `Superset { SupersetKeyword ":" ExerciseName }`). Name may not contain `/ { } ( ) # [ ] | !`. Default superset rest: the superset timer (empty by default -> workout timer). Pre-exhaust: `Chest Fly / 1x6 / 20lb 0s / superset: chest` + `Incline Bench Press / 1x6 / 95lb / warmup: none / superset: chest` (SKILL.md).

### Grammar summary (`plannerExercise.grammar`)
Tokens: `Weight` = `[+-]?number(lb|kg)`; `Percentage`; `Timer` = `Ns`; `SetTimer` = `Ns[+]|Ns|?`; `SetPart` = `Rep[+]xRep|RepRange[+]`; `Rpe` = `@num[+]`; `AskWeight` = `?+`; `SectionSeparator` = `/`; `Liftoscript` = `{~ ... ~}`; `NonSeparator` (names) excludes `/ { } ( ) space # [ ] | !`.

### Verbatim example programs (from `programs/builtin/*.md`, the ```liftoscript fence of each file)

Example A - Basic Beginner Routine (`programs/builtin/basicBeginner.md`):
```
# Week 1
## Workout A
main / used: none / 2x5, 1x5+ \
  / progress: custom(increase: 2.5lb) {~
  if (completedReps >= reps) {
    for (var.i in completedReps) {
      if (completedReps[ns] > 10) {
        weights[var.i] = completedWeights[var.i] + state.increase * 2
      } else {
        weights[var.i] = completedWeights[var.i] + state.increase
      }
    }
  } else {
    weights *= 0.9
  }
~}

Bent Over Row / ...main / 95lb
Bench Press / ...main / 45lb
Squat / ...main / 45lb / progress: custom(increase: 5lb) { ...main }

## Workout B
Chin Up / ...main / 0lb
Overhead Press / ...main / 45lb
Deadlift / ...main / 95lb / progress: custom(increase: 5lb) { ...main }
```

Example B - Starting Strength Phase 1 (`programs/builtin/ss1.md`):
```
# Week 1
## Workout A
Squat / 3x5 / 45lb / progress: lp(5lb, 1, 0, 10%, 2, 0)
Bench Press / 3x5 / 45lb / progress: lp(5lb, 1, 0, 10%, 2, 0)
Deadlift / 1x5 / 95lb / progress: lp(5lb, 1, 0, 10%, 2, 0)

## Workout B
Squat / 3x5 / 45lb
Overhead Press / 3x5 / 45lb / progress: lp(5lb, 1, 0, 10%, 2, 0)
Deadlift / 1x5 / 95lb
```

Example C - 5/3/1 Boring But Big (`programs/builtin/the531bbb.md`):
```
# Week 1
## Day 1
main / used: none / 1x5 58%, 1x5 67%, 1x5+ 76%, 5x10 50% / progress: custom(increment: 5lb) {~
  if (week % 3 == 0) {
    rm1 += state.increment
  }
~}

Overhead Press[1-4] / ...main
Chin Up[1-4] / 5x10 / 0lb / warmup: none
Skullcrusher[1-4] / 5x10 / 45lb / warmup: none

## Day 2
Deadlift[1-4] / ...main / progress: custom(increment: 10lb) { ...main }
Bicep Curl[1-4] / 5x10 / 20lb / warmup: none
Hanging Leg Raise[1-4] / 5x10 / 0lb / warmup: none

## Day 3
Bench Press[1-4] / ...main
Triceps Extension[1-4] / 5x10 / 20lb / warmup: none
Hammer Curl[1-4] / 5x10 / 25lb / warmup: none

## Day 4
Squat[1-4] / ...main / progress: custom(increment: 10lb) { ...main }
Pull Up[1-4] / 5x10 / 0lb / warmup: none
Ab Wheel[1-4] / 5x10 / 0lb / warmup: none


# Week 2
## Day 1
main / 1x3 63%, 1x3 72%, 1x3+ 81%, 5x10 50%

## Day 2


## Day 3


## Day 4



# Week 3
## Day 1
main / 1x5 67%, 1x3 76%, 1x1+ 85%, 5x10 50%

## Day 2


## Day 3


## Day 4



# Week 4 - Deload
## Day 1
main / 1x5 36%, 1x5 45%, 1x5 54%, 5x10 40%

## Day 2


## Day 3


## Day 4
```

Example D - GZCLP (`programs/builtin/gzclp.md`):
```
# Week 1
## Day 1
// ...t1
t1: Squat / ...t1

// ...t2
t2: Bench Press / ...t2

// ...t3
t3: Lat Pulldown / ...t3

## Day 2
// ...t1
t1: Overhead Press / ...t1 / progress: custom(increase: 5lb) { ...t1 }

// ...t2
t2: Deadlift / ...t2 / progress: custom(increase: 10lb, stage3increase: 15lb) { ...t2 }

// ...t3
t3: Bent Over Row / ...t3

## Day 3
// ...t1
t1: Bench Press / ...t1 / progress: custom(increase: 5lb) { ...t1 }

// ...t2
t2: Squat / ...t2 / progress: custom(increase: 10lb, stage3increase: 15lb) { ...t2 }

// ...t3
t3: Lat Pulldown / ...t3

## Day 4
// ...t1
t1: Deadlift / ...t1

// ...t2
t2: Overhead Press / ...t2

// ...t3
t3: Bent Over Row / ...t3


// **T1**. It starts with **85% of 5RM** (or approximately **75% or 1RM**).
// You can adjust your 1RM by clicking the **1RM** link under the exercise name.
// There's the RM calculator there to help find it out if you don't know it

// **T1**.

// **T1**. Retest week, you may skip warmups. Find your new 5RM (5 rep max), as follows
// * Start with the bar, do 5 reps.
// * Throw on some more weight, do 5 reps.
// * Repeat, when the bar starts to get heavy, make smaller jumps.
// * When you finally get to a set that is hard, but you do it - take that number, and enter into "5RM Test" set weight
// * Mark it completed!
t1 / used: none / 4x3, 1x3+ / 5x2, 1x2+ / 9x1, 1x1+ / 1x5 (5RM Test) / 75% / progress: custom(increase: 10lb) {~
  if (descriptionIndex == 1) {
    descriptionIndex = 2
  }
  if (setVariationIndex == 4) {
    descriptionIndex = 2
    setVariationIndex = 1
    weights = completedWeights[1] * 0.85
    rm1 = completedWeights[1] / rpeMultiplier(5, 10)
  } else if (completedReps >= reps) {
    weights = completedWeights[ns] + state.increase
  } else if (setVariationIndex == 3) {
    descriptionIndex = 3
    setVariationIndex += 1
  } else {
    setVariationIndex += 1
  }
~}

// **T2**. Start with **35% of 1RM**.
// You can adjust your 1RM by clicking the **edit** icon, and setting the **1 Rep Max** value.
// There's the RM calculator there to help find it out if you don't know it

// **T2**.
t2 / used: none / 3x10 / 3x8 / 3x6 / 62% / progress: custom(stage1weight: 0lb, increase: 5lb, stage3increase: 10lb) {~
  if (descriptionIndex == 1) {
    descriptionIndex = 2
  }
  if (completedReps >= reps) {
    weights = completedWeights[ns] + state.increase
  } else if (setVariationIndex == 1) {
    state.stage1weight = completedWeights[ns]
    setVariationIndex += 1
  } else if (setVariationIndex == 2) {
    setVariationIndex += 1
  } else {
    setVariationIndex = 1
    weights = state.stage1weight + state.stage3increase
  }
~}

// **T3**.
t3 / used: none / 2x15, 1x15+ / 60% 90s / progress: custom(increase: 5lb) {~
  if (completedReps[ns] >= 25) {
    weights = completedWeights[ns] + state.increase
  }
~}
```

Built-in program files are Markdown with YAML frontmatter (`id`, `name`, `author`, `url`, `shortDescription`, `isMultiweek`, `tags`, `frequency`, `age`, `duration`, `goal`) plus prose and one ```liftoscript fence. ~65 programs live in `programs/builtin/`; `lambda/programs.json` is a built version.

## 2. Exercise and equipment names

Extracted from `src/models/exercise.ts` (`allExercisesList` for id/name/defaultEquipment/types/starting weights, and `metadata` for `targetMuscles`, `synergistMuscles`, `bodyParts`, `sortedEquipment`). Full machine-readable result: `docs/research/exercises.json` (218 exercises). Plain-name list as shown to the AI: `llms/exercises.md`.

JSON fields: `id`, `name`, `equipment` (allowed ids = `sortedEquipment`), `defaultEquipment`, `equipmentDisplayNames`, `programTextForms`, `types`, `targetMuscles`, `synergistMuscles`, `bodyParts`, `startingWeightLb`, `startingWeightKg`.

### Equipment ids and program-text names
Ids from `equipments` in `src/types.ts`; display names from `equipmentName()` in `src/models/exercise.ts`:
| id | text in program |
|---|---|
| barbell | Barbell |
| cable | Cable |
| dumbbell | Dumbbell |
| smith | Smith Machine |
| band | Band |
| kettlebell | Kettlebell |
| bodyweight | Bodyweight |
| leverageMachine | Leverage Machine |
| medicineball | Medicine Ball |
| ezbar | EZ Bar |
| trapbar | Trap Bar |
Form: `<Exercise Name>, <Display Name>`; omit the `, X` part for the exercise's `defaultEquipment` (shorter alias). Users can rename equipment in settings (`equipmentSettings[x].name`), but the parser (`Exercise_findByNameAndEquipment`) matches the built-in display names only (not renamed ones) - based on reading the code, UNVERIFIED at runtime.

Quirks in the data (verified from the extraction): `chestPress`, `declineBenchPress`, `hangClean`, `rowing`, `torsoRotation` have a `defaultEquipment` that is not in their `sortedEquipment` list; `jumpingJack` and `lateralBoxJump` have no defaultEquipment. Validate against the app/API rather than trusting the `programTextForms` field for those.

### Sample (see JSON for all 218)
Bench Press: barbell(default), cable, dumbbell, smith, band, kettlebell (text forms `Bench Press`, `Bench Press, Dumbbell`, ...). Squat, Deadlift, Overhead Press, Bent Over Row, Chin Up, Pull Up, Bicep Curl, Lat Pulldown, Triceps Pushdown, etc. are all in the JSON; names that appear in built-in programs (`Hanging Leg Raise`, `Skullcrusher`, `Triceps Extension`, `Hammer Curl`, `Ab Wheel`) are valid.

## 3. Weight units
- Suffix `kg` or `lb` directly after number (`60kg`, `135lb`, `2.5kg`, `.5lb`); no space. Percent: `70%`. Source: `llms/liftoscript.md` "Values", grammar `Weight`.
- Recommended to always use units on weights; they convert to the user's chosen unit (settings). Importing a program in the other unit offers conversion (`docs/features/sharing-programs.md`). A weight with no unit in a progression arg is a plain number.
- Per-equipment unit override exists (Equipment Unit: Default/lb/kg) - `docs/features/equipment-and-gyms.md`.
- Bodyweight exercises: write `0lb` (or `0kg`); with `update: custom() {~ if (setIndex == 0) { weights = bodyweight } ~}` to show/record bodyweight. Weighted: `Pull Up, Bodyweight / 3x8 25lb / update: ...weights = bodyweight + originalWeights[ns]`. Assisted (Leverage Machine, or custom equipment with "Is assisting?"): `weights = bodyweight - originalWeights[ns]`, `lp(-5lb)`. Source: `llms/liftoscript.md` "Bodyweight and Assisted Exercises". Built-in programs use `Chin Up / 5x10 / 0lb / warmup: none`.
- Bands: `band` equipment; in equipment settings each band is a "plate" with the weight it takes off (assist). How band resistance is written in program text beyond that: UNVERIFIED (no separate syntax found).
- Starting weight defaults per exercise: `startingWeightLb` / `startingWeightKg` in JSON (used when no weight given? Per SKILL.md, authors must set a weight explicitly; if omitted, the field is empty and the user enters it).

## 4. API, API keys, MCP, tooling

### Public REST API: YES (Premium required)
Sources: `docs/content/api.md`, `docs/features/api.md`, `lambda/api/v1.ts`, `lambda/utils/apiKeyAuth.ts`.
- Create a key in app: Me -> API Keys -> Create. Key format `lftsk_...`. Requires a signed-in account and active Premium subscription (otherwise HTTP 403 `subscription_required`: "Active subscription required to use the API").
- Base URL `https://www.liftosaur.com/api/v1`.
- Auth header: `Authorization: Bearer lftsk_your_key_here` (code checks `startsWith("Bearer lftsk_")`; else 401 `unauthorized`).
- Write requests should also send `X-Liftosaur-Device-Id: <stable id>` (sync-engine node id; hashed with key; `ApiKeyAuth_deviceIdForKey`). Workout-running endpoints additionally require `X-Liftosaur-Client` (400 `invalid_input` if missing; `docs/content/api.md` "Running a Workout"). For plain program create/update the header is optional per code (device id derived from key if absent) - treat as recommended.
- CORS: `access-control-allow-origin: *`; methods OPTIONS,GET,POST,PUT,DELETE.
- Request body is JSON (code also tolerates base64 body).

Program endpoints:
```
GET    /api/v1/programs                 -> {"data":{"programs":[{"id","name","isCurrent"}]}}
GET    /api/v1/programs/:id             -> {"data":{"id","name","text","isCurrent"}}   (id=current allowed)
POST   /api/v1/programs                 body {"name":"My Program","text":"# Week 1\n## Day 1\nSquat / 3x5 / 135lb / progress: lp(5lb)"}
                                        -> 201 {"data":{"id","name","text"}}     (name defaults to "New Program"; text required else 400 invalid_input)
PUT    /api/v1/programs/:id             body {"text":"...","name":"optional"} -> {"data":{"id","name","text","isCurrent"}}  (id=current allowed)
DELETE /api/v1/programs/:id             -> {"data":{"deleted":true}}   (cannot delete the active program)
```
- Invalid Liftoscript -> `422` with `{"error":{"code":"parse_error","message":"Failed to parse program","details":[{"line":3,"offset":1,"message":"Unknown exercise: Barbell Curl"}]}}`. So POST is itself a server-side validator, but it saves on success; to validate without saving use the playground or program-stats endpoints below.
- Created programs are not made active automatically (new program appended; `isCurrent` false until chosen in app) - inferred from `ApiV1_createProgram` (no current-program change), UNVERIFIED in app.
- Validate/simulate without saving: `POST /api/v1/playground` body `{"programText","day","week","commands":["complete_set(1,1)","change_weight(1,1,185lb)","finish_workout()"]}` -> `{"data":{"workout","updatedProgramText"}}`; `POST /api/v1/program-stats` body `{"programText"}` -> per-day minutes, weekly sets per muscle, strength/hypertrophy split.
- Other endpoints: history (`GET/POST /history`, `GET/PUT/DELETE /history/:id`, query `startDate endDate limit(max 200, default 50) cursor`), gyms, equipment, exercise-data, measurements, and workout-running (`next workout`, start, current, set, finish, discard, settings). See `docs/content/api.md`.
- Error codes: 400 invalid_input, 401 unauthorized, 403 subscription_required, 404, 409 conflict, 422 parse_error/program_error.
- Rate limits: none documented; no rate-limiting code found in `lambda/api/v1.ts` or `lambda/utils/apiKeyAuth.ts`. UNVERIFIED whether infra (API Gateway/CloudFront) throttles.

### MCP server: YES
Source: `docs/content/mcp.md`, `lambda/mcp/*`. URL `https://www.liftosaur.com/mcp` (Streamable HTTP). Auth: OAuth 2.1 (dynamic client registration) or `Authorization: Bearer lftsk_...` (same API key). Premium required. Claude Code: `claude mcp add liftosaur --transport http https://www.liftosaur.com/mcp --header "Authorization: Bearer lftsk_your_key_here"`. Tools include `create_program`, `update_program`, `get_program`, `list_programs`, `delete_program`, `run_playground`, `get_program_stats`, history/custom-exercise/gym/equipment/measurement CRUD, and no-auth reference tools: `get_liftoscript_reference`, `get_liftoscript_examples`, `list_exercises`, `list_builtin_programs`, `get_builtin_program`, `get_program_design_guide`. Source for tool schemas: `lambda/mcp/tools.ts`.

### Official CLI / npm package for validation: none found
- No `liftosaur`/`liftoscript` npm package found (npm registry search returned nothing relevant at research time; the main package.json is the app, not published).
- Repo-local validator only: `scripts/validate_liftoscript.ts` (`TS_NODE_TRANSPILE_ONLY=1 npx ts-node scripts/validate_liftoscript.ts file.md`) uses `PlannerEvaluator_evaluateFull` (`src/pages/planner/plannerEvaluator.ts`) with default settings; requires cloning the whole repo and its deps.
- Practical validation route without cloning: POST to `/api/v1/playground` or `/api/v1/program-stats` (needs an API key + Premium) or use the MCP playground.
- Grammar files: `src/pages/planner/plannerExercise.grammar` (planner text: weeks/days/exercise lines; compiled by `npm run grammar:planner` to `src/pages/planner/plannerExerciseParser.ts` via `@lezer/generator`), `liftoscript.grammar` (script language inside `{~ ~}`; generated `src/generated/liftoscriptGrammar.ts`), `src/liftohistory/liftohistory.grammar` (history/"Liftoscript Workouts" format).
- Real validation also needs semantic checks (exercise name lookup, reuse resolution, state vars) in `plannerEvaluator.ts` / `plannerExerciseEvaluator.ts` - the grammar alone only validates syntax.
- License: AGPL-3.0 (`LICENSE` is GNU AGPL v3; `package.json` `"license": "AGPL-3.0"`; GitHub API `license.spdx_id` = `AGPL-3.0`). Vendoring grammar/evaluator into another project makes it a derivative work: strong copyleft, including network-use (AGPL section 13) - any service exposing it must offer corresponding source. For a personal, non-distributed tool it is fine; for anything published/hosted, either comply with AGPL (open-source your project under AGPL) or just call the official API instead. No separate commercial/dual license found (UNVERIFIED; check with author).

## 5. Import mechanisms (non-API)
- Short share link: `https://www.liftosaur.com/p/<id>` (created via `POST /shorturl/p` with `{"url": "<long link>"}`, `lambda/index.ts`; resolves via `/api/p/:id`). In app: Me -> Program -> Import -> paste link. Signed-in users can also tap "Add this program to your account" on the web page. Source: `docs/features/sharing-programs.md`.
- Long link: `https://www.liftosaur.com/program?data=<encoded>` (also `/planner?data=...` used for the web editor). Encoding (`src/utils/encoder.ts`, `Encoder_encode`): UTF-8 JSON -> gzip -> base64 -> prefixed `data:application/octet-stream;base64,` -> base64 again; put in the `data` query param (URL-encoded). Decoding: `lambda/utils/nodeEncoder.ts`.
- Payload JSON (`Program_exportProgram`, `src/models/program.ts`): `{"customExercises": {...}, "program": IProgram, "version": "<latest migration version>", "settings": {"units","timers","planner"}}`. `program.planner` holds the text: `{"vtype":"planner","name":"...","weeks":[{"name":"Week 1","days":[{"name":"Day 1","exerciseText":"Squat / 3x5 / 135lb"}]}]}`. A minimal program is built by `Program_create(name)` (fields: vtype "program", id (8-char uid), name, url "", author "", shortDescription "", description "", nextDay 1, weeks [], isMultiweek, days, exercises [], tags [], clonedAt). Constructing a valid `data` link by hand is feasible but depends on migration `version`; treat as fragile (UNVERIFIED end-to-end).
- Program JSON file: Me -> Import / Export -> "Import program from JSON file" (same `IExportedProgram` shape); overwrites a program with the same id. Source: `docs/features/import-export.md`.
- Text: Export all programs gives one `.txt` with each program under `======= Name =======` headers; the text can be pasted into the program editor (full-text mode) of a new program. Pasting Liftoscript into the in-app/web program editor (`https://www.liftosaur.com/planner` web editor, also supports private link `/user/p/<programId>` for signed-in editing) is the lowest-tech fallback.
- Full backup: "Export data to JSON file" / "Import data from JSON file" (wipes current data).
- History import: Hevy CSV or Liftosaur CSV only (`docs/features/import-export.md`).
- Free/premium split: the API and MCP require Premium; share links, text paste and JSON import do not (premium requirement for them not documented - UNVERIFIED).
