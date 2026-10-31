import { BATTERY_SOURCES, type BatterySource, type SelectedItem } from './interaction.types';
import type { PuzzleState } from './puzzle-state';

export interface InventoryBatteryGroup {
  readonly source: BatterySource;
  readonly label: string;
  readonly count: number;
}

export interface InventoryView {
  readonly screwdriver: boolean;
  readonly batteries: readonly InventoryBatteryGroup[];
  readonly empty: boolean;
}

const SOURCE_LABEL: Readonly<Record<BatterySource, string>> = {
  teddy: 'Teddy',
  clock: 'Clock',
};

/** Grouped counts are always derived, so they can never drift from the state. */
export function readInventory(state: PuzzleState): InventoryView {
  const batteries = BATTERY_SOURCES.map((source) => ({
    source,
    label: `${SOURCE_LABEL[source]} batteries`,
    count: state.inventoryCount(source),
  })).filter((group) => group.count > 0);
  return {
    screwdriver: state.screwdriverCollected,
    batteries,
    empty: !state.screwdriverCollected && batteries.length === 0,
  };
}

/** Only one item may be held, so selecting anything clears the previous pick. */
export function toggleSelection(
  current: SelectedItem,
  next: NonNullable<SelectedItem>,
): SelectedItem {
  if (!current) return next;
  if (current.kind === 'screwdriver' && next.kind === 'screwdriver') return null;
  if (current.kind === 'batteries' && next.kind === 'batteries' && current.source === next.source) {
    return null;
  }
  return next;
}

/** Drops a selection whose item is no longer in the inventory. */
export function sanitiseSelection(state: PuzzleState, selected: SelectedItem): SelectedItem {
  if (!selected) return null;
  if (selected.kind === 'screwdriver') return state.screwdriverCollected ? selected : null;
  return state.inventoryCount(selected.source) > 0 ? selected : null;
}

export function selectionLabel(selected: SelectedItem): string {
  if (!selected) return '';
  if (selected.kind === 'screwdriver') return 'USE SCREWDRIVER';
  return `USE ${SOURCE_LABEL[selected.source].toUpperCase()} BATTERIES`;
}
