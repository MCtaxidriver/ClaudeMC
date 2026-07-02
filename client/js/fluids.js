// Dynamische Fluid-Simulation: Wasser fliesst 7 Blöcke weit (schnell),
// Lava 3 Blöcke (langsam/zäh). Level-basiert über Block-IDs.
// Interaktionen: fliessendes Wasser + Lavaquelle = Obsidian,
// fliessend + fliessend = Bruchstein. 2 Wasserquellen nebeneinander = neue Quelle.

import {
  B, BLOCK_INFO, isWater, isLava, isFluid, fluidLevel, waterFlowId, lavaFlowId,
} from './blocks.js';
import { WATER_TICK, LAVA_TICK, WATER_RANGE, LAVA_RANGE } from './config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const STEP_BUDGET = 800; // max. Zellen pro Simulationsschritt

// Fluide verdrängen Luft und lose Deko (Gras, Blumen, Fackeln, Schienen)
function canReplace(id) {
  if (id === B.AIR) return true;
  const info = BLOCK_INFO[id];
  return !info.solid && !isFluid(id) && (info.type === 'cross' || info.type === 'torch' || info.type === 'flat');
}

export class FluidSim {
  constructor(world) {
    this.world = world;
    this.waterAcc = 0;
    this.lavaAcc = 0;
    this.waterSet = new Set();
    this.lavaSet = new Set();
  }

  key(x, y, z) { return x + ',' + y + ',' + z; }

  // Zelle + Nachbarn aufwecken (nach Blockänderungen aufrufen)
  wake(x, y, z) {
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const id = this.world.getBlock(x + dx, y + dy, z + dz);
      if (isWater(id)) this.waterSet.add(this.key(x + dx, y + dy, z + dz));
      else if (isLava(id)) this.lavaSet.add(this.key(x + dx, y + dy, z + dz));
    }
  }

  update(dt) {
    this.waterAcc += dt;
    if (this.waterAcc >= WATER_TICK) {
      this.waterAcc = 0;
      this.step('water');
    }
    this.lavaAcc += dt;
    if (this.lavaAcc >= LAVA_TICK) {
      this.lavaAcc = 0;
      this.step('lava');
    }
  }

  step(kind) {
    const set = kind === 'water' ? this.waterSet : this.lavaSet;
    if (!set.size) return;
    const cells = [...set];
    set.clear();
    let budget = STEP_BUDGET;
    for (const k of cells) {
      if (budget-- <= 0) { set.add(k); continue; } // Rest im nächsten Tick
      const [x, y, z] = k.split(',').map(Number);
      this.evalCell(x, y, z, kind, set);
    }
  }

  evalCell(x, y, z, kind, set) {
    const w = this.world;
    const isKind = kind === 'water' ? isWater : isLava;
    const flowId = kind === 'water' ? waterFlowId : lavaFlowId;
    const maxFlow = kind === 'water' ? WATER_RANGE : LAVA_RANGE;
    const sourceId = kind === 'water' ? B.WATER : B.LAVA;

    const id = w.getBlock(x, y, z);
    if (!isKind(id)) return;
    const isSource = id === sourceId;
    let level = fluidLevel(id);

    // Fliessende Blöcke: Versorgung prüfen (trocknet aus, wenn Quelle weg)
    if (!isSource) {
      let feed = 0;
      let adjSources = 0;
      if (isKind(w.getBlock(x, y + 1, z))) feed = maxFlow;
      for (const [dx, dz] of DIRS) {
        const n = w.getBlock(x + dx, y, z + dz);
        if (isKind(n)) {
          feed = Math.max(feed, Math.min(maxFlow, fluidLevel(n) - 1));
          if (n === sourceId) adjSources++;
        }
      }
      // Unendliche Wasserquelle: 2+ Quellnachbarn + fester Boden
      if (kind === 'water' && adjSources >= 2 && BLOCK_INFO[w.getBlock(x, y - 1, z)].solid) {
        w.setBlock(x, y, z, B.WATER);
        this.wake(x, y, z);
        return;
      }
      if (feed <= 0) {
        w.setBlock(x, y, z, B.AIR);
        this.wake(x, y, z);
        return;
      }
      if (feed !== level) {
        w.setBlock(x, y, z, flowId(feed));
        level = feed;
        this.wake(x, y, z);
      }
    }

    // Nach unten fliessen (bevorzugt) + Fluid-Interaktionen
    const below = w.getBlock(x, y - 1, z);
    if (kind === 'water' && isLava(below)) {
      w.setBlock(x, y - 1, z, below === B.LAVA ? B.OBSIDIAN : B.COBBLE);
      this.wake(x, y - 1, z);
    } else if (kind === 'lava' && isWater(below)) {
      w.setBlock(x, y - 1, z, B.COBBLE);
      this.wake(x, y - 1, z);
    } else if (canReplace(below)) {
      w.setBlock(x, y - 1, z, flowId(maxFlow));
      set.add(this.key(x, y - 1, z));
      return; // solange es runterfliesst, keine Seitenausbreitung
    } else if (isKind(below) && below !== sourceId && fluidLevel(below) < maxFlow) {
      w.setBlock(x, y - 1, z, flowId(maxFlow));
      set.add(this.key(x, y - 1, z));
      return;
    }

    // Horizontale Ausbreitung
    const spreadLevel = Math.min(maxFlow, level - 1);
    if (spreadLevel < 1) return;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      const n = w.getBlock(nx, y, nz);
      if (kind === 'water' && isLava(n)) {
        w.setBlock(nx, y, nz, n === B.LAVA ? B.OBSIDIAN : B.COBBLE);
        this.wake(nx, y, nz);
      } else if (kind === 'lava' && isWater(n)) {
        w.setBlock(nx, y, nz, B.COBBLE);
        this.wake(nx, y, nz);
      } else if (canReplace(n)) {
        w.setBlock(nx, y, nz, flowId(spreadLevel));
        set.add(this.key(nx, y, nz));
      } else if (isKind(n) && n !== sourceId && fluidLevel(n) < spreadLevel) {
        w.setBlock(nx, y, nz, flowId(spreadLevel));
        set.add(this.key(nx, y, nz));
      }
    }
  }
}
