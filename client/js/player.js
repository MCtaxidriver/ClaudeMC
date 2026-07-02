// Spieler: First-Person-Physik + Survival-Zustand (HP, Hunger, Luft, Fallschaden)
// Schwimmen mit Auftrieb, Kreativ-Flug (Doppel-Sprung), Schleichen, Spinnennetz-Bremse.

import {
  GRAVITY, JUMP_SPEED, WALK_SPEED, SPRINT_SPEED, SNEAK_SPEED, FLY_SPEED, FLY_SPRINT_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, WORLD_HEIGHT,
} from './config.js';
import { B, BLOCK_INFO, isWater, isLava } from './blocks.js';
import { moveWithCollision } from './entities.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = { x: 0, y: 0, z: 0 };   // Füsse (x/z = Mitte)
    this.vel = { x: 0, y: 0, z: 0 };
    this.w = PLAYER_WIDTH;
    this.h = PLAYER_HEIGHT;
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.hitWall = false;
    this.keys = { forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false };

    // Survival-Zustand
    this.creative = false;
    this.flying = false;
    this.dead = false;
    this.hp = 20;
    this.hunger = 20;
    this.air = 10;
    this.exhaustion = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.drownTimer = 0;
    this.lavaTimer = 0;
    this.cactusTimer = 0;
    this.eatTimer = 0;
    this.attackTimer = 0;
    this.fallStart = null;
    this.sprinting = false;
    this.sneaking = false;
    this.eating = false;      // wird von main gesetzt (Rechtsklick halten)

    this.stepDist = 0;        // für Schrittgeräusche
    this.onStep = null;       // Callback(blockId)
    this.getArmorPoints = null;
    this.onDamage = null;
    this.onDeath = null;
  }

  rotate(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  resetKeys() {
    for (const k of Object.keys(this.keys)) this.keys[k] = false;
  }

  blockAt(dy) {
    return this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + dy), Math.floor(this.pos.z));
  }

  inWater() {
    return isWater(this.blockAt(0.2)) || isWater(this.blockAt(0.9));
  }

  eyeInWater() {
    return isWater(this.blockAt(1.62));
  }

  inLava() {
    return isLava(this.blockAt(0.2)) || isLava(this.blockAt(0.9));
  }

  // Bewegungs-Multiplikator im Block (Spinnennetz)
  slowFactor() {
    const a = BLOCK_INFO[this.blockAt(0.2)].slow;
    const b = BLOCK_INFO[this.blockAt(0.9)].slow;
    const s = Math.max(a, b);
    return s > 0 ? s : 1;
  }

  // pierce = true: Schaden ignoriert Rüstung (Fallen, Ertrinken, Verhungern)
  hurt(dmg, kx = 0, kz = 0, pierce = false) {
    if (this.creative || this.dead || dmg <= 0) return;
    if (!pierce && this.getArmorPoints) {
      const pts = Math.min(20, this.getArmorPoints());
      dmg = dmg * (1 - 0.04 * pts);
      if (dmg <= 0) return;
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.vel.x += kx;
    this.vel.z += kz;
    this.vel.y = Math.max(this.vel.y, 4);
    if (this.onDamage) this.onDamage(dmg);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.resetKeys();
    if (this.onDeath) this.onDeath();
  }

  respawn(spawn) {
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.hp = 20;
    this.hunger = 20;
    this.air = 10;
    this.exhaustion = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.drownTimer = 0;
    this.fallStart = null;
    this.flying = false;
    this.eating = false;
    this.dead = false;
  }

  eat(food, heal = 0) {
    this.hunger = Math.min(20, this.hunger + food);
    if (heal > 0) this.hp = Math.min(20, this.hp + heal);
    this.eatTimer = 0.4;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.dead) return;
    if (!this.world.hasData(this.pos.x, this.pos.z)) return;

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.eatTimer > 0) this.eatTimer -= dt;

    const k = this.keys;
    const fwd = (k.forward ? 1 : 0) - (k.back ? 1 : 0);
    const right = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let dx = 0, dz = 0;
    if (fwd || right) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      dx = -sin * fwd + cos * right;
      dz = -cos * fwd - sin * right;
      const len = Math.hypot(dx, dz);
      dx /= len; dz /= len;
    }

    const water = this.inWater();
    const slow = this.slowFactor();
    this.sneaking = k.sneak && !this.flying;
    this.sprinting = k.sprint && fwd > 0 && !this.sneaking && (this.creative || this.hunger > 6) && !this.eating;

    if (this.flying) {
      // Kreativ-Flug: weich gedämpft, Space hoch / Shift runter
      const speed = this.sprinting ? FLY_SPRINT_SPEED : FLY_SPEED;
      const t = Math.min(1, 8 * dt);
      this.vel.x += (dx * speed - this.vel.x) * t;
      this.vel.z += (dz * speed - this.vel.z) * t;
      const vy = (k.jump ? 1 : 0) - (k.sneak ? 1 : 0);
      this.vel.y += (vy * speed * 0.8 - this.vel.y) * t;
      this.fallStart = null;
      moveWithCollision(this.world, this, dt);
      if (this.onGround) this.flying = false;
      if (this.pos.y > WORLD_HEIGHT + 40) this.pos.y = WORLD_HEIGHT + 40;
      return;
    }

    let speed = (this.sprinting ? SPRINT_SPEED : this.sneaking ? SNEAK_SPEED : WALK_SPEED) * (water ? 0.55 : 1);
    if (this.eating) speed *= 0.35;
    speed *= slow;
    const accel = this.onGround ? 14 : water ? 10 : 5;
    const t = Math.min(1, accel * dt);
    this.vel.x += (dx * speed - this.vel.x) * t;
    this.vel.z += (dz * speed - this.vel.z) * t;

    if (slow < 1) {
      // Spinnennetz: alles wird zäh, kein Fallschaden
      this.vel.y = Math.max(Math.min(this.vel.y, 1.2 * slow * 4), -1.5);
      if (k.jump) this.vel.y = 1.2;
      this.fallStart = null;
      this.vel.y += GRAVITY * 0.05 * dt;
    } else if (water) {
      this.vel.y += GRAVITY * 0.18 * dt;
      if (k.jump) {
        this.vel.y = Math.min(this.vel.y + 30 * dt, 4.0);
        if (this.onGround) this.vel.y = 5;
      }
      this.vel.y = Math.max(this.vel.y * (1 - Math.min(1, 1.5 * dt)), -3.0);
      this.fallStart = null;
    } else {
      this.vel.y += GRAVITY * dt;
      this.vel.y = Math.max(this.vel.y, -50);
      if (k.jump && this.onGround) {
        this.vel.y = JUMP_SPEED;
        this.exhaustion += 0.1;
      }
    }

    if (!this.onGround && !water && this.vel.y <= 0 && this.fallStart === null) {
      this.fallStart = this.pos.y;
    }

    const prevX = this.pos.x, prevZ = this.pos.z;
    moveWithCollision(this.world, this, dt);

    // Schrittgeräusche
    if (this.onGround) {
      this.stepDist += Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
      if (this.stepDist > 2.2) {
        this.stepDist = 0;
        if (this.onStep) this.onStep(this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.5), Math.floor(this.pos.z)));
      }
    }

    // Am Ufer/Rand automatisch aus dem Wasser klettern
    if (water && this.hitWall && (fwd || right)) {
      this.vel.y = Math.max(this.vel.y, 4.5);
    }

    if (this.onGround && this.fallStart !== null) {
      const d = this.fallStart - this.pos.y;
      this.fallStart = null;
      if (d > 3.5) this.hurt(Math.floor(d - 3), 0, 0, true);
    }

    if (this.pos.y < -20) {
      if (this.world.dimension === 'end') {
        this.hurt(1000, 0, 0, true);
        return;
      }
      this.pos.y = WORLD_HEIGHT;
      this.vel.y = 0;
    }

    if (!this.creative) this.survivalTick(dt, water);
  }

  survivalTick(dt, water) {
    this.exhaustion += (this.sprinting ? 0.12 : 0.005) * dt;
    if (this.exhaustion >= 4) {
      this.exhaustion = 0;
      this.hunger = Math.max(0, this.hunger - 1);
    }

    if (this.hunger >= 18 && this.hp < 20) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3) {
        this.regenTimer = 0;
        this.hp = Math.min(20, this.hp + 1);
        this.exhaustion += 1.5;
      }
    } else if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 3) {
        this.starveTimer = 0;
        if (this.hp > 1) this.hurt(1, 0, 0, true);
      }
    }

    if (this.eyeInWater()) {
      this.air -= dt;
      if (this.air <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1) {
          this.drownTimer = 0;
          this.hurt(2, 0, 0, true);
        }
      }
    } else {
      this.air = Math.min(10, this.air + dt * 4);
      this.drownTimer = 0;
    }

    if (this.inLava()) {
      this.lavaTimer -= dt;
      if (this.lavaTimer <= 0) {
        this.lavaTimer = 0.5;
        this.hurt(4);
      }
      this.fallStart = null;
    }

    // Kaktus-Kontakt
    this.cactusTimer -= dt;
    if (this.cactusTimer <= 0) {
      const hw = this.w / 2 + 0.05;
      outer:
      for (const [ox, oz] of [[hw, 0], [-hw, 0], [0, hw], [0, -hw]]) {
        for (const dy of [0.2, 1.2]) {
          if (this.world.getBlock(Math.floor(this.pos.x + ox), Math.floor(this.pos.y + dy), Math.floor(this.pos.z + oz)) === B.CACTUS) {
            this.cactusTimer = 0.6;
            this.hurt(1);
            break outer;
          }
        }
      }
    }
  }
}
