import { GAME_CONFIG } from '../../config/gameConfig.ts';
import { crossesRect, PerceptionGeometry } from '../../systems/PerceptionSystem.ts';
import type { DoorState } from '../../systems/DoorSystem.ts';
import type { NavigationSystem } from '../../systems/NavigationSystem.ts';
import type { CollisionWorld } from '../CollisionWorld.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, WALLS,
  type DoorNode, type HideInteractionRegion, type HideSpot, type Point, type Rect,
} from './apartmentMap.ts';

// DEV-A round 1: the interaction region foundation only. This module holds the
// authored-region geometry, the base legal-position check and an explicitly
// discrete preview. It is not wired into gameplay: there is still no HideSystem,
// no hide key, no Human CHECK_HIDE and no scene-editor UI for these values.
//
// Three deliberately separated layers:
//   1. `pointInHideRegion` - exact, continuous membership of the authored shape.
//      It knows nothing about walls, furniture, doors or standability.
//   2. `checkHideRegionPosition` - base legal-position check for a single point:
//      membership plus the real actor collider plus the real navigation grid plus
//      a clear route to the furniture surface the player actually interacts with.
//   3. `sampleHideRegion` - a discrete lattice preview for DEV visualization.
//      Its counts are lattice points, never a claim about the continuous area.

// Boundary handling is inclusive within this tolerance: a point exactly on the
// radius, or exactly on a half-angle edge, counts as inside.
export const REGION_EPSILON = 1e-9;
// Same snap limit the authored anchors are already verified against in
// tests/hide-spot.test.mjs: a position has to sit on a real navigation cell.
export const REGION_NAV_SNAP_LIMIT = 0.45;
// Lattice step of the discrete preview; matches the map authoring grid step.
export const DEFAULT_REGION_SAMPLE_STEP = 0.3;
// DEV-A round 2 authoring limits (world units / degrees), not gameplay config.
export const REGION_AUTHORING_LIMITS = { minRadius: 0.5, maxRadius: 3,
  radiusStep: 0.05, minHalfAngleDeg: 10, maxHalfAngleDeg: 150,
  halfAngleStepDeg: 1 } as const;

export function wrapToPi(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function sectorHalfAngleRadians(region: HideInteractionRegion): number {
  return region.shape === 'SECTOR' ? (region.halfAngleDeg ?? 0) * Math.PI / 180 : 0;
}

// Sector axis: from the bound furniture centre towards the existing single
// anchor. Furniture rotation only swaps the AABB extents (see MapEditModel), so
// it never moves the centre; the axis follows the anchor, not a stored heading.
export function hideRegionAxisAngle(centre: Point, anchor: Point): number {
  return Math.atan2(anchor.z - centre.z, anchor.x - centre.x);
}

export interface HideRegionGeometry {
  readonly spotId: string;
  readonly anchor: Point; // the one legal approach position (enter = exit)
  readonly centre: Point; // bound furniture centre, i.e. the region centre
  readonly region: HideInteractionRegion; // authored data, never copied here
  readonly radius: number; // derived from region.radius, for readability
  readonly halfAngleRad: number; // derived; 0 for a CIRCLE
  readonly axisAngle: number; // derived; radians from centre towards the anchor
}

export function hideRegionGeometry(spot: HideSpot, furniture: Rect): HideRegionGeometry {
  const centre = { x: furniture.x, z: furniture.z };
  const anchor = { x: spot.x, z: spot.z };
  return { spotId: spot.id, anchor, centre, region: spot.interactionRegion,
    radius: spot.interactionRegion.radius,
    halfAngleRad: sectorHalfAngleRadians(spot.interactionRegion),
    axisAngle: hideRegionAxisAngle(centre, anchor) };
}

// Exact membership. The sector difference is wrapped to (-pi, pi] so every axis
// quadrant and the +/-pi seam behave identically.
export function pointInHideRegion(geometry: HideRegionGeometry, point: Point): boolean {
  const distance = Math.hypot(point.x - geometry.centre.x, point.z - geometry.centre.z);
  if (distance > geometry.radius + REGION_EPSILON) return false;
  if (geometry.region.shape === 'CIRCLE') return true;
  const delta = wrapToPi(Math.atan2(point.z - geometry.centre.z,
    point.x - geometry.centre.x) - geometry.axisAngle);
  return Math.abs(delta) <= geometry.halfAngleRad + REGION_EPSILON;
}

export interface HideRegionSetup {
  readonly spot: HideSpot;
  readonly furniture: Rect; // the interaction target
  readonly geometry: HideRegionGeometry;
  // Every other furniture piece. The bound furniture is deliberately absent:
  // its own box must never block the legal positions around it.
  readonly otherFurniture: readonly Rect[];
}

export function hideRegionSetup(spot: HideSpot,
  furniture: readonly Rect[] = FURNITURE): HideRegionSetup | null {
  const own = furniture.find(rect => rect.id === spot.furnitureId);
  if (!own) return null;
  return { spot, furniture: own, geometry: hideRegionGeometry(spot, own),
    otherFurniture: furniture.filter(rect => rect.id !== spot.furnitureId) };
}

// The aim point of an interaction is the furniture's exposed surface, not its
// centre. Aiming at the centre would let the furniture block every position on
// its own near side; aiming at the surface keeps the piece reachable from all
// around it while a route through a wall, another furniture piece or a closed
// door is still rejected. Deterministic for a point on or inside the footprint.
export function furnitureApproachSurfacePoint(rect: Rect, from: Point): Point {
  const halfWidth = rect.width / 2;
  const halfDepth = rect.depth / 2;
  if (halfWidth <= 0 || halfDepth <= 0) return { x: rect.x, z: rect.z };
  const dx = from.x - rect.x;
  const dz = from.z - rect.z;
  if (Math.abs(dx) > halfWidth || Math.abs(dz) > halfDepth) {
    return { x: Math.max(rect.x - halfWidth, Math.min(from.x, rect.x + halfWidth)),
      z: Math.max(rect.z - halfDepth, Math.min(from.z, rect.z + halfDepth)) };
  }
  // Inside the footprint the nearest boundary is on the dominant axis.
  return Math.abs(dx) / halfWidth >= Math.abs(dz) / halfDepth
    ? { x: rect.x + (dx < 0 ? -halfWidth : halfWidth), z: from.z }
    : { x: from.x, z: rect.z + (dz < 0 ? -halfDepth : halfDepth) };
}

// Runtime inputs the legality check reuses. `doorStates` defaults to `[]`, which
// means "every door is still in its authored initialState" - the strictest case
// and the correct one while authoring. A live match passes the real states.
export interface HideRegionWorld {
  readonly collision: CollisionWorld;
  readonly navigation: NavigationSystem;
  readonly doorStates?: readonly DoorState[];
  readonly doorNodes?: readonly DoorNode[];
  readonly walls?: readonly Rect[];
}

// True when nothing between the position and the furniture surface blocks the
// interaction: no other furniture, no wall and no non-OPEN door leaf.
export function hideRegionSurfaceClear(setup: HideRegionSetup, point: Point,
  world: HideRegionWorld): boolean {
  const target = furnitureApproachSurfacePoint(setup.furniture, point);
  if (setup.otherFurniture.some(rect => crossesRect(point, target, rect))) return false;
  const perception = new PerceptionGeometry(world.walls ?? WALLS,
    world.doorNodes ?? DOOR_NODES, () => world.doorStates ?? []);
  return perception.inspectVision(point, target, Number.POSITIVE_INFINITY).status === 'VISIBLE';
}

export type HideRegionPositionCode =
  | 'LEGAL'
  | 'OUTSIDE_REGION'
  | 'NOT_STANDABLE'
  | 'SURFACE_BLOCKED'
  | 'NOT_NAVIGABLE'
  | 'NOT_REACHABLE';

export interface HideRegionPositionCheck {
  readonly x: number;
  readonly z: number;
  readonly insideRegion: boolean;
  readonly standable: boolean; // real actor circle/height against the real map
  readonly surfaceClear: boolean;
  readonly navigable: boolean; // a real navigation cell within the snap limit
  readonly navigationCell: Point | null;
  readonly reachable: boolean | null; // null = the A* probe was not requested
  readonly legal: boolean;
  readonly code: HideRegionPositionCode; // first failure in evaluation order
}

// Base legal-position check for one point. Reachability is opt-in because it
// runs a full A* query; without it `reachable` stays null instead of guessing.
export function checkHideRegionPosition(setup: HideRegionSetup, point: Point,
  world: HideRegionWorld, options: { reachable?: boolean;
    isReachable?: (point: Point) => boolean } = {}): HideRegionPositionCheck {
  const doorStates = world.doorStates ?? [];
  const insideRegion = pointInHideRegion(setup.geometry, point);
  const standable = world.collision.canOccupyStaticXZ(point.x, point.z,
    GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight);
  const surfaceClear = hideRegionSurfaceClear(setup, point, world);
  const navigationCell = world.navigation.nearestFree(point, doorStates);
  const navigable = navigationCell !== null &&
    Math.hypot(navigationCell.x - point.x, navigationCell.z - point.z) <= REGION_NAV_SNAP_LIMIT;
  // A* snaps both ends to free cells, so this is only meaningful together with
  // `navigable` (the point itself sits on a free cell).
  const reachable = options.isReachable ? options.isReachable(point)
    : options.reachable
      ? world.navigation.findPath(setup.geometry.anchor, point, doorStates) !== null
      : null;
  const code: HideRegionPositionCode = !insideRegion ? 'OUTSIDE_REGION'
    : !standable ? 'NOT_STANDABLE'
      : !surfaceClear ? 'SURFACE_BLOCKED'
        : !navigable ? 'NOT_NAVIGABLE'
          : reachable === false ? 'NOT_REACHABLE' : 'LEGAL';
  return { x: point.x, z: point.z, insideRegion, standable, surfaceClear, navigable,
    navigationCell, reachable, legal: code === 'LEGAL', code };
}

export interface HideRegionSample {
  readonly x: number;
  readonly z: number;
  readonly standable: boolean;
  readonly surfaceClear: boolean;
  readonly navigable: boolean;
  readonly legal: boolean;
  readonly code: HideRegionPositionCode;
}

// Discrete lattice preview for DEV visualization. `discrete: true` is part of
// the result on purpose: only exact membership decides which lattice points are
// listed, but the counts describe lattice points, not the continuous area of the
// region. A different step changes the counts, so they must never be presented
// as an exact measurement.
export interface HideRegionSamplePreview {
  readonly discrete: true;
  readonly method: 'LATTICE';
  readonly step: number;
  readonly spotId: string;
  readonly geometry: HideRegionGeometry;
  readonly samples: readonly HideRegionSample[];
  readonly legalSamples: number;
  readonly reachabilityEvaluated: boolean;
}

export function sampleHideRegion(setup: HideRegionSetup, world: HideRegionWorld,
  options: { step?: number; reachable?: boolean;
    isReachable?: (point: Point) => boolean } = {}): HideRegionSamplePreview {
  const step = options.step ?? DEFAULT_REGION_SAMPLE_STEP;
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error(`sampleHideRegion 需要正的栅格步长，收到 ${step}`);
  }
  const span = Math.ceil(setup.geometry.radius / step);
  const samples: HideRegionSample[] = [];
  let legalSamples = 0;
  for (let ix = -span; ix <= span; ix++) {
    for (let iz = -span; iz <= span; iz++) {
      const point = { x: setup.geometry.centre.x + ix * step,
        z: setup.geometry.centre.z + iz * step };
      if (!pointInHideRegion(setup.geometry, point)) continue;
      const check = checkHideRegionPosition(setup, point, world,
        { reachable: options.reachable, isReachable: options.isReachable });
      if (check.legal) legalSamples++;
      samples.push({ x: point.x, z: point.z, standable: check.standable,
        surfaceClear: check.surfaceClear, navigable: check.navigable,
        legal: check.legal, code: check.code });
    }
  }
  return { discrete: true, method: 'LATTICE', step, spotId: setup.spot.id,
    geometry: setup.geometry, samples, legalSamples,
    reachabilityEvaluated: options.reachable === true || options.isReachable !== undefined };
}

export type HideRegionDataIssueCode =
  | 'MISSING_REGION'
  | 'UNKNOWN_FURNITURE'
  | 'UNSUPPORTED_SHAPE'
  | 'INVALID_RADIUS'
  | 'INVALID_HALF_ANGLE'
  | 'RADIUS_OUT_OF_AUTHORING_RANGE'
  | 'HALF_ANGLE_OUT_OF_AUTHORING_RANGE'
  | 'UNEXPECTED_HALF_ANGLE'
  | 'ANCHOR_OUTSIDE_REGION';

export interface HideRegionDataIssue {
  readonly spotId: string;
  readonly code: HideRegionDataIssueCode;
  readonly message: string;
}

// Pure authoring-data validation. It checks the shape numbers and the one
// invariant the whole design rests on: the single enter = exit anchor must
// itself be inside its own region. Whether that anchor is also a legal position
// (collision, navigation, no blocking) is checked with the real map through
// `checkHideRegionPosition`, not here.
export function validateHideRegionData(spots: readonly HideSpot[] = HIDE_SPOTS,
  furniture: readonly Rect[] = FURNITURE): HideRegionDataIssue[] {
  const issues: HideRegionDataIssue[] = [];
  const issue = (spotId: string, code: HideRegionDataIssueCode, message: string): void => {
    issues.push({ spotId, code, message });
  };
  for (const spot of spots) {
    // Runtime guard on purpose: a future map JSON import is not type-checked.
    const region: HideInteractionRegion | undefined = spot.interactionRegion;
    if (!region) {
      issue(spot.id, 'MISSING_REGION', `${spot.id} 没有 interactionRegion 数据`);
      continue;
    }
    const own = furniture.find(rect => rect.id === spot.furnitureId);
    if (!own) {
      issue(spot.id, 'UNKNOWN_FURNITURE', `${spot.id} 找不到所属家具 ${spot.furnitureId}`);
      continue;
    }
    if (region.shape !== 'CIRCLE' && region.shape !== 'SECTOR') {
      issue(spot.id, 'UNSUPPORTED_SHAPE', `${spot.id} 的区域形状 ${String(region.shape)} 不受支持`);
      continue;
    }
    if (!Number.isFinite(region.radius) || region.radius <= 0) {
      issue(spot.id, 'INVALID_RADIUS',
        `${spot.id} 的区域半径必须是正数，实际 ${region.radius}`);
      continue;
    }
    if (region.radius < REGION_AUTHORING_LIMITS.minRadius ||
        region.radius > REGION_AUTHORING_LIMITS.maxRadius) {
      issue(spot.id, 'RADIUS_OUT_OF_AUTHORING_RANGE',
        `${spot.id} 的区域半径需在 ${REGION_AUTHORING_LIMITS.minRadius}–${REGION_AUTHORING_LIMITS.maxRadius} 之间`);
    }
    const halfAngle = region.halfAngleDeg;
    if (region.shape === 'CIRCLE') {
      if (halfAngle !== undefined) {
        issue(spot.id, 'UNEXPECTED_HALF_ANGLE', `${spot.id} 是圆形区域，不应带半角`);
      }
    } else if (!Number.isFinite(halfAngle ?? NaN) || (halfAngle ?? 0) <= 0 ||
        (halfAngle ?? 0) >= 180) {
      issue(spot.id, 'INVALID_HALF_ANGLE',
        `${spot.id} 的扇形半角必须在 (0, 180) 度之间，实际 ${halfAngle}`);
      continue;
    }
    if (region.shape === 'SECTOR' && ((halfAngle ?? 0) < REGION_AUTHORING_LIMITS.minHalfAngleDeg ||
        (halfAngle ?? 0) > REGION_AUTHORING_LIMITS.maxHalfAngleDeg)) {
      issue(spot.id, 'HALF_ANGLE_OUT_OF_AUTHORING_RANGE',
        `${spot.id} 的扇形半角需在 ${REGION_AUTHORING_LIMITS.minHalfAngleDeg}–${REGION_AUTHORING_LIMITS.maxHalfAngleDeg} 度之间`);
    }
    const geometry = hideRegionGeometry(spot, own);
    if (!pointInHideRegion(geometry, geometry.anchor)) {
      issue(spot.id, 'ANCHOR_OUTSIDE_REGION',
        `${spot.id} 的唯一锚点不在自己的交互区域内（距家具中心 ` +
        `${Math.hypot(spot.x - own.x, spot.z - own.z).toFixed(3)}，半径 ${region.radius}）`);
    }
  }
  return issues;
}
