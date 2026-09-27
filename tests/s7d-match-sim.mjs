import { Box3, OrthographicCamera, Vector3 } from 'three';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { effectiveSpeeds } from '../src/systems/DevBRuntimeBinding.ts';
import { CollisionWorld, canInteractWithDoorXZ } from '../src/three/CollisionWorld.ts';
import { isCaptureEligibleXZ, isInsideCaptureZoneXZ } from '../src/three/CaptureZone.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem, doorIntersectsActor, distanceToDoorSegment, lockDoorFromCommand }
  from '../src/systems/DoorSystem.ts';
import { HumanDoorSkill } from '../src/systems/HumanDoorSkill.ts';
import { PerceptionGeometry, RiceTraceSystem, SoundEventSystem, VisionSystem }
  from '../src/systems/PerceptionSystem.ts';
import { HideSystem } from '../src/systems/HideSystem.ts';
import { HumanStillness } from '../src/systems/HumanStillness.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { RiceField } from '../src/systems/RiceField.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { AILogCollector } from '../src/systems/AILogCollector.ts';
import { HumanAIController, humanAiMovementSpeed }
  from '../src/systems/HumanAIController.ts';
import { DeepSeekAIController, isHumanPursuitSound }
  from '../src/systems/DeepSeekAIController.ts';
import { createDeepSeekHideMapSnapshot }
  from '../src/systems/DeepSeekHideCandidates.ts';
import { resolveDeepSeekAiHideEntry, humanBlocksHideExit }
  from '../src/systems/DeepSeekHideResolution.ts';
import { createHumanAiMapSnapshot, resolveHumanAiHideCheck }
  from '../src/systems/HumanHideSearchResolution.ts';
import { selectVisibleTraces } from '../src/systems/RiceTraceClues.ts';
import { resolveHideInteractionTarget } from '../src/systems/HideTargetResolution.ts';
import { createMatchSetup, seededRandom } from '../src/systems/MatchRandom.ts';
import { positionCameraOnTarget } from '../src/three/CameraRelativeMovement.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, RICE_CANDIDATES,
  ROOMS, WALLS, roomAt } from '../src/three/map/apartmentMap.ts';

/**
 * S7D：双阵营**整局**无头仿真器。
 *
 * 这是什么、不是什么（重要，报告中必须原样保留这层区分）：
 *   - 它是把 `ThreeGame.updatePlaying()` 里与玩法 / AI 有关的那条通路，用**同一批
 *     生产系统**（CollisionWorld / NavigationSystem / DoorSystem / RiceField /
 *     SprintSystem / GameStateSystem / HideSystem / PerceptionSystem / 两套 AI /
 *     权威藏身入口与搜查判定）在 Node 里重放，用来大批量跑整局并采集遥测。
 *   - 它**不是**真实游戏：没有渲染、没有 DOM、没有真人输入，帧步长固定 50 ms。
 *     因此它只能证明「逻辑层整局可推进到结算」，不能替代浏览器实机复核，更不是
 *     真人试玩。禁止把它写成实机记录。
 *   - 相机只有一个（与正式游戏一致）：它跟随**玩家阵营**，只用于把声音方位投影到
 *     八方向（`screenSoundDirection`），不向任何 AI 泄露坐标。
 */
export const DELTA_MS = 50;
const EPSILON = 1e-4;

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const BOXES = [...WALLS, ...FURNITURE].map(rect => new Box3(
  new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
  new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));

/** 与 `DoorView.closedCollisionBox()` 逐字相同的关闭门叶碰撞盒。 */
function closedDoorBox(node) {
  const halfWidth = node.rotation === 0 ? node.width / 2 : C.door.leafThickness / 2;
  const halfDepth = node.rotation === 0 ? C.door.leafThickness / 2 : node.width / 2;
  return new Box3(new Vector3(node.x - halfWidth, 0, node.z - halfDepth),
    new Vector3(node.x + halfWidth, C.door.leafHeight, node.z + halfDepth));
}

const RICE_POINT = new Map(RICE_CANDIDATES.map(rice => [rice.id, { x: rice.x, z: rice.z }]));

/**
 * 玩家（真人那一侧）的脚本策略。刻意只有三种，且全部**只使用玩家自己能看到的信息**
 * （自己的位置、公开米点、真实视觉 / Last Seen），不读对手的隐藏实时坐标。
 */
export const PLAYER_POLICIES = {
  /** 站桩：什么都不按。用于验证「另一侧 AI 能否独立把整局推到结算」。 */
  idle: () => ({ direction: { x: 0, y: 0 }, holdE: false, sprint: false }),
  /** 追逐：只追**当前看得见或最近看过**的对手，否则在房间里巡逻。 */
  pursue: (view) => {
    const target = view.visibleOpponent ?? view.lastSeenOpponent;
    if (!target) return { direction: view.roamDirection(), holdE: false, sprint: false };
    return { direction: view.follow(target, 900), holdE: false, sprint: true };
  },
  /** 找米进食：按公开米点走位，进范围后按住 E 原地进食。 */
  eat: (view) => {
    const target = view.unfinishedRice();
    if (!target) return { direction: { x: 0, y: 0 }, holdE: false, sprint: false };
    if (view.within(target, C.rice.interactionRange / C.three.pixelsPerUnit)) {
      return { direction: { x: 0, y: 0 }, holdE: true, sprint: false };
    }
    return { direction: view.follow(target, 900), holdE: false, sprint: false };
  },
  /** 漫游：像真人一样只在房间之间走动（不追、不吃），用于「玩家在动」的整局。 */
  wander: (view) => ({ direction: view.roamDirection(), holdE: false, sprint: false }),
  /**
   * 先压后弃：前 20 秒像 `pursue` 一样贴身追（把 AI 逼进逃跑 / 藏身），之后放弃并
   * 只在房间之间漫游。用来真实触发「AI 藏身后自行退出并恢复找米」，而不是只验证藏进去。
   */
  pressure: (view, memory) => {
    memory.pressureMs = (memory.pressureMs ?? 0) + DELTA_MS;
    const target = view.visibleOpponent ?? view.lastSeenOpponent;
    if (memory.pressureMs <= 20_000 && target) {
      return { direction: view.follow(target, 900), holdE: false, sprint: true };
    }
    if (memory.pressureMs <= 20_000) {
      return { direction: view.roamDirection(), holdE: false, sprint: false };
    }
    return { direction: view.roamDirection(), holdE: false, sprint: false };
  },
  /**
   * 会躲的吃米玩家：挑**离已知对手最远**的未完成米堆；目视对手且过近就先跑开。
   * 这是「会玩的一方」的驱动，用来让 Human AI 有机会进入调查 / 循迹 / 搜查家具。
   */
  evadeEat: (view) => {
    const threat = view.visibleOpponent;
    if (threat && view.selfDistanceTo(threat) < 4.5) {
      return { direction: view.awayFrom(threat), holdE: false, sprint: true };
    }
    const target = view.unfinishedRice(view.knownOpponent);
    if (!target) return { direction: { x: 0, y: 0 }, holdE: false, sprint: false };
    if (view.within(target, C.rice.interactionRange / C.three.pixelsPerUnit)) {
      return { direction: { x: 0, y: 0 }, holdE: true, sprint: false };
    }
    return { direction: view.follow(target, 900), holdE: false, sprint: false };
  },
  /**
   * 会躲会吃的玩家（带记忆的两段行为）：开局先去最近的家具藏身点藏起来（谨慎开局），
   * 藏够 15 秒或对手已离开视野就出来吃米；之后只要目视对手在 8 u 内就再藏一次。
   * 它让 Human AI 有机会真正进入「检查藏身家具」。
   */
  hideEat: (view, memory) => {
    const zero = { direction: { x: 0, y: 0 }, holdE: false, sprint: false };
    if (view.selfConcealed) {
      const release = view.concealedMs > 15_000 ||
        (view.concealedMs > 4_000 && !view.visibleOpponent);
      if (release) memory.opened = true;
      return { ...zero, hidePress: release };
    }
    const threat = view.visibleOpponent;
    const spot = view.nearestHideSpot();
    const wantHide = spot && (!memory.opened ||
      (threat && view.selfDistanceTo(threat) < 8));
    if (wantHide) {
      if (view.hideTargetLegal()) return { ...zero, hidePress: true };
      // 冲刺中的 E 会被 HideSystem 以 SPRINT_ACTIVE 拒绝，因此接近目标后不再冲。
      return { direction: view.follow(spot, 700), holdE: false,
        sprint: spot.range > 3 };
    }
    const target = view.unfinishedRice(view.knownOpponent);
    if (!target) return zero;
    if (view.within(target, C.rice.interactionRange / C.three.pixelsPerUnit)) {
      return { ...zero, holdE: true };
    }
    return { direction: view.follow(target, 900), holdE: false, sprint: false };
  },
};

/**
 * 建立一个整局仿真。返回的对象暴露 `step()` / `run()` 与全部真实系统，
 * 便于测试与批量脚本各自取用。
 */
export function createMatchSim(options = {}) {
  const seed = options.seed ?? 1;
  const playerFaction = options.playerFaction ?? 'HUMAN';
  const policyName = options.policy ?? 'idle';
  const policy = PLAYER_POLICIES[policyName];
  if (!policy) throw new Error(`未知玩家策略：${policyName}`);
  // 两套 AI 的随机抽签（好奇 / 通行 / 巡逻 / 逃跑评分扰动）。正式游戏里它们是
  // `Math.random`，因此同一 `matchSeed` 只复现**布局**（出生点 / 门初态 / 米位），
  // 不复现 AI 的掷骰。仿真器为了能复现阻断，默认改成由种子派生的确定性流
  // （与布局流不同源），并在报告里注明这是仿真器行为。
  const aiRandom = options.random ?? seededRandom((seed ^ 0x5bf03635) >>> 0);

  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, BOXES);
  const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const doorSystem = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  const geometry = new PerceptionGeometry(WALLS, DOOR_NODES, () => doorSystem.doors);
  const sound = new SoundEventSystem(null);
  const traces = new RiceTraceSystem();
  const vision = new VisionSystem(null);
  const hide = new HideSystem();
  const sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold,
    C.sprint.stunMs, C.sprint.cooldownMs);
  const match = new GameStateSystem(C.match.readyMs, C.match.captureMs, 'FACTION_SELECT');
  const humanDoorSkill = new HumanDoorSkill(doorSystem, C.door.humanForceBreakCooldownMs);
  const collector = new AILogCollector();
  const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  const cameraOffset = new Vector3(12, 14, 12);

  // 与 `resetRound()` 相同：先建随机对局配置，再应用到真实系统。
  const setup = createMatchSetup(seed, collision, navigation,
    C.matchRandom.maxAttempts, HIDE_SPOTS);
  const rice = new RiceField(setup.rice.map(rice => rice.id),
    C.rice.maxProgressMs, C.rice.prepareMs);
  doorSystem.applyInitialStates(setup.doorStates);
  const syncDoorCollision = () => {
    for (const door of doorSystem.doors) {
      collision.setDynamicObstacle(door.id,
        door.state === 'OPEN' ? null : closedDoorBox(doorSystem.definition(door.id)));
    }
  };
  syncDoorCollision();

  const deepseek = new Vector3(setup.deepseek.x, 0, setup.deepseek.z);
  const human = new Vector3(setup.human.x, 0, setup.human.z);
  const stillness = new HumanStillness({ x: human.x, z: human.z });
  const humanDoorSkillRef = humanDoorSkill;

  let hideRevision = 1;
  const rebuildHideMap = () => {
    hideRevision++;
    const snapshot = createDeepSeekHideMapSnapshot({ hideSpots: HIDE_SPOTS,
      furniture: FURNITURE, revision: hideRevision });
    deepseekAI.rebindMap(snapshot, true);
    return snapshot;
  };
  const humanAiSnapshot = () => createHumanAiMapSnapshot({
    furniture: FURNITURE, hideSpots: HIDE_SPOTS,
    visionStatus: (from, to, maxRange) =>
      geometry.inspectVision(from, to, maxRange).status,
    canOccupyStaticXZ: (x, z, radius, height) =>
      collision.canOccupyStaticXZ(x, z, radius, height),
    playerRadius: C.collision.playerRadius, actorHeight: C.three.actorHeight });

  const deepseekAI = new DeepSeekAIController(navigation, DOOR_NODES, ROOMS, aiRandom);
  const humanAI = new HumanAIController(navigation, ROOMS, DOOR_NODES, aiRandom);
  let deepseekHideMap = rebuildHideMap();
  humanAI.rebindMap(humanAiSnapshot(), false);

  const hideWorld = () => ({ collision, navigation,
    visionStatus: (from, to, maxRange) => geometry.inspectVision(from, to, maxRange).status });
  const hideRegionWorld = () => ({ collision, navigation,
    doorStates: doorSystem.doors });

  let token = 0;
  let lastHumanFacing = { x: 0, y: 1 };
  let lastStepMs = { HUMAN: -Infinity, DEEPSEEK: -Infinity };
  let lastRiceSoundMs = -Infinity;
  let frames = 0;
  let simMs = 0;
  let concealToken = null;

  // 遥测（全部是「观察到的计数」，不是推断）。
  const telemetry = {
    doorOpened: 0, doorClosed: 0, doorLocked: 0, doorUnlocked: 0, forceBreak: 0,
    sprintStarted: 0, playerSprints: 0, falls: 0,
    hideEntered: 0, hideExited: 0, hideRejected: 0,
    humanCheckStarted: 0, humanCheckHit: 0, humanCheckMiss: 0, humanCheckIncomplete: 0,
    deepseekStuckFrames: 0, humanStuckFrames: 0,
    deepseekNoMoveMs: 0, humanNoMoveMs: 0,
    longestNoRiceProgressMs: 0, localLoopTriggers: 0, unreachableCount: 0,
    deepseekStateTransitions: 0, humanStateTransitions: 0,
    states: [], lastRiceProgressMs: 0,
  };
  let prevDeepseekState = null;
  let prevHumanState = null;
  let playerSprintHeld = false;
  let playerEHeld = false;
  let selfConcealedMs = 0;
  /** 玩家策略自己的跨帧记忆（只存在于仿真器，不进入任何生产系统）。 */
  const policyMemory = {};
  const stateLoopCounts = new Map();

  collector.startMatch();
  collector.noteMatchContext({ seed, playerFaction,
    riceTotal: rice.portions.length });
  match.beginFromFactionSelect();
  for (const id of Object.keys(setup.doorStates)) {
    void id;
  }

  const riceList = () => rice.states.map(state => ({ id: state.id,
    x: RICE_POINT.get(state.id).x, z: RICE_POINT.get(state.id).z,
    progressMs: state.progressMs, maxProgressMs: state.maxProgressMs,
    completed: state.completed }));

  function emitMovementSound(faction, before, after, sprinting) {
    if (distance(before, after) < C.perception.minimumMovementSoundDistance) return;
    const interval = sprinting ? C.perception.sprintStepIntervalMs
      : C.perception.footstepIntervalMs;
    if (sound.nowMs - lastStepMs[faction] < interval) return;
    sound.emit(sprinting ? 'SPRINT' : 'FOOTSTEP', after, faction);
    lastStepMs[faction] = sound.nowMs;
  }

  function canCloseDoor(id) {
    const definition = doorSystem.definition(id);
    if (!definition) return false;
    const radius = C.collision.playerRadius;
    return !doorIntersectsActor(definition, deepseek.x, deepseek.z, radius,
      C.door.leafThickness) &&
      !doorIntersectsActor(definition, human.x, human.z, radius, C.door.leafThickness);
  }

  function applyDoorResult(id, result, actorOverride) {
    // S7D：与 ThreeGame.applyDoorResult 一样，只把结果码交给整局摘要计数。
    collector.recordDoorResult(result);
    if (id && ['OPENED', 'CLOSED', 'LOCKED', 'UNLOCKED', 'FORCE_OPENED'].includes(result)) {
      if (result === 'OPENED') telemetry.doorOpened++;
      else if (result === 'CLOSED') telemetry.doorClosed++;
      else if (result === 'LOCKED') telemetry.doorLocked++;
      else if (result === 'UNLOCKED') telemetry.doorUnlocked++;
      else if (result === 'FORCE_OPENED') telemetry.forceBreak++;
      syncDoorCollision();
      const soundType = result === 'OPENED' ? 'DOOR_OPEN' : result === 'CLOSED'
        ? 'DOOR_CLOSE' : result === 'LOCKED' ? 'DOOR_LOCK'
        : result === 'FORCE_OPENED' ? 'FORCE_BREAK' : 'LOCK_BREAK';
      const source = result === 'LOCKED' ? 'DEEPSEEK'
        : (result === 'FORCE_OPENED' || result === 'UNLOCKED') ? 'HUMAN'
        : actorOverride ?? playerFaction;
      const node = doorSystem.definition(id);
      if (node) sound.emit(soundType, node, source);
    }
    void actorOverride;
  }

  // 玩家脚本策略需要的只读视图（刻意只给公开信息）。
  let repathRemainingMs = 0;
  let roamRoomIndex = 0;
  const view = {
    get visibleOpponent() {
      const observer = playerFaction === 'HUMAN' ? 'HUMAN' : 'DEEPSEEK';
      const state = vision.get(observer);
      if (!state.visible) return null;
      return observer === 'HUMAN' ? { x: deepseek.x, z: deepseek.z }
        : { x: human.x, z: human.z };
    },
    get lastSeenOpponent() {
      const observer = playerFaction === 'HUMAN' ? 'HUMAN' : 'DEEPSEEK';
      const seen = vision.get(observer).lastSeen;
      return seen ? seen.position : null;
    },
    unfinishedRice(avoid = null) {
      const self = playerFaction === 'HUMAN' ? human : deepseek;
      let best = null;
      for (const portion of rice.states) {
        if (portion.completed) continue;
        const point = RICE_POINT.get(portion.id);
        const range = distance(self, point);
        // 会躲的玩家优先挑离已知对手最远、同时离自己较近的米点。
        const score = avoid ? range - distance(point, avoid) * 2 : range;
        if (!best || score < best.score) {
          best = { ...point, id: portion.id, range, score };
        }
      }
      return best;
    },
    /** 已知对手的公开位置（当前目视优先，其次 Last Seen）——没有就是 null。 */
    get knownOpponent() { return view.visibleOpponent ?? view.lastSeenOpponent; },
    get selfConcealed() { return hide.isConcealed('DEEPSEEK'); },
    /** 玩家自己的连续藏身时长（DeepSeek AI 未运行时它自己的计时器不推进）。 */
    get concealedMs() { return selfConcealedMs; },
    /** 最近的家具藏身锚点（公开地图数据），只在真正藏身时使用。 */
    nearestHideSpot() {
      const self = playerFaction === 'HUMAN' ? human : deepseek;
      let best = null;
      for (const spot of HIDE_SPOTS) {
        const range = distance(self, spot);
        if (!best || range < best.range) best = { ...spot, range };
      }
      return best;
    },
    /** 当前位置是否真的构成合法藏身站位（与玩家 E 用同一条权威解析）。 */
    hideTargetLegal() {
      const self = playerFaction === 'HUMAN' ? human : deepseek;
      const resolution = resolveHideInteractionTarget({ position: { x: self.x, z: self.z },
        spots: HIDE_SPOTS, furniture: FURNITURE, world: hideRegionWorld() });
      const target = resolution.legalTarget ?? null;
      return target ? { ok: true, spotId: target.spotId, code: target.code } : null;
    },
    selfDistanceTo(point) {
      const self = playerFaction === 'HUMAN' ? human : deepseek;
      return distance(self, point);
    },
    awayFrom(point) {
      const self = playerFaction === 'HUMAN' ? human : deepseek;
      const dx = self.x - point.x, dz = self.z - point.z;
      const length = Math.hypot(dx, dz);
      if (length < EPSILON) return { x: 0, y: 0 };
      return { x: dx / length, y: dz / length };
    },
    within(point, range) {
      const self = playerFaction === 'HUMAN' ? human : deepseek;
      return distance(self, point) <= range;
    },
    follow(goal, repathMs) {
      const self = playerFaction === 'HUMAN' ? human : deepseek;
      if (repathRemainingMs <= 0 || !pathCache) {
        pathCache = navigation.findPath({ x: self.x, z: self.z }, goal, doorSystem.doors);
        pathCacheIndex = 0;
        repathRemainingMs = repathMs;
      }
      repathRemainingMs -= DELTA_MS;
      if (!pathCache || pathCache.length === 0) return { x: 0, y: 0 };
      while (pathCacheIndex < pathCache.length - 1 &&
          distance(self, pathCache[pathCacheIndex]) < C.deepseekAI.waypointTolerance) {
        pathCacheIndex++;
      }
      const step = pathCache[pathCacheIndex];
      const dx = step.x - self.x, dz = step.z - self.z;
      const length = Math.hypot(dx, dz);
      if (length < EPSILON) return { x: 0, y: 0 };
      return { x: dx / length, y: dz / length };
    },
    roamDirection() {
      const self = playerFaction === 'HUMAN' ? human : deepseek;
      const room = ROOMS[roamRoomIndex % ROOMS.length];
      if (distance(self, { x: room.x, z: room.z }) < 1) roamRoomIndex++;
      const next = ROOMS[roamRoomIndex % ROOMS.length];
      return view.follow({ x: next.x, z: next.z }, 1500);
    },
  };
  let pathCache = null;
  let pathCacheIndex = 0;

  function humanSearchHeadingRad() {
    if (lastHumanFacing.x !== 0 || lastHumanFacing.y !== 0) {
      return Math.atan2(lastHumanFacing.y, lastHumanFacing.x);
    }
    return 0;
  }

  /** 与 `runHumanAiHideCheck()` 同源：同一份权威判定函数与同一条结算路径。 */
  function runHumanAiHideCheck(spotId) {
    telemetry.humanCheckStarted++;
    const stance = humanAI.checkHideStance;
    const resolution = resolveHumanAiHideCheck({
      spotId,
      stance: stance ? { stancePoint: stance.stancePoint,
        surfacePoint: stance.surfacePoint, headingRad: stance.headingRad } : null,
      humanPosition: { x: human.x, z: human.z },
      humanHeadingRad: humanSearchHeadingRad(),
      waypointTolerance: C.humanAI.waypointTolerance,
      contactEpsilon: C.collision.contactEpsilon,
      furniture: FURNITURE, hideSpots: HIDE_SPOTS,
      readOccupancy: () => ({ concealedSpotId: hide.isConcealed('DEEPSEEK')
        ? hide.spotId : null }),
      lineBlocked: (a, b) => geometry.inspectVision(a, b, Number.POSITIVE_INFINITY)
        .status !== 'VISIBLE',
      range: C.humanSearch.range, halfAngleDeg: C.humanSearch.halfAngleDeg,
    });
    if (!resolution.executable) {
      telemetry.humanCheckIncomplete++;
      if (resolution.cancelKind === 'PLAN_STALE') {
        humanAI.cancelStaleCheckHide(resolution.detail);
      } else {
        humanAI.cancelIncompleteCheckHide(resolution.code, resolution.detail);
      }
      return;
    }
    humanAI.noteCheckHideResolution({
      spotId, result: resolution.hit ? 'HIT' : 'MISS', detail: resolution.detail,
      plannedSurfacePoint: resolution.plannedSurfacePoint,
      finalAimPoint: resolution.finalAimPoint, aimPointDelta: resolution.aimPointDelta,
      distance: resolution.distance, angleDeltaDeg: resolution.angleDeltaDeg,
      blocked: resolution.blocked, countsAsFormalCheck: resolution.countsAsFormalCheck,
    });
    if (resolution.hit) {
      telemetry.humanCheckHit++;
      collector.recordForcedCapture();
      if (hide.forcedExit('SEARCHED').ok) telemetry.hideExited++;
      match.forceCapture();
    } else {
      telemetry.humanCheckMiss++;
    }
    humanAI.onCheckHideResult(spotId, resolution.hit);
  }

  /** 与 `runDeepSeekAiHideEnter()` 同源。 */
  function runDeepSeekAiHideEnter(spotId, entryToken) {
    const entry = resolveDeepSeekAiHideEntry({
      spotId, position: { x: deepseek.x, z: deepseek.z },
      plannedStancePoint: deepseekAI.hideStancePoint,
      map: deepseekHideMap, doors: doorSystem.doors, world: hideWorld(),
      waypointTolerance: C.deepseekAI.waypointTolerance,
      contactEpsilon: C.collision.contactEpsilon,
    });
    if (!entry.ok) {
      telemetry.hideRejected++;
      deepseekAI.onHideResult(spotId, entry.code);
      return;
    }
    const result = hide.enterAsAI({ phase: match.phase,
      position: { x: deepseek.x, z: deepseek.z }, spotId,
      spotCode: entry.positionCode, spotLegal: true,
      captureProgressMs: match.captureProgressMs, sprintState: sprint.state,
      requestToken: entryToken ?? Number.NaN });
    if (result.ok) {
      telemetry.hideEntered++;
      rice.interrupt();
      match.captureProgressMs = 0;
    } else {
      telemetry.hideRejected++;
    }
    deepseekAI.onHideResult(spotId, result.ok ? 'ENTERED' : result.code);
  }

  function runDeepSeekAiHideExit() {
    const spotId = hide.spotId;
    if (!spotId) return;
    const result = hide.exit('AI_EXIT', { humanOverlap: humanBlocksHideExit(
      { x: deepseek.x, z: deepseek.z }, { x: human.x, z: human.z },
      C.collision.playerRadius) });
    if (result.ok) telemetry.hideExited++;
    deepseekAI.onHideResult(spotId, result.ok ? 'EXITED' : result.code);
  }

  function updatePlaying(deltaMs) {
    sound.advance(deltaMs);
    selfConcealedMs = hide.isConcealed('DEEPSEEK') ? selfConcealedMs + deltaMs : 0;
    humanDoorSkillRef.advance(deltaMs, match.phase);
    collector.recordHideEvents([...hide.drainEvents(), ...deepseekAI.drainHideEvents()]);
    collector.recordHumanSearchEvents(humanAI.drainHumanSearchEvents());
    traces.advance(deltaMs);
    vision.update(deltaMs, human, deepseek, geometry);
    stillness.update(human, deltaMs);

    const playerInput = policy(view, policyMemory);
    let direction = playerInput.direction;
    let playerDirection = playerInput.direction;
    if (playerFaction === 'HUMAN' &&
        (playerDirection.x !== 0 || playerDirection.y !== 0)) {
      lastHumanFacing = { x: playerDirection.x, y: playerDirection.y };
    }
    const ratio = rice.progressRatio;
    // 玩家自己的冲刺（正式游戏里是 Space 的**按下**事件，因此这里也只在边沿触发）。
    if (playerFaction === 'DEEPSEEK' && playerInput.sprint && !playerSprintHeld &&
        !hide.isConcealed('DEEPSEEK') &&
        (playerDirection.x !== 0 || playerDirection.y !== 0)) {
      if (sprint.tryStart({ x: playerDirection.x, y: playerDirection.y }, ratio,
          'PLAYER_SPACE')) {
        telemetry.playerSprints++;
        collector.recordSprintStart();
      }
    }
    playerSprintHeld = playerInput.sprint;
    // 玩家（DeepSeek 娘）自己的 E 键藏身 / 退出：与 `handleDoorInteractions` 的
    // HIDE_ENTER / HIDE_EXIT 分支走同一批权威接口（合法性解析 + HideSystem 状态机）。
    if (playerFaction === 'DEEPSEEK' && playerInput.hidePress && !playerEHeld &&
        sprint.state === 'NORMAL' && !match.result) {
      if (hide.isConcealed('DEEPSEEK')) {
        const result = hide.exit('PLAYER_E', { humanOverlap: humanBlocksHideExit(
          { x: deepseek.x, z: deepseek.z }, { x: human.x, z: human.z },
          C.collision.playerRadius) });
        if (result.ok) telemetry.hideExited++;
      } else {
        const resolution = resolveHideInteractionTarget({
          position: { x: deepseek.x, z: deepseek.z }, spots: HIDE_SPOTS,
          furniture: FURNITURE, world: hideRegionWorld() });
        const target = resolution.legalTarget ?? null;
        if (target) {
          const result = hide.enter({ phase: match.phase, faction: 'DEEPSEEK',
            playerControlled: true, position: { x: deepseek.x, z: deepseek.z },
            spotId: target.spotId, spotCode: target.code, spotLegal: target.legal,
            captureProgressMs: match.captureProgressMs, sprintState: sprint.state });
          if (result.ok) {
            telemetry.hideEntered++;
            rice.interrupt();
            match.captureProgressMs = 0;
          } else telemetry.hideRejected++;
        }
      }
      vision.setConcealed('DEEPSEEK', hide.isConcealed('DEEPSEEK'));
    }
    playerEHeld = playerInput.hidePress === true;

    // ---- DeepSeek 半边 ----
    let deepseekCommand = null;
    const deepseekAiEnabled = playerFaction === 'HUMAN';
    collector.advance(deltaMs, match.phase === 'PLAYING');
    if (deepseekAiEnabled) {
      const sight = vision.get('DEEPSEEK');
      const heardHuman = sound.heardBy(deepseek, 'DEEPSEEK', camera, geometry);
      const heardDanger = sound.heardBy(deepseek, 'DEEPSEEK', camera, geometry,
        event => isHumanPursuitSound(event.type));
      token++;
      hide.issueAiEntryToken(token);
      deepseekCommand = deepseekAI.update({
        deltaMs, deepseek: { x: deepseek.x, z: deepseek.z },
        visibleHuman: sight.visible ? { x: human.x, z: human.z } : null,
        humanStillMs: sight.visible ? stillness.stillMs : undefined,
        humanStillEventId: sight.visible ? stillness.eventId : undefined,
        heardHuman, heardHumanDanger: heardDanger,
        lastSeenHuman: sight.lastSeen, perceptionNowMs: vision.nowMs,
        geometry, riceProgressRatio: ratio, sprintState: sprint.state,
        captureProgressMs: match.captureProgressMs,
        hideMap: deepseekHideMap, hideWorld: hideWorld(),
        hideRequestToken: token,
        hideSelf: { hiding: hide.isConcealed('DEEPSEEK'), spotId: hide.spotId },
        rice: riceList(), doors: doorSystem.doors,
        canOpenDoor: id => {
          const node = doorSystem.definition(id);
          return !!node && canInteractWithDoorXZ(collision, deepseek, node);
        },
        canCloseDoor: id => {
          const node = doorSystem.definition(id);
          return !!node && canCloseDoor(id) &&
            canInteractWithDoorXZ(collision, deepseek, node);
        },
        canLockDoor: id => {
          const node = doorSystem.definition(id);
          return !!node && canInteractWithDoorXZ(collision, deepseek, node);
        },
        activeLockSlots: C.door.maxActiveLocks - doorSystem.activeLockedDoorCount,
      });
      if (deepseekCommand.hideExitRequest) runDeepSeekAiHideExit();
      if (deepseekCommand.hideSpotId) {
        runDeepSeekAiHideEnter(deepseekCommand.hideSpotId,
          deepseekCommand.hideRequestToken);
      }
      concealToken = hide.isConcealed('DEEPSEEK');
      vision.setConcealed('DEEPSEEK', concealToken);
      if (deepseekCommand.openDoorId) {
        applyDoorResult(deepseekCommand.openDoorId,
          doorSystem.toggle(deepseekCommand.openDoorId, 'DEEPSEEK'), 'DEEPSEEK');
      }
      if (deepseekCommand.closeDoorId) {
        const id = deepseekCommand.closeDoorId;
        const node = doorSystem.definition(id);
        const valid = !!node && doorSystem.get(id)?.state === 'OPEN' &&
          distanceToDoorSegment(deepseek.x, deepseek.z, node) <= C.door.interactionRange &&
          canInteractWithDoorXZ(collision, deepseek, node) && canCloseDoor(id);
        const result = valid ? doorSystem.toggle(id, 'DEEPSEEK', true)
          : 'BLOCKED_BY_ACTOR';
        applyDoorResult(id, result, 'DEEPSEEK');
        deepseekAI.onDoorEscapeResult(id, result);
      }
      if (deepseekCommand.lockDoorId) {
        const id = deepseekCommand.lockDoorId;
        const result = lockDoorFromCommand(doorSystem, id, deepseek,
          node => canInteractWithDoorXZ(collision, deepseek, node),
          C.door.interactionRange);
        applyDoorResult(id, result, 'DEEPSEEK');
        deepseekAI.onDoorLockResult(id, result);
      }
      const room = roomAt(deepseek.x, deepseek.z);
      collector.diffSnapshot({
        doorEscapeEvents: deepseekAI.drainDoorEscapeEvents(),
        doorLockEvents: deepseekAI.drainDoorLockEvents(),
        state: deepseekAI.state, targetRiceId: deepseekAI.targetRiceId,
        threatLevel: deepseekAI.threatLevel, threatSource: deepseekAI.threatSource,
        lastSelectionReason: deepseekAI.lastSelectionReason,
        lastNavigationReason: deepseekAI.lastNavigationReason,
        lastTransitionReason: deepseekAI.lastTransitionReason,
        lastEscapeSwitchReason: deepseekAI.lastEscapeSwitchReason,
        escapeRoomId: deepseekAI.escapeRoomId,
        noMovementReason: deepseekAI.noMovementReason,
        localLoopTriggered: deepseekAI.localLoopTriggered,
        sprintDecision: deepseekAI.sprintDecision, sprintReadiness: sprint.readiness,
        recoveryBlockReason: deepseekAI.recoveryBlockReason,
        curiosityRollResult: deepseekAI.curiosityRollResult,
        curiosityInterruptReason: deepseekAI.curiosityInterruptReason,
        curiosityBypassActive: deepseekAI.curiosityBypassActive,
        passageRollResult: deepseekAI.passageRollResult,
        passageGateReason: deepseekAI.passageGateReason,
        passageCancelReason: deepseekAI.passageCancelReason,
        passageRouteSafe: deepseekAI.passageRouteSafe,
        passageActive: deepseekAI.passageActive,
        safetyGeometry: null,
        safeWaitRiceId: deepseekAI.safeWaitRiceId,
        safeWaitEntryId: deepseekAI.safeWaitEntryId,
        safeWaitFailureCount: deepseekAI.safeWaitFailureCount,
        safeWaitReason: deepseekAI.safeWaitReason,
        safeWaitRemainingMs: deepseekAI.safeWaitRemainingMs,
        roomId: room?.id ?? null, humanVisible: sight.visible,
        humanStillMs: stillness.stillMs, stillnessEventId: stillness.eventId,
        lastSeenValid: sight.lastSeen !== null,
        heardSoundType: heardHuman?.event.type ?? null,
        heardAudibleStrength: heardHuman?.audibleStrength ?? null,
        heardRemainingMs: heardHuman?.remainingMs ?? null,
        heardSoundTimestampMs: heardHuman?.event.timestamp ?? null,
        heardDangerSoundType: heardDanger?.event.type ?? null,
        heardDangerAudibleStrength: heardDanger?.audibleStrength ?? null,
        humanVisibleDistance: sight.visible ? distance(deepseek, human) : null,
        // 与 ThreeGame 的 diffSnapshot 一样带上藏身相位 / 出口闸门 / 已藏身时长，
        // 否则仿真里的整局摘要认不出「藏身卡住」。
        hidePhase: deepseekAI.hidePhase,
        hideExitGate: deepseekAI.hideExitGate,
        hideConcealedMs: deepseekAI.hideConcealedMs,
      });
      if (deepseekAI.localLoopTriggered) telemetry.localLoopTriggers++;
      if (deepseekAI.state === 'RESELECT' &&
          deepseekAI.lastNavigationReason.includes('UNREACHABLE')) {
        telemetry.unreachableCount++;
      }
    }
    const activeDeepseekDirection = deepseekCommand
      ? { x: deepseekCommand.direction.x, y: deepseekCommand.direction.z }
      : direction;
    if (deepseekCommand?.startSprint && !concealToken) {
      if (sprint.tryStart(activeDeepseekDirection, ratio,
          `AI_${deepseekAI.sprintDecision}`)) {
        telemetry.sprintStarted++;
        collector.recordSprintStart();
      }
    }
    const previousSprintState = sprint.state;
    sprint.advance(deltaMs, activeDeepseekDirection);
    if (previousSprintState !== 'STUNNED' && sprint.state === 'STUNNED') {
      telemetry.falls++;
      collector.recordFall();
      sound.emit('FALL', deepseek, 'DEEPSEEK');
    }
    const concealed = hide.isConcealed('DEEPSEEK');
    const deepseekMovement = concealed ? { x: 0, y: 0 }
      : sprint.movementDirection(activeDeepseekDirection);
    const speed = effectiveSpeeds({ playerSpeedPx: C.player.speed,
      humanSpeedMultiplier: C.human.speedMultiplier,
      humanAIMovementMultiplier: C.humanAI.movementSpeedMultiplier }).player /
      C.three.pixelsPerUnit * (sprint.state === 'SPRINT_RUNNING'
        ? C.sprint.speedMultiplier : 1);
    const oldDeepseek = deepseek.clone();
    if (deepseekMovement.x !== 0 || deepseekMovement.y !== 0) {
      const next = collision.move(deepseek,
        deepseekMovement.x * speed * deltaMs / 1000,
        deepseekMovement.y * speed * deltaMs / 1000,
        C.collision.playerRadius, C.three.actorHeight);
      deepseek.set(next.x, 0, next.z);
    }
    const deepseekMoved = distance(oldDeepseek, deepseek);
    if (deepseekAiEnabled && (activeDeepseekDirection.x !== 0 ||
        activeDeepseekDirection.y !== 0) && deepseekMoved < EPSILON) {
      telemetry.deepseekStuckFrames++;
      telemetry.deepseekNoMoveMs += deltaMs;
    } else {
      telemetry.deepseekNoMoveMs = 0;
    }
    traces.recordMovement(deepseek);
    emitMovementSound('DEEPSEEK', oldDeepseek, deepseek,
      sprint.state === 'SPRINT_RUNNING');

    vision.update(0, human, deepseek, geometry);

    // ---- Human 半边 ----
    let aiHumanDirection = null;
    const humanAiEnabled = playerFaction === 'DEEPSEEK';
    if (humanAiEnabled) {
      const sight = vision.get('HUMAN');
      const captureEligible = isCaptureEligibleXZ(human, deepseek,
        C.match.captureRadius, collision.isLineBlockedXZ(human, deepseek));
      const command = humanAI.update({
        deltaMs, human: { x: human.x, z: human.z },
        visibleTarget: sight.visible ? { x: deepseek.x, z: deepseek.z } : null,
        lastSeen: sight.lastSeen,
        heard: sound.heardBy(human, 'HUMAN', camera, geometry),
        heardDanger: sound.heardBy(human, 'HUMAN', camera, geometry,
          event => isHumanPursuitSound(event.type)),
        nowMs: traces.nowMs,
        visibleTraces: selectVisibleTraces({ observer: human, traces: traces.traces,
          nowMs: traces.nowMs, visionRange: C.perception.visionRange,
          visible: (from, to, maxRange) => geometry.inspectVision(from, to, maxRange)
            .status === 'VISIBLE' }),
        captureEligible, doors: doorSystem.doors,
        forceBreakCooldownMs: humanDoorSkillRef.cooldownRemainingMs,
        canOpenDoor: id => {
          const node = doorSystem.definition(id);
          return !!node && canInteractWithDoorXZ(collision, human, node);
        },
      });
      if (command.openDoorId) {
        applyDoorResult(command.openDoorId,
          doorSystem.toggle(command.openDoorId, 'HUMAN'), 'HUMAN');
      }
      if (command.unlockDoorId) {
        applyDoorResult(command.unlockDoorId,
          doorSystem.disableLock(command.unlockDoorId, 'HUMAN'), 'HUMAN');
      }
      if (command.forceBreakDoorId) {
        const result = humanDoorSkillRef.use(command.forceBreakDoorId, 'HUMAN',
          match.phase);
        if (result !== 'COOLDOWN') applyDoorResult(command.forceBreakDoorId, result,
          'HUMAN');
      }
      if (command.faceHeadingRad !== null) {
        lastHumanFacing = { x: Math.cos(command.faceHeadingRad),
          y: Math.sin(command.faceHeadingRad) };
      }
      if (command.checkHideSpotId) runHumanAiHideCheck(command.checkHideSpotId);
      aiHumanDirection = { x: command.direction.x, y: command.direction.z };
    }
    const baseHumanSpeed = effectiveSpeeds({ playerSpeedPx: C.player.speed,
      humanSpeedMultiplier: C.human.speedMultiplier,
      humanAIMovementMultiplier: C.humanAI.movementSpeedMultiplier }).human /
      C.three.pixelsPerUnit;
    const humanSpeed = aiHumanDirection
      ? humanAiMovementSpeed(baseHumanSpeed, C.humanAI.movementSpeedMultiplier)
      : baseHumanSpeed;
    const activeHumanDirection = aiHumanDirection ?? playerDirection;
    const oldHuman = human.clone();
    if (activeHumanDirection.x !== 0 || activeHumanDirection.y !== 0) {
      const next = collision.move(human,
        activeHumanDirection.x * humanSpeed * deltaMs / 1000,
        activeHumanDirection.y * humanSpeed * deltaMs / 1000,
        C.collision.playerRadius, C.three.actorHeight);
      human.set(next.x, 0, next.z);
    }
    const humanMoved = distance(oldHuman, human);
    if (humanAiEnabled && (activeHumanDirection.x !== 0 ||
        activeHumanDirection.y !== 0) && humanMoved < EPSILON) {
      telemetry.humanStuckFrames++;
      telemetry.humanNoMoveMs += deltaMs;
    } else {
      telemetry.humanNoMoveMs = 0;
    }
    stillness.update(human, 0);
    emitMovementSound('HUMAN', oldHuman, human, false);

    // ---- 进食 / 抓米 ----
    let nearest = null;
    for (const portion of rice.portions) {
      if (portion.rice.completed) continue;
      const point = RICE_POINT.get(portion.rice.id);
      const range = distance(deepseek, point);
      if (!nearest || range < nearest.range) {
        nearest = { id: portion.rice.id, range };
      }
    }
    const inRange = !!nearest && nearest.range <= C.rice.interactionRange /
      C.three.pixelsPerUnit;
    const aiRice = deepseekCommand?.eatRiceId
      ? RICE_POINT.get(deepseekCommand.eatRiceId) : null;
    const aiInRange = !!aiRice && distance(deepseek, aiRice) <=
      C.rice.interactionRange / C.three.pixelsPerUnit;
    const previousRice = new Map(rice.states.map(state => [state.id, state.progressMs]));
    rice.update(deltaMs,
      deepseekCommand ? (aiInRange ? deepseekCommand.eatRiceId : null)
        : (inRange ? nearest.id : null),
      deepseekCommand
        ? aiInRange && sprint.state === 'NORMAL' &&
          activeDeepseekDirection.x === 0 && activeDeepseekDirection.y === 0
        : playerFaction === 'DEEPSEEK' && !concealed && sprint.state === 'NORMAL' &&
          playerInput.holdE && inRange && playerDirection.x === 0 &&
          playerDirection.y === 0);
    let progressed = false;
    for (const portion of rice.portions) {
      const before = previousRice.get(portion.rice.id) ?? 0;
      const now = portion.rice.progressMs;
      if (now > before) {
        progressed = true;
        traces.recordProgress(portion.rice.id, deepseek, before, now);
        if (sound.nowMs - lastRiceSoundMs >= C.perception.riceSoundIntervalMs) {
          sound.emit('RICE_EAT', RICE_POINT.get(portion.rice.id), 'DEEPSEEK');
          lastRiceSoundMs = sound.nowMs;
        }
      }
    }
    if (progressed) {
      telemetry.lastRiceProgressMs = match.elapsedMs;
      telemetry.longestNoRiceProgressMs = Math.max(telemetry.longestNoRiceProgressMs,
        telemetry.deepseekGapMs ?? 0);
      telemetry.deepseekGapMs = 0;
    } else {
      telemetry.deepseekGapMs = (telemetry.deepseekGapMs ?? 0) + deltaMs;
      if (deepseekAiEnabled && !concealed) {
        telemetry.longestNoRiceProgressMs = Math.max(
          telemetry.longestNoRiceProgressMs, telemetry.deepseekGapMs);
      }
    }

    vision.update(0, human, deepseek, geometry);
    const insideCaptureRadius = isInsideCaptureZoneXZ(human, deepseek,
      C.match.captureRadius);
    const concealedDeepseek = hide.isConcealed('DEEPSEEK');
    const captureZoneBlocked = !concealedDeepseek && insideCaptureRadius &&
      collision.isLineBlockedXZ(human, deepseek);
    const captureZoneActive = !concealedDeepseek &&
      isCaptureEligibleXZ(human, deepseek, C.match.captureRadius, captureZoneBlocked);
    match.advancePlaying(deltaMs, captureZoneActive, rice.completed);
    // S7D：整局摘要与本帧正式事实同源（完成米数 / 阶段 / 结算）。
    collector.recordRiceProgress(rice.completedCount);
    collector.notePhase(match.phase);
    if (match.result) {
      collector.noteMatchResult({ winner: match.result.winner,
        reason: match.result.reason, durationMs: match.result.elapsedMs,
        riceCompleted: rice.completedCount });
      rice.interrupt();
      if (hide.forcedExit('ROUND_FINISHED').ok) deepseekAI.onForcedHideExit('ROUND_FINISHED');
      collector.recordHideEvents([...hide.drainEvents(),
        ...deepseekAI.drainHideEvents()]);
      collector.recordHumanSearchEvents(humanAI.drainHumanSearchEvents());
    }
    // 状态迁移计数：用于发现 EVADE/SAFE_WAIT/RECOVER/HIDE 之间的异常循环。
    if (deepseekAI.state !== prevDeepseekState) {
      if (prevDeepseekState !== null) telemetry.deepseekStateTransitions++;
      prevDeepseekState = deepseekAI.state;
      telemetry.states.push({ t: match.elapsedMs, state: deepseekAI.state });
      if (telemetry.states.length > 4000) telemetry.states.shift();
      const last = telemetry.states.slice(-6).map(entry => entry.state).join('>');
      stateLoopCounts.set(last, (stateLoopCounts.get(last) ?? 0) + 1);
    }
    if (humanAI.state !== prevHumanState) {
      if (prevHumanState !== null) telemetry.humanStateTransitions++;
      prevHumanState = humanAI.state;
    }
  }

  function step() {
    const deltaMs = DELTA_MS;
    simMs += deltaMs;
    frames++;
    if (match.phase === 'READY') {
      match.advanceReady(deltaMs);
      return { phase: match.phase, done: false };
    }
    if (match.phase === 'PLAYING') {
      const observer = playerFaction === 'DEEPSEEK' ? deepseek : human;
      positionCameraOnTarget(camera, observer, cameraOffset);
      updatePlaying(deltaMs);
      return { phase: match.phase, done: match.phase === 'FINISHED' };
    }
    return { phase: match.phase, done: true };
  }

  function run(maxFrames = 6000) {
    while (match.phase !== 'FINISHED' && frames < maxFrames) step();
    const repeated = [...stateLoopCounts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      seed, playerFaction, policy: policyName,
      setup: { attempts: setup.attempts, fallback: setup.fallback,
        validation: setup.validation,
        deepseek: { ...setup.deepseek }, human: { ...setup.human },
        riceIds: setup.rice.map(rice => rice.id),
        doorOpenCount: Object.values(setup.doorStates)
          .filter(state => state === 'OPEN').length },
      frames, simMs, timedOut: match.phase !== 'FINISHED',
      phase: match.phase, winner: match.result?.winner ?? null,
      reason: match.result?.reason ?? null,
      elapsedMs: match.result?.elapsedMs ?? match.elapsedMs,
      riceCompleted: rice.completedCount,
      riceTotal: rice.portions.length,
      telemetry: { ...telemetry, states: undefined },
      states: telemetry.states,
      loop: repeated.slice(0, 3).map(([pattern, count]) => ({ pattern, count })),
      log: collector.export({ matchSeed: seed, matchSetup: {
        deepseek: { id: 'deepseek', roomId: setup.deepseek.roomId,
          x: setup.deepseek.x, z: setup.deepseek.z },
        human: { id: 'human', roomId: setup.human.roomId,
          x: setup.human.x, z: setup.human.z },
        riceIds: setup.rice.map(rice => rice.id),
        doorStates: setup.doorStates, attempts: setup.attempts,
        fallback: setup.fallback, validation: setup.validation } }),
    };
  }

  return { step, run, frame: () => frames,
    systems: { collision, navigation, doorSystem, geometry, sound, traces, vision,
      hide, sprint, match, rice, humanDoorSkill, collector, deepseekAI, humanAI },
    positions: { deepseek, human },
    view };
}
