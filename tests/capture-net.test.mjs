import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { CaptureNetSystem, humanNetPlacement } from '../src/systems/CaptureNetSystem.ts';
import { ThrowableSystem } from '../src/systems/ThrowableSystem.ts';
import { CaptureNetView } from '../src/three/CaptureNetView.ts';
import { ThrowableView } from '../src/three/ThrowableView.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';

const human = { x: 0, z: 0 }, point = { x: 1.4, z: 0 };
const clear = () => null, valid = () => true;
const advance = (s, dt, can = true, external = 0) => s.advance(dt, human, can, clear, valid, external);
function armed() {
  const s = new CaptureNetSystem(); assert(s.place(human, point, clear, valid));
  advance(s, C.captureNet.placeMs); advance(s, C.captureNet.armMs); return s;
}

test('four permanent net slots; 600ms success starts CD and 1000ms arms each net', () => {
  const s = new CaptureNetSystem(); assert(s.beginAim()); assert(!s.beginAim());
  assert(s.place(human, point, clear, valid)); advance(s, 599);
  assert.equal(s.nets.length, 0); assert.equal(s.cooldownMs, 0); assert(s.placing);
  advance(s, 1); assert.equal(s.mode, 'NONE'); assert.equal(s.cooldownMs, 20000);
  assert.equal(s.remainingSlots, 3); assert(!s.beginAim());
  advance(s, 999); assert.equal(s.trigger(point, point, false, clear), null);
  advance(s, 1); assert.equal(s.nets[0].ageMs, 1000);
  advance(s, 19000); assert.equal(s.cooldownMs, 0); assert(s.ready);
  for (const p of [{ x: -1.4, z: 0 }, { x: 0, z: 1.4 }, { x: 0, z: -1.4 }]) {
    assert(s.place(human, p, clear, valid)); advance(s, 600); advance(s, 20000);
  }
  assert.equal(s.nets.length, 4); assert.equal(s.remainingSlots, 0);
  advance(s, 3600000); assert.equal(s.nets.length, 4, 'no timer expires a deployed net');
  assert(!s.beginAim()); assert(!s.place(human, { x: 2.8, z: 0 }, clear, valid));
  assert(s.trigger(point, point, false, clear) !== null);
  assert.equal(s.nets.length, 3); assert.equal(s.remainingSlots, 1); assert(s.ready);
  assert(s.place(human, { x: 2.8, z: 0 }, clear, valid)); advance(s, 600);
  assert.equal(s.remainingSlots, 0); s.reset(); assert.equal(s.remainingSlots, 4);
});

test('cancel/interruption/revalidation failure spend no cooldown; zero delta freezes all clocks', () => {
  for (const reason of ['cancel', 'stunned', 'blocked']) {
    const s = new CaptureNetSystem(); assert(s.place(human, point, clear, valid)); advance(s, 300);
    const before = JSON.stringify(s); advance(s, 0); assert.equal(JSON.stringify(s), before);
    if (reason === 'cancel') s.cancel();
    else s.advance(300, human, reason !== 'stunned', clear, () => reason !== 'blocked');
    assert.equal(s.nets.length, 0); assert.equal(s.cooldownMs, 0); assert.equal(s.mode, 'NONE');
    assert(s.ready);
  }
  const s = armed(), before = JSON.stringify(s); advance(s, 0);
  assert.equal(JSON.stringify(s), before); s.reset(); assert(s.ready); assert.equal(s.rootMs, 0);
});

test('range, finite coordinates, walls and physical placement validation are authoritative', () => {
  const s = new CaptureNetSystem();
  for (const p of [{ x: 3.01, z: 0 }, { x: NaN, z: 0 }, { x: 0, z: Infinity }])
    assert(!s.place(human, p, clear, valid));
  assert(!s.place(human, point, () => .5, valid));
  assert(!s.place(human, point, clear, () => false));
  assert(s.valid(human, { x: 2.5, z: 0 }, clear, valid));
  assert(s.place(human, { x: 3, z: 0 }, clear, valid));
});

test('continuous net sweep catches a fast sprint once, not a concealed actor or through walls', () => {
  const from = { x: -3, z: 0 }, to = { x: 6, z: 0 };
  const s = armed();
  assert.equal(s.trigger(from, to, true, clear), null);
  assert.equal(s.trigger(from, to, false, () => .1), null);
  const t = s.trigger(from, to, false, clear); assert(t > 0 && t < 1);
  assert.equal(s.rootMs, 5000); assert.equal(s.nets.length, 0);
  assert.equal(s.trigger(from, to, false, clear), null);
  advance(s, 4999); assert.equal(s.rootMs, 1); advance(s, 1);
  assert.equal(s.rootMs, 0); assert.equal(s.immunityMs, 2000);
  advance(s, 1999); assert.equal(s.immunityMs, 1); advance(s, 1); assert.equal(s.immunityMs, 0);
});

test('net and throwable controls use max remaining, immunity waits for external control to end', () => {
  const s = armed(); s.trigger(point, point, false, clear);
  advance(s, 5000, true, 1800);
  assert.equal(s.rootMs, 0); assert.equal(s.immunityMs, 0);
  advance(s, 1799, true, 1); assert.equal(s.immunityMs, 0);
  advance(s, 1, true, 0); assert.equal(s.immunityMs, 2000);
  // A second net cannot extend control or the post-control immunity.
  s.nets.push({ ...point, ageMs: C.captureNet.armMs });
  assert.equal(s.trigger(point, point, false, clear), null); assert.equal(s.nets.length, 1);
  assert.equal(s.immunityMs, 2000);
});

test('multiple nets consume only the first swept net, reject overlap and preserve other slots', () => {
  const s = new CaptureNetSystem();
  s.nets.push({ x: 2, z: 0, ageMs: 1000 }, { x: -2, z: 0, ageMs: 1000 },
    { x: 0, z: 2, ageMs: 0 });
  assert.equal(s.valid(human, { x: 2.5, z: 0 }, clear, valid), false);
  const t = s.trigger({ x: -5, z: 0 }, { x: 5, z: 0 }, false, clear);
  assert(t < .3); assert.equal(s.nets.length, 2);
  assert.deepEqual(s.nets.map(n => n.x), [2, 0]); assert.equal(s.remainingSlots, 2);
  assert.equal(s.trigger({ x: -5, z: 0 }, { x: 5, z: 0 }, false, clear), null);
  assert.equal(s.nets.length, 2, 'already rooted cannot consume a second net');
});

test('projectiles destroy only the nearest net even when target array is reversed', () => {
  const net = new CaptureNetSystem();
  net.nets.push({ x: 3, z: 0, ageMs: 1000 }, { x: 1.5, z: 0, ageMs: 0 });
  const s = new ThrowableSystem([{ id: 'p', kind: 'BOX', x: .5, z: 0, roomId: 'r' }]);
  const dp = { faction: 'DEEPSEEK', ...human, hidden: false, canAct: true };
  assert(s.pickup(dp, clear)); assert(s.throw(dp, { x: 4, z: 0 }, clear));
  s.advanceFlights(600, [dp], clear, undefined,
    () => net.nets.map(n => ({ ...n, radius: C.captureNet.radius, destroy: () => net.destroy(n) })));
  assert.deepEqual(net.nets.map(n => n.x), [3]); assert.equal(net.remainingSlots, 3);
});

test('AI proposal uses visible target and its own route only; normal validation/CD still gate it', () => {
  assert.equal(humanNetPlacement(human, null, { x: 1, z: 0 }), null);
  assert.equal(humanNetPlacement(human, { x: 7, z: 0 }, { x: 1, z: 0 }), null);
  assert.equal(humanNetPlacement(human, { x: 4, z: 0 }, human), null);
  const p = humanNetPlacement(human, { x: 4, z: 0 }, { x: 10, z: 0 });
  assert.deepEqual(p, point);
  const s = new CaptureNetSystem(); assert(!s.place(human, p, () => 0, valid));
  assert(s.place(human, p, clear, valid)); advance(s, 600); assert(!s.place(human, p, clear, valid));
});

for (const kind of ['VASE', 'BOX', 'BASIN']) {
  test(`DP ${kind} destroys net on first contact; disposal and basin reuse rules unchanged`, () => {
    const net = armed(); net.nets.splice(0, 1, { x: 2, z: 0, ageMs: 0 });
    const s = new ThrowableSystem([{ id: 'p', kind, x: .5, z: 0, roomId: 'r' }]);
    const dp = { faction: 'DEEPSEEK', ...human, hidden: false, canAct: true };
    assert(s.pickup(dp, clear)); assert(s.throw(dp, { x: 4, z: 0 }, clear));
    const target = () => net.nets.map(n => ({ ...n, radius: C.captureNet.radius, destroy: () => net.destroy(n) }));
    assert.deepEqual(s.advanceFlights(600, [dp], clear, undefined, target), []);
    assert.equal(net.nets.length, 0); assert.equal(net.rootMs, 0);
    assert.equal(s.items[0].state, kind === 'BASIN' ? 'GROUND' : 'USED');
    const at = { ...dp, x: s.items[0].x }; assert(!s.pickup(at, clear));
    s.advanceTime(500); assert.equal(s.pickup(at, clear), kind === 'BASIN');
  });
}

test('wall/earlier actor blocks net destruction; Human own projectile cannot destroy its net', () => {
  for (const mode of ['wall', 'actor', 'human']) {
    const owner = { faction: mode === 'human' ? 'HUMAN' : 'DEEPSEEK', ...human, hidden: false, canAct: true };
    const victim = { ...owner, faction: 'HUMAN', x: 1 };
    const s = new ThrowableSystem([{ id: 'p', kind: 'BOX', x: .5, z: 0, roomId: 'r' }]);
    let destroyed = 0;
    assert(s.pickup(owner, clear)); assert(s.throw(owner, { x: 4, z: 0 }, clear));
    s.advanceFlights(600, mode === 'actor' ? [owner, victim] : [owner],
      mode === 'wall' ? () => .1 : clear, undefined,
      () => [{ x: 3, z: 0, radius: .55, destroy() { destroyed++; } }]);
    assert.equal(destroyed, 0);
    assert.equal(s.isStunned('HUMAN'), mode === 'actor');
  }
});

const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const method = name => source.match(new RegExp(`  private ${name}\\([\\s\\S]*?\\n  }\\r?\\n`))[0];
const ground = source.match(/  private netGroundClear = [\s\S]*?\n  };\r?\n/)[0];
const Harness = runInNewContext(stripTypeScriptTypes(
  `class Harness { ${method('move')} ${method('moveToNetContact')} ${method('tryHumanAiNet')}
    ${method('humanNetReactionWaiting')} ${ground} }; Harness`, { mode: 'transform' }),
{ C, humanNetPlacement, SPAWNS: { human: { x: -10, z: -10 }, deepseek: { x: 10, z: 10 } } });

function aiNetHost(difficulty) {
  const g = new Harness();
  Object.assign(g, { difficulty, captureNet: new CaptureNetSystem(), human: { position: human },
    throwables: { nowMs: 0 }, netAiNextAttemptAt: 0, netAiApproachAt: 0, netAiSawRooted: false,
    canPlaceNet: () => true, traceThrow: clear, netGroundClear: valid,
    vision: { get: () => ({ visible: true }) } });
  return g;
}

test('real host applies Human AI net budgets 1/2/4, retaining the player four-slot rule', () => {
  const directions = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  for (const [difficulty, max] of [['EASY', 1], ['NORMAL', 2], ['HARD', 4]]) {
    const g = aiNetHost(difficulty);
    for (let i = 0; i < max; i++) {
      g.tryHumanAiNet({ x: 4, z: 0 }, directions[i]); assert(g.captureNet.placing);
      advance(g.captureNet, 600); g.throwables.nowMs += 600;
      advance(g.captureNet, 20000); g.throwables.nowMs += 20000;
    }
    assert.equal(g.captureNet.nets.length, max);
    g.tryHumanAiNet({ x: 4, z: 0 }, { x: 1, z: 1 }); assert(!g.captureNet.placing);
    assert.equal(g.captureNet.remainingSlots, 4 - max);
    assert.equal(g.captureNet.beginAim(), max < 4, 'AI budget does not reduce manual capacity');
  }
});

test('net proposal pacing is 5s/1.5s/0.5s; hidden/controlled targets and frozen time cannot bypass it', () => {
  for (const [difficulty, interval] of [['EASY', 5000], ['NORMAL', 1500], ['HARD', 500]]) {
    const g = aiNetHost(difficulty); let attempts = 0;
    g.netGroundClear = () => { attempts++; return false; };
    const attempt = () => g.tryHumanAiNet({ x: 4, z: 0 }, { x: 1, z: 0 });
    g.tryHumanAiNet(null, { x: 1, z: 0 }); assert.equal(attempts, 0);
    g.captureNet.rootMs = 1000; attempt(); assert.equal(attempts, 0);
    g.captureNet.rootMs = 0; attempt(); assert.equal(attempts, 1);
    attempt(); attempt(); assert.equal(attempts, 1, 'paused gameplay clock cannot retry');
    g.throwables.nowMs += interval - 1; attempt(); assert.equal(attempts, 1);
    g.throwables.nowMs++; attempt(); assert.equal(attempts, 2);
    assert.equal(g.captureNet.cooldownMs, 0, 'invalid point does not consume skill cooldown');
  }
});

test('Human AI waits 1.2s/0.5s/0 after actually seeing a net-rooted target, without affecting manual control', () => {
  for (const [difficulty, delay] of [['EASY', 1200], ['NORMAL', 500], ['HARD', 0]]) {
    const g = aiNetHost(difficulty); g.captureNet.rootMs = 5000;
    g.vision.get = () => ({ visible: false });
    assert.equal(g.humanNetReactionWaiting(true), false, 'no hidden-coordinate reaction');
    g.vision.get = () => ({ visible: true });
    assert.equal(g.humanNetReactionWaiting(true), delay > 0);
    if (delay > 0) {
      g.throwables.nowMs = delay - 1;
      assert(g.humanNetReactionWaiting(true)); assert(g.humanNetReactionWaiting(true));
      g.throwables.nowMs++; assert.equal(g.humanNetReactionWaiting(true), false);
      assert.equal(g.netAiApproachAt, delay, 'continuous observation must not restart delay');
    }
    assert.equal(g.humanNetReactionWaiting(false), false);
    assert.equal(g.netAiApproachAt, 0, 'manual takeover clears the decision wait');
    g.humanNetReactionWaiting(true); g.captureNet.rootMs = 0;
    assert.equal(g.humanNetReactionWaiting(true), false, 'no delay after root ends');
  }
});

test('actual Human movement expression holds AI during net reaction and releases the original direction', () => {
  const expression = source.match(/const activeHumanDirection = ([\s\S]*?);/)[1];
  const move = new Function('humanNetWait', 'doorInteraction', 'aiHumanDirection', 'humanDirection', `return ${expression};`);
  const g = { throwables: { isStunned: () => false }, captureNet: { placing: false } };
  assert.deepEqual(move.call(g, true, { humanMovementLocked: false }, { x: 1, y: 1 }, { x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(move.call(g, false, { humanMovementLocked: false }, { x: 1, y: 1 }, { x: 0, y: 0 }), { x: 1, y: 1 });
  assert.deepEqual(move.call(g, false, { humanMovementLocked: false }, null, { x: 0, y: 1 }), { x: 0, y: 1 });
});

test('real movement host stops DP at swept net contact through CollisionWorld, never auto-wins', () => {
  const g = new Harness(), player = { position: new THREE.Vector3(-2, .4, 0) };
  Object.assign(g, { player, captureNet: armed(), collision: new CollisionWorld(20, 20, []),
    hide: { isConcealed: () => false }, rice: { interrupt() { g.interrupted = true; } },
    traceThrow: clear, showWorldFeedback() {} });
  g.move(player, 7, 0);
  assert(Math.abs(player.position.x - (point.x - C.captureNet.radius - C.collision.playerRadius)) < 1e-8);
  assert(g.interrupted); assert.equal(g.captureNet.rootMs, 5000);
  assert.equal(g.match, undefined, 'net does not own match/capture resolution');
});

test('real host rejects actors, rice, randomized spawns, hide anchors/exits and furniture', () => {
  const g = new Harness();
  Object.assign(g, { collision: new CollisionWorld(20, 20, []), traceThrow: clear,
    human: { position: { x: -8, z: 0 } }, player: { position: { x: 8, z: 0 } },
    riceViews: new Map([['rice', { position: { x: 0, z: 2 } }]]),
    matchSetup: { human: { x: -5, z: 2 }, deepseek: { x: 5, z: 2 } },
    mapFurniture: [{ id: 'bed', x: 0, z: -5 }],
    hideSpots: [{ x: 0, z: -5, furnitureId: 'bed', interactionRegion: { radius: 2 } }],
    hide: { entryPosition: { x: -5, z: -5 } } });
  for (const p of [g.human.position, g.player.position, { x: 0, z: 2 },
    g.matchSetup.human, g.matchSetup.deepseek, ...g.hideSpots, g.hide.entryPosition])
    assert.equal(g.netGroundClear(p), false);
  assert.equal(g.netGroundClear(human), true);
  assert.equal(g.netGroundClear({ x: 2.5, z: -5 }), false, 'net edge must not overlap a future hide exit');
  g.collision = new CollisionWorld(20, 20, [new THREE.Box3(new THREE.Vector3(-.2, 0, -.2), new THREE.Vector3(.2, 1, .2))]);
  assert.equal(g.netGroundClear(human), false);
  assert.equal(g.netGroundClear({ x: 30, z: 0 }), false);
});

test('mouse placement uses canvas/camera projection, cancels without throwing held prop, disposes listeners', t => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = { createElement: () => ({ style: {}, setAttribute() {}, remove() { this.removed = true; } }) };
  t.after(() => { globalThis.window = oldWindow; globalThis.document = oldDocument; });
  const canvas = new EventTarget(); canvas.parentElement = { append() {} };
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, right: 900, bottom: 650, width: 800, height: 600 });
  const camera = new THREE.OrthographicCamera(-6, 6, 4.5, -4.5, .1, 100), scene = new THREE.Scene();
  const s = new CaptureNetSystem(); let enabled = true, humanObserver = true;
  const props = new ThrowableSystem([{ id: 'p', kind: 'BASIN', x: .5, z: 0, roomId: 'r' }]);
  const hu = { faction: 'HUMAN', ...human, hidden: false, canAct: true, heading: 0 };
  props.pickup(hu, clear);
  const throws = new ThrowableView(canvas, scene, camera, props,
    () => [{ ...hu, canAct: s.mode === 'NONE' }], () => 'HUMAN', clear, () => assert.fail('placement must not throw'));
  const view = new CaptureNetView(canvas, scene, camera, s, () => human, () => point, () => enabled, clear, valid,
    () => humanObserver);
  for (const ageMs of [0, C.captureNet.armMs]) {
    s.nets.splice(0, s.nets.length, { ...point, ageMs });
    humanObserver = false; view.sync(); assert.equal(view.root.children[0].visible, false);
    assert.equal(s.nets.length, 1, 'observer visibility must not remove the physical trap');
    humanObserver = true; view.sync(); assert.equal(view.root.children[0].visible, true);
  }
  humanObserver = false; assert(s.trigger(point, point, false, clear) !== null); view.sync();
  assert.equal(view.caught.visible, true, 'DP sees caught effect only after triggering');
  assert.equal(s.rootMs, 5000);
  s.nets.push(...Array.from({ length: 4 }, (_, x) => ({ x, z: 3, ageMs: 1000 })));
  humanObserver = true; view.sync(); assert(view.nets.every(n => n.visible));
  humanObserver = false; view.sync(); assert(view.nets.every(n => !n.visible));
  s.reset(); humanObserver = true;
  const event = (type, button, x, y) => Object.assign(new Event(type, { cancelable: true }), { button, clientX: x, clientY: y });
  for (let angle = 0; angle < 4; angle++) {
    s.reset(); camera.position.set(12, 14, 12).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle * Math.PI / 2);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const p = new THREE.Vector3(point.x, 0, point.z).project(camera), x = 100 + (p.x + 1) * 400, y = 50 + (1 - p.y) * 300;
    assert(view.begin()); canvas.dispatchEvent(event('pointerdown', 0, x, y));
    assert(s.placing); assert(Math.abs(s.pending.x - point.x) < 1e-8);
    assert(Math.abs(s.pending.z) < 1e-8); view.sync(); assert(!view.status.hidden);
    canvas.dispatchEvent(event('pointerup', 0, x, y)); canvas.dispatchEvent(event('click', 0, x, y));
    assert(props.held('HUMAN'));
    canvas.dispatchEvent(event('pointerdown', 2, x, y)); assert.equal(s.mode, 'NONE');
    assert.equal(s.cooldownMs, 0); assert(view.begin());
    window.dispatchEvent(new Event('blur')); assert.equal(s.mode, 'NONE');
  }
  assert(view.begin()); enabled = false; view.sync(); assert.equal(s.mode, 'NONE');
  view.dispose(); view.dispose(); throws.dispose();
  assert.equal(view.status.removed, true); assert.equal(scene.children.length, 0);
  s.reset(); enabled = true; assert(s.beginAim()); canvas.dispatchEvent(event('pointerdown', 0, 500, 350));
  assert.equal(s.mode, 'AIMING', 'disposed pointer handlers no longer act');
});
