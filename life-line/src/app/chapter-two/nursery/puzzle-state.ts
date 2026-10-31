import {
  BATTERY_SIDES,
  BATTERY_SOURCES,
  batteryId,
  type BatteryCharge,
  type BatteryId,
  type BatteryLocation,
  type BatterySide,
  type BatterySource,
} from './interaction.types';

export interface BatteryRecord {
  readonly id: BatteryId;
  readonly source: BatterySource;
  readonly side: BatterySide;
  readonly charge: BatteryCharge;
  readonly location: BatteryLocation;
}

/** Only the clock batteries can actually drive the mobile. */
const SOURCE_CHARGE: Readonly<Record<BatterySource, BatteryCharge>> = {
  teddy: 'depleted',
  clock: 'charged',
};

export type InstallOutcome = 'installed' | 'replaced' | 'not-enough';
export type StartOutcome = 'started' | 'stopped' | 'no-power';

export interface InstallResult {
  readonly outcome: InstallOutcome;
  /** The source that went back to the inventory, when a pair was swapped out. */
  readonly returned: BatterySource | null;
}

interface MutableBattery {
  readonly id: BatteryId;
  readonly source: BatterySource;
  readonly side: BatterySide;
  readonly charge: BatteryCharge;
  location: BatteryLocation;
}

function createBatteries(): Map<BatteryId, MutableBattery> {
  const batteries = new Map<BatteryId, MutableBattery>();
  for (const source of BATTERY_SOURCES) {
    for (const side of BATTERY_SIDES) {
      const id = batteryId(source, side);
      batteries.set(id, { id, source, side, charge: SOURCE_CHARGE[source], location: 'source' });
    }
  }
  return batteries;
}

/**
 * The single authority for item locations and chapter completion. Every battery
 * exists exactly once and is always at exactly one location, so counts can only
 * be derived — never incremented by an object class.
 */
export class PuzzleState {
  private batteries = createBatteries();
  private screwdriver: Exclude<BatteryLocation, 'mobile'> = 'source';
  private mobileRunning = false;
  private completed = false;

  constructor(private readonly onChange: () => void = () => {}) {}

  get running(): boolean {
    return this.mobileRunning;
  }

  /** Latched: once the mobile has truly started, the chapter stays finished. */
  get puzzleCompleted(): boolean {
    return this.completed;
  }

  get hasScrewdriver(): boolean {
    return this.screwdriver === 'inventory';
  }

  get screwdriverCollected(): boolean {
    return this.screwdriver === 'inventory';
  }

  list(): readonly BatteryRecord[] {
    return [...this.batteries.values()].map((battery) => ({ ...battery }));
  }

  battery(id: BatteryId): BatteryRecord | null {
    const battery = this.batteries.get(id);
    return battery ? { ...battery } : null;
  }

  locationOf(id: BatteryId): BatteryLocation | null {
    return this.batteries.get(id)?.location ?? null;
  }

  /** How many batteries of a source the player is carrying. */
  inventoryCount(source: BatterySource): number {
    return this.at('inventory').filter((battery) => battery.source === source).length;
  }

  /** True while both of a source's own batteries are still inside it. */
  isSourceIntact(source: BatterySource): boolean {
    return [...this.batteries.values()].every(
      (battery) => battery.source !== source || battery.location === 'source',
    );
  }

  installedSource(): BatterySource | null {
    return this.at('mobile')[0]?.source ?? null;
  }

  installedCount(): number {
    return this.at('mobile').length;
  }

  /** True only with a full pair of charged batteries in the arm. */
  mobileHasPower(): boolean {
    const installed = this.at('mobile');
    return installed.length === 2 && installed.every((battery) => battery.charge === 'charged');
  }

  collectScrewdriver(): boolean {
    if (this.screwdriver !== 'source') return false;
    this.screwdriver = 'inventory';
    this.onChange();
    return true;
  }

  /** Collecting is only ever possible from the object the battery belongs to. */
  collectBattery(id: BatteryId): boolean {
    const battery = this.batteries.get(id);
    if (!battery || battery.location !== 'source') return false;
    battery.location = 'inventory';
    this.onChange();
    return true;
  }

  /**
   * Moves a pair from the inventory into the arm, returning any pair already
   * installed. Stops the mobile, because the circuit is broken during a swap.
   */
  installBatteries(source: BatterySource): InstallResult {
    if (this.inventoryCount(source) < 2) return { outcome: 'not-enough', returned: null };
    const previous = this.installedSource();
    for (const battery of this.at('mobile')) {
      this.batteries.get(battery.id)!.location = 'inventory';
    }
    for (const battery of this.at('inventory')
      .filter((entry) => entry.source === source)
      .slice(0, 2)) {
      this.batteries.get(battery.id)!.location = 'mobile';
    }
    this.mobileRunning = false;
    this.onChange();
    return { outcome: previous ? 'replaced' : 'installed', returned: previous };
  }

  /** The red button. Only a charged pair can flip the mobile into running. */
  pressStart(): StartOutcome {
    if (!this.mobileHasPower()) {
      this.mobileRunning = false;
      this.onChange();
      return 'no-power';
    }
    this.mobileRunning = !this.mobileRunning;
    if (this.mobileRunning) this.completed = true;
    this.onChange();
    return this.mobileRunning ? 'started' : 'stopped';
  }

  reset(): void {
    this.batteries = createBatteries();
    this.screwdriver = 'source';
    this.mobileRunning = false;
    this.completed = false;
    this.onChange();
  }

  private at(location: BatteryLocation): readonly MutableBattery[] {
    return [...this.batteries.values()].filter((battery) => battery.location === location);
  }
}
