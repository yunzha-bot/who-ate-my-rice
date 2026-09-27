import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { CollisionWorld } from '../three/CollisionWorld.ts';
import { distanceToDoorSegment, type DoorState } from './DoorSystem.ts';
import type { NavigationSystem } from './NavigationSystem.ts';
import { DOOR_NODES, HIDE_SPOTS, RICE_CANDIDATES, ROOMS, SPAWNS,
  roomAt, selectRiceCandidates, type HideSpot, type MapPoint, type Point, type Room }
  from '../three/map/apartmentMap.ts';

export interface MatchSetup {
  seed: number;
  deepseek: MapPoint;
  human: MapPoint;
  rice: MapPoint[];
  doorStates: Record<string, 'OPEN' | 'CLOSED'>;
  attempts: number;
  validation: string;
  fallback: boolean;
  failures: string[];
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 0x100000000;
  };
}

export function parseMatchSeed(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) return null;
  const number = Number(value);
  return number >= 0 && number <= 0xffffffff ? number : null;
}

export function freshMatchSeed(): number {
  const values = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(values);
    return values[0];
  }
  return Date.now() >>> 0;
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function spawnCandidates(collision: CollisionWorld, navigation: NavigationSystem,
  doors: readonly DoorState[], rooms: readonly Room[] = ROOMS): MapPoint[] {
  const radius = GAME_CONFIG.collision.playerRadius;
  const height = GAME_CONFIG.three.actorHeight;
  return rooms.flatMap(room => {
    const extent = Math.hypot(room.width, room.depth) / 2;
    const found = navigation.freeCellsWithin(room, extent, doors).find(point =>
      roomAt(point.x, point.z)?.id === room.id &&
      collision.canOccupyStaticXZ(point.x, point.z, radius, height) &&
      DOOR_NODES.every(door => distanceToDoorSegment(point.x, point.z, door) >=
        radius + GAME_CONFIG.door.leafThickness / 2) &&
      RICE_CANDIDATES.every(rice => Math.hypot(point.x - rice.x, point.z - rice.z) >
        GAME_CONFIG.rice.interactionRange / GAME_CONFIG.three.pixelsPerUnit));
    return found ? [{ id: `spawn_${room.id}`, roomId: room.id,
      x: found.x, z: found.z }] : [];
  });
}

function runtimeDoors(states: Record<string, 'OPEN' | 'CLOSED'>): DoorState[] {
  return DOOR_NODES.map(node => ({ id: node.id, nodeId: node.id,
    state: states[node.id], locked: false, lockCoreState: 'ACTIVE' }));
}

export function validateMatchSetup(setup: Pick<MatchSetup,
  'deepseek' | 'human' | 'rice' | 'doorStates'>,
collision: CollisionWorld, navigation: NavigationSystem,
hideSpots: readonly HideSpot[] = HIDE_SPOTS): string {
  const radius = GAME_CONFIG.collision.playerRadius;
  const height = GAME_CONFIG.three.actorHeight;
  const doors = runtimeDoors(setup.doorStates);
  for (const actor of [setup.deepseek, setup.human]) {
    if (!collision.canOccupyStaticXZ(actor.x, actor.z, radius, height) ||
        roomAt(actor.x, actor.z)?.id !== actor.roomId ||
        DOOR_NODES.some(door => setup.doorStates[door.id] !== 'OPEN' &&
          distanceToDoorSegment(actor.x, actor.z, door) < radius +
          GAME_CONFIG.door.leafThickness / 2)) return `INVALID_SPAWN:${actor.id}`;
  }
  if (setup.deepseek.roomId === setup.human.roomId ||
      Math.hypot(setup.deepseek.x - setup.human.x,
        setup.deepseek.z - setup.human.z) < GAME_CONFIG.matchRandom.minSpawnDistance) {
    return 'SPAWN_SEPARATION';
  }
  if (DOOR_NODES.some(door => !['OPEN', 'CLOSED'].includes(setup.doorStates[door.id]))) {
    return 'INVALID_DOOR_STATE';
  }
  const reachable = (from: Point, to: Point): boolean => {
    const path = navigation.findPath(from, to, doors);
    const end = path?.at(-1);
    return !!path?.length && !!end &&
      Math.hypot(end.x - to.x, end.z - to.z) <= navigation.cellSize;
  };
  if (!reachable(setup.deepseek, setup.human) ||
      !reachable(setup.human, setup.deepseek)) return 'ACTORS_DISCONNECTED';
  for (const rice of setup.rice) {
    if (!collision.canOccupyStaticXZ(rice.x, rice.z, radius, height) ||
        !reachable(setup.deepseek, rice)) return `RICE_UNREACHABLE:${rice.id}`;
  }
  for (const room of ROOMS) {
    const roomPoint = spawnCandidates(collision, navigation, doors, [room])[0];
    if (!roomPoint || !reachable(setup.human, roomPoint)) {
      return `ROOM_UNREACHABLE:${room.id}`;
    }
  }
  for (const spot of hideSpots) {
    if (!collision.canOccupyStaticXZ(spot.x, spot.z, radius, height) ||
        !reachable(setup.deepseek, spot) || !reachable(setup.human, spot)) {
      return `HIDE_UNREACHABLE:${spot.id}`;
    }
  }
  return 'PASS';
}

export function createMatchSetup(seed: number, collision: CollisionWorld,
  navigation: NavigationSystem, maxAttempts = GAME_CONFIG.matchRandom.maxAttempts,
  hideSpots: readonly HideSpot[] = HIDE_SPOTS): MatchSetup {
  const random = seededRandom(seed);
  const failures: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const doorStates: Record<string, 'OPEN' | 'CLOSED'> = Object.fromEntries(
      DOOR_NODES.map(door => [door.id,
        random() < GAME_CONFIG.matchRandom.doorOpenChance ? 'OPEN' : 'CLOSED']));
    const doors = runtimeDoors(doorStates);
    const candidates = spawnCandidates(collision, navigation, doors);
    const ordered = shuffled(candidates, random);
    const pair = ordered.flatMap(deepseek => ordered.filter(human =>
      human.roomId !== deepseek.roomId &&
      Math.hypot(deepseek.x - human.x, deepseek.z - human.z) >=
        GAME_CONFIG.matchRandom.minSpawnDistance).map(human => ({ deepseek, human })))[0];
    if (!pair) { failures.push('NO_SPAWN_PAIR'); continue; }
    const rice = selectRiceCandidates(random);
    const validation = validateMatchSetup({ ...pair, rice, doorStates }, collision,
      navigation, hideSpots);
    if (validation === 'PASS') {
      return { seed, ...pair, rice, doorStates, attempts: attempt,
        validation, fallback: false, failures };
    }
    failures.push(validation);
  }
  const doorStates = Object.fromEntries(DOOR_NODES.map(door =>
    [door.id, door.initialState])) as Record<string, 'OPEN' | 'CLOSED'>;
  const rice = selectRiceCandidates(random);
  const defaultPair = { deepseek: SPAWNS.deepseek, human: SPAWNS.human };
  const doors = runtimeDoors(doorStates);
  const candidates = spawnCandidates(collision, navigation, doors);
  const pairs = [defaultPair, ...candidates.flatMap(deepseek => candidates.map(human =>
    ({ deepseek, human })))];
  for (const pair of pairs) {
    const proposal = { ...pair, rice, doorStates };
    if (validateMatchSetup(proposal, collision, navigation, hideSpots) === 'PASS') {
      return { seed, ...proposal, attempts: maxAttempts, validation: 'PASS',
        fallback: true, failures };
    }
  }
  throw new Error('Safe match fallback invalid: no reachable spawn pair');
}
