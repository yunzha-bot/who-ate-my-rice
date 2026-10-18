import test from 'node:test';
import assert from 'node:assert/strict';
import { AILogCollector } from '../src/systems/AILogCollector.ts';

// 本轮新增的整局证据（v1.8）：
//   ① 门**真的被怎么打开**：强破 / 解锁 / 普通开关，以及「上锁到被打开」的毫秒数；
//   ② Human AI 的**路线决策**（绕行 / 解锁 / 强破）必须与门结果分开记录；
//   ③ 投掷命中按被砸中的阵营计数；
//   ④ 结算瞬间的状态事实只留一条，且在局终当帧就能导出；
//   ⑤ 三类证据全部有界。

const capture = (overrides = {}) => ({
  reason: 'CAPTURED', winner: 'HUMAN', mode: 'ZONE',
  deepseekStunned: false, deepseekConcealed: false, humanStunned: false,
  sprintState: 'NORMAL', captureProgressMs: 350, ...overrides,
});

test('门实际结果留证：强破/解锁/开关都记，且带锁门到被打开的时间差', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(1_000, true);
  collector.recordDoorResult('LOCKED', { doorId: 'door_a', actor: 'DEEPSEEK' });
  collector.advance(7_500, true);
  collector.recordDoorResult('FORCE_OPENED', { doorId: 'door_a', actor: 'HUMAN' });
  collector.advance(1_000, true);
  collector.recordDoorResult('LOCKED', { doorId: 'door_b', actor: 'DEEPSEEK' });
  collector.advance(8_750, true);
  collector.recordDoorResult('UNLOCKED', { doorId: 'door_b', actor: 'HUMAN' });
  const evidence = collector.export().matchSummary.doorAccessEvidence;
  assert.equal(evidence.length, 4);
  assert.deepEqual(evidence.map(entry => [entry.t, entry.doorId, entry.result, entry.actor]),
    [[1_000, 'door_a', 'LOCKED', 'DEEPSEEK'], [8_500, 'door_a', 'FORCE_OPENED', 'HUMAN'],
      [9_500, 'door_b', 'LOCKED', 'DEEPSEEK'], [18_250, 'door_b', 'UNLOCKED', 'HUMAN']]);
  // 锁门那一条本身没有「锁了多久」，被打开的两条才有。
  assert.deepEqual(evidence.map(entry => entry.sinceLockMs), [null, 7_500, null, 8_750]);
});

test('门结果计数与既有行为一致，且失败码不产生访问证据', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.recordDoorResult('OPENED', { doorId: 'door_a', actor: 'HUMAN' });
  collector.recordDoorResult('BLOCKED_BY_ACTOR', { doorId: 'door_a', actor: 'HUMAN' });
  collector.recordDoorResult('FORCE_OPENED');
  const summary = collector.export().matchSummary;
  assert.equal(summary.counts.doorOpened, 1);
  assert.equal(summary.counts.forceBreak, 1);
  // 没有 doorId 的调用只计数，不留证据（保持旧调用方兼容）。
  assert.equal(summary.doorAccessEvidence.length, 1);
  assert.equal(summary.doorAccessEvidence[0].actor, 'HUMAN');
});

test('路线决策与门实际结果分开记录，互不冒充', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(2_000, true);
  collector.recordHumanRoute({ decision: 'DETOUR', reason: 'DETOUR_FASTER_OR_SIMILAR',
    doorId: null });
  collector.recordHumanRoute({ decision: 'FORCE_BREAK', reason: 'LOCK_ROUTE_FASTER',
    doorId: 'door_a' });
  collector.recordDoorResult('LOCKED', { doorId: 'door_a', actor: 'DEEPSEEK' });
  const summary = collector.export().matchSummary;
  assert.deepEqual(summary.humanRouteEvidence.map(entry =>
    [entry.decision, entry.reason, entry.doorId]),
  [['DETOUR', 'DETOUR_FASTER_OR_SIMILAR', null], ['FORCE_BREAK', 'LOCK_ROUTE_FASTER', 'door_a']]);
  // 只决策、没开门：门证据里只有锁门那一条，绝不能出现强破。
  assert.deepEqual(summary.doorAccessEvidence.map(entry => entry.result), ['LOCKED']);
  assert.equal(summary.counts.forceBreak, 0);
});

test('投掷命中按被砸中的阵营计数', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.recordThrowHit('HUMAN');
  collector.recordThrowHit('DEEPSEEK');
  collector.recordThrowHit('DEEPSEEK');
  const counts = collector.export().matchSummary.counts;
  assert.equal(counts.throwHitsHuman, 1);
  assert.equal(counts.throwHitsDeepseek, 2);
});

test('结算证据记录抓捕路径与当时状态，且局终当帧即可导出', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(5_000, true);
  collector.recordForcedCapture('FURNITURE_CHECK');
  collector.recordCapture(capture({ deepseekConcealed: true, deepseekStunned: true }));
  const evidence = collector.export().matchSummary.captureEvidence;
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].t, 5_000);
  assert.equal(evidence[0].mode, 'FURNITURE_CHECK');
  assert.equal(evidence[0].deepseekConcealed, true);
  assert.equal(evidence[0].deepseekStunned, true);
  assert.equal(evidence[0].reason, 'CAPTURED');
});

test('非强制抓捕保留普通接触圈路径，且重复写入不产生第二条', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(3_000, true);
  collector.recordCapture(capture({ mode: 'ZONE' }));
  collector.recordCapture(capture({ mode: 'Q_FAN' }));
  const evidence = collector.export().matchSummary.captureEvidence;
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].mode, 'ZONE');
});

test('三类新证据都有上限，且新局清空', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  for (let index = 0; index < 80; index++)
    collector.recordDoorResult('OPENED', { doorId: `door_${index}`, actor: 'HUMAN' });
  for (let index = 0; index < 260; index++)
    collector.recordHumanRoute({ decision: 'NONE', reason: `R${index}`, doorId: null });
  let summary = collector.export().matchSummary;
  assert.equal(summary.doorAccessEvidence.length, 50);
  assert.equal(summary.humanRouteEvidence.length, 200);
  collector.startMatch();
  summary = collector.export().matchSummary;
  assert.equal(summary.doorAccessEvidence.length, 0);
  assert.equal(summary.humanRouteEvidence.length, 0);
  assert.equal(summary.captureEvidence.length, 0);
  assert.equal(summary.counts.throwHitsHuman, 0);
});
