// First-Person-Viewmodel: 3D-Arm + gehaltenes Item in einer eigenen Szene,
// gerendert in einem zweiten Pass mit gelöschtem Depth-Buffer (kein Wand-Clipping).
// Dazu: Block-Riss-Overlay (10 Stufen) für den Abbau-Fortschritt.

import * as THREE from 'three';
import { BLOCK_INFO, tileUV, ATLAS_COLS, TILE_PX } from './blocks.js';
import { itemIcon } from './items.js';
import { getCrackStage } from './texpack.js';

export class ViewModel {
  constructor(atlasTexture, atlasCanvas) {
    this.atlasTex = atlasTexture;
    this.atlasCanvas = atlasCanvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1.1);
    this.scene.add(hemi);

    this.root = new THREE.Group();
    this.root.position.set(0.42, -0.42, -0.7);
    this.scene.add(this.root);

    // Arm
    const armMat = new THREE.MeshLambertMaterial({ color: 0xd8a988 });
    this.arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.55), armMat);
    this.arm.position.set(0.08, -0.12, 0.22);
    this.arm.rotation.set(0.2, -0.3, 0);
    this.root.add(this.arm);

    this.heldGroup = new THREE.Group();
    this.root.add(this.heldGroup);

    this.heldId = null;
    this.swingT = 1;        // 0..1, < 1 = Schwung läuft
    this.eatBob = 0;
    this.itemMatCache = new Map();
    this.baseRot = { x: 0.1, y: 0.4, z: 0 };
    this.darkness = 1;
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // Gehaltenes Item neu aufbauen (Block = Mini-Würfel, Item = flaches Icon)
  setHeld(stack) {
    const id = stack ? stack.id : null;
    if (id === this.heldId) return;
    this.heldId = id;
    this.heldGroup.clear();
    if (id === null) return;

    if (id < 100) {
      const info = BLOCK_INFO[id];
      if (!info.tiles) return;
      const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const uv = geo.getAttribute('uv');
      // Face-Reihenfolge: +X,-X,+Y,-Y,+Z,-Z
      const tiles = [info.tiles.side, info.tiles.side, info.tiles.top, info.tiles.bottom, info.tiles.side, info.tiles.side];
      for (let f = 0; f < 6; f++) {
        const t = tiles[f];
        const o = f * 4;
        const set = (i, u, v) => { const [uu, vv] = tileUV(t, u, v); uv.setXY(o + i, uu, vv); };
        set(0, 0, 1); set(1, 1, 1); set(2, 0, 0); set(3, 1, 0);
      }
      uv.needsUpdate = true;
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.atlasTex, alphaTest: 0.5 }));
      mesh.position.set(0, 0, -0.05);
      mesh.rotation.set(0.1, 0.6, 0);
      this.heldGroup.add(mesh);
    } else {
      let mat = this.itemMatCache.get(id);
      if (!mat) {
        const tex = new THREE.CanvasTexture(itemIcon(id, this.atlasCanvas));
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
        this.itemMatCache.set(id, mat);
      }
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), mat);
      mesh.position.set(-0.02, 0.05, -0.05);
      mesh.rotation.set(0, 0.3, 0.5);
      this.heldGroup.add(mesh);
    }
  }

  swing() {
    if (this.swingT >= 1) this.swingT = 0;
  }

  // dayBright: 0..1 – Hand wird nachts dunkler
  update(dt, eating, dayBright = 1) {
    if (this.swingT < 1) {
      this.swingT = Math.min(1, this.swingT + dt * 3.2);
      const s = Math.sin(this.swingT * Math.PI);
      this.root.rotation.set(this.baseRot.x - s * 1.1, this.baseRot.y - s * 0.55, -s * 0.35);
      this.root.position.z = -0.7 - s * 0.15;
    } else if (eating) {
      this.eatBob += dt * 18;
      this.root.rotation.set(this.baseRot.x - 0.5 + Math.sin(this.eatBob) * 0.12, this.baseRot.y - 0.3, 0);
      this.root.position.z = -0.62;
    } else {
      this.root.rotation.set(this.baseRot.x, this.baseRot.y, 0);
      this.root.position.z = -0.7;
    }
    const b = 0.3 + 0.7 * dayBright;
    if (this.darkness !== b) {
      this.darkness = b;
      this.scene.traverse(m => {
        if (m.isHemisphereLight) m.intensity = 1.1 * b;
      });
    }
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}

// ============ Riss-Overlay beim Abbauen ============
export class BreakOverlay {
  constructor() {
    this.stages = [];
    for (let i = 0; i < 10; i++) {
      const packed = getCrackStage(i);
      const canvas = packed || makeCrackCanvas(i);
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      this.stages.push(tex);
    }
    this.mat = new THREE.MeshBasicMaterial({
      map: this.stages[0], transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), this.mat);
    this.mesh.visible = false;
  }

  attach(scene) {
    this.mesh.parent?.remove(this.mesh);
    scene.add(this.mesh);
  }

  show(x, y, z, progress) {
    this.mesh.visible = true;
    this.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    const stage = Math.min(9, Math.floor(progress * 10));
    if (this.mat.map !== this.stages[stage]) {
      this.mat.map = this.stages[stage];
      this.mat.needsUpdate = true;
    }
  }

  hide() {
    this.mesh.visible = false;
  }
}

// Prozedurale Riss-Textur (Stufe 0-9)
function makeCrackCanvas(stage) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  let seed = 991 + stage * 7;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = 'rgba(20,16,12,0.85)';
  const cracks = 2 + stage;
  for (let i = 0; i < cracks; i++) {
    let x = 4 + rnd() * 8, y = 4 + rnd() * 8;
    const steps = 3 + stage;
    for (let s = 0; s < steps; s++) {
      g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      x += (rnd() - 0.5) * 4;
      y += (rnd() - 0.5) * 4;
      x = Math.max(0, Math.min(15, x));
      y = Math.max(0, Math.min(15, y));
    }
  }
  return c;
}
