// Zentrale Konstanten der Engine

export const CHUNK_SIZE = 16;      // Blöcke pro Chunk-Kante (X/Z)
export const WORLD_HEIGHT = 96;    // Blöcke in Y-Richtung (Deepslate unten, Berge oben)
export const RENDER_DISTANCE = 6;  // Standard-Chunk-Radius (überschreibbar in Settings)
export const SEA_LEVEL = 40;       // Wasserlinie (Y, nur Overworld)
export const DEEPSLATE_Y = 26;     // Unterhalb: Deepslate statt Stein

export const GRAVITY = -25;        // Blöcke/s²
export const JUMP_SPEED = 8.5;
export const WALK_SPEED = 4.5;     // Blöcke/s
export const SPRINT_SPEED = 7.2;
export const SNEAK_SPEED = 1.8;
export const FLY_SPEED = 11;
export const FLY_SPRINT_SPEED = 22;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;

export const REACH = 5.0;          // Reichweite für Abbauen/Platzieren

// Survival
export const DAY_LENGTH = 480;     // Sekunden pro kompletter Tag/Nacht-Zyklus
export const MOB_CAP_HOSTILE = 14;
export const MOB_CAP_PASSIVE = 10;
export const SPAWN_INTERVAL = 2.5; // Sekunden zwischen Spawn-Versuchen
export const DESPAWN_DIST = 72;
export const ATTACK_COOLDOWN = 0.45;
export const AUTOSAVE_INTERVAL = 30;
export const EAT_DURATION = 1.6;   // Sekunden Rechtsklick halten zum Essen
export const DROP_PICKUP_DELAY = 1.5; // Cooldown bis weggeworfene Items wieder aufhebbar sind

// Fluide
export const WATER_TICK = 0.25;    // Sekunden pro Wasser-Ausbreitungsschritt
export const LAVA_TICK = 1.0;      // Lava fliesst langsamer/zäher
export const WATER_RANGE = 7;      // horizontale Fliess-Level
export const LAVA_RANGE = 3;
