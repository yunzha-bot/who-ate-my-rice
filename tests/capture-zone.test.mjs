import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Object3D, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { CAPTURE_ZONE_COLORS, CaptureZoneView,
  isCaptureEligibleXZ, isInsideCaptureZoneXZ } from '../src/three/CaptureZone.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';

const point = (x, z) => new Vector3(x, 0.35, z);
const obstacle = (minX, maxX, minZ, maxZ) =>
  new Box3(new Vector3(minX, 0, minZ), new Vector3(maxX, 1, maxZ));
const startMatch = () => {
  const match = new GameStateSystem(0, GAME_CONFIG.match.captureMs);
  match.advanceReady(0);
  return match;
};

test('capture eligibility uses the configured XZ radius instead of body overlap', () => {
  const human = point(0, 0);
  const inside = point(GAME_CONFIG.match.captureRadius - 0.01, 0);
  const outside = point(GAME_CONFIG.match.captureRadius + 0.01, 0);
  assert.equal(isInsideCaptureZoneXZ(human, inside, GAME_CONFIG.match.captureRadius), true);
  assert.equal(isInsideCaptureZoneXZ(human, outside, GAME_CONFIG.match.captureRadius), false);
  assert.equal(isCaptureEligibleXZ(human, outside, GAME_CONFIG.match.captureRadius, false), false);
});

test('continuous zone stay wins at 350 ms while leaving immediately resets progress', () => {
  const match = startMatch();
  match.advancePlaying(200, true, false);
  assert.equal(match.captureProgressMs, 200);
  assert.equal(match.phase, 'PLAYING');
  match.advancePlaying(1, false, false);
  assert.equal(match.captureProgressMs, 0);
  match.advancePlaying(349, true, false);
  assert.equal(match.phase, 'PLAYING');
  match.advancePlaying(1, true, false);
  assert.equal(match.result?.winner, 'HUMAN');
});

test('walls and collision furniture block capture line of sight', () => {
  const human = point(-0.5, 0);
  const deepseek = point(0.5, 0);
  const clearWorld = new CollisionWorld(5, 5, []);
  const wallWorld = new CollisionWorld(5, 5, [obstacle(-0.1, 0.1, -1, 1)]);
  assert.equal(clearWorld.isLineBlockedXZ(human, deepseek), false);
  assert.equal(wallWorld.isLineBlockedXZ(human, deepseek), true);
  assert.equal(isCaptureEligibleXZ(human, deepseek, 2, wallWorld.isLineBlockedXZ(human, deepseek)), false);
  assert.equal(isCaptureEligibleXZ(human, deepseek, 2, clearWorld.isLineBlockedXZ(human, deepseek)), true);
});

test('a fast sprint pass is not captured, while STUNNED inside the zone remains capturable', () => {
  const fastPass = startMatch();
  fastPass.advancePlaying(100, true, false);
  fastPass.advancePlaying(16, false, false);
  assert.equal(fastPass.captureProgressMs, 0);
  assert.equal(fastPass.phase, 'PLAYING');

  const sprint = new SprintSystem(GAME_CONFIG.sprint.durationMs,
    GAME_CONFIG.sprint.riskThreshold, GAME_CONFIG.sprint.stunMs);
  assert.equal(sprint.tryStart({ x: 1, y: 0 }, GAME_CONFIG.sprint.riskThreshold), true);
  sprint.advance(GAME_CONFIG.sprint.durationMs, { x: 1, y: 0 });
  assert.equal(sprint.state, 'STUNNED');
  const stunnedCapture = startMatch();
  stunnedCapture.advancePlaying(GAME_CONFIG.match.captureMs, true, false);
  assert.equal(stunnedCapture.result?.winner, 'HUMAN');
});

test('pause and FINISHED freeze capture, and reset/menu clear it', () => {
  const match = startMatch();
  match.advancePlaying(200, true, false);
  match.pause();
  match.advancePlaying(1_000, true, false);
  assert.equal(match.captureProgressMs, 200);
  match.resume();
  match.advancePlaying(150, true, false);
  assert.equal(match.phase, 'FINISHED');
  match.advancePlaying(1_000, true, false);
  assert.equal(match.captureProgressMs, 350);
  assert.equal(match.returnToFactionSelect(), true);
  assert.equal(match.phase, 'FACTION_SELECT');
  assert.equal(match.captureProgressMs, 0);
  match.beginFromFactionSelect();
  match.advanceReady(0);
  match.advancePlaying(100, true, false);
  match.reset();
  assert.equal(match.captureProgressMs, 0);
});

test('capture ring stays attached to Human and remains ground-level', () => {
  const human = new Object3D();
  human.position.set(2, GAME_CONFIG.three.actorHeight / 2, -3);
  const view = new CaptureZoneView(human, GAME_CONFIG.match.captureRadius,
    GAME_CONFIG.three.actorHeight);
  human.updateMatrixWorld(true);
  const worldPosition = new Vector3();
  view.mesh.getWorldPosition(worldPosition);
  assert.ok(Math.abs(worldPosition.x - 2) < 1e-9);
  assert.ok(Math.abs(worldPosition.y - 0.015) < 1e-9);
  assert.ok(Math.abs(worldPosition.z + 3) < 1e-9);
  human.position.x = 4;
  human.updateMatrixWorld(true);
  view.mesh.getWorldPosition(worldPosition);
  assert.ok(Math.abs(worldPosition.x - 4) < 1e-9);
  view.dispose();
});

test('capture ring continuously interpolates blue to yellow to red without changing radius', () => {
  const view = new CaptureZoneView(new Object3D(), GAME_CONFIG.match.captureRadius,
    GAME_CONFIG.three.actorHeight);
  const initialScale = view.mesh.scale.clone();
  const ratio0 = view.setProgress(0, 350, true);
  assert.equal(ratio0, 0);
  assert.equal(view.mesh.material.color.getHex(), CAPTURE_ZONE_COLORS.safe);
  const ratio25 = view.setProgress(87.5, 350, true);
  const quarterColor = view.mesh.material.color.getHex();
  assert.equal(ratio25, 0.25);
  assert.notEqual(quarterColor, CAPTURE_ZONE_COLORS.safe);
  assert.notEqual(quarterColor, CAPTURE_ZONE_COLORS.warning);
  const ratio50 = view.setProgress(175, 350, true);
  assert.equal(ratio50, 0.5);
  assert.equal(view.mesh.material.color.getHex(), CAPTURE_ZONE_COLORS.warning);
  const ratio75 = view.setProgress(262.5, 350, true);
  const threeQuarterColor = view.mesh.material.color.getHex();
  assert.equal(ratio75, 0.75);
  assert.notEqual(threeQuarterColor, CAPTURE_ZONE_COLORS.warning);
  assert.notEqual(threeQuarterColor, CAPTURE_ZONE_COLORS.capture);
  const ratio100 = view.setProgress(350, 350, true);
  assert.equal(ratio100, 1);
  assert.equal(view.mesh.material.color.getHex(), CAPTURE_ZONE_COLORS.capture);
  assert.deepEqual(view.mesh.scale.toArray(), initialScale.toArray());
  view.dispose();
});

test('leaving or an invalid blocked capture immediately restores blue', () => {
  const view = new CaptureZoneView(new Object3D(), GAME_CONFIG.match.captureRadius,
    GAME_CONFIG.three.actorHeight);
  view.setProgress(200, 350, true);
  assert.notEqual(view.mesh.material.color.getHex(), CAPTURE_ZONE_COLORS.safe);
  view.setProgress(0, 350, false);
  assert.equal(view.mesh.material.color.getHex(), CAPTURE_ZONE_COLORS.safe);
  view.setProgress(200, 350, false);
  assert.equal(view.mesh.material.color.getHex(), CAPTURE_ZONE_COLORS.safe);
  view.dispose();
});
