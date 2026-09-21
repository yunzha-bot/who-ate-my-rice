import * as THREE from 'three';
import { DEBUG_MAP, DOOR_NODES, FURNITURE, HIDE_SPOTS,
  RICE_CANDIDATES, ROOMS, SPAWNS, WALLS, type Rect } from './apartmentMap';

const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 1 });

function box(scene: THREE.Scene, width: number, height: number, depth: number,
  color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function marker(scene: THREE.Scene, label: string, color: string, x: number, z: number,
  y = 0.9): void {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#253038dd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 48);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.position.set(x, y, z);
  sprite.scale.set(2.6, 0.49, 1);
  sprite.renderOrder = 5;
  scene.add(sprite);
}

export function buildApartment(scene: THREE.Scene): THREE.Box3[] {
  const obstacles: THREE.Box3[] = [];
  for (const room of ROOMS) {
    const floor = box(scene, room.width - 0.04, 0.12, room.depth - 0.04,
      room.color, room.x, -0.06, room.z);
    floor.castShadow = false;
    if (DEBUG_MAP) marker(scene, room.name, '#ffffff', room.x, room.z, 0.18);
  }

  const addObstacle = (rect: Rect): void => {
    const color = rect.kind === 'wall' ? 0x59646d : 0x746d67;
    const mesh = box(scene, rect.width, rect.height, rect.depth, color,
      rect.x, rect.height / 2, rect.z);
    obstacles.push(new THREE.Box3().setFromObject(mesh));
    if (DEBUG_MAP && rect.kind === 'furniture') {
      const outline = new THREE.BoxHelper(mesh, 0x729aa6);
      scene.add(outline);
    }
  };
  [...WALLS, ...FURNITURE].forEach(addObstacle);

  DOOR_NODES.forEach((door, index) => {
    // The lintel is intentionally non-colliding; doors stay open throughout S5.
    const horizontal = door.rotation === 0;
    box(scene, horizontal ? door.width : 0.12, 0.12,
      horizontal ? 0.12 : door.width, 0xe9b15d, door.x, 1.45, door.z);
    if (DEBUG_MAP) marker(scene, `D${String(index + 1).padStart(2, '0')}`, '#f4ca7b',
      door.x, door.z, 1.95);
  });

  if (DEBUG_MAP) {
    for (const candidate of RICE_CANDIDATES) {
      box(scene, 0.3, 0.03, 0.3, 0x5889b0, candidate.x, 0.025, candidate.z);
      marker(scene, candidate.id, '#9fd7ff', candidate.x, candidate.z, 0.45);
    }
    HIDE_SPOTS.forEach((spot, index) => marker(scene, `H${String(index + 1).padStart(2, '0')}`,
      '#b7e0a2', spot.x, spot.z, 1.6));
    marker(scene, 'DS SPAWN', '#91caff', SPAWNS.deepseek.x, SPAWNS.deepseek.z, 1.35);
    marker(scene, 'HU SPAWN', '#ffc18e', SPAWNS.human.x, SPAWNS.human.z, 1.35);
  }
  return obstacles;
}
