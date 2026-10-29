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

Use **State & debug** to open an overlay for blueprint, inventory, journey log, and
**Debug: current state JSON**. JSON reflects the engine immediately after each roll
or reset, even while the previous board is being used for the presentation-only
slide. The texture and silhouette are local SVG artwork; no Three.js is used here.

Opening `/game` directly starts a new in-memory game with the model's default
blueprint (all four traits at 50). Completing `/blueprint-water` first supplies the
hero's name, mapped blueprint, and Chapter 1 record instead. New game resets the
journey while retaining that origin, if present. Reloading restarts the journey;
the origin remains in that browser history entry, but turns are not saved.
The older `/starting-blueprint` tower remains a separate prototype.

### Full-viewport landscape layout

Both `/game` and `/blueprint-water` fill the available viewport, including after
resizing or rotating the device. Controls and debugging panels overlay the scene;
they do not reserve space below it or create a scrolling page. Scroll inside an
open debug panel instead. Controls account for device safe-area insets.

On portrait touch devices, a **Rotate your phone** screen blocks interaction until
the device is landscape. It does not reset the chapter or game. Turn off the device's
rotation lock if necessary. Desktop portrait windows remain usable.

Where supported, **Fullscreen** requests fullscreen from a user tap, then attempts
to lock touch devices to landscape. Orientation locking is browser-dependent and
usually requires fullscreen; it cannot be guaranteed on iPhones or other browsers
without the required APIs. Unsupported or rejected requests show manual-rotation
guidance. Fullscreen is optional: manually rotating still works in the normal browser.
Exiting fullscreen releases any orientation lock acquired by the page.

## Liquid blueprint / Chapter 1

Open **http://localhost:4200/blueprint-water**, or choose **Chapter 1 · Liquid
blueprint** on the home page. This is a separate standalone `BlueprintWater`
component, not a replacement for the tower.

The scene starts as a blank surface. Six taps (or Enter/Space on the scene)
reveal:

1. Recessed `Name:` only.
2. One of exactly 100 unique short male names (3–6 letters), filling with blue water.
3. `Health:` with a 1–4 level and the existing trait label, filling green.
4. `Finance:` with its level/label, filling yellow-orange.
5. `Emotions:` with its level/label, filling pink-red.
6. `Social:` with its level/label, filling purple.

Labels are dry, right-aligned recesses; values share a separate left-aligned
column with a fixed gap. Existing rows remain visible. Each result is sampled once;
filling locks further taps. Start over cancels pending work and clears the surface.
The scene button is keyboard-accessible and a live region announces the results.
The chapter UI contains the tappable scene, a **Fullscreen** control where supported,
the optional **DEV** button and, after completion, the **Begin life** button, all
overlaid on the scene. Tap instructions and row announcements remain available to
screen readers. Navigation failures are still shown as alerts.

New letters do not pop into full-depth holes: their floors begin flush with the
surface and ease downward, continuously exposing the recess walls. Existing text
stays still. Once the press-in finishes, the liquid waits briefly, rises from the
bottom, and gradually develops opacity and its final color from a clear state.
For Health, Finance, Emotions and Social, each tap first presses in only the label,
waits `labelValueDelayMs` after that reveal settles, then presses in and fills the
value. The next tap stays locked until both phases finish.

### Tweaking Chapter 1

Edit `src/app/blueprint-water/chapter.constants.ts`:

- `MALE_NAMES`: the 100 short male names.
- `CHAPTER_TEXT`, `CHAPTER_TRAITS`, `CHAPTER_LEVEL_LABELS`: chapter copy, row labels,
  and level wording. Level wording is shared with the original tower.
- `CHAPTER_COLORS`: the five liquid colors, clear-liquid color and ground/text colors.
- `CHAPTER_TIMINGS`: `pressMs` (1100), `labelValueDelayMs` (400),
  `fillDelayMs` (180), `fillMs` (1800), and
  `settleMs` (180). All values are milliseconds. Label-only taps skip liquid timings.
- `CHAPTER_LIQUID`: target fill height, final opacity, `clearOpacity` (how visible the
  clear liquid is when it starts rising), fraction of the rise spent clear before color
  develops, and surface finish.
- `CHAPTER_SCENE`: `fontSize` (0.62, Three.js world units; also scales 2D preview
  text), recess depth, row spacing, column positions and `framingPadding` (0.1).
  Both camera projections cap the configured zoom to fit the complete five-row layout,
  including every possible name and trait value, on load and resize. Framing is
  reserved before the first tap, so revealing rows does not move the camera.
- `CHAPTER_VIEW`: default projection, zoom, pan, camera rotation in degrees, plane
  rotation around Z (`planeRotationZ`, degrees), ambient light intensity/enabled, and
  both directional lights' XYZ positions and enabled flags. The surface lies in the XY plane; +Z
  points out of the ground.
- `CHAPTER_DEBUG` (default `false`): whether the camera/light panel, FPS overlay/sampling
  and expandable state JSON start open.
- `CHAPTER_DEV_BUTTON` (default `true`): shows a **DEV** button at the top centre in
  development and production builds that shows or hides those tools at runtime (turning
  them off also stops FPS sampling and mouse camera controls). Set to `false` to hide it.
- `CHAPTER_STATS` (requires `CHAPTER_DEBUG`): the FPS overlay in the top-left corner. `visible` (shown on
  load; toggle with "Show FPS stats"), `sampleMs` (refresh/averaging window) and
  `slowFrameMs` (frames slower than this count as slow). The overlay shows FPS, average
  and worst frame time, CPU time per frame, idle/moving activity and pixel ratio, canvas
  size, whether the GI pass ran, and draw calls/triangles per frame.
- `CHAPTER_QUALITY`: lightweight rendering defaults: `curveSegments` (12),
  `maxPixelRatio` (1.5) and `shadowMapSize` (2048). The higher pixel-ratio cap improves
  sharpness on high-density mobile displays at additional GPU cost. Renderer antialiasing is enabled;
  multisampled post-processing and supersampling are disabled; resolution does not increase when
  idle. `giAoIntensity` defaults to 0 so the idle scene keeps the same render path as
  the animation. Raise it in the dev controls to enable AO only while idle. Text and
  liquid reveal animations are unchanged.
- `CHAPTER_MOUSE`: rotation and scroll-zoom sensitivity for the dev mouse controller.
- `giEnabled`, `giEnvironment`, `giAoIntensity`, `giAoRadius` (in `CHAPTER_VIEW`): a
  WebGL global-illumination approximation that combines RoomEnvironment image-based
  bounce light with optional GTAO ambient occlusion. Environment bounce is on by
  default; ambient occlusion is off by default for performance. Three's true screen-space GI
  (`SSGINode`) requires `WebGPURenderer` and is not compatible with this WebGL water scene.
- `CHAPTER_WATER`: GPU mask size and damping, plus the always-on liquid motion that
  needs no touch or hover. `rippleIntervalMs`/`dropsPerRipple`/`impulse`/`rippleRadius`
  control the automatic drops, `maxAmplitude` caps their height, and `swellAmplitude`,
  `swellSpeed` and `swellWavelength` control a constant rolling swell. Heights are
  also limited by the space above the liquid, so it never spills over the surface.
- `CHAPTER_SCENE.plateSize` (80): width and height of the ground plate.

The component also accepts a partial `[timings]` override. The same timing/pose
helpers drive the GPU scene and the 2D preview's schedule. Reduced motion caps
press and fill at 120ms each, skips the delays, and disables continuing ripples.

With `npm start` (Angular development mode), tap **DEV** at the top (or set `CHAPTER_DEBUG = true`), then expand **Dev: camera & lights** at
the top-right of the scene. Toggle orthographic/perspective and use the live sliders
for zoom, pan, yaw, tilt, roll, and key/fill light positions. Moving a light refreshes
its shadows. Reset restores `CHAPTER_VIEW`; zoom remains capped to keep all text
visible. **Start over** resets the chapter. The panel includes selectable JSON:
copy those values into `CHAPTER_VIEW` to keep your preferred view. The sliders
do not alter chapter results or reset on a new chapter; they reset on page reload.
They require WebGL and are disabled in the 2D fallback. The entire panel is absent
in production mode (`npm run build`), while the configured defaults still apply.
Enable **Mouse camera controls** in that same dev panel to left-drag to rotate,
right-drag/middle-drag/Shift-drag to pan on the ground plane, and scroll to zoom.
Mouse movements update the sliders and settings JSON in either projection.
While enabled, scene clicks do not reveal rows; disable the controller to continue
the chapter. It remains usable during reveals and after the chapter is completed.
Uncheck **Key light enabled** or **Fill light enabled** to turn that light off
without losing its position. Reset restores both enabled flags as well.

**Begin life** passes the completed chapter to `/game`. As explicitly selected,
levels 1/2/3/4 map to 25/50/75/100, with health blueprint mapped to
`physicalResilience`. The game engine records Chapter 1 in `Hero.chapters`.
Family finances do not grant personal money, and starting condition values remain 100. Traits still have no passive gameplay effects.

Implementation under `src/app/blueprint-water/`:

- `blueprint-chapter.ts`: Angular-free six-tap sequence, names, typed rows and result.
- `relief-scene.ts`: actual inset letter geometry, liquid surfaces, lighting,
  responsive framing, pointer ripples, and renderer/geometry cleanup.
- `gpu-water.ts`: the supplied scene's masked GPU heightfield recurrence, adapted
  to the project's Three.js version. A 256×256 mask confines waves to value glyphs,
  including letter counters. Static wall shadows are recomputed on row or light changes.
- `hero-blueprint.ts`: validated router-history handoff and the explicit scale adapter.

Water rises in recess depth (Z), as in the supplied archive; this is a surface-wave
simulation, not a volumetric fluid/overflow solver. Reduced motion uses a short fill
without continuing ripples. Missing WebGL2, GPU initialization failure, or context
loss displays an explicit notice and switches to an animated 2D preview using the
same sequence/results. Renderer failures are also logged to the console.

The local Helvetiker font is copied unchanged from the supplied archive, including
its embedded Magenta font license. Three.js/water-example attribution is preserved
in `public/blueprint-water/THREE-LICENSE.txt`; the renderer uses the existing npm
Three.js dependency rather than copying the archive's bundled library.

Focused validation: `npm test -- --watch=false --include=src/app/blueprint-water`.

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
re-emits it through `beginLife` when **Begin life** is pressed. This older tower
does not navigate to the game; the new liquid chapter owns the explicit handoff
and 1–4 to 0–100 mapping.

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

| Concern                                               | File                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Page + HTML controls                                  | `src/app/character-lab/character-lab.ts` / `.html` / `.scss` |
| Typed config, slider limits, presets, derived metrics | `src/app/character-lab/model/character-config.ts`            |
| Joint/rig contract (swap in a rigged GLB later)       | `src/app/character-lab/model/character-rig.ts`               |
| Renderer, orthographic camera, resize, loop, picking  | `src/app/character-lab/three/scene-controller.ts`            |
| Geometry, materials, joint hierarchy                  | `src/app/character-lab/three/character-factory.ts`           |
| Walk cycle, idle, leg IK                              | `src/app/character-lab/three/character-animator.ts`          |
| Marker targeting, facing, gait phase                  | `src/app/character-lab/three/movement-controller.ts`         |
| Inverted-hull outline material                        | `src/app/character-lab/three/outline.ts`                     |

- **Change how he looks** — proportions and presets in `character-config.ts`
  (`computeMetrics` derives every absolute dimension), shapes in `character-factory.ts`.
- **Change how he walks** — stride, foot trajectory, bob and arm swing in
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
