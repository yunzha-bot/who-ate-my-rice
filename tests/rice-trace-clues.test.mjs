import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { PerceptionGeometry } from '../src/systems/PerceptionSystem.ts';
import { RiceTraceClueMemory, selectVisibleTraces, traceIsValid,
  traceRemainingMs } from '../src/systems/RiceTraceClues.ts';
import { CLUE_MEMORY_MAX } from '../src/systems/HumanSearchTuning.ts';

// S7C-2 米痕感知适配（图层 A → B）与有限线索记忆（图层 C）。
// 这一层的红线：只有「亲自看见、仍在有效期、没被墙或非 OPEN 门挡住」的米痕
// 才能变成线索；线索寿命不得超过原实体；这里不存在任何对手实时坐标。

const trace = (id, x, z, createdAt = 0, lifetimeMs = GAME_CONFIG.perception.traceLifetimeMs,
  heading = 0) => ({ id, position: { x, z }, heading, createdAt, lifetimeMs, strength: 1 });

// 一堵竖墙（x = 5，沿 z 从 -5 到 5）与一扇位于 (2, 0) 的门叶。
const wall = { id: 'w', x: 5, z: 0, width: 0.18, depth: 10, height: 1.5, kind: 'wall' };
const doorNode = { id: 'd', x: 2, z: 0, rotation: Math.PI / 2, width: 1.2,
  initialState: 'CLOSED', connectedRoomA: 'a', connectedRoomB: 'b' };

function geometryWith(doorState) {
  return new PerceptionGeometry([wall], [doorNode], () => [{ id: 'd', state: doorState,
    lockCoreState: 'ACTIVE' }]);
}

const vision = (geometry, range = GAME_CONFIG.perception.visionRange) =>
  (from, to, maxRange) => geometry.inspectVision(from, to,
    Number.isFinite(maxRange) ? maxRange : range).status === 'VISIBLE';

test('only traces inside the real vision range become layer B', () => {
  const geometry = new PerceptionGeometry([], [], () => []);
  const far = trace('far', 40, 0);
  const near = trace('near', 3, 0);
  const visible = selectVisibleTraces({ observer: { x: 0, z: 0 },
    traces: [far, near], nowMs: 0, visionRange: GAME_CONFIG.perception.visionRange,
    visible: vision(geometry) });
  assert.deepEqual(visible.map(item => item.id), ['near'],
    '视觉距离之外的米痕不能被「发现」');
  // 边界包含：正好等于视距仍算看得见。
  const edge = trace('edge', GAME_CONFIG.perception.visionRange, 0);
  assert.deepEqual(selectVisibleTraces({ observer: { x: 0, z: 0 }, traces: [edge],
    nowMs: 0, visionRange: GAME_CONFIG.perception.visionRange,
    visible: vision(geometry) }).map(item => item.id), ['edge']);
});

test('walls and non-OPEN doors block trace discovery; an OPEN door does not', () => {
  const origin = { x: 0, z: 0 };
  const behindWall = trace('wall', 8, 0);
  const behindClosedDoor = trace('door', 4, 0);
  const select = state => selectVisibleTraces({ observer: origin,
    traces: [behindWall, behindClosedDoor], nowMs: 0,
    visionRange: GAME_CONFIG.perception.visionRange,
    visible: vision(geometryWith(state)) }).map(item => item.id);
  assert.deepEqual(select('CLOSED'), [], '墙与非 OPEN 门都必须挡住米痕');
  assert.deepEqual(select('LOCKED'), [], '锁门同样挡住米痕');
  assert.deepEqual(select('OPEN').sort(), ['door'], '开着的门不挡视线');
});

test('expired traces never become clues and never enter layer B', () => {
  const geometry = new PerceptionGeometry([], [], () => []);
  const now = 20_000;
  const expired = trace('old', 3, 0, 0);
  const fresh = trace('fresh', 3, 0, now - 1_000);
  assert.equal(traceIsValid(expired, now), false);
  assert.equal(traceRemainingMs(expired, now), 0);
  assert.equal(traceIsValid(fresh, now), true);
  assert.equal(traceRemainingMs(fresh, now),
    GAME_CONFIG.perception.traceLifetimeMs - 1_000);
  const visible = selectVisibleTraces({ observer: { x: 0, z: 0 },
    traces: [expired, fresh], nowMs: now,
    visionRange: GAME_CONFIG.perception.visionRange, visible: vision(geometry) });
  assert.deepEqual(visible.map(item => item.id), ['fresh']);
  const memory = new RiceTraceClueMemory();
  assert.deepEqual(memory.discover(visible, now).map(clue => clue.traceId), ['fresh']);
  assert.equal(memory.isKnown('old'), false);
});

test('the clue memory stores a snapshot and never extends the entity lifetime', () => {
  const geometry = new PerceptionGeometry([], [], () => []);
  const memory = new RiceTraceClueMemory();
  const source = trace('t1', 3, 4, 1_000, 15_000, 0.5);
  const added = memory.discover([source], 2_000);
  assert.equal(added.length, 1);
  assert.deepEqual(added[0], { traceId: 't1', position: { x: 3, z: 4 }, heading: 0.5,
    createdAt: 1_000, discoveredAt: 2_000, validUntil: 16_000 });
  // 快照：原实体之后的变化不影响已经记下的线索。
  source.position.x = 99;
  source.heading = 9;
  assert.deepEqual(memory.clues()[0].position, { x: 3, z: 4 });
  assert.equal(memory.clues()[0].heading, 0.5);
  assert.equal(memory.clues()[0].validUntil, 16_000, '线索寿命必须等于原实体过期时间');
  // 同一粒米不会重复记录。
  assert.deepEqual(memory.discover([source], 2_100), []);
  assert.equal(memory.count(), 1);
  // 过期：validUntil 到点即失效，不能无限保留。
  memory.advance(15_999);
  assert.equal(memory.count(), 1);
  memory.advance(16_000);
  assert.equal(memory.count(), 0);
  assert.equal(memory.expiredCount, 1);
  assert.equal(memory.signature(), 'NO_CLUE');
  void geometry;
});

test('clue memory is bounded and keeps the newest signatures stable', () => {
  const memory = new RiceTraceClueMemory();
  const traces = [];
  for (let index = 0; index < CLUE_MEMORY_MAX + 10; index++)
    traces.push(trace(`t${index}`, index * 0.1, 0, index));
  memory.discover(traces, CLUE_MEMORY_MAX + 10);
  assert.equal(memory.count(), CLUE_MEMORY_MAX, '线索记忆必须有确定上限');
  assert.equal(memory.droppedCount, 10);
  const signature = memory.signature();
  assert.equal(memory.signature(), signature, '同一批线索的签名必须稳定');
  const newest = memory.latest();
  assert.equal(newest.traceId, `t${CLUE_MEMORY_MAX - 1}`);
  memory.reset();
  assert.equal(memory.count(), 0);
  assert.equal(memory.discoveredCount, 0);
  assert.equal(memory.signature(), 'NO_CLUE');
});

test('clue ordering is oldest-first and deterministic for identical timestamps', () => {
  const memory = new RiceTraceClueMemory();
  memory.discover([trace('b', 1, 0, 500), trace('a', 2, 0, 500),
    trace('c', 3, 0, 100)], 1_000);
  assert.deepEqual(memory.clues().map(clue => clue.traceId), ['c', 'a', 'b']);
});

test('the adapter has no access to the opponent position at all', () => {
  const source = readFileSync(new URL('../src/systems/RiceTraceClues.ts', import.meta.url),
    'utf8');
  // 图层 A → C 的唯一输入是「观察者自己的位置 + 世界中真实存在的米痕」。
  assert.doesNotMatch(source, /player|playerPosition|deepseek\.position|occupancyOf/i,
    '米痕感知适配里不得出现对手实时坐标或占用信息');
  const interfaceBlock = source.match(/export interface TracePerceptionInput \{([\s\S]*?)\n\}/);
  assert.ok(interfaceBlock);
  assert.doesNotMatch(interfaceBlock[1], /opponent|player|target/i,
    '适配接口不得接受对手坐标');
  // 线索结构里也只有公开快照字段。
  const clueBlock = source.match(/export interface TraceClue \{([\s\S]*?)\n\}/);
  assert.ok(clueBlock);
  assert.doesNotMatch(clueBlock[1], /faction|player|owner|concealed/i);
});
