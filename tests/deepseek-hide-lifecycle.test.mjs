import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { HideSystem } from '../src/systems/HideSystem.ts';
import { HIDE_SPOTS } from '../src/three/map/apartmentMap.ts';
import { createDeepSeekHideEnv } from './deepseek-ai-walk.mjs';

// S7C-2b H2/H3/H4：真实走图下的完整藏身生命周期。
// 全部推进都走生产代码的同一段权威层（`resolveDeepSeekAiHideEntry`）与真实
// `CollisionWorld` / `DoorSystem` / `HideSystem`，没有任何「瞬移到目标点」的捷径。

// 2026-10-04 区域级放大：客厅纸箱搬到家具中心 (-5.4, -9.6)，唯一锚点
// (-5.4, -8.6) 在它的 +Z 一侧，所以要从 +Z 一侧接近。沿用放大前的相对距离：
// 追逐起点在锚点 +0.4，Human 再沿同一方向 +1.4（合计 1.8）。
const CARTON_ANCHOR = HIDE_SPOTS.find(spot => spot.id === 'hide_living_carton');
const CHASE_START = { x: CARTON_ANCHOR.x, z: CARTON_ANCHOR.z + 0.4 };
const HUMAN_NEAR = { x: CARTON_ANCHOR.x, z: CARTON_ANCHOR.z + 1.8 };

function chaseEnv() {
  return createDeepSeekHideEnv({ start: CHASE_START, human: HUMAN_NEAR });
}

function walkUntil(env, predicate, { visibleHuman = null, frames = 400,
  deltaMs = 50, overrides = {} } = {}) {
  for (let frame = 0; frame < frames; frame++) {
    env.walk({ visibleHuman, ...overrides }, deltaMs);
    if (predicate()) return frame;
  }
  return -1;
}

test('EVADE → HIDE(TRAVEL) → CONCEALED：AI 真的走到合法站位并由权威层放行', () => {
  const env = chaseEnv();
  const travel = walkUntil(env, () => env.ai.state === 'HIDE' && env.ai.hidePhase === 'TRAVEL',
    { visibleHuman: HUMAN_NEAR });
  assert.notEqual(travel, -1, '威胁贴近时必须进入藏身走位，而不是只会直线逃跑');
  assert.ok(env.ai.hideStancePoint, '走位阶段必须有公开的规划站位');
  const entering = walkUntil(env, () => env.hide.isConcealed('DEEPSEEK'), { visibleHuman: HUMAN_NEAR });
  assert.notEqual(entering, -1, `AI 没有在 ${entering} 帧内完成权威进入`);
  assert.equal(env.ai.hidePhase, 'CONCEALED');
  assert.equal(env.hide.spotId, env.ai.hideSpotId);
  // 到位后位置必须真的落在规划站位上（不是「自称到了」）。
  const stance = env.ai.hideStancePoint;
  const at = env.point();
  assert.equal(Math.hypot(at.x - stance.x, at.z - stance.z) <=
    GAME_CONFIG.deepseekAI.waypointTolerance + GAME_CONFIG.collision.contactEpsilon, true);
  // 进入位置 = 退出位置（不传送）。
  assert.equal(Math.hypot(env.hide.entryPosition.x - at.x, env.hide.entryPosition.z - at.z) < 1e-9,
    true);
  // 藏身中位移为 0：连走 20 帧，位置一动不动。
  for (let frame = 0; frame < 20; frame++) env.walk({ visibleHuman: HUMAN_NEAR });
  assert.ok(Math.hypot(env.point().x - at.x, env.point().z - at.z) < 1e-9,
    '藏身中不得发生任何位移');
  const events = env.ai.drainHideEvents().map(event => event.type);
  assert.equal(events.includes('HIDE_AI_REQUEST'), true);
  assert.equal(events.includes('HIDE_AI_ENTERED'), true);
});

test('威胁解除后 AI 自主退出并回到既有 RECOVER / 找米流程', () => {
  const env = chaseEnv();
  walkUntil(env, () => env.hide.isConcealed('DEEPSEEK'), { visibleHuman: HUMAN_NEAR });
  assert.equal(env.hide.isConcealed('DEEPSEEK'), true);
  // 最短藏身时间未到时不退出（重查间隔 500 ms 先到，闸门应是 MIN_CONCEAL_MS）。
  for (let frame = 0; frame < 12; frame++) env.walk({ visibleHuman: null });
  assert.equal(env.ai.hidePhase, 'CONCEALED', '最短藏身时间未到时不得退出');
  assert.equal(env.ai.hideExitGate, 'MIN_CONCEAL_MS');
  // Human 走远（真实位置与目视都离开），等过最短藏身时间。
  env.setHuman({ x: 20, z: 20 });
  const exited = walkUntil(env, () => !env.hide.isConcealed('DEEPSEEK'), { frames: 200 });
  assert.notEqual(exited, -1, '威胁解除后 AI 必须自己出来');
  assert.equal(env.ai.hidePhase, 'NONE');
  assert.equal(env.ai.state, 'RECOVER');
  assert.equal(env.hide.lastExitReason, 'AI_EXIT');
  const events = env.ai.drainHideEvents().map(event => event.type);
  assert.equal(events.includes('HIDE_AI_EXIT_REQUEST'), true);
  assert.equal(events.includes('HIDE_AI_EXITED'), true);
});

test('Human 真实压住出口时退出被拒 HUMAN_BLOCKING，AI 退回藏身而不是卡在 EXIT', () => {
  const env = chaseEnv();
  walkUntil(env, () => env.hide.isConcealed('DEEPSEEK'), { visibleHuman: HUMAN_NEAR });
  assert.equal(env.hide.isConcealed('DEEPSEEK'), true);
  const here = env.point();
  // Human 直接站到藏身者身上：物理判据必然拦下退出。
  env.setHuman(here);
  const denied = walkUntil(env, () => env.ai.hideRejectCode === 'HUMAN_BLOCKING',
    { frames: 200 });
  assert.notEqual(denied, -1, '出口被压住时必须回执 HUMAN_BLOCKING');
  assert.equal(env.hide.isConcealed('DEEPSEEK'), true, '被拒之后必须仍然是藏身状态');
  assert.equal(env.ai.hidePhase, 'CONCEALED', '不得卡在 EXIT 相位');
  // Human 让开：随后必须能正常退出。
  env.setHuman({ x: 20, z: 20 });
  const exited = walkUntil(env, () => !env.hide.isConcealed('DEEPSEEK'), { frames: 200 });
  assert.notEqual(exited, -1, 'Human 让开之后必须能自己出来');
});

test('藏身走位遇到真实抓捕进度或眩晕时立即中止并回到 EVADE', () => {
  const env = chaseEnv();
  walkUntil(env, () => env.ai.hidePhase === 'TRAVEL', { visibleHuman: HUMAN_NEAR });
  assert.equal(env.ai.hidePhase, 'TRAVEL');
  env.walk({ visibleHuman: HUMAN_NEAR, captureProgressMs: 40 });
  assert.equal(env.ai.hidePhase, 'NONE');
  assert.equal(env.ai.state, 'EVADE');
  assert.equal(env.hide.isConcealed('DEEPSEEK'), false);
  const events = env.ai.drainHideEvents();
  assert.equal(events.some(event => event.type === 'HIDE_AI_ABORT' &&
    event.reason === 'CAPTURE_ATTEMPT'), true);
});

test('一次性令牌：无令牌被拒、令牌不匹配被拒、消费后重放被拒', () => {
  const hide = new HideSystem();
  const context = token => ({ phase: 'PLAYING', position: { x: 3, z: 3 },
    spotId: 'hide_living_carton', spotCode: 'LEGAL', spotLegal: true,
    captureProgressMs: 0, sprintState: 'NORMAL', requestToken: token });
  assert.equal(hide.enterAsAI(context(1)).code, 'TOKEN_REQUIRED',
    '没有游戏层签发的令牌时 AI 入口必须被拒');
  hide.issueAiEntryToken(7);
  assert.equal(hide.enterAsAI(context(8)).code, 'TOKEN_REPLAY');
  assert.equal(hide.enterAsAI(context(7)).code, 'ENTERED');
  assert.equal(hide.state, 'CONCEALED');
  // 消费之后同一令牌不可能再进入：先强制退出，再重放。
  assert.equal(hide.forcedExit('AI_EXIT').ok, true);
  assert.equal(hide.enterAsAI(context(7)).code, 'TOKEN_REPLAY');
  assert.equal(hide.state, 'OUTSIDE');
  assert.equal(hide.lastExitReason, 'AI_EXIT');
});

test('玩家 E 入口对 AI 的拒绝语义一字未改（NOT_PLAYER_CONTROLLED）', () => {
  const hide = new HideSystem();
  hide.issueAiEntryToken(1);
  const result = hide.enter({
    phase: 'PLAYING', faction: 'DEEPSEEK', playerControlled: false,
    position: { x: 3, z: 3 }, spotId: 'hide_living_carton', spotCode: 'LEGAL',
    spotLegal: true, captureProgressMs: 0, sprintState: 'NORMAL',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NOT_PLAYER_CONTROLLED');
  assert.equal(hide.state, 'OUTSIDE');
});

test('AI 藏身的权威层不接受非 PLAYING、眩晕、冲刺与进行中的抓捕', () => {
  const hide = new HideSystem();
  const base = { position: { x: 3, z: 3 }, spotId: 'hide_living_carton',
    spotCode: 'LEGAL', spotLegal: true, captureProgressMs: 0, sprintState: 'NORMAL',
    requestToken: 5 };
  const attempt = overrides => {
    hide.reset();
    hide.issueAiEntryToken(5);
    return hide.enterAsAI({ phase: 'PLAYING', ...base, ...overrides });
  };
  assert.equal(attempt({ phase: 'READY' }).code, 'NOT_PLAYING');
  assert.equal(attempt({ sprintState: 'STUNNED' }).code, 'STUNNED');
  assert.equal(attempt({ sprintState: 'SPRINT_RUNNING' }).code, 'SPRINT_ACTIVE');
  assert.equal(attempt({ captureProgressMs: 10 }).code, 'CAPTURE_IN_PROGRESS');
  assert.equal(attempt({ spotLegal: false }).code, 'POSITION_ILLEGAL');
  // 已经在藏身中：即使令牌合法也必须拒绝（状态机优先级高于令牌）。
  hide.reset();
  hide.issueAiEntryToken(5);
  assert.equal(hide.enterAsAI({ phase: 'PLAYING', ...base }).code, 'ENTERED');
  hide.issueAiEntryToken(6);
  assert.equal(hide.enterAsAI({ phase: 'PLAYING', ...base, requestToken: 6 }).code,
    'ALREADY_CONCEALED');
});

test('被搜出 / 局终 / 地图应用等强制清空时，AI 侧的藏身计划同步作废', () => {
  const hide = new HideSystem();
  hide.issueAiEntryToken(3);
  assert.equal(hide.enterAsAI({ phase: 'PLAYING', position: { x: 7, z: 3.6 },
    spotId: 'hide_living_carton', spotCode: 'LEGAL', spotLegal: true,
    captureProgressMs: 0, sprintState: 'NORMAL', requestToken: 3 }).ok, true);
  assert.equal(hide.forcedExit('SEARCHED').ok, true);
  assert.equal(hide.lastExitReason, 'SEARCHED');
  assert.equal(hide.state, 'OUTSIDE');
  assert.equal(hide.spotId, null);
  // 重开一局后令牌与占用都必须干净（不留异常免疫或残留令牌）。
  hide.issueAiEntryToken(9);
  hide.reset();
  assert.equal(hide.hasPendingAiEntryToken(), false);
  assert.equal(hide.enterAsAI({ phase: 'PLAYING', position: { x: 7, z: 3.6 },
    spotId: 'hide_living_carton', spotCode: 'LEGAL', spotLegal: true,
    captureProgressMs: 0, sprintState: 'NORMAL', requestToken: 9 }).code,
  'TOKEN_REQUIRED');
});
