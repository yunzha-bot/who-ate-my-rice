import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Rect, Room } from './apartmentMap.ts';
import { CLOSED_EXTERIOR_DOORS } from './ClosedExteriorDoors.ts';

const CONCRETE = 0xb8b8ae;

/** Only the apron in front of the existing closed shutter. Road geometry is unchanged. */
export function garageDrivewayBounds(rooms: readonly Room[]) {
  const garage = rooms.find(room => room.id === 'garage');
  const door = CLOSED_EXTERIOR_DOORS.find(door => door.id === 'garage_shutter');
  if (!garage || !door) return null;
  const halfWidth = door.width / 2 + .5;
  return { minX: door.x - halfWidth, maxX: door.x + halfWidth,
    minZ: garage.maxZ, maxZ: Math.max(...rooms.map(room => room.maxZ)) + 4 };
}

export function buildGarageFloor(parent: THREE.Object3D, room: Room, car?: Rect): void {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(room.width - .04, .12, room.depth - .04),
    new THREE.MeshStandardMaterial({ color: CONCRETE, roughness: 1 }));
  floor.name = 'garage-concrete-floor';
  floor.position.set(room.x, -.06, room.z);
  floor.receiveShadow = true;
  parent.add(floor);
  const seams: THREE.Vector3[] = [];
  for (let x = room.minX + 2.65; x < room.maxX; x += 2.65)
    seams.push(new THREE.Vector3(x, .004, room.minZ + .03), new THREE.Vector3(x, .004, room.maxZ - .03));
  for (let z = room.minZ + 3.6; z < room.maxZ; z += 3.6)
    seams.push(new THREE.Vector3(room.minX + .03, .004, z), new THREE.Vector3(room.maxX - .03, .004, z));
  const joints = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seams),
    new THREE.LineBasicMaterial({color:0x8e928b,transparent:true,opacity:.24,depthWrite:false}));
  joints.name = 'garage-concrete-joints';
  parent.add(joints);
  if (!car) return;
  // Four quiet bay corners follow the editable car rather than a second coordinate table.
  const parts: THREE.BufferGeometry[] = [];
  const halfW = car.width / 2 + .48, halfD = car.depth / 2 + .48;
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    parts.push(new THREE.BoxGeometry(.65,.006,.045).translate(sx*(halfW-.325), .005, sz*halfD));
    parts.push(new THREE.BoxGeometry(.045,.006,.8).translate(sx*halfW, .005, sz*(halfD-.4)));
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part=>part.dispose());
  const marking = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color:0xe2dfca,roughness:1}));
  marking.name = 'garage-parking-corners';
  marking.position.set(car.x,0,car.z);
  marking.rotation.y = car.rotation ?? 0;
  marking.receiveShadow = true;
  parent.add(marking);
}

export function buildGarageDriveway(parent: THREE.Object3D, rooms: readonly Room[]): void {
  const bounds = garageDrivewayBounds(rooms);
  if (!bounds) return;
  const width=bounds.maxX-bounds.minX, depth=bounds.maxZ-bounds.minZ;
  const geometry = new THREE.BoxGeometry(width,.46,depth);
  const position=geometry.attributes.position;
  // A gentle solid ramp meets the indoor floor (y=0) and the road (y=-.25).
  for(let i=0;i<position.count;i++) {
    const t=(position.getZ(i)+depth/2)/depth;
    position.setY(i,position.getY(i)>0 ? -.25*t : -.46);
  }
  geometry.computeVertexNormals();
  const apron = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:CONCRETE,roughness:1}));
  apron.name='garage-driveway';
  apron.position.set((bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2);
  apron.receiveShadow=true;
  apron.raycast=()=>{};
  parent.add(apron);
  const points:THREE.Vector3[]=[];
  for(const t of [.33,.67]) {
    const z=bounds.minZ+t*depth, y=-.25*t+.003;
    points.push(new THREE.Vector3(bounds.minX,y,z),new THREE.Vector3(bounds.maxX,y,z));
  }
  const seams=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({color:0x8e928b,transparent:true,opacity:.22,depthWrite:false}));
  seams.name='garage-driveway-joints';
  parent.add(seams);
}
