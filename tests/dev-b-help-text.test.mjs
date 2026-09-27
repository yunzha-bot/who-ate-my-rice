import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNTIME_PARAM_SPECS, RUNTIME_SOUND_TYPES }
  from '../src/systems/RuntimeDebugOverrides.ts';
import { buildDevBObservation } from '../src/systems/DevBObserver.ts';
import {
  DEV_B_GROUP_HELP,
  DEV_B_PLAIN_NONE,
  DEV_B_SECTION_HELP,
  DEV_B_VALUE_GLOSS,
  PARAM_HELP_IDS,
  SOUND_TYPE_NAMES,
  devBGlossValue,
  devBParamTimingText,
  devBParamTooltip,
  devBReasonText,
  devBSoundTypeText,
  devBYesNo,
  observationHelp,
  paramHelp,
  soundTypeName,
} from '../src/systems/DevBHelpText.ts';

// DEV-B 易用性优化轮的文案回归：说明必须覆盖到每一个参数与每一个状态字段，
// 且不能让内部代码裸露给普通使用者。

function fullObservation(overrides = {}) {
  return {
    phase: 'PLAYING',
    playerFaction: 'DEEPSEEK',
    controlledFaction: 'DEEPSEEK',
    temporaryTarget: null,
    humanAiRunning: true,
    deepseekAiRunning: true,
    human: { x: 0, z: 0 },
    deepseek: { x: 1, z: 1 },
    vision: { status: 'VISIBLE', blocker: null, visible: true,
      lastSeen: { position: { x: 1, z: 1 }, ageMs: 200, remainingMs: 7_800 } },
    capture: { radius: 0.7, distance: 1.4, insideRadius: false, blocked: true,
      eligible: true, progressMs: 500, holdMs: 350 },
    hearing: { heard: true, type: 'FOOTSTEP', audibleStrength: 0.2, distanceFactor: 0.5,
      occlusionMultiplier: 1, occlusion: '无遮挡', direction: '左前方', remainingMs: 900 },
    sounds: [{ type: 'FOOTSTEP', x: 0, z: 0, range: 17, remainingMs: 900, heard: true }],
    paths: { human: [{ x: 0, z: 0 }, { x: 1, z: 1 }], deepseek: [{ x: 1, z: 1 }] },
    humanAi: {
      state: 'CHASE', target: { x: 1, z: 1 }, targetRoomId: 'living', lockDecision: 'UNLOCK',
      targetDoorId: 'door_01', decisionReason: 'NO_LOCK_ROUTE', unlockProgressMs: 1_200,
      searchTargetRoomId: 'study', navigationReason: 'NONE', transitionReason: 'ROUND_START',
      pathIndex: 0, pathTotal: 2, pathWaypoint: { x: 0, z: 0 },
      hideSearch: {
        clueCount: 2, expiredClueCount: 1,
        latestCluePosition: { x: 3, z: 4 }, latestClueAgeMs: 1_200,
        inferenceCode: 'CHAIN', inferenceConfidence: 'HIGH',
        inferenceHeadingDeg: 32, inferenceAnchor: { x: 3, z: 4 },
        inferenceBasis: '连续 3 粒米构成一条路径',
        candidateRanking: 'hide_living_carton(12.4) > hide_storage_carton(9.1)',
        suspectedSpotId: 'hide_living_carton', suspectedBasis: '距线索锚点最近',
        candidateSkipped: 'hide_storage_carton=COOLDOWN',
        pendingClueCount: 2, pendingClueRemainingMs: 4_200,
        pendingClueDeferReason: 'TARGET_VISIBLE',
        pendingClueDeferCount: 1, pendingClueReevalCount: 0,
        lastSeenPresent: true, lastSeenValid: true,
        lastSeenPosition: { x: 3, z: 4 }, lastSeenRoomId: 'living',
        lastSeenAgeMs: 1_200, lastSeenRoomGateCode: 'OK',
        lastSeenRoomGateDetail: '最后目击房间 living 里有公开藏身点',
        roundAttempts: 1, attemptedSpotId: 'hide_living_carton',
        investigationEndReason: 'CHECK_HIDE_MISS',
        interruptSoundType: 'SPRINT', interruptSoundStrength: 0.28,
        interruptSoundRemainingMs: 1_150, interruptSoundIsNew: true,
        checkResult: 'MISS', checkDetailText: '这件家具里没有人（搜空）',
        plannedSurfacePoint: { x: 7.6, z: 3.6 }, finalAimPoint: { x: 7.6, z: 3.6 },
        aimPointDelta: 0, aimAngleDeltaDeg: 0, aimBlocked: false,
        authoritativeCode: 'MISS_EMPTY',
        authoritativeDetail: '检查 hide_living_carton：搜空',
        phase: 'DWELL', source: 'TRACE', spotId: 'hide_living_carton',
        stancePoint: { x: 7.3, z: 3.6 }, surfacePoint: { x: 7.6, z: 3.6 },
        navGoal: { x: 7.0, z: 3.6 }, stanceDistance: 0.174,
        requestPosition: { x: 7.3, z: 3.6 },
        approachSteps: 0, requestCount: 1, staleCancels: 0,
        countsAsFormalCheck: true,
        dwellRemainingMs: 400, dwellMs: 900,
        roundChecks: 1, roundBudget: 1, investigationChecks: 1,
        checkedSpotIds: ['hide_living_carton'],
        cooldowns: [{ spotId: 'hide_living_carton', remainingMs: 4_200 }],
        lastResult: 'MISS', lastResultSpotId: 'hide_living_carton',
        giveUpCode: 'CHECK_DONE', giveUpDetail: 'hide_living_carton 搜空',
        startCount: 2, hitCount: 0, missCount: 1, interruptCount: 1,
      },
    },
    deepseekAi: {
      state: 'EVADE', targetRiceId: 'rice_01', selectionReason: 'SHORTEST',
      navigationReason: 'NONE', transitionReason: 'ROUND_START', threatSource: 'VISION',
      threatLevel: 'HIGH', escapeTarget: { x: 2, z: 2 }, escapeRoomId: 'kitchen',
      noMovementReason: 'NONE', sprintDecision: 'READY', recoveryBlockReason: 'NONE',
      safeWaitReason: 'NONE', safeWaitRemainingMs: 0, curiosityRemainingMs: 300,
      passageActive: true, pathIndex: 0, pathTotal: 1, pathWaypoint: { x: 1, z: 1 },
    },
    sprint: { state: 'SPRINT_RUNNING', sprintRemainingMs: 1_000, stunRemainingMs: 0,
      cooldownRemainingMs: 29_000, riskMode: 'FALL_ON_END' },
    rice: { completedCount: 1, total: 5, ratio: 0.2, targetId: 'rice_01' },
    movement: { playerSpeed: 230, humanSpeed: 248.4, humanAiSpeed: 228.528 },
    ...overrides,
  };
}

function emptyObservation() {
  return fullObservation({
    playerFaction: null,
    controlledFaction: null,
    temporaryTarget: null,
    humanAiRunning: false,
    deepseekAiRunning: false,
    humanAi: null,
    deepseekAi: null,
    hearing: null,
    sounds: [],
    vision: { status: 'BLOCKED', blocker: 'Wall', visible: false, lastSeen: null },
    capture: { radius: 0.7, distance: 9, insideRadius: false, blocked: false,
      eligible: false, progressMs: 0, holdMs: 350 },
    paths: { human: [], deepseek: [] },
    sprint: { state: 'NORMAL', sprintRemainingMs: 0, stunRemainingMs: 0,
      cooldownRemainingMs: 0, riskMode: null },
    rice: { completedCount: 0, total: 5, ratio: 0, targetId: null },
  });
}

test('every tunable parameter has a short Chinese explanation', () => {
  assert.equal(PARAM_HELP_IDS.length, RUNTIME_PARAM_SPECS.length);
  for (const spec of RUNTIME_PARAM_SPECS) {
    const help = paramHelp(spec.id);
    assert.ok(help, `参数缺少中文说明：${spec.id}`);
    for (const [key, text] of Object.entries({ what: help.what, increase: help.increase,
      decrease: help.decrease, english: help.english })) {
      assert.ok(text.trim().length > 0, `${spec.id} 的 ${key} 不能为空`);
    }
    assert.ok(help.what.length <= 40, `${spec.id} 的「它是什么」要简短：${help.what}`);
    assert.ok(help.increase.length <= 40, `${spec.id} 的「调大」要简短：${help.increase}`);
    assert.ok(help.decrease.length <= 40, `${spec.id} 的「调小」要简短：${help.decrease}`);
    assert.match(help.english, /GAME_CONFIG|match\.|perception\.|player\.|human/,
      `${spec.id} 必须给出可对照的配置键`);
  }
});

test('the timing line follows the real immediate flag and flags new-event fields', () => {
  for (const spec of RUNTIME_PARAM_SPECS) {
    const text = devBParamTimingText(spec);
    if (spec.immediate) {
      assert.match(text, /立刻生效/);
      assert.doesNotMatch(text, /只影响/);
    } else {
      assert.match(text, /只影响改动之后新产生的声音事件/,
        `${spec.id} 属于只影响新事件的参数，必须特别标明`);
    }
  }
  const soundRange = RUNTIME_PARAM_SPECS.find(spec => spec.id.startsWith('hearing.range.'));
  assert.equal(soundRange.immediate, false);
  assert.match(devBParamTimingText(soundRange), /已经在场的事件保留生成时的/);
  const capture = RUNTIME_PARAM_SPECS.find(spec => spec.id === 'capture.radius');
  assert.match(devBParamTimingText(capture), /立刻生效/);
});

test('the tooltip keeps the Chinese explanation and the real config key', () => {
  const capture = RUNTIME_PARAM_SPECS.find(spec => spec.id === 'capture.radius');
  const tooltip = devBParamTooltip(capture);
  assert.match(tooltip, /抓捕圈半径（世界单位）/);
  assert.match(tooltip, /配置键 GAME_CONFIG\.match\.captureRadius/);
  assert.match(tooltip, /它是什么|要贴到多近/);
  assert.match(tooltip, /调大：/);
  assert.match(tooltip, /调小：/);
  assert.match(tooltip, /何时生效：/);
  assert.match(tooltip, new RegExp(capture.effect.slice(0, 6)));
});

test('the group and section headings all have a short Chinese description', () => {
  const groups = [...new Set(RUNTIME_PARAM_SPECS.map(spec => spec.groupLabel))];
  assert.deepEqual(Object.keys(DEV_B_GROUP_HELP).sort(), groups.sort());
  for (const text of Object.values(DEV_B_GROUP_HELP))
    assert.ok(text.trim().length > 0 && text.length <= 30, `分组说明要简短：${text}`);

  const sections = buildDevBObservation(fullObservation()).map(section => section.id);
  assert.deepEqual(Object.keys(DEV_B_SECTION_HELP).sort(), [...sections].sort());
  for (const text of Object.values(DEV_B_SECTION_HELP))
    assert.ok(text.trim().length > 0 && text.length <= 30, `分区说明要简短：${text}`);
});

test('every observation field resolves to an explanation, in both data states', () => {
  const seen = new Set();
  for (const input of [fullObservation(), emptyObservation()]) {
    for (const section of buildDevBObservation(input)) {
      for (const entry of section.entries) {
        const help = observationHelp(section.id, entry.label);
        assert.ok(help, `状态字段缺少中文说明：${section.id}/${entry.label}`);
        assert.ok(help.what.trim().length > 0);
        assert.ok(help.field.trim().length > 0, `${entry.label} 必须给出内部字段名`);
        assert.ok(help.what.length <= 45, `${entry.label} 的说明要简短：${help.what}`);
        seen.add(`${section.id}/${entry.label}`);
      }
    }
  }
  // 两种数据状态合起来覆盖了「AI 未运行」与「AI 运行中」两套分支。
  assert.ok(seen.has('human-ai/Human AI'));
  assert.ok(seen.has('human-ai/AI 状态'));
  assert.ok(seen.has('deepseek-ai/DeepSeek AI'));
  assert.ok(seen.has('deepseek-ai/AI 状态'));
});

test('the observation never shows a bare internal sentinel as a value', () => {
  const textOf = input => buildDevBObservation(input)
    .flatMap(section => section.entries.map(entry => `${entry.label}=${entry.value}`))
    .join('\n');
  const empty = textOf(emptyObservation());
  const noTarget = textOf(fullObservation({
    humanAi: { ...fullObservation().humanAi, target: null, targetRoomId: null,
      searchTargetRoomId: null, targetDoorId: null },
    deepseekAi: { ...fullObservation().deepseekAi, targetRiceId: null,
      escapeTarget: null, escapeRoomId: null },
    rice: { completedCount: 0, total: 5, ratio: 0, targetId: null },
  }));
  for (const text of [empty, noTarget]) {
    for (const raw of ['不适用', '当前无目标', '暂不可观测', 'NONE', 'NO_TARGET'])
      assert.doesNotMatch(text, new RegExp(`=${raw}$`, 'm'), `不得只显示内部标记：${raw}`);
  }
  assert.match(empty, /当前没有听到任何声音/);
  assert.match(noTarget, /面板暂时看不到/);
  // 路径行只在 AI 运行中才存在，所以「没有路线」要用 AI 在跑但没路径的场景验证。
  assert.match(textOf(fullObservation({ paths: { human: [], deepseek: [] } })),
    /当前没有路线/);
  assert.match(noTarget, /当前没有追逐目标/);
  assert.match(noTarget, /当前没有目标房间/);
  assert.match(noTarget, /当前没有要搜索的房间/);
  assert.match(noTarget, /当前没有目标门/);
  assert.match(noTarget, /当前没有选中的米堆/);
  assert.match(noTarget, /当前没有在吃的米堆/);
  assert.match(noTarget, /当前不需要逃跑/);
});

test('internal state codes are shown as Chinese with the original code kept', () => {
  // 值列表来自源码里的联合类型（GameStateSystem / PerceptionSystem /
  // SprintSystem / HumanAIController / DeepSeekAIController）。
  const expected = {
    phase: ['FACTION_SELECT', 'READY', 'PLAYING', 'PAUSED', 'FINISHED'],
    visionStatus: ['VISIBLE', 'BLOCKED', 'OUT_OF_RANGE', 'CONCEALED'],
    sprintState: ['NORMAL', 'SPRINT_RUNNING', 'STUNNED'],
    sprintRisk: ['SAFE', 'FALL_ON_END'],
    humanAiState: ['PATROL', 'INVESTIGATE', 'CHASE', 'CAPTURE', 'SEARCH', 'CHECK_HIDE'],
    deepseekAiState: ['SEEK_RICE', 'MOVE_TO_RICE', 'EAT', 'RESELECT', 'EVADE',
      'RECOVER', 'SAFE_WAIT', 'CURIOUS_APPROACH', 'CURIOUS_OBSERVE', 'CURIOUS_PASSAGE'],
    humanLockDecision: ['NONE', 'DETOUR', 'UNLOCK', 'FORCE_BREAK'],
    threatSource: ['NONE', 'VISION', 'SOUND', 'LAST_SEEN', 'MEMORY'],
    threatLevel: ['NONE', 'CAUTION', 'HIGH'],
    // S7C-2 修复轮：搜查来源新增「最后目击房间」，另有两个新的公开原因码表。
    checkHidePhase: ['NONE', 'TRAVEL', 'DWELL', 'DONE'],
    checkHideSource: ['LAST_SEEN', 'SOUND', 'TRACE', 'SEARCH', 'LAST_SEEN_ROOM'],
    checkHideResult: ['NONE', 'HIT', 'MISS'],
    clueDeferReason: ['NONE', 'CHECK_HIDE', 'TARGET_VISIBLE', 'LAST_SEEN',
      'DANGER_SOUND', 'TRACE_INVESTIGATION'],
    lastSeenRoomGate: ['NONE', 'OK', 'NO_LAST_SEEN', 'EXPIRED_LAST_SEEN', 'NO_ROOM',
      'NO_PUBLIC_SPOT'],
  };
  for (const [kind, codes] of Object.entries(expected)) {
    for (const code of codes) {
      assert.ok(DEV_B_VALUE_GLOSS[kind]?.[code], `${kind} 缺少中文：${code}`);
      assert.equal(devBGlossValue(kind, code), `${DEV_B_VALUE_GLOSS[kind][code]}（${code}）`);
    }
    assert.deepEqual(Object.keys(DEV_B_VALUE_GLOSS[kind]).sort(), [...codes].sort(),
      `${kind} 的中文映射与源码联合类型不一致`);
  }
  // 没收录的代码保留原样，不猜一个可能是错的中文。
  assert.equal(devBGlossValue('humanAiState', 'BRAND_NEW_STATE'), 'BRAND_NEW_STATE');
  // 空值与 NONE 这类哨兵写成通俗中文。
  assert.equal(devBGlossValue('phase', null), DEV_B_PLAIN_NONE);
  assert.match(devBReasonText(null, 'NONE'), /没有触发特殊原因/);
  assert.equal(devBReasonText(null, 'ROUND_START'), 'ROUND_START');
});

test('every sound type has a Chinese name and keeps its code', () => {
  assert.deepEqual(Object.keys(SOUND_TYPE_NAMES).sort(), [...RUNTIME_SOUND_TYPES].sort());
  for (const type of RUNTIME_SOUND_TYPES) {
    assert.ok(soundTypeName(type) !== type, `${type} 缺少中文名`);
    assert.equal(devBSoundTypeText(type), `${SOUND_TYPE_NAMES[type]}（${type}）`);
  }
  assert.equal(devBSoundTypeText('UNKNOWN'), 'UNKNOWN');
  assert.equal(devBYesNo(true), '是');
  assert.equal(devBYesNo(false), '否');
});
