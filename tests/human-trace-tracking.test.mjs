import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { TRACE_LINK_DISTANCE, TRACE_LINK_STEPS, TRACE_CHAIN_MAX_CLUES,
  TRACE_DIRECTION_CONTRADICTION_DEG } from '../src/systems/HumanSearchTuning.ts';
import { compassText, headingToVector, inferTraceDirection,
  traceHeadingToDirectionRad } from '../src/systems/HumanTraceTracking.ts';

// S7C-2 规则型循迹：只用真实生成时间、真实空间连续性与脚印自带的朝向字段。
// 规则固定、可解释、同输入必然同输出；不引入任何机器学习或隐藏信息。

/** 米痕实体的 heading 用 atan2(dx, dz)；这里按真实约定生成。 */
const traceHeading = (dx, dz) => Math.atan2(dx, dz);

const clue = (id, x, z, createdAt, heading = traceHeading(1, 0)) =>
  ({ traceId: id, position: { x, z }, heading, createdAt, discoveredAt: createdAt,
    validUntil: createdAt + GAME_CONFIG.perception.traceLifetimeMs });

const step = GAME_CONFIG.perception.traceStepDistance;

test('no clue means no inference and no direction', () => {
  const inference = inferTraceDirection([]);
  assert.equal(inference.code, 'NO_CLUE');
  assert.equal(inference.confidence, 'NONE');
  assert.equal(inference.anchor, null);
  assert.equal(inference.direction, null);
  assert.equal(inference.directionHeadingRad, null);
  assert.deepEqual(inference.chain, []);
  assert.equal(inference.newestTraceId, null);
});

test('a single trace only gives a low-confidence heading, never a furniture lock', () => {
  const inference = inferTraceDirection([clue('a', 4, 4, 100, traceHeading(1, 1))]);
  assert.equal(inference.code, 'SINGLE_TRACE');
  assert.equal(inference.confidence, 'LOW');
  assert.deepEqual(inference.anchor, { x: 4, z: 4 });
  assert.deepEqual(inference.chain, ['a']);
  assert.equal(inference.directionHeadingRad, Math.PI / 4);
  assert.ok(Math.abs(inference.direction.x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(inference.direction.z - Math.SQRT1_2) < 1e-12);
  assert.match(inference.basis.join('；'), /一粒米不足以锁定藏身家具/);
});

test('the trace heading field is converted from the trace axis convention', () => {
  // 沿 +X 直线移动：实体 heading = π/2，世界朝向角必须是 0。
  assert.equal(traceHeadingToDirectionRad(Math.PI / 2), 0);
  // 沿 +Z 直线移动：实体 heading = 0，世界朝向角必须是 π/2。
  assert.equal(traceHeadingToDirectionRad(0), Math.PI / 2);
  // 沿 -X：实体 heading = -π/2 → 世界朝向角 π。
  assert.equal(Math.abs(traceHeadingToDirectionRad(-Math.PI / 2)), Math.PI);
  assert.deepEqual(headingToVector(0), { x: 1, z: 0 });
});

test('consecutive traces form a chain and the escape direction is old to new', () => {
  const clues = [clue('a', 0, 0, 100), clue('b', step, 0, 200),
    clue('c', step * 2, 0, 300)];
  const inference = inferTraceDirection(clues);
  assert.equal(inference.code, 'CHAIN');
  assert.equal(inference.confidence, 'HIGH');
  assert.deepEqual(inference.chain, ['a', 'b', 'c']);
  assert.equal(inference.newestTraceId, 'c');
  assert.deepEqual(inference.anchor, { x: step * 2, z: 0 });
  assert.equal(inference.directionHeadingRad, 0);
  assert.deepEqual(inference.direction, { x: 1, z: 0 });
  assert.equal(inference.gaps, 0);
  assert.match(inference.basis.join('；'), /连续 3 粒米构成一条路径/);
});

test('the link distance is inclusive and one step further breaks the chain', () => {
  const inside = inferTraceDirection([clue('a', 0, 0, 100),
    clue('b', TRACE_LINK_DISTANCE, 0, 200)]);
  assert.equal(inside.chain.length, 2);
  assert.equal(inside.code, 'CHAIN');
  const outside = inferTraceDirection([clue('a', 0, 0, 100),
    clue('b', TRACE_LINK_DISTANCE + 0.01, 0, 200)]);
  assert.equal(outside.chain.length, 1, '超过连接距离就不算同一段痕迹');
  assert.equal(outside.code, 'SINGLE_TRACE');
  assert.equal(outside.gaps, 1);
  // 连接距离由真实生成间距推导，且远小于既有搜索半径。
  assert.equal(TRACE_LINK_DISTANCE, step * TRACE_LINK_STEPS);
  assert.ok(TRACE_LINK_DISTANCE < GAME_CONFIG.humanAI.searchRadius / 3);
});

test('a far earlier trace lowers confidence to TRACE_JUMP but keeps the direction', () => {
  const clues = [clue('old', -40, 0, 100), clue('a', 0, 0, 200),
    clue('b', step, 0, 300), clue('c', step * 2, 0, 400)];
  const inference = inferTraceDirection(clues);
  assert.equal(inference.code, 'TRACE_JUMP');
  assert.equal(inference.confidence, 'MEDIUM');
  assert.deepEqual(inference.chain, ['a', 'b', 'c']);
  assert.equal(inference.gaps, 1);
  assert.equal(inference.directionHeadingRad, 0, '方向仍来自连续的那一段');
  assert.match(inference.basis.join('；'), /跳跃过远/);
});

test('a contradicting heading lowers confidence instead of inventing a direction', () => {
  const clues = [clue('a', 0, 0, 100, traceHeading(1, 0)),
    clue('b', step, 0, 200, traceHeading(-1, 0))];
  const inference = inferTraceDirection(clues);
  assert.equal(inference.code, 'CHAIN_CONTRADICTORY');
  assert.equal(inference.confidence, 'LOW');
  assert.match(inference.basis.join('；'), /矛盾/);
  assert.ok(TRACE_DIRECTION_CONTRADICTION_DEG === 90);
  // 恰好 90° 的偏差不算矛盾（边界包含）。
  const edge = inferTraceDirection([clue('a', 0, 0, 100, traceHeading(1, 1)),
    clue('b', step, 0, 200, traceHeading(1, 0))]);
  assert.notEqual(edge.code, 'CHAIN_CONTRADICTORY');
});

test('at most the newest TRACE_CHAIN_MAX_CLUES traces take part in the inference', () => {
  const clues = [];
  for (let index = 0; index < TRACE_CHAIN_MAX_CLUES + 4; index++)
    clues.push(clue(`t${index}`, index * step, 0, 100 + index));
  const inference = inferTraceDirection(clues);
  assert.equal(inference.chain.length, TRACE_CHAIN_MAX_CLUES);
  assert.equal(inference.chain[0], `t${4}`);
  assert.equal(inference.newestTraceId, `t${TRACE_CHAIN_MAX_CLUES + 3}`);
});

test('the inference is deterministic and readable in Chinese compass terms', () => {
  const clues = [clue('a', 0, 0, 100), clue('b', 0, step, 200)];
  const first = inferTraceDirection(clues);
  const second = inferTraceDirection(clues);
  assert.deepEqual(first, second);
  assert.equal(first.directionHeadingRad, Math.PI / 2);
  assert.equal(compassText(Math.PI / 2), '南', '+Z 在项目坐标系里是南');
  assert.equal(compassText(0), '东');
  assert.equal(compassText(-Math.PI / 2), '北');
  assert.equal(compassText(Math.PI), '西');
});
