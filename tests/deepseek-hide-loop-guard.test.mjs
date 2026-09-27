import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { createDeepSeekHideMapSnapshot, selectHideSpot }
  from '../src/systems/DeepSeekHideCandidates.ts';
import { FURNITURE, HIDE_SPOTS } from '../src/three/map/apartmentMap.ts';
import { createDeepSeekHideEnv } from './deepseek-ai-walk.mjs';

// S7C-2b H5：循环抑制。要证明的是「不会原地反复进出、不会在两点之间无限横跳、
// 不会因为所有点都不可用而卡死」，而不是「用最大藏身时长兜底」。

/** 站位只取决于藏身点几何，与 AI 当前位置无关，因此可以预先算出来布置场景。 */
function stanceOf(env, spotId) {
  const spot = HIDE_SPOTS.find(entry => entry.id === spotId);
  const map = createDeepSeekHideMapSnapshot({ hideSpots: [spot], furniture: FURNITURE,
    revision: 1 });
  const result = selectHideSpot({ map, position: { x: spot.x, z: spot.z },
    doors: env.doors.doors, threat: { x: spot.x - 1, z: spot.z }, world: env.world });
  assert.equal(result.ok, true, `${spotId} 没有可用站位：${result.reason}`);
  return result.candidate.stancePoint;
}

/**
 * 逼近：把 Human 始终钉在 AI 前方 `offset` 处。必须每帧跟随——否则 AI 一旦逃跑，
 * 目视距离会超过 `visionEvadeDistance`(5) 降级为 CAUTION，那验证的就不是「贴近时
 * 能不能藏身」这条路径了。
 */
function chase(env, offset = 1.2) {
  const at = env.point();
  return { x: at.x - offset, z: at.z };
}

function forceHide(env, stance, frames = 60) {
  // 场景布置：先作废上一段留下的走位计划（等价于一次地图重建），再摆放角色。
  // 否则 AI 可能还在上一段测试的目标上走位，新的近似就不会被重新评估。
  env.ai.rebindMap(env.hideMap, true);
  env.setPosition(stance);
  for (let frame = 0; frame < frames; frame++) {
    const human = chase(env);
    env.setHuman(human);
    env.walk({ visibleHuman: human });
    if (env.hide.isConcealed('DEEPSEEK')) return true;
  }
  return false;
}

function forceExit(env, frames = 200) {
  env.setHuman({ x: 20, z: 20 });
  for (let frame = 0; frame < frames; frame++) {
    env.walk({ visibleHuman: null });
    if (!env.hide.isConcealed('DEEPSEEK')) return true;
  }
  return false;
}

test('退出后同一点进入再进冷却，下一次藏身必须换一个点（不原地反复进出）', () => {
  const env = createDeepSeekHideEnv();
  const first = stanceOf(env, 'hide_living_carton');
  const second = stanceOf(env, 'hide_study_bookshelf');
  assert.equal(forceHide(env, first), true);
  assert.equal(env.ai.hideSpotId, 'hide_living_carton');
  assert.equal(forceExit(env), true);
  const cooldowns = env.ai.hideCooldowns();
  const entry = cooldowns.find(item => item.spotId === 'hide_living_carton');
  assert.ok(entry, '退出后同一点必须进入再进冷却');
  assert.equal(entry.remainingMs > 0, true);
  assert.equal(entry.remainingMs <= GAME_CONFIG.deepseekAI.hideReenterCooldownMs, true);
  // 回到同一个点再次被逼近：不得立刻重新钻进同一个家具。
  forceHide(env, first, 60);
  assert.notEqual(env.hide.spotId, 'hide_living_carton',
    '同点冷却期内不得重新进入同一个藏身点');
  assert.notEqual(env.ai.hideSpotId, 'hide_living_carton');
  // 换一个没被冷却的点：仍然可以正常藏身（冷却不是「永久禁用」）。
  assert.equal(forceHide(env, second), true);
  assert.equal(env.ai.hideSpotId, 'hide_study_bookshelf');
  assert.deepEqual(env.ai.hideRecentSpotIds,
    ['hide_living_carton', 'hide_study_bookshelf']);
});

test('权威层拒绝进入时写公开失败记忆：该点冷却、计数与事件都落位', () => {
  const env = createDeepSeekHideEnv();
  const stance = stanceOf(env, 'hide_living_carton');
  // 起点离站位 2 u，威胁保持在 3 u（仍在 hideThreatDistance 内）：先让 AI 自己规划出
  // 藏身走位，再在走位期间注入「处处站不住」的真实几何接缝，让权威层在真正到位那一刻
  // 拒绝（AI 侧只拿得到一个拒绝码）。
  env.setPosition({ x: stance.x - 2, z: stance.z });
  const rejectingWorld = { ...env.world,
    collision: { canOccupyStaticXZ: () => false } };
  const chaseAt = offset => {
    const at = env.point();
    return { x: at.x - offset, z: at.z };
  };
  let requested = false;
  for (let frame = 0; frame < 200; frame++) {
    const human = chaseAt(3);
    env.setHuman(human);
    const before = env.ai.hideRequestCount;
    const useRejecting = env.ai.hidePhase === 'TRAVEL';
    env.walk({ visibleHuman: human,
      hideWorld: useRejecting ? rejectingWorld : env.world });
    if (env.ai.hideRequestCount > before) requested = true;
    if (requested && env.ai.hidePhase === 'NONE') break;
  }
  assert.equal(requested, true, 'AI 必须真的发过一次进入请求');
  assert.equal(env.ai.hideRejectCode, 'POSITION_ILLEGAL');
  assert.equal(env.hide.isConcealed('DEEPSEEK'), false);
  assert.equal(env.ai.hideSpotBlockedCount >= 1, true);
  const cooldown = env.ai.hideCooldowns()
    .find(item => item.spotId === 'hide_living_carton');
  assert.ok(cooldown, '被拒绝的点必须进入失败冷却');
  assert.equal(cooldown.remainingMs <= GAME_CONFIG.deepseekAI.hideCandidateFailCooldownMs, true);
  const events = env.ai.drainHideEvents().map(event => event.type);
  assert.equal(events.includes('HIDE_AI_REJECTED'), true);
  assert.equal(events.includes('HIDE_AI_SPOT_BLOCKED'), true);
});

test('没有可达米堆时不进入藏身（防止藏到天荒地老的公开前置条件）', () => {
  const env = createDeepSeekHideEnv();
  const stance = stanceOf(env, 'hide_living_carton');
  env.setPosition(stance);
  // 全部米堆都已完成 = 没有「还有事可做」，因此不允许进入藏身。
  const done = env.input().rice.map(rice => ({ ...rice, completed: true }));
  const reasons = new Set();
  for (let frame = 0; frame < 60; frame++) {
    const human = chase(env);
    env.setHuman(human);
    env.walk({ visibleHuman: human, rice: done });
    reasons.add(env.ai.hideBlockedReason);
  }
  assert.equal(env.hide.isConcealed('DEEPSEEK'), false);
  // 只要当时「其他条件都成立」，阻止它的原因就必须是「没有可达米堆」。
  assert.equal(reasons.has('NO_REACHABLE_RICE'), true,
    `拒绝原因里必须出现过 NO_REACHABLE_RICE，实际 ${[...reasons].join('、')}`);
});

test('连续藏身次数上限：两次之后必须靠真实吃米进展才解锁', () => {
  const env = createDeepSeekHideEnv();
  const spots = ['hide_living_carton', 'hide_study_bookshelf', 'hide_second_bed'];
  const stances = spots.map(id => stanceOf(env, id));
  for (let index = 0; index < 2; index++) {
    assert.equal(forceHide(env, stances[index]), true, `第 ${index + 1} 次藏身应当成功`);
    assert.equal(env.ai.hideConsecutiveCount, index + 1);
    assert.equal(forceExit(env), true);
  }
  assert.equal(env.ai.hideConsecutiveCount, GAME_CONFIG.deepseekAI.hideMaxConsecutive);
  // 第三次：达到上限，必须先有真实进食进展。
  assert.equal(forceHide(env, stances[2], 40), false);
  assert.equal(env.ai.hideBlockedReason, 'CONSECUTIVE_LIMIT');
  assert.equal(env.hide.isConcealed('DEEPSEEK'), false);
  // 真实吃米进展（全局米进度比例上升）解锁下一次藏身。
  env.setPosition(stances[2]);
  let entered = false;
  for (let frame = 0; frame < 60; frame++) {
    const human = chase(env);
    env.setHuman(human);
    env.walk({ visibleHuman: human, riceProgressRatio: 0.25 });
    if (env.hide.isConcealed('DEEPSEEK')) { entered = true; break; }
  }
  assert.equal(entered, true, '有真实米进度之后必须能再次藏身');
  assert.equal(env.ai.hideConsecutiveCount, 1);
});

test('长时间反复逼近 / 拉开：进出次数有界，不出现原地无限进出', () => {
  const env = createDeepSeekHideEnv();
  const stance = stanceOf(env, 'hide_living_carton');
  const human = { x: stance.x - 1.2, z: stance.z };
  let enters = 0;
  let exits = 0;
  let concealed = false;
  // 30 秒（600 帧）内威胁反复来去，全部在同一个点附近。
  for (let frame = 0; frame < 600; frame++) {
    const phase = frame % 100;
    const threatened = phase < 60;
    env.setPosition(stance);
    env.setHuman(threatened ? human : { x: 20, z: 20 });
    env.walk({ visibleHuman: threatened ? human : null });
    const nowConcealed = env.hide.isConcealed('DEEPSEEK');
    if (nowConcealed && !concealed) enters++;
    if (!nowConcealed && concealed) exits++;
    concealed = nowConcealed;
  }
  // 同点冷却 8 秒 + 连续上限 2：30 秒内不可能出现「每 5 秒进出一次」的抖动。
  assert.equal(enters <= 2, true, `30 秒内进入次数必须被同点冷却与连续上限压住，实际 ${enters}`);
  assert.equal(exits <= 2, true, `退出次数同样有界，实际 ${exits}`);
  assert.equal(env.hide.enterCount <= 3, true);
});

test('地图代次变化立刻作废走位中的藏身计划，不抱着旧家具位置继续走', () => {
  const env = createDeepSeekHideEnv();
  const stance = stanceOf(env, 'hide_study_bookshelf');
  // 起点离站位 1 u、威胁紧随其后再 1.2 u：既满足 hideThreatDistance(3.5)，又满足
  // 「藏身路线不得长过威胁距离」，因此会真的进入走位并持续几帧。
  const human = { x: stance.x - 2.2, z: stance.z };
  env.setPosition({ x: stance.x - 1, z: stance.z });
  env.setHuman(human);
  let travel = false;
  for (let frame = 0; frame < 200; frame++) {
    env.walk({ visibleHuman: human });
    if (env.ai.hidePhase === 'TRAVEL') { travel = true; break; }
  }
  assert.equal(travel, true, '需要先进入藏身走位才能验证「地图变化作废旧计划」');
  env.walk({ visibleHuman: human,
    hideMap: { ...env.hideMap, revision: env.hideMap.revision + 1 } });
  assert.equal(env.ai.hidePhase, 'NONE');
  assert.equal(env.ai.state, 'EVADE');
  assert.equal(env.ai.hideStancePoint, null);
  const events = env.ai.drainHideEvents();
  assert.equal(events.some(event => event.type === 'HIDE_AI_ABORT' &&
    event.reason === 'MAP_REVISION_CHANGED'), true);
});

test('同一中止原因只记一次事件（诊断时间线不逐帧刷屏）', () => {
  const env = createDeepSeekHideEnv();
  const stance = stanceOf(env, 'hide_main_bed');
  const done = env.input().rice.map(rice => ({ ...rice, completed: true }));
  env.setPosition(stance);
  env.setHuman({ x: stance.x - 1.2, z: stance.z });
  for (let frame = 0; frame < 120; frame++)
    env.walk({ visibleHuman: { x: stance.x - 1.2, z: stance.z }, rice: done });
  const aborts = env.ai.drainHideEvents()
    .filter(event => event.type === 'HIDE_AI_ABORT');
  assert.equal(aborts.length, 1, '同一原因 120 帧内只允许写一条中止事件');
  assert.equal(aborts[0].reason, 'NO_REACHABLE_RICE');
});
