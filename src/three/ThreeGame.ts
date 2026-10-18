import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import { DIFFICULTY_COPY, resolveAiDifficulty, type Difficulty } from '../config/difficultyConfig.ts';
import { DifficultyView } from './DifficultyView.ts';
import { ControlsHelpView } from './ControlsHelpView';
import { GameStateSystem } from '../systems/GameStateSystem';
import { RiceField } from '../systems/RiceField';
import { SprintSystem } from '../systems/SprintSystem';
import { DoorSystem, doorIntersectsActor, distanceToDoorSegment, lockDoorFromCommand,
  type DoorActionResult, type NearbyDoor } from '../systems/DoorSystem';
import { DeepSeekDoorLockPenalty } from '../systems/DeepSeekDoorLockPenalty';
import { HumanDoorSkill } from '../systems/HumanDoorSkill';
import { PulseLockSystem, type PulseLockEntry } from '../systems/PulseLockSystem';
import { PulseLockView } from './PulseLockView';
import { PerceptionGeometry, RiceTraceSystem, SoundEventSystem, VisionSystem,
  type SoundType } from '../systems/PerceptionSystem';
import { RuntimeDebugOverrides }
  from '../systems/RuntimeDebugOverrides';
import { DevBRuntimeBinding, effectiveSpeeds } from '../systems/DevBRuntimeBinding';
import { DevBParamPersistence } from '../systems/DevBParamPersistence';
import { devBPersistenceStorage } from '../systems/DevBParamStore';
import type { DevBHumanHideSearch, DevBObservationInput } from '../systems/DevBObserver';
import { DevBDebug } from './DevBDebug';
import type { DevBViewFrame } from './DevBView';
import { HUMAN_CLUE_DEFER_TEXT, HumanAIController, humanAiMovementSpeed,
  shouldRunHumanAI, type HumanAIMapSnapshot, type HumanCheckHidePhase }
  from '../systems/HumanAIController';
import { DeepSeekAIController, isHumanPursuitSound, shouldRunDeepSeekAI,
  type DeepSeekAICommand } from '../systems/DeepSeekAIController';
import { AILogCollector } from '../systems/AILogCollector';
import { AIThrowableController } from '../systems/AIThrowableController.ts';
import { createMatchSetup, freshMatchSeed, parseMatchSeed,
  type MatchSetup } from '../systems/MatchRandom';
import { HideSystem, type HideExitReason } from '../systems/HideSystem';
import { SkillCooldown } from '../systems/SkillCooldown';
import { deepseekLockGate, lockArmsPlayerCooldown, resolveQSkill }
  from '../systems/SkillGates';
import { resolveInteractionIntent } from '../systems/HideInteractionArbitration';
import { interactionPrompt } from './InteractionPrompt';
import { nextDeepSeekVisualHeading, resolveDeepSeekVisualTarget, type DeepSeekVisualTarget }
  from '../systems/DeepSeekVisualTarget';
import { HUMAN_SEARCH_CODE_TEXT, directionToHeadingRad, evaluateHumanSearch,
  probeExposedFanTarget, type ExposedFanProbe, type HumanSearchTarget }
  from '../systems/HumanSearchSkill';
import { createHumanAiMapSnapshot, resolveHumanAiHideCheck,
  resolveHumanFurnitureSearch, HUMAN_HIDE_CHECK_CODE_TEXT,
  HUMAN_FURNITURE_SEARCH_CODE_TEXT, type HumanFurnitureSearchCode }
  from '../systems/HumanHideSearchResolution';
import { resolveHideInteractionTarget, resolvePlayerQPlan, HIDE_TARGET_CODE_TEXT,
  type HideTargetCandidate, type HideTargetPointing, type HideTargetResolution,
  type PlayerQPlanReason } from '../systems/HideTargetResolution';
import { selectVisibleTraces } from '../systems/RiceTraceClues';
import { createDeepSeekHideMapSnapshot,
  type DeepSeekHideMapSnapshot, type DeepSeekHideWorld }
  from '../systems/DeepSeekHideCandidates';
import { resolveDeepSeekAiHideEntry, humanBlocksHideExit,
  DEEPSEEK_HIDE_ENTRY_CODE_TEXT } from '../systems/DeepSeekHideResolution';
import { HideSearchView } from './HideSearchView';
import { HardNightView } from './HardNightView';
import { RoomLightSystem, createRoomLightSwitches } from '../systems/RoomLightSystem.ts';
import roomLightLayout from './map/roomLightLayout.json';
import { mountLight, type LightPlacement } from './map/RoomLightLayout.ts';
import { RoomLightView } from './RoomLightView.ts';
import { type HideRegionWorld } from './map/HideInteractionRegion';
import { precheckMapApplication } from './map/MapApplicationPrecheck';
import { AISafetyPathView } from './AISafetyPathView';
import { HumanStillness } from '../systems/HumanStillness';
import { resolveCharacterAction } from '../systems/CharacterAction';
import { NavigationSystem } from '../systems/NavigationSystem';
import { CollisionWorld, canInteractWithDoorXZ } from './CollisionWorld';
import { DoorView } from './DoorView';
import { InteriorShadowView, applyInteriorSunShadow, isCoveredInterior } from './InteriorShadowView';
import { CharacterActionView } from './CharacterActionView';
import { StartupReadiness } from './StartupReadiness';
import { DebugDetailsPanel, escapeCandidateProperties,
  type DebugCategory, type DebugProperty } from './DebugDetailsPanel';
import { InputManager } from './InputManager';
import { RiceView } from './RiceView';
import { createRiceTraceView, syncRiceTraceView } from './RiceTraceView';
import { SoundVisualView } from './SoundVisualView';
import { resolveDirectControlSwitch, resolveRoundShortcut } from './RoundShortcuts';
import { CaptureZoneView, isCaptureEligibleXZ, isInsideCaptureZoneXZ } from './CaptureZone';
import { cameraRelativeDirection, IsometricCameraOrbit, positionCameraOnTarget }
  from './CameraRelativeMovement';
import { GentleCameraFollow, HOME_PALETTE, homeFrustum } from './AlphaPresentation.ts';
import { AlphaHudView } from './AlphaHudView.ts';
import { DISABLED_AUDIO_CUES, GameAudio, worldAudioGain, type AudioCue, type MusicCue } from './GameAudio';
import { AudioSettingsView } from './AudioSettingsView';
import { MenuSettingsView } from './MenuSettingsView.ts';
import { GameFeedback } from './GameFeedback';
import { LocalControl, pickActorFaction, type Faction } from './LocalControl';
import { ThrowableSystem, type ThrowableSpawn, type ThrowActor, type ThrowPoint } from '../systems/ThrowableSystem.ts';
import { ThrowableView, THROWABLE_NAMES } from './ThrowableView.ts';
import { CaptureNetSystem, humanNetPlacement } from '../systems/CaptureNetSystem.ts';
import { CaptureNetView } from './CaptureNetView.ts';
import throwableLayout from './map/throwableLayout.json';
import { formatMatchTime, populateFactionMenu, populateRoundActions,
  REPORT_MARKUP, updateResultPortrait } from './GameUiLayout';
import { observeHumanHideSearch } from './DevBHumanHideObservation.ts';
import { buildApartment, type ApartmentBuild } from './map/MapBuilder';
import { fitOrthographicSceneDepth } from './SceneCameraDepth';
import { SceneEditor, type CommittedMap } from './SceneEditor';
import { authoredMapSource, type MapSource } from './map/MapEditModel';
import { layoutSignature, authoredLayoutDocument } from './map/MapLayoutStore';
import { DevFreezeSystem } from '../systems/DevFreezeSystem';
import { ACTIVE_RICE_COUNT, DEBUG_MAP, DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_WIDTH, MAP_DEPTH,
  ROOMS, SPAWNS, WALLS, roomAt, selectRiceCandidates,
  type HideSpot, type Rect } from './map/apartmentMap';

const U = C.three.pixelsPerUnit;
const distance = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
// S7C-1B：技能提示在 HUD 上停留的时长（纯 UI 常量）。
const HIDE_NOTICE_MS = 3_600;
const pointText = (value: { x: number; z: number } | null | undefined) => value
  ? `(${value.x.toFixed(1)}, ${value.z.toFixed(1)})` : '无';
// 玩家声音探测表现层（声音范围圈 + 彩色动态声纹）已于 2026-09-27 停用：
// `SoundVisualView` 的实现、测试与 `GAME_CONFIG.perception.soundVisual` 数值全部保留，
// 这里只用这一个常量关掉它的实例化与逐帧更新；恢复时把下面的值改回 `true` 即可。
// 停用前快照、接线记录、配置说明与恢复步骤见 archive/features/player-sound-visual/README.md。
// AI 真实听觉（`PerceptionSystem` / `SoundEventSystem`）与 DEV-B 调试完全不受影响。
const PLAYER_SOUND_VISUAL_ENABLED: boolean = false;

// 最小操作教学：独立说明层只在**每个浏览器第一次开局**自动弹出一次，
// 之后从暂停菜单的「操作说明」重看。首次阅读阻止倒计时推进，但不改变 READY 时长。
const CONTROLS_HELP_AUTO_OPEN = true;
const CONTROLS_HELP_SEEN_KEY = 'who-ate-my-rice/controls-help-seen-v1';

export class ThreeGame {
  private readonly runtime = new RuntimeDebugOverrides();
  private scene = new THREE.Scene();
  private safetyPaths = import.meta.env.DEV ? new AISafetyPathView(this.scene, () => this.runtime.captureRadius) : null;
  private camera = new THREE.OrthographicCamera();
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private clock = new THREE.Clock();
  private input = new InputManager();
  private readonly throwables = new ThrowableSystem(throwableLayout as ThrowableSpawn[]);
  private readonly throwableView: ThrowableView;
  private readonly aiThrowers = { DEEPSEEK: new AIThrowableController(), HUMAN: new AIThrowableController() };
  private readonly captureNet = new CaptureNetSystem();
  private readonly captureNetView: CaptureNetView;
  private netAiNextAttemptAt = 0;
  private netAiApproachAt = 0;
  private netAiSawRooted = false;
  private control = new LocalControl();
  private readonly cameraOffset = new THREE.Vector3(12, 14, 12);
  private readonly cameraOrbit = new IsometricCameraOrbit(this.cameraOffset);
  private readonly sceneVisualBounds = new THREE.Box3();
  private readonly gentleCamera = new GentleCameraFollow();
  private readonly alphaHud: AlphaHudView;
  private match = new GameStateSystem(C.match.readyMs, C.match.captureMs, 'FACTION_SELECT');
  private rice = new RiceField([], C.rice.maxProgressMs, C.rice.prepareMs);
  private sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold, C.sprint.stunMs,
    C.sprint.cooldownMs);
  private player: THREE.Mesh;
  private human: THREE.Mesh;
  private readonly actorShadows = new InteriorShadowView();
  private playerAction: CharacterActionView;
  private humanAction: CharacterActionView;
  private captureZone: CaptureZoneView;
  private captureZoneActive = false;
  private captureZoneBlocked = false;
  private riceViews = new Map<string, RiceView>();
  private doorSystem = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  private humanDoorSkill = new HumanDoorSkill(
    this.doorSystem, C.door.humanForceBreakCooldownMs);
  private pulseLock = new PulseLockSystem(this.doorSystem, C.pulseLock.timing);
  private doorViews = new Map<string, DoorView>();
  private sound = new SoundEventSystem(this.runtime);
  private readonly audio = new GameAudio((() => {
    // Accessing the browser getter can throw before GameAudio's read/write guards.
    try { return globalThis.localStorage ?? null; }
    catch { return null; }
  })());
  private audioSettings!: AudioSettingsView;
  private menuSettings!: MenuSettingsView;
  private pauseSettingsOpen = false;
  private pauseSettingsButton!: HTMLButtonElement;
  // 独立操作说明层（教学）：可在首次开局自动出现，也可从暂停菜单重看；不参与玩法。
  private controlsHelp!: ControlsHelpView;
  private feedback!: GameFeedback;
  private lastReadySeconds = 0;
  private lastAudioPhase = 'FACTION_SELECT';
  private lastAudioSuspended = false;
  private lastRiceActive: string | null = null;
  private lastRiceCompleted = 0;
  private lastSprintReadiness = this.sprint.readiness;
  private lastHumanLockDecision = '';
  private lastHumanDecisionReason = '';
  private lastQReady = true;
  private soundVisual: SoundVisualView | null = null;
  private traces = new RiceTraceSystem();
  private roomLights!: RoomLightSystem;
  private roomLightView!: RoomLightView;
  private lightOwnsL = false;
  private vision = new VisionSystem(this.runtime, () => this.difficulty === 'HARD'
    ? C.difficulty.hardNightVisionRange : Number.POSITIVE_INFINITY,
    target => this.difficulty === 'HARD' && this.roomLights?.rangeFor(target, 0) === Number.POSITIVE_INFINITY);
  private readonly hardNightView: HardNightView;
  private perceptionGeometry = new PerceptionGeometry(WALLS, DOOR_NODES,
    () => this.doorSystem.doors, this.runtime);
  private traceViews = new Map<string, THREE.Group>();
  private lastStepMs: Record<Faction, number> = { HUMAN: -Infinity, DEEPSEEK: -Infinity };
  private lastRiceSoundMs = -Infinity;
  private doorStatusMessage = '';
  private collision: CollisionWorld;
  private apartment: ApartmentBuild;
  private readonly devFreeze = new DevFreezeSystem();
  private sceneEditor: SceneEditor | null = null;
  private readonly editorFocus = new THREE.Vector3();
  private editorOpenLast = false;
  private devZoom = 1;
  private humanAI: HumanAIController;
  private humanAiWasActive = false;
  private deepseekAI: DeepSeekAIController;
  private humanStillness: HumanStillness;
  private deepseekAiWasActive = false;
  private readonly deepseekDoorLockPenalty =
    new DeepSeekDoorLockPenalty(C.deepseekAI.humanPlayerUnlockPenaltyMs);
  private aiLogCollector = import.meta.env.DEV ? new AILogCollector() : null;
  private matchSetup: MatchSetup | null = null;
  private fixedMatchSeed: number | null = null;
  // S7C-1B：藏身状态机、两个 Q 技能冷却与扇形表现层。正式数值全部来自
  // GAME_CONFIG（humanSearch / door.playerLockCooldownMs），不新增散落常量。
  private readonly hide = new HideSystem();
  private readonly humanSearchCooldown = new SkillCooldown(C.humanSearch.cooldownMs);
  private readonly deepseekLockCooldown = new SkillCooldown(C.door.playerLockCooldownMs);
  private readonly hideSearchView = new HideSearchView(this.scene);
  private navigation!: NavigationSystem;
  // The applied map is the single source for hide regions; the scene editor can
  // replace it, so both lists follow the last successful rebuild.
  private mapFurniture: readonly Rect[] = FURNITURE;
  private hideSpots: readonly HideSpot[] = HIDE_SPOTS;
  private appliedMapSignature = '';
  // S7C-2b：交给 DeepSeek AI 的**公开**藏身点快照 + 地图代次。快照只在
  // `rebuildApartment` 与构造时各建一次，AI 一见代次变化就作废手头的藏身计划。
  private deepseekHideMap: DeepSeekHideMapSnapshot | null = null;
  private deepseekHideRevision = 0;
  // S7C-2b：每帧签发一次的 AI 进入令牌。AI 必须在同一帧把它回传才可能进入藏身；
  // 令牌由 `HideSystem` 消费后立刻作废，因此重放必然被拒。
  private deepseekHideTokenCounter = 0;
  private deepseekHideEntryCode = 'NONE';
  private deepseekHideEntryDetail = '无';
  private deepseekHideEnterCount = 0;
  private deepseekHideRejectCount = 0;
  private deepseekHideExitCount = 0;
  private deepseekHideLastExitReason = 'NONE';
  private hideCandidateCode = 'NONE';
  private hideCandidateSpotId: string | null = null;
  private hideNotice = '';
  private hideNoticeRemainingMs = 0;
  private lastHumanFacing = { x: 0, y: 1 };
  // 人工 DP 最近一次真实有效位移的世界 XZ 朝向；只用于交互轮廓，不旋转白模、不改 E。
  private lastDeepseekVisualHeadingRad: number | null = null;
  private deepseekVisualTarget: DeepSeekVisualTarget = { kind: 'NONE' };
  // S7C-2 修复轮 五：AI 搜查可见反馈的状态跟随（纯表现，不参与判定）。
  private humanAiSearchFeedbackPhase: HumanCheckHidePhase = 'NONE';
  private humanAiSearchFeedbackSpotId: string | null = null;
  private lastSearchCode = 'NONE';
  private lastSearchDetail = '无';
  private lastSearchSpotId: string | null = null;
  private humanSearchCount = 0;
  private humanSearchHitCount = 0;
  // S7C-2 修复轮 二 / 三：Human 玩家 Q 的公开家具交互目标。全部来自**公开**解析：
  // 区域成员 + 真实碰撞可站立 + 家具表面无墙门遮挡 + 落在真实导航格上 + 玩家朝向
  // 对着该家具，绝不读取藏身占用，因此白色高亮不可能泄露「里面有没有人」。
  // 修复轮 三起，玩家 Q 是否走家具分支还取决于当帧是否存在合法暴露目标（优先抓人）。
  private humanSearchTargetKind: 'NONE' | 'FAN' | 'FURNITURE' = 'NONE';
  private hideTargetSpotId: string | null = null;
  private hideTargetFurnitureId: string | null = null;
  private hideTargetCode = 'NONE';
  private hideTargetLegal = false;
  /** S7C-2 修复轮 三：本帧家具是否**被玩家指向**（合法 + 指向才允许 Q 搜家具）。 */
  private hideTargetPointed = false;
  private hideTargetPointingDeltaDeg = Number.NaN;
  /** 本帧是否存在**合法暴露目标**：为 true 时 Q 抓人，家具描边变暗且 HUD 不再提示可搜。 */
  private hideTargetExposedPriority = false;
  private lastPlayerQPlanReason: PlayerQPlanReason | 'NONE' = 'NONE';
  private hideTargetCandidates = 0;
  private furnitureSearchCode: HumanFurnitureSearchCode | 'NONE' = 'NONE';
  private furnitureSearchDetail = '无';
  private furnitureSearchCount = 0;
  private furnitureSearchHitCount = 0;
  // S7C-2：Human AI 正式搜查的**开发者真值**明细（AI 自己只看得到 HIT / MISS）。
  private humanAiCheckCode = 'NONE';
  private humanAiCheckDetail = '无';
  /** 最近一次判定是否算「真正完成的正式检查」（只有搜空 / 搜中为 true）。 */
  private humanAiCheckCountsAsFormal = false;
  private skillHud!: HTMLElement;
  private skillHudState!: HTMLElement;
  private skillHudNotice!: HTMLElement;
  private debugPanel: DebugDetailsPanel | null = null;
  private devBDebug: DevBDebug | null = null;
  private devBBinding: DevBRuntimeBinding | null = null;
  private devBPersistence: DevBParamPersistence | null = null;
  private overlay: HTMLElement;
  private overlayText: HTMLElement;
  private overlayHeading: HTMLElement;
  private overlaySummary: HTMLElement;
  private overlayStats: HTMLElement;
  private pauseActions: HTMLElement;
  private resultActions: HTMLElement;
  private menu: HTMLElement;
  private readonly difficultyView: DifficultyView;
  private difficulty: Difficulty = 'EASY';
  private difficultyStatus: HTMLElement;
  private pulseLockView: PulseLockView;
  private frame = 0;
  private disposed = false;
  private readonly debugPossessionEnabled = import.meta.env.DEV && C.development.factionSwitchEnabled;

  constructor(container: HTMLElement, readonly startupReadiness = new StartupReadiness()) {
    this.fixedMatchSeed = import.meta.env.DEV
      ? parseMatchSeed(new URLSearchParams(window.location.search).get('matchSeed')) : null;
    this.scene.background = new THREE.Color(HOME_PALETTE.background);
    this.soundVisual = PLAYER_SOUND_VISUAL_ENABLED
      ? new SoundVisualView(this.scene, import.meta.env.DEV) : null;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(this.renderer.domElement);
    const ambient = new THREE.HemisphereLight(0xfff5e4, 0x9c9988, 2.0);
    this.scene.add(ambient);
    const light = new THREE.DirectionalLight(0xffefd8, 2.4);
    light.position.set(-8, 24, 12);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.normalBias = .035;
    light.shadow.camera.left = -MAP_WIDTH / 2;
    light.shadow.camera.right = MAP_WIDTH / 2;
    light.shadow.camera.bottom = -MAP_DEPTH / 2;
    light.shadow.camera.top = MAP_DEPTH / 2;
    this.scene.add(light);
    this.hardNightView = new HardNightView(this.scene, ambient, light);

    // 家具与藏身锚点从项目布局文件载入，浏览器旧存档不覆盖项目布局。
    this.apartment = buildApartment(this.scene, {
      furniture: this.mapFurniture, hideSpots: this.hideSpots,
      debug: import.meta.env.DEV && DEBUG_MAP, editorTools: import.meta.env.DEV });
    this.sceneVisualBounds.setFromObject(this.apartment.root);
    this.collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, this.apartment.obstacles,
      this.apartment.orientedObstacles);
    this.navigation = new NavigationSystem(this.collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
    this.roomLights = new RoomLightSystem(createRoomLightSwitches(p => this.collision.canOccupyStaticXZ(
      p.x, p.z, C.collision.playerRadius, C.three.actorHeight), roomLightLayout.map((p: LightPlacement) => {
        const mounted = mountLight(p);
        if (!mounted) throw Error(`灯位文件无效：${p.roomId}`);
        return mounted;
      })));
    this.roomLightView = new RoomLightView(this.scene, container, this.roomLights, ambient, light);
    this.humanAI = new HumanAIController(this.navigation, ROOMS, DOOR_NODES, Math.random,
      this.humanAiMapSnapshot());
    this.deepseekAI = new DeepSeekAIController(this.navigation, DOOR_NODES, ROOMS);
    // S7C-2b：初始地图也要有公开藏身点快照，否则 AI 在开局就没有可评估的候选。
    this.rebuildDeepseekHideMap(false);
    // DEV-B: both AI controllers read the same effective values the panel edits.
    this.humanAI.setRuntimeTuning(this.runtime);
    this.deepseekAI.setRuntimeTuning(this.runtime);
    this.humanStillness = new HumanStillness(SPAWNS.human);
    DOOR_NODES.forEach((door, index) => {
      const view = new DoorView(door, index, import.meta.env.DEV && DEBUG_MAP);
      this.scene.add(view.object);
      applyInteriorSunShadow(view.object, isCoveredInterior(door.x, door.z));
      this.doorViews.set(door.id, view);
    });
    this.syncAllDoors();
    const actorWidth = C.player.size / U, actorHeight = C.three.actorHeight;
    this.player = this.box(actorWidth, actorHeight, actorWidth, C.player.color,
      SPAWNS.deepseek.x, actorHeight / 2, SPAWNS.deepseek.z);
    this.human = this.box(actorWidth, actorHeight, actorWidth, C.human.color,
      SPAWNS.human.x, actorHeight / 2, SPAWNS.human.z);
    this.playerAction = new CharacterActionView(this.player, 'DEEPSEEK', Math.random, this.startupReadiness);
    this.humanAction = new CharacterActionView(this.human, 'HUMAN');
    this.actorShadows.add(this.player);
    this.actorShadows.add(this.human);
    this.captureZone = new CaptureZoneView(this.human, this.runtime.captureRadius, actorHeight);
    // A radius change must invalidate progress accumulated under the old radius.
    if (import.meta.env.DEV) {
      this.devBBinding = new DevBRuntimeBinding(this.runtime, {
        gameState: this.match,
        onCaptureRadius: radius => this.captureZone.setRadius(radius),
      });
      this.devBBinding.start();
      // Production never creates this storage path or reads DEV presets.
      this.devBPersistence = new DevBParamPersistence({
        runtime: this.runtime,
        storage: devBPersistenceStorage(import.meta.env.DEV),
      });
      // Read without applying: saved presets must not silently override difficulty.
      if (this.devBPersistence.enabled) this.devBPersistence.read();
    }
    this.resetRice();
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);
    window.addEventListener('resize', this.resize);
    this.resize();

    if (import.meta.env.DEV) {
      this.debugPanel = new DebugDetailsPanel(container, {
        developerMode: import.meta.env.DEV,
        onTemporaryControl: faction => this.setTemporaryInputTarget(faction),
        onExportLog: () => this.exportAILog(),
        onMatchSeed: value => this.setDevMatchSeed(value),
        onToggleFreeze: () => this.toggleDevFreeze(),
        onSafetyPaths: enabled => {
          if (this.safetyPaths) this.safetyPaths.enabled = enabled;
          this.updatePerceptionHud();
        },
        onExpanded: () => this.updatePerceptionHud(),
      });
      this.sceneEditor = new SceneEditor({
        container,
        topRow: this.debugPanel.topRow,
        camera: this.camera,
        dom: this.renderer.domElement,
        freeze: this.devFreeze,
        developerMode: import.meta.env.DEV,
        factionSwitchEnabled: C.development.factionSwitchEnabled,
        getPhase: () => this.match.phase,
        mapSource: this.appliedMapSource(),
        savedLayoutSignature: layoutSignature(authoredLayoutDocument()),
        savedLayoutAt: null,
        savedLayoutError: null,
        onRebuild: map => this.rebuildApartment(map),
        // Keep the existing actor/hide-exit precheck before applying any draft.
        onPrecheck: map => this.precheckMapEdit(map),
        onFocus: point => this.editorFocus.set(point.x, 0, point.z),
        onZoom: direction => this.zoomEditorCamera(direction),
        onPan: (deltaX, deltaY) => this.panEditorCamera(deltaX, deltaY),
      });
      this.sceneEditor.setBuild(this.apartment);
      this.devBDebug = new DevBDebug({
        container,
        topRow: this.debugPanel.topRow,
        scene: this.scene,
        runtime: this.runtime,
        developerMode: this.debugPossessionEnabled,
        persistence: this.devBPersistence,
        collectObservation: () => this.collectDevBObservation(),
        collectFrame: () => this.collectDevBFrame(),
      });
    }
    if (this.debugPossessionEnabled) {
      this.renderer.domElement.addEventListener('click', this.onActorClick);
    }
    // S7C-1B 技能 HUD：只显示当前控制方自己的状态与冷却，不暴露对手藏身信息。
    this.skillHud = this.label(container, 'skill-hud');
    this.skillHud.hidden = true;
    this.skillHudState = this.label(this.skillHud, 'skill-hud-state');
    this.skillHudNotice = this.label(this.skillHud, 'skill-hud-notice');
    this.alphaHud = new AlphaHudView(container);
    this.overlay = this.label(container, 'game-overlay');
    this.overlayText = this.label(this.overlay, 'overlay-text');
    this.overlayText.innerHTML = REPORT_MARKUP;
    this.overlayHeading = this.overlayText.querySelector('h1')!;
    this.overlaySummary = this.overlayText.querySelector('p')!;
    this.overlayStats = this.overlayText.querySelector('.overlay-stats')!;
    this.difficultyStatus = this.label(this.overlayText, 'difficulty-status');
    this.pauseActions = this.label(this.overlay, 'pause-actions');
    this.resultActions = this.label(this.overlay, 'result-actions');
    this.pauseSettingsButton = populateRoundActions(this.pauseActions, this.resultActions, {
      resume: () => this.resumeFromPause(),
      settings: () => {
        this.pauseSettingsOpen = true;
        this.updateHud(this.nearestRice());
        this.audioSettings.root.querySelector('input')?.focus();
      },
      restart: () => this.restart(), menu: () => this.returnToFactionSelect(),
      switchFaction: () => this.switchPrimaryFactionFromPause(),
      developerMode: this.debugPossessionEnabled,
      help: () => this.openControlsHelp(),
    });
    this.menu = this.label(container, 'faction-menu');
    populateFactionMenu(this.menu, faction => this.chooseFaction(faction));
    this.difficultyView = new DifficultyView(this.menu);
    this.pulseLockView = new PulseLockView(container, C.pulseLock.timing,
      () => this.closePulseLock());
    this.audioSettings = new AudioSettingsView(container, this.audio, () => this.closePauseSettings());
    this.controlsHelp = new ControlsHelpView(container, () => this.closeControlsHelp());
    this.menuSettings = new MenuSettingsView(this.menu, this.audioSettings.root);
    this.feedback = new GameFeedback(container, this.camera);
    this.throwableView = new ThrowableView(this.renderer.domElement, this.scene, this.camera,
      this.throwables, () => this.throwActors(), () => this.control.controlledFaction,
      this.traceThrow, (faction, heading) => {
        (faction === 'DEEPSEEK' ? this.playerAction : this.humanAction).faceHeading(heading);
        this.feedback.show('投掷！', 'soft');
      });
    this.sceneEditor?.attachThrowables(throwableLayout as ThrowableSpawn[],this.throwables,this.throwableView);
    this.sceneEditor?.attachLights(this.roomLights,this.roomLightView,roomLightLayout);
    this.captureNetView = new CaptureNetView(this.renderer.domElement, this.scene, this.camera,
      this.captureNet, () => this.human.position, () => this.player.position,
      () => this.canPlaceNet() && this.control.isControlling('HUMAN'),
      this.traceThrow, this.netGroundClear, () => this.control.selectedFaction === 'HUMAN',
      () => !this.nightActive || this.control.selectedFaction === 'DEEPSEEK' || this.opponentRendered);
    this.audio.setMusic('menu');
    container.addEventListener('pointerdown', this.onAudioGesture);
    container.addEventListener('pointerover', this.onAudioHover);
    container.addEventListener('click', this.onAudioClick);
    window.addEventListener('keydown', this.onAudioGesture);
    window.addEventListener('blur', this.onAudioFocus);
    window.addEventListener('focus', this.onAudioFocus);
    document.addEventListener('visibilitychange', this.onAudioFocus);
    this.updateHud(this.nearestRice());
    this.clock.start();
    this.frame = requestAnimationFrame(this.tick);
  }

  private label(parent: HTMLElement, className: string): HTMLElement {
    const element = document.createElement('section');
    element.className = className;
    parent.append(element);
    return element;
  }

  private onAudioGesture = (): void => { void this.audio.unlock(); };
  private onAudioHover = (event: PointerEvent): void => {
    const button = (event.target as Element)?.closest('button');
    // Delegated pointerover also bubbles when moving between one button's children.
    if (!button || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) return;
    this.audio.play('hover', 'ui', .45);
  };
  private onAudioClick = (event: MouseEvent): void => {
    const button = (event.target as Element)?.closest('button');
    if (!button) return;
    const text = button.textContent ?? '';
    const cue = /返回/.test(text) ? 'back' : /重新|再来/.test(text) ? 'restart'
      : /DeepSeek|Human/.test(text) ? 'confirm' : 'click';
    // Resume inside the user's gesture, before the first post-pause action sound.
    this.syncAudio();
    void this.audio.unlock().then(() => this.audio.play(cue, 'ui', .7));
  };
  private onAudioFocus = (): void => {
    if ((document.hidden || !document.hasFocus()) && this.match.phase === 'PLAYING' &&
        !this.sceneEditor?.isOpen && !this.devFreeze.isFrozen) this.togglePause();
    // Refocusing never resumes a match without the player's explicit Continue.
    this.syncAudio();
  };

  private showWorldFeedback(text: string, tone: 'good' | 'bad' | 'soft',
    source: THREE.Vector3, rice = false): void {
    const listener = this.control.selected(this.player, this.human)?.position;
    // Keep feedback at the player's own position, never label the hidden opponent.
    if (this.nightActive && !this.opponentVisible &&
        (!listener || source.x !== listener.x || source.z !== listener.z)) return;
    if (!listener || this.perceptionGeometry.inspectVision(listener, source, 11).status !== 'VISIBLE') return;
    if (source === this.player.position && this.hide.isConcealed('DEEPSEEK') &&
        this.control.selectedFaction !== 'DEEPSEEK') return;
    this.feedback.show(text, tone, source, rice);
  }

  private playWorld(cue: AudioCue, source: THREE.Vector3 | { x: number; z: number },
    faction?: Faction): void {
    if (DISABLED_AUDIO_CUES.includes(cue)) return;
    if (faction === 'DEEPSEEK' && this.hide.isConcealed('DEEPSEEK') &&
        this.control.selectedFaction !== 'DEEPSEEK') return;
    const listener = this.control.selected(this.player, this.human)?.position;
    if (!listener) return;
    const sameActor = faction && faction === this.control.selectedFaction;
    const level = sameActor ? .8 : worldAudioGain(
      Math.hypot(listener.x - source.x, listener.z - source.z),
      this.perceptionGeometry.soundFactor(listener, source));
    this.audio.play(cue, 'sfx', level);
  }

  private syncAudio(): void {
    const phase = this.match.phase;
    const suspended = document.hidden || !document.hasFocus() || phase === 'PAUSED';
    if (suspended !== this.lastAudioSuspended) {
      this.lastAudioSuspended = suspended;
      void this.audio.setSuspended(suspended);
    }
    if (phase !== this.lastAudioPhase) {
      if (phase === 'READY') {
        this.lastReadySeconds = Math.ceil(this.match.readyRemainingMs / 1000);
        this.audio.play('countdown', 'ui');
      }
      if (phase === 'PLAYING' && this.lastAudioPhase === 'READY') {
        this.audio.play('start', 'ui'); this.feedback.show('开始！', 'good');
      }
      if (phase === 'FINISHED') {
        this.audio.stop('eat'); this.audio.stop('room');
        this.audio.setMusic(null);
        const won = this.match.result?.winner === this.control.selectedFaction;
        const caughtDeepseek = !won && this.control.selectedFaction === 'DEEPSEEK' &&
          this.match.result?.reason === 'CAPTURED';
        this.audio.play(won ? 'victory' : caughtDeepseek ? 'deepseekCaughtDefeat' : 'defeat', 'ui');
        this.feedback.show(won ? '胜利！' : '再接再厉', won ? 'good' : 'soft');
      }
      if (phase === 'FACTION_SELECT' || phase === 'READY') this.audio.setMusic('menu');
      this.lastAudioPhase = phase;
    }
    if (phase !== 'PLAYING') return;
    this.audio.loop('room', 'room', 'ambience', .35);
    // Existing visible chase/capture facts only: no new AI detection and no hidden-location cue.
    const observer = this.control.selectedFaction;
    const chase = !!observer && this.vision.get(observer).visible &&
      (this.captureZoneActive || (observer === 'DEEPSEEK' && this.humanAI.state === 'CHASE'));
    const target: MusicCue = chase ? 'chase' : 'game';
    this.audio.setMusic(target);
  }

  private chooseFaction(faction: Faction): void {
    if (!this.startupReadiness.canStart) return;
    if (!this.match.beginFromFactionSelect()) return;
    this.difficulty = this.difficultyView.value;
    this.control.choose(faction);
    this.resetRound();
    this.lastDeepseekVisualHeadingRad = null;
    this.deepseekVisualTarget = { kind: 'NONE' };
    this.menu.hidden = true;
    this.input.clear();
    this.resize();
    this.followCamera();
    this.updateHud(this.nearestRice());
    this.maybeOpenControlsHelp(faction);
  }

  useSimplifiedStartupVisual(): void { this.playerAction.useSimplifiedVisual(); }

  private followCamera(deltaMs = 0): void {
    const target = this.control.cameraTarget === 'DEEPSEEK' ? this.player
      : this.control.cameraTarget === 'HUMAN' ? this.human : null;
    if (!target) return;
    positionCameraOnTarget(this.camera, this.gentleCamera.update(target.position, deltaMs), this.cameraOffset);
  }

  private setTemporaryInputTarget(faction: Faction): void {
    if (!this.debugPossessionEnabled || this.match.phase !== 'PLAYING' ||
        this.pulseLock.isOpen || this.sceneEditor?.isOpen ||
        !this.control.setTemporaryInputTarget(faction)) return;
    this.input.clear();
    this.aiThrowers.DEEPSEEK.cancel(); this.aiThrowers.HUMAN.cancel();
    this.captureNet.cancel(); this.captureNetView.cancel();
    this.lastDeepseekVisualHeadingRad = null;
    this.deepseekVisualTarget = { kind: 'NONE' };
    this.hideSearchView.clearPlayerTarget();
    this.updateHud(this.nearestRice());
    this.updatePerceptionHud();
  }

  private onActorClick = (event: MouseEvent): void => {
    if (!this.debugPossessionEnabled || this.match.phase !== 'PLAYING' ||
        this.pulseLock.isOpen || this.sceneEditor?.isOpen || event.button !== 0) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      (event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
    const faction = pickActorFaction(this.camera, pointer, this.player, this.human);
    if (faction) this.setTemporaryInputTarget(faction);
  };

  private traceThrow = (from: ThrowPoint, to: ThrowPoint, radius: number): number | null =>
    this.collision.traceCircleXZ(from, to, radius);

  private canPlaceNet(): boolean {
    return this.match.phase === 'PLAYING' && !this.devFreeze.isFrozen &&
      !this.sceneEditor?.isOpen && !this.controlsHelp.visible && !this.pulseLock.isOpen &&
      !this.throwables.isStunned('HUMAN');
  }

  /** Physical authority only; never sends hidden occupancy/coordinates to AI policy. */
  private netGroundClear = (point: ThrowPoint): boolean => {
    const c = C.captureNet;
    if (!this.collision.canOccupyStaticXZ(point.x, point.z, c.radius, C.three.actorHeight) ||
        this.traceThrow(point, point, c.radius) !== null) return false;
    const overlap = (p: ThrowPoint, radius: number) =>
      Math.hypot(point.x - p.x, point.z - p.z) < c.radius + radius;
    if ([this.human.position, this.player.position].some(p => overlap(p, C.collision.playerRadius))) return false;
    // Protect every possible enter=exit position, not just today's anchor or
    // concealed actor. Sector regions use a conservative enclosing circle.
    if (this.hideSpots.some(spot => {
      const furniture = this.mapFurniture.find(item => item.id === spot.furnitureId);
      return furniture && overlap(furniture, spot.interactionRegion.radius + C.collision.playerRadius);
    })) return false;
    const protectedPoints = [...this.riceViews.values()].map(v => v.position);
    const spawns = this.matchSetup ? [this.matchSetup.human, this.matchSetup.deepseek] : [SPAWNS.human, SPAWNS.deepseek];
    return ![...protectedPoints, ...spawns, ...this.hideSpots,
      ...(this.hide.entryPosition ? [this.hide.entryPosition] : [])]
      .some(p => overlap(p, c.protectedClearance));
  };

  private throwActors(): (ThrowActor & { heading: number; renderVisible: boolean })[] {
    return (['DEEPSEEK', 'HUMAN'] as const).map(faction => {
      const actor = faction === 'DEEPSEEK' ? this.player : this.human;
      return { faction, x: actor.position.x, z: actor.position.z,
        hidden: this.hide.isConcealed(faction),
        renderVisible: !this.nightActive || faction === this.control.selectedFaction || this.opponentRendered,
        canAct: this.match.phase === 'PLAYING' && !this.devFreeze.isFrozen &&
          !this.sceneEditor?.isOpen && !this.pulseLock.isOpen &&
          !this.controlsHelp.visible &&
          (faction !== 'HUMAN' || this.captureNet.mode === 'NONE') &&
          (faction !== 'DEEPSEEK' || this.captureNet.rootMs <= 0) &&
          !this.throwables.isStunned(faction) &&
          (faction !== 'DEEPSEEK' || this.sprint.state !== 'STUNNED'),
        heading: faction === 'DEEPSEEK' ? this.playerAction.headingRad : this.humanAction.headingRad };
    });
  }

  private tryHumanAiNet(visibleTarget: ThrowPoint | null, direction: ThrowPoint): void {
    const profile = C.captureNetAI[this.difficulty];
    if (!visibleTarget || !this.captureNet.ready || this.captureNet.rootMs > 0 ||
        this.captureNet.nets.length >= profile.maxActiveNets ||
        this.throwables.nowMs < this.netAiNextAttemptAt) return;
    this.netAiNextAttemptAt = this.throwables.nowMs + profile.attemptIntervalMs;
    const point = humanNetPlacement(this.human.position, visibleTarget, direction);
    if (point && this.canPlaceNet())
      this.captureNet.place(this.human.position, point, this.traceThrow, this.netGroundClear);
  }

  private humanNetReactionWaiting(aiEnabled: boolean): boolean {
    if (!aiEnabled) {
      this.netAiSawRooted = false; this.netAiApproachAt = 0; return false;
    }
    const rootedVisible = this.captureNet.rootMs > 0 && this.vision.get('HUMAN').visible;
    if (rootedVisible && !this.netAiSawRooted)
      this.netAiApproachAt = this.throwables.nowMs + C.captureNetAI[this.difficulty].approachDelayMs;
    this.netAiSawRooted = rootedVisible;
    return rootedVisible && this.throwables.nowMs < this.netAiApproachAt;
  }

  private updateAiThrowables(deepseekEnabled: boolean, humanEnabled: boolean): void {
    const actors = this.throwActors();
    for (const actor of actors) {
      const faction = actor.faction, opponent = faction === 'HUMAN' ? 'DEEPSEEK' : 'HUMAN';
      const target = actors.find(a => a.faction === opponent)!;
      const allowed = faction === 'DEEPSEEK' ? deepseekEnabled && this.sprint.state === 'NORMAL' : humanEnabled;
      const targetFree = !this.throwables.isStunned(opponent) &&
        (opponent !== 'DEEPSEEK' || (this.captureNet.rootMs <= 0 && this.sprint.state !== 'STUNNED'));
      const visibleTarget = targetFree && !target.hidden && this.vision.get(faction).visible ? target : null;
      const controller = this.aiThrowers[faction];
      const result = controller.update(this.throwables, { ...actor, canAct: actor.canAct && allowed },
        visibleTarget, this.difficulty, this.traceThrow);
      if (result?.started && this.control.selectedFaction === opponent && this.vision.get(opponent).visible) {
        const position = faction === 'HUMAN' ? this.human.position : this.player.position;
        this.showWorldFeedback('准备投掷…', 'soft', position);
      }
    }
  }

  private box(w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color }));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private resetRice(selected = selectRiceCandidates()): void {
    for (const view of this.riceViews.values()) {
      this.scene.remove(view.object);
      view.dispose();
    }
    this.riceViews.clear();
    this.rice = new RiceField(selected.map(point => point.id),
      C.rice.maxProgressMs, C.rice.prepareMs);
    for (const point of selected) {
      const view = new RiceView(C.rice.size / U, C.rice.color, C.rice.visual);
      view.position.set(point.x, 0, point.z);
      applyInteriorSunShadow(view.object, isCoveredInterior(point.x, point.z));
      view.sync(this.rice.get(point.id)!.rice);
      this.scene.add(view.object);
      this.riceViews.set(point.id, view);
    }
  }

  private nearestRice(): { id: string; portion: RiceField['portions'][number]; range: number } | null {
    let nearest: { id: string; portion: RiceField['portions'][number]; range: number } | null = null;
    for (const portion of this.rice.portions) {
      if (portion.rice.completed) continue;
      const view = this.riceViews.get(portion.rice.id)!;
      const range = distance(this.player.position, view.position);
      if (!nearest || range < nearest.range) {
        nearest = { id: portion.rice.id, portion, range };
      }
    }
    return nearest;
  }

  private resize = (): void => {
    const width = Math.max(1, innerWidth), height = Math.max(1, innerHeight);
    Object.assign(this.camera, homeFrustum(width / height, this.match.phase === 'FACTION_SELECT',
      C.three.viewHeight * this.devZoom, MAP_DEPTH, MAP_WIDTH));
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private tick = (): void => {
    const deltaMs = Math.min(this.clock.getDelta() * 1000, C.match.maxFrameDeltaMs);
    const cameraEnabled = this.control.selectedFaction !== null &&
      (this.match.phase === 'PLAYING' || this.sceneEditor?.isOpen);
    // Camera-angle shortcuts are authoring tools, not production controls.
    if (import.meta.env.DEV) {
      if (cameraEnabled && !document.activeElement?.matches('input, textarea, [contenteditable="true"]')) {
        if (this.input.consumePress('KeyZ')) this.cameraOrbit.turn(1);
        if (this.input.consumePress('KeyC')) this.cameraOrbit.turn(-1);
        if (this.input.consumePress('KeyX')) this.cameraOrbit.restore();
      } else {
        this.input.consumePress('KeyZ');
        this.input.consumePress('KeyC');
        this.input.consumePress('KeyX');
      }
    }
    this.cameraOrbit.update(deltaMs);
    // Movement reads the live camera heading in this same frame, not last frame's heading.
    if (cameraEnabled) {
      if (this.sceneEditor?.isOpen) this.followEditorCamera();
      else this.followCamera();
    }
    // DEV 双阵营冻结：the single timing seam. While frozen the gameplay delta is
    // zero, so no system advances and no timer or cooldown can expire during the
    // frozen real time; the clock keeps reading so a resume never jumps.
    const gameplayMs = this.devFreeze.gameplayDelta(this.match.phase, deltaMs);
    const frozen = this.devFreeze.isFrozen;
    this.input.setTabCaptureEnabled(
      this.debugPossessionEnabled && C.development.directHotkeysEnabled &&
      this.match.phase === 'PLAYING' && !frozen);
    const helpWasVisible = this.controlsHelp.visible;
    const pausePressed = this.input.consumePress('Escape');
    const restartPressed = this.input.consumePress('KeyR');
    const menuPressed = this.input.consumePress('KeyM');
    const controlSwitchPressed = this.input.consumePress('Tab');
    const shortcut = resolveRoundShortcut(this.match.phase,
      import.meta.env.DEV && C.development.directHotkeysEnabled && !this.pulseLock.isOpen && !frozen,
      restartPressed, menuPressed);
    if (shortcut === 'RESTART') {
      this.restart();
    } else if (shortcut === 'FACTION_SELECT') {
      this.returnToFactionSelect();
    } else if (this.match.phase === 'FINISHED') {
      // The finished scene remains frozen until a global shortcut or button is used.
    } else if (this.match.phase !== 'FACTION_SELECT') {
      if (pausePressed) {
        if (this.controlsHelp.visible) this.closeControlsHelp();
        else if (this.captureNet.mode !== 'NONE' && this.control.isControlling('HUMAN')) {
          this.captureNet.cancel(); this.captureNetView.cancel();
        }
        else if (this.match.phase === 'PAUSED' && this.pauseSettingsOpen) this.closePauseSettings();
        else if (this.pulseLock.isOpen) this.closePulseLock();
        else this.togglePause();
      }
      if (helpWasVisible || this.controlsHelp.visible) {
        // Reading help must not spend READY time or advance the match. Escape
        // only closes help this frame; buffered movement must not leak through.
        this.input.clear();
      } else if (this.match.phase === 'READY') {
        // The pre-round countdown must keep advancing (see readyDelta): it is a
        // phase timer, not the gameplay delta the DEV freeze is allowed to gate.
        const readyMs = this.devFreeze.readyDelta(document.hidden || !document.hasFocus() ? 0 : deltaMs);
        if (readyMs > 0) {
          this.match.advanceReady(readyMs);
          const seconds = Math.ceil(this.match.readyRemainingMs / 1000);
          if (seconds < this.lastReadySeconds && seconds > 0)
            this.audio.play(seconds === 1 ? 'countdownLast' : 'countdown', 'ui');
          this.lastReadySeconds = seconds;
        }
      } else if (this.match.phase === 'PLAYING') {
        if (!frozen && !this.pulseLock.isOpen && this.debugPossessionEnabled &&
            resolveDirectControlSwitch(this.match.phase,
              C.development.directHotkeysEnabled, controlSwitchPressed)) {
          this.control.toggleControlled();
          this.lastDeepseekVisualHeadingRad = null;
          this.deepseekVisualTarget = { kind: 'NONE' };
          this.hideSearchView.clearPlayerTarget();
        }
        if (gameplayMs > 0) {
          this.updatePlaying(gameplayMs);
        } else if (frozen) {
          // DEV 冻结不是重置：drop buffered keys so no pre-freeze input replays
          // after the resume, while the DEV panel and editor stay interactive.
          this.input.clear();
        }
      }
    }
    const editorOpen = this.sceneEditor?.isOpen ?? false;
    if (frozen || editorOpen || this.match.phase !== 'PLAYING') {
      this.captureNet.cancel(); this.captureNetView.cancel();
    }
    if (editorOpen && !this.editorOpenLast) {
      if (this.pulseLock.isOpen) this.closePulseLock();
      const actor = this.control.selected(this.player, this.human);
      this.editorFocus.set(actor?.position.x ?? 0, 0, actor?.position.z ?? 0);
    } else if (!editorOpen && this.editorOpenLast) {
      // Leaving the editor restores the ordinary camera framing (the DEV zoom
      // belongs to the editor session only).
      this.devZoom = 1;
      this.resize();
    }
    this.editorOpenLast = editorOpen;
    if (this.control.selectedFaction !== null) {
      if (editorOpen) this.followEditorCamera();
      else this.followCamera(this.match.phase === 'PLAYING' && !frozen ? deltaMs : 0);
    }
    if (editorOpen) this.sceneEditor?.onFrame();
    const showMapDebug = import.meta.env.DEV && (!!this.debugPanel?.isExpanded || editorOpen);
    this.apartment.debugRoot.visible = showMapDebug;
    for (const view of this.doorViews.values()) view.setDebugVisible(showMapDebug);
    // DEV-B refresh uses the real frame delta so the debug view keeps working
    // while the gameplay freeze is active; it never advances gameplay itself.
    this.devBDebug?.onFrame(deltaMs);
    // Keep diagnostic overlays out of the formal composition; settings and
    // runtime overrides remain intact and reappear when either DEV panel opens.
    if (this.devBDebug) this.devBDebug.view.group.visible =
      this.match.phase !== 'FACTION_SELECT' && (this.devBDebug.isOpen || !!this.debugPanel?.isExpanded);
    // The toolbar shows the live freeze state plus the most recent rejected
    // freeze action (for example resuming while the scene editor is open).
    this.debugPanel?.setFreezeState(frozen, this.devFreeze.lastRejection === '无'
      ? this.devFreeze.reasonLabel
      : `${this.devFreeze.reasonLabel}｜最近拒绝：${this.devFreeze.lastRejection}`);
    // 玩家当前唯一白色交互轮廓：先同步既有 Human Q，再同步人工 DP 的视觉目标。
    this.syncPlayerFurnitureTarget();
    this.syncDeepSeekVisualTarget();
    this.syncHideSpotIndicators();
    this.updateHud(this.nearestRice());
    this.updatePerceptionHud();
    this.syncAudio();
    // Final render visibility after all gameplay updates, before shadows and held props.
    this.syncNightPresentation(helpWasVisible ? 0 : gameplayMs);
    const lightActor = this.control.controlled(this.player, this.human);
    this.roomLightView.sync(this.nightActive, this.roomLights, lightActor?.position ?? null,
      this.roomLightBlocked, !!this.control.controlledFaction && this.canUseRoomLight(this.control.controlledFaction));
    this.apartment.interiorShadows.update();
    this.actorShadows.update();
    this.throwableView.sync();
    this.captureNetView.sync();
    fitOrthographicSceneDepth(this.camera, this.sceneVisualBounds);
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  private followEditorCamera(): void {
    positionCameraOnTarget(this.camera, this.editorFocus, this.cameraOffset);
  }

  private zoomEditorCamera(direction: number): void {
    if (!this.sceneEditor?.isOpen) return;
    const factor = direction > 0 ? 1.15 : 1 / 1.15;
    this.devZoom = Math.min(2.5, Math.max(0.45, this.devZoom * factor));
    this.resize();
  }

  private panEditorCamera(deltaX: number, deltaY: number): void {
    if (!this.sceneEditor?.isOpen) return;
    const worldPerPixel = (this.camera.right - this.camera.left) / Math.max(1, innerWidth);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() === 0) return;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    this.editorFocus.addScaledVector(right, deltaX * worldPerPixel)
      .addScaledVector(forward, -deltaY * worldPerPixel);
  }

  // DEV 冻结按钮：manual freeze is an explicit DEV choice; while the scene editor
  // is open the resume attempt is rejected with a visible reason instead of
  // letting both factions start moving during an edit.
  private toggleDevFreeze(): void {
    if (this.devFreeze.isFrozenBy('MANUAL_DEV_FREEZE')) {
      if (this.devFreeze.manualResume(this.match.phase)) this.input.clear();
      return;
    }
    const summary = `对局中 ${formatMatchTime(this.match.elapsedMs)}｜米 ` +
      `${this.rice.completedCount}/${ACTIVE_RICE_COUNT}｜` +
      `抓捕 ${(this.match.captureProgressMs / 1000).toFixed(2)}`;
    if (this.devFreeze.manualFreeze(this.match.phase, summary)) this.input.clear();
  }

  // Safe rebuild: the edited map replaces the static collision world and the
  // navigation grid, every AI drops its cached path, and the door dynamic
  // obstacles are re-registered on the new world.
  private rebuildApartment(map: CommittedMap): ApartmentBuild {
    this.apartment.dispose();
    this.apartment = buildApartment(this.scene, {
      furniture: map.furniture, hideSpots: map.hideSpots,
      debug: import.meta.env.DEV && DEBUG_MAP, editorTools: import.meta.env.DEV });
    this.sceneVisualBounds.setFromObject(this.apartment.root);
    this.collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, this.apartment.obstacles,
      this.apartment.orientedObstacles);
    this.navigation = new NavigationSystem(this.collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
    this.humanAI.rebindNavigation(this.navigation);
    this.deepseekAI.rebindNavigation(this.navigation);
    this.mapFurniture = map.furniture;
    this.hideSpots = map.hideSpots;
    // Only a real map change resets the hide state: closing or discarding the
    // editor rebuilds the same map and must not kick a concealed player out.
    const signature = this.mapSignature(map);
    const changed = signature !== this.appliedMapSignature;
    if (changed) {
      this.aiThrowers.DEEPSEEK.cancel(); this.aiThrowers.HUMAN.cancel();
      this.captureNet.destroy(); this.captureNet.cancel(); this.captureNetView.cancel();
      this.appliedMapSignature = signature;
      this.releaseHide('MAP_APPLIED');
      this.deepseekVisualTarget = { kind: 'NONE' };
      this.hideSearchView.clearPlayerTarget();
    }
    // S7C-2：AI 的公开地图数据、站位可行性、失败冷却与线索记忆都绑在旧几何上，
    // 必须跟着新地图一起更新，绝不能继续前往被删除或移动过的旧家具位置。
    this.humanAI.rebindMap(this.humanAiMapSnapshot(), changed);
    // S7C-2b：DeepSeek AI 的公开藏身点快照同样绑在旧几何上；代次一变就作废
    // 走位中的藏身计划，绝不继续前往被删除或移动过的旧家具位置。
    this.rebuildDeepseekHideMap(changed);
    this.syncAllDoors();
    return this.apartment;
  }

  /** 唯一构造点：把当前已应用地图整理成 DeepSeek AI 可见的公开藏身点快照。 */
  private rebuildDeepseekHideMap(changed: boolean): void {
    if (changed) this.deepseekHideRevision++;
    this.deepseekHideMap = createDeepSeekHideMapSnapshot({
      hideSpots: this.hideSpots, furniture: this.mapFurniture,
      revision: this.deepseekHideRevision });
    this.deepseekAI.rebindMap(this.deepseekHideMap, changed);
  }

  /**
   * S7C-2b：交给 DeepSeek AI 的真实几何接缝。全部是公开或自身信息（碰撞可站立、
   * 导航、墙体与非 OPEN 门叶遮挡），门态每帧现取，因此不会读到过期门态。
   */
  private deepseekHideWorld(): DeepSeekHideWorld {
    return { collision: this.collision, navigation: this.navigation,
      visionStatus: (from, to, maxRange) => this.perceptionGeometry
        .inspectVision(from, to, maxRange).status };
  }

  // 当前已应用地图（含开机恢复出来的布局）作为编辑器会话与布局比较的起点。
  private appliedMapSource(): MapSource {
    return { ...authoredMapSource(), furniture: this.mapFurniture,
      hideSpots: this.hideSpots };
  }


  private mapSignature(map: CommittedMap): string {
    const furniture = map.furniture.map(rect => `${rect.id}:${rect.x},${rect.z},` +
      `${rect.width},${rect.depth},${rect.height},${rect.rotation ?? 0}`).join('|');
    const spots = map.hideSpots.map(spot => `${spot.id}:${spot.x},${spot.z}`).join('|');
    return `${furniture}#${spots}`;
  }

  // S7C-2：交给 Human AI 的公开世界快照 = 已应用地图数据 + 三条真实几何接缝。
  // 只有公开信息；占用状态、隐藏角色实时坐标与任何开发者专用真值都不在这里。
  // 修复轮：改由 `createHumanAiMapSnapshot()` 统一构造，测试可以用同一段真实源码
  // 复现这份接线，从而抓住「回调被漏掉、AI 静默失效」这类只在运行时暴露的故障。
  private humanAiMapSnapshot(): HumanAIMapSnapshot {
    return createHumanAiMapSnapshot({
      furniture: this.mapFurniture,
      hideSpots: this.hideSpots,
      visionStatus: (from, to, maxRange) => this.perceptionGeometry
        .inspectVision(from, to, maxRange).status,
      canOccupyStaticXZ: (x, z, radius, height) =>
        this.collision.canOccupyStaticXZ(x, z, radius, height),
      playerRadius: C.collision.playerRadius,
      actorHeight: C.three.actorHeight,
    });
  }

  // S7C-1B 地图应用预检（只读）：由场景编辑器在真正 apply 之前调用。预检失败时
  // 编辑器直接拒绝应用，旧地图、两个角色站位与旧藏身状态都不受影响。
  private precheckMapEdit(map: CommittedMap): string | null {
    const concealed = this.hide.state === 'CONCEALED' && this.hide.entryPosition
      ? { spotId: this.hide.spotId ?? '', x: this.hide.entryPosition.x,
        z: this.hide.entryPosition.z }
      : null;
    const result = precheckMapApplication({
      furniture: map.furniture,
      hideSpots: map.hideSpots,
      actors: [
        { id: 'DEEPSEEK', x: this.player.position.x, z: this.player.position.z },
        { id: 'HUMAN', x: this.human.position.x, z: this.human.position.z },
      ],
      concealed,
    });
    return result.ok ? null : result.message;
  }

  private roomLightBlocked = (a: { x: number; z: number }, b: { x: number; z: number }): boolean =>
    this.collision.isLineBlockedXZ(new THREE.Vector3(a.x, 0, a.z), new THREE.Vector3(b.x, 0, b.z));

  private canUseRoomLight(faction: Faction): boolean {
    const actor = this.throwActors().find(a => a.faction === faction);
    return this.difficulty === 'HARD' && !!actor?.canAct && !actor.hidden &&
      (faction !== 'DEEPSEEK' || this.sprint.state === 'NORMAL');
  }

  private roomLightDebugDirection(): { x: number; y: number } {
    if (!this.input.isHeld('KeyL')) this.lightOwnsL = false;
    const actor = this.control.controlled(this.player, this.human);
    if (this.input.isHeld('KeyL') && this.difficulty === 'HARD' && actor &&
        this.roomLights.nearby(actor.position, this.roomLightBlocked)) this.lightOwnsL = true;
    return this.input.debugDirection(this.lightOwnsL);
  }

  private handleRoomLightInput(): void {
    if (!this.input.consumePress('KeyL')) return;
    if (['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight']
      .some(key => this.input.isHeld(key))) return;
    const faction = this.control.controlledFaction;
    const actor = this.control.controlled(this.player, this.human);
    if (!faction || !actor || !this.canUseRoomLight(faction) ||
        document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
    const item = this.roomLights.nearby(actor.position, this.roomLightBlocked);
    if (!item) return;
    this.lightOwnsL = true;
    const changed = this.roomLights.toggle(item.roomId, actor.position, true, this.roomLightBlocked);
    this.feedback.show(changed ? (this.roomLights.isOn(item.roomId) ? '已开灯' : '已关灯') : '开关冷却中', 'soft');
  }

  private roomLightAiDirection(faction: Faction, actor: THREE.Mesh, allowApproach: boolean,
    visibleOpponent: { x: number; z: number } | null): { x: number; z: number } | null {
    if (!this.canUseRoomLight(faction)) return null;
    const item = this.roomLights.aiCandidate(faction, actor.position, visibleOpponent);
    if (!item) return null;
    // No remote commands: use the identical physical interaction gate as the player.
    if (this.roomLights.toggle(item.roomId, actor.position, true, this.roomLightBlocked)) return null;
    if (!allowApproach || Math.hypot(actor.position.x - item.approach.x, actor.position.z - item.approach.z) >
        C.roomLights.aiDetourRange) return null;
    const path = this.navigation.findPath(actor.position, item.approach, this.doorSystem.doors);
    if (!path || path.some(p => !this.roomLights.sameArea(this.roomLights.roomId(p), item.roomId))) return null;
    if (faction === 'DEEPSEEK' && visibleOpponent && path.some(p =>
        Math.hypot(p.x - visibleOpponent.x, p.z - visibleOpponent.z) < Math.max(C.roomLights.aiSafeDistance,
          Math.hypot(actor.position.x - visibleOpponent.x, actor.position.z - visibleOpponent.z)))) return null;
    const next = path.find(p => Math.hypot(p.x - actor.position.x, p.z - actor.position.z) > .35);
    if (!next || this.roomLightBlocked(actor.position, next)) return null;
    const dx = next.x - actor.position.x, dz = next.z - actor.position.z, length = Math.hypot(dx, dz);
    return { x: dx / length, z: dz / length };
  }

  private updatePlaying(deltaMs: number): void {
    if (this.difficulty === 'HARD') this.roomLights.advance(deltaMs);
    this.handleRoomLightInput();
    this.throwables.advanceTime(deltaMs);
    this.captureNet.advance(deltaMs, this.human.position, this.canPlaceNet(),
      this.traceThrow, this.netGroundClear,
      Math.max(this.throwables.stunRemaining.DEEPSEEK, this.sprint.stunRemainingMs));
    const focusedControl = document.activeElement;
    if (this.input.consumePress('KeyF') &&
        !['ControlLeft','ControlRight','MetaLeft','MetaRight','AltLeft','AltRight'].some(key => this.input.isHeld(key)) &&
        !(focusedControl?.matches('input,textarea,select,button,[contenteditable="true"]') &&
          focusedControl.getClientRects().length > 0)) {
      const actor = this.throwActors().find(a => a.faction === this.control.controlledFaction);
      if (actor && this.throwables.pickup(actor, this.traceThrow)) {
        this.feedback.show(`拾取${THROWABLE_NAMES[this.throwables.held(actor.faction)!.kind]}`, 'good');
      }
    }
    this.sound.advance(deltaMs);
    this.deepseekDoorLockPenalty.advance(deltaMs);
    // S7C-1B：两个 Q 技能的冷却与扇形特效都跑在正式玩法时间上，所以暂停与 DEV
    // 冻结期间不会推进；藏身事件每帧收集，供 DEV 面板与 AI JSON 使用。
    this.humanSearchCooldown.advance(deltaMs);
    this.deepseekLockCooldown.advance(deltaMs);
    const qReady = (this.control.selectedFaction === 'HUMAN'
      ? this.humanSearchCooldown : this.deepseekLockCooldown).ready;
    if (qReady && !this.lastQReady) {
      this.audio.play('skillReady', 'ui', .55);
      this.feedback.show(this.control.selectedFaction === 'HUMAN' ? 'E 搜查 / V 抓捕就绪' : 'Q 技能就绪', 'good');
    }
    this.lastQReady = qReady;
    this.hideSearchView.advance(deltaMs);
    // 藏身事件无论 DeepSeek AI 是否在跑都要进日志时间线；冷却与特效都只随正式
    // 玩法时间推进（上面的 advance 调用）。S7C-2b 起 AI 自主藏身的请求 / 进入 /
    // 拒绝 / 退出 / 中止事件也追加到同一条时间线（不新建第二套数组）。
    const hideEvents = this.hide.drainEvents(), aiHideEvents = this.deepseekAI.drainHideEvents();
    this.aiLogCollector?.recordHideEvents([...hideEvents, ...aiHideEvents]);
    // S7C-2：Human AI 的循迹 / 搜查事件同样进 AI JSON，且与 DeepSeek AI 是否在跑无关。
    const searchEvents = this.humanAI.drainHumanSearchEvents();
    this.aiLogCollector?.recordHumanSearchEvents(searchEvents);
    if (this.hideNoticeRemainingMs > 0) {
      this.hideNoticeRemainingMs = Math.max(0, this.hideNoticeRemainingMs - deltaMs);
      if (this.hideNoticeRemainingMs === 0) this.hideNotice = '';
    }
    this.traces.advance(deltaMs);
    this.vision.update(deltaMs, this.human.position, this.player.position,
      this.perceptionGeometry);
    this.humanStillness.update(this.human.position, deltaMs);
    this.humanDoorSkill.advance(deltaMs, this.match.phase);
    this.pulseLock.advance(deltaMs, this.match.phase);
    this.renderPulseLock();
    const local = cameraRelativeDirection(this.camera, this.input.localDirection());
    const debug = cameraRelativeDirection(this.camera, this.roomLightDebugDirection());
    const { deepseek: direction, human: humanDirection } = this.control.directions(local, debug);
    const aimHeading = this.throwableView.heading('HUMAN');
    if (aimHeading !== undefined)
      this.lastHumanFacing = { x: Math.sin(aimHeading), y: Math.cos(aimHeading) };
    const doorInteraction = this.handleDoorInteractions();
    // 藏身状态可能在本帧刚刚切换（E 进入/退出、Q 搜查命中），因此门交互之后立刻
    // 同步感知与表现，再让移动、进食与抓捕读取同一个状态。S7C-2b 起 AI 自主进入 /
    // 退出藏身也会在同一帧刷新这个局部变量（见下方 hide 命令处理）。
    let concealedDeepseek = this.hide.isConcealed('DEEPSEEK');
    this.vision.setConcealed('DEEPSEEK', concealedDeepseek);
    this.player.visible = !concealedDeepseek;
    if (this.control.isControlling('HUMAN') &&
        (humanDirection.x !== 0 || humanDirection.y !== 0)) {
      this.lastHumanFacing = { x: humanDirection.x, y: humanDirection.y };
    }
    const ratio = this.rice.progressRatio;
    const deepseekAiEnabled = shouldRunDeepSeekAI(this.match.phase,
      this.control.selectedFaction, this.control.temporaryInputTarget,
      debug, this.debugPossessionEnabled);
    let deepseekCommand: DeepSeekAICommand | null = null;
    this.aiLogCollector?.advance(deltaMs, this.match.phase === 'PLAYING');
    this.aiLogCollector?.notePhase(this.match.phase);
    if (deepseekAiEnabled && !this.throwables.isStunned('DEEPSEEK') && this.captureNet.rootMs <= 0) {
      if (!this.deepseekAiWasActive) this.deepseekAI.resumeAfterManualControl();
      const sight = this.vision.get('DEEPSEEK');
      const heardHuman = this.sound.heardBy(this.player.position, 'DEEPSEEK',
        this.camera, this.perceptionGeometry);
      const heardHumanDanger = this.sound.heardBy(this.player.position, 'DEEPSEEK',
        this.camera, this.perceptionGeometry,
        event => isHumanPursuitSound(event.type));
      // S7C-2b：本帧的一次性 AI 进入令牌。只有本帧签发的值才可能通过
      // `HideSystem.enterAsAI()`，因此 AI 无法用一个旧令牌自行开启藏身。
      this.deepseekHideTokenCounter++;
      const hideToken = this.deepseekHideTokenCounter;
      this.hide.issueAiEntryToken(hideToken);
      deepseekCommand = this.deepseekAI.update({
        deltaMs,
        deepseek: this.player.position,
        visibleHuman: sight.visible ? this.human.position : null,
        humanStillMs: sight.visible ? this.humanStillness.stillMs : undefined,
        humanStillEventId: sight.visible ? this.humanStillness.eventId : undefined,
        heardHuman,
        heardHumanDanger,
        lastSeenHuman: sight.lastSeen,
        perceptionNowMs: this.vision.nowMs,
        geometry: this.perceptionGeometry,
        riceProgressRatio: ratio,
        sprintState: this.sprint.state,
        captureProgressMs: this.match.captureProgressMs,
        hideMap: this.deepseekHideMap,
        hideWorld: this.deepseekHideWorld(),
        hideRequestToken: hideToken,
        hideSelf: { hiding: concealedDeepseek, spotId: this.hide.spotId },
        rice: this.rice.states.map(rice => {
          const point = this.riceViews.get(rice.id)!.position;
          return { id: rice.id, x: point.x, z: point.z,
            progressMs: rice.progressMs, maxProgressMs: rice.maxProgressMs,
            completed: rice.completed };
        }),
        doors: this.doorSystem.doors,
        canOpenDoor: id => {
          const node = this.doorSystem.definition(id);
          return !!node && canInteractWithDoorXZ(this.collision, this.player.position, node);
        },
        canCloseDoor: id => {
          const node = this.doorSystem.definition(id);
          return !!node && this.canCloseDoor(id) &&
            canInteractWithDoorXZ(this.collision, this.player.position, node);
        },
        canLockDoor: id => {
          const node = this.doorSystem.definition(id);
          return !!node && canInteractWithDoorXZ(this.collision, this.player.position, node);
        },
        activeLockSlots: C.door.maxActiveLocks - this.doorSystem.activeLockedDoorCount,
        humanPlayerUnlockPenaltyRemainingMs: this.deepseekDoorLockPenalty.remainingMs,
      });
      // S7C-2b：AI 的藏身请求与门 / 进食命令走同一条「AI 只发意图，游戏层裁决」
      // 通路。进入要过权威几何复核 + 一次性令牌；退出要过出口物理判据。
      if (deepseekCommand.hideExitRequest) this.runDeepSeekAiHideExit();
      if (deepseekCommand.hideSpotId)
        this.runDeepSeekAiHideEnter(deepseekCommand.hideSpotId,
          deepseekCommand.hideRequestToken);
      // 藏身状态可能刚刚在本帧被 AI 自己改变：立刻用同一个局部变量刷新，避免
      // 这一帧的移动 / 进食 / 抓捕仍然按旧状态执行。
      concealedDeepseek = this.hide.isConcealed('DEEPSEEK');
      this.vision.setConcealed('DEEPSEEK', concealedDeepseek);
      this.player.visible = !concealedDeepseek;
      if (deepseekCommand.openDoorId) {
        const result = this.doorSystem.toggle(deepseekCommand.openDoorId, 'DEEPSEEK');
        this.applyDoorResult(deepseekCommand.openDoorId, result, 'DEEPSEEK');
      }
      if (deepseekCommand.closeDoorId) {
        const id = deepseekCommand.closeDoorId;
        const node = this.doorSystem.definition(id);
        const valid = !!node && this.doorSystem.get(id)?.state === 'OPEN' &&
          distanceToDoorSegment(this.player.position.x, this.player.position.z, node) <=
            C.door.interactionRange &&
          canInteractWithDoorXZ(this.collision, this.player.position, node) &&
          this.canCloseDoor(id);
        const result = valid ? this.doorSystem.toggle(id, 'DEEPSEEK', true) : 'BLOCKED_BY_ACTOR';
        this.applyDoorResult(id, result, 'DEEPSEEK');
        this.deepseekAI.onDoorEscapeResult(id, result);
      }
      // Lock channel only. Nothing in the AI issues lockDoorId yet, so this
      // branch stays idle until the 3B-1 decision step enables it.
      if (deepseekCommand.lockDoorId) {
        const id = deepseekCommand.lockDoorId;
        const result = lockDoorFromCommand(this.doorSystem, id, this.player.position,
          node => canInteractWithDoorXZ(this.collision, this.player.position, node),
          C.door.interactionRange);
        this.applyDoorResult(id, result, 'DEEPSEEK');
        this.deepseekAI.onDoorLockResult(id, result);
        this.deepseekDoorLockPenalty.onDeepSeekLockResult(id, result);
      }
      // Drain diagnostic queues even when production does not collect snapshots.
      const doorEscapeEvents = this.deepseekAI.drainDoorEscapeEvents();
      const doorLockEvents = this.deepseekAI.drainDoorLockEvents();
      const dsRoom = this.aiLogCollector ? roomAt(this.player.position.x, this.player.position.z) : null;
      this.aiLogCollector?.diffSnapshot({
        doorEscapeEvents, doorLockEvents,
        state: this.deepseekAI.state,
        targetRiceId: this.deepseekAI.targetRiceId,
        threatLevel: this.deepseekAI.threatLevel,
        threatSource: this.deepseekAI.threatSource,
        lastSelectionReason: this.deepseekAI.lastSelectionReason,
        lastNavigationReason: this.deepseekAI.lastNavigationReason,
        lastTransitionReason: this.deepseekAI.lastTransitionReason,
        lastEscapeSwitchReason: this.deepseekAI.lastEscapeSwitchReason,
        escapeRoomId: this.deepseekAI.escapeRoomId,
        noMovementReason: this.deepseekAI.noMovementReason,
        localLoopTriggered: this.deepseekAI.localLoopTriggered,
        sprintDecision: this.deepseekAI.sprintDecision,
        sprintReadiness: this.sprint.readiness,
        recoveryBlockReason: this.deepseekAI.recoveryBlockReason,
        curiosityRollResult: this.deepseekAI.curiosityRollResult,
        curiosityInterruptReason: this.deepseekAI.curiosityInterruptReason,
        curiosityBypassActive: this.deepseekAI.curiosityBypassActive,
        passageRollResult: this.deepseekAI.passageRollResult,
        passageGateReason: this.deepseekAI.passageGateReason,
        passageCancelReason: this.deepseekAI.passageCancelReason,
        passageRouteSafe: this.deepseekAI.passageRouteSafe,
        passageActive: this.deepseekAI.passageActive,
        safetyGeometry: structuredClone(this.deepseekAI.safetyDebug),
        safeWaitRiceId: this.deepseekAI.safeWaitRiceId,
        safeWaitEntryId: this.deepseekAI.safeWaitEntryId,
        safeWaitFailureCount: this.deepseekAI.safeWaitFailureCount,
        safeWaitReason: this.deepseekAI.safeWaitReason,
        safeWaitRemainingMs: this.deepseekAI.safeWaitRemainingMs,
        roomId: dsRoom?.id ?? null,
        humanVisible: sight.visible,
        humanStillMs: this.humanStillness.stillMs,
        stillnessEventId: this.humanStillness.eventId,
        lastSeenValid: sight.lastSeen !== null,
        heardSoundType: heardHuman?.event.type ?? null,
        heardAudibleStrength: heardHuman?.audibleStrength ?? null,
        heardRemainingMs: heardHuman?.remainingMs ?? null,
        heardSoundTimestampMs: heardHuman?.event.timestamp ?? null,
        heardDangerSoundType: heardHumanDanger?.event.type ?? null,
        heardDangerAudibleStrength: heardHumanDanger?.audibleStrength ?? null,
        humanVisibleDistance: sight.visible
          ? Math.hypot(this.player.position.x - this.human.position.x,
            this.player.position.z - this.human.position.z) : null,
        // S7D：藏身相位 / 出口闸门 / 已藏身时长，供整局摘要判定「藏身卡住」。
        hidePhase: this.deepseekAI.hidePhase,
        hideExitGate: this.deepseekAI.hideExitGate,
        hideConcealedMs: this.deepseekAI.hideConcealedMs,
      });
    }
    this.deepseekAiWasActive = deepseekAiEnabled;
    if (deepseekCommand && !concealedDeepseek && !deepseekCommand.startSprint &&
        !deepseekCommand.eatRiceId && !deepseekCommand.openDoorId && !deepseekCommand.closeDoorId &&
        !deepseekCommand.lockDoorId && !deepseekCommand.hideSpotId && !deepseekCommand.hideExitRequest &&
        this.sprint.state === 'NORMAL') {
      const lightDirection = this.roomLightAiDirection('DEEPSEEK', this.player,
        true, this.vision.get('DEEPSEEK').visible ? this.human.position : null);
      if (lightDirection) deepseekCommand.direction = lightDirection;
    }
    const activeDeepseekDirection = deepseekCommand
      ? { x: deepseekCommand.direction.x, y: deepseekCommand.direction.z } : direction;
    if (deepseekCommand?.startSprint && !concealedDeepseek && !this.throwables.isStunned('DEEPSEEK') && this.captureNet.rootMs <= 0) {
      if (this.sprint.tryStart(activeDeepseekDirection, ratio,
          `AI_${this.deepseekAI.sprintDecision}`)) {
        this.aiLogCollector?.recordSprintStart();
        this.playWorld('sprintStart', this.player.position, 'DEEPSEEK');
        this.showWorldFeedback('冲刺', 'soft', this.player.position);
      }
    }
    if (this.input.consumePress('Space')) {
      if (this.control.isControlling('DEEPSEEK') && !concealedDeepseek && !this.throwables.isStunned('DEEPSEEK') && this.captureNet.rootMs <= 0) {
        if (this.sprint.tryStart(direction, ratio, 'PLAYER_SPACE')) {
          this.aiLogCollector?.recordSprintStart();
          this.playWorld('sprintStart', this.player.position, 'DEEPSEEK');
          this.showWorldFeedback('冲刺', 'soft', this.player.position);
        } else this.audio.play('skillUnavailable', 'ui', .6);
      } else if (this.control.isControlling('HUMAN') && !this.pulseLock.isOpen && !this.throwables.isStunned('HUMAN') && this.captureNet.mode === 'NONE') {
        const nearby = this.nearestInteractableDoor(this.human.position);
        if (nearby) {
          const result = this.humanDoorSkill.use(
            nearby.door.id, 'HUMAN', this.match.phase);
          if (result !== 'INVALID_STATE') {
            if (result === 'COOLDOWN') {
              this.doorStatusMessage = '强制破锁冷却中；普通门仍可快速打开';
            } else {
              this.applyDoorResult(nearby.door.id, result);
              this.noteHumanPlayerUnlock(nearby.door.id, result);
            }
          }
        }
      }
    }
    const previousSprintState = this.sprint.state;
    this.sprint.advance(deltaMs, activeDeepseekDirection);
    if (previousSprintState !== 'STUNNED' && this.sprint.state === 'STUNNED') {
      this.sound.emit('FALL', this.player.position, 'DEEPSEEK');
      this.playWorld('fall', this.player.position, 'DEEPSEEK');
      this.playWorld('stun', this.player.position, 'DEEPSEEK');
      this.showWorldFeedback('摔倒！', 'bad', this.player.position);
      this.aiLogCollector?.recordFall();
    }
    if (previousSprintState === 'SPRINT_RUNNING' && this.sprint.state === 'NORMAL')
      this.showWorldFeedback('冲刺结束', 'soft', this.player.position);
    if (previousSprintState === 'STUNNED' && this.sprint.state === 'NORMAL') {
      this.playWorld('recover', this.player.position, 'DEEPSEEK');
      this.showWorldFeedback('恢复', 'good', this.player.position);
    }
    // 藏身中禁止移动（与 STUNNED 同构：位移强制为 0，不新增物理特性）。
    const movement = concealedDeepseek || this.throwables.isStunned('DEEPSEEK') || this.captureNet.rootMs > 0
      ? { x: 0, y: 0 } : this.sprint.movementDirection(activeDeepseekDirection);
    const speed = effectiveSpeeds(this.runtime).player / U *
      (this.sprint.state === 'SPRINT_RUNNING' ? C.sprint.speedMultiplier : 1) *
      (deepseekAiEnabled ? this.deepseekAI.difficultyConfig.movementSpeedMultiplier : 1);
    const oldDeepseek = this.player.position.clone();
    this.move(this.player, movement.x * speed * deltaMs / 1000, movement.y * speed * deltaMs / 1000);
    if (this.control.isControlling('DEEPSEEK') && !deepseekCommand) {
      this.lastDeepseekVisualHeadingRad = nextDeepSeekVisualHeading(
        this.lastDeepseekVisualHeadingRad, oldDeepseek, this.player.position);
    }
    this.traces.recordMovement(this.player.position);
    this.emitMovementSound('DEEPSEEK', oldDeepseek, this.player.position,
      this.sprint.state === 'SPRINT_RUNNING');

    // The AI observes the same S6 vision/sound results as the HUD. Refresh
    // before its decision, then refresh current visibility after Human moves.
    this.vision.update(0, this.human.position, this.player.position,
      this.perceptionGeometry);
    const aiEnabled = shouldRunHumanAI(this.match.phase, this.control.selectedFaction,
      this.control.temporaryInputTarget, debug, this.debugPossessionEnabled);
    const humanNetWait = this.humanNetReactionWaiting(aiEnabled);
    const aiCanAct = aiEnabled && !humanNetWait && !doorInteraction.humanMovementLocked && !this.throwables.isStunned('HUMAN') && !this.captureNet.placing;
    let aiHumanDirection: { x: number; y: number } | null = null;
    let humanAiBusy = false;
    if (aiCanAct) {
      if (!this.humanAiWasActive) this.humanAI.resumeAfterManualControl();
      const sight = this.vision.get('HUMAN');
      const captureEligible = isCaptureEligibleXZ(
        this.human.position, this.player.position, this.runtime.captureRadius,
        this.collision.isLineBlockedXZ(this.human.position, this.player.position));
      const command = this.humanAI.update({
        deltaMs, human: this.human.position,
        visibleTarget: sight.visible ? this.player.position : null,
        lastSeen: sight.lastSeen,
        heard: this.sound.heardBy(this.human.position, 'HUMAN', this.camera,
          this.perceptionGeometry),
        // S7C-2：强危险声沿用现有「追捕型声音」分类，不新造声音类型，也不把
        // 普通门操作声当成危险。米痕先按正式视觉几何过滤成图层 B 再交给 AI，
        // 且无论调用方传什么，AI 内部仍会用自己的真实几何再确认一次。
        heardDanger: this.sound.heardBy(this.human.position, 'HUMAN', this.camera,
          this.perceptionGeometry, event => isHumanPursuitSound(event.type)),
        nowMs: this.traces.nowMs,
        visibleTraces: this.visibleTracesForHumanAi(),
        captureEligible, doors: this.doorSystem.doors,
        forceBreakCooldownMs: this.humanDoorSkill.cooldownRemainingMs,
        canOpenDoor: id => {
          const node = this.doorSystem.definition(id);
          return !!node && canInteractWithDoorXZ(this.collision, this.human.position, node);
        },
      });
      if (command.openDoorId) {
        const result = this.doorSystem.toggle(command.openDoorId, 'HUMAN');
        this.applyDoorResult(command.openDoorId, result, 'HUMAN');
      }
      if (command.unlockDoorId) {
        const result = this.doorSystem.disableLock(command.unlockDoorId, 'HUMAN');
        this.applyDoorResult(command.unlockDoorId, result, 'HUMAN');
      }
      const preparingDoor = this.humanDoorSkill.aiForceBreakDoorId;
      const forceResult = this.humanDoorSkill.tryAiForceBreak(command.forceBreakDoorId,
        deltaMs, this.match.phase);
      if (this.humanDoorSkill.aiForceBreakDoorId &&
          preparingDoor !== this.humanDoorSkill.aiForceBreakDoorId &&
          (this.vision.get('DEEPSEEK').visible ||
           this.nearestInteractableDoor(this.player.position)?.door.id === command.forceBreakDoorId)) {
        const node = this.doorSystem.definition(this.humanDoorSkill.aiForceBreakDoorId)!;
        this.showWorldFeedback('正在强行破锁…', 'soft', new THREE.Vector3(node.x, .8, node.z));
      }
      if (command.forceBreakDoorId && forceResult !== null) {
        const result = forceResult;
        if (result !== 'COOLDOWN')
          this.applyDoorResult(command.forceBreakDoorId, result, 'HUMAN');
      }
      // S7C-2：家具搜查的朝向必须由 AI 显式给出，因此这里直接覆盖人类朝向；
      // 绝不让「人工控制 Human 时留下的过期朝向」参与搜查判定。
      if (command.faceHeadingRad !== null) {
        this.lastHumanFacing = { x: Math.cos(command.faceHeadingRad),
          y: Math.sin(command.faceHeadingRad) };
      }
      if (command.checkHideSpotId) this.runHumanAiHideCheck(command.checkHideSpotId);
      humanAiBusy = !!(command.openDoorId || command.unlockDoorId || command.forceBreakDoorId ||
        command.checkHideSpotId || this.humanAI.unlockProgressMs > 0 || this.humanAI.checkHidePhase === 'DWELL');
      if (!humanAiBusy) this.tryHumanAiNet(sight.visible ? this.player.position : null, command.direction);
      aiHumanDirection = { x: command.direction.x, y: command.direction.z };
      if (!humanAiBusy) {
        const lightDirection = this.roomLightAiDirection('HUMAN', this.human,
          this.humanAI.state === 'PATROL' || this.humanAI.state === 'INVESTIGATE',
          sight.visible ? this.player.position : null);
        if (lightDirection) aiHumanDirection = { x: lightDirection.x, y: lightDirection.z };
      }
    }
    if (!aiCanAct) this.humanDoorSkill.cancelAiForceBreak();
    this.humanAiWasActive = aiCanAct || (aiEnabled && this.throwables.isStunned('HUMAN'));
    // S7C-2 修复轮 五：AI 搜查的可见反馈跟随 AI 自己公开的搜查状态（不参与判定）。
    this.syncHumanAiSearchFeedback(aiCanAct);
    // 本轮新增：Human AI 的路线决策（绕行 / 解锁 / 强破）单独留证。
    // 刻意与门的实际结果分开记录：**决策不等于门被打开**，混记就无法事后分辨。
    if (this.humanAI.lockDecision !== this.lastHumanLockDecision ||
        this.humanAI.decisionReason !== this.lastHumanDecisionReason) {
      this.lastHumanLockDecision = this.humanAI.lockDecision;
      this.lastHumanDecisionReason = this.humanAI.decisionReason;
      this.aiLogCollector?.recordHumanRoute({
        decision: this.humanAI.lockDecision,
        reason: this.humanAI.decisionReason,
        doorId: this.humanAI.targetDoorId,
      });
    }
    const baseHumanSpeed = effectiveSpeeds(this.runtime).human / U;
    const humanSpeed = aiHumanDirection
      ? humanAiMovementSpeed(baseHumanSpeed, this.runtime.humanAIMovementMultiplier)
      : baseHumanSpeed;
    const activeHumanDirection = humanNetWait || doorInteraction.humanMovementLocked || this.throwables.isStunned('HUMAN') || this.captureNet.placing
      ? { x: 0, y: 0 } : aiHumanDirection ?? humanDirection;
    const oldHuman = this.human.position.clone();
    this.move(this.human, activeHumanDirection.x * humanSpeed * deltaMs / 1000,
      activeHumanDirection.y * humanSpeed * deltaMs / 1000);
    this.humanStillness.update(this.human.position, 0);
    this.emitMovementSound('HUMAN', oldHuman, this.human.position, false);
    // Both actor positions now describe this frame, matching the projectile interval.
    this.vision.update(0, this.human.position, this.player.position, this.perceptionGeometry);
    this.updateAiThrowables(!!deepseekCommand && deepseekAiEnabled && !deepseekCommand.eatRiceId &&
      !deepseekCommand.openDoorId && !deepseekCommand.closeDoorId && !deepseekCommand.lockDoorId &&
      !deepseekCommand.hideSpotId && !deepseekCommand.hideExitRequest, aiCanAct && !humanAiBusy);
    const throwHits = this.throwables.advanceFlights(deltaMs, this.throwActors(), this.traceThrow,
      hit => { if(hit.kind === 'BASIN') this.playWorld('basinHit', hit, hit.victim); },
      () => this.captureNet.nets.map(net => ({ ...net, radius: C.captureNet.radius,
        destroy: () => this.captureNet.destroy(net) })));
    for (const faction of throwHits) {
      this.aiLogCollector?.recordThrowHit(faction);
      if (faction === 'DEEPSEEK') this.rice.interrupt();
      if (faction === 'HUMAN' && this.pulseLock.isOpen) this.closePulseLock();
      if (faction === 'HUMAN') { this.captureNet.cancel(); this.captureNetView.cancel(); }
      if (faction === this.control.controlledFaction) this.throwableView.cancel();
      const actor = faction === 'DEEPSEEK' ? this.player : this.human;
      this.showWorldFeedback(`砸中！眩晕${C.throwables.stunDurationMs / 1000}秒`, 'bad', actor.position);
      this.playWorld('fall', actor.position, faction);
    }
    const nearest = this.nearestRice();
    const inRange = !!nearest && nearest.range <= C.rice.interactionRange / U;
    const aiRice = deepseekCommand?.eatRiceId
      ? this.rice.get(deepseekCommand.eatRiceId) : null;
    const aiRicePosition = aiRice && this.riceViews.get(aiRice.rice.id)?.position;
    const aiInRange = !!aiRicePosition &&
      distance(this.player.position, aiRicePosition) <= C.rice.interactionRange / U;
    const previousRice = new Map(this.rice.states.map(state => [state.id, state.progressMs]));
    this.rice.update(deltaMs,
      deepseekCommand ? aiInRange ? deepseekCommand.eatRiceId : null
        : inRange ? nearest!.id : null,
      !this.throwables.isStunned('DEEPSEEK') && this.captureNet.rootMs <= 0 && (deepseekCommand ? aiInRange && this.sprint.state === 'NORMAL' &&
        activeDeepseekDirection.x === 0 && activeDeepseekDirection.y === 0 :
      this.control.isControlling('DEEPSEEK') && !concealedDeepseek &&
      this.sprint.state === 'NORMAL' && this.input.isHeld('KeyE') &&
      !doorInteraction.doorOwnsInteraction && !doorInteraction.hideOwnsInteraction &&
      inRange && direction.x === 0 && direction.y === 0));
    const activeRice = this.rice.activeId && !this.rice.get(this.rice.activeId)?.rice.completed
      ? this.rice.activeId : null;
    if (activeRice !== this.lastRiceActive) {
      if (this.lastRiceActive) {
        this.audio.stop('eat');
        if (!this.rice.get(this.lastRiceActive)?.rice.completed)
          this.playWorld('eatInterrupt', this.player.position, 'DEEPSEEK');
      }
      if (activeRice) this.playWorld('eatStart', this.player.position, 'DEEPSEEK');
      this.lastRiceActive = activeRice;
    }
    if (activeRice) {
      const listener = this.control.selected(this.player, this.human)?.position;
      const level = this.control.selectedFaction === 'DEEPSEEK' ? .6 : listener
        ? worldAudioGain(distance(listener, this.player.position),
          this.perceptionGeometry.soundFactor(listener, this.player.position)) * .6 : 0;
      if (level > .02) {
        this.audio.loop('eat', 'eatLoop', 'sfx', level);
        this.audio.setLoopLevel('eat', level);
      } else this.audio.stop('eat');
    }
    for (const portion of this.rice.portions) {
      this.riceViews.get(portion.rice.id)!.sync(portion.rice);
      const position = this.riceViews.get(portion.rice.id)!.position;
      this.traces.recordProgress(portion.rice.id, this.player.position,
        previousRice.get(portion.rice.id) ?? 0, portion.rice.progressMs);
      if (portion.rice.progressMs > (previousRice.get(portion.rice.id) ?? 0) &&
          this.sound.nowMs - this.lastRiceSoundMs >= C.perception.riceSoundIntervalMs) {
        this.sound.emit('RICE_EAT', position, 'DEEPSEEK');
        if (this.control.selectedFaction === 'DEEPSEEK')
          this.feedback.show('我吃', 'soft', position, true);
        this.lastRiceSoundMs = this.sound.nowMs;
      }
    }
    if (this.rice.completedCount > this.lastRiceCompleted) {
      this.playWorld('eatComplete', this.player.position, 'DEEPSEEK');
      this.showWorldFeedback('吃完一份！', 'good', this.player.position, true);
      this.lastRiceCompleted = this.rice.completedCount;
    }
    if (this.sprint.readiness === 'READY' && this.lastSprintReadiness !== 'READY') {
      if (this.control.selectedFaction === 'DEEPSEEK') {
        this.audio.play('skillReady', 'ui', .55);
        this.feedback.show('冲刺就绪', 'good', this.player.position);
      }
    }
    this.lastSprintReadiness = this.sprint.readiness;
    this.syncTraceViews();
    // Presentation follows the final collision-resolved position; V still hits only on release.
    this.hideSearchView.followPlayer(this.human.position);
    this.vision.update(0, this.human.position, this.player.position,
      this.perceptionGeometry);
    const insideCaptureRadius = isInsideCaptureZoneXZ(
      this.human.position, this.player.position, this.runtime.captureRadius);
    // 藏身中普通抓捕无效：资格直接判为 false，既有的 advancePlaying 会把累计
    // 进度归零，因此不需要第二套抓捕规则。
    this.captureZoneBlocked = !concealedDeepseek && insideCaptureRadius &&
      this.collision.isLineBlockedXZ(this.human.position, this.player.position);
    this.captureZoneActive = !this.throwables.isStunned('HUMAN') && !concealedDeepseek && isCaptureEligibleXZ(
      this.human.position, this.player.position, this.runtime.captureRadius, this.captureZoneBlocked);
    this.match.advancePlaying(deltaMs, this.captureZoneActive, this.rice.completed);
    // S7D：整局摘要的「完成的大米数量」与阶段都取同一帧的正式事实。
    this.aiLogCollector?.recordRiceProgress(this.rice.completedCount);
    this.aiLogCollector?.notePhase(this.match.phase);
    this.captureZone.setProgress(
      this.match.captureProgressMs, C.match.captureMs, this.captureZoneActive);
    if (this.match.result) {
      if (this.match.result.reason === 'CAPTURED') {
        this.playWorld('caught', this.player.position, 'DEEPSEEK');
        this.showWorldFeedback('抓捕命中', 'bad', this.player.position);
      }
      // S7D：结算信息进整局摘要（胜负 / 原因 / 时长 / 完成米数）。
      this.aiLogCollector?.noteMatchResult({
        winner: this.match.result.winner, reason: this.match.result.reason,
        durationMs: this.match.result.elapsedMs,
        riceCompleted: this.rice.completedCount,
      });
      // 本轮新增：结算瞬间的状态事实。必须在这里冲写——局终后 updatePlaying 不再运行，
      // 拖到下一帧就会出现「有结果、没有抓捕状态」的断尾。
      this.aiLogCollector?.recordCapture({
        reason: this.match.result.reason, winner: this.match.result.winner,
        mode: this.match.result.reason === 'CAPTURED' ? 'ZONE' : 'NONE',
        deepseekStunned: this.throwables.isStunned('DEEPSEEK') ||
          this.sprint.state === 'STUNNED',
        deepseekConcealed: this.hide.isConcealed('DEEPSEEK'),
        humanStunned: this.throwables.isStunned('HUMAN'),
        sprintState: this.sprint.state,
        captureProgressMs: this.match.captureProgressMs,
      });
      this.rice.interrupt();
      this.closePulseLock();
      this.captureNet.cancel(); this.captureNetView.cancel();
      this.releaseHide('ROUND_FINISHED');
      // S7C-2 修复轮 二：本帧的正式搜查很可能就是分出胜负的那一次（家具搜查命中
      // 会立即 forceCapture）。局终之后 `updatePlaying` 不再运行，如果不在这里
      // 再冲一次时间线，REQUEST / RESOLVE / HIT 与这次 HIDE_EXIT 就永远不会写进
      // AI JSON——真实日志里就会出现「有 DWELL 却没有结算码」的断点。
      const finalHideEvents = this.hide.drainEvents(), finalAiHideEvents = this.deepseekAI.drainHideEvents();
      this.aiLogCollector?.recordHideEvents([...finalHideEvents, ...finalAiHideEvents]);
      const finalSearchEvents = this.humanAI.drainHumanSearchEvents();
      this.aiLogCollector?.recordHumanSearchEvents(finalSearchEvents);
    }
    // The action layer observes resolved gameplay; it never feeds back into movement or rules.
    const playerMoved = distance(oldDeepseek, this.player.position) > C.collision.contactEpsilon;
    const humanMoved = distance(oldHuman, this.human.position) > C.collision.contactEpsilon;
    const riceState = this.rice.activeId ? this.rice.get(this.rice.activeId)?.rice.interactionState : null;
    this.playerAction.update(resolveCharacterAction({
      moving: playerMoved,
      running: this.sprint.state === 'SPRINT_RUNNING',
      falling: throwHits.includes('DEEPSEEK') || previousSprintState !== 'STUNNED' && this.sprint.state === 'STUNNED',
      stunned: this.throwables.isStunned('DEEPSEEK') || this.sprint.state === 'STUNNED',
      eating: riceState === 'PREPARING' || riceState === 'EATING',
      startled: this.match.captureProgressMs > 0 || this.captureNet.rootMs > 0,
      curiosityPeek: deepseekAiEnabled && this.deepseekAI.state === 'CURIOUS_OBSERVE' &&
        this.deepseekAI.curiosityObserveRemainingMs > C.deepseekAI.curiosityObserveMs / 2,
      curiosityLook: deepseekAiEnabled && this.deepseekAI.state === 'CURIOUS_OBSERVE' &&
        this.deepseekAI.curiosityObserveRemainingMs <= C.deepseekAI.curiosityObserveMs / 2,
      interacting: this.control.isControlling('DEEPSEEK') &&
        (this.input.isHeld('KeyQ') || this.input.isHeld('KeyE')) &&
        !!this.nearestInteractableDoor(this.player.position),
    }), deltaMs, {
      concealed: this.hide.isConcealed('DEEPSEEK'),
      eating: riceState === 'EATING',
    }, this.throwableView.heading('DEEPSEEK') ?? this.aiThrowers.DEEPSEEK.heading);
    this.humanAction.update(resolveCharacterAction({
      falling: throwHits.includes('HUMAN'),
      stunned: this.throwables.isStunned('HUMAN'),
      moving: humanMoved,
      running: humanMoved && aiEnabled && this.humanAI.state === 'CHASE',
      capturing: this.captureZoneActive,
      // S7C-2 修复轮 五：正式搜查停留期间让 Human 走既有的 INTERACT 动作，
      // 配合橙色扇形与家具轮廓，玩家能辨认「它正在检查这件家具」。纯表现，
      // 不参与命中判定，也不触发玩家 Q 的冷却。
      interacting: this.captureNet.placing || (aiEnabled && (this.humanAI.unlockProgressMs > 0 ||
        this.humanDoorSkill.aiForceBreakProgressMs > 0)) ||
        (aiEnabled && this.humanAI.checkHidePhase === 'DWELL') ||
        this.pulseLock.isOpen || (this.control.isControlling('HUMAN') &&
        this.input.isHeld('KeyE') && !!this.nearestInteractableDoor(this.human.position)),
    }), deltaMs, undefined, this.throwableView.heading('HUMAN') ?? this.aiThrowers.HUMAN.heading);
  }

  private handleDoorInteractions(): {
    doorOwnsInteraction: boolean;
    hideOwnsInteraction: boolean;
    humanMovementLocked: boolean;
  } {
    const faction = this.control.controlledFaction;
    const actor = this.control.controlled(this.player, this.human);
    if (!faction || !actor || this.throwables.isStunned(faction) ||
        (faction === 'DEEPSEEK' && this.captureNet.rootMs > 0)) {
      this.input.consumePress('KeyE');
      this.input.consumePress('KeyQ');
      this.input.consumePress('KeyV');
      return { doorOwnsInteraction: false, hideOwnsInteraction: false,
        humanMovementLocked: false };
    }
    if (this.pulseLock.isOpen) {
      if (this.input.consumePress('KeyE')) this.pressPulseLock();
      this.input.consumePress('KeyQ');
      this.input.consumePress('KeyV');
      return { doorOwnsInteraction: true, hideOwnsInteraction: false,
        humanMovementLocked: this.pulseLock.movementLocked };
    }
    const nearby = this.nearestInteractableDoor(actor.position);
    const rice = faction === 'DEEPSEEK' ? this.nearestRice() : null;
    if (this.input.consumePress('KeyQ')) {
      if (faction === 'DEEPSEEK') this.useSkillQ(faction, actor, nearby);
      else { this.throwableView.cancel(); this.captureNetView.begin(); }
    }
    if (faction === 'HUMAN' && this.captureNet.mode !== 'NONE') {
      this.input.consumePress('KeyE');
      this.input.consumePress('KeyV');
      return { doorOwnsInteraction: false, hideOwnsInteraction: false,
        humanMovementLocked: this.captureNet.placing };
    }
    const concealed = this.hide.isConcealed(faction);
    const hideCandidate = faction === 'DEEPSEEK' && !concealed && this.match.phase === 'PLAYING'
      ? this.nearestHideCandidate(actor.position) : null;
    // E 只在这里仲裁一次：整局只会执行下面其中一个分支，不存在一次按键触发多种行为。
    const intent = resolveInteractionIntent({
      pulseLockOpen: false,
      concealed,
      door: nearby ? { distance: nearby.distance } : null,
      rice: rice ? { distance: rice.range } : null,
      hide: hideCandidate ? { spotId: hideCandidate.spotId } : null,
    });
    const coreOwnsInteraction = !concealed && faction === 'HUMAN' &&
      nearby?.door.state === 'LOCKED' && nearby.door.lockCoreState === 'ACTIVE';
    const doorOwnsInteraction = intent === 'DOOR' || coreOwnsInteraction;
    const hideOwnsInteraction = intent === 'HIDE_ENTER' || intent === 'HIDE_EXIT';
    const interactPressed = this.input.consumePress('KeyE');
    if (interactPressed) {
      if (coreOwnsInteraction && nearby) {
        if (this.pulseLock.open(nearby.door.id, faction, this.match.phase)) {
          this.doorStatusMessage = 'PulseLock 破解中：Human 暴露';
          this.renderPulseLock();
        }
      } else if (intent === 'DOOR' && nearby) {
        const canClose = nearby.door.state !== 'OPEN' || this.canCloseDoor(nearby.definition.id);
        const result = this.doorSystem.toggle(nearby.door.id, faction, canClose);
        this.applyDoorResult(nearby.door.id, result);
      } else if (intent === 'HIDE_ENTER') {
        this.enterHide(actor.position, hideCandidate);
      } else if (intent === 'HIDE_EXIT') {
        this.exitHide();
      } else if (faction === 'HUMAN') {
        this.useSkillQ(faction, actor, nearby, 'FURNITURE');
      }
    }
    const searchPressed = this.input.consumePress('KeyV');
    if (searchPressed && faction === 'HUMAN' && !this.pulseLock.isOpen) {
      this.useSkillQ(faction, actor, nearby);
    }
    return { doorOwnsInteraction, hideOwnsInteraction,
      humanMovementLocked: this.pulseLock.movementLocked };
  }

  // Existing skill executor; legacy name retained for diagnostic/test compatibility.
  // DP Q locks; Human E searches furniture, V captures in the forward fan.
  private useSkillQ(faction: Faction, actor: THREE.Mesh, nearby: NearbyDoor | null,
    humanAction: 'FAN' | 'FURNITURE' = 'FAN'): void {
    const skill = resolveQSkill(faction);
    if (skill === 'LOCK_DOOR') {
      const gate = deepseekLockGate({
        concealed: this.hide.isConcealed('DEEPSEEK'),
        ready: this.deepseekLockCooldown.ready,
        remainingSeconds: this.deepseekLockCooldown.remainingSeconds,
      });
      if (!gate.ok) {
        this.audio.play('skillUnavailable', 'ui', .7);
        this.feedback.show('技能不可用', 'bad');
        this.setHideNotice(gate.message ?? '锁门被拒绝');
        return;
      }
      const result = nearby ? this.doorSystem.lock(nearby.door.id, faction) : 'NOT_FOUND';
      if (result === 'LOCKED') this.playWorld('skill', actor.position, faction);
      this.applyDoorResult(nearby?.door.id ?? null, result);
      if (lockArmsPlayerCooldown(result)) this.deepseekLockCooldown.arm();
      return;
    }
    if (skill !== 'FAN_SEARCH') return;
    // E and V select disjoint targets. Reuse the original plan/cooldown authority,
    // but never fall back from missing/invalid furniture to a fan sweep.
    const pressResolution = humanAction === 'FURNITURE'
      ? this.playerQTargetResolution(actor.position) : null;
    if (humanAction === 'FURNITURE' && !pressResolution?.pointedLegalTarget) return;
    const exposed = this.probeExposedTarget();
    const plan = resolvePlayerQPlan({
      cooldownReady: this.humanSearchCooldown.ready,
      remainingSeconds: this.humanSearchCooldown.remainingSeconds,
      exposedTargetAvailable: humanAction === 'FAN' && exposed.available,
      furnitureTarget: pressResolution?.pointedLegalTarget ?? null,
    });
    this.lastPlayerQPlanReason = plan.reason;
    if (plan.kind === 'REJECT_COOLDOWN') {
      this.audio.play('skillUnavailable', 'ui', .7);
      this.feedback.show('技能冷却中', 'bad');
      this.setHideNotice(plan.message ?? '搜查被拒绝');
      return;
    }
    if (plan.kind === 'FURNITURE') {
      if (pressResolution?.pointedLegalTarget &&
          this.performFurnitureSearch(actor.position, pressResolution.pointedLegalTarget)) {
        this.humanSearchCooldown.arm();
        this.playWorld('skill', actor.position, faction);
      }
      return;
    }
    // V's hit and whiff both use the same original cooldown; no furniture read.
    if (plan.armsCooldown) this.humanSearchCooldown.arm();
    if (plan.armsCooldown) this.playWorld('skill', actor.position, faction);
    this.performHumanSearch(actor, plan.reason, exposed);
  }

  /**
   * Human E 的家具交互搜查（与 V 扇形完全分开）。
   *
   * 与 Human AI 共用「指定家具权威占用」这一个小接口，但上游几何是另一套：
   * 玩家只要站在合法交互区域内、并且朝向大致对着这件家具（指向条件选完家具之后
   * 就不再参与判定）即可，家具不必落在 120° 扇形里，也不做 1.5 u 距离判定。
   *
   * 判定顺序（用户本轮批准）：按键当帧解析出的唯一「合法 + 被指向」家具 → ① 该藏身点
   * 与家具仍属于当前已应用地图 → ② 玩家确实位于合法交互区域 → ③ 与家具之间没有墙或
   * 非 OPEN 门叶 → ④ 才读一次权威占用。返回 true 表示家具搜中或合法搜空；
   * false 表示没有可执行的家具目标，调用方不消耗冷却，也绝不回退到扇形。
   */
  private performFurnitureSearch(position: THREE.Vector3,
    target: HideTargetCandidate): boolean {
    const resolution = resolveHumanFurnitureSearch({
      spotId: target.spotId,
      playerPosition: { x: position.x, z: position.z },
      furniture: this.mapFurniture,
      hideSpots: this.hideSpots,
      // 按键当帧**重新解析**出来的公开合法性（不是上一帧的高亮状态）。
      legal: target.legal,
      legalCode: target.code,
      // 正式遮挡规则与视觉同源：墙体与非 OPEN 的门叶都会挡住这次搜查。
      lineBlocked: (a, b) => this.perceptionGeometry
        .inspectVision(a, b, Number.POSITIVE_INFINITY).status !== 'VISIBLE',
      // 惰性权威读取：公开检查全部通过后才会被调用一次。高亮、候选选择与提示阶段
      // 都走另一条路径，永远不碰这个回调。
      readOccupancy: () => ({ concealedSpotId: this.hide.isConcealed('DEEPSEEK')
        ? this.hide.spotId : null }),
    });
    const label = this.hideSpots.find(spot => spot.id === target.spotId)?.label ?? target.spotId;
    this.furnitureSearchCount++;
    this.furnitureSearchCode = resolution.code;
    this.furnitureSearchDetail = `${HUMAN_FURNITURE_SEARCH_CODE_TEXT[resolution.code]}｜` +
      `家具 ${resolution.furnitureId ?? '无'}｜瞄点 ${pointText(resolution.aimPoint)}｜` +
      `权威占用读取：${resolution.readAuthoritativeSpot ? '是' : '否'}`;
    // DEV 面板「Human Q 搜查：冷却 / 最近判定」也跟上这次家具搜查，避免显示上一次扇形结果。
    this.lastSearchCode = resolution.code;
    this.lastSearchDetail = this.furnitureSearchDetail;
    this.aiLogCollector?.recordPlayerSearchEvent({
      type: resolution.code === 'HIT_CONCEALED' ? 'PLAYER_Q_FURNITURE_HIT'
        : resolution.code === 'MISS_EMPTY' ? 'PLAYER_Q_FURNITURE_MISS'
          : 'PLAYER_Q_FURNITURE_REJECTED',
      reason: this.furnitureSearchDetail,
      spotId: target.spotId,
      data: {
        targetKind: 'FURNITURE',
        reason: 'FURNITURE',
        furnitureId: resolution.furnitureId,
        legal: target.legal,
        legalCode: target.code,
        legalText: HIDE_TARGET_CODE_TEXT[target.code] ?? target.code,
        pointed: target.pointed,
        pointingDeltaDeg: target.pointingDeltaDeg,
        candidatesInRegion: this.hideTargetCandidates,
        cooldownReady: this.humanSearchCooldown.ready,
        cooldownRemainingMs: this.humanSearchCooldown.remainingMs,
        playerPosition: { x: position.x, z: position.z },
        aimPoint: resolution.aimPoint,
        blocked: resolution.blocked,
        hit: resolution.hit,
        authoritativeRead: resolution.readAuthoritativeSpot,
        executed: resolution.executable,
      },
    });
    if (resolution.code === 'HIT_CONCEALED') {
      this.playWorld('capture', position, 'HUMAN');
      this.feedback.show('抓到了！', 'good', position);
      this.humanSearchTargetKind = 'FURNITURE';
      this.furnitureSearchHitCount++;
      this.showSearchFurnitureFeedback(target.spotId);
      this.releaseHide('SEARCHED');
      this.setHideNotice(`家具搜查命中：已从「${label}」搜出藏身目标并立即抓捕`);
      // 复用 S7C-1B 的同一套正式结算，不新开胜负系统。
      this.aiLogCollector?.recordForcedCapture('FURNITURE_CHECK');
      this.match.forceCapture();
      return true;
    }
    if (resolution.code === 'MISS_EMPTY') {
      this.playWorld('search', position, 'HUMAN');
      this.humanSearchTargetKind = 'FURNITURE';
      this.setHideNotice(`家具搜查完成：「${label}」没有人，` +
        `E 家具搜查 / V 扇形抓捕共用 ${(C.humanSearch.cooldownMs / 1000).toFixed(0)} 秒冷却`);
      return true;
    }
    // NOT_LEGAL / PLAN_STALE / NO_TARGET: no cooldown, no fan fallback.
    this.setHideNotice(`家具搜查未执行：${HUMAN_FURNITURE_SEARCH_CODE_TEXT[resolution.code]}`);
    return false;
  }

  // 释放瞬间只做一次命中判定；扇形表现与真实判定共用同一个朝向快照，之后的淡入
  // 淡出不会产生第二次命中。
  //
    // Player V uses the original fan geometry but only exposed characters;
    // concealed furniture is exclusively searched by E. AI search is separate.
  private performHumanSearch(actor: THREE.Mesh, reason: PlayerQPlanReason,
    probe: ExposedFanProbe): void {
    const origin = { x: actor.position.x, z: actor.position.z };
    const headingRad = this.humanSearchHeadingRad();
    this.hideSearchView.show(origin, headingRad);
    this.humanSearchCount++;
    this.humanSearchTargetKind = 'FAN';
    const result = evaluateHumanSearch({
      origin,
      headingRad,
      target: this.hide.isConcealed('DEEPSEEK') ? null : this.humanSearchTarget(),
      // 正式遮挡规则与视觉同源：墙体与非 OPEN 的门叶都会挡住扇形。
      lineBlocked: (a, b) => this.perceptionGeometry
        .inspectVision(a, b, Number.POSITIVE_INFINITY).status !== 'VISIBLE',
    });
    this.lastSearchCode = result.code;
    this.lastSearchSpotId = result.spotId;
    this.lastSearchDetail = HUMAN_SEARCH_CODE_TEXT[result.code] +
      `｜瞄点 ${pointText(result.aimPoint)}｜距离 ` +
      `${Number.isFinite(result.distance) ? result.distance.toFixed(2) : '—'}` +
      `｜偏差 ${Number.isNaN(result.angleDeltaDeg) ? '—' :
        `${result.angleDeltaDeg.toFixed(1)}°`}`;
    // 玩家 Q 时间线：记下这次是「暴露目标优先」还是「没有目标可搜」的空挥，
    // 以及预检测与最终判定是否一致（两者同源，不一致即为缺陷信号）。
    this.aiLogCollector?.recordPlayerSearchEvent({
      type: result.outcome === 'MISS' ? 'PLAYER_Q_FAN_MISS' : 'PLAYER_Q_FAN_HIT',
      reason: this.lastSearchDetail,
      spotId: result.spotId,
      data: {
        targetKind: 'FAN',
        reason,
        furnitureId: this.hideTargetFurnitureId,
        exposedTargetAvailable: probe.available,
        exposedCode: probe.code,
        exposedDistance: probe.distance,
        exposedAngleDeltaDeg: probe.angleDeltaDeg,
        exposedBlocked: probe.blocked,
        cooldownReady: this.humanSearchCooldown.ready,
        cooldownRemainingMs: this.humanSearchCooldown.remainingMs,
        playerPosition: origin,
        aimPoint: result.aimPoint,
        blocked: result.blocked,
        hit: result.outcome !== 'MISS',
        // 普通扇形不读任何家具占用：这两项必须恒为 false。
        authoritativeRead: false,
        executed: true,
      },
    });
    if (result.outcome === 'MISS') {
      this.playWorld('search', actor.position, 'HUMAN');
      this.setHideNotice(`扇形抓捕未命中：${HUMAN_SEARCH_CODE_TEXT[result.code]}`);
      return;
    }
    this.humanSearchHitCount++;
    this.playWorld('capture', actor.position, 'HUMAN');
    this.feedback.show('抓到了！', 'good', actor.position);
    this.setHideNotice('扇形抓捕命中：抓到未藏身的 DeepSeek 娘');
    // 立即抓捕成功走正式结算路径（同一 GameStateSystem，不新开胜负系统）。
    this.aiLogCollector?.recordForcedCapture('Q_FAN');
    this.match.forceCapture();
  }

  private showSearchFurnitureFeedback(spotId: string | null): void {
    const spot = spotId ? this.hideSpots.find(item => item.id === spotId) ?? null : null;
    const furniture = spot
      ? this.mapFurniture.find(rect => rect.id === spot.furnitureId) ?? null : null;
    if (!furniture) return;
    this.hideSearchView.showHitFeedback({ x: furniture.x, z: furniture.z },
      { width: furniture.width, depth: furniture.depth, height: furniture.height },
      furniture.rotation ?? 0);
  }

  private humanSearchTarget(): HumanSearchTarget {
    const concealed = this.hide.isConcealed('DEEPSEEK');
    const spotId = concealed ? this.hide.spotId : null;
    const spot = spotId ? this.hideSpots.find(item => item.id === spotId) ?? null : null;
    const furniture = spot
      ? this.mapFurniture.find(rect => rect.id === spot.furnitureId) ?? null : null;
    return {
      concealed,
      // 只有未藏身时这个坐标才参与判定；藏身时瞄的是家具可接近表面。
      position: { x: this.player.position.x, z: this.player.position.z },
      spotId,
      furniture,
    };
  }

  private humanSearchHeadingRad(): number {
    const facing = this.lastHumanFacing;
    if (facing.x !== 0 || facing.y !== 0) return directionToHeadingRad(facing);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) return 0;
    forward.normalize();
    return Math.atan2(forward.z, forward.x);
  }

  /**
   * S7C-2 修复轮 三：Human 玩家 Q 的**无副作用**「合法暴露目标」预检测。
   *
   * 按键当帧与每帧高亮各调用一次，只回答一个问题：**现在按 Q，普通扇形会不会真的
   * 抓到一个未藏身的对手**。它复用正式的 `evaluateHumanSearch()`（同源几何），
   * 不显示特效、不消耗冷却、不写日志、不释放藏身、不产生抓捕事件——所有副作用都
   * 留在真正执行分支的 `performHumanSearch()` / `performFurnitureSearch()` 里。
   */
  private probeExposedTarget(): ExposedFanProbe {
    if (this.match.phase !== 'PLAYING' || this.match.result) {
      return { available: false, code: 'NO_TARGET',
        distance: Number.POSITIVE_INFINITY, angleDeltaDeg: Number.NaN, blocked: false };
    }
    return probeExposedFanTarget({
      origin: { x: this.human.position.x, z: this.human.position.z },
      headingRad: this.humanSearchHeadingRad(),
      target: this.humanSearchTarget(),
      lineBlocked: (a, b) => this.perceptionGeometry
        .inspectVision(a, b, Number.POSITIVE_INFINITY).status !== 'VISIBLE',
    });
  }

  /**
   * S7C-2 修复轮 五：把 Human AI 的正式搜查状态同步到**纯表现层**。
   *
   * 玩家以前只能看到 AI 停住并转向，分不清「在附近调查」与「真的在检查某件家具」。
   * 这里在 AI 处于 CHECK_HIDE.DWELL 时点亮它自己的站位扇形与被检查家具的轮廓，
   * 离开 DWELL（搜空 / 被抢占 / 取消）时给一次中性收尾脉冲。
   *
   * 三条约束：不参与判定；不碰 Human 玩家 Q 的 12 秒冷却；只画 AI 自己公开的
   * 目标家具，因此不会泄露远处隐藏者的真实位置或占用状态。
   */
  private syncHumanAiSearchFeedback(active: boolean): void {
    if (!active) {
      this.hideSearchView.hideAiInspection();
      this.humanAiSearchFeedbackPhase = 'NONE';
      this.humanAiSearchFeedbackSpotId = null;
      return;
    }
    const phase = this.humanAI.checkHidePhase;
    const spotId = this.humanAI.checkHideSpotId;
    const stance = this.humanAI.checkHideStance;
    const furnitureFor = (id: string | null) => {
      const spot = id ? this.hideSpots.find(item => item.id === id) ?? null : null;
      return spot
        ? this.mapFurniture.find(rect => rect.id === spot.furnitureId) ?? null : null;
    };
    if (phase === 'DWELL' && spotId && stance) {
      if (this.humanAiSearchFeedbackPhase !== 'DWELL')
        this.playWorld('search', this.human.position, 'HUMAN');
      const furniture = furnitureFor(spotId);
      if (furniture) {
        this.hideSearchView.showAiInspection(
          { x: this.human.position.x, z: this.human.position.z }, stance.headingRad,
          { x: furniture.x, z: furniture.z },
          { width: furniture.width, depth: furniture.depth, height: furniture.height },
          furniture.rotation ?? 0);
      }
    } else {
      this.hideSearchView.hideAiInspection();
    }
    // 离开 DWELL 的那一帧：搜空或被取消时给一次中性收尾反馈。
    // 搜中不做这里的效果——命中已经有 S7C-1B 的家具高亮，且对局随即结束。
    if (this.humanAiSearchFeedbackPhase === 'DWELL' && phase !== 'DWELL' &&
        this.humanAI.checkHideLastResult !== 'HIT') {
      const furniture = furnitureFor(this.humanAiSearchFeedbackSpotId);
      if (furniture) {
        this.hideSearchView.showAiInspectionDone(
          { x: furniture.x, z: furniture.z },
          { width: furniture.width, depth: furniture.depth, height: furniture.height },
          furniture.rotation ?? 0);
      }
    }
    this.humanAiSearchFeedbackPhase = phase;
    this.humanAiSearchFeedbackSpotId = spotId;
  }

  // 复用既有几何/碰撞/导航接口：区域内 + 可站立 + 家具表面无遮挡 + 落在导航格上。
  // 具体判定已抽到 `resolveHideInteractionTarget()`，DeepSeek 玩家 E 与 Human 玩家 Q
  // 共用**同一套**公开目标解析，因此目标选择顺序完全一致。
  // `pointing` 只在 Human 玩家 Q 一侧传入：DeepSeek 的 E 藏身不需要面向家具，
  // 行为与 S7C-1B 逐字相同（见 `resolvePlayerQPlan()` 与 `pointsAtFurniture()`）。
  private hideTargetResolution(position: THREE.Vector3,
    pointing?: HideTargetPointing): HideTargetResolution {
    return resolveHideInteractionTarget({
      position: { x: position.x, z: position.z },
      spots: this.hideSpots,
      furniture: this.mapFurniture,
      world: this.hideWorld(),
      ...(pointing ? { pointing } : {}),
    });
  }

  /**
   * Human 玩家 Q 的目标解析：把「玩家当前朝向」作为指向条件并入同一条解析流程。
   *
   * 指向容差**直接复用已批准的普通扇形半角**（`halfAngleDeg`，即 120° 张角的一半），
   * 不新增任何数值：玩家已经熟悉「前方 120°」这条直觉，指向选择沿用同一个角度即可。
   * 复用仅限**角度**——这里不做距离判定、不做遮挡判定、不参与命中；家具搜查本身
   * 仍然不做 1.5 u / 120° 几何（见 `resolveHumanFurnitureSearch()`）。
   */
  private playerQTargetResolution(position: THREE.Vector3): HideTargetResolution {
    return this.hideTargetResolution(position, {
      headingRad: this.humanSearchHeadingRad(),
      halfAngleDeg: C.humanSearch.halfAngleDeg,
    });
  }

  private nearestHideCandidate(position: THREE.Vector3): HideTargetCandidate | null {
    const resolution = this.hideTargetResolution(position);
    this.hideCandidateCode = resolution.code;
    this.hideCandidateSpotId = resolution.spotId;
    return resolution.target;
  }

  /**
   * S7C-2 修复轮 二 / 三：Human 玩家的**唯一家具交互高亮**（每帧同步，公开解析）。
   *
   * 与按键判定用的是**同一个** `resolveHideInteractionTarget()`：白色高亮目标 =
   * HUD「Q 搜查」目标 = 实际搜查目标，因此不可能出现「高亮 A 家具、技能层搜 B 家具」。
   *
   * 修复轮 三新增两条语义（用户批准的新优先级）：
   *   - 只有**合法且被指向**的家具才亮（未传朝向过滤的 DeepSeek E 不受影响）；
   *   - 当帧存在**合法暴露目标**时，家具仍然画出来但**变暗且不再呼吸**（不可用），
   *     HUD 也不再提示「可以搜家具」——因为这时按 Q 是抓人，不能给出误导性提示。
   *
   * 三条约束：
   *   - 只用公开几何（区域成员 + 真实碰撞可站立 + 家具表面无墙门遮挡 + 真实导航格）
   *     与玩家自己的朝向，不读、不推断、不暴露任何家具占用；
   *   - 区域成员成立但站位不合法（例如隔着墙）时**不亮**高亮：不能因为用了同一套
   *     公开几何就给玩家一个「可以隔墙搜查」的假提示；
   *   - 非 PLAYING（暂停 / 结算 / 选阵营 / 重开）时立即清除，不残留过期目标。
   */
  private syncPlayerFurnitureTarget(): void {
    const faction = this.control.controlledFaction;
    const playable = this.match.phase === 'PLAYING' && faction === 'HUMAN' &&
      this.match.result === null;
    if (!playable) {
      if (this.hideTargetSpotId !== null) {
        this.hideSearchView.clearPlayerTarget();
        this.hideTargetSpotId = null;
        this.hideTargetFurnitureId = null;
      }
      this.hideTargetLegal = false;
      this.hideTargetPointed = false;
      this.hideTargetPointingDeltaDeg = Number.NaN;
      this.hideTargetExposedPriority = false;
      this.hideTargetCandidates = 0;
      this.hideTargetCode = 'NONE';
      return;
    }
    const resolution = this.playerQTargetResolution(this.human.position);
    const exposed = this.probeExposedTarget();
    this.hideTargetCode = resolution.code;
    this.hideTargetCandidates = resolution.candidatesInRegion;
    this.hideTargetExposedPriority = exposed.available;
    const target = resolution.pointedLegalTarget;
    this.hideTargetLegal = !!target;
    this.hideTargetPointed = target ? target.pointed : false;
    this.hideTargetPointingDeltaDeg = target ? target.pointingDeltaDeg : Number.NaN;
    const furniture = target
      ? this.mapFurniture.find(rect => rect.id === target.furnitureId) ?? null : null;
    if (!target || !furniture) {
      if (this.hideTargetSpotId !== null) {
        this.hideSearchView.clearPlayerTarget();
        this.hideTargetSpotId = null;
        this.hideTargetFurnitureId = null;
      }
      return;
    }
    this.hideTargetSpotId = target.spotId;
    this.hideTargetFurnitureId = target.furnitureId;
    this.hideSearchView.setPlayerTarget(target.spotId, {
      centre: { x: furniture.x, z: furniture.z },
      size: { width: furniture.width, depth: furniture.depth, height: furniture.height },
      rotationRad: furniture.rotation ?? 0,
    }, this.humanSearchCooldown.ready);
  }

  /** 人工 DP 的唯一白色指向目标；E 的正式判定仍走 handleDoorInteractions()。 */
  private syncDeepSeekVisualTarget(): void {
    const playable = this.match.phase === 'PLAYING' && this.match.result === null &&
      this.control.isControlling('DEEPSEEK') && !this.sceneEditor?.isOpen;
    if (!playable) {
      this.deepseekVisualTarget = { kind: 'NONE' };
      if (!this.control.isControlling('HUMAN')) this.hideSearchView.clearPlayerTarget();
      return;
    }
    const rice = this.nearestRice();
    const hide = this.hideTargetResolution(this.player.position).target;
    const door = this.nearestInteractableDoor(this.player.position);
    // 参数与 E 按键当帧的仲裁完全一致；朝向筛选只发生在其后。
    const intent = resolveInteractionIntent({
      pulseLockOpen: this.pulseLock.isOpen,
      concealed: this.hide.isConcealed('DEEPSEEK'),
      door: door ? { distance: door.distance } : null,
      rice: rice ? { distance: rice.range } : null,
      hide: hide ? { spotId: hide.spotId } : null,
    });
    const furniture = hide
      ? this.mapFurniture.find(rect => rect.id === hide.furnitureId) ?? null : null;
    const riceView = rice ? this.riceViews.get(rice.id) ?? null : null;
    const target = resolveDeepSeekVisualTarget({
      playable: true,
      position: { x: this.player.position.x, z: this.player.position.z },
      headingRad: this.lastDeepseekVisualHeadingRad,
      intent, hide, furniture,
      rice: rice && riceView ? { id: rice.id,
        position: { x: riceView.position.x, z: riceView.position.z },
        range: rice.range } : null,
      riceInteractionRange: C.rice.interactionRange / U,
      canHide: this.sprint.state === 'NORMAL' && this.match.captureProgressMs === 0,
      canEat: this.sprint.state === 'NORMAL',
      furnitureHalfAngleDeg: C.humanSearch.halfAngleDeg,
    });
    this.deepseekVisualTarget = target;
    if (target.kind === 'FURNITURE' && furniture) {
      this.hideSearchView.setPlayerTarget(target.spotId, {
        centre: { x: furniture.x, z: furniture.z },
        size: { width: furniture.width, depth: furniture.depth, height: furniture.height },
        rotationRad: furniture.rotation ?? 0,
      }, true);
    } else if (target.kind === 'RICE' && riceView) {
      this.hideSearchView.setRiceTarget(target.riceId, {
        centre: { x: riceView.position.x, z: riceView.position.z },
        size: riceView.outlineSize,
        rotationRad: 0,
      });
    } else {
      this.hideSearchView.clearPlayerTarget();
    }
  }

  private hideWorld(): HideRegionWorld {
    return { collision: this.collision, navigation: this.navigation,
      doorStates: this.doorSystem.doors };
  }

  // S7C-2：图层 B —— 当前 Human AI 真正看得见的米痕（距离 + 墙 + 非 OPEN 门叶）。
  // 复用 S7C-2 的适配接口与正式视觉几何，不新建第二套墙门规则。
  private visibleTracesForHumanAi(): ReturnType<typeof selectVisibleTraces> {
    return selectVisibleTraces({
      observer: this.human.position,
      traces: this.traces.traces,
      nowMs: this.traces.nowMs,
      visionRange: this.runtime.visionRange,
      visible: (from, to, maxRange) => this.perceptionGeometry
        .inspectVision(from, to, maxRange).status === 'VISIBLE',
    });
  }

  /**
   * S7C-2：Human AI 的正式搜查结算（分层的关键接缝）。
   *
   * 公开几何、站位与停留全部在 AI 内部完成；只有「到达合法站位 + 朝向正确 +
   * 满足 900 ms 停留」之后，这里才查询权威占用状态，并复用 S7C-1B 的
   * `evaluateHumanSearch()` 的**公共几何核心**、强制退出与
   * `GameStateSystem.forceCapture()`。
   *
   * 修复轮把这段判定抽到 `resolveHumanAiHideCheck()`，并修正两处：
   *   ① 判断用的是**规划时保存的表面点**（`stance.surfacePoint`），不再用
   *      「离当前位置最近的表面点」重算——两者在家具边角 / 旋转家具旁会不一致，
   *      以前会表现为「计划合法但正式判定 MISS」；
   *   ② 正式判定前复核该点仍属于当前已应用地图的目标家具，家具/地图变了就
   *      取消本次搜查（不记搜空、不进 6 秒冷却），而不是拿旧计划硬判一次。
   *
   * 真实藏身点只在「正在被检查的这件家具恰好就是它的藏身家具」时才被读取，因此
   * AI 不可能通过搜查别的家具反推对方位置；回给 AI 的仍然只有 `hit: boolean`，
   * 细粒度的权威原因只进 DEV 字段（`humanAiCheckCode`）。
   */
  private runHumanAiHideCheck(spotId: string): void {
    const stance = this.humanAI.checkHideStance;
    const resolution = resolveHumanAiHideCheck({
      spotId,
      stance: stance ? { stancePoint: stance.stancePoint,
        surfacePoint: stance.surfacePoint, headingRad: stance.headingRad } : null,
      humanPosition: { x: this.human.position.x, z: this.human.position.z },
      humanHeadingRad: this.humanSearchHeadingRad(),
      waypointTolerance: C.humanAI.waypointTolerance,
      contactEpsilon: C.collision.contactEpsilon,
      furniture: this.mapFurniture,
      hideSpots: this.hideSpots,
      // 惰性权威读取：公开几何全部通过后才会被调用一次，因此「公开几何失败时
      // 权威占用查询次数为零」是可断言的事实。
      readOccupancy: () => ({ concealedSpotId: this.hide.isConcealed('DEEPSEEK')
        ? this.hide.spotId : null }),
      lineBlocked: (a, b) => this.perceptionGeometry
        .inspectVision(a, b, Number.POSITIVE_INFINITY).status !== 'VISIBLE',
      range: C.humanSearch.range,
      halfAngleDeg: C.humanSearch.halfAngleDeg,
    });
    this.humanAiCheckCode = resolution.code;
    this.humanAiCheckCountsAsFormal = resolution.countsAsFormalCheck;
    this.humanAiCheckDetail = `${HUMAN_HIDE_CHECK_CODE_TEXT[resolution.code]}｜` +
      `计划瞄点 ${pointText(resolution.plannedSurfacePoint)}｜` +
      `最终判定点 ${pointText(resolution.finalAimPoint)}｜` +
      `距离 ${resolution.distance === null ? '—' : resolution.distance.toFixed(2)}｜` +
      `偏差 ${resolution.angleDeltaDeg === null ? '—'
        : `${resolution.angleDeltaDeg.toFixed(1)}°`}｜` +
      `站位${resolution.stanceHeld ? '成立' : '失效'}` +
      `（偏差 ${resolution.stanceDistance === null ? '—'
        : resolution.stanceDistance.toFixed(3)}）｜` +
      `朝向${resolution.headingHeld ? '成立' : '失效'}｜` +
      `权威层读取真实藏身点：${resolution.readAuthoritativeSpot ? '是' : '否'}｜` +
      `计入正式检查：${resolution.countsAsFormalCheck ? '是' : '否'}`;
    if (!resolution.executable) {
      // 未完成合法检查 / 计划失效：不记搜空、不进 6 秒冷却、不写公开失败记忆。
      // 两条取消路径的配额语义不同：地图变化可以（有界地）退还本轮配额后重规划，
      // 站位或几何不成立则保留「已经尝试过一次」的配额，防止反复取消绕过上限。
      if (resolution.cancelKind === 'PLAN_STALE') {
        this.humanAI.cancelStaleCheckHide(resolution.detail);
      } else {
        this.humanAI.cancelIncompleteCheckHide(resolution.code, resolution.detail);
      }
      return;
    }
    this.playWorld('search', this.human.position, 'HUMAN');
    // AI 侧的登记刻意只含公开安全字段（结果 + 计划瞄点 / 最终判定点）。
    this.humanAI.noteCheckHideResolution({
      spotId, result: resolution.hit ? 'HIT' : 'MISS', detail: resolution.detail,
      plannedSurfacePoint: resolution.plannedSurfacePoint,
      finalAimPoint: resolution.finalAimPoint,
      aimPointDelta: resolution.aimPointDelta,
      distance: resolution.distance, angleDeltaDeg: resolution.angleDeltaDeg,
      blocked: resolution.blocked,
      countsAsFormalCheck: resolution.countsAsFormalCheck,
    });
    if (resolution.hit) {
      this.playWorld('capture', this.human.position, 'HUMAN');
      this.showWorldFeedback('抓到了！', 'good', this.human.position);
      const realSpotId = this.hide.spotId;
      if (realSpotId) this.showSearchFurnitureFeedback(realSpotId);
      this.releaseHide('SEARCHED');
      // 复用 S7C-1B 的正式结算：同一条抓捕路径、同一套胜负与 UI 结果。
      this.aiLogCollector?.recordForcedCapture('FURNITURE_CHECK');
      this.match.forceCapture();
    }
    this.humanAI.onCheckHideResult(spotId, resolution.hit);
  }

  private enterHide(position: THREE.Vector3,
    candidate: { spotId: string; code: string; legal: boolean } | null): void {
    const result = this.hide.enter({
      phase: this.match.phase,
      faction: 'DEEPSEEK',
      playerControlled: this.control.isControlling('DEEPSEEK'),
      position: { x: position.x, z: position.z },
      spotId: candidate?.spotId ?? null,
      spotCode: candidate?.code ?? this.hideCandidateCode,
      spotLegal: candidate?.legal ?? false,
      captureProgressMs: this.match.captureProgressMs,
      sprintState: this.sprint.state,
    });
    if (result.ok) {
      this.playWorld('hideEnter', position, 'DEEPSEEK');
      this.feedback.show('已躲藏', 'soft', position);
      // 中断进食（保留原有进食进度语义），并把既有抓捕进度归零。
      this.rice.interrupt();
      this.match.captureProgressMs = 0;
      this.setHideNotice('已藏身：按 E 退出（藏身中不能移动 / 冲刺 / 进食 / 锁门）');
    } else {
      this.setHideNotice(`无法藏身：${result.message}`);
    }
    this.syncHidePresentation();
  }

  private exitHide(): void {
    const overlap = this.exitBlockedByHuman();
    const result = this.hide.exit('PLAYER_E', { humanOverlap: overlap });
    if (result.ok) {
      this.playWorld('hideExit', this.player.position, 'DEEPSEEK');
      this.feedback.show('离开躲藏', 'soft', this.player.position);
      this.setHideNotice('已退出藏身：普通视觉与抓捕立刻恢复');
    } else {
      this.setHideNotice(result.code === 'HUMAN_BLOCKING'
        ? result.message : `无法退出藏身：${result.message}`);
    }
    this.syncHidePresentation();
  }

  /**
   * 出口是否被 Human 角色圆压住。玩家 E 与 S7C-2b 的 AI 自主退出**共用同一条公式**
   * （`humanBlocksHideExit`），避免两处各写一遍后静默分叉。
   */
  private exitBlockedByHuman(): boolean {
    return humanBlocksHideExit(
      { x: this.player.position.x, z: this.player.position.z },
      { x: this.human.position.x, z: this.human.position.z },
      C.collision.playerRadius);
  }

  /**
   * S7C-2b：AI 自主藏身的**权威进入**。AI 只发了「我想去 spot X + 本帧令牌」，
   * 这里用本帧真实位置复核「是否真的站在该点的合法藏身位置上」，再交给
   * `HideSystem.enterAsAI()` 复核状态机条件与一次性令牌。
   */
  private runDeepSeekAiHideEnter(spotId: string, token: number | null): void {
    const entry = resolveDeepSeekAiHideEntry({
      spotId,
      position: { x: this.player.position.x, z: this.player.position.z },
      plannedStancePoint: this.deepseekAI.hideStancePoint,
      map: this.deepseekHideMap,
      doors: this.doorSystem.doors,
      world: this.deepseekHideWorld(),
      waypointTolerance: C.deepseekAI.waypointTolerance,
      contactEpsilon: C.collision.contactEpsilon,
    });
    this.deepseekHideEntryCode = entry.code;
    this.deepseekHideEntryDetail = `${DEEPSEEK_HIDE_ENTRY_CODE_TEXT[entry.code]}｜${entry.detail}`;
    if (!entry.ok) {
      this.deepseekHideRejectCount++;
      this.setHideNotice(`AI 藏身被拒：${DEEPSEEK_HIDE_ENTRY_CODE_TEXT[entry.code]}`);
      this.deepseekAI.onHideResult(spotId, entry.code);
      return;
    }
    const result = this.hide.enterAsAI({
      phase: this.match.phase,
      position: { x: this.player.position.x, z: this.player.position.z },
      spotId,
      spotCode: entry.positionCode,
      spotLegal: true,
      captureProgressMs: this.match.captureProgressMs,
      sprintState: this.sprint.state,
      requestToken: token ?? Number.NaN,
    });
    if (result.ok) {
      this.playWorld('hideEnter', this.player.position, 'DEEPSEEK');
      // 与玩家 E 完全同一套后果：中断进食（保留进度）并把既有抓捕进度归零。
      this.rice.interrupt();
      this.match.captureProgressMs = 0;
      this.deepseekHideEnterCount++;
      this.setHideNotice(`AI 已自主藏身：${spotId}（Human 搜查仍可把它搜出来）`);
    } else {
      this.deepseekHideRejectCount++;
      this.setHideNotice(`AI 藏身被拒：${result.message}`);
    }
    this.syncHidePresentation();
    this.deepseekAI.onHideResult(spotId, result.ok ? 'ENTERED' : result.code);
  }

  /**
   * S7C-2b：AI 自主退出。出口的物理安全（Human 角色圆是否压住出口）由游戏层裁决，
   * 被挡住时回执 `HUMAN_BLOCKING`，AI 退回藏身等下一次重查——这条判据只是游戏物理
   * 规则，AI 拿到的仍然只有结果码。
   */
  private runDeepSeekAiHideExit(): void {
    const spotId = this.hide.spotId;
    if (!spotId) return;
    const result = this.hide.exit('AI_EXIT', { humanOverlap: this.exitBlockedByHuman() });
    this.deepseekHideLastExitReason = result.ok ? 'AI_EXIT' : result.code;
    if (result.ok) {
      this.playWorld('hideExit', this.player.position, 'DEEPSEEK');
      this.deepseekHideExitCount++;
      this.setHideNotice('AI 已自主退出藏身：继续找米');
    }
    this.syncHidePresentation();
    this.deepseekAI.onHideResult(spotId, result.ok ? 'EXITED' : result.code);
  }

  /** 局终、重开、地图应用等强制清空藏身（不做 Human 重叠检查）。 */
  private releaseHide(reason: HideExitReason): void {
    if (this.hide.forcedExit(reason).ok) {
      this.hideCandidateCode = 'NONE';
      this.hideCandidateSpotId = null;
      // S7C-2b：AI 侧的藏身计划必须同步作废，否则控制器会以为自己还藏着。
      this.deepseekAI.onForcedHideExit(reason);
    }
    this.syncHidePresentation();
  }

  private syncHidePresentation(): void {
    this.player.visible = !this.hide.isConcealed('DEEPSEEK');
  }

  private get nightActive(): boolean {
    return this.difficulty === 'HARD' && this.control.selectedFaction !== null && !this.sceneEditor?.isOpen;
  }

  private get opponentVisible(): boolean {
    const observer = this.control.selectedFaction;
    if (observer === null) return false;
    const opponent = observer === 'HUMAN' ? 'DEEPSEEK' : 'HUMAN';
    if (this.hide.isConcealed(opponent)) return false;
    // Player display range is independent of the AI's limited sight range.
    return this.perceptionGeometry.inspectVision(this.human.position, this.player.position,
      this.roomLights?.rangeFor(observer === 'HUMAN' ? this.player.position : this.human.position,
        C.difficulty.hardNightRenderRange) ?? C.difficulty.hardNightRenderRange).status === 'VISIBLE';
  }

  private get opponentRendered(): boolean {
    return this.hardNightView.opponentVisible &&
      !(this.control.selectedFaction === 'HUMAN' && this.hide.isConcealed('DEEPSEEK'));
  }

  private syncNightPresentation(deltaMs = 0): void {
    const presentationMs = this.match.phase === 'PLAYING' && !this.devFreeze.isFrozen &&
      !this.controlsHelp.visible && !this.sceneEditor?.isOpen ? deltaMs : 0;
    this.hardNightView.sync(this.nightActive, this.control.selectedFaction,
      this.hide.isConcealed('DEEPSEEK'), this.player, this.human, this.opponentVisible, presentationMs);
    this.hideSearchView.setAiPresentationVisible(!this.nightActive || this.control.selectedFaction === 'HUMAN' || this.opponentVisible);
  }

  private setHideNotice(text: string): void {
    this.hideNotice = text;
    this.hideNoticeRemainingMs = HIDE_NOTICE_MS;
  }

  // 普通 HUD：只显示当前控制方自己的状态与冷却，不含对手藏身信息。
  private updateSkillHud(): void {
    const faction = this.control.controlledFaction;
    const phase = this.match.phase;
    if (!faction || (phase !== 'PLAYING' && phase !== 'PAUSED')) {
      this.skillHud.hidden = true;
      return;
    }
    const concealed = this.hide.isConcealed('DEEPSEEK');
    const searchText = this.humanSearchCooldown.ready
      ? '可用' : `冷却中 ${this.humanSearchCooldown.remainingSeconds.toFixed(1)} 秒`;
    const lockText = this.deepseekLockCooldown.ready
      ? '可用' : `冷却中 ${this.deepseekLockCooldown.remainingSeconds.toFixed(1)} 秒`;
    if (faction === 'DEEPSEEK') {
      const target = this.deepseekVisualTarget;
      const targetText = concealed ? '藏身中（按 E 退出）'
        : target.kind === 'FURNITURE'
          ? `面向「${this.hideSpots.find(spot => spot.id === target.spotId)?.label ??
            target.spotId}」 · E 藏身`
          : target.kind === 'RICE'
            ? '停下，按住 E 吃米'
            : '靠近家具按 E 藏身 · 靠近米堆停下按住 E';
      this.skillHudState.textContent = targetText;
      this.skillHudState.title = `E 藏身不要求朝向。Q 锁门：${lockText}`;
    } else {
      const target = this.hideTargetSpotId
        ? this.hideSpots.find(spot => spot.id === this.hideTargetSpotId) ?? null : null;
      // E furniture availability is independent of V's exposed target.
      if (target && this.hideTargetLegal) {
        this.skillHudState.textContent = this.humanSearchCooldown.ready
          ? `E 搜查「${target.label}」`
          : `「${target.label}」可搜查 · 等待共用冷却`;
      } else {
        this.skillHudState.textContent =
          '靠近即可抓捕 · E 搜查家具 · V 前方扇形抓捕';
      }
      this.skillHudState.title = `共用冷却：${searchText}；E 门优先，否则搜查家具；V 前方扇形抓捕`;
    }
    const actor = this.control.controlled(this.player, this.human);
    const door = actor ? this.nearestInteractableDoor(actor.position) : null;
    const rice = faction === 'DEEPSEEK' ? this.nearestRice() : null;
    if ((faction === 'HUMAN' || !concealed) && door && (!rice || door.distance <= rice.range)) {
      const state = door.door.state;
      this.skillHudState.textContent = state === 'OPEN' ? 'E 关门'
        : state === 'LOCKED' ? faction === 'HUMAN' ? 'E 解锁 · Space 强破' : '门已锁定'
          : 'E 开门';
    }
    this.skillHudNotice.textContent = this.hideNotice;
    // Contextual E lives beside the actor; retain Q feedback and rejection notices.
    const showQ = faction === 'HUMAN' && !door && !!this.hideTargetSpotId && this.hideTargetLegal;
    const showBreak = faction === 'HUMAN' && door?.door.state === 'LOCKED';
    if (showQ) this.skillHudState.textContent = this.humanSearchCooldown.ready
      ? 'E 搜查面前的家具' : `E 搜查 / V 抓捕共用冷却 ${Math.ceil(this.humanSearchCooldown.remainingSeconds)} 秒`;
    if (showBreak) this.skillHudState.textContent = 'Space 强破门锁';
    this.skillHudState.hidden = !showQ && !showBreak;
    this.skillHud.hidden = phase !== 'PLAYING' || !!this.sceneEditor?.isOpen ||
      (!showQ && !showBreak && !this.hideNotice);
  }

  private pressPulseLock(): void {
    const doorId = this.pulseLock.openDoorId;
    if (!doorId) return;
    const result = this.pulseLock.press(this.match.phase);
    this.audio.play('pulseInput', 'ui', .55);
    if (result === 'COMPLETE') {
      this.audio.play('pulseSuccess', 'ui');
      this.feedback.show('解锁成功', 'good');
      const doorResult = this.doorSystem.disableLock(doorId, 'HUMAN');
      this.pulseLock.close();
      this.applyDoorResult(doorId, doorResult);
      this.noteHumanPlayerUnlock(doorId, doorResult);
    } else if (result === 'MISS') {
      this.audio.play('pulseWrong', 'ui');
      this.feedback.show('未命中', 'bad');
      this.doorStatusMessage = '脉冲未命中，当前锁芯重试';
    } else if (result === 'CORE_COMPLETE') {
      this.audio.play('pulseCorrect', 'ui');
      this.feedback.show('锁芯完成', 'good');
      this.doorStatusMessage = '锁芯破解成功';
    }
    this.renderPulseLock();
  }

  private closePulseLock(): void {
    this.pulseLock.close();
    this.renderPulseLock();
    if (this.doorStatusMessage === 'PulseLock 破解中：Human 暴露') {
      this.doorStatusMessage = '';
    }
  }

  private renderPulseLock(): void {
    const doorId = this.pulseLock.openDoorId;
    this.pulseLockView.update(doorId ? this.pulseLock.get(doorId) ?? null : null,
      this.pulseLock.coreCount, doorId);
  }

  private nearestInteractableDoor(position: THREE.Vector3): NearbyDoor | null {
    return this.doorSystem.nearest(position.x, position.z, C.door.interactionRange,
      (_door, definition) => canInteractWithDoorXZ(this.collision, position, definition));
  }

  private canCloseDoor(id: string): boolean {
    const definition = this.doorSystem.definition(id);
    if (!definition) return false;
    const radius = C.collision.playerRadius;
    return !doorIntersectsActor(definition, this.player.position.x, this.player.position.z,
      radius, C.door.leafThickness) &&
      !doorIntersectsActor(definition, this.human.position.x, this.human.position.z,
        radius, C.door.leafThickness);
  }

  private applyDoorResult(id: string | null, result: DoorActionResult,
    actorOverride?: Faction): void {
    // S7D：整局摘要只做计数，不复制门状态（门状态唯一来源仍是 DoorSystem）。
    // 本轮新增：同时留一条「门实际被怎么打开」的逐条证据（含锁门到打开的时间差）。
    const doorActor: Faction | null = result === 'LOCKED' ? 'DEEPSEEK'
      : result === 'FORCE_OPENED' || result === 'UNLOCKED' ? 'HUMAN'
        : actorOverride ?? this.control.controlledFaction;
    this.aiLogCollector?.recordDoorResult(result, {
      doorId: id, actor: doorActor });
    if (id && (result === 'OPENED' || result === 'CLOSED' ||
        result === 'LOCKED' || result === 'UNLOCKED' || result === 'FORCE_OPENED')) {
      this.syncDoor(id);
      const soundType: SoundType = result === 'OPENED' ? 'DOOR_OPEN'
        : result === 'CLOSED' ? 'DOOR_CLOSE'
        : result === 'LOCKED' ? 'DOOR_LOCK'
        : result === 'FORCE_OPENED' ? 'FORCE_BREAK' : 'LOCK_BREAK';
      const sourceFaction = doorActor;
      const door = this.doorSystem.definition(id);
      if (door && sourceFaction) {
        this.sound.emit(soundType, door, sourceFaction);
        const cue = result === 'OPENED' ? 'doorOpen' : result === 'CLOSED' ? 'doorClose'
          : result === 'LOCKED' ? 'doorLock' : 'doorUnlock';
        this.playWorld(cue, door, sourceFaction);
        if (actorOverride === undefined && ['LOCKED', 'UNLOCKED', 'FORCE_OPENED'].includes(result))
          this.feedback.show(result === 'LOCKED' ? '已上锁' : result === 'UNLOCKED'
            ? '已解锁' : '强制开门', 'soft');
      }
    }
    if (!['OPENED', 'CLOSED', 'LOCKED', 'UNLOCKED', 'FORCE_OPENED'].includes(result) &&
        actorOverride === undefined) {
      this.audio.play('doorFail', 'ui', .55);
      this.feedback.show('操作失败', 'bad');
    }
    this.doorStatusMessage = result === 'OPENED' ? '门已打开'
      : result === 'CLOSED' ? '门已关闭'
      : result === 'LOCKED' ? '门已上锁'
      : result === 'UNLOCKED' ? '锁芯已失效，门仍为关闭状态'
      : result === 'FORCE_OPENED' ? '强制破锁：门已打开，锁芯失效'
      : result === 'BLOCKED_BY_ACTOR' ? '门口有人，无法关门'
      : result === 'LOCK_LIMIT_REACHED' ? '锁门资源已满'
      : result === 'LOCK_CORE_DISABLED' ? '锁芯已失效，本局不能再次上锁'
      : result === 'NOT_ALLOWED' ? '只有 DeepSeek 娘可以锁门'
      : result === 'OUT_OF_RANGE' ? '门不在交互范围内'
      : result === 'INVALID_STATE' ? '当前门状态不允许该操作'
      : '附近没有可操作的门';
  }

  private noteHumanPlayerUnlock(id: string, result: DoorActionResult): void {
    if (this.deepseekDoorLockPenalty.onHumanPlayerUnlock(id, result)) {
      this.doorStatusMessage = `DeepSeek 娘锁门冷却 +10 秒：剩余 ` +
        `${(this.deepseekDoorLockPenalty.remainingMs / 1000).toFixed(1)} 秒`;
    }
  }

  private syncDoor(id: string): void {
    const state = this.doorSystem.get(id)!;
    const view = this.doorViews.get(id)!;
    view.sync(state);
    this.collision.setDynamicObstacle(id,
      state.state === 'OPEN' ? null : view.closedCollisionBox());
  }

  private syncAllDoors(): void {
    for (const door of this.doorSystem.doors) this.syncDoor(door.id);
  }

  private move(mesh: THREE.Mesh, dx: number, dz: number): void {
    const next = this.collision.move(mesh.position, dx, dz,
      C.collision.playerRadius, C.three.actorHeight);
    if (mesh === this.player) {
      const t = this.captureNet.trigger(mesh.position, next, this.hide.isConcealed('DEEPSEEK'), this.traceThrow);
      if (t !== null) {
        this.moveToNetContact(mesh, next, t);
        this.rice.interrupt();
        this.showWorldFeedback('捕捉网！暂时无法移动', 'bad', mesh.position);
        return;
      }
    }
    mesh.position.copy(next);
  }

  private moveToNetContact(mesh: THREE.Mesh, next: THREE.Vector3, t: number): void {
    mesh.position.copy(this.collision.move(mesh.position,
      (next.x - mesh.position.x) * t, (next.z - mesh.position.z) * t,
      C.collision.playerRadius, C.three.actorHeight));
  }

  private togglePause(): void {
    this.throwableView.cancel();
    this.captureNet.cancel(); this.captureNetView.cancel();
    if (this.match.pause()) {
      this.pauseSettingsOpen = false;
      this.controlsHelp.hide();
      this.rice.interrupt();
      this.closePulseLock();
      // 藏身状态本身在暂停期间保留；只有表现层的扇形特效需要安全清掉。
      this.hideSearchView.reset();
      this.input.clear();
      this.updateHud(this.nearestRice());
      // 打开暂停时聚焦对话框；Tab后才在具体控件上显示键盘焦点。
      this.overlay.tabIndex = -1;
      this.overlay.focus({ preventScroll: true });
      return;
    }
    this.resumeFromPause();
  }

  private resumeFromPause(): void {
    if (!this.match.resume()) return;
    this.pauseSettingsOpen = false;
    this.controlsHelp.hide();
    this.input.clear();
    this.updateHud(this.nearestRice());
  }

  private closePauseSettings(): void {
    this.pauseSettingsOpen = false;
    this.input.clear();
    this.updateHud(this.nearestRice());
    this.pauseSettingsButton.focus();
  }

  // 暂停菜单重看说明不恢复游戏；首次说明由帧循环阻止 READY 推进。
  private openControlsHelp(): void {
    if (this.pauseSettingsOpen) this.closePauseSettings();
    this.controlsHelp.show(this.control.selectedFaction);
  }

  private closeControlsHelp(): void {
    if (!this.controlsHelp.visible) return;
    this.controlsHelp.hide();
    this.input.clear();
    if (this.match.phase === 'PAUSED') this.overlay.focus({ preventScroll: true });
  }

  /** 每个浏览器只自动打开一次；localStorage 不可用时静默跳过，绝不阻断开局。 */
  private maybeOpenControlsHelp(faction: Faction): void {
    if (!CONTROLS_HELP_AUTO_OPEN) return;
    try {
      if (globalThis.localStorage?.getItem(CONTROLS_HELP_SEEN_KEY)) return;
      globalThis.localStorage?.setItem(CONTROLS_HELP_SEEN_KEY, '1');
    } catch { return; }
    this.controlsHelp.show(faction);
  }

  private applyDifficulty(): void {
    const ai = resolveAiDifficulty(this.difficulty, this.control.selectedFaction ?? 'DEEPSEEK');
    this.humanAI.setDifficultyConfig(ai.humanAI);
    this.deepseekAI.setDifficultyConfig(ai.deepseekAI);
    this.runtime.setBaseValue('movement.humanAiMultiplier', ai.humanAI.movementSpeedMultiplier);
  }

  private switchPrimaryFactionFromPause(): void {
    if (this.match.phase !== 'PAUSED' || this.pulseLock.isOpen ||
        !this.debugPossessionEnabled || !this.control.switchPrimaryFaction()) return;
    this.applyDifficulty();
    this.aiThrowers.DEEPSEEK.cancel(); this.aiThrowers.HUMAN.cancel();
    this.input.clear();
    this.lastDeepseekVisualHeadingRad = null;
    this.deepseekVisualTarget = { kind: 'NONE' };
    this.followCamera();
    this.syncTraceViews();
    // 切换阵营时表现层的扇形特效安全清理；藏身状态本身由 HideSystem 持有。
    this.hideSearchView.reset();
    this.updateHud(this.nearestRice());
    this.updatePerceptionHud();
  }

  private exportAILog(): void {
    if (!import.meta.env.DEV || !this.aiLogCollector) return;
    this.aiLogCollector.notePhase(this.match.phase);
    const data = this.aiLogCollector.export(this.matchSetup ? {
      matchSeed: this.matchSetup.seed,
      matchSetup: {
        deepseek: this.matchSetup.deepseek, human: this.matchSetup.human,
        riceIds: this.matchSetup.rice.map(rice => rice.id),
        doorStates: this.matchSetup.doorStates,
        attempts: this.matchSetup.attempts,
        fallback: this.matchSetup.fallback,
        validation: this.matchSetup.validation,
      },
    } : undefined);
    data.config = { deepseekAI: this.deepseekAI.difficultyConfig,
      humanAI: this.humanAI.difficultyConfig, difficulty: this.difficulty,
      humanAIMovementMultiplier: this.runtime.humanAIMovementMultiplier };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `who-ate-my-rice-ai-log-${stamp}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private setDevMatchSeed(value: string): string {
    if (!this.debugPossessionEnabled) return '仅开发模式可设置种子';
    if (!value.trim()) {
      this.fixedMatchSeed = null;
      return '下一局恢复随机种子';
    }
    const seed = parseMatchSeed(value.trim());
    if (seed === null) return '请输入 0～4294967295 的整数';
    this.fixedMatchSeed = seed;
    return `下一局固定种子 ${seed}；重开可复现`;
  }

  private restart(): void {
    if (this.match.phase === 'FACTION_SELECT' || this.control.selectedFaction === null) return;
    this.match.reset();
    this.pauseSettingsOpen = false;
    this.controlsHelp.hide();
    this.resetRound();
    this.followCamera();
    this.updateHud(this.nearestRice());
  }

  private returnToFactionSelect(): void {
    if (!this.match.returnToFactionSelect()) return;
    this.pauseSettingsOpen = false;
    this.controlsHelp.hide();
    this.resetRound();
    this.control.clear();
    this.cameraOrbit.snapDefault();
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);
    this.resize();
    this.menu.hidden = false;
    this.updateHud(this.nearestRice());
  }

  private resetRound(): void {
    this.roomLights.reset(); this.lightOwnsL = false;
    this.hardNightView.resetVisibility();
    this.aiThrowers.DEEPSEEK.reset(); this.aiThrowers.HUMAN.reset();
    this.captureNet.reset(); this.captureNetView.cancel();
    this.netAiNextAttemptAt = this.netAiApproachAt = 0; this.netAiSawRooted = false;
    this.throwables.reset();
    this.throwableView.cancel();
    this.audio.reset();
    this.audio.setMusic('menu');
    this.feedback.clear();
    this.lastAudioPhase = 'FACTION_SELECT';
    this.lastReadySeconds = Math.ceil(this.match.readyRemainingMs / 1000);
    this.lastRiceActive = null;
    this.lastRiceCompleted = 0;
    this.lastSprintReadiness = 'READY';
    this.lastQReady = true;
    if (this.sceneEditor?.isOpen) this.sceneEditor.close();
    this.devFreeze.reset();
    // New matches use the selected difficulty. Saved DEV presets stay untouched;
    // loading/editing a preset is an explicit debugging action for this round.
    this.devBBinding?.resetForNewRound();
    this.applyDifficulty();
    this.editorOpenLast = false;
    this.devZoom = 1;
    this.sprint.reset();
    this.control.resetControlled();
    this.matchSetup = createMatchSetup(this.fixedMatchSeed ?? freshMatchSeed(),
      this.collision, this.navigation, C.matchRandom.maxAttempts, this.hideSpots);
    this.resetRice(this.matchSetup.rice);
    this.doorSystem.applyInitialStates(this.matchSetup.doorStates);
    this.humanDoorSkill.reset();
    this.pulseLock.reset();
    this.deepseekDoorLockPenalty.reset();
    this.renderPulseLock();
    this.syncAllDoors();
    this.doorStatusMessage = '';
    this.player.position.set(this.matchSetup.deepseek.x, C.three.actorHeight / 2,
      this.matchSetup.deepseek.z);
    this.human.position.set(this.matchSetup.human.x, C.three.actorHeight / 2,
      this.matchSetup.human.z);
    this.humanStillness.reset(this.human.position);
    this.playerAction.reset();
    this.humanAction.reset();
    this.captureZoneActive = false;
    this.captureZoneBlocked = false;
    this.captureZone.reset();
    this.sound.reset();
    this.traces.reset();
    this.vision.reset();
    this.humanAI.reset();
    this.humanAiWasActive = false;
    this.deepseekAI.reset();
    this.deepseekAiWasActive = false;
    this.aiLogCollector?.startMatch();
    // S7D：把本局的复现字段交给整局摘要（随机种子 / 玩家阵营 / 大米总数）。
    this.aiLogCollector?.noteMatchContext({
      seed: this.matchSetup.seed,
      playerFaction: this.control.selectedFaction,
      riceTotal: this.rice.portions.length,
    });
    this.aiLogCollector?.notePhase(this.match.phase);
    // S7C-1B：藏身状态、两个 Q 冷却与扇形特效都属于本局状态，重开/返回阵营页
    // 必须全部清空，不留下异常抓捕免疫或输入锁定。
    this.hide.reset();
    // S7C-2b：AI 自主藏身的局内计数与最近结果也属于本局状态，一并清空。
    this.deepseekHideEntryCode = 'NONE';
    this.deepseekHideEntryDetail = '无';
    this.deepseekHideEnterCount = 0;
    this.deepseekHideRejectCount = 0;
    this.deepseekHideExitCount = 0;
    this.deepseekHideLastExitReason = 'NONE';
    this.deepseekHideTokenCounter = 0;
    this.humanSearchCooldown.reset();
    this.deepseekLockCooldown.reset();
    this.hideSearchView.reset();
    this.lastDeepseekVisualHeadingRad = null;
    this.deepseekVisualTarget = { kind: 'NONE' };
    this.hideCandidateCode = 'NONE';
    this.hideCandidateSpotId = null;
    this.hideNotice = '';
    this.hideNoticeRemainingMs = 0;
    this.lastSearchCode = 'NONE';
    this.lastSearchSpotId = null;
    this.lastSearchDetail = '无';
    this.humanSearchCount = 0;
    this.humanSearchHitCount = 0;
    // S7C-2 修复轮 二：玩家 Q 的唯一家具交互目标与家具搜查结果也复位。
    this.humanSearchTargetKind = 'NONE';
    this.hideTargetSpotId = null;
    this.hideTargetFurnitureId = null;
    this.hideTargetCode = 'NONE';
    this.hideTargetLegal = false;
    this.hideTargetPointed = false;
    this.hideTargetPointingDeltaDeg = Number.NaN;
    this.hideTargetExposedPriority = false;
    this.lastPlayerQPlanReason = 'NONE';
    this.hideTargetCandidates = 0;
    this.furnitureSearchCode = 'NONE';
    this.furnitureSearchDetail = '无';
    this.furnitureSearchCount = 0;
    this.furnitureSearchHitCount = 0;
    this.humanAiCheckCode = 'NONE';
    this.humanAiCheckDetail = '无';
    this.humanAiCheckCountsAsFormal = false;
    // S7C-2 修复轮 五：AI 搜查反馈的状态跟随也一起复位，避免重开后残留高亮。
    this.humanAiSearchFeedbackPhase = 'NONE';
    this.humanAiSearchFeedbackSpotId = null;
    this.lastHumanFacing = { x: 0, y: 1 };
    this.player.visible = true;
    this.human.visible = true;
    this.lastStepMs = { HUMAN: -Infinity, DEEPSEEK: -Infinity };
    this.lastRiceSoundMs = -Infinity;
    this.clearTraceViews();
    this.input.clear();
  }

  private updateHud(nearest: ReturnType<ThreeGame['nearestRice']>): void {
    const phase = this.match.phase;
    this.overlay.dataset.difficulty = this.difficulty;
    this.difficultyStatus.hidden = phase !== 'PAUSED';
    this.difficultyStatus.textContent = `当前难度：${DIFFICULTY_COPY[this.difficulty].label}`;
    const time = formatMatchTime(this.match.elapsedMs);
    const hudFaction = this.control.controlledFaction;
    this.alphaHud.update({ phase, faction: hudFaction, time,
      completed: this.rice.completedCount, total: ACTIVE_RICE_COUNT,
      readySeconds: Math.ceil(this.match.readyRemainingMs / 1000),
      qRemainingMs: (hudFaction === 'HUMAN' ? this.humanSearchCooldown : this.deepseekLockCooldown).remainingSeconds * 1000,
      qDurationMs: hudFaction === 'HUMAN' ? C.humanSearch.cooldownMs : C.door.playerLockCooldownMs,
      sprintRemainingMs: this.sprint.cooldownRemainingMs, sprintDurationMs: C.sprint.cooldownMs,
      forceBreakRemainingMs: this.humanDoorSkill.cooldownRemainingMs,
      forceBreakDurationMs: this.humanDoorSkill.cooldownMs,
      netRemainingMs: this.captureNet.cooldownMs, netDurationMs: C.captureNet.cooldownMs,
      netStatus: this.captureNet.placing ? '布置中' : this.captureNet.mode === 'AIMING' ? '选择落点'
        : this.captureNet.remainingSlots === 0 ? '已放满' : null,
      netSlots: this.captureNet.remainingSlots,
      lockSlots: Math.max(0, this.doorSystem.maxActiveLocks - this.doorSystem.activeLockedDoorCount),
      sprintState: this.sprint.state,
      concealed: hudFaction === 'DEEPSEEK' && this.hide.isConcealed('DEEPSEEK'),
      captureRatio: this.match.captureProgressMs / C.match.captureMs,
      riceRatio: hudFaction === 'DEEPSEEK' && this.deepseekVisualTarget.kind === 'RICE' && nearest
        ? nearest.portion.rice.progressMs / nearest.portion.rice.maxProgressMs : null,
      interaction: this.currentInteractionPrompt() });
    this.overlay.dataset.phase = phase;
    this.overlay.dataset.faction = this.control.selectedFaction ?? 'DEEPSEEK';
    if (phase === 'PAUSED') {
      this.overlayHeading.textContent = 'PAUSE';
      this.overlay.dataset.outcome = 'pause';
      this.overlaySummary.textContent = '游戏已暂停。';
      this.overlayStats.textContent = `${time} / 已吃完 ${this.rice.completedCount} 份米`;
    }
    else if (phase === 'FINISHED') {
      const result = this.match.result!;
      updateResultPortrait(this.overlay, result.winner);
      const won = result.winner === this.control.selectedFaction;
      this.overlayHeading.textContent = won ? 'WIN' : 'LOSE';
      this.overlay.dataset.outcome = won ? 'win' : 'lose';
      this.overlaySummary.textContent = `${result.winner === 'DEEPSEEK' ? 'DeepSeek 娘' : '人类'}获胜 · ` +
        (result.reason === 'RICE_COMPLETED' ? '五份米都吃完了。' : '抓捕完成，晚饭保住了。');
      this.overlayStats.textContent = `${hudFaction === 'DEEPSEEK' ? '01 / DeepSeek' : '02 / Human'} · ${time} · 大米 ${this.rice.completedCount} / ${ACTIVE_RICE_COUNT}`;
    }
    const settings = phase === 'PAUSED' && this.pauseSettingsOpen;
    this.overlay.dataset.view = settings ? 'settings' : 'pause';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', phase === 'PAUSED' ? (settings ? '声音设置' : '游戏暂停') : '对局结算');
    this.overlayText.querySelector('.overlay-kicker')!.textContent = phase === 'PAUSED'
      ? 'THE LITTLE RICE CHASE / PAUSE' : 'THE LITTLE RICE CHASE / REPORT';
    if (settings) {
      this.overlayHeading.textContent = '声音设置';
      this.overlaySummary.textContent = '实时调节音量 · 自动保存 · ESC 返回上一级';
    }
    if (phase !== 'FACTION_SELECT') this.menuSettings.close();
    const settingsParent = phase === 'PAUSED' ? this.overlay : this.menu.querySelector('.menu-audio-slot')!;
    if (this.audioSettings.root.parentElement !== settingsParent) {
      settingsParent.append(this.audioSettings.root);
      this.audioSettings.root.open = phase === 'PAUSED';
    }
    this.audioSettings.root.hidden = phase === 'PAUSED' ? !settings : phase !== 'FACTION_SELECT';
    this.pauseActions.hidden = phase !== 'PAUSED' || settings;
    this.resultActions.hidden = phase !== 'FINISHED';
    this.overlay.hidden = phase !== 'PAUSED' && phase !== 'FINISHED';
    const controlledFaction = this.control.controlledFaction;
    this.debugPanel?.setVisible(phase !== 'FACTION_SELECT');
    this.debugPanel?.setControlContext(
      this.debugPossessionEnabled && phase === 'PLAYING', controlledFaction);
    this.updateSkillHud();
  }

  /** Read-only projection of the current E target beside the controlled actor. */
  private currentInteractionPrompt() {
    if ((this.control.controlledFaction === 'HUMAN' && this.captureNet.mode !== 'NONE') ||
        (this.control.controlledFaction === 'DEEPSEEK' && this.captureNet.rootMs > 0)) return null;
    const faction = this.control.controlledFaction;
    const actor = this.control.controlled(this.player, this.human);
    if (!faction || !actor || this.match.phase !== 'PLAYING' || this.pulseLock.isOpen || this.sceneEditor?.isOpen ||
        this.devFreeze.isFrozen) return null;
    const concealed = this.hide.isConcealed(faction);
    const door = this.nearestInteractableDoor(actor.position);
    const rice = faction === 'DEEPSEEK' ? this.nearestRice() : null;
    const hideCandidate = !concealed ? this.hideTargetResolution(actor.position).target : null;
    const hide = faction === 'DEEPSEEK' ? hideCandidate : null;
    const direction = this.input.localDirection();
    const canHide = !!hide?.legal && this.hide.state === 'OUTSIDE' &&
      this.sprint.state === 'NORMAL' && this.match.captureProgressMs === 0;
    const prompt = interactionPrompt({
      playable: true, faction, pulseLockOpen: this.pulseLock.isOpen, concealed,
      door: door ? { distance: door.distance } : null,
      rice: rice ? { distance: rice.range } : null,
      hide: hide ? { spotId: hide.spotId } : null,
      doorState: door?.door.state ?? null,
      activeLockCore: door?.door.state === 'LOCKED' && door.door.lockCoreState === 'ACTIVE',
      canClose: !door || door.door.state !== 'OPEN' || this.canCloseDoor(door.definition.id),
      canHide,
      canEat: this.sprint.state === 'NORMAL',
      exitBlocked: concealed && this.exitBlockedByHuman(),
      riceInRange: !!rice && rice.range <= C.rice.interactionRange / U,
      moving: direction.x !== 0 || direction.y !== 0,
    });
    const searchTarget = faction === 'HUMAN' && !prompt
      ? this.playerQTargetResolution(actor.position).pointedLegalTarget : null;
    const shown = prompt ?? (faction === 'HUMAN' ? searchTarget ? {
      key: 'E' as const, label: '搜查家具', detail: this.humanSearchCooldown.ready ? '搜查面前家具' :
        `冷却 ${Math.ceil(this.humanSearchCooldown.remainingSeconds)} 秒`, blocked: !this.humanSearchCooldown.ready,
    } : null : hideCandidate ? {
      label: '躲藏', detail: !hideCandidate.legal ? '当前位置不可用' : '当前无法躲藏', blocked: true,
    } : null);
    if (!shown) return null;
    const screen = actor.position.clone().add(new THREE.Vector3(0, 2.1, 0)).project(this.camera);
    if (Math.abs(screen.x) > 1 || Math.abs(screen.y) > 1) return null;
    return { ...shown, x: (screen.x + 1) * this.renderer.domElement.clientWidth / 2,
      y: (1 - screen.y) * this.renderer.domElement.clientHeight / 2,
      held: this.input.isHeld('KeyE') };
  }

  private syncHideSpotIndicators(): void {
    const root = this.apartment.hideSpotIndicatorRoot;
    const actor = this.control.controlled(this.player, this.human);
    const faction = this.control.controlledFaction;
    root.visible = this.match.phase === 'PLAYING' && !this.sceneEditor?.isOpen && !!actor;
    if (!root.visible || !actor || !faction) return;
    const target = this.hideTargetResolution(actor.position).target;
    for (const [id, ring] of this.apartment.hideSpotIndicators) {
      const near = target?.spotId === id;
      // Human's markers are uniformly disabled: occupancy must not reveal a concealed opponent.
      const enabled = faction === 'DEEPSEEK' && this.hide.state === 'OUTSIDE' &&
        this.sprint.state === 'NORMAL' && this.match.captureProgressMs === 0 &&
        (this.hide.occupancyOf(id) === null) && (!near || !!target?.legal);
      const ownExit = this.hide.isConcealed(faction) && this.hide.spotId === id;
      const material = ring.material as THREE.MeshBasicMaterial;
      material.color.setHex(ownExit || (near && enabled) ? 0x82e6ee :
        enabled ? 0x8bcfd8 : 0x92a7aa);
      material.opacity = ownExit || near ? 0.82 : enabled ? 0.38 : 0.3;
      ring.scale.setScalar(ownExit || near ? 1.2 : 1);
    }
  }

  private pulseHudEntry(): PulseLockEntry | null {
    const actor = this.control.controlled(this.player, this.human);
    if (actor && this.control.isControlling('HUMAN')) {
      const nearby = this.nearestInteractableDoor(actor.position);
      if (nearby) return this.pulseLock.get(nearby.door.id) ?? null;
    }
    return this.pulseLock.entries.find(entry => entry.doorId === this.pulseLock.openDoorId) ?? null;
  }

  private emitMovementSound(faction: Faction, before: THREE.Vector3,
    after: THREE.Vector3, sprinting: boolean): void {
    if (distance(before, after) < C.perception.minimumMovementSoundDistance) return;
    const interval = sprinting ? C.perception.sprintStepIntervalMs : C.perception.footstepIntervalMs;
    if (this.sound.nowMs - this.lastStepMs[faction] < interval) return;
    this.sound.emit(sprinting ? 'SPRINT' : 'FOOTSTEP', after, faction);
    this.playWorld(sprinting ? 'sprintStep' : 'step', after, faction);
    this.lastStepMs[faction] = this.sound.nowMs;
  }

  private clearTraceViews(): void {
    for (const view of this.traceViews.values()) {
      this.scene.remove(view);
      this.disposeTraceView(view);
    }
    this.traceViews.clear();
  }

  private disposeTraceView(view: THREE.Group): void {
    view.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    });
  }

  private syncTraceViews(): void {
    const active = new Set(this.traces.traces.map(trace => trace.id));
    for (const [id, view] of this.traceViews) {
      if (active.has(id)) continue;
      this.scene.remove(view);
      this.disposeTraceView(view);
      this.traceViews.delete(id);
    }
    for (const trace of this.traces.traces) {
      let view = this.traceViews.get(trace.id);
      if (!view) {
        view = createRiceTraceView(trace, this.control.informationObserver === 'HUMAN');
        this.scene.add(view);
        this.traceViews.set(trace.id, view);
      }
      syncRiceTraceView(view, trace, this.control.informationObserver === 'HUMAN');
    }
  }

  private updatePerceptionHud(): void {
    if (import.meta.env.DEV)
      this.safetyPaths?.update(this.deepseekAI.safetyDebug, this.human.position);
    // No player sound visualization and no open DEV panel: there is no consumer.
    if (!PLAYER_SOUND_VISUAL_ENABLED && (!this.debugPanel?.isExpanded || this.debugPanel.root.hidden)) return;
    const faction = this.control.informationObserver;
    if (!faction) {
      if (PLAYER_SOUND_VISUAL_ENABLED)
        this.soundVisual?.update(null, null, false, this.sound.nowMs);
      return;
    }
    const listener = faction === 'HUMAN' ? this.human.position : this.player.position;
    const heard = this.sound.heardBy(listener, faction, this.camera, this.perceptionGeometry);
    const probe = heard ?? this.sound.analyzeBy(listener, faction, this.camera, this.perceptionGeometry);
    // Development display also exposes heavily occluded events; production stays audible-only.
    if (PLAYER_SOUND_VISUAL_ENABLED)
      this.soundVisual?.update(listener, this.debugPossessionEnabled ? probe : heard,
        this.match.phase !== 'FINISHED', this.sound.nowMs);
    if (!this.debugPanel?.isExpanded || this.debugPanel.root.hidden) return;
    const sight = this.vision.get(faction);
    this.updateDebugDetailsPanel(heard, probe, sight);
  }

  private updateDebugDetailsPanel(heard: ReturnType<SoundEventSystem['heardBy']>,
    probe: ReturnType<SoundEventSystem['analyzeBy']>,
    sight: ReturnType<VisionSystem['get']>): void {
    if (!import.meta.env.DEV || !this.debugPanel) return;
    const make = (key: string, label: string, value: string,
      tone: DebugProperty['tone'] = 'normal', children?: DebugProperty[]): DebugProperty =>
      ({ key, label, value, tone, children });
    const stateTone = (state: string): DebugProperty['tone'] =>
      state === 'EVADE' ? 'danger' : state === 'SAFE_WAIT' ? 'warning'
        : state.startsWith('CURIOUS') || state === 'SAFE_BYPASS' ? 'curious'
          : ['COMPLETED', 'DISABLED', 'PASS', 'SUCCESS'].includes(state) ? 'success' : 'normal';
    const point = pointText;
    const selectedFaction = this.control.selectedFaction;
    const factionName = selectedFaction === 'DEEPSEEK' ? 'DeepSeek 娘'
      : selectedFaction === 'HUMAN' ? '人类' : '未选择';
    const controlledName = this.control.controlledFaction === 'DEEPSEEK' ? 'DeepSeek 娘'
      : this.control.controlledFaction === 'HUMAN' ? 'Human' : '未选择';
    const phaseName = this.match.phase === 'FACTION_SELECT' ? '选择阵营'
      : this.match.phase === 'READY' ? `准备：${Math.ceil(this.match.readyRemainingMs / 1000)} 秒`
        : this.match.phase === 'PLAYING' ? '对局中'
          : this.match.phase === 'PAUSED' ? '已暂停' : '已结束';
    const time = formatMatchTime(this.match.elapsedMs);
    const ratio = this.rice.progressRatio;
    const risk = this.sprint.state === 'NORMAL'
      ? ratio >= C.sprint.riskThreshold ? 'RISK SPRINT' : 'SAFE SPRINT'
      : this.sprint.riskMode === 'FALL_ON_END' ? 'RISK SPRINT' : 'SAFE SPRINT';
    const pulseEntry = this.pulseHudEntry();
    const pulseDoor = pulseEntry ? this.doorSystem.get(pulseEntry.doorId) : null;
    const pulseStatus = !pulseEntry ? '未开始'
      : pulseDoor?.lockCoreState === 'DISABLED' ? '锁芯已失效'
        : this.pulseLock.isOpen ? `破解中 ${pulseEntry.completed} / ${this.pulseLock.coreCount}`
          : pulseEntry.completed ? `已完成 ${pulseEntry.completed} / ${this.pulseLock.coreCount}` : '未开始';
    const nearest = this.nearestRice();
    const currentRice = nearest?.portion.rice;
    const remainingRiceMs = currentRice
      ? Math.max(0, currentRice.maxProgressMs - currentRice.progressMs) : 0;
    const riceStates = { IDLE: '未交互', PREPARING: '准备中', EATING: '进食中',
      INTERRUPTED: '已中断', COMPLETED: '已完成' };
    const riceHint = this.rice.completed ? `${ACTIVE_RICE_COUNT} 份大米已吃完`
      : this.deepseekAiWasActive ? 'DeepSeek AI 正在自主寻找或进食'
        : this.control.isControlling('HUMAN') ? '当前控制 Human，不能进食'
          : this.sprint.state !== 'NORMAL' ? '冲刺或眩晕中无法进食'
            : nearest && nearest.range <= C.rice.interactionRange / U
              ? '按住 E 进食，移动可中断' : '靠近大米后按住 E';
    const humanPath = this.humanAI.getPathProgress();
    const humanActive = shouldRunHumanAI(this.match.phase, this.control.selectedFaction,
      this.control.temporaryInputTarget, this.roomLightDebugDirection(), this.debugPossessionEnabled);
    const humanMode = this.match.phase === 'PAUSED' ? 'PAUSED'
      : this.match.phase === 'READY' ? 'STANDBY' : humanActive ? this.humanAI.state : 'MANUAL';
    const deepseekPath = this.deepseekAI.getPathProgress();
    const deepseekActive = shouldRunDeepSeekAI(this.match.phase, this.control.selectedFaction,
      this.control.temporaryInputTarget, this.roomLightDebugDirection(), this.debugPossessionEnabled);
    const deepseekMode = this.match.phase === 'PAUSED' ? 'PAUSED'
      : this.match.phase === 'READY' ? 'STANDBY'
        : deepseekActive ? this.deepseekAI.state : 'MANUAL';
    const seen = sight.lastSeen;
    const blockerIndex = DOOR_NODES.findIndex(node => node.id === sight.blocker);
    const blockerLabel = blockerIndex >= 0
      ? `Door D${String(blockerIndex + 1).padStart(2, '0')}` : sight.blocker ?? '';
    const categories: DebugCategory[] = [
      {
        id: 'human-ai', title: 'Human AI', properties: this.debugPossessionEnabled ? [
          make('mode', '模式', humanMode, stateTone(humanMode)),
          make('target', '目标', `${this.humanAI.targetRoomId ?? '位置'} ${point(this.humanAI.target)}`),
          make('path', '路径节点', humanPath
            ? `${humanPath.index}/${humanPath.total} ${point(humanPath.waypoint)}` : '无'),
          make('lock-decision', '锁门决策 / 目标门', `${this.humanAI.lockDecision} / ${this.humanAI.targetDoorId ?? '无'}`),
          make('decision-reason', '选择原因', this.humanAI.decisionReason),
          make('unlock-progress', '解锁进度', `${(this.humanAI.unlockProgressMs / 1000).toFixed(1)} / ${(this.humanAI.difficultyConfig.aiUnlockDurationMs / 1000).toFixed(1)} 秒`),
          make('force-break-cooldown', '强破 CD', `${(this.humanDoorSkill.cooldownRemainingMs / 1000).toFixed(1)} 秒`),
          make('search-room', '搜索区域', this.humanAI.searchTargetRoomId ?? '无'),
          make('hide-clue', 'AI 已知：米痕线索', `${this.humanAI.clueMemory.count()} 条` +
            `（已过期 ${this.humanAI.clueMemory.expiredCount} 条）｜最近 ` +
            `${point(this.humanAI.clueList().slice(-1)[0]?.position ?? null)}`,
            this.humanAI.clueMemory.count() ? 'normal' : 'warning'),
          make('hide-inference', 'AI 推断：方向 / 置信度',
            `${this.humanAI.traceInferenceText()}｜方向 ` +
            `${this.humanAI.traceInference.directionHeadingRad === null ? '未知'
              : `${(this.humanAI.traceInference.directionHeadingRad * 180 / Math.PI).toFixed(0)}°`}` +
            `｜锚点 ${point(this.humanAI.traceInference.anchor)}`,
            this.humanAI.traceInference.confidence === 'HIGH' ? 'curious' : 'normal'),
          make('hide-inference-basis', 'AI 推断：公开依据',
            this.humanAI.traceInference.basis.join('；') || '无'),
          make('hide-candidate', 'AI 怀疑家具（公开排序）',
            this.humanAI.candidateRanking,
            this.humanAI.suspectedSpotIds.length ? 'curious' : 'warning'),
          make('hide-candidate-basis', 'AI 怀疑依据（只用公开线索）',
            this.humanAI.candidateBasis.join('；') || '无'),
          make('hide-candidate-skipped', '公开候选被排除的原因',
            this.humanAI.candidateSkipped),
          // 修复轮 一 / 二：被延后的公开线索批次与 Last Seen 的公开摘要。
          make('hide-pending-clues', '待处理的公开线索（被延后 ≠ 丢弃）',
            this.humanAI.pendingClueCount === 0
              ? '当前没有被延后的公开线索'
              : `${this.humanAI.pendingClueCount} 条｜延后原因 ` +
                `${HUMAN_CLUE_DEFER_TEXT[this.humanAI.pendingClueDeferReason]}｜` +
                `最后有效期还剩 ${((this.humanAI.pendingClueValidUntilMs -
                  this.traces.nowMs) / 1000).toFixed(1)} 秒｜延后 ` +
                `${this.humanAI.pendingClueDeferCount} 次 / 重评 ` +
                `${this.humanAI.pendingClueReevalCount} 次`,
            this.humanAI.pendingClueCount > 0 ? 'curious' : 'normal'),
          make('hide-last-seen', 'Last Seen 公开坐标 / 房间 / 有效性',
            `${point(this.humanAI.lastSeenPublic(this.traces.nowMs).present === true
              ? { x: Number(this.humanAI.lastSeenPublic(this.traces.nowMs).x ?? 0),
                z: Number(this.humanAI.lastSeenPublic(this.traces.nowMs).z ?? 0) } : null)}` +
            `｜房间 ${this.humanAI.lastSeenRoomId ?? '无'}｜` +
            `${this.humanAI.lastSeenPublic(this.traces.nowMs).valid === true
              ? '仍然有效' : '已过期或不存在'}`),
          make('hide-last-seen-room-gate', '最后目击房间的公开门槛',
            `${this.humanAI.lastSeenRoomGateCode}：` +
            `${this.humanAI.lastSeenRoomGateDetail || '无'}`),
          make('hide-check-phase', '藏身搜查阶段 / 来源',
            `${this.humanAI.checkHidePhase} / ${this.humanAI.checkHideSource ?? '无'}｜目标 ` +
            `${this.humanAI.checkHideSpotId ?? '无'}`),
          make('hide-check-stance', '搜查站位 / 可搜查表面',
            `${point(this.humanAI.checkHideStance?.stancePoint ?? null)} / ` +
            `${point(this.humanAI.checkHideStance?.surfacePoint ?? null)}`),
          make('hide-check-dwell', '搜查停留进度（满 900 ms 才正式判定）',
            `${(this.humanAI.checkHideDwellRemainingMs / 1000).toFixed(1)} / ` +
            `${(this.humanAI.checkHideDwellMs / 1000).toFixed(1)} 秒`),
          // 修复轮 三 / 四：把「开始过几次」与「真正执行过几次」分开显示，并给出
          // 计划瞄点与最终判定点是否同一个点。
          make('hide-check-round', '本轮已开始 / 已正式执行（上限）　本次调查已执行',
            `${this.humanAI.checkHideRoundAttempts} / ${this.humanAI.checkHideRoundChecks}` +
            `（上限 ${this.humanAI.checkHideRoundBudget}）　` +
            `${this.humanAI.checkHideInvestigationChecks}（上限 ${this.humanAI.difficultyConfig.searchRoomCount}）｜` +
            `本轮开始过的家具 ${this.humanAI.checkHideAttemptedSpotId ?? '无'}｜` +
            `${this.humanAI.checkHideCheckedSpotIds.join('、') || '还没有检查过家具'}`),
          make('hide-check-aim', '计划瞄点 / 最终判定点（同一个点才算计划与执行一致）',
            `${point(this.humanAI.lastCheckDetail.plannedSurfacePoint)} / ` +
            `${point(this.humanAI.lastCheckDetail.finalAimPoint)}｜与最近表面点相差 ` +
            `${this.humanAI.lastCheckDetail.aimPointDelta === null ? '—'
              : this.humanAI.lastCheckDetail.aimPointDelta.toFixed(3)}｜` +
            `距离 ${this.humanAI.lastCheckDetail.distance === null ? '—'
              : this.humanAI.lastCheckDetail.distance.toFixed(2)}｜偏差 ` +
            `${this.humanAI.lastCheckDetail.angleDeltaDeg === null ? '—'
              : `${this.humanAI.lastCheckDetail.angleDeltaDeg.toFixed(1)}°`}`),
          make('hide-check-end', '本次调查的收尾方式',
            this.humanAI.checkHideInvestigationEndReason),
          make('hide-check-interrupt', '打断搜查的声音明细（真实类型 / 强度 / 剩余寿命）',
            this.humanAI.lastInterruptSoundType === null
              ? '当前没有打断搜查的声音记录'
              : `${this.humanAI.lastInterruptSoundType}｜` +
                `${(this.humanAI.lastInterruptSoundStrength ?? 0).toFixed(2)}｜` +
                `${((this.humanAI.lastInterruptSoundRemainingMs ?? 0) / 1000).toFixed(1)} 秒｜` +
                `${this.humanAI.lastInterruptSoundIsNew ? '新事件' : '旧事件'}`),
          make('hide-check-cooldown', '搜查失败记忆与剩余冷却',
            this.humanAI.checkHideCooldowns().map(entry =>
              `${entry.spotId} 剩余 ${(entry.remainingMs / 1000).toFixed(1)} 秒`).join('；')
            || '当前没有搜查失败记忆'),
          make('hide-check-result', '人类 AI 最近一次搜查结果（AI 只知道搜中 / 搜空）',
            `${this.humanAI.checkHideLastResult}（${this.humanAI.checkHideLastResultSpotId ?? '无'}）`,
            this.humanAI.checkHideLastResult === 'HIT' ? 'success'
              : this.humanAI.checkHideLastResult === 'MISS' ? 'warning' : 'normal'),
          make('hide-check-giveup', '放弃搜查原因',
            `${this.humanAI.checkHideGiveUpCode}：${this.humanAI.checkHideGiveUpDetail || '无'}`,
            this.humanAI.checkHideGiveUpCode === 'NONE' ? 'normal' : 'warning'),
          make('hide-check-counts', '搜查次数：开始 / 命中 / 搜空 / 被抢占',
            `${this.humanAI.checkHideStartCount} / ${this.humanAI.checkHideHitCount} / ` +
            `${this.humanAI.checkHideMissCount} / ${this.humanAI.checkHideInterruptCount}`),
          make('hide-check-truth', '开发者真值：人类 AI 最近一次权威判定',
            `${this.humanAiCheckCode}｜${this.humanAiCheckDetail}`),
          make('hide-information-owner', '信息归属',
            'AI 已知=它亲自看到的公开线索；AI 推断=它由线索算出的结论；' +
            '开发者真值不参与 AI 决策；隐藏坐标与占用状态从不进入 AI 输入'),
          make('transition-reason', '切换原因', this.humanAI.lastTransitionReason),
          make('navigation-reason', '路径事件', this.humanAI.lastNavigationReason),
        ] : [],
      },
      {
        id: 'deepseek-ai', title: 'DeepSeek AI', properties: this.debugPossessionEnabled ? [
          make('mode', '当前状态', deepseekMode, stateTone(deepseekMode)),
          make('rice-target', '目标米堆', this.deepseekAI.targetRiceId ?? '无'),
          make('rice-score', '预计完成评分', this.deepseekAI.targetScoreMs === null
            ? '无' : `${(this.deepseekAI.targetScoreMs / 1000).toFixed(1)} 秒`),
          make('path-node', '路径节点', deepseekPath
            ? `${deepseekPath.index}/${deepseekPath.total} ${point(deepseekPath.waypoint)}` : '无'),
          make('region', '当前区域', this.deepseekAI.currentEscapeRoomId ?? '无'),
          make('reselect-reason', '重选原因', this.deepseekAI.lastSelectionReason),
          make('navigation-reason', '寻路信息', this.deepseekAI.lastNavigationReason),
        ] : [],
      },
      {
        id: 'threat-escape', title: 'Threat / Escape', properties: this.debugPossessionEnabled ? [
          make('threat', '威胁等级 / 来源', `${this.deepseekAI.threatLevel} / ${this.deepseekAI.threatSource}`, stateTone(this.deepseekAI.threatLevel)),
          make('escape-target', '逃跑目标', `${this.deepseekAI.escapeRoomId ?? '无'} ${point(this.deepseekAI.escapeTarget)}`),
          make('escape-score', '当前目标评分', this.deepseekAI.escapeGoalScore?.toFixed(1) ?? '无'),
          make('reachable-count', '可达候选数', String(this.deepseekAI.escapeCandidateScores.length)),
          make('current-room-score', '当前区域评分', `${this.deepseekAI.currentEscapeRoomId ?? '无'} / ${this.deepseekAI.escapeCandidateScores.find(candidate => candidate.roomId === this.deepseekAI.currentEscapeRoomId)?.score.toFixed(1) ?? '无'}`),
          make('candidate-scores', '候选房间评分', `${this.deepseekAI.escapeCandidateScores.length} 个`, 'normal', escapeCandidateProperties(this.deepseekAI.escapeCandidateScores)),
          make('last-switch', '上次换目标原因', this.deepseekAI.lastEscapeSwitchReason),
          make('recent-visits', '最近访问区域', this.deepseekAI.getRecentEscapeRooms().join(' → ') || '无', 'normal', this.deepseekAI.getRecentEscapeRooms().map((roomId, index) => make(`visit-${index}-${roomId}`, `访问 ${index + 1}`, roomId))),
          make('local-loop', '局部循环重选', this.deepseekAI.localLoopTriggered ? '是' : '否', this.deepseekAI.localLoopTriggered ? 'warning' : 'normal'),
          make('redecision', '最近重新决策原因', this.deepseekAI.lastEscapeDecisionReason),
          make('no-movement', '无移动原因', this.deepseekAI.noMovementReason),
          make('sprint-decision', '冲刺决策', this.deepseekAI.sprintDecision),
          make('recover-remaining', '恢复剩余', `${(this.deepseekAI.recoverRemainingMs / 1000).toFixed(1)} 秒`),
          make('recover-block', '恢复阻碍', this.deepseekAI.recoveryBlockReason),
        ] : [],
      },
      {
        id: 'door-escape', title: 'Door Escape / 关门逃脱',
        properties: this.debugPossessionEnabled ? [
          make('human-unlock-penalty', 'Human 玩家解除 AI 锁后的全门冷却',
            this.deepseekDoorLockPenalty.ready ? '可再次锁门'
              : `${(this.deepseekDoorLockPenalty.remainingMs / 1000).toFixed(1)} 秒`,
            this.deepseekDoorLockPenalty.ready ? 'normal' : 'warning'),
          make('candidate', '最近评估候选门', this.deepseekAI.doorEscapeCandidateId ?? '无'),
          make('distance', '最近评估候选门距离', this.deepseekAI.doorEscapeDistance === null
            ? '无' : `${this.deepseekAI.doorEscapeDistance.toFixed(2)} 世界单位`),
          make('passed', '最近评估：已通过门（1800ms 内）', this.deepseekAI.doorEscapePassed ? '是' : '否'),
          make('human-side', '最近评估：Human 在另一侧', this.deepseekAI.doorEscapeHumanOpposite === null
            ? '未知（不使用隐藏位置）' : this.deepseekAI.doorEscapeHumanOpposite ? '是' : '否'),
          make('route', '最近评估：关闭后路线仍可达', this.deepseekAI.doorEscapeRouteSafe ? '可达' : '未确认'),
          make('benefit', '最近评估依据', this.deepseekAI.doorEscapeReason),
          make('result', '最近关门结果', this.deepseekAI.doorEscapeLastResult),
          make('skip', '最近放弃关门原因', this.deepseekAI.doorEscapeSkipReason),
          make('cooldown', '当前关门冷却',
            `${(this.deepseekAI.doorEscapeCooldownRemainingMs / 1000).toFixed(1)} 秒`),
          make('last-crossed', '最近经过的门 / 距过门时间',
            this.deepseekAI.doorEscapeLastCrossedId === null ? '无'
              : `${this.deepseekAI.doorEscapeLastCrossedId} / ${(this.deepseekAI.doorEscapeLastCrossedAgeMs ?? 0).toFixed(0)} ms`,
            (this.deepseekAI.doorEscapeLastCrossedAgeMs ?? 0) <= C.deepseekAI.doorEscapeCrossingWindowMs
              ? 'normal' : 'warning'),
          make('sprint-interference', '冲刺中关门次数 / 冲刺中锁门次数',
            `${this.deepseekAI.doorEscapeDuringSprintCount} / ${this.deepseekAI.doorLockDuringSprintCount}`),
          make('self-reopen-blocked', '自我重开门被抑制次数',
            String(this.deepseekAI.doorEscapeSelfReopenBlockedCount),
            this.deepseekAI.doorEscapeSelfReopenBlockedCount > 0 ? 'warning' : 'normal'),
        ] : [],
      },
      {
        id: 'sprint', title: 'Sprint / 冲刺',
        properties: this.debugPossessionEnabled ? [
          make('sprint-readiness', '冲刺状态 / 就绪度',
            `${this.sprint.state} / ${this.sprint.readiness}`,
            this.sprint.readiness === 'READY' ? 'success'
              : this.sprint.readiness === 'COOLDOWN' ? 'warning' : 'normal'),
          make('sprint-cooldown', '冷却剩余',
            `${(this.sprint.cooldownRemainingMs / 1000).toFixed(1)} 秒`),
          make('sprint-duration-left', '本次冲刺剩余',
            `${(this.sprint.sprintRemainingMs / 1000).toFixed(1)} 秒`),
          make('sprint-risk-mode', '风险模式', this.sprint.riskMode ?? '无'),
          make('sprint-start-reason', '最近开始原因', this.sprint.lastStartReason),
        ] : [],
      },
      {
        id: 'door-lock', title: 'Door Lock / 主动锁门',
        properties: this.debugPossessionEnabled ? [
          make('lock-last-close', '最近成功关闭的门', this.deepseekAI.doorLockLastCloseId ?? '无'),
          make('lock-pending', 'doorLockPendingId', this.deepseekAI.doorLockPendingId ?? '无',
            this.deepseekAI.doorLockPendingId ? 'success' : 'normal'),
          make('lock-window', 'pending 建立于 / 剩余窗口',
            this.deepseekAI.doorLockPendingSinceMs === null ? '无'
              : `+${this.deepseekAI.doorLockPendingSinceMs.toFixed(0)} ms / 剩 ${(this.deepseekAI.doorLockWindowRemainingMs / 1000).toFixed(1)} 秒`),
          make('lock-eval', '最近锁门决策原因（执行成功时显示结果）', this.deepseekAI.doorLockReason),
          make('lock-evidence', '关门前侧向证据 / 最近一次是否使用',
            `${this.deepseekAI.doorLockEvidenceDoorId ?? '无'} / ${this.deepseekAI.doorLockUsedEvidence
              ? '使用中（关门后失视）' : '未使用（以最新目视为准）'}`,
            this.deepseekAI.doorLockUsedEvidence ? 'warning' : 'normal'),
          make('lock-skip', '最近拒绝原因', this.deepseekAI.doorLockSkipReason),
          make('lock-result', '最近锁门执行结果', this.deepseekAI.doorLockLastResult),
          make('lock-counts', '关门成功 / pending / 提前取消 / 锁门命令 / 锁门成功 / 重复尝试被拒',
            `${this.deepseekAI.doorEscapeCloseCount} / ${this.deepseekAI.doorLockPendingCount} / ${this.deepseekAI.doorLockCancelCount} / ${this.deepseekAI.doorLockCommandCount} / ${this.deepseekAI.doorLockAppliedCount} / ${this.deepseekAI.doorLockRepeatBlockedCount}`),
        ] : [],
      },
      {
        id: 'hide', title: 'Hide / 藏身',
        properties: this.debugPossessionEnabled ? [
          make('hide-state', '藏身状态',
            this.hide.state === 'CONCEALED' ? `藏身中（${this.hide.spotId ?? '未知'}）` : '普通',
            this.hide.state === 'CONCEALED' ? 'curious' : 'normal'),
          make('hide-spot', '当前藏身点', this.hide.spotId ?? '无'),
          make('hide-position', '真实进入位置 = 退出位置',
            pointText(this.hide.entryPosition)),
          make('hide-candidate', '当前位置的藏身检查 / 最近匹配点',
            `${this.hideCandidateCode} / ${this.hideCandidateSpotId ?? '无'}`,
            this.hideCandidateCode === 'LEGAL' ? 'success'
              : this.hideCandidateCode === 'NONE' ? 'normal' : 'warning'),
          make('deepseek-visual-target', 'DP 当前白色指向 / 最后人工朝向',
            `${this.deepseekVisualTarget.kind}${this.deepseekVisualTarget.kind === 'FURNITURE'
              ? `（${this.deepseekVisualTarget.spotId}）`
              : this.deepseekVisualTarget.kind === 'RICE'
                ? `（${this.deepseekVisualTarget.riceId}）` : ''}｜` +
            `${this.lastDeepseekVisualHeadingRad === null ? '未移动'
              : `${(this.lastDeepseekVisualHeadingRad * 180 / Math.PI).toFixed(1)}°`}`,
            this.deepseekVisualTarget.kind === 'NONE' ? 'normal' : 'success'),
          make('hide-reject', '最近拒绝原因', this.hide.lastRejectReason),
          make('hide-exit', '最近退出原因', this.hide.lastExitReason),
          make('hide-counts', '本局进入 / 退出 / 拒绝次数',
            `${this.hide.enterCount} / ${this.hide.exitCount} / ${this.hide.rejectCount}`),
          // S7C-2b：AI 自主藏身。刻意与玩家侧字段**显式分开**，并沿用 S7C-2 的
          // 「AI 已知 / AI 推断 / 开发者真值」三段纪律：这里只放 AI 自己的相位、
          // 公开理由、公开候选评分与循环抑制计数；对手真值不出现在这一段。
          make('hide-ai-phase', 'AI 藏身：相位 / 目标点 / 站位',
            `${this.deepseekAI.hidePhase}（${this.deepseekAI.state}）｜` +
            `${this.deepseekAI.hideSpotId ?? '无'}｜` +
            `${pointText(this.deepseekAI.hideStancePoint)}｜` +
            `路线 ${this.deepseekAI.hideTravelLength === null ? '—'
              : this.deepseekAI.hideTravelLength.toFixed(2)}`,
            this.deepseekAI.hidePhase === 'CONCEALED' ? 'curious'
              : this.deepseekAI.hidePhase === 'NONE' ? 'normal' : 'warning'),
          make('hide-ai-reason', 'AI 藏身：公开理由 / 被阻止原因',
            `${this.deepseekAI.hideReason}｜阻止 ${this.deepseekAI.hideBlockedReason}`),
          make('hide-ai-candidate', 'AI 藏身：公开候选（合法站位 / 评分最高）',
            `${this.deepseekAI.hideCandidateCount} 个合法站位｜` +
            `${this.deepseekAI.hideCandidateSummary}`),
          make('hide-ai-scores', 'AI 藏身：逐点公开评估（点｜结论｜评分｜路线）',
            this.deepseekAI.hideCandidateScores.map(entry =>
              `${entry.spotId}:${entry.code}` +
              `${entry.score === null ? '' : `(${entry.score.toFixed(2)}/${entry.travelLength?.toFixed(2) ?? '—'})`}`)
              .join('｜') || '还没有评估'),
          make('hide-ai-loopguard', 'AI 藏身：循环抑制（冷却 / 近期点 / 连续次数上限）',
            `${this.deepseekAI.hideCooldownSummary}｜近期 ` +
            `${this.deepseekAI.hideRecentSpotIds.join('、') || '无'}｜连续 ` +
            `${this.deepseekAI.hideConsecutiveCount} / ${C.deepseekAI.hideMaxConsecutive}｜` +
            `冷却明细 ${this.deepseekAI.hideCooldowns().map(entry =>
              `${entry.spotId}:${(entry.remainingMs / 1000).toFixed(1)}s`).join('、') || '无'}`),
          make('hide-ai-exit-gate', 'AI 藏身：藏身时长 / 退出闸门',
            `${(this.deepseekAI.hideConcealedMs / 1000).toFixed(2)} 秒｜` +
            `${this.deepseekAI.hideExitGate}｜最近退出 ${this.deepseekAI.hideLastExitReason}`),
          make('hide-ai-entry', 'AI 藏身：权威进入结论（开发者真值）',
            `${this.deepseekAI.hideEnterCount} 次成功 / ${this.deepseekAI.hideRejectCount} 次被拒｜` +
            `${this.deepseekAI.hideExitCount} 次退出｜${this.deepseekAI.hideAbortCount} 次中止｜` +
            `点被封锁 ${this.deepseekAI.hideSpotBlockedCount} 次｜令牌 ` +
            `${this.hide.hasPendingAiEntryToken() ? '已签发未使用' : '无'}`,
            this.deepseekAI.hideRejectCount > 0 ? 'warning' : 'normal'),
          make('hide-ai-entry-detail', 'AI 藏身：最近一次权威进入明细',
            `${this.deepseekHideEntryCode}｜${this.deepseekHideEntryDetail}｜` +
            `游戏层计数 ${this.deepseekHideEnterCount} / ${this.deepseekHideRejectCount} / ` +
            `${this.deepseekHideExitCount}｜最近 AI 退出 ${this.deepseekHideLastExitReason}`),
          make('hide-vision', '藏身对普通 Vision 的影响',
            `Human 看到的 DeepSeek：${this.vision.get('HUMAN').status}`,
            this.vision.get('HUMAN').status === 'CONCEALED' ? 'curious' : 'normal'),
          make('hide-capture', '常规抓捕资格（藏身中必须不累计）',
            this.captureZoneActive ? '圈内累计中' : '不累计',
            this.captureZoneActive ? 'danger' : 'normal'),
          make('hide-search', 'Human E搜查 / V抓捕：共用冷却 / 最近判定',
            `${this.humanSearchCooldown.ready ? '可用'
              : `${this.humanSearchCooldown.remainingSeconds.toFixed(1)} 秒`} / ${this.lastSearchCode}`),
          // S7C-2 修复轮 二 / 三：玩家 Q 的唯一家具交互目标（公开解析结果）与家具搜查结果。
          // 「当前高亮」是**本帧**的公开解析结果，「最近一次 Q」是上一次真正执行的用途。
          make('hide-search-target', 'Human E 当前家具高亮 / 最近一次执行',
            `高亮 ${this.hideTargetSpotId ? 'FURNITURE' : 'NONE'}` +
            `（${this.hideTargetSpotId ?? '无'}｜家具 ${this.hideTargetFurnitureId ?? '无'}｜` +
            `合法 ${this.hideTargetLegal ? '是' : '否'}｜指向 ` +
            `${this.hideTargetPointed ? '是' : '否'}` +
            `${Number.isNaN(this.hideTargetPointingDeltaDeg) ? '' :
              ` ${this.hideTargetPointingDeltaDeg.toFixed(1)}°`}` +
            `｜V扇形可命中 ${this.hideTargetExposedPriority ? '是' : '否'}）｜` +
            `最近一次 E/V：${this.humanSearchTargetKind}（${this.lastPlayerQPlanReason}）`,
            this.hideTargetSpotId && this.hideTargetLegal &&
              this.humanSearchCooldown.ready ? 'success' : 'normal'),
          make('hide-search-region', '家具交互区域合法性（公开解析）',
            `${this.hideTargetCode}｜${HIDE_TARGET_CODE_TEXT[this.hideTargetCode] ?? '—'}` +
            `｜区域内候选 ${this.hideTargetCandidates} 件`,
            this.hideTargetLegal ? 'success' : 'normal'),
          make('hide-search-furniture', 'Human E 家具搜查最近结果',
            `${this.furnitureSearchCode}｜${this.furnitureSearchDetail}｜` +
            `家具搜查 ${this.furnitureSearchCount} 次 / 命中 ${this.furnitureSearchHitCount} 次`),
          make('hide-search-detail', 'Human E/V 最近结果', this.lastSearchDetail),
          make('hide-search-counts', 'Human V 扇形释放 / 命中次数',
            `${this.humanSearchCount} / ${this.humanSearchHitCount}`),
          make('hide-search-spot', 'Human 最近搜查的藏身点', this.lastSearchSpotId ?? '无'),
          make('hide-lock-cooldown', 'DeepSeek Q 锁门冷却',
            this.deepseekLockCooldown.ready ? '可用'
              : `${this.deepseekLockCooldown.remainingSeconds.toFixed(1)} 秒`,
            this.deepseekLockCooldown.ready ? 'normal' : 'warning'),
          make('hide-notice', '玩家可见提示', this.hideNotice || '无'),
          make('hide-controls', '藏身操作',
            this.control.isControlling('DEEPSEEK')
              ? '走到藏身点附近点按 E 进入 / 再按 E 退出（藏身中禁止移动、冲刺、进食、锁门）'
              : '控制 Human：E 门优先，否则搜查家具；V 前方扇形抓捕（共用冷却）'),
        ] : [],
      },
      {
        id: 'safe-wait', title: 'SAFE_WAIT', properties: this.debugPossessionEnabled ? [
          make('active', '是否激活', this.deepseekAI.state === 'SAFE_WAIT' ? '进行中' : '无', stateTone(this.deepseekAI.state)),
          make('rice-target', '目标米堆', this.deepseekAI.safeWaitRiceId ?? '无'),
          make('dangerous-entry', '危险入口', this.deepseekAI.safeWaitEntryId ?? '无'),
          make('failures', '失败次数', String(this.deepseekAI.safeWaitFailureCount)),
          make('recheck', '重查倒计时', `${(this.deepseekAI.safeWaitRemainingMs / 1000).toFixed(1)} 秒`),
          make('recheck-result', '重查结果 / 原因', this.deepseekAI.safeWaitReason),
          make('entry-exit-reason', '进入 / 退出原因', this.deepseekAI.lastTransitionReason),
        ] : [],
      },
      {
        id: 'curiosity-passage', title: 'Curiosity / Passage', properties: this.debugPossessionEnabled ? [
          make('human-stillness', 'Human 静止时长 / 事件 ID', `${(this.humanStillness.stillMs / 1000).toFixed(1)} 秒 / ${this.humanStillness.eventId}`),
          make('curiosity-roll', '好奇触发结果', this.deepseekAI.curiosityRollResult),
          make('curiosity-state', '好奇状态', this.deepseekAI.state.startsWith('CURIOUS') ? this.deepseekAI.state : this.deepseekAI.curiosityBypassActive ? 'SAFE_BYPASS' : '无', stateTone(this.deepseekAI.state)),
          make('curiosity-target', '试探目标 / 安全距离', `${point(this.deepseekAI.curiosityTarget)} / ${C.deepseekAI.curiositySafeDistance.toFixed(1)} 世界单位`),
          make('curiosity-interrupt', '试探中断 / 冷却', `${this.deepseekAI.curiosityInterruptReason} / ${(this.deepseekAI.curiosityCooldownRemainingMs / 1000).toFixed(1)} 秒`),
          make('passage-roll', '安全通行抽签 / 状态', `${this.deepseekAI.passageRollResult} / ${this.deepseekAI.passageActive ? '通行中' : '未通行'}`),
          make('passage-result', '通行结果', this.deepseekAI.passageActive ? '已进入安全通行'
            : this.deepseekAI.passageGateReason === 'TRIGGERED_NO_SAFE_ROUTE' ? '已触发但无安全路线'
              : this.deepseekAI.passageGateReason.startsWith('INTERRUPTED_') ? '已进入后中断' : '尚未触发',
            this.deepseekAI.passageActive ? 'success' : 'normal'),
          make('passage-gate', '通行门控原因', this.deepseekAI.passageGateReason),
          make('safety-reason', '路径验证结果', this.deepseekAI.safetyDebug.reason),
          make('safety-eat-position', '验证进食位置', point(this.deepseekAI.safetyDebug.eat)),
          make('safety-legend', '安全路径图例', '红=实际抓捕圈/危险段；黄=安全余量；紫=米；绿=进食点/验证路线；青=观察点；蓝紫=默认路径；白=AI已知Human位置（非实时透视）'),
          make('passage-radius', '动态绕行半径', `${this.deepseekAI.passageAvoidRadius.toFixed(2)} 世界单位（抓捕圈 + 余量）`),
          make('passage-cancel', '通行中断原因', this.deepseekAI.passageCancelReason),
          make('last-transition', '最近切换原因', this.deepseekAI.lastTransitionReason),
        ] : [],
      },
      {
        id: 'animation', title: 'Animation', properties: import.meta.env.DEV ? [
          make('human-action', 'Human 当前动作', this.humanAction.action, stateTone(this.humanAction.action)),
          make('human-action-reason', 'Human 动作切换原因', this.humanAction.lastTransitionReason),
          make('human-idle', 'Human 静止时间 / 待机插槽', `${this.humanAction.idleSeconds.toFixed(1)} 秒 / ${this.humanAction.currentIdleSlot ?? '无'}`),
          make('deepseek-action', 'DeepSeek 当前动作', this.playerAction.action, stateTone(this.playerAction.action)),
          make('deepseek-action-reason', 'DeepSeek 动作切换原因', this.playerAction.lastTransitionReason),
          make('deepseek-idle', 'DeepSeek 静止时间 / 待机插槽', `${this.playerAction.idleSeconds.toFixed(1)} 秒 / ${this.playerAction.currentIdleSlot ?? '无'}`),
          make('reserved-action-states', '预留动作状态', 'Human EAT / STARTLED / FALL / STUN；DeepSeek CAPTURE'),
        ] : [],
      },
      {
        id: 'dev-freeze', title: 'DEV Freeze / 场景编辑',
        properties: this.debugPossessionEnabled
          ? (this.sceneEditor?.statusEntries() ?? []).map(entry =>
            make(`dev-${entry.label}`, entry.label, entry.value, entry.tone ?? 'normal'))
          : [],
      },
      {
        id: 'match-setup', title: 'Match Setup / 本局随机布局',
        properties: this.debugPossessionEnabled ? [
            make('match-seed', '本局种子 / 下局固定种子',
              `${this.matchSetup?.seed ?? '未开始'} / ${this.fixedMatchSeed ?? '随机'}`),
            make('match-spawns', '随机出生', this.matchSetup
              ? `DeepSeek ${this.matchSetup.deepseek.roomId} ${point(this.matchSetup.deepseek)} ｜ Human ${this.matchSetup.human.roomId} ${point(this.matchSetup.human)}` : '未开始'),
            make('match-doors', '初始门 OPEN / CLOSED', this.matchSetup
              ? `${Object.values(this.matchSetup.doorStates).filter(state => state === 'OPEN').length} / ${Object.values(this.matchSetup.doorStates).filter(state => state === 'CLOSED').length}` : '未开始',
              'normal', this.matchSetup ? Object.entries(this.matchSetup.doorStates).map(
                ([id, state]) => make(id, id, state)) : []),
            make('match-validation', '布局校验 / 尝试次数', this.matchSetup
              ? `${this.matchSetup.validation}${this.matchSetup.fallback ? '（安全回退）' : ''} / ${this.matchSetup.attempts}` : '未开始'),
            make('match-failures', '最近生成失败原因',
              this.matchSetup?.failures.at(-1) ?? '无'),
          ] : [],
      },
      {
        id: 'other', title: 'Other', properties: [
          make('match-phase', '对局状态 / 时间', `${phaseName} / ${time}`),
          make('player-faction', '玩家阵营', factionName),
          make('primary-control', '正式主控阵营', factionName),
          make('temporary-control', '临时输入目标', controlledName),
          make('camera-observer', 'Camera / 信息观察者', `${factionName} / ${selectedFaction === 'DEEPSEEK' ? 'DeepSeek 娘' : selectedFaction === 'HUMAN' ? 'Human' : '未选择'}`),
          ...(this.debugPossessionEnabled ? [make('direct-hotkeys', '调试快捷键', C.development.directHotkeysEnabled ? 'R / M / Tab 已开启' : '关闭')] : []),
          make('movement-controls', '移动控制', 'WASD / 方向键：当前控制角色；IJKL：另一角色（调试）'),
          make('deepseek-controls', 'DeepSeek 操作', 'E 进食；移动时点 Space 冲刺'),
          make('door-controls', '门操作', this.control.isControlling('DEEPSEEK')
            ? `E 开/关｜Q 锁门｜锁 ${this.doorSystem.activeLockedDoorCount} / ${C.door.maxActiveLocks}`
             : 'E 开/关或 PulseLock｜Space 普通门快开 / 锁门强破'),
          make('door-message', '门状态消息', this.doorStatusMessage || '无'),
          make('force-break', '强制破锁', this.humanDoorSkill.cooldownRemainingMs > 0
            ? `CD ${(this.humanDoorSkill.cooldownRemainingMs / 1000).toFixed(1)} 秒` : 'READY',
            this.humanDoorSkill.cooldownRemainingMs > 0 ? 'warning' : 'success'),
          make('lock-core-mines', '锁芯 / PulseLock 状态', `${pulseDoor?.lockCoreState ?? 'ACTIVE'} / ${pulseStatus}`,
            pulseDoor?.lockCoreState === 'DISABLED' ? 'success' : 'normal'),
          make('capture-progress', '抓捕进度', `${(this.match.captureProgressMs / 1000).toFixed(2)} / ${(C.match.captureMs / 1000).toFixed(2)} 秒`),
          make('capture-zone', '抓捕区', this.captureZoneBlocked ? '有阻挡'
            : this.captureZoneActive ? '圈内' : '圈外'),
          make('sprint-state', 'DeepSeek 冲刺状态 / 米进度', `${this.sprint.state} / ${Math.round(ratio * 100)}%`, stateTone(this.sprint.state)),
          make('sprint-risk', '冲刺风险 / 剩余时间', `${risk} / ${(this.sprint.sprintRemainingMs / 1000).toFixed(1)} 秒`),
          make('sprint-fall-stun', '结束摔倒 / 眩晕剩余', `${this.sprint.riskMode === 'FALL_ON_END' ? 'YES' : 'NO'} / ${(this.sprint.stunRemainingMs / 1000).toFixed(1)} 秒`),
          make('rice-count', '大米完成数 / 总进度', `${this.rice.completedCount} / ${ACTIVE_RICE_COUNT} / ${Math.round(ratio * 100)}%`, this.rice.completed ? 'success' : 'normal'),
          make('active-rice', '本局米点', this.rice.states.map(state => state.id).join(', ') || '无', 'normal', this.rice.states.map((state, index) => make(`rice-${index}-${state.id}`, `米点 ${index + 1}`, state.id))),
          make('rice-target', '当前米堆目标', currentRice?.id ?? '无'),
          make('rice-progress', '当前 Rice 进度', `${((currentRice?.progressMs ?? 0) / 1000).toFixed(1)} / ${((currentRice?.maxProgressMs ?? C.rice.maxProgressMs) / 1000).toFixed(1)} 秒`),
          make('rice-remaining-state', '剩余 / 状态', `${(remainingRiceMs / 1000).toFixed(1)} 秒 / ${currentRice ? riceStates[currentRice.interactionState] : '全部完成'}`),
          make('rice-hint', '操作提示', riceHint),
          make('sound-arrow', '声音方向', heard?.direction ?? '无', heard ? 'curious' : 'normal'),
          make('sound-event', '最近声音 / 剩余时间', probe
            ? `${heard ? '可听' : '不可听探针'} ${probe.event.type} / ${(probe.remainingMs / 1000).toFixed(1)} 秒` : '最近声音：无'),
          make('sound-raw', 'Raw Strength', probe?.rawStrength.toFixed(2) ?? '无'),
          make('sound-distance', 'Distance Falloff', probe?.distanceFactor.toFixed(2) ?? '无'),
          make('sound-occlusion', 'Occlusion Multiplier / 遮挡', probe
            ? `${probe.occlusionMultiplier.toFixed(2)} / ${probe.occlusion}` : '无'),
          make('sound-final', 'Final Audible Strength', probe?.audibleStrength.toFixed(2) ?? '无'),
          make('vision', 'Vision / 阻挡来源', `${sight.status}${blockerLabel ? `（${blockerLabel}）` : ''}`,
            sight.status === 'VISIBLE' ? 'success' : sight.status === 'BLOCKED' ? 'warning' : 'normal'),
          make('last-seen', 'Last Seen', seen
            ? `${point(seen.position)} / ${((this.vision.nowMs - seen.timeMs) / 1000).toFixed(1)} 秒前` : '无'),
          make('trace-window', '米痕生成窗口', `${(this.traces.generationRemainingMs / 1000).toFixed(1)} 秒`),
          make('trace-count', '当前有效脚印', String(this.traces.traces.length)),
        ],
      },
    ];
    this.debugPanel.update(`当前控制对象：${controlledName}`, categories);
  }

  private devBListener(): THREE.Vector3 {
    return this.control.informationObserver === 'HUMAN' ? this.human.position : this.player.position;
  }

  private devBHearing(): DevBObservationInput['hearing'] {
    const observer = this.control.informationObserver;
    if (!observer) return null;
    const listener = this.devBListener();
    const heard = this.sound.heardBy(listener, observer, this.camera, this.perceptionGeometry);
    const probe = heard ?? this.sound.analyzeBy(listener, observer, this.camera,
      this.perceptionGeometry);
    if (!probe) return null;
    return {
      heard: !!heard, type: probe.event.type, audibleStrength: probe.audibleStrength,
      distanceFactor: probe.distanceFactor, occlusionMultiplier: probe.occlusionMultiplier,
      occlusion: probe.occlusion, direction: probe.direction, remainingMs: probe.remainingMs,
    };
  }

  private collectDevBFrame(): DevBViewFrame {
    const observer = this.control.informationObserver ?? 'HUMAN';
    const sight = this.vision.get(observer);
    const heard = this.sound.heardBy(this.devBListener(), observer, this.camera,
      this.perceptionGeometry);
    return {
      captureRadius: this.runtime.captureRadius,
      visionRange: this.runtime.visionRange,
      human: this.human.position,
      deepseek: this.player.position,
      vision: { status: sight.status, visible: sight.visible },
      humanTarget: this.humanAI.target,
      deepseekTarget: this.deepseekAI.safetyDebug.rice ?? null,
      humanPath: this.humanAiWasActive ? this.humanAI.currentPath() : [],
      deepseekPath: this.deepseekAiWasActive ? this.deepseekAI.currentPath() : [],
      sounds: this.sound.events.map(event => ({
        type: event.type, x: event.position.x, z: event.position.z,
        range: this.runtime.soundRange(event.type),
        remainingMs: event.lifetimeMs - (this.sound.nowMs - event.timestamp),
        heard: heard?.event === event,
      })),
      // S7C-2：DEV 只画公开信息 —— AI 已知的米痕线索、AI 推断的方向与锚点、
      // AI 推断出的怀疑家具中心。隐藏者的真实位置与占用状态从不进入这里。
      clues: this.humanAI.clueList().map(clue => ({ ...clue.position })),
      inferenceAnchor: this.humanAI.traceInference.anchor
        ? { ...this.humanAI.traceInference.anchor } : null,
      inferenceDirection: this.humanAI.traceInference.direction
        ? { ...this.humanAI.traceInference.direction } : null,
      suspects: this.humanAI.suspectedSpotIds
        .map(spotId => this.hideSpots.find(spot => spot.id === spotId) ?? null)
        .filter((spot): spot is NonNullable<typeof spot> => !!spot)
        .map(spot => {
          const furniture = this.mapFurniture.find(rect => rect.id === spot.furnitureId);
          return { x: furniture?.x ?? spot.x, z: furniture?.z ?? spot.z };
        }),
    };
  }

  // S7C-2：DEV 只读的「AI 已知 / AI 推断」快照。读它不会推进任何计时，也不会
  // 改变 AI 的目标或路径；这里没有任何隐藏者的真实坐标或藏身占用状态。
  private humanAiHideSearchObservation(): DevBHumanHideSearch {
    return observeHumanHideSearch(this.humanAI, this.traces.nowMs, {
      authoritativeCode: this.humanAiCheckCode, authoritativeDetail: this.humanAiCheckDetail,
      countsAsFormalCheck: this.humanAiCheckCountsAsFormal,
    });
  }

  // Read-only observation: every value below already exists in a system; nothing
  // here advances a timer, repaths an AI or invents a field.
  private collectDevBObservation(): DevBObservationInput {
    const observer = this.control.informationObserver ?? 'HUMAN';
    const sight = this.vision.get(observer);
    const lastSeen = sight.lastSeen;
    const humanProgress = this.humanAI.getPathProgress();
    const deepseekPath = this.deepseekAI.getPathProgress();
    const speeds = effectiveSpeeds(this.runtime);
    return {
      phase: this.match.phase,
      playerFaction: this.control.selectedFaction,
      controlledFaction: this.control.controlledFaction,
      temporaryTarget: this.control.temporaryInputTarget,
      humanAiRunning: this.humanAiWasActive,
      deepseekAiRunning: this.deepseekAiWasActive,
      human: this.human.position,
      deepseek: this.player.position,
      vision: {
        status: sight.status,
        blocker: sight.blocker,
        visible: sight.visible,
        lastSeen: lastSeen ? {
          position: lastSeen.position,
          ageMs: this.vision.nowMs - lastSeen.timeMs,
          remainingMs: C.perception.lastSeenMs - (this.vision.nowMs - lastSeen.timeMs),
        } : null,
      },
      capture: {
        radius: this.runtime.captureRadius,
        distance: distance(this.human.position, this.player.position),
        insideRadius: isInsideCaptureZoneXZ(this.human.position, this.player.position,
          this.runtime.captureRadius),
        blocked: this.captureZoneBlocked,
        eligible: this.captureZoneActive,
        progressMs: this.match.captureProgressMs,
        holdMs: C.match.captureMs,
      },
      hearing: this.devBHearing(),
      sounds: this.sound.events.map(event => ({
        type: event.type, x: event.position.x, z: event.position.z,
        range: this.runtime.soundRange(event.type),
        remainingMs: event.lifetimeMs - (this.sound.nowMs - event.timestamp),
        heard: false,
      })),
      paths: {
        human: this.humanAI.currentPath(),
        deepseek: this.deepseekAI.currentPath(),
      },
      humanAi: {
        state: this.humanAI.state,
        target: this.humanAI.target,
        targetRoomId: this.humanAI.targetRoomId,
        navigationReason: this.humanAI.lastNavigationReason,
        transitionReason: this.humanAI.lastTransitionReason,
        lockDecision: this.humanAI.lockDecision,
        targetDoorId: this.humanAI.targetDoorId,
        decisionReason: this.humanAI.decisionReason,
        unlockProgressMs: this.humanAI.unlockProgressMs,
        searchTargetRoomId: this.humanAI.searchTargetRoomId,
        pathIndex: humanProgress?.index ?? null,
        pathTotal: humanProgress?.total ?? null,
        pathWaypoint: humanProgress?.waypoint ?? null,
        // S7C-2：只读呈现 AI 已知（公开线索）与 AI 推断（由线索算出的结论）。
        hideSearch: this.humanAiHideSearchObservation(),
      },
      deepseekAi: {
        state: this.deepseekAI.state,
        targetRiceId: this.deepseekAI.targetRiceId,
        selectionReason: this.deepseekAI.lastSelectionReason,
        navigationReason: this.deepseekAI.lastNavigationReason,
        transitionReason: this.deepseekAI.lastTransitionReason,
        threatSource: this.deepseekAI.threatSource,
        threatLevel: this.deepseekAI.threatLevel,
        escapeTarget: this.deepseekAI.escapeTarget,
        escapeRoomId: this.deepseekAI.escapeRoomId,
        noMovementReason: this.deepseekAI.noMovementReason,
        sprintDecision: this.deepseekAI.sprintDecision,
        recoveryBlockReason: this.deepseekAI.recoveryBlockReason,
        safeWaitReason: this.deepseekAI.safeWaitReason,
        safeWaitRemainingMs: this.deepseekAI.safeWaitRemainingMs,
        curiosityRemainingMs: this.deepseekAI.curiosityObserveRemainingMs,
        passageActive: this.deepseekAI.passageActive,
        pathIndex: deepseekPath?.index ?? null,
        pathTotal: deepseekPath?.total ?? null,
        pathWaypoint: deepseekPath?.waypoint ?? null,
      },
      sprint: {
        state: this.sprint.state,
        sprintRemainingMs: this.sprint.sprintRemainingMs,
        stunRemainingMs: this.sprint.stunRemainingMs,
        cooldownRemainingMs: this.sprint.cooldownRemainingMs,
        riskMode: this.sprint.riskMode ?? '无',
      },
      rice: {
        completedCount: this.rice.completedCount,
        total: ACTIVE_RICE_COUNT,
        ratio: this.rice.progressRatio,
        targetId: this.rice.activeId,
      },
      movement: {
        playerSpeed: speeds.player,
        humanSpeed: speeds.human,
        humanAiSpeed: speeds.humanAi,
      },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.devBBinding?.stop();
    this.audio.dispose();
    this.menuSettings.dispose();
    this.audioSettings.dispose();
    this.feedback.dispose();
    this.throwableView.dispose();
    this.captureNetView.dispose();
    const container = this.renderer.domElement.parentElement;
    container?.removeEventListener('pointerdown', this.onAudioGesture);
    container?.removeEventListener('pointerover', this.onAudioHover);
    container?.removeEventListener('click', this.onAudioClick);
    window.removeEventListener('keydown', this.onAudioGesture);
    window.removeEventListener('blur', this.onAudioFocus);
    window.removeEventListener('focus', this.onAudioFocus);
    document.removeEventListener('visibilitychange', this.onAudioFocus);
    this.actorShadows.dispose();
    this.roomLightView.dispose();
    this.apartment.dispose();
    this.safetyPaths?.dispose();
    for (const view of this.riceViews.values()) {
      view.object.removeFromParent();
      view.dispose();
    }
    this.riceViews.clear();
    this.alphaHud.dispose();
    this.pulseLockView.dispose();
    this.playerAction.dispose();
    this.humanAction.dispose();
    this.devBDebug?.dispose();
    this.hideSearchView.dispose();
    this.renderer.domElement.removeEventListener('click', this.onActorClick);
    window.removeEventListener('resize', this.resize);
    this.sceneEditor?.dispose();
    this.input.dispose();
    this.captureZone.dispose();
    this.soundVisual?.dispose();
    this.clearTraceViews();
    for (const view of this.doorViews.values()) view.dispose();
    this.doorViews.clear();
    for (const actor of [this.player, this.human]) {
      actor.geometry.dispose();
      (actor.material as THREE.Material).dispose();
    }
    for (const child of this.scene.children) {
      if (child instanceof THREE.DirectionalLight) child.dispose();
    }
    this.scene.clear();
    this.overlay.remove(); this.menu.remove(); this.skillHud.remove();
    this.debugPanel?.root.remove();
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }
}
