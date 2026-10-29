# LifeLine

Minimalist life-journey game prototype (Angular 21 + plain Three.js).

## Play TO100

Run `npm start` and open **http://localhost:4200/game**, or choose **Play TO100**
on the home page. The game route is available in both development and production.

The standalone page in `src/app/game/` uses the same Angular-independent
`GameEngine` as the simulation. Its full-screen landscape has a pale textured sky,
dark ground, twelve numbered encounter icons, a static baby silhouette, and two
clickable dice. The dice result is shown for 800ms before the baby starts moving.
The baby slides (without a crawling animation) to the landing
offset, then a modal describes the encounter and actual changes. Press **OK** to
slide the environment and character left together, returning the hero to the starting
position. Uncrossed encounters stay on the path; `StepFactory` appends only the missing
tiles to restore twelve. Numbers are relative roll offsets and reset after every scene
shift: only 2 through 12 are displayed; the unreachable number 1 is always hidden.
The initial unreachable offset 1 is empty and has no icon. Later offset 1 can contain
a preserved encounter but remains unreachable on that roll.
Rolling is locked during landing, the popup, and camera scrolling. New game resets
the presentation as well as the engine, including the dice pause. Reduced-motion
settings shorten both slides but keep the 800ms pause to read the dice result.
Hover or focus a step for its encounter details. Money, energy, health, mood, and age
remain visible above the horizon, with the resolved encounter shown in the sky.

Use **State & debug** below the scene for blueprint, inventory, journey log, and
**Debug: current state JSON**. JSON reflects the engine immediately after each roll
or reset, even while the previous board is being used for the presentation-only
slide. The texture and silhouette are local SVG artwork; no Three.js is used here.

Each visit starts a new in-memory game with the model's default blueprint (all four
traits at 50). The `/starting-blueprint` tower (1–4 levels) is not imported or
converted to the model's 0–100 trait scale. Leaving/reloading the page loses the session;
there is no save/load yet. New game resets all model state and upcoming encounters.

## Starting blueprint

Open **http://localhost:4200/starting-blueprint**. Four nested Three.js cubes reveal
the starting traits in order: health blueprint, family finances, emotional
resilience, social skills (levels 1–4, equally likely). Press the active cube or the
button below it; a single state machine (`ready → spinning → waiting → revealing →
ready`, then `done`) drives both. One second after each result, the next cube rises
from inside the previous one, flies clear of its closing flaps, and lands.

- `blueprint-tower/blueprint-tower.ts`: standalone `BlueprintTower` component with
  `traitDetermined` (once per roll), `blueprintCompleted` (once, `BlueprintResult`),
  and `restarted` outputs. It never touches Hero or game state.
- `blueprint-tower/blueprint-sequence.ts`: Angular-free state machine; samples each
  result once per accepted press and ignores stale callbacks after reset/destroy.
- `blueprint-tower/tower-animation.ts`: timings and pure pose math (spin, nested
  reveal, flaps, landing). Defaults follow the prototype; `[timings]` can override them.
  `prefers-reduced-motion` uses a short spin/reveal with no wobble or bounce.
- `blueprint-tower/tower-scene.ts` and `face-textures.ts`: renderer, canvas-drawn
  faces, picking, `ResizeObserver` framing, and full GPU/DOM disposal.
- Without WebGL, the same sequence drives a simplified 2D tower with a notice.

`StartingBlueprintPage.onBlueprintCompleted` receives the `BlueprintResult` and
re-emits it through `beginLife` when **Begin life** is pressed. There is no store yet,
and no adapter to the simulation Hero's 0–100 blueprint (`physicalResilience`, etc.)
has been defined, so none is invented.

## TO100 simulation

Run `npm start` and open **http://localhost:4200/simulation**. This plain debugging
page is registered only in Angular development mode; production builds fall through
to the existing home redirect. Existing game pages are unchanged.

The Angular-independent model lives in `src/app/simulation/model/`:
`Hero`, `Step`, `StepFactory`, and `GameEngine`, with supporting types and separate
encounter data in `step-templates.ts`. The page only calls the engine and renders
detached snapshots. An optional RNG (values in `[0, 1)`) and template collection can
be supplied to the engine/factory for deterministic testing.

- Age uses 52 weeks per year, with a target of exactly 5,200 weeks.
- Upcoming array index 0 is offset 1, which cannot be reached with two standard dice.
  Only the landing encounter activates. The initial offset 1 is always empty.
  After a turn the board drops crossed/landed steps, retains the remaining instances,
  and generates only enough new age-eligible encounters to return to twelve.
  This scrolling-board behavior replaces the earlier fresh-board prototype.
  The final turn clears upcoming steps and does not generate more encounters.
- A roll reaching/passing 5,200 weeks advances only the remaining weeks and resolves
  no encounter. Later `rollTurn()` calls return `null` without consuming randomness
  or changing state. Successful turns return a structured result and record a detached
  hero snapshot in history. State reads and returned results are also detached.
- Consumables activate immediately; collectibles are stored without applying effects.
  Actual changes are net changes after applying effects in listed order and clamping.
- Health 0 does **not** end the game yet. There are no passive effects or manual item
  use. Blueprint values, including family finances and social skills, start at 50
  and have no mechanics yet. Family finances are separate from personal money.
- Age bands are whole-year ranges: 0 to before 5, 5 to before 14, 14 to before 25,
  25 to before 60, and 60 onward. Effects are fictional game-balancing placeholders.

Validation:

```bash
npm test -- --watch=false
npm run build
npm run build -- --configuration development
```

## Character Lab

The movement/appearance prototype lives at **`/character-lab`**: a procedural, articulated
character walking along a straight ground line under a fixed orthographic side camera.

```bash
npm start      # then open http://localhost:4200/character-lab
```

### Where things live

| Concern | File |
| --- | --- |
| Page + HTML controls | `src/app/character-lab/character-lab.ts` / `.html` / `.scss` |
| Typed config, slider limits, presets, derived metrics | `src/app/character-lab/model/character-config.ts` |
| Joint/rig contract (swap in a rigged GLB later) | `src/app/character-lab/model/character-rig.ts` |
| Renderer, orthographic camera, resize, loop, picking | `src/app/character-lab/three/scene-controller.ts` |
| Geometry, materials, joint hierarchy | `src/app/character-lab/three/character-factory.ts` |
| Walk cycle, idle, leg IK | `src/app/character-lab/three/character-animator.ts` |
| Marker targeting, facing, gait phase | `src/app/character-lab/three/movement-controller.ts` |
| Inverted-hull outline material | `src/app/character-lab/three/outline.ts` |

* **Change how he looks** — proportions and presets in `character-config.ts`
  (`computeMetrics` derives every absolute dimension), shapes in `character-factory.ts`.
* **Change how he walks** — stride, foot trajectory, bob and arm swing in
  `character-animator.ts`; speed, turning and stopping rules in `movement-controller.ts`.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.28.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
