import test from 'node:test';
import assert from 'node:assert/strict';
import { AILogCollector } from '../src/systems/AILogCollector.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

// S7D：整局摘要（`matchSummary`）的行为。它必须
//   ① 给出复现字段（随机种子 / 玩家阵营 / 开局与结算 / 时长 / 完成米数）；
//   ② 把门操作、冲刺、摔倒、藏身、搜查、强制抓捕都变成**有界计数**；
//   ③ 单独留下 S7B-3A / S7B-3B 的逐条实机事件作为证据；
//   ④ 把 AI 卡路 / 异常状态折叠成带持续时长的有限条目；
//   ⑤ 不改变 v1.6 既有字段的语义，格式版本升到 1.7。

function snapshot(overrides = {}) {
  return {
    state: 'MOVE_TO_RICE', targetRiceId: 'rice_01', threatLevel: 'NONE',
    threatSource: 'NONE', lastSelectionReason: 'NONE', lastNavigationReason: 'NONE',
    lastTransitionReason: 'ROUND_START', lastEscapeSwitchReason: 'NONE',
    escapeRoomId: null, noMovementReason: 'NONE', localLoopTriggered: false,
    sprintDecision: 'NONE', sprintReadiness: 'READY', recoveryBlockReason: 'NONE',
    curiosityRollResult: 'NOT_ELIGIBLE', curiosityInterruptReason: 'NONE',
    curiosityBypassActive: false, passageRollResult: 'NOT_ELIGIBLE',
    passageGateReason: 'NOT_EVALUATED', passageCancelReason: 'NONE',
    passageRouteSafe: true, safeWaitRiceId: null, safeWaitEntryId: null,
    safeWaitFailureCount: 0, safeWaitReason: 'NONE', safeWaitRemainingMs: 0,
    roomId: 'hall', humanVisible: false, humanStillMs: 0, stillnessEventId: 0,
    lastSeenValid: false, heardSoundType: null, heardAudibleStrength: null,
    heardRemainingMs: null, heardSoundTimestampMs: null, heardDangerSoundType: null,
    heardDangerAudibleStrength: null, humanVisibleDistance: null,
    ...overrides,
  };
}

test('matchSummary 记录本局的种子、阵营、结算与完成米数', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.noteMatchContext({ seed: 20260927, playerFaction: 'HUMAN', riceTotal: 5 });
  collector.advance(30_000, true);
  collector.diffSnapshot(snapshot());
  collector.recordRiceProgress(3);
  collector.noteMatchResult({ winner: 'DEEPSEEK', reason: 'RICE_COMPLETED',
    durationMs: 74_300, riceCompleted: 5 });
  const data = collector.export({ matchSeed: 20260927 });
  assert.equal(data.formatVersion, '1.7');
  assert.equal(data.matchSummary.matchSeed, 20260927);
  assert.equal(data.matchSummary.playerFaction, 'HUMAN');
  assert.equal(data.matchSummary.winner, 'DEEPSEEK');
  assert.equal(data.matchSummary.reason, 'RICE_COMPLETED');
  assert.equal(data.matchSummary.durationMs, 74_300);
  assert.equal(data.matchSummary.riceCompleted, 5);
  assert.equal(data.matchSummary.riceTotal, 5);
  // v1.6 的字段与语义不变。
  assert.equal(data.matchSeed, 20260927);
  assert.equal(Array.isArray(data.hideEvents), true);
  assert.equal(Array.isArray(data.humanSearchEvents), true);
  assert.equal(Array.isArray(data.playerSearchEvents), true);
});

test('未结算时 matchSummary 保留 null 胜负与当前阶段', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.noteMatchContext({ seed: 7, playerFaction: 'DEEPSEEK', riceTotal: 5 });
  collector.notePhase('PLAYING');
  collector.advance(1_000, true);
  collector.diffSnapshot(snapshot());
  collector.recordRiceProgress(2);
  const data = collector.export();
  assert.equal(data.matchSummary.winner, null);
  assert.equal(data.matchSummary.reason, null);
  assert.equal(data.matchSummary.phase, 'PLAYING');
  assert.equal(data.matchSummary.durationMs, 1_000);
  assert.equal(data.matchSummary.riceCompleted, 2);
});

test('门 / 冲刺 / 摔倒 / 强制抓捕只做计数，不复制门状态', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.recordDoorResult('OPENED');
  collector.recordDoorResult('OPENED');
  collector.recordDoorResult('CLOSED');
  collector.recordDoorResult('LOCKED');
  collector.recordDoorResult('UNLOCKED');
  collector.recordDoorResult('FORCE_OPENED');
  collector.recordDoorResult('BLOCKED_BY_ACTOR');
  collector.recordSprintStart();
  collector.recordSprintStart();
  collector.recordFall();
  collector.recordForcedCapture();
  const summary = collector.export().matchSummary;
  assert.deepEqual(summary.counts, {
    doorOpened: 2, doorClosed: 1, doorLocked: 1, doorUnlocked: 1, forceBreak: 1,
    sprintStarted: 2, falls: 1, hideEntered: 0, hideExited: 0, hideRejected: 0,
    humanCheckStarted: 0, humanCheckHit: 0, humanCheckMiss: 0, forcedCaptures: 1 });
});

test('藏身与 Human AI 搜查的计数来自既有事件时间线（不新建第二套统计）', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(500, true);
  collector.recordHideEvents([
    { type: 'HIDE_AI_REQUEST', reason: 'x', spotId: 'hide_closet' },
    { type: 'HIDE_AI_ENTERED', reason: 'x', spotId: 'hide_closet' },
    { type: 'HIDE_AI_REJECTED', reason: 'x', spotId: 'hide_closet' },
    { type: 'HIDE_AI_EXITED', reason: 'x', spotId: 'hide_closet' },
  ]);
  collector.recordHumanSearchEvents([
    { type: 'HUMAN_TRACE_FOUND', reason: 'x', spotId: null },
    { type: 'HUMAN_HIDE_SEARCH_START', reason: '开始', spotId: 'hide_closet' },
    { type: 'HUMAN_HIDE_SEARCH_MISS', reason: '搜空', spotId: 'hide_closet' },
    { type: 'HUMAN_HIDE_SEARCH_CANCEL', reason: '未完成', spotId: 'hide_closet' },
    { type: 'HUMAN_HIDE_SEARCH_HIT', reason: '搜中', spotId: 'hide_closet' },
  ]);
  const data = collector.export();
  assert.equal(data.matchSummary.counts.hideEntered, 1);
  assert.equal(data.matchSummary.counts.hideExited, 1);
  assert.equal(data.matchSummary.counts.hideRejected, 1);
  assert.equal(data.matchSummary.counts.humanCheckStarted, 1);
  assert.equal(data.matchSummary.counts.humanCheckMiss, 1);
  assert.equal(data.matchSummary.counts.humanCheckHit, 1);
  // 未完成合法检查不算搜空（与 S7C-2 的语义一致）。
  assert.equal(data.matchSummary.counts.humanCheckMiss, 1);
  assert.equal(data.hideEvents.length, 4);
  assert.equal(data.humanSearchEvents.length, 5);
});

test('S7B-3A / S7B-3B 的逐条实机事件单独留证', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(2_000, true);
  collector.diffSnapshot(snapshot({
    doorEscapeEvents: [{ type: 'DOOR_ESCAPE_CLOSE', reason: 'door_hall_study:CLOSED' }],
    doorLockEvents: [{ type: 'DOOR_LOCK_APPLY', reason: 'door_hall_study:LOCKED' }],
  }));
  const summary = collector.export().matchSummary;
  assert.deepEqual(summary.doorEscapeEvidence,
    [{ t: 2_000, type: 'DOOR_ESCAPE_CLOSE', reason: 'door_hall_study:CLOSED' }]);
  assert.deepEqual(summary.doorLockEvidence,
    [{ t: 2_000, type: 'DOOR_LOCK_APPLY', reason: 'door_hall_study:LOCKED' }]);
});

test('AI 卡路 / 异常状态折叠成一条带持续时长的记录，且有上限', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  // 先正常，再进入「SAFE_WAIT 且路线一直危险」10 秒，然后恢复。
  collector.advance(1_000, true);
  collector.diffSnapshot(snapshot());
  for (let index = 0; index < 20; index++) {
    collector.advance(500, true);
    collector.diffSnapshot(snapshot({ state: 'SAFE_WAIT',
      safeWaitReason: 'RICE_OR_ROUTE_STILL_DANGEROUS' }));
  }
  collector.advance(500, true);
  collector.diffSnapshot(snapshot());
  const anomalies = collector.export().matchSummary.anomalies;
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].kind, 'SAFE_WAIT_THREAT_PERSISTS');
  assert.equal(anomalies[0].state, 'SAFE_WAIT');
  // 首次被观察到是 1.5 秒那一帧（1.0 秒的正常帧之后），持续到 11.5 秒处恢复。
  assert.equal(anomalies[0].t, 1_500);
  assert.equal(anomalies[0].lastedMs, 10_000);
});

test('仍在持续的异常也能在导出时落盘，且重复导出不重复记', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(1_000, true);
  collector.diffSnapshot(snapshot({ localLoopTriggered: true,
    noMovementReason: 'LOCAL_LOOP' }));
  collector.advance(1_000, true);
  collector.diffSnapshot(snapshot({ localLoopTriggered: true,
    noMovementReason: 'LOCAL_LOOP' }));
  const first = collector.export().matchSummary.anomalies;
  const second = collector.export().matchSummary.anomalies;
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'LOCAL_LOOP');
  assert.equal(second.length, 1);
});

test('藏身超过 30 秒且出口闸门blocking时留下 HIDE 异常记录', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(1_000, true);
  collector.diffSnapshot(snapshot({ state: 'HIDE', hidePhase: 'CONCEALED',
    hideExitGate: 'THREAT_STILL_VISIBLE', hideConcealedMs: 1_000 }));
  collector.advance(40_000, true);
  collector.diffSnapshot(snapshot({ state: 'HIDE', hidePhase: 'CONCEALED',
    hideExitGate: 'THREAT_STILL_VISIBLE', hideConcealedMs: 41_000 }));
  const anomalies = collector.export().matchSummary.anomalies;
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].kind, 'HIDE_LONG_CONCEALMENT');
  assert.match(anomalies[0].detail, /THREAT_STILL_VISIBLE/);
});

test('整局摘要里的对局时长口径与既有 matchDurationMs 一致', () => {
  const collector = new AILogCollector();
  collector.startMatch();
  collector.advance(12_345, true);
  const data = collector.export();
  assert.equal(data.matchDurationMs, 12_345);
  assert.equal(data.matchSummary.durationMs, 12_345);
  assert.equal(typeof C.match.captureMs, 'number');
});
