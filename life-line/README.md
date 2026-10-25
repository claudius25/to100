# LifeLine

Minimalist life-journey game prototype (Angular 21 + plain Three.js).

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
