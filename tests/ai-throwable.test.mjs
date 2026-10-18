import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { AIThrowableController } from '../src/systems/AIThrowableController.ts';
import { ThrowableSystem } from '../src/systems/ThrowableSystem.ts';

const clear = () => null;
const actor = (faction = 'HUMAN') => ({ faction, x: 0, z: 0, canAct: true, hidden: false });
const target = { x: 4, z: 0 };
function setup(kind = 'BASIN', faction = 'HUMAN', random = () => .5) {
  const system = new ThrowableSystem([{ id: 'one', kind, x: .5, z: 0, roomId: 'r' }]);
  const controller = new AIThrowableController(random), self = actor(faction);
  return { system, controller, self, update: (point = target, difficulty = 'NORMAL', trace = clear) =>
    controller.update(system, self, point, difficulty, trace) };
}

for (const difficulty of ['EASY', 'NORMAL', 'HARD']) for (const faction of ['HUMAN', 'DEEPSEEK']) {
  test(`${difficulty}/${faction}: real pickup, readable windup and physical flight for all prop types`, () => {
    for (const kind of ['VASE', 'BOX', 'BASIN']) {
      const s = setup(kind, faction), profile = C.throwableAI[difficulty];
      assert.deepEqual(s.update(target, difficulty), { started: true, thrown: false });
      assert.equal(s.system.held(faction).id, 'one');
      assert.equal(s.system.items[0].remainingThrows, kind === 'BASIN' ? 3 : 1);
      s.system.advanceTime(profile.windupMs - 1);
      assert.equal(s.update(target, difficulty).thrown, false);
      s.system.advanceTime(1);
      assert.equal(s.update(target, difficulty).thrown, true);
      const item = s.system.items[0]; assert.equal(item.state, 'FLIGHT');
      const error = Math.hypot(item.flight.to.x - target.x, item.flight.to.z - target.z);
      assert(error > 0 && error <= profile.aimErrorRadius);
      assert.equal(item.remainingThrows, kind === 'BASIN' ? 2 : 0);
      const enemy = { ...actor(faction === 'HUMAN' ? 'DEEPSEEK' : 'HUMAN'), ...item.flight.to };
      s.system.advanceFlights(0, [s.self, enemy], clear);
      assert(s.system.advanceFlights(600, [s.self, enemy], clear).includes(enemy.faction));
      assert.equal(s.system.stunRemaining[enemy.faction], 3000, 'no fake hit or alternate stun rule');
    }
  });
}

test('windup holds its snapshot, release refreshes visible position once without leading or homing', () => {
  const s = setup('BOX', 'HUMAN', () => .5);
  s.update(); const initialHeading = s.controller.heading;
  const moved = { x: 3, z: 2 };
  s.system.advanceTime(C.throwableAI.NORMAL.windupMs - 1);
  assert.equal(s.update(moved).thrown, false);
  assert.equal(s.controller.heading, initialHeading, 'no continuous snap tracking during windup');
  s.system.advanceTime(1);
  assert(s.update(moved).thrown);
  assert.notEqual(s.controller.heading, initialHeading);
  const to = s.system.items[0].flight.to;
  assert(Math.abs(to.x - (moved.x - Math.sqrt(.5) * C.throwableAI.NORMAL.aimErrorRadius)) < 1e-8);
  assert(Math.abs(to.z - moved.z) < 1e-8);
  const frozen = { ...to }; moved.x = 10; moved.z = 10;
  s.system.advanceFlights(300, [s.self], clear);
  assert.deepEqual(s.system.items[0].flight.to, frozen, 'released projectile never homes after the player');
});

test('HARD uses full 6-unit physical range for both factions; other difficulties retain their 5.5 gate', () => {
  for (const faction of ['HUMAN', 'DEEPSEEK']) {
    const s = setup('BOX', faction, () => .5), far = { x: 5.9, z: 0 };
    assert.equal(s.update(far, 'NORMAL'), null);
    assert.equal(s.update(far, 'EASY'), null);
    assert(s.update(far, 'HARD').started);
    s.system.advanceTime(C.throwableAI.HARD.windupMs);
    assert(s.update(far, 'HARD').thrown);
    const f = s.system.items[0].flight;
    const distance = Math.hypot(f.to.x - f.from.x, f.to.z - f.from.z);
    assert(distance > 5 && distance <= C.throwables.maxThrowDistance);
    const outside = setup('BOX', faction);
    assert.equal(outside.update({ x: 6.01, z: 0 }, 'HARD'), null);
    assert.equal(outside.system.held(faction).remainingThrows, 1);
  }
});

test('HARD pursuit windup must not collapse a clear 3-unit throw to one body length', () => {
  const s = setup('BASIN', 'HUMAN', () => .5);
  const enemy = { x: 3, z: 0 }, profile = C.throwableAI.HARD;
  assert(s.update(enemy, 'HARD').started);
  const seconds = profile.windupMs / 1000;
  s.self.x += C.player.speed / C.three.pixelsPerUnit * C.human.speedMultiplier * .76 * seconds;
  enemy.x += C.player.speed / C.three.pixelsPerUnit * seconds;
  s.system.advanceTime(profile.windupMs);
  assert(s.update(enemy, 'HARD').thrown);
  const flight = s.system.items[0].flight;
  const requestedDistance = Math.hypot(flight.to.x - flight.from.x, flight.to.z - flight.from.z);
  assert(requestedDistance >= 2, `clear pursuit target is still ${enemy.x - s.self.x} away, but throw travels ${requestedDistance}`);
});

test('HARD intercepts visible straight running, but turning after release dodges the fixed projectile', () => {
 for (const dodge of [false, true]) {
  const s = setup('BASIN', 'HUMAN', () => .5);
  const enemy = { ...actor('DEEPSEEK'), x: 3 };
  assert(s.update(enemy, 'HARD').started);
  const humanSpeed = C.player.speed / C.three.pixelsPerUnit * C.human.speedMultiplier * .76;
  const targetSpeed = C.player.speed / C.three.pixelsPerUnit;
  const dt = C.throwableAI.HARD.windupMs;
  s.self.x += humanSpeed * dt / 1000; enemy.x += targetSpeed * dt / 1000;
  s.system.advanceTime(dt); assert(s.update(enemy, 'HARD').thrown);
  s.system.advanceFlights(0, [s.self, enemy], clear);
  const fixedEndpoint = { ...s.system.items[0].flight.to }; let hit = false;
  for (let time = 0; time < 600; time += 20) {
    enemy[dodge ? 'z' : 'x'] += targetSpeed * .02;
    s.system.advanceTime(20);
    hit ||= s.system.advanceFlights(20, [s.self, enemy], clear).includes('DEEPSEEK');
    if (hit) break;
    if (s.system.items[0].flight) assert.deepEqual(s.system.items[0].flight.to, fixedEndpoint);
  }
  assert.equal(hit, !dodge, 'straight movement can be anticipated, a new turn is not tracked');
  assert.equal(s.system.stunRemaining.DEEPSEEK, dodge ? 0 : 3000);
 }
});

test('lead is HARD-only and capped at 2.4 units for both factions, without enlarging physical range', () => {
 for (const faction of ['HUMAN', 'DEEPSEEK']) for (const difficulty of ['EASY', 'NORMAL', 'HARD']) {
  const s = setup('BOX', faction, () => 0), seen = { x: -3, z: 0 };
  assert(s.update(seen, difficulty).started);
  seen.x = 3; s.system.advanceTime(C.throwableAI[difficulty].windupMs);
  assert(s.update(seen, difficulty).thrown);
  const f = s.system.items[0].flight;
  const lead = f.to.x - seen.x;
  assert(Math.abs(lead - (difficulty === 'HARD' ? 2.4 : 0)) < 1e-8);
  assert(Math.hypot(f.to.x - f.from.x, f.to.z - f.from.z) <= C.throwables.maxThrowDistance);
 }
});

test('HARD loses its motion estimate immediately when sight is lost and must restart windup', () => {
 const s = setup('BASIN'); assert(s.update({ x: 3, z: 0 }, 'HARD').started);
 s.system.advanceTime(650); assert.equal(s.update(null, 'HARD'), null);
 assert.equal(s.system.held('HUMAN').remainingThrows, 3);
 assert(s.update({ x: 4, z: 0 }, 'HARD').started);
 s.system.advanceTime(649); assert.equal(s.update({ x: 4, z: 0 }, 'HARD').thrown, false);
 s.system.advanceTime(1); assert(s.update({ x: 4, z: 0 }, 'HARD').thrown);
 const p = s.system.items[0].flight.to;
 assert(Math.hypot(p.x - 4, p.z) <= C.throwableAI.HARD.aimErrorRadius + 1e-8,
   'reacquired stationary target must not inherit old motion across occlusion');
});

test('manual/busy/hidden/stunned/disabled AI cannot pick up or throw', () => {
  for (const mode of ['busy', 'hidden', 'stunned', 'disabled']) {
    const s = setup();
    if (mode === 'busy') s.self.canAct = false;
    if (mode === 'hidden') s.self.hidden = true;
    if (mode === 'stunned') s.system.stunRemaining.HUMAN = 10;
    if (mode === 'disabled') s.system = new ThrowableSystem(s.system.items, { ...C.throwables, enabled: false });
    assert.equal(s.controller.update(s.system, s.self, target, 'NORMAL', clear), null);
    assert.equal(s.system.held('HUMAN'), undefined); assert.equal(s.controller.heading, undefined);
  }
});

test('lost visibility, range, door obstruction or takeover cancels pending aim without spending durability', () => {
  for (const mode of ['unseen', 'near', 'far', 'wall', 'takeover', 'stun']) {
    const s = setup(); assert(s.update().started); s.system.advanceTime(1000);
    if (mode === 'takeover') s.self.canAct = false;
    if (mode === 'stun') s.system.stunRemaining.HUMAN = 1;
    const point = mode === 'unseen' ? null : mode === 'near' ? { x: 1, z: 0 }
      : mode === 'far' ? { x: 6, z: 0 } : target;
    assert.equal(s.update(point, 'NORMAL', mode === 'wall' ? () => .5 : clear), null);
    assert.equal(s.system.held('HUMAN').remainingThrows, 3);
    assert.equal(s.system.items[0].state, 'HELD');
  }
});

test('AI uses gameplay time, original pickup range/obstruction, and a slower throw interval', () => {
  const s = setup(); s.system.items.push({ ...s.system.items[0], id: 'two', x: .7 });
  s.self.x = -4; assert.equal(s.update(), null); assert.equal(s.system.held('HUMAN'), undefined);
  s.self.x = 0; s.system.advanceTime(300); assert.equal(s.update(target, 'NORMAL', () => .2), null);
  assert.equal(s.system.held('HUMAN'), undefined);
  s.system.advanceTime(300); assert(s.update().started);
  for (let i = 0; i < 10; i++) assert.equal(s.update().thrown, false, 'paused gameplay clock cannot finish aiming');
  s.system.advanceTime(900); assert(s.update().thrown);
  s.system.advanceFlights(600, [s.self], clear);
  s.system.advanceTime(800); assert.equal(s.update(), null); assert(s.system.held('HUMAN'));
  s.system.advanceTime(5699); assert.equal(s.update(), null);
  s.system.advanceTime(1); assert(s.update().started);
  s.system.advanceTime(899); assert.equal(s.update().thrown, false);
  s.system.advanceTime(1); assert(s.update().thrown);
  s.controller.reset(); assert.equal(s.controller.heading, undefined);
});

test('spread samples vary within the configured disc; difficulty never promises a hit rate', () => {
  for (const difficulty of ['EASY', 'NORMAL', 'HARD']) {
    const endpoints = [];
    for (const value of [.01, .2, .5, .75, .99]) {
      const s = setup('BOX', 'HUMAN', () => value);
      s.update(target, difficulty); s.system.advanceTime(C.throwableAI[difficulty].windupMs);
      assert(s.update(target, difficulty).thrown);
      const p = s.system.items[0].flight.to;
      assert(Math.hypot(p.x - 4, p.z) <= C.throwableAI[difficulty].aimErrorRadius + 1e-8);
      endpoints.push(`${p.x},${p.z}`);
    }
    assert.equal(new Set(endpoints).size, 5);
  }
  assert(C.throwableAI.NORMAL.windupMs > C.throwableAI.HARD.windupMs);
  assert(C.throwableAI.EASY.windupMs > C.throwableAI.NORMAL.windupMs);
  assert(C.throwableAI.EASY.intervalMs > C.throwableAI.NORMAL.intervalMs);
  assert(C.throwableAI.EASY.aimErrorRadius > C.throwableAI.NORMAL.aimErrorRadius);
  assert(C.throwableAI.NORMAL.aimErrorRadius > C.throwableAI.HARD.aimErrorRadius);
  assert(C.throwableAI.HARD.intervalMs > C.throwables.stunDurationMs);
});

const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const method = source.match(/  private updateAiThrowables\([\s\S]*?\n  }\r?\n/)[0];
const Host = runInNewContext(stripTypeScriptTypes(`class Host { ${method} }; Host`, { mode: 'transform' }));

test('real host gates opponent AI, current vision and existing stun/root state for both factions', () => {
  for (const faction of ['HUMAN', 'DEEPSEEK']) for (const mode of ['allowed', 'unseen', 'targetStun', 'root', 'manual']) {
    const self = actor(faction), other = { ...actor(faction === 'HUMAN' ? 'DEEPSEEK' : 'HUMAN'), ...target };
    const host = new Host(), s = setup('BASIN', faction);
    Object.assign(host, { throwables: s.system, difficulty: 'NORMAL', throwActors: () => [self, other],
      aiThrowers: { HUMAN: new AIThrowableController(() => .5), DEEPSEEK: new AIThrowableController(() => .5) },
      vision: { get: () => ({ visible: mode !== 'unseen' }) }, captureNet: { rootMs: mode === 'root' ? 5000 : 0 },
      sprint: { state: mode === 'root' && faction === 'DEEPSEEK' ? 'STUNNED' : 'NORMAL' },
      control: { selectedFaction: other.faction }, traceThrow: clear,
      player: { position: faction === 'DEEPSEEK' ? self : other }, human: { position: faction === 'HUMAN' ? self : other },
      showWorldFeedback() {} });
    if (mode === 'targetStun') s.system.stunRemaining[other.faction] = 2000;
    const tick = () => host.updateAiThrowables(faction === 'DEEPSEEK' && mode !== 'manual',
      faction === 'HUMAN' && mode !== 'manual');
    tick(); s.system.advanceTime(900); tick();
    assert.equal(s.system.items[0].state === 'FLIGHT', mode === 'allowed', `${faction}/${mode}`);
  }
});
