import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { CollisionWorld } from '../three/CollisionWorld.ts';
import type { DoorState } from './DoorSystem.ts';
import type { DoorNode, Point } from '../three/map/apartmentMap.ts';

export interface NavStep extends Point { doorId: string | null }

// A small, fixed XZ grid is sufficient for the single authored apartment.
// Static occupancy comes from the same circle collider as gameplay movement.
export class NavigationSystem {
  private readonly cell = GAME_CONFIG.humanAI.navCellSize;
  private readonly columns: number;
  private readonly rows: number;
  private readonly width: number;
  private readonly depth: number;
  private readonly staticFree: boolean[] = [];
  private readonly doorAt: (string | null)[] = [];

  constructor(world: CollisionWorld, width: number, depth: number,
    doors: readonly DoorNode[]) {
    this.width = width;
    this.depth = depth;
    this.columns = Math.ceil(width / this.cell);
    this.rows = Math.ceil(depth / this.cell);
    for (let index = 0; index < this.columns * this.rows; index++) {
      const point = this.point(index);
      this.staticFree[index] = world.canOccupyStaticXZ(point.x, point.z,
        GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight);
      this.doorAt[index] = doors.find(door => this.touchesDoor(point, door))?.id ?? null;
    }
  }

  findPath(start: Point, goal: Point, doors: readonly DoorState[]): NavStep[] | null {
    const states = new Map(doors.map(door => [door.id, door.state]));
    const passable = (index: number): boolean =>
      this.staticFree[index] &&
      (!this.doorAt[index] || states.get(this.doorAt[index]!) !== 'LOCKED');
    const first = this.nearestPassable(start, passable);
    const last = this.nearestPassable(goal, passable);
    if (first < 0 || last < 0) return null;
    const total = this.columns * this.rows;
    const cost = new Float64Array(total).fill(Infinity);
    const previous = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const heap: { index: number; score: number }[] = [];
    const push = (item: { index: number; score: number }): void => {
      heap.push(item);
      for (let at = heap.length - 1; at > 0;) {
        const parent = (at - 1) >> 1;
        if (heap[parent].score <= heap[at].score) break;
        [heap[parent], heap[at]] = [heap[at], heap[parent]];
        at = parent;
      }
    };
    const pop = (): { index: number; score: number } => {
      const firstItem = heap[0];
      const tail = heap.pop()!;
      if (heap.length) {
        heap[0] = tail;
        for (let at = 0;;) {
          const left = at * 2 + 1;
          if (left >= heap.length) break;
          const right = left + 1;
          const child = right < heap.length && heap[right].score < heap[left].score
            ? right : left;
          if (heap[at].score <= heap[child].score) break;
          [heap[at], heap[child]] = [heap[child], heap[at]];
          at = child;
        }
      }
      return firstItem;
    };
    const heuristic = (index: number): number => {
      const dx = Math.abs(index % this.columns - last % this.columns);
      const dz = Math.abs(Math.floor(index / this.columns) - Math.floor(last / this.columns));
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    cost[first] = 0;
    push({ index: first, score: heuristic(first) });
    while (heap.length) {
      const current = pop().index;
      if (closed[current]) continue;
      if (current === last) {
        const path: NavStep[] = [];
        for (let at = last; at >= 0; at = previous[at]) {
          path.push({ ...this.point(at), doorId: this.doorAt[at] });
        }
        return path.reverse();
      }
      closed[current] = 1;
      const cx = current % this.columns;
      const cz = Math.floor(current / this.columns);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = cx + dx, z = cz + dz;
        if (x < 0 || x >= this.columns || z < 0 || z >= this.rows) continue;
        const next = z * this.columns + x;
        if (closed[next] || !passable(next)) continue;
        if (dx && dz && (!passable(cz * this.columns + x) ||
            !passable(z * this.columns + cx))) continue;
        const doorCost = this.doorAt[next] && states.get(this.doorAt[next]!) === 'CLOSED'
          ? GAME_CONFIG.humanAI.closedDoorPathCost : 0;
        const nextCost = cost[current] + (dx && dz ? Math.SQRT2 : 1) + doorCost;
        if (nextCost >= cost[next]) continue;
        cost[next] = nextCost;
        previous[next] = current;
        push({ index: next, score: nextCost + heuristic(next) });
      }
    }
    return null;
  }

  nearestFree(point: Point, doors: readonly DoorState[]): Point | null {
    const states = new Map(doors.map(door => [door.id, door.state]));
    const index = this.nearestPassable(point, at => this.staticFree[at] &&
      (!this.doorAt[at] || states.get(this.doorAt[at]!) !== 'LOCKED'));
    return index < 0 ? null : this.point(index);
  }

  private nearestPassable(point: Point, passable: (index: number) => boolean): number {
    let nearest = -1, best = Infinity;
    for (let index = 0; index < this.staticFree.length; index++) {
      if (!passable(index)) continue;
      const candidate = this.point(index);
      const score = (candidate.x - point.x) ** 2 + (candidate.z - point.z) ** 2;
      if (score < best) { best = score; nearest = index; }
    }
    return nearest;
  }

  private point(index: number): Point {
    return { x: -this.width / 2 + (index % this.columns + 0.5) * this.cell,
      z: -this.depth / 2 + (Math.floor(index / this.columns) + 0.5) * this.cell };
  }

  private touchesDoor(point: Point, door: DoorNode): boolean {
    const alongX = Math.abs(Math.sin(door.rotation)) < 0.5;
    const halfX = (alongX ? door.width : GAME_CONFIG.door.leafThickness) / 2;
    const halfZ = (alongX ? GAME_CONFIG.door.leafThickness : door.width) / 2;
    const dx = Math.max(0, Math.abs(point.x - door.x) - halfX);
    const dz = Math.max(0, Math.abs(point.z - door.z) - halfZ);
    return Math.hypot(dx, dz) < GAME_CONFIG.collision.playerRadius;
  }
}
