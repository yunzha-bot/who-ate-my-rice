import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RuntimeDebugOverrides, RUNTIME_PARAM_SPECS }
  from '../src/systems/RuntimeDebugOverrides.ts';
import { buildDevBObservation } from '../src/systems/DevBObserver.ts';
import { DevBView, DEV_B_DEFAULT_OPTIONS, DEV_B_MAX_CLUE_MARKERS,
  DEV_B_MAX_SOUND_MARKERS, DEV_B_MAX_SUSPECT_MARKERS }
  from '../src/three/DevBView.ts';
import { DEV_B_KNOWN_LIMITS, DEV_B_VISUAL_LABELS, devBParamStatusText }
  from '../src/three/DevBPanel.ts';

function frame(overrides = {}) {
  return {
    captureRadius: 0.7,
    visionRange: 11,
    human: { x: 0, z: 0 },
    deepseek: { x: 2, z: 0 },
    vision: { status: 'VISIBLE', visible: true },
    humanTarget: { x: 1, z: 1 },
    deepseekTarget: { x: 3, z: 3 },
    humanPath: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }],
    deepseekPath: [{ x: 2, z: 0 }, { x: 3, z: 1 }],
    sounds: [],
    // S7C-2：AI 已知线索 / AI 推断方向 / AI 推断怀疑家具（全部是公开信息）。
    clues: [{ x: 1, z: 2 }],
    inferenceAnchor: { x: 1, z: 2 },
    inferenceDirection: { x: 1, z: 0 },
    suspects: [{ x: 7.9, z: 3.9 }],
    ...overrides,
  };
}

test('the DEV-B view creates its draw objects once and reuses them', () => {
  const scene = new THREE.Scene();
  const view = new DevBView(scene);
  const objects = view.objectCount;
  assert.equal(scene.children.length, 1);
  for (let index = 0; index < 5; index++)
    view.update(frame({ captureRadius: 0.7 + index * 0.2 }));
  assert.equal(view.objectCount, objects, '每帧不得重建绘制对象');
  assert.equal(scene.children.length, 1);
  view.dispose();
});

test('the capture ring and the vision circle follow the effective radii', () => {
  const scene = new THREE.Scene();
  const view = new DevBView(scene);
  const [captureMesh, visionRing] = view.group.children;
  view.setOptions({ captureRing: true, visionCircle: true });
  view.update(frame({ captureRadius: 1.5, visionRange: 18, human: { x: 3, z: 4 } }));
  assert.equal(captureMesh.scale.x, 1.5);
  assert.deepEqual([captureMesh.position.x, captureMesh.position.z], [3, 4]);
  assert.equal(visionRing.scale.x, 18);
  assert.equal(visionRing.visible, true);

  view.update(frame({ captureRadius: 0.9, visionRange: 6, human: { x: -2, z: 1 } }));
  assert.equal(captureMesh.scale.x, 0.9);
  assert.equal(visionRing.scale.x, 6, '同一对象更新，不留下旧圈');
  view.dispose();
});

test('each visualization switch hides only its own layer', () => {
  const scene = new THREE.Scene();
  const view = new DevBView(scene);
  const [captureMesh, visionRing, sightLine, humanPath] = view.group.children;
  view.update(frame());
  assert.equal(captureMesh.visible, DEV_B_DEFAULT_OPTIONS.captureRing);
  assert.equal(visionRing.visible, DEV_B_DEFAULT_OPTIONS.visionCircle);
  assert.equal(sightLine.visible, DEV_B_DEFAULT_OPTIONS.lineOfSight);
  assert.equal(humanPath.visible, true);

  view.setOptions({ lineOfSight: false, paths: false });
  view.update(frame());
  assert.equal(sightLine.visible, false);
  assert.equal(humanPath.visible, false);
  assert.equal(captureMesh.visible, true);
  view.dispose();
});

test('paths use the real node count and the line of sight follows the real status', () => {
  const scene = new THREE.Scene();
  const view = new DevBView(scene);
  const [, , sightLine, humanPath, deepseekPath] = view.group.children;
  view.update(frame({ humanPath: [{ x: 0, z: 0 }, { x: 1, z: 1 }],
    deepseekPath: [], vision: { status: 'BLOCKED', visible: false } }));
  assert.equal(humanPath.geometry.drawRange.count, 2);
  assert.equal(deepseekPath.geometry.drawRange.count, 0);
  assert.equal(sightLine.material.color.getHex(), 0xff8a5c);

  view.update(frame({ vision: { status: 'VISIBLE', visible: true } }));
  assert.equal(sightLine.material.color.getHex(), 0x9dff7a);
  const positions = sightLine.geometry.getAttribute('position');
  assert.deepEqual([positions.getX(0), positions.getZ(0)], [0, 0]);
  assert.deepEqual([positions.getX(1), positions.getZ(1)], [2, 0]);
  view.dispose();
});

test('sound markers mirror the real events and hide the unused slots', () => {
  const scene = new THREE.Scene();
  const view = new DevBView(scene);
  const markers = view.group.children.slice(-DEV_B_MAX_SOUND_MARKERS);
  view.update(frame({ sounds: [
    { type: 'FOOTSTEP', x: 1, z: 2, range: 17, heard: true },
    { type: 'SPRINT', x: -3, z: 4, range: 18, heard: false },
  ] }));
  assert.equal(markers[0].visible, true);
  assert.equal(markers[0].scale.x, 17);
  assert.deepEqual([markers[0].position.x, markers[0].position.z], [1, 2]);
  assert.equal(markers[0].material.color.getHex(), 0xffe066);
  assert.equal(markers[1].material.color.getHex(), 0xffa3d1);
  assert.equal(markers[2].visible, false);

  view.update(frame());
  assert.equal(markers[0].visible, false, '事件过期后不留标记');
  view.dispose();
});

test('S7C-2 clue, inference and suspect markers draw only public information', () => {
  const scene = new THREE.Scene();
  const view = new DevBView(scene);
  const children = view.group.children;
  const clueStart = children.length - DEV_B_MAX_SOUND_MARKERS -
    (DEV_B_MAX_SUSPECT_MARKERS + 2) - DEV_B_MAX_CLUE_MARKERS;
  assert.ok(clueStart > 0, '线索标记必须排在声音标记之前，既有片尾断言才成立');
  view.update(frame({ clues: [{ x: 5, z: 6 }, { x: 5.7, z: 6.4 }],
    suspects: [{ x: 7.9, z: 3.9 }], inferenceAnchor: { x: 5.7, z: 6.4 },
    inferenceDirection: { x: 0, z: 1 } }));
  const clues = children.slice(clueStart, clueStart + DEV_B_MAX_CLUE_MARKERS);
  assert.equal(clues[0].visible, true);
  assert.deepEqual([clues[0].position.x, clues[0].position.z], [5, 6]);
  assert.equal(clues[0].material.color.getHex(), 0x7dff8f, '绿色 = AI 已知线索');
  assert.equal(clues[2].visible, false, '未使用的线索槽必须隐藏');

  const suspects = children.slice(clueStart + DEV_B_MAX_CLUE_MARKERS,
    clueStart + DEV_B_MAX_CLUE_MARKERS + DEV_B_MAX_SUSPECT_MARKERS);
  assert.equal(suspects[0].visible, true);
  assert.deepEqual([suspects[0].position.x, suspects[0].position.z], [7.9, 3.9]);
  assert.equal(suspects[0].material.color.getHex(), 0xff5fd0, '洋红 = AI 推断的怀疑家具');
  assert.equal(suspects[1].visible, false);

  const arrow = children[clueStart + DEV_B_MAX_CLUE_MARKERS + DEV_B_MAX_SUSPECT_MARKERS];
  assert.equal(arrow.visible, true);
  const positions = arrow.geometry.getAttribute('position');
  // Float32 缓冲，用容差比较（几何体存的是单精度）。
  const near = (value, wanted) => assert.ok(Math.abs(value - wanted) < 1e-4,
    `期望 ${wanted}，实际 ${value}`);
  near(positions.getX(0), 5.7);
  near(positions.getZ(0), 6.4);
  near(positions.getX(1), 5.7);
  near(positions.getZ(1), 8.4);

  // 关闭 clues 图层后，三类标记都必须消失，且不影响其它图层。
  view.setOptions({ clues: false });
  view.update(frame({ sounds: [{ type: 'FOOTSTEP', x: 1, z: 2, range: 17, heard: true }] }));
  assert.equal(clues[0].visible, false);
  assert.equal(suspects[0].visible, false);
  assert.equal(arrow.visible, false);
  assert.equal(children[0].visible, true, '抓捕圈不受 clues 开关影响');
  assert.equal(children.slice(-DEV_B_MAX_SOUND_MARKERS)[0].visible, true);
  view.dispose();
});

test('disposing the DEV-B view leaves no draw object behind', () => {  const scene = new THREE.Scene();
  const view = new DevBView(scene);
  view.update(frame({ sounds: [{ type: 'FALL', x: 0, z: 0, range: 10, heard: true }] }));
  view.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(view.group.children.length, 0);
});

// S7C-2：DEV-B 观察里的 Human AI 循迹 / 搜查字段（AI 已知 + AI 推断 + 公开计数）。
function hideSearch(overrides = {}) {
  return {
    clueCount: 2, expiredClueCount: 0,
    latestCluePosition: { x: 3, z: 4 }, latestClueAgeMs: 1_200,
    inferenceCode: 'CHAIN', inferenceConfidence: 'HIGH',
    inferenceHeadingDeg: 32, inferenceAnchor: { x: 3, z: 4 },
    inferenceBasis: '连续 3 粒米构成一条路径',
    candidateRanking: 'hide_living_carton(12.4) > hide_storage_carton(9.1)',
    suspectedSpotId: 'hide_living_carton', suspectedBasis: '距线索锚点最近',
    candidateSkipped: 'hide_storage_carton=COOLDOWN',
    pendingClueCount: 0, pendingClueRemainingMs: 0, pendingClueDeferReason: 'NONE',
    pendingClueDeferCount: 0, pendingClueReevalCount: 0,
    lastSeenPresent: true, lastSeenValid: true, lastSeenPosition: { x: 3, z: 4 },
    lastSeenRoomId: 'living', lastSeenAgeMs: 1_200,
    lastSeenRoomGateCode: 'OK', lastSeenRoomGateDetail: '最后目击房间 living 里有公开藏身点',
    roundAttempts: 1, attemptedSpotId: 'hide_living_carton',
    investigationEndReason: 'CHECK_HIDE_MISS',
    interruptSoundType: 'SPRINT', interruptSoundStrength: 0.28,
    interruptSoundRemainingMs: 1_150, interruptSoundIsNew: true,
    checkResult: 'MISS', checkDetailText: '这件家具里没有人（搜空）',
    plannedSurfacePoint: { x: 7.6, z: 3.6 }, finalAimPoint: { x: 7.6, z: 3.6 },
    aimPointDelta: 0, aimAngleDeltaDeg: 0, aimBlocked: false,
    authoritativeCode: 'MISS_EMPTY', authoritativeDetail: '检查 hide_living_carton：搜空',
    phase: 'DWELL', source: 'TRACE', spotId: 'hide_living_carton',
    stancePoint: { x: 7.3, z: 3.6 }, surfacePoint: { x: 7.6, z: 3.6 },
    // S7C-2 修复轮 二：导航终点 / 正式站位 / REQUEST 位置 / 计数与「是否计入正式检查」。
    navGoal: { x: 7.0, z: 3.6 }, stanceDistance: 0.174,
    requestPosition: { x: 7.3, z: 3.6 },
    approachSteps: 0, requestCount: 1, staleCancels: 0, countsAsFormalCheck: true,
    dwellRemainingMs: 400, dwellMs: 900,
    roundChecks: 1, roundBudget: 1, investigationChecks: 1,
    checkedSpotIds: ['hide_living_carton'],
    cooldowns: [{ spotId: 'hide_living_carton', remainingMs: 4_200 }],
    lastResult: 'MISS', lastResultSpotId: 'hide_living_carton',
    giveUpCode: 'CHECK_DONE', giveUpDetail: 'hide_living_carton 搜空',
    startCount: 2, hitCount: 0, missCount: 1, interruptCount: 1,
    ...overrides,
  };
}

function observation(overrides = {}) {
  return {
    phase: 'PLAYING',
    playerFaction: 'DEEPSEEK',
    controlledFaction: 'DEEPSEEK',
    temporaryTarget: null,
    humanAiRunning: true,
    deepseekAiRunning: false,
    human: { x: 0, z: 0 },
    deepseek: { x: 1, z: 1 },
    vision: { status: 'VISIBLE', blocker: null, visible: true,
      lastSeen: { position: { x: 1, z: 1 }, ageMs: 200, remainingMs: 7_800 } },
    capture: { radius: 0.7, distance: 1.4, insideRadius: false, blocked: false,
      eligible: false, progressMs: 0, holdMs: 350 },
    hearing: null,
    sounds: [],
    paths: { human: [{ x: 0, z: 0 }], deepseek: [] },
    humanAi: {
      state: 'CHASE', target: { x: 1, z: 1 }, targetRoomId: 'living', lockDecision: 'NONE',
      targetDoorId: null, decisionReason: 'NO_LOCK_ROUTE', unlockProgressMs: 0,
      searchTargetRoomId: null, navigationReason: 'NONE', transitionReason: 'ROUND_START',
      pathIndex: 0, pathTotal: 3, pathWaypoint: { x: 0, z: 0 },
      hideSearch: hideSearch(),
    },
    deepseekAi: {
      state: 'SEEK_RICE', targetRiceId: 'rice_01', selectionReason: 'SHORTEST',
      navigationReason: 'NONE', transitionReason: 'ROUND_START', threatSource: 'NONE',
      threatLevel: 'NONE', escapeTarget: null, escapeRoomId: null,
      noMovementReason: 'NONE', sprintDecision: 'READY', recoveryBlockReason: 'NONE',
      safeWaitReason: 'NONE', safeWaitRemainingMs: 0, curiosityRemainingMs: 0,
      passageActive: false, pathIndex: null, pathTotal: null, pathWaypoint: null,
    },
    sprint: { state: 'NORMAL', sprintRemainingMs: 0, stunRemainingMs: 0,
      cooldownRemainingMs: 0, riskMode: 'SAFE' },
    rice: { completedCount: 1, total: 5, ratio: 0.2, targetId: 'rice_01' },
    movement: { playerSpeed: 230, humanSpeed: 248.4, humanAiSpeed: 228.528 },
    ...overrides,
  };
}

test('the observation covers the requested read-only fields', () => {
  const sections = buildDevBObservation(observation());
  assert.deepEqual(sections.map(section => section.id),
    ['control', 'human-ai', 'deepseek-ai', 'perception', 'movement']);
  const labels = sections.flatMap(section => section.entries.map(entry => entry.label));
  for (const wanted of ['AI 状态', '当前目标点', '目标距离', '导航目标 / 路径', '最近导航原因',
    '最近声音事件', '抓捕半径（有效值）', '抓捕资格', '累计抓捕进度', '最后一次看到（Last Seen）',
    '当前目标米堆', '冲刺状态', '大米进度']) {
    assert.ok(labels.includes(wanted), `缺少状态字段：${wanted}`);
  }
  const text = sections.flatMap(section => section.entries.map(entry => entry.value)).join('\n');
  assert.match(text, /面板暂时看不到/, '未暴露的内部计时必须明确标注');
  assert.match(text, /家具不参与视觉遮挡/);
  assert.match(text, /追逐（CHASE）/, '内部状态码必须以「中文（原代码）」显示');
  assert.match(text, /对局中（PLAYING）/);
  assert.match(text, /看得见（VISIBLE）/);
});

test('missing data is reported as unavailable instead of being invented', () => {
  const sections = buildDevBObservation(observation({
    hearing: null,
    humanAi: null,
    deepseekAi: null,
    vision: { status: 'BLOCKED', blocker: 'Wall', visible: false, lastSeen: null },
  }));
  const text = sections.flatMap(section => section.entries.map(entry => entry.value)).join('\n');
  assert.match(text, /当前没有听到任何声音/);
  assert.match(text, /当前没有声音可以分析/);
  assert.match(text, /当前未运行（Human 由玩家控制）/);
  assert.match(text, /当前未运行（DeepSeek 由玩家控制）/);
  assert.match(text, /还没有看到过对方/);
  assert.match(text, /被挡住（BLOCKED）｜阻挡物：Wall/);
  assert.doesNotMatch(text, /^(不适用|当前无目标|暂不可观测|无)$/m,
    '没有数据时必须写通俗中文，不能只显示内部标记');
});

test('the observation never mutates the real state it reads', () => {
  const input = observation();
  const before = JSON.stringify(input);
  buildDevBObservation(input);
  buildDevBObservation(input);
  assert.equal(JSON.stringify(input), before);
});

test('the four control combinations are reported from real running flags', () => {
  const modes = (values) => buildDevBObservation(observation(values))
    .find(section => section.id === 'control').entries
    .filter(entry => entry.label.endsWith('运行模式'))
    .map(entry => `${entry.label}:${entry.value}`);
  assert.deepEqual(modes({ humanAiRunning: true, deepseekAiRunning: false,
    controlledFaction: 'DEEPSEEK', temporaryTarget: null }),
  ['Human 运行模式:AI 自主运行', 'DeepSeek 运行模式:玩家手动控制']);
  assert.deepEqual(modes({ humanAiRunning: false, deepseekAiRunning: true,
    controlledFaction: 'HUMAN', temporaryTarget: null }),
  ['Human 运行模式:玩家手动控制', 'DeepSeek 运行模式:AI 自主运行']);
  assert.deepEqual(modes({ humanAiRunning: false, deepseekAiRunning: false,
    controlledFaction: 'DEEPSEEK', temporaryTarget: 'HUMAN' }),
  ['Human 运行模式:DEV 临时输入接管', 'DeepSeek 运行模式:玩家手动控制']);
  assert.deepEqual(modes({ humanAiRunning: false, deepseekAiRunning: false,
    controlledFaction: null, temporaryTarget: null }),
  ['Human 运行模式:未运行', 'DeepSeek 运行模式:未运行']);
});

test('the panel helpers describe base and overridden values and the known limits', () => {
  const runtime = new RuntimeDebugOverrides();
  const spec = RUNTIME_PARAM_SPECS.find(value => value.id === 'capture.radius');
  assert.match(devBParamStatusText(spec, spec.base, false), /正式基准：0.7 世界单位/);
  runtime.set('capture.radius', 1.25);
  assert.match(devBParamStatusText(spec, runtime.captureRadius, true), /已覆盖：1.25/);

  assert.deepEqual(DEV_B_VISUAL_LABELS.map(entry => entry.key),
    ['captureRing', 'visionCircle', 'lineOfSight', 'paths', 'sounds', 'clues']);
  const limits = DEV_B_KNOWN_LIMITS.join('\n');
  assert.match(limits, /家具/);
  assert.match(limits, /视锥角/);
  assert.match(limits, /CHECK_HIDE/);
  assert.match(limits, /只读/);
});
