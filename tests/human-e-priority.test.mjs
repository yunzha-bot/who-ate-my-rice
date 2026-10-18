import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { resolveInteractionIntent } from '../src/systems/HideInteractionArbitration.ts';
import { interactionPrompt } from '../src/three/InteractionPrompt.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { resolvePlayerQPlan } from '../src/systems/HideTargetResolution.ts';
import { resolveQSkill, deepseekLockGate, lockArmsPlayerCooldown } from '../src/systems/SkillGates.ts';
import { SkillCooldown } from '../src/systems/SkillCooldown.ts';
import { evaluateHumanSearch, HUMAN_SEARCH_CODE_TEXT } from '../src/systems/HumanSearchSkill.ts';

const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const method = source.match(/  private handleDoorInteractions\([\s\S]*?\n  }\r?\n/)[0];
const promptMethod = source.match(/  private currentInteractionPrompt\([\s\S]*?\n  }\r?\n/)[0];
const skillMethod = source.match(/  private useSkillQ\([\s\S]*?\n  }\r?\n/)[0];
const Harness = runInNewContext(stripTypeScriptTypes(`class Harness { ${method} ${promptMethod} ${skillMethod} }; Harness`,
  { mode: 'transform' }), { resolveInteractionIntent, interactionPrompt, C,
    resolvePlayerQPlan, resolveQSkill, deepseekLockGate, lockArmsPlayerCooldown,
    U: C.three.pixelsPerUnit, THREE: { Vector3: class {} } });

function fixture({ faction = 'HUMAN', door = null, pulse = false, stunned = false, keys = ['KeyE'] } = {}) {
  const game = new Harness(), calls = [], pressed = new Set(keys);
  Object.assign(game, {
    control: { controlledFaction: faction, controlled: () => ({ position: { x: 0, z: 0 } }) },
    throwables: { isStunned: () => stunned },
    captureNet: { rootMs: 0, mode: 'NONE', placing: false },
    throwableView: { cancel() {} },
    captureNetView: { begin() { calls.push('net'); game.captureNet.mode = 'AIMING'; } },
    input: { consumePress(key) { const value = pressed.has(key); pressed.delete(key); return value; } },
    pulseLock: { isOpen: pulse, movementLocked: pulse, open() { calls.push('pulse-open'); return true; } },
    pressPulseLock() { calls.push('pulse-press'); }, renderPulseLock() {},
    nearestInteractableDoor: () => door, nearestRice: () => null,
    hide: { isConcealed: () => false }, match: { phase: 'PLAYING' },
    nearestHideCandidate: () => null, canCloseDoor: () => false,
    doorSystem: { toggle(_id, _actor, canClose) { calls.push(['door', canClose]); },
      lock() { calls.push('lock'); return 'NOT_FOUND'; } },
    applyDoorResult() {},
    humanSearchCooldown: new SkillCooldown(C.humanSearch.cooldownMs),
    deepseekLockCooldown: new SkillCooldown(12000),
    furnitureTarget: null, exposed: false,
    playerQTargetResolution: () => ({ pointedLegalTarget: game.furnitureTarget }),
    probeExposedTarget: () => ({ available: game.exposed }),
    performFurnitureSearch() { calls.push('furniture'); return true; },
    performHumanSearch() { calls.push('fan'); },
    audio: { play() {} }, feedback: { show() {} }, playWorld() {}, setHideNotice() {},
  });
  return { game, calls, pressed };
}

test('Human E spam without furniture never spends cooldown; V only fans; Q owns E/V while aiming', () => {
  const f = fixture({ keys: ['KeyE'] });
  for (let i = 0; i < 20; i++) {
    f.pressed.add('KeyE'); f.game.handleDoorInteractions();
  }
  assert.deepEqual(f.calls, []);
  assert.equal(f.game.humanSearchCooldown.armCount, 0);
  f.pressed.add('KeyV');
  f.game.handleDoorInteractions(); f.game.handleDoorInteractions();
  assert.deepEqual(f.calls, ['fan']);
  const q = fixture({ keys: ['KeyQ'] });
  q.game.handleDoorInteractions();
  assert.deepEqual(q.calls, ['net']);
  const both = fixture({ keys: ['KeyE', 'KeyQ', 'KeyV'] });
  both.game.handleDoorInteractions();
  assert.deepEqual(both.calls, ['net']);
  both.game.captureNet.mode = 'NONE'; both.game.handleDoorInteractions();
  assert.deepEqual(both.calls, ['net'], 'blocked V must not fire after net cancellation');
});

test('Human E door/core/blocked-close priority never also searches', () => {
  for (const state of ['OPEN', 'CLOSED', 'LOCKED']) {
    const f = fixture({ door: { distance: 1, definition: { id: 'd' },
      door: { id: 'd', state, lockCoreState: 'ACTIVE' } } });
    f.game.handleDoorInteractions();
    assert.deepEqual(f.calls, state === 'LOCKED' ? ['pulse-open'] : [['door', state !== 'OPEN']]);
  }
});

test('PulseLock consumes E exclusively; blocked V is drained instead of firing later', () => {
  const f = fixture({ pulse: true, keys: ['KeyE', 'KeyQ', 'KeyV'] });
  f.game.handleDoorInteractions();
  assert.deepEqual(f.calls, ['pulse-press']);
  f.game.pulseLock.isOpen = false; f.game.handleDoorInteractions();
  assert.deepEqual(f.calls, ['pulse-press']);
  const s = fixture({ stunned: true, keys: ['KeyE', 'KeyV'] });
  s.game.handleDoorInteractions();
  assert.deepEqual(s.calls, []);
  assert.equal(s.pressed.has('KeyV'), false);
  const opening = fixture({ keys: ['KeyE', 'KeyV'], door: { distance: 1,
    definition: { id: 'd' }, door: { id: 'd', state: 'LOCKED', lockCoreState: 'ACTIVE' } } });
  opening.game.pulseLock.open = () => { opening.calls.push('pulse-open');
    opening.game.pulseLock.isOpen = true; return true; };
  opening.game.handleDoorInteractions();
  assert.deepEqual(opening.calls, ['pulse-open']);
});

test('DP Q still dispatches the original lock skill, not Human search', () => {
  const f = fixture({ faction: 'DEEPSEEK', keys: ['KeyQ', 'KeyV'],
    door: { distance: 1, definition: { id: 'd' }, door: { id: 'd', state: 'CLOSED' } } });
  f.game.handleDoorInteractions();
  assert.deepEqual(f.calls, ['lock']);
  assert.equal(f.pressed.has('KeyV'), false);
});

test('Human V independently fans beside a door; C is not a capture key', () => {
  const f = fixture({ keys: ['KeyV', 'KeyC'], door: { distance: 1,
    definition: { id: 'd' }, door: { id: 'd', state: 'CLOSED' } } });
  f.game.handleDoorInteractions(); f.game.handleDoorInteractions();
  assert.deepEqual(f.calls, ['fan']);
  const c = fixture({ keys: ['KeyC'] }); c.game.handleDoorInteractions();
  assert.deepEqual(c.calls, []);
});

test('E searches only pointed furniture even with an exposed target; V never selects furniture', () => {
  const e = fixture(); e.game.furnitureTarget = { spotId: 'bed', legal: true }; e.game.exposed = true;
  e.game.handleDoorInteractions();
  assert.deepEqual(e.calls, ['furniture']);
  assert.equal(e.game.humanSearchCooldown.armCount, 1);
  const v = fixture({ keys: ['KeyV'] }); v.game.furnitureTarget = e.game.furnitureTarget;
  v.game.handleDoorInteractions();
  assert.deepEqual(v.calls, ['fan']);
  assert.equal(v.game.humanSearchCooldown.armCount, 1);
});

test('E stale furniture never falls back or spends cooldown; E/V share one cooldown', () => {
  const stale = fixture(); stale.game.furnitureTarget = { spotId: 'bed', legal: true };
  stale.game.performFurnitureSearch = () => false; stale.game.handleDoorInteractions();
  assert.deepEqual(stale.calls, []);
  assert.equal(stale.game.humanSearchCooldown.armCount, 0);
  const both = fixture({ keys: ['KeyE', 'KeyV'] });
  both.game.furnitureTarget = stale.game.furnitureTarget; both.game.handleDoorInteractions();
  assert.deepEqual(both.calls, ['furniture']);
  assert.equal(both.game.humanSearchCooldown.armCount, 1);
  both.pressed.add('KeyV'); both.game.handleDoorInteractions();
  assert.deepEqual(both.calls, ['furniture']);
  both.game.humanSearchCooldown.advance(C.humanSearch.cooldownMs);
  both.pressed.add('KeyV'); both.game.handleDoorInteractions();
  assert.deepEqual(both.calls, ['furniture', 'fan']);
  both.game.humanSearchCooldown.advance(C.humanSearch.cooldownMs);
  both.pressed.add('KeyV'); both.game.handleDoorInteractions();
  both.pressed.add('KeyE'); both.game.handleDoorInteractions();
  assert.deepEqual(both.calls, ['furniture', 'fan', 'fan'], 'fan cooldown also blocks E furniture');
});

test('actual player fan cannot search hidden furniture; exposed range, angle and walls still apply', () => {
  const fanMethod = source.match(/  private performHumanSearch\([\s\S]*?\n  }\r?\n/)[0];
  const Fan = runInNewContext(stripTypeScriptTypes(`class Fan { ${fanMethod} }; Fan`,
    { mode: 'transform' }), { evaluateHumanSearch, HUMAN_SEARCH_CODE_TEXT, pointText: JSON.stringify });
  for (const [concealed, position, blocked, expected] of [
    [true, { x: .5, z: 0 }, false, 0], [false, { x: .5, z: 0 }, false, 1],
    [false, { x: 8, z: 0 }, false, 0], [false, { x: -.5, z: 0 }, false, 0],
    [false, { x: .5, z: 0 }, true, 0],
  ]) {
    let captures = 0, targetReads = 0;
    const game = new Fan(); Object.assign(game, {
      humanSearchHeadingRad: () => 0, hideSearchView: { show() {} }, humanSearchCount: 0,
      hide: { isConcealed: () => concealed },
      humanSearchTarget() { targetReads++; return { concealed: false, position, spotId: null, furniture: null }; },
      perceptionGeometry: { inspectVision: () => ({ status: blocked ? 'BLOCKED' : 'VISIBLE' }) },
      playWorld() {}, setHideNotice() {}, feedback: { show() {} }, humanSearchHitCount: 0,
      match: { forceCapture() { captures++; } },
    });
    game.performHumanSearch({ position: { x: 0, z: 0 } }, 'NO_TARGET', { available: false });
    assert.equal(captures, expected);
    if (concealed) assert.equal(targetReads, 0, 'V must not query concealed furniture target');
  }
});

test('net placement owns Human E; rooted DP cannot lock, hide or interact', () => {
  const human = fixture(); human.game.captureNet.mode = 'PLACING';
  human.game.captureNet.placing = true;
  assert.equal(human.game.handleDoorInteractions().humanMovementLocked, true);
  assert.deepEqual(human.calls, []);
  const dp = fixture({ faction: 'DEEPSEEK', keys: ['KeyQ', 'KeyE'] });
  dp.game.captureNet.rootMs = 1200; dp.game.handleDoorInteractions();
  assert.deepEqual(dp.calls, []);
});

test('Human overhead search hint requires a pointed legal furniture; empty ground and illegal targets stay silent', () => {
  const { game } = fixture();
  let target = null;
  const position = { clone: () => ({ add() { return this; }, project: () => ({ x: 0, y: 0 }) }) };
  Object.assign(game, {
    control: { controlledFaction: 'HUMAN', controlled: () => ({ position }) },
    devFreeze: { isFrozen: false }, hide: { isConcealed: () => false, state: 'OUTSIDE' },
    hideTargetResolution: () => ({ target: { legal: false } }),
    playerQTargetResolution: () => ({ pointedLegalTarget: target }),
    probeExposedTarget: () => ({ available: false }),
    input: { localDirection: () => ({ x: 0, y: 0 }), isHeld: () => false },
    humanSearchCooldown: { ready: true, remainingSeconds: 0 },
    sprint: { state: 'NORMAL' }, renderer: { domElement: { clientWidth: 100, clientHeight: 100 } },
  });
  assert.equal(game.currentInteractionPrompt(), null);
  target = { spotId: 'bed' };
  assert.equal(game.currentInteractionPrompt().label, '搜查家具');
  assert.equal(game.currentInteractionPrompt().key, 'E');
  game.input.isHeld = key => key === 'KeyE';
  assert.equal(game.currentInteractionPrompt().held, true);
  game.input.isHeld = key => key === 'KeyV';
  assert.equal(game.currentInteractionPrompt().held, false);
  game.probeExposedTarget = () => ({ available: true });
  assert.equal(game.currentInteractionPrompt().key, 'E', 'exposed target must not suppress E furniture');
  game.humanSearchCooldown = { ready: false, remainingSeconds: 4 };
  assert.equal(game.currentInteractionPrompt().detail, '冷却 4 秒');
  target = null;
  assert.equal(game.currentInteractionPrompt(), null);
  game.nearestInteractableDoor = () => ({ distance: 1,
    definition: { id: 'd' }, door: { id: 'd', state: 'CLOSED' } });
  assert.equal(game.currentInteractionPrompt().label, '开门');
  assert.equal(game.currentInteractionPrompt().held, false);
});
