import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { Bear } from './bear';
import type {
  AnchoredMessage,
  CameraRequest,
  CollectedItem,
  NurseryEvents,
  SelectedItem,
} from './interaction.types';
import { readInventory, sanitiseSelection, toggleSelection } from './inventory';
import { createNurseryBindings, NURSERY_NODES } from './model-bindings';
import { NurseryWorld } from './nursery-world';
import { NURSERY_TEXT } from './nursery.config';
import { PuzzleState } from './puzzle-state';

function group(name: string, children: Object3D[] = []): Object3D {
  const node = new Object3D();
  node.name = name;
  if (children.length > 0) node.add(...children);
  return node;
}

function mesh(name: string, children: Object3D[] = []): Mesh {
  const node = new Mesh(new BoxGeometry(0.05, 0.05, 0.05), new MeshStandardMaterial());
  node.name = name;
  if (children.length > 0) node.add(...children);
  return node;
}

function batteryPair(prefix: string): Object3D[] {
  return [-1, 1].map((side) => mesh(`${prefix}_battery_${side}`));
}

/** A stand-in for the GLB with the same node names, nesting and duplicates. */
function buildNurseryModel(): Object3D {
  const slotLeft = mesh(NURSERY_NODES.mobileSlot);
  slotLeft.position.set(-0.026, 0, 0.013);
  // GLTFLoader uniquifies repeated names, so the second slot arrives suffixed.
  const slotRight = mesh(`${NURSERY_NODES.mobileSlot}_1`);
  slotRight.position.set(0.026, 0, 0.013);

  const clock = group('Digital_alarm_clock', [
    mesh('Clock_display'),
    mesh('Snooze_button'),
    mesh('Digit_0_a'),
    mesh('Digit_0_b'),
    mesh('Colon'),
    mesh('Colon_1'),
    group('Clock_battery_compartment', [
      mesh('Clock_battery_compartment_tray'),
      ...batteryPair('Clock_battery_compartment'),
    ]),
    group('Clock_battery_door', [mesh('Clock_door_panel'), mesh('Clock_cover_screw')]),
  ]);

  const bear = group('Seated_teddy_bear', [
    mesh('Teddy_imported_STL'),
    mesh('Teddy_eye_-1'),
    mesh('Teddy_eye_1'),
    group('Teddy_pocket_flap', [mesh('Fabric_pocket')]),
    mesh('Teddy_paw_button'),
    group('Teddy_battery_compartment', [
      mesh('Teddy_battery_compartment_tray'),
      ...batteryPair('Teddy_battery_compartment'),
    ]),
  ]);
  bear.rotation.y = Math.PI / 2;
  bear.position.x = -1.43;

  return group('Nursery', [
    group('Room', [
      mesh('Floor'),
      mesh('Rug'),
      mesh('Back_wall'),
      group('Window', [mesh('Window_sky')]),
      group('Side_table', [
        mesh('Oak_tabletop'),
        clock,
        group('Table_drawer', [
          mesh('Drawer_front'),
          group('Screwdriver', [mesh('Screwdriver_handle')]),
          mesh('Pencil'),
        ]),
      ]),
      bear,
    ]),
    group('Cot', [mesh('Bed_base'), group('Front_rail', [mesh('Side_top_rail')])]),
    group('Mobile', [
      mesh('Mobile_arm'),
      mesh('Mobile_clamp'),
      group('Mobile_switch', [
        mesh('Mobile_start_button'),
        group('Mobile_battery_compartment', [
          mesh('Mobile_battery_compartment_tray'),
          slotLeft,
          slotRight,
        ]),
        group('Mobile_battery_door', [mesh('Mobile_cover')]),
      ]),
      // The toy teddy repeats the eye names the seated bear uses.
      group('Mobile_rotor', [group('Toy_Teddy', [mesh('Teddy_eye_-1_1'), mesh('Teddy_eye_1_1')])]),
    ]),
  ]);
}

interface RecordedEvents extends NurseryEvents {
  messages: (AnchoredMessage | null)[];
  cameras: CameraRequest[];
  collected: CollectedItem[];
  running: boolean[];
  statuses: string[];
  roomViews: number;
  selectionClears: number;
}

function recordEvents(): RecordedEvents {
  const events: RecordedEvents = {
    messages: [],
    cameras: [],
    collected: [],
    running: [],
    statuses: [],
    roomViews: 0,
    selectionClears: 0,
    messageRequested: (message) => void events.messages.push(message),
    cameraRequested: (request) => void events.cameras.push(request),
    roomViewRequested: () => void (events.roomViews += 1),
    itemCollected: (item) => void events.collected.push(item),
    runningChanged: (running) => void events.running.push(running),
    selectionCleared: () => void (events.selectionClears += 1),
    statusChanged: (text) => void events.statuses.push(text),
  };
  return events;
}

function setUp() {
  const model = buildNurseryModel();
  const bindings = createNurseryBindings(model);
  const events = recordEvents();
  const state = new PuzzleState();
  const world = new NurseryWorld(bindings, state, events);
  const find = (name: string, scope: Object3D = model): Object3D => {
    const node = scope.getObjectByName(name);
    if (!node) throw new Error(`Missing test node ${name}`);
    return node;
  };
  /** Mimics the scene: one hit, resolved to the owner with the strongest claim. */
  const tap = (name: string, selected: SelectedItem = null, scope?: Object3D): void => {
    const target = world.resolve(find(name, scope));
    if (target) world.handle(target, selected);
  };
  return { model, bindings, events, state, world, find, tap };
}

/** Collects both teddy batteries and both clock batteries into the inventory. */
function collectEverything(context: ReturnType<typeof setUp>): void {
  const { tap, world } = context;
  tap('Table_drawer');
  tap('Screwdriver_handle');
  tap('Fabric_pocket');
  tap('Teddy_battery_compartment_battery_-1');
  tap('Teddy_battery_compartment_battery_1');
  world.clock.handleHit('door', { kind: 'screwdriver' });
  tap('Clock_battery_compartment_battery_-1');
  tap('Clock_battery_compartment_battery_1');
}

describe('Nursery model bindings', () => {
  it('scopes lookups so the toy teddy on the mobile cannot be mistaken for the bear', () => {
    const { bindings, find } = setUp();
    const bearRoot = find('Seated_teddy_bear');
    for (const eye of bindings.bear.eyes) {
      expect(eye.parent).toBe(bearRoot);
    }
    expect(bindings.clock.colons).toHaveLength(2);
    expect(bindings.clock.digits.length).toBeGreaterThan(0);
    expect(bindings.bed.slots.map((slot) => slot.position.x)).toEqual([-0.026, 0.026]);
  });

  it('reports which node is missing instead of failing later', () => {
    const model = buildNurseryModel();
    model.getObjectByName('Mobile_start_button')!.removeFromParent();
    expect(() => createNurseryBindings(model)).toThrow(/Mobile_start_button/);
  });
});

describe('Nursery puzzle state', () => {
  it('refuses to start with no batteries, and never completes the chapter', () => {
    const state = new PuzzleState();
    expect(state.pressStart()).toBe('no-power');
    expect(state.running).toBe(false);
    expect(state.puzzleCompleted).toBe(false);
  });

  it('cannot install a single battery', () => {
    const state = new PuzzleState();
    state.collectBattery('clock:-1');
    expect(state.installBatteries('clock').outcome).toBe('not-enough');
    expect(state.installedCount()).toBe(0);
    expect(state.inventoryCount('clock')).toBe(1);
  });

  it('never collects the same item twice or lets a count go negative', () => {
    const state = new PuzzleState();
    expect(state.collectBattery('teddy:-1')).toBe(true);
    expect(state.collectBattery('teddy:-1')).toBe(false);
    expect(state.inventoryCount('teddy')).toBe(1);
    expect(state.collectScrewdriver()).toBe(true);
    expect(state.collectScrewdriver()).toBe(false);
  });

  it('completes only on a real start, and stays complete after stopping', () => {
    const state = new PuzzleState();
    state.collectBattery('clock:-1');
    state.collectBattery('clock:1');
    expect(state.installBatteries('clock').outcome).toBe('installed');
    // Installing alone is not completion.
    expect(state.puzzleCompleted).toBe(false);
    expect(state.running).toBe(false);

    expect(state.pressStart()).toBe('started');
    expect(state.running).toBe(true);
    expect(state.puzzleCompleted).toBe(true);

    expect(state.pressStart()).toBe('stopped');
    expect(state.running).toBe(false);
    expect(state.puzzleCompleted).toBe(true);
  });

  it('refuses depleted teddy batteries and keeps the chapter unfinished', () => {
    const state = new PuzzleState();
    state.collectBattery('teddy:-1');
    state.collectBattery('teddy:1');
    expect(state.installBatteries('teddy').outcome).toBe('installed');
    expect(state.pressStart()).toBe('no-power');
    expect(state.puzzleCompleted).toBe(false);
  });

  it('returns a swapped-out pair to the inventory with its source and charge intact', () => {
    const state = new PuzzleState();
    for (const id of ['teddy:-1', 'teddy:1', 'clock:-1', 'clock:1'] as const) {
      state.collectBattery(id);
    }
    state.installBatteries('teddy');
    state.installBatteries('clock');
    expect(state.inventoryCount('teddy')).toBe(2);
    expect(state.inventoryCount('clock')).toBe(0);
    expect(state.installedSource()).toBe('clock');
    expect(state.battery('teddy:-1')?.charge).toBe('depleted');
    // Conservation: four batteries, each at exactly one place.
    expect(state.list()).toHaveLength(4);
    expect(state.list().filter((battery) => battery.location === 'mobile')).toHaveLength(2);
  });

  it('stops the mobile during a swap and clears completion on a full reset', () => {
    const state = new PuzzleState();
    state.collectBattery('clock:-1');
    state.collectBattery('clock:1');
    state.collectBattery('teddy:-1');
    state.collectBattery('teddy:1');
    state.installBatteries('clock');
    state.pressStart();
    expect(state.running).toBe(true);
    state.installBatteries('teddy');
    expect(state.running).toBe(false);
    expect(state.puzzleCompleted).toBe(true);

    state.reset();
    expect(state.puzzleCompleted).toBe(false);
    expect(state.inventoryCount('clock')).toBe(0);
    expect(state.locationOf('clock:-1')).toBe('source');
  });
});

describe('Nursery inventory', () => {
  it('derives grouped counts and keeps a single selection', () => {
    const state = new PuzzleState();
    expect(readInventory(state).empty).toBe(true);
    state.collectScrewdriver();
    state.collectBattery('clock:-1');
    const view = readInventory(state);
    expect(view.screwdriver).toBe(true);
    expect(view.batteries).toEqual([{ source: 'clock', label: 'Clock batteries', count: 1 }]);

    const screwdriver = toggleSelection(null, { kind: 'screwdriver' });
    expect(screwdriver).toEqual({ kind: 'screwdriver' });
    expect(toggleSelection(screwdriver, { kind: 'batteries', source: 'clock' })).toEqual({
      kind: 'batteries',
      source: 'clock',
    });
    expect(toggleSelection(screwdriver, { kind: 'screwdriver' })).toBeNull();
    // A source the player no longer carries cannot stay selected.
    expect(sanitiseSelection(state, { kind: 'batteries', source: 'teddy' })).toBeNull();
  });
});

describe('Nursery bear', () => {
  it('flickers the eyes on PLAY while both of its own batteries are present', () => {
    const { world, bindings } = setUp();
    world.bear.play();
    world.update(0.016, 0.016);
    const materials = bindings.bear.eyes.map((eye) => eye.material as MeshStandardMaterial);
    expect(materials.every((material) => material.emissiveIntensity > 0)).toBe(true);

    // ... and goes dark again after about a second.
    world.update(1, 1.016);
    expect(materials.every((material) => material.emissiveIntensity === 0)).toBe(true);
  });

  it('produces no light at all once either battery has been taken', () => {
    const { world, tap, bindings } = setUp();
    tap('Fabric_pocket');
    tap('Teddy_battery_compartment_battery_1');
    world.bear.play();
    world.update(0.016, 0.016);
    for (const eye of bindings.bear.eyes) {
      expect((eye.material as MeshStandardMaterial).emissiveIntensity).toBe(0);
    }
  });

  it('kills a flicker already in progress the moment a battery is removed', () => {
    const { world, tap, bindings } = setUp();
    world.bear.play();
    world.update(0.016, 0.016);
    tap('Fabric_pocket');
    tap('Teddy_battery_compartment_battery_-1');
    world.update(0.016, 0.032);
    for (const eye of bindings.bear.eyes) {
      expect((eye.material as MeshStandardMaterial).emissiveIntensity).toBe(0);
    }
  });

  it('only exposes its batteries while the pocket is open, and collects each once', () => {
    const { world, state, tap, events, bindings } = setUp();
    tap('Teddy_battery_compartment_battery_-1');
    // A closed pocket turns a battery hit into a pocket hit.
    expect(state.inventoryCount('teddy')).toBe(0);

    tap('Teddy_battery_compartment_battery_-1');
    expect(state.inventoryCount('teddy')).toBe(1);
    expect(bindings.bear.batteries[-1].visible).toBe(false);
    tap('Teddy_battery_compartment_battery_-1');
    expect(state.inventoryCount('teddy')).toBe(1);
    expect(events.collected).toEqual([{ kind: 'battery', id: 'teddy:-1' }]);
  });

  it('clears the wall before turning, and reverses that order going home', () => {
    const { world, events, bindings } = setUp();
    world.bear.turn();
    const turn = events.cameras.at(-1)!;
    turn.onProgress!(0.35, 0);
    expect(bindings.bear.root.position.x).toBeCloseTo(-1.12);
    expect(bindings.bear.root.rotation.y).toBeCloseTo(Math.PI / 2);
    turn.onProgress!(1, 1);
    expect(bindings.bear.root.rotation.y).toBeCloseTo(Math.PI);

    const restore = world.bear.prepareRoomView()!;
    restore(0.65, 1);
    expect(bindings.bear.root.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(bindings.bear.root.position.x).toBeCloseTo(-1.12);
    restore(1, 1);
    expect(bindings.bear.root.position.x).toBeCloseTo(-1.43);
  });

  it('does not move the bear or the camera when PLAY is used', () => {
    const { world, events, bindings } = setUp();
    world.bear.play();
    expect(events.cameras).toHaveLength(0);
    expect(bindings.bear.root.position.x).toBeCloseTo(-1.43);
    expect(bindings.bear.root.rotation.y).toBeCloseTo(Math.PI / 2);
  });
});

describe('Nursery clock', () => {
  it('hides every digit and colon as soon as either clock battery is gone', () => {
    const { world, bindings } = setUp();
    world.update(0.016, 0.016);
    expect(bindings.clock.digits.every((digit) => digit.visible)).toBe(true);

    world.clock.handleHit('door', { kind: 'screwdriver' });
    world.clock.handleHit('battery:1', null);
    world.update(0.016, 0.032);
    expect(bindings.clock.digits.some((digit) => digit.visible)).toBe(false);
    expect(bindings.clock.colons.some((colon) => colon.visible)).toBe(false);

    // WATCH frames the display but must not restore power.
    world.clock.watch();
    world.update(0.016, 0.048);
    expect(bindings.clock.digits.some((digit) => digit.visible)).toBe(false);
  });

  it('needs the screwdriver selected to open the cover, and keeps the tool', () => {
    const { world, state, events, bindings, tap } = setUp();
    tap('Clock_door_panel');
    expect(events.messages.at(-1)?.title).toBe(NURSERY_TEXT.clockLocked);
    expect(bindings.clock.compartment.visible).toBe(false);

    state.collectScrewdriver();
    tap('Clock_door_panel', { kind: 'screwdriver' });
    expect(bindings.clock.compartment.visible).toBe(true);
    expect(events.selectionClears).toBe(1);
    expect(state.screwdriverCollected).toBe(true);
  });

  it('keeps clock batteries charged once collected', () => {
    const { world, state, tap } = setUp();
    world.clock.handleHit('door', { kind: 'screwdriver' });
    tap('Clock_battery_compartment_battery_-1');
    tap('Clock_battery_compartment_battery_-1');
    expect(state.inventoryCount('clock')).toBe(1);
    expect(state.battery('clock:-1')?.charge).toBe('charged');
  });

  it('is claimed above the table it stands on', () => {
    const { world, find } = setUp();
    expect(world.resolve(find('Clock_display'))?.owner).toBe('clock');
    expect(world.resolve(find('Oak_tabletop'))?.owner).toBe('desk');
  });
});

describe('Nursery desk', () => {
  it('cannot give up the screwdriver while the drawer is closed', () => {
    const { state, tap, find, world } = setUp();
    expect(world.resolve(find('Screwdriver_handle'))?.target).toBe('drawer');
    tap('Screwdriver_handle');
    expect(state.screwdriverCollected).toBe(false);
  });

  it('opens, frames and empties the drawer, then returns home when closed', () => {
    const { state, tap, events, bindings } = setUp();
    tap('Drawer_front');
    expect(bindings.desk.drawer.position.z).toBeCloseTo(0.48);
    expect(events.cameras).toHaveLength(1);
    // Opening the drawer offers no tooltip of its own.
    expect(events.messages.filter((message) => message !== null)).toHaveLength(0);

    tap('Screwdriver_handle');
    expect(state.screwdriverCollected).toBe(true);
    expect(bindings.desk.screwdriver.visible).toBe(false);
    tap('Screwdriver_handle');
    expect(events.collected.filter((item) => item.kind === 'screwdriver')).toHaveLength(1);

    tap('Drawer_front');
    expect(bindings.desk.drawer.position.z).toBeCloseTo(0);
    expect(events.roomViews).toBe(1);
  });
});

describe('Nursery mobile', () => {
  it('shows "it doesnt work" for an empty arm and never unlocks the chapter', () => {
    const { tap, state, events } = setUp();
    tap('Mobile_start_button');
    expect(events.messages.at(-1)?.title).toBe(NURSERY_TEXT.mobileDead);
    expect(state.running).toBe(false);
    expect(state.puzzleCompleted).toBe(false);
  });

  it('asks for a full pair before installing anything', () => {
    const context = setUp();
    const { world, tap, state, events } = context;
    world.clock.handleHit('door', { kind: 'screwdriver' });
    tap('Clock_battery_compartment_battery_-1');
    tap('Mobile_arm', { kind: 'batteries', source: 'clock' });
    expect(events.messages.at(-1)?.title).toBe(NURSERY_TEXT.needBothBatteries);
    expect(state.installedCount()).toBe(0);
  });

  it('runs only after the red button is pressed, then latches the chapter as complete', () => {
    const context = setUp();
    const { world, tap, state, bindings } = context;
    collectEverything(context);

    tap('Mobile_switch', { kind: 'batteries', source: 'clock' });
    expect(state.installedSource()).toBe('clock');
    expect(
      bindings.bed.compartment.children.filter((c) => c.userData['installedBattery']),
    ).toHaveLength(2);
    expect(state.running).toBe(false);
    expect(state.puzzleCompleted).toBe(false);

    tap('Mobile_start_button');
    expect(state.running).toBe(true);
    expect(state.puzzleCompleted).toBe(true);

    bindings.bed.rotor.rotation.y = 0;
    world.update(0.016, 1);
    expect(bindings.bed.rotor.rotation.y).toBeGreaterThan(0);
    // Only the rotor turns.
    expect(bindings.bed.arm.rotation.y).toBe(0);
    expect(bindings.bed.clamp.rotation.y).toBe(0);

    tap('Mobile_start_button');
    expect(state.running).toBe(false);
    expect(state.puzzleCompleted).toBe(true);
  });

  it('caps a long frame so a resumed tab cannot fling the rotor forward', () => {
    const context = setUp();
    const { world, tap, bindings } = context;
    collectEverything(context);
    tap('Mobile_switch', { kind: 'batteries', source: 'clock' });
    tap('Mobile_start_button');
    bindings.bed.rotor.rotation.y = 0;
    world.update(30, 31);
    expect(bindings.bed.rotor.rotation.y).toBeLessThan(0.05 * 0.38 + 1e-9);
  });

  it('installs a depleted teddy pair without ever starting the mobile', () => {
    const context = setUp();
    const { tap, state, events } = context;
    collectEverything(context);
    tap('Mobile_switch', { kind: 'batteries', source: 'teddy' });
    expect(state.installedSource()).toBe('teddy');
    tap('Mobile_start_button');
    expect(events.messages.at(-1)?.title).toBe(NURSERY_TEXT.mobileDead);
    expect(state.running).toBe(false);
    expect(state.puzzleCompleted).toBe(false);
  });

  it('swaps pairs without duplicating the batteries in the arm', () => {
    const context = setUp();
    const { tap, state, bindings, events } = context;
    collectEverything(context);
    tap('Mobile_switch', { kind: 'batteries', source: 'teddy' });
    tap('Mobile_start_button');
    tap('Mobile_switch', { kind: 'batteries', source: 'clock' });

    expect(state.installedSource()).toBe('clock');
    expect(state.inventoryCount('teddy')).toBe(2);
    expect(state.running).toBe(false);
    expect(events.selectionClears).toBeGreaterThan(0);
    const installed = bindings.bed.compartment.children.filter(
      (child) => child.userData['installedBattery'],
    );
    expect(installed).toHaveLength(2);
    expect(installed.map((child) => child.position.x)).toEqual([-0.026, 0.026]);
  });
});

describe('Nursery room view', () => {
  it('restores every pose without giving back collected items or completion', () => {
    const context = setUp();
    const { world, tap, state, bindings } = context;
    collectEverything(context);
    tap('Mobile_switch', { kind: 'batteries', source: 'clock' });
    tap('Mobile_start_button');
    world.bear.turn();
    tap('Drawer_front');

    const request = world.roomView();
    request.onProgress!(1, 1);
    expect(bindings.bear.root.position.x).toBeCloseTo(-1.43);
    expect(bindings.bear.root.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(bindings.bear.pocketFlap.rotation.x).toBe(0);
    expect(bindings.clock.root.rotation.y).toBeCloseTo(0);
    expect(bindings.desk.drawer.position.z).toBeCloseTo(0);
    expect(state.screwdriverCollected).toBe(true);
    expect(state.inventoryCount('teddy')).toBe(2);
    expect(state.puzzleCompleted).toBe(true);
  });
});
