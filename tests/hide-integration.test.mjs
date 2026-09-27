import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { PerceptionGeometry, VisionSystem } from '../src/systems/PerceptionSystem.ts';
import { isCaptureEligibleXZ, isInsideCaptureZoneXZ } from '../src/three/CaptureZone.ts';

// S7C-1B：感知与常规抓捕联动，以及两条长期禁令（AI 不透视、AI 不自主藏身）。
const openGeometry = new PerceptionGeometry([], [], () => []);
const human = { x: 0, z: 0 };
const deepseek = { x: 2, z: 0 };

test('藏身期间 Human 普通视觉看不见，且不再刷新 Last Seen', () => {
  const vision = new VisionSystem();
  vision.update(0, human, deepseek, openGeometry);
  assert.equal(vision.get('HUMAN').status, 'VISIBLE');
  assert.equal(vision.get('DEEPSEEK').status, 'VISIBLE');
  const seenAt = vision.get('HUMAN').lastSeen.timeMs;

  vision.setConcealed('DEEPSEEK', true);
  vision.update(500, human, deepseek, openGeometry);
  assert.equal(vision.get('HUMAN').status, 'CONCEALED');
  assert.equal(vision.get('HUMAN').visible, false);
  assert.equal(vision.get('HUMAN').blocker, null);
  assert.equal(vision.get('HUMAN').lastSeen.timeMs, seenAt,
    '藏身不得刷新 Last Seen，只能让原记录自然过期');
  // DeepSeek 对 Human 的视觉保持现有逻辑（单向抑制，不是全局致盲）。
  assert.equal(vision.get('DEEPSEEK').status, 'VISIBLE');
  assert.equal(vision.get('DEEPSEEK').visible, true);

  vision.update(GAME_CONFIG.perception.lastSeenMs, human, deepseek, openGeometry);
  assert.equal(vision.get('HUMAN').lastSeen, null, '原记录到点后自然过期');
});

test('退出藏身立即恢复普通视觉，不保留额外免疫', () => {
  const vision = new VisionSystem();
  vision.setConcealed('DEEPSEEK', true);
  vision.update(0, human, deepseek, openGeometry);
  assert.equal(vision.get('HUMAN').status, 'CONCEALED');
  vision.setConcealed('DEEPSEEK', false);
  vision.update(0, human, deepseek, openGeometry);
  assert.equal(vision.get('HUMAN').status, 'VISIBLE');
  assert.equal(vision.get('HUMAN').visible, true);
  assert.ok(vision.get('HUMAN').lastSeen !== null);
  vision.reset();
  assert.equal(vision.isConcealed('DEEPSEEK'), false);
  assert.equal(vision.get('HUMAN').lastSeen, null);
});

test('藏身时普通抓捕资格为 false，既有结算把进度归零；退出后立刻恢复累计', () => {
  const match = new GameStateSystem(3_000, GAME_CONFIG.match.captureMs, 'PLAYING');
  // 抓捕圈的判定必须用真正落在捕获半径内的站位。
  const inReach = { x: 0.5, z: 0 };
  const eligible = isCaptureEligibleXZ(human, inReach, GAME_CONFIG.match.captureRadius, false);
  assert.equal(isInsideCaptureZoneXZ(human, inReach, GAME_CONFIG.match.captureRadius), true);
  assert.equal(eligible, true);

  match.advancePlaying(200, eligible, false);
  assert.equal(match.captureProgressMs, 200);
  // 藏身：ThreeGame 把资格门控为 false，不需要第二套抓捕规则。
  match.advancePlaying(16, false, false);
  assert.equal(match.captureProgressMs, 0);
  match.advancePlaying(100, eligible, false);
  assert.equal(match.captureProgressMs, 100);
});

test('Q 搜查命中走同一条结算路径（立即抓捕成功，不新建胜负系统）', () => {
  const playing = new GameStateSystem(3_000, GAME_CONFIG.match.captureMs, 'PLAYING');
  assert.equal(playing.forceCapture(), true);
  assert.equal(playing.phase, 'FINISHED');
  assert.deepEqual(playing.result, { winner: 'HUMAN', reason: 'CAPTURED', elapsedMs: 0 });

  const ready = new GameStateSystem(3_000, GAME_CONFIG.match.captureMs, 'READY');
  assert.equal(ready.forceCapture(), false);
  assert.equal(ready.result, null);
  assert.equal(ready.phase, 'READY');
});

test('Human AI 不得读取藏身占用信息，DeepSeek AI 藏身也只能用公开信息', () => {
  const read = name => readFileSync(new URL(`../src/systems/${name}`, import.meta.url), 'utf8');
  const humanAi = read('HumanAIController.ts');
  const deepseekAi = read('DeepSeekAIController.ts');
  for (const [name, source] of [['HumanAIController', humanAi],
    ['DeepSeekAIController', deepseekAi]]) {
    assert.doesNotMatch(source, /HideSystem|occupancyOf|isConcealed/,
      `${name} 只能使用系统授予的感知信息，不得读取藏身占用`);
  }
  const union = deepseekAi.match(/export type DeepSeekAIState =([^;]+);/);
  assert.ok(union, '找不到 DeepSeekAIState 联合类型');
  // S7C-2b（用户本轮明确授权）：DeepSeek AI **获得**了自主藏身能力，因此这里不再
  // 断言「不得新增藏身状态」，而是断言它只能用**一个**状态 + 相位表达：
  // 走位 / 藏身 / 退出不得被拆成三个新的顶层状态。
  assert.match(union[1], /HIDE/, 'S7C-2b 之后 HIDE 是正式授权的顶层状态');
  const phases = deepseekAi.match(/export type DeepSeekHidePhase =([^;]+);/);
  assert.ok(phases, '找不到 DeepSeekHidePhase 相位联合类型');
  assert.match(phases[1], /'NONE'[\s\S]*'TRAVEL'[\s\S]*'CONCEALED'[\s\S]*'EXIT'/,
    '藏身相位必须沿用 NONE / TRAVEL / CONCEALED / EXIT 的同构写法');
  assert.doesNotMatch(union[1], /TRAVEL|CONCEALED|EXIT/,
    '走位 / 藏身 / 退出只能是 HIDE 内的相位，不得拆成新的顶层状态');
  // S7C-2：CHECK_HIDE 已经是真正的运行状态（不再是纯预留），但它的输入与命令
  // 仍然只能携带公开线索 —— 结构上不允许出现占用或隐藏坐标字段。
  assert.match(humanAi, /CHECK_HIDE/);
  assert.match(humanAi, /checkHide/);
  const interfaceBlock = (source, name) => {
    const match = source.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(match, `找不到 ${name} 接口`);
    return match[1];
  };
  // 这条守卫针对的是**字段结构**，不是注释措辞：先剥掉注释再查字段名，避免
  // 「注释里恰好写了 hidden 一词」被误判，也避免有人用注释掩盖真实字段。
  const fieldsOnly = source => source.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const forbidden = /occupan|conceal|concealed|occupied|hidden|realPosition|truePosition/i;
  assert.doesNotMatch(fieldsOnly(interfaceBlock(humanAi, 'HumanAIInput')), forbidden,
    'Human AI 输入里不得出现占用或隐藏坐标字段');
  assert.doesNotMatch(fieldsOnly(interfaceBlock(humanAi, 'HumanAICommand')), forbidden,
    'Human AI 命令里不得出现占用或隐藏坐标字段');
  assert.doesNotMatch(fieldsOnly(interfaceBlock(humanAi, 'HumanAIMapSnapshot')), forbidden,
    'Human AI 地图快照里不得出现占用或隐藏坐标字段');
  // 候选排序是反作弊最关键的一层：它的输入结构同样不许带占用信息。
  const candidates = read('HideSearchCandidates.ts');
  assert.doesNotMatch(fieldsOnly(interfaceBlock(candidates, 'HideSearchCandidateInput')),
    forbidden, '公开候选排序的输入里不得出现占用或隐藏坐标字段');
  assert.match(candidates, /pointInHideRegion|rectSurfacePoint/,
    '候选排序必须复用已批准的公开几何判定');
  // S7C-2b：DeepSeek 自主藏身的公开层同样适用同一条反作弊边界——AI 的输入、命令
  // 与候选结构里都不允许出现占用或对手真值字段，AI 只拿得到「自己的」藏身事实。
  for (const name of ['DeepSeekAIInput', 'DeepSeekAICommand']) {
    assert.doesNotMatch(fieldsOnly(interfaceBlock(deepseekAi, name)), forbidden,
      `${name} 里不得出现占用或隐藏坐标字段`);
  }
  const deepseekCandidates = read('DeepSeekHideCandidates.ts');
  for (const name of ['DeepSeekHideCandidateInput', 'DeepSeekHideCooldown',
    'DeepSeekHideRecentSpot', 'DeepSeekHideSpotSnapshot', 'DeepSeekHideMapSnapshot']) {
    assert.doesNotMatch(fieldsOnly(interfaceBlock(deepseekCandidates, name)), forbidden,
      `${name} 里不得出现占用或隐藏坐标字段`);
  }
  const resolution = read('DeepSeekHideResolution.ts');
  assert.doesNotMatch(resolution, /occupancyOf|readOccupancy|concealedSpotId/,
    'AI 藏身的权威层不得读取任何藏身点占用真相');
  // S7C-2b 红线：玩家专用的指向型白色轮廓与按键仲裁属于**表现层 / 玩家输入**，
  // 不得被移植进 NPC 决策系统。
  for (const [name, source] of [['DeepSeekAIController', deepseekAi],
    ['DeepSeekHideCandidates', deepseekCandidates],
    ['DeepSeekHideResolution', resolution]]) {
    assert.doesNotMatch(source,
      /DeepSeekVisualTarget|HideSearchView|resolvePlayerQPlan|HideInteractionArbitration/,
      `${name} 不得引用玩家专用的白色轮廓或按键仲裁`);
  }
});
