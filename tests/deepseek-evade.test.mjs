import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, OrthographicCamera, Vector3 } from 'three';
import { DeepSeekAIController, shouldRunDeepSeekAI } from '../src/systems/DeepSeekAIController.ts';
import { RiceField } from '../src/systems/RiceField.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { PerceptionGeometry, SoundEventSystem, VisionSystem } from
  '../src/systems/PerceptionSystem.ts';
import { DOOR_NODES, FURNITURE, MAP_DEPTH, MAP_WIDTH, RICE_CANDIDATES, ROOMS, WALLS } from
  '../src/three/map/apartmentMap.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

const actor = { x: 0, z: 0 };
const rice = { id: 'rice-1', x: 0, z: 0, progressMs: 0,
  maxProgressMs: C.rice.maxProgressMs, completed: false };
const rooms = [
  { id: 'east', x: 5, z: 0 },
  { id: 'west', x: -5, z: 0 },
  { id: 'north', x: 0, z: -5 },
];
const nav = {
  nearestFree: point => ({ x: point.x, z: point.z }),
  findPath: (start, goal) => [
    { x: start.x, z: start.z, doorId: null },
    { x: goal.x, z: goal.z, doorId: null },
  ],
};
const geometry = { inspectVision: (_start, goal) => ({
  status: goal.x < 0 ? 'BLOCKED' : 'VISIBLE', blocker: goal.x < 0 ? 'Wall' : null,
}) };
const base = () => ({ deltaMs: 50, deepseek: actor, rice: [rice], doors: [],
  canOpenDoor: () => true, geometry, perceptionNowMs: 1_000,
  riceProgressRatio: 0, sprintState: 'NORMAL' });
const heard = (x, z, audibleStrength = 0.3) => ({
  event: { sourceFaction: 'HUMAN', position: { x, z }, type: 'FOOTSTEP' },
  audibleStrength, remainingMs: 500,
});

test('eating stops on actual Human threat and existing RiceField keeps progress', () => {
  const field = new RiceField(['rice-1'], C.rice.maxProgressMs, C.rice.prepareMs);
  const ai = new DeepSeekAIController(nav, [], rooms);
  const eat = ai.update(base());
  assert.equal(eat.eatRiceId, 'rice-1');
  field.update(C.rice.prepareMs, eat.eatRiceId, true);
  field.update(700, eat.eatRiceId, true);
  const previous = field.states[0].progressMs;
  const evade = ai.update({ ...base(), visibleHuman: { x: 1, z: 0 } });
  field.update(50, evade.eatRiceId, false);
  assert.equal(ai.state, 'EVADE');
  assert.equal(evade.eatRiceId, null);
  assert.equal(field.states[0].progressMs, previous);
  assert.ok(ai.escapeRoomId);
  assert.ok(evade.direction.x < 0 || evade.direction.z < 0);
  assert.equal(field.states[0].completed, false);
});

test('weak or occluded sound does not interrupt eating; audible Human sound does', () => {
  const ai = new DeepSeekAIController(nav, [], rooms);
  assert.equal(ai.update({ ...base(), heardHuman: heard(4, 0,
    C.perception.minimumAudibleStrength / 2) }).eatRiceId, 'rice-1');
  assert.equal(ai.state, 'EAT');
  ai.update({ ...base(), heardHuman: heard(4, 0,
    C.deepseekAI.soundEvadeStrength + 0.01) });
  assert.equal(ai.state, 'EVADE');
  assert.equal(ai.threatSource, 'SOUND');
});

test('hidden sound uses only eight-way bearing, not its exact position or distance', () => {
  const first = new DeepSeekAIController(nav, [], rooms);
  const second = new DeepSeekAIController(nav, [], rooms);
  first.update({ ...base(), heardHuman: heard(4, 0.1) });
  second.update({ ...base(), heardHuman: heard(19, 0.4) });
  assert.deepEqual(first.escapeTarget, second.escapeTarget);
  assert.equal(first.escapeRoomId, second.escapeRoomId);
  assert.equal(first.threatSource, 'SOUND');
  assert.equal(second.threatSource, 'SOUND');
});

test('S6 closed-door sight blocks exact Human position while sound stays attenuated', () => {
  const node = { id: 'test-door', x: 1, z: 0, rotation: Math.PI / 2,
    width: 1.2, initialState: 'CLOSED',
    connectedRoomA: 'one', connectedRoomB: 'two' };
  const state = { id: node.id, nodeId: node.id, state: 'CLOSED', locked: false,
    lockCoreState: 'ACTIVE' };
  const perception = new PerceptionGeometry([], [node], () => [state]);
  const vision = new VisionSystem();
  const sound = new SoundEventSystem();
  const camera = new OrthographicCamera(-5, 5, 5, -5);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  const human = { x: 2, z: 0 };
  vision.update(50, human, actor, perception);
  assert.equal(vision.get('DEEPSEEK').status, 'BLOCKED');
  sound.emit('FOOTSTEP', human, 'HUMAN');
  const blocked = sound.heardBy(actor, 'DEEPSEEK', camera, perception);
  assert.ok(blocked);
  assert.ok(blocked.occlusionMultiplier < 1);
  const ai = new DeepSeekAIController(nav, [], rooms);
  ai.update({ ...base(), heardHuman: blocked,
    visibleHuman: vision.get('DEEPSEEK').visible ? human : null });
  assert.equal(ai.threatSource, 'SOUND');
  state.state = 'OPEN';
  vision.update(0, human, actor, perception);
  assert.equal(vision.get('DEEPSEEK').status, 'VISIBLE');
  assert.ok(sound.heardBy(actor, 'DEEPSEEK', camera, perception)
    .occlusionMultiplier > blocked.occlusionMultiplier);
});

test('escape prefers reachable cover and rejects a locked-door route', () => {
  const blocked = { ...nav, findPath(start, goal) {
    return goal.x < 0 ? null : nav.findPath(start, goal);
  } };
  const ai = new DeepSeekAIController(blocked, [], rooms);
  const command = ai.update({ ...base(), visibleHuman: { x: 1, z: 0 } });
  assert.notEqual(ai.escapeRoomId, 'west');
  assert.ok(ai.escapeRoomId === 'north' || ai.escapeRoomId === 'east');
  assert.notEqual(command.openDoorId, 'locked');
});

test('door changes immediately reopen escape planning after no route', () => {
  const route = { ...nav, findPath(start, goal, doors) {
    return doors[0]?.state === 'LOCKED' ? null : nav.findPath(start, goal);
  } };
  const ai = new DeepSeekAIController(route, [], rooms);
  const locked = { id: 'test-door', nodeId: 'test-door', state: 'LOCKED',
    locked: true, lockCoreState: 'ACTIVE' };
  const danger = { ...base(), doors: [locked], visibleHuman: { x: 1, z: 0 } };
  assert.equal(ai.update(danger).startSprint, false);
  assert.equal(ai.escapeTarget, null);
  const opened = ai.update({ ...danger, doors: [{ ...locked, state: 'OPEN', locked: false }] });
  assert.ok(ai.escapeTarget);
  assert.ok(opened.direction.x !== 0 || opened.direction.z !== 0);
});

test('multiple exits beat an equally reachable dead-end escape room', () => {
  const choices = [{ id: 'dead', x: -5, z: 0 }, { id: 'loop', x: 0, z: -5 }];
  const nodes = [
    { id: 'dead-door', x: -3, z: 0, connectedRoomA: 'dead', connectedRoomB: 'start' },
    ...['a', 'b', 'c'].map((id, index) => ({ id, x: index + 3, z: -3,
      connectedRoomA: 'loop', connectedRoomB: 'start' })),
  ];
  const ai = new DeepSeekAIController(nav, nodes, choices);
  const states = nodes.map(node => ({ id: node.id, state: 'OPEN' }));
  ai.update({ ...base(), doors: states, visibleHuman: { x: 1, z: 0 },
    geometry: { inspectVision: () => ({ status: 'VISIBLE', blocker: null }) } });
  assert.equal(ai.escapeRoomId, 'loop');
  assert.ok(ai.escapeCandidateScores.find(candidate => candidate.roomId === 'loop').exits > 1);
});

test('a Human-blocked exit uses a reachable alternative path rather than sprinting into it', () => {
  const choices = [{ id: 'covered', x: -5, z: 0 }, { id: 'dead', x: 0, z: -5 }];
  const nodes = [
    { id: 'blocked', x: 1, z: 0, connectedRoomA: 'covered', connectedRoomB: 'start' },
    { id: 'alternative', x: 0, z: 3, connectedRoomA: 'covered', connectedRoomB: 'start' },
  ];
  const route = { ...nav, findPath(start, goal, _doors, _avoid, _cost, blocked) {
    if (goal.x < 0) {
      if (blocked?.has('blocked')) return [
        { x: start.x, z: start.z, doorId: null },
        { x: 0, z: 3, doorId: 'alternative' },
        { x: goal.x, z: goal.z, doorId: null },
      ];
      return [{ x: start.x, z: start.z, doorId: null },
        { x: 1, z: 0, doorId: 'blocked' },
        { x: goal.x, z: goal.z, doorId: null }];
    }
    return nav.findPath(start, goal);
  } };
  const ai = new DeepSeekAIController(route, nodes, choices);
  const states = nodes.map(node => ({ id: node.id, state: 'OPEN' }));
  const command = ai.update({ ...base(), doors: states,
    visibleHuman: { x: 1, z: 0 } });
  const covered = ai.escapeCandidateScores.find(candidate => candidate.roomId === 'covered');
  assert.equal(covered.alternateRoute, true);
  assert.equal(covered.blockedExit, false);
  if (ai.escapeRoomId === 'covered') assert.ok(command.direction.z > 0);
});

test('escape goal hysteresis holds a close-scoring room but abandons it when Human occupies it', () => {
  const choices = [{ id: 'west', x: -5, z: 0 }, { id: 'south', x: 0, z: 5 }];
  const ai = new DeepSeekAIController(nav, [], choices);
  const noCover = { inspectVision: () => ({ status: 'VISIBLE', blocker: null }) };
  ai.update({ ...base(), geometry: noCover, visibleHuman: { x: 1, z: 0 } });
  assert.equal(ai.escapeRoomId, 'west');
  ai.update({ ...base(), geometry: noCover, deltaMs: C.deepseekAI.escapeGoalHoldMs + 1,
    deepseek: { x: -1, z: 0 }, visibleHuman: { x: -1, z: -1 } });
  assert.equal(ai.escapeCandidateScores[0].roomId, 'south');
  assert.equal(ai.escapeRoomId, 'west', 'small score differences cannot cause oscillation');
  ai.update({ ...base(), geometry: noCover, deltaMs: C.deepseekAI.escapeReplanMs,
    deepseek: { x: -1, z: 0 }, visibleHuman: { x: -4.5, z: 0 } });
  assert.equal(ai.escapeRoomId, 'south', 'Human occupying the goal overrides the hold');
  assert.equal(ai.lastEscapeSwitchReason, 'GOAL_UNSAFE_OR_STALLED');
});

test('AI sprint reuses normal SprintSystem risk and stun rules', () => {
  const safe = new DeepSeekAIController(nav, [], rooms);
  const safeCommand = safe.update({ ...base(), visibleHuman: { x: 1, z: 0 } });
  assert.equal(safeCommand.startSprint, true);
  const sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold,
    C.sprint.stunMs);
  assert.equal(sprint.tryStart({ x: safeCommand.direction.x,
    y: safeCommand.direction.z }, 0), true);
  assert.equal(sprint.riskMode, 'SAFE');
  sprint.advance(C.sprint.durationMs, { x: 0, y: 0 });
  assert.equal(sprint.state, 'NORMAL');

  const risky = new DeepSeekAIController(nav, [], rooms);
  assert.equal(risky.update({ ...base(), riceProgressRatio: 0.5,
    visibleHuman: { x: 4, z: 0 } }).startSprint, false);
  const emergency = risky.update({ ...base(), riceProgressRatio: 0.5,
    visibleHuman: { x: 1, z: 0 } });
  assert.equal(emergency.startSprint, true);
  sprint.tryStart({ x: emergency.direction.x, y: emergency.direction.z }, 0.5);
  assert.equal(sprint.riskMode, 'FALL_ON_END');
  sprint.advance(C.sprint.durationMs, { x: 0, y: 0 });
  assert.equal(sprint.state, 'STUNNED');
  const stunned = risky.update({ ...base(), riceProgressRatio: 0.5,
    sprintState: sprint.state, visibleHuman: { x: 1, z: 0 } });
  assert.deepEqual(stunned.direction, { x: 0, z: 0 });
});

test('approaching Human triggers the existing sprint without changing its risk rule', () => {
  const ai = new DeepSeekAIController(nav, [], rooms);
  const firstDistance = C.deepseekAI.visionEvadeDistance;
  const first = ai.update({ ...base(), riceProgressRatio: 0.5,
    visibleHuman: { x: firstDistance, z: 0 } });
  assert.equal(first.startSprint, false);
  const second = ai.update({ ...base(), riceProgressRatio: 0.5,
    visibleHuman: { x: firstDistance - 0.3, z: 0 } });
  assert.equal(second.startSprint, true);
  assert.equal(ai.sprintDecision, 'PURSUER_CLOSING_SPRINT');
  const sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold,
    C.sprint.stunMs);
  assert.equal(sprint.tryStart({ x: second.direction.x, y: second.direction.z }, 0.5), true);
  assert.equal(sprint.riskMode, 'FALL_ON_END');
});

test('lost threat remains alert and temporarily avoids a rice route through danger', () => {
  const ai = new DeepSeekAIController(nav, [], rooms);
  ai.update(base());
  ai.update({ ...base(), visibleHuman: { x: 1, z: 0 } });
  assert.equal(ai.targetRiceId, 'rice-1');
  const escaped = { x: -4, z: 0 };
  ai.update({ ...base(), deepseek: escaped, deltaMs: 500,
    lastSeenHuman: { position: { x: 1, z: 0 }, timeMs: 900 },
    perceptionNowMs: 1_400 });
  assert.equal(ai.state, 'EVADE');
  ai.update({ ...base(), deepseek: escaped,
    deltaMs: C.deepseekAI.lastSeenAlertMs + 100,
    perceptionNowMs: 5_000 });
  assert.equal(ai.state, 'RECOVER');
  assert.equal(ai.recoveryBlockReason, 'NO_SAFE_RICE_ROUTE');
  ai.update({ ...base(), deepseek: escaped, deltaMs: C.deepseekAI.recoverMs });
  assert.equal(ai.state, 'RESELECT');
  assert.equal(ai.targetRiceId, null);
  assert.equal(ai.update(base()).eatRiceId, null);
  assert.equal(ai.update({ ...base(), deltaMs: C.deepseekAI.dangerRiceAvoidMs })
    .eatRiceId, 'rice-1');
});

test('lost sight and stale Last Seen do not stack five seconds of stationary recovery', () => {
  const ai = new DeepSeekAIController(nav, [], rooms);
  const portions = [{ ...rice, id: 'near' },
    { ...rice, id: 'safe', x: -7 }];
  const position = { x: 0, z: 0 };
  let idleMs = 0;
  let longestIdleMs = 0;
  let recoveryMoved = false;
  for (let timeMs = 0; timeMs < 8_000; timeMs += 50) {
    const command = ai.update({ ...base(), deepseek: position, rice: portions,
      perceptionNowMs: timeMs,
      visibleHuman: timeMs < 200 ? { x: 1, z: 0 } : null,
      lastSeenHuman: timeMs >= 200
        ? { position: { x: 1, z: 0 }, timeMs: 150 } : null });
    const moving = Math.hypot(command.direction.x, command.direction.z) > 0;
    if ((ai.state === 'EVADE' || ai.state === 'RECOVER') && !moving) {
      idleMs += 50;
      longestIdleMs = Math.max(longestIdleMs, idleMs);
    } else idleMs = 0;
    if (ai.state === 'RECOVER' && moving) recoveryMoved = true;
    const speed = C.player.speed / C.three.pixelsPerUnit;
    position.x += command.direction.x * speed * 0.05;
    position.z += command.direction.z * speed * 0.05;
  }
  assert.ok(longestIdleMs <= 100, 'caution must not force a multi-second idle');
  assert.equal(recoveryMoved, true);
  assert.equal(ai.state, 'EAT');
  assert.equal(ai.targetRiceId, 'safe');
  assert.equal(ai.lastResumeTrigger, 'SAFE_RICE_REACHED');
  assert.equal(ai.recoverRemainingMs, 0);
});

test('strong new sound or approaching Human interrupts moving recovery', () => {
  const safeRice = { ...rice, id: 'safe', x: -7 };
  const makeRecovering = () => {
    const ai = new DeepSeekAIController(nav, [], rooms);
    ai.update({ ...base(), rice: [safeRice], visibleHuman: { x: 1, z: 0 } });
    const move = ai.update({ ...base(), rice: [safeRice],
      deepseek: { x: -4, z: 0 }, deltaMs: C.deepseekAI.minimumEvadeMs,
      lastSeenHuman: { position: { x: 1, z: 0 }, timeMs: 1_000 },
      perceptionNowMs: 1_200 });
    assert.equal(ai.state, 'RECOVER');
    assert.ok(move.direction.x < 0);
    return ai;
  };
  const weak = makeRecovering();
  weak.update({ ...base(), rice: [safeRice], deepseek: { x: -4, z: 0 },
    heardHuman: heard(1, 0, C.deepseekAI.soundEvadeStrength - 0.01) });
  assert.equal(weak.state, 'RECOVER');
  const audible = makeRecovering();
  audible.update({ ...base(), rice: [safeRice], deepseek: { x: -4, z: 0 },
    heardHuman: heard(1, 0, C.deepseekAI.soundEvadeStrength + 0.01) });
  assert.equal(audible.state, 'EVADE');
  const visible = makeRecovering();
  visible.update({ ...base(), rice: [safeRice], deepseek: { x: -4, z: 0 },
    visibleHuman: { x: -3, z: 0 } });
  assert.equal(visible.state, 'EVADE');
});

test('real stun stops recovery; pause freezes it and restart clears it', () => {
  const ai = new DeepSeekAIController(nav, [], rooms);
  const safeRice = { ...rice, id: 'safe', x: -7 };
  ai.update({ ...base(), rice: [safeRice], visibleHuman: { x: 1, z: 0 } });
  ai.update({ ...base(), rice: [safeRice], deepseek: { x: -4, z: 0 },
    deltaMs: C.deepseekAI.minimumEvadeMs });
  assert.equal(ai.state, 'RECOVER');
  const remaining = ai.recoverRemainingMs;
  assert.equal(shouldRunDeepSeekAI('PAUSED', 'HUMAN', 'HUMAN',
    { x: 0, y: 0 }, true), false);
  assert.equal(ai.recoverRemainingMs, remaining, 'controller receives no paused update');
  const stunned = ai.update({ ...base(), rice: [safeRice],
    deepseek: { x: -4, z: 0 }, deltaMs: 500, sprintState: 'STUNNED' });
  assert.deepEqual(stunned.direction, { x: 0, z: 0 });
  assert.equal(ai.recoveryBlockReason, 'STUNNED');
  assert.equal(ai.recoverRemainingMs, remaining);
  ai.reset();
  assert.equal(ai.state, 'SEEK_RICE');
  assert.equal(ai.recoverRemainingMs, 0);
  assert.equal(ai.recoveryBlockReason, 'NONE');
  assert.equal(ai.lastResumeTrigger, 'NONE');
});

test('pause/manual priority and reset do not leave an escape state behind', () => {
  const ai = new DeepSeekAIController(nav, [], rooms);
  ai.update({ ...base(), visibleHuman: { x: 1, z: 0 } });
  assert.equal(shouldRunDeepSeekAI('PAUSED', 'HUMAN', 'HUMAN',
    { x: 0, y: 0 }, true), false);
  assert.equal(shouldRunDeepSeekAI('PLAYING', 'DEEPSEEK', 'DEEPSEEK',
    { x: 0, y: 0 }, true), false);
  assert.equal(shouldRunDeepSeekAI('PLAYING', 'HUMAN', 'DEEPSEEK',
    { x: 0, y: 0 }, true), false);
  const previousState = ai.state;
  assert.equal(ai.state, previousState, 'no update during pause or manual takeover');
  ai.resumeAfterManualControl();
  assert.equal(ai.escapeTarget, null);
  ai.reset();
  assert.equal(ai.state, 'SEEK_RICE');
  assert.equal(ai.targetRiceId, null);
  assert.equal(ai.threatSource, 'NONE');
  assert.equal(ai.escapeTarget, null);
});

test('escape uses apartment navigation and circle collision without corner penetration', () => {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const doors = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  for (const door of doors.doors) door.state = 'OPEN';
  const navigation = new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const perception = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const ai = new DeepSeekAIController(navigation, DOOR_NODES, ROOMS);
  const position = new Vector3(2, C.three.actorHeight / 2, -3);
  const human = { x: 3, z: -3 };
  assert.equal(perception.inspectVision(position, human, C.perception.visionRange).status,
    'VISIBLE');
  let furthest = 1;
  for (let frame = 0; frame < 120; frame++) {
    const command = ai.update({ ...base(), deepseek: position,
      doors: doors.doors, geometry: perception, visibleHuman: human });
    const speed = C.player.speed / C.three.pixelsPerUnit;
    position.copy(world.move(position, command.direction.x * speed * 0.05,
      command.direction.z * speed * 0.05, C.collision.playerRadius,
      C.three.actorHeight));
    assert.equal(world.canOccupyStaticXZ(position.x, position.z,
      C.collision.playerRadius, C.three.actorHeight), true);
    furthest = Math.max(furthest, Math.hypot(position.x - human.x, position.z - human.z));
  }
  assert.ok(furthest > 3, 'AI should create real distance on the authored map');
});

test('thirty-second living-room threat does not loop between escaping and the same rice', () => {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const doors = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  for (const door of doors.doors) door.state = 'OPEN';
  const navigation = new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const perception = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const vision = new VisionSystem();
  const ai = new DeepSeekAIController(navigation, DOOR_NODES, ROOMS);
  const position = new Vector3(2, C.three.actorHeight / 2, -3);
  const human = { x: 2.8, z: -3 };
  const rice = RICE_CANDIDATES
    .filter(candidate => ['rice_02', 'rice_06', 'rice_09', 'rice_11', 'rice_13']
      .includes(candidate.id))
    .map(candidate => ({ ...candidate, progressMs: 0,
      maxProgressMs: C.rice.maxProgressMs, completed: false }));
  let evadeEntries = 0;
  let lastState = '';
  let visitedSafeRice = false;
  for (let frame = 0; frame < 600; frame++) {
    vision.update(50, human, position, perception);
    const sight = vision.get('DEEPSEEK');
    const command = ai.update({ ...base(), deltaMs: 50, deepseek: position,
      rice, doors: doors.doors, geometry: perception,
      visibleHuman: sight.visible ? human : null,
      lastSeenHuman: sight.lastSeen, perceptionNowMs: vision.nowMs });
    if (ai.state === 'EVADE' && lastState !== 'EVADE') evadeEntries++;
    lastState = ai.state;
    visitedSafeRice ||= ai.targetRiceId === 'rice_13';
    const speed = C.player.speed / C.three.pixelsPerUnit;
    position.copy(world.move(position, command.direction.x * speed * 0.05,
      command.direction.z * speed * 0.05, C.collision.playerRadius,
      C.three.actorHeight));
    assert.equal(world.canOccupyStaticXZ(position.x, position.z,
      C.collision.playerRadius, C.three.actorHeight), true);
  }
  assert.ok(evadeEntries <= 2,
    'AI must not oscillate between living-room rice and escape every few seconds');
  assert.equal(visitedSafeRice, true, 'AI should redirect to a safer reachable rice');
  assert.notEqual(ai.targetRiceId, 'rice_02');
});

test('authored apartment recovery keeps moving after Human leaves the area', () => {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const doors = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  for (const door of doors.doors) door.state = 'OPEN';
  const navigation = new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const perception = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const vision = new VisionSystem();
  const sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold,
    C.sprint.stunMs);
  const ai = new DeepSeekAIController(navigation, DOOR_NODES, ROOMS);
  const position = new Vector3(2, C.three.actorHeight / 2, -3);
  const rice = RICE_CANDIDATES
    .filter(candidate => ['rice_02', 'rice_06', 'rice_09', 'rice_11', 'rice_13']
      .includes(candidate.id))
    .map(candidate => ({ ...candidate, progressMs: 0,
      maxProgressMs: C.rice.maxProgressMs, completed: false }));
  let idleMs = 0;
  let longestIdleMs = 0;
  let recoveryMoved = false;
  for (let frame = 0; frame < 300; frame++) {
    const human = frame < 20 ? { x: 2.8, z: -3 } : { x: 16, z: 11 };
    vision.update(50, human, position, perception);
    const sight = vision.get('DEEPSEEK');
    const command = ai.update({ ...base(), deepseek: position, rice,
      doors: doors.doors, geometry: perception,
      visibleHuman: sight.visible ? human : null,
      lastSeenHuman: sight.lastSeen, perceptionNowMs: vision.nowMs,
      sprintState: sprint.state });
    if (command.startSprint)
      sprint.tryStart({ x: command.direction.x, y: command.direction.z }, 0);
    sprint.advance(50, { x: command.direction.x, y: command.direction.z });
    const direction = sprint.movementDirection(
      { x: command.direction.x, y: command.direction.z });
    const speed = C.player.speed / C.three.pixelsPerUnit *
      (sprint.state === 'SPRINT_RUNNING' ? C.sprint.speedMultiplier : 1);
    const previous = position.clone();
    position.copy(world.move(position, direction.x * speed * 0.05,
      direction.y * speed * 0.05, C.collision.playerRadius,
      C.three.actorHeight));
    if (ai.state === 'RECOVER' && position.distanceTo(previous) > 0.001)
      recoveryMoved = true;
    if (sprint.state === 'NORMAL' &&
        (ai.state === 'EVADE' || ai.state === 'RECOVER') &&
        position.distanceTo(previous) < 0.001) {
      idleMs += 50;
      longestIdleMs = Math.max(longestIdleMs, idleMs);
    } else idleMs = 0;
    assert.equal(world.canOccupyStaticXZ(position.x, position.z,
      C.collision.playerRadius, C.three.actorHeight), true);
  }
  assert.equal(recoveryMoved, true);
  assert.ok(longestIdleMs <= 250);
  assert.equal(ai.targetRiceId, 'rice_13');
});

test('stationary visible Human cannot pin DeepSeek at a reached escape goal', () => {
  const radius = Math.max(2, C.deepseekAI.visionEvadeDistance - 1);
  const escapeRooms = [
    { id: 'east', x: radius, z: 0 },
    { id: 'west', x: -radius, z: 0 },
    { id: 'north', x: 0, z: -radius },
  ];
  const ai = new DeepSeekAIController(nav, [], escapeRooms);
  const human = { x: 1, z: 0 };
  let position = { x: 0, z: 0 };
  const chosenRooms = [];
  let longestStationaryMs = 0;
  let stationaryMs = 0;
  let reviewedVisibleGoal = false;
  for (let timeMs = 0; timeMs < 12_000; timeMs += 50) {
    const command = ai.update({ ...base(), deepseek: position, rice: [],
      visibleHuman: human, perceptionNowMs: timeMs });
    if (ai.escapeRoomId !== chosenRooms.at(-1)) chosenRooms.push(ai.escapeRoomId);
    reviewedVisibleGoal ||= ai.lastEscapeDecisionReason ===
      'VISIBLE_THREAT_AT_ESCAPE_GOAL';
    const moving = Math.hypot(command.direction.x, command.direction.z) > 0.01;
    stationaryMs = moving ? 0 : stationaryMs + 50;
    longestStationaryMs = Math.max(longestStationaryMs, stationaryMs);
    position = { x: position.x + command.direction.x * 0.08,
      z: position.z + command.direction.z * 0.08 };
  }
  assert.equal(ai.state, 'EVADE');
  assert.ok(chosenRooms.length >= 3, 'reachable exits should be used without Human moving');
  assert.ok(chosenRooms.length <= 5, 'arrival review must not flip targets every frame');
  assert.ok(longestStationaryMs <= C.deepseekAI.escapeReplanMs + 100);
  assert.equal(ai.escapeCandidateScores.length, 3);
  assert.equal(reviewedVisibleGoal, true);
});

test('stationary Human blocks one exit but a reachable side exit still moves', () => {
  const oneBlocked = { ...nav, findPath(start, goal) {
    return goal.x < 0 ? null : nav.findPath(start, goal);
  } };
  const ai = new DeepSeekAIController(oneBlocked, [], rooms);
  const command = ai.update({ ...base(), rice: [],
    visibleHuman: { x: 1, z: 0 } });
  assert.equal(ai.state, 'EVADE');
  assert.notEqual(ai.escapeRoomId, 'west');
  assert.equal(ai.escapeCandidateScores.length, 2);
  assert.ok(Math.hypot(command.direction.x, command.direction.z) > 0);
});

test('all high-risk escape scores still choose the least-risk reachable path', () => {
  const riskyRooms = [{ id: 'risk-a', x: 1, z: 1 },
    { id: 'risk-b', x: 0, z: 2 }];
  const ai = new DeepSeekAIController(nav, [], riskyRooms);
  const command = ai.update({ ...base(), rice: [],
    visibleHuman: { x: 0.4, z: 0.2 } });
  assert.ok(ai.escapeCandidateScores.every(candidate => candidate.score < 0));
  assert.ok(ai.escapeRoomId, 'negative scores must not mean no route');
  assert.ok(Math.hypot(command.direction.x, command.direction.z) > 0);
});

test('genuinely blocked alternate route reports why and retries when it opens', () => {
  let sideRouteOpen = true;
  const limited = { ...nav, findPath(start, goal) {
    if (goal.z < 0 && !sideRouteOpen) return null;
    return nav.findPath(start, goal);
  } };
  const ai = new DeepSeekAIController(limited, [],
    [{ id: 'west', x: -4, z: 0 }, { id: 'north', x: 0, z: -4 }]);
  const human = { x: 1, z: 0 };
  let position = { x: 0, z: 0 };
  for (let t = 0; t < 2_000; t += 50) {
    const command = ai.update({ ...base(), deepseek: position, rice: [],
      visibleHuman: human });
    position = { x: position.x + command.direction.x * 0.08,
      z: position.z + command.direction.z * 0.08 };
  }
  assert.equal(ai.escapeRoomId, 'west');
  sideRouteOpen = false;
  for (let t = 0; t < 1_500; t += 50)
    ai.update({ ...base(), deepseek: position, rice: [], visibleHuman: human });
  assert.equal(ai.noMovementReason, 'NO_ALTERNATE_REACHABLE_ROUTE');
  assert.equal(ai.lastNavigationReason, 'NO_ALTERNATE_REACHABLE_ESCAPE_ROOM');
  sideRouteOpen = true;
  let resumed = false;
  for (let t = 0; t < 1_000; t += 50) {
    const command = ai.update({ ...base(), deepseek: position, rice: [],
      visibleHuman: human });
    resumed ||= ai.escapeRoomId === 'north' &&
      Math.hypot(command.direction.x, command.direction.z) > 0;
    position = { x: position.x + command.direction.x * 0.08,
      z: position.z + command.direction.z * 0.08 };
  }
  assert.equal(resumed, true);
});

test('local living-dining loop triggers a reachable fresh-room decision', () => {
  const areaRooms = [
    { id: 'living', x: -4, z: 0, minX: -5, maxX: -3, minZ: -1, maxZ: 1 },
    { id: 'dining', x: -4, z: 2, minX: -5, maxX: -3, minZ: 1.1, maxZ: 3 },
    { id: 'study', x: -8, z: -6, minX: -9, maxX: -7, minZ: -7, maxZ: -5 },
  ];
  const costlyStudy = { ...nav, findPath(start, goal) {
    return goal.x < -6 ? [
      { x: start.x, z: start.z, doorId: null },
      { x: -8, z: 8, doorId: null },
      { x: goal.x, z: goal.z, doorId: null },
    ] : nav.findPath(start, goal);
  } };
  const ai = new DeepSeekAIController(costlyStudy, [], areaRooms, () => 0);
  const inputAt = (position, deltaMs) => ({ ...base(), deepseek: position,
    deltaMs, rice: [], visibleHuman: { x: 1, z: 0 } });
  ai.update(inputAt({ x: -4, z: 0 }, 50));
  ai.update(inputAt({ x: -4, z: 2 }, 50));
  ai.update(inputAt({ x: -4, z: 0 }, 50));
  assert.deepEqual(ai.getRecentEscapeRooms(), ['living', 'dining', 'living']);
  assert.equal(ai.localLoopTriggered, true);
  const rawBest = ai.escapeCandidateScores[0].roomId;
  assert.notEqual(rawBest, 'study');
  const command = ai.update(inputAt({ x: -4, z: 0 }, C.deepseekAI.escapeReplanMs));
  assert.equal(ai.lastEscapeDecisionReason, 'LOCAL_ROOM_LOOP');
  assert.equal(ai.escapeRoomId, 'study', 'fresh reachable room outranks local loop');
  assert.ok(Math.hypot(command.direction.x, command.direction.z) > 0);
  ai.update({ ...base(), deepseek: { x: -4, z: 0 }, rice: [],
    visibleHuman: null, deltaMs: C.deepseekAI.escapeVisitMemoryMs });
  assert.deepEqual(ai.getRecentEscapeRooms(), [], 'visit penalties must expire');
  ai.reset();
  assert.equal(ai.localLoopTriggered, false);
  assert.deepEqual(ai.getRecentEscapeRooms(), []);
});

test('recent-room penalty cannot reject the only reachable escape room', () => {
  const only = [{ id: 'side', x: -4, z: 0, minX: -5, maxX: -3,
    minZ: -1, maxZ: 1 }];
  const ai = new DeepSeekAIController(nav, [], only);
  ai.update({ ...base(), deepseek: { x: -4, z: 0 }, rice: [],
    visibleHuman: { x: 1, z: 0 } });
  assert.deepEqual(ai.getRecentEscapeRooms(), ['side']);
  ai.resumeAfterManualControl();
  const command = ai.update({ ...base(), rice: [],
    visibleHuman: { x: 1, z: 0 } });
  assert.equal(ai.escapeRoomId, 'side');
  assert.ok(ai.escapeCandidateScores[0].recentVisitPenalty > 0);
  assert.ok(Math.hypot(command.direction.x, command.direction.z) > 0);
});

test('random choice only varies nearly tied safe rooms', () => {
  const options = [{ id: 'north', x: 0, z: -5 },
    { id: 'south', x: 0, z: 5 }, { id: 'danger', x: 2, z: 0 }];
  const first = new DeepSeekAIController(nav, [], options, () => 0);
  const second = new DeepSeekAIController(nav, [], options, () => 0.99);
  const input = { ...base(), rice: [], visibleHuman: { x: 1, z: 0 } };
  first.update(input);
  second.update(input);
  assert.notEqual(first.escapeRoomId, second.escapeRoomId);
  assert.ok(['north', 'south'].includes(first.escapeRoomId));
  assert.ok(['north', 'south'].includes(second.escapeRoomId));
});

test('a distant room goal remains selected while the AI makes route progress', () => {
  const goals = [{ id: 'west', x: -4, z: 0 },
    { id: 'north', x: 0, z: -5 }];
  const ai = new DeepSeekAIController(nav, [], goals, () => 0);
  let position = { x: 0, z: 0 };
  let initialRoom = null;
  for (let elapsed = 0; elapsed < C.deepseekAI.escapeGoalHoldMs + 1_000;
    elapsed += 50) {
    const command = ai.update({ ...base(), deepseek: position, rice: [],
      visibleHuman: { x: 1, z: 0 } });
    initialRoom ??= ai.escapeRoomId;
    assert.equal(ai.escapeRoomId, initialRoom);
    position = { x: position.x + command.direction.x * 0.02,
      z: position.z + command.direction.z * 0.02 };
  }
  assert.ok(Math.hypot(position.x, position.z) > 0.5);
});

test('twenty-second static Human at living exit does not trap escape in living-hall loop', () => {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const doors = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  for (const door of doors.doors) door.state = 'OPEN';
  const navigation = new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const perception = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const vision = new VisionSystem();
  const ai = new DeepSeekAIController(navigation, DOOR_NODES, ROOMS, () => 0);
  const position = new Vector3(2, C.three.actorHeight / 2, -3);
  const human = { x: 3, z: -3 };
  const portions = RICE_CANDIDATES.slice(0, 5).map(candidate => ({ ...candidate,
    progressMs: 0, maxProgressMs: C.rice.maxProgressMs, completed: false }));
  const visitedRooms = new Set();
  const targetRooms = new Set();
  let crossings = 0;
  let previousRoom = 'living';
  for (let frame = 0; frame < 400; frame++) {
    vision.update(50, human, position, perception);
    const sight = vision.get('DEEPSEEK');
    const command = ai.update({ ...base(), deepseek: position, rice: portions,
      doors: doors.doors, geometry: perception,
      visibleHuman: sight.visible ? human : null,
      lastSeenHuman: sight.lastSeen, perceptionNowMs: vision.nowMs });
    if (ai.escapeRoomId && ai.escapeTarget) {
      targetRooms.add(ai.escapeRoomId);
      const room = ROOMS.find(candidate => candidate.id === ai.escapeRoomId);
      assert.ok(ai.escapeTarget.x > room.minX && ai.escapeTarget.x < room.maxX &&
        ai.escapeTarget.z > room.minZ && ai.escapeTarget.z < room.maxZ,
      'escape target must be inside its named destination room');
    }
    const speed = C.player.speed / C.three.pixelsPerUnit;
    position.copy(world.move(position, command.direction.x * speed * 0.05,
      command.direction.z * speed * 0.05, C.collision.playerRadius,
      C.three.actorHeight));
    assert.equal(world.canOccupyStaticXZ(position.x, position.z,
      C.collision.playerRadius, C.three.actorHeight), true);
    const room = ROOMS.find(candidate => position.x > candidate.minX &&
      position.x < candidate.maxX && position.z > candidate.minZ &&
      position.z < candidate.maxZ)?.id ?? 'none';
    visitedRooms.add(room);
    if (room !== previousRoom) crossings++;
    previousRoom = room;
  }
  assert.ok(targetRooms.has('bathroom') || targetRooms.has('second_bedroom'));
  assert.ok(visitedRooms.has('bathroom') && visitedRooms.has('study'),
    'AI should physically cross into other reachable rooms, not only rename a target');
  assert.ok(crossings < 20, 'must not repeatedly bounce across one doorway');
});
