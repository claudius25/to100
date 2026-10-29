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

On entry, a launcher displays `src/assets/launcher.png` with a centered **Play**
button. The same image blocks interaction on portrait touch devices until the
device is landscape. It does not reset the chapter or game. Turn off the device's
rotation lock if necessary. Desktop portrait windows remain usable.
An active game encounter popup temporarily closes in portrait and reopens when
landscape resumes, without acknowledging the encounter or rolling again.

Where supported, **Play** requests fullscreen from a user tap, then attempts
to lock touch devices to landscape. Orientation locking is browser-dependent and
usually requires fullscreen; it cannot be guaranteed on iPhones or other browsers
without the required APIs. Unsupported or rejected requests show manual-rotation
guidance. Fullscreen is optional: manually rotating still works in the normal browser.
Exiting fullscreen releases any orientation lock acquired by the page.

## Raised-label blueprint / Chapter 1

Open **http://localhost:4200/blueprint-water**, or choose **Chapter 1 · Liquid
blueprint** on the home page. This is a separate standalone `BlueprintWater`
component, not a replacement for the tower.

The scene starts as a blank surface. Six taps (or Enter/Space on the scene) reveal:

1. `NAME:` rises out of the ground as a pressable text button.
2. Press `NAME:`: it depresses and returns to its raised position; a randomly selected
   short male name sinks into the ground while `HEALTH:` rises on the next row.
3. Press `HEALTH:`: it returns after pressing; its 1–4 level/description sinks while `FINANCE:` rises.
4. Press `FINANCE:`: its value sinks while `EMOTIONS:` rises.
5. Press `EMOTIONS:`: its value sinks while `SOCIAL:` rises.
6. Press `SOCIAL:`: its value sinks, completing the chapter. A random black phrase
   lies flat along an L-shaped path below Social, then turns 90 degrees upward beyond
   the value column. Letters turn between glyphs so no letter is folded across the corner.

Only the currently raised label accepts pointer/touch presses after the initial tap;
its bounding rectangle has a small hit-area padding. Keyboard Enter/Space activates
the current label through the accessible scene button. Labels remain right-aligned;
values share a separate left-aligned column with a fixed gap. All settled text is
dry: labels stay raised and values remain recessed, with no liquid surfaces,
water simulation or fill delays.
Existing rows remain visible. Each result is sampled once; animation locks further
taps. Start over cancels pending work and clears the surface. A live region announces
the results.
The chapter UI contains the tappable scene, an initial **Play** launcher,
the optional **DEV** button and, after completion, the bottom-right **Begin life** button, all
overlaid on the scene. The launcher **Play** button sits slightly below centre (58% height).
Tap instructions and row announcements remain available to
screen readers. Navigation failures are still shown as alerts.

New values begin flush with the surface and ease downward, continuously exposing
the recess walls. The pressed label travels a small distance while staying raised, then returns,
while the value sinks and the next label rises. Previously revealed rows stay still.
Native mobile tap highlighting is disabled, without removing keyboard focus outlines.

### Tweaking Chapter 1

Edit `src/app/blueprint-water/chapter.constants.ts`:

- `MALE_NAMES`: the 100 short male names.
- `CHAPTER_TEXT`, `CHAPTER_TRAITS`, `CHAPTER_LEVEL_LABELS`: chapter copy, row labels,
  and level wording. Level wording is shared with the original tower.
- `CHAPTER_COLORS`: ground/text colors and retained trait color metadata.
- `CHAPTER_CLOSING_TEXTS`: ten possible closing phrases, selected once per chapter.
- `CHAPTER_PATH_TEXT`: closing phrase font size, black color, spacing, surface offset,
  and `gap` (0.6 world units) for extra clearance below Social, beside the values,
  and above Name. Increase `gap` to move the whole path farther from the buttons.
  distance below Social, clearance beyond the value column, and `bendRadius` (0.65)
  for a continuous rounded 90-degree turn. When the rising text reaches the Name row
  (`nameTurnOffset` shifts that height), it takes a second rounded turn to the right.
  `startLeft` (1.5) moves the starting point left of Social; `finalRun` (2) limits the
  straight after the second bend. `fontSize` is a maximum: longer phrases scale down
  to fit this bounded path instead of forcing the camera out and shrinking the buttons.
  Glyph outlines follow the whole curve,
  rather than switching abruptly between horizontal and vertical. Camera framing reserves
  room for every possible phrase before the first reveal.
- `CHAPTER_APPEARANCE.fadeMs` (650): opacity fade for the closing phrase and **Begin life**;
  shortened to 120ms with reduced motion.
- `CHAPTER_TIMINGS`: `pressMs` (640) for simultaneous rise/press motion and
  `settleMs` (40) before accepting the next press. All values are milliseconds.
  Both the 3D scene and 2D preview use cubic ease-out for quick keyboard-like travel
  that slows smoothly into its final position.
- `CHAPTER_SCENE`: `fontSize` (0.62, Three.js world units; also scales 2D preview
  text), `recessDepth` (0.24), `raisedHeight` (0.24), `keyTravel` (0.045),
  `labelHitPadding` (0.12),
  row spacing, column positions and `framingPadding` (0.1).
  Both camera projections cap the configured zoom to fit the complete five-row layout,
  including every possible name and trait value, on load and resize. Framing is
  reserved before the first tap, so revealing rows does not move the camera.
- `CHAPTER_VIEW`: default projection, zoom, pan, camera rotation in degrees, plane
  rotation around Z (`planeRotationZ`, degrees), ambient light intensity/enabled, and
  both directional lights' XYZ positions and enabled flags. The surface lies in the XY plane; +Z
  points out of the ground.
- `CHAPTER_DEBUG` (default `false`): whether the camera/light panel, FPS overlay/sampling
  and expandable state JSON start open.
- `CHAPTER_DEV_BUTTON` (default `true`): allows revealing a **DEV** button at the top
  centre in development and production builds. Tap the invisible top-left corner three
  times within 1.2 seconds to reveal it, then press **DEV** to toggle the tools. These
  corner taps do not advance the chapter. `CHAPTER_DEV_UNLOCK` configures the tap count,
  time window and corner size (64 CSS pixels). `CHAPTER_DEBUG` also reveals the button
  immediately when enabled. Turning tools off stops FPS sampling and mouse camera
  controls. Set `CHAPTER_DEV_BUTTON` to `false` to disable the reveal gesture and button.
- `CHAPTER_STATS` (requires visible dev tools): the FPS overlay in the top-left corner. `visible` (shown on
  load; toggle with "Show FPS stats"), `sampleMs` (refresh/averaging window) and
  `slowFrameMs` (frames slower than this count as slow). The overlay shows FPS, average
  and worst frame time, CPU time per frame, idle/moving activity and pixel ratio, canvas
  size, whether the GI pass ran, and draw calls/triangles per frame.
- `CHAPTER_QUALITY`: lightweight rendering defaults: `curveSegments` (12),
  `maxPixelRatio` (2) and `shadowMapSize` (2048). The higher pixel-ratio cap improves
  sharpness on high-density mobile displays at additional GPU cost. Renderer antialiasing is enabled;
  multisampled post-processing and supersampling are disabled; resolution does not increase when
  idle. `giAoIntensity` defaults to 0 so the idle scene keeps the same render path as
  the animation. Raise it in the dev controls to enable AO only while idle.
- `CHAPTER_MOUSE`: rotation and scroll-zoom sensitivity for the dev mouse controller.
- `giEnabled`, `giEnvironment`, `giAoIntensity`, `giAoRadius` (in `CHAPTER_VIEW`): a
  WebGL global-illumination approximation that combines RoomEnvironment image-based
  bounce light with optional GTAO ambient occlusion. Environment bounce is on by
  default; ambient occlusion is off by default for performance. Three's true screen-space GI
  (`SSGINode`) requires `WebGPURenderer` and is not compatible with this WebGL scene.
- `CHAPTER_SCENE.plateSize` (80): width and height of the ground plate.

The component also accepts a partial `[timings]` override. The same timing/pose
helpers drive the 3D scene and the 2D preview's schedule. Reduced motion caps
the simultaneous rise/press at 120ms and skips the settling delay.

With `npm start` (Angular development mode), tap **DEV** at the top (or set `CHAPTER_DEBUG = true`), then expand **Dev: camera & lights** at
the top-right of the scene. Toggle orthographic/perspective and use the live sliders
for zoom, pan, yaw, tilt, roll, and key/fill light positions. Moving a light refreshes
its shadows. Reset restores `CHAPTER_VIEW`; zoom remains capped to keep all text
visible. **Start over** resets the chapter. The panel includes selectable JSON:
copy those values into `CHAPTER_VIEW` to keep your preferred view. The sliders
do not alter chapter results or reset on a new chapter; they reset on page reload.
They require WebGL and are disabled in the 2D fallback. The DEV button also works
in production when `CHAPTER_DEV_BUTTON` is enabled.
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
- `relief-scene.ts`: raised and inset letter geometry, label hit-testing, lighting,
  responsive framing and renderer/geometry cleanup. Shadows update during text motion.
- `hero-blueprint.ts`: validated router-history handoff and the explicit scale adapter.

Missing WebGL2, renderer initialization failure, or context
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
