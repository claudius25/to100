import { Mesh, Object3D } from 'three';
import { BATTERY_SIDES, type BatterySide } from './interaction.types';

/**
 * All GLB node lookup lives here. The object classes only ever see the
 * semantic bindings below, so a better nursery model needs a new asset URL and
 * new node names in this file — not new puzzle logic.
 */

export interface RoomBindings {
  readonly root: Object3D;
  readonly floor: Object3D;
  readonly rug: Object3D;
  readonly window: Object3D;
}

export interface BearBindings {
  readonly root: Object3D;
  readonly body: Object3D;
  readonly eyes: readonly Mesh[];
  readonly pocketFlap: Object3D;
  readonly pawButton: Object3D;
  readonly compartment: Object3D;
  readonly batteries: Readonly<Record<BatterySide, Object3D>>;
}

export interface DeskBindings {
  readonly root: Object3D;
  readonly drawer: Object3D;
  readonly screwdriver: Object3D;
}

export interface ClockBindings {
  readonly root: Object3D;
  readonly door: Object3D;
  readonly screw: Object3D;
  readonly compartment: Object3D;
  readonly batteries: Readonly<Record<BatterySide, Object3D>>;
  readonly digits: readonly Object3D[];
  readonly colons: readonly Object3D[];
  readonly snooze: Object3D;
}

export interface BedBindings {
  readonly cot: Object3D;
  readonly frontRail: Object3D;
  readonly mobile: Object3D;
  readonly arm: Object3D;
  readonly clamp: Object3D;
  readonly switchGroup: Object3D;
  readonly startButton: Object3D;
  readonly compartment: Object3D;
  /** The two empty slots, ordered by side (-1 first). */
  readonly slots: readonly Object3D[];
  readonly door: Object3D;
  readonly rotor: Object3D;
}

export interface NurseryBindings {
  readonly root: Object3D;
  readonly room: RoomBindings;
  readonly bear: BearBindings;
  readonly desk: DeskBindings;
  readonly clock: ClockBindings;
  readonly bed: BedBindings;
}

export const NURSERY_NODES = {
  root: 'Nursery',
  room: 'Room',
  floor: 'Floor',
  rug: 'Rug',
  window: 'Window',
  bear: 'Seated_teddy_bear',
  bearBody: 'Teddy_imported_STL',
  bearEye: (side: BatterySide) => `Teddy_eye_${side}`,
  bearPocket: 'Teddy_pocket_flap',
  bearPaw: 'Teddy_paw_button',
  bearCompartment: 'Teddy_battery_compartment',
  bearBattery: (side: BatterySide) => `Teddy_battery_compartment_battery_${side}`,
  desk: 'Side_table',
  drawer: 'Table_drawer',
  screwdriver: 'Screwdriver',
  clock: 'Digital_alarm_clock',
  clockDoor: 'Clock_battery_door',
  clockScrew: 'Clock_cover_screw',
  clockCompartment: 'Clock_battery_compartment',
  clockBattery: (side: BatterySide) => `Clock_battery_compartment_battery_${side}`,
  clockSnooze: 'Snooze_button',
  digitPrefix: 'Digit_',
  colon: 'Colon',
  cot: 'Cot',
  frontRail: 'Front_rail',
  mobile: 'Mobile',
  mobileArm: 'Mobile_arm',
  mobileClamp: 'Mobile_clamp',
  mobileSwitch: 'Mobile_switch',
  mobileStartButton: 'Mobile_start_button',
  mobileCompartment: 'Mobile_battery_compartment',
  mobileSlot: 'Mobile_battery_compartment_slot',
  mobileDoor: 'Mobile_battery_door',
  mobileRotor: 'Mobile_rotor',
} as const;

function describe(scope: Object3D): string {
  return scope.name || 'the nursery scene root';
}

/**
 * GLTFLoader makes node names unique, so the second `Colon` in the asset
 * arrives as `Colon_1`. Bindings match the authored base name either way.
 */
function matchesBaseName(actual: string, base: string): boolean {
  return actual === base || /^_\d+$/.test(actual.slice(base.length));
}

function collectByBaseName(scope: Object3D, base: string): Object3D[] {
  const found: Object3D[] = [];
  scope.traverse((node) => {
    if (node.name.startsWith(base) && matchesBaseName(node.name, base)) found.push(node);
  });
  return found;
}

/**
 * Scoped lookup. Several names are not unique in the asset — the toy teddy on
 * the mobile repeats `Teddy_eye_*` — so nothing may be looked up from the root.
 */
function required(scope: Object3D, name: string): Object3D {
  const found = collectByBaseName(scope, name)[0];
  if (!found) {
    throw new Error(`The nursery model is missing the node "${name}" under "${describe(scope)}".`);
  }
  return found;
}

function requiredMesh(scope: Object3D, name: string): Mesh {
  const found = required(scope, name);
  if (!(found instanceof Mesh)) {
    throw new Error(`The nursery node "${name}" under "${describe(scope)}" is not a mesh.`);
  }
  return found;
}

/** Collects the digit segments, which share a prefix rather than a name. */
function collect(scope: Object3D, match: (node: Object3D) => boolean): Object3D[] {
  const found: Object3D[] = [];
  scope.traverse((node) => {
    if (match(node)) found.push(node);
  });
  return found;
}

function requiredAll(scope: Object3D, name: string, count: number): Object3D[] {
  const found = collectByBaseName(scope, name);
  if (found.length !== count) {
    throw new Error(
      `The nursery model should contain ${count} "${name}" nodes under "${describe(scope)}" but has ${found.length}.`,
    );
  }
  return found;
}

function bySide(
  scope: Object3D,
  name: (side: BatterySide) => string,
): Record<BatterySide, Object3D> {
  const pair = {} as Record<BatterySide, Object3D>;
  for (const side of BATTERY_SIDES) pair[side] = required(scope, name(side));
  return pair;
}

/**
 * Wraps the loaded GLB in semantic bindings. Transforms and nesting are left
 * exactly as authored; nothing is reparented, so no world matrix can be lost.
 */
export function createNurseryBindings(scene: Object3D): NurseryBindings {
  const root = scene.name === NURSERY_NODES.root ? scene : required(scene, NURSERY_NODES.root);
  const roomRoot = required(root, NURSERY_NODES.room);
  const bearRoot = required(roomRoot, NURSERY_NODES.bear);
  const deskRoot = required(roomRoot, NURSERY_NODES.desk);
  const clockRoot = required(deskRoot, NURSERY_NODES.clock);
  const drawer = required(deskRoot, NURSERY_NODES.drawer);
  const cot = required(root, NURSERY_NODES.cot);
  const mobile = required(root, NURSERY_NODES.mobile);
  const switchGroup = required(mobile, NURSERY_NODES.mobileSwitch);
  const compartment = required(switchGroup, NURSERY_NODES.mobileCompartment);
  const digits = collect(clockRoot, (node) => node.name.startsWith(NURSERY_NODES.digitPrefix));
  if (digits.length === 0) {
    throw new Error('The nursery clock has no digit segments to light up.');
  }

  return {
    root,
    room: {
      root: roomRoot,
      floor: required(roomRoot, NURSERY_NODES.floor),
      rug: required(roomRoot, NURSERY_NODES.rug),
      window: required(roomRoot, NURSERY_NODES.window),
    },
    bear: {
      root: bearRoot,
      body: required(bearRoot, NURSERY_NODES.bearBody),
      eyes: BATTERY_SIDES.map((side) => requiredMesh(bearRoot, NURSERY_NODES.bearEye(side))),
      pocketFlap: required(bearRoot, NURSERY_NODES.bearPocket),
      pawButton: required(bearRoot, NURSERY_NODES.bearPaw),
      compartment: required(bearRoot, NURSERY_NODES.bearCompartment),
      batteries: bySide(bearRoot, NURSERY_NODES.bearBattery),
    },
    desk: {
      root: deskRoot,
      drawer,
      screwdriver: required(drawer, NURSERY_NODES.screwdriver),
    },
    clock: {
      root: clockRoot,
      door: required(clockRoot, NURSERY_NODES.clockDoor),
      screw: required(clockRoot, NURSERY_NODES.clockScrew),
      compartment: required(clockRoot, NURSERY_NODES.clockCompartment),
      batteries: bySide(clockRoot, NURSERY_NODES.clockBattery),
      digits,
      colons: requiredAll(clockRoot, NURSERY_NODES.colon, 2),
      snooze: required(clockRoot, NURSERY_NODES.clockSnooze),
    },
    bed: {
      cot,
      frontRail: required(cot, NURSERY_NODES.frontRail),
      mobile,
      arm: required(mobile, NURSERY_NODES.mobileArm),
      clamp: required(mobile, NURSERY_NODES.mobileClamp),
      switchGroup,
      startButton: required(switchGroup, NURSERY_NODES.mobileStartButton),
      compartment,
      slots: requiredAll(compartment, NURSERY_NODES.mobileSlot, 2).sort(
        (left, right) => left.position.x - right.position.x,
      ),
      door: required(switchGroup, NURSERY_NODES.mobileDoor),
      rotor: required(mobile, NURSERY_NODES.mobileRotor),
    },
  };
}
