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

test('Human AI 不得读取藏身占用信息，DeepSeek AI 不得新增藏身行为', () => {
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
  assert.doesNotMatch(union[1], /HIDE|CONCEAL/, 'DeepSeek AI 不得新增藏身状态');
  // Human AI 的 CHECK_HIDE 仍然是保留接口：只有联合类型里出现，从未被赋值。
  assert.match(humanAi, /CHECK_HIDE/);
  assert.doesNotMatch(humanAi, /=\s*'CHECK_HIDE'/);
  assert.doesNotMatch(humanAi, /checkHide/i, '本轮不得实现 Human AI 的 CHECK_HIDE 决策');
});
