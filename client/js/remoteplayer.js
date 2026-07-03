// Darstellung der Mitspieler: einfacher Klotz-Steve mit Spielerfarbe
// (aus der Spieler-ID abgeleitet), Namensschild und weicher Interpolation
// zwischen den 10-Hz-Positions-Snapshots des Servers.

import * as THREE from 'three';
import { PLAYER_HEIGHT } from './config.js';

function makeNameSprite(name) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = 'bold 28px monospace';
  const w = Math.ceil(g.measureText(name).width) + 16;
  c.width = w;
  c.height = 40;
  const g2 = c.getContext('2d');
  g2.fillStyle = 'rgba(0,0,0,0.45)';
  g2.fillRect(0, 0, w, 40);
  g2.font = 'bold 28px monospace';
  g2.fillStyle = '#fff';
  g2.textAlign = 'center';
  g2.textBaseline = 'middle';
  g2.fillText(name, w / 2, 21);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false,
  }));
  sprite.scale.set(w / 40 * 0.5, 0.5, 1);
  sprite.position.y = PLAYER_HEIGHT + 0.45;
  return sprite;
}

export class RemotePlayer {
  constructor(pid, name) {
    this.pid = pid;
    this.name = name;
    this.dim = 'over';
    this.scene = null; // Szene, in der der Körper aktuell hängt

    // Zielzustand vom Server; Anzeige interpoliert darauf zu
    this.target = { x: 0, y: 0, z: 0, yw: 0, pt: 0 };
    this.cur = null; // erst beim ersten Snapshot gesetzt (kein Einflug von 0,0,0)

    const hue = ((pid * 0.61803398875) % 1 + 1) % 1;
    const shirt = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue, 0.55, 0.5) });
    const pants = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue, 0.45, 0.32) });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a988 });
    this.mats = [shirt, pants, skin];
    this.flashTimer = 0; // rotes Aufblitzen bei PvP-Treffer

    const box = (w, h, d, mat, x, y, z, parent) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    this.group = new THREE.Group();
    // yawNode dreht Körper, headNode zusätzlich Pitch
    this.yawNode = new THREE.Group();
    this.group.add(this.yawNode);
    box(0.25, 0.75, 0.25, pants, -0.13, 0.375, 0, this.yawNode); // Beine
    box(0.25, 0.75, 0.25, pants, 0.13, 0.375, 0, this.yawNode);
    box(0.52, 0.7, 0.28, shirt, 0, 1.1, 0, this.yawNode);        // Torso
    box(0.2, 0.66, 0.2, shirt, -0.37, 1.1, 0, this.yawNode);     // Arme
    box(0.2, 0.66, 0.2, shirt, 0.37, 1.1, 0, this.yawNode);
    this.headNode = new THREE.Group();
    this.headNode.position.y = 1.45;
    this.yawNode.add(this.headNode);
    box(0.48, 0.48, 0.48, skin, 0, 0.26, 0, this.headNode);      // Kopf

    this.group.add(makeNameSprite(name));
    this.group.visible = false;
  }

  setTarget(d, x, y, z, yw, pt) {
    const dimChanged = d !== this.dim;
    this.dim = d;
    // Teleport statt Interpolation bei Dimensionswechsel oder grossem Sprung
    if (!this.cur || dimChanged || Math.hypot(x - this.cur.x, y - this.cur.y, z - this.cur.z) > 16) {
      this.cur = { x, y, z, yw, pt };
    }
    this.target = { x, y, z, yw, pt };
    return dimChanged;
  }

  flash() {
    this.flashTimer = 0.25;
    for (const m of this.mats) m.emissive.setHex(0xaa2020);
  }

  update(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        for (const m of this.mats) m.emissive.setHex(0x000000);
      }
    }
    if (!this.cur) return;
    const t = Math.min(1, dt * 12); // glättet die 10-Hz-Snapshots
    const c = this.cur, g = this.target;
    c.x += (g.x - c.x) * t;
    c.y += (g.y - c.y) * t;
    c.z += (g.z - c.z) * t;
    let dyaw = g.yw - c.yw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    c.yw += dyaw * t;
    c.pt += (g.pt - c.pt) * t;

    this.group.position.set(c.x, c.y, c.z);
    this.yawNode.rotation.y = c.yw;
    this.headNode.rotation.x = c.pt;
    this.group.visible = true;
  }

  attach(scene) {
    if (this.scene === scene) return;
    this.detach();
    this.scene = scene;
    scene.add(this.group);
  }

  detach() {
    if (this.scene) {
      this.scene.remove(this.group);
      this.scene = null;
    }
  }

  dispose() {
    this.detach();
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}
