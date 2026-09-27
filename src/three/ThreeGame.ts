import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import { GameStateSystem } from '../systems/GameStateSystem';
import { RiceField } from '../systems/RiceField';
import { SprintSystem } from '../systems/SprintSystem';
import { DoorSystem, doorIntersectsActor, distanceToDoorSegment, lockDoorFromCommand,
  type DoorActionResult, type NearbyDoor } from '../systems/DoorSystem';
import { HumanDoorSkill } from '../systems/HumanDoorSkill';
import { MinesweeperLockSystem, type MineEntry } from '../systems/MinesweeperLockSystem';
import { PerceptionGeometry, RiceTraceSystem, SoundEventSystem, VisionSystem,
  type SoundType } from '../systems/PerceptionSystem';
import { RuntimeDebugOverrides, type RuntimeParamChange }
  from '../systems/RuntimeDebugOverrides';
import { DevBRuntimeBinding, effectiveSpeeds } from '../systems/DevBRuntimeBinding';
import type { DevBHumanHideSearch, DevBObservationInput } from '../systems/DevBObserver';
import { DevBDebug } from './DevBDebug';
import type { DevBViewFrame } from './DevBView';
import { HUMAN_CLUE_DEFER_TEXT, HumanAIController, humanAiMovementSpeed,
  shouldRunHumanAI, type HumanAIMapSnapshot, type HumanCheckHidePhase }
  from '../systems/HumanAIController';
import { DeepSeekAIController, isHumanPursuitSound, shouldRunDeepSeekAI,
  type DeepSeekAICommand } from '../systems/DeepSeekAIController';
import { AILogCollector } from '../systems/AILogCollector';
import { HideSystem, type HideExitReason } from '../systems/HideSystem';
import { SkillCooldown } from '../systems/SkillCooldown';
import { deepseekLockGate, lockArmsPlayerCooldown, resolveQSkill }
  from '../systems/SkillGates';
import { resolveInteractionIntent } from '../systems/HideInteractionArbitration';
import { nextDeepSeekVisualHeading, resolveDeepSeekVisualTarget, type DeepSeekVisualTarget }
  from '../systems/DeepSeekVisualTarget';
import { HUMAN_SEARCH_CODE_TEXT, directionToHeadingRad, evaluateHumanSearch,
  probeExposedFanTarget, wrapToPi, type ExposedFanProbe, type HumanSearchTarget }
  from '../systems/HumanSearchSkill';
import { createHumanAiMapSnapshot, resolveHumanAiHideCheck,
  resolveHumanFurnitureSearch, HUMAN_HIDE_CHECK_CODE_TEXT,
  HUMAN_FURNITURE_SEARCH_CODE_TEXT, type HumanFurnitureSearchCode }
  from '../systems/HumanHideSearchResolution';
import { resolveHideInteractionTarget, resolvePlayerQPlan, HIDE_TARGET_CODE_TEXT,
  type HideTargetCandidate, type HideTargetPointing, type HideTargetResolution,
  type PlayerQPlanReason } from '../systems/HideTargetResolution';
import { selectVisibleTraces } from '../systems/RiceTraceClues';
import { HideSearchView } from './HideSearchView';
import { type HideRegionWorld } from './map/HideInteractionRegion';
import { precheckMapApplication } from './map/MapApplicationPrecheck';
import { AISafetyPathView } from './AISafetyPathView';
import { HumanStillness } from '../systems/HumanStillness';
import { resolveCharacterAction } from '../systems/CharacterAction';
import { NavigationSystem } from '../systems/NavigationSystem';
import { CollisionWorld, canInteractWithDoorXZ } from './CollisionWorld';
import { DoorView } from './DoorView';
import { CharacterActionView } from './CharacterActionView';
import { DebugDetailsPanel, escapeCandidateProperties,
  type DebugCategory, type DebugProperty } from './DebugDetailsPanel';
import { InputManager } from './InputManager';
import { RiceView } from './RiceView';
import { createRiceTraceView, syncRiceTraceView } from './RiceTraceView';
import { SoundVisualView } from './SoundVisualView';
import { resolveDirectControlSwitch, resolveRoundShortcut } from './RoundShortcuts';
import { CaptureZoneView, isCaptureEligibleXZ, isInsideCaptureZoneXZ } from './CaptureZone';
import { cameraRelativeDirection, positionCameraOnTarget } from './CameraRelativeMovement';
import { LocalControl, pickActorFaction, type Faction } from './LocalControl';
import { buildApartment, type ApartmentBuild } from './map/MapBuilder';
import { SceneEditor, type CommittedMap } from './SceneEditor';
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

export class ThreeGame {
  private readonly runtime = new RuntimeDebugOverrides();
  private scene = new THREE.Scene();
  private safetyPaths = new AISafetyPathView(this.scene, () => this.runtime.captureRadius);
  private camera = new THREE.OrthographicCamera();
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private clock = new THREE.Clock();
  private input = new InputManager();
  private control = new LocalControl();
  private readonly cameraOffset = new THREE.Vector3(12, 14, 12);
  private match = new GameStateSystem(C.match.readyMs, C.match.captureMs, 'FACTION_SELECT');
  private rice = new RiceField([], C.rice.maxProgressMs, C.rice.prepareMs);
  private sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold, C.sprint.stunMs,
    C.sprint.cooldownMs);
  private player: THREE.Mesh;
  private human: THREE.Mesh;
  private playerAction: CharacterActionView;
  private humanAction: CharacterActionView;
  private captureZone: CaptureZoneView;
  private captureZoneActive = false;
  private captureZoneBlocked = false;
  private riceViews = new Map<string, RiceView>();
  private doorSystem = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  private humanDoorSkill = new HumanDoorSkill(
    this.doorSystem, C.door.humanForceBreakCooldownMs);
  private minesweeper = new MinesweeperLockSystem(
    this.doorSystem, C.pulseLock.rows, C.pulseLock.cols, C.pulseLock.mines);
  private doorViews = new Map<string, DoorView>();
  private sound = new SoundEventSystem(this.runtime);
  private soundVisual: SoundVisualView;
  private traces = new RiceTraceSystem();
  private vision = new VisionSystem(this.runtime);
  private perceptionGeometry = new PerceptionGeometry(WALLS, DOOR_NODES,
    () => this.doorSystem.doors, this.runtime);
  private traceViews = new Map<string, THREE.Group>();
  private lastStepMs: Record<Faction, number> = { HUMAN: -Infinity, DEEPSEEK: -Infinity };
  private lastRiceSoundMs = -Infinity;
  private doorStatusMessage = '';
  private mineFailureRemainingMs = 0;
  private collision: CollisionWorld;
  private apartment: ApartmentBuild;
  private readonly devFreeze = new DevFreezeSystem();
  private sceneEditor: SceneEditor;
  private readonly editorFocus = new THREE.Vector3();
  private editorOpenLast = false;
  private devZoom = 1;
  private humanAI: HumanAIController;
  private humanAiWasActive = false;
  private deepseekAI: DeepSeekAIController;
  private humanStillness: HumanStillness;
  private deepseekAiWasActive = false;
  private aiLogCollector = new AILogCollector();
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
  private furnitureSearchSpotId: string | null = null;
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
  private debugPanel: DebugDetailsPanel;
  private devBDebug: DevBDebug;
  private devBBinding: DevBRuntimeBinding;
  private overlay: HTMLElement;
  private overlayText: HTMLElement;
  private pauseActions: HTMLElement;
  private resultActions: HTMLElement;
  private menu: HTMLElement;
  private minePanel: HTMLElement;
  private mineTitle: HTMLElement;
  private mineGrid: HTMLElement;
  private frame = 0;
  private readonly debugPossessionEnabled = import.meta.env.DEV && C.development.factionSwitchEnabled;

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(C.backgroundColor);
    this.soundVisual = new SoundVisualView(this.scene);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    container.append(this.renderer.domElement);
    this.scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(4, 9, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -MAP_WIDTH / 2;
    light.shadow.camera.right = MAP_WIDTH / 2;
    light.shadow.camera.bottom = -MAP_DEPTH / 2;
    light.shadow.camera.top = MAP_DEPTH / 2;
    this.scene.add(light);

    this.apartment = buildApartment(this.scene);
    this.collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, this.apartment.obstacles,
      this.apartment.orientedObstacles);
    this.navigation = new NavigationSystem(this.collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
    this.humanAI = new HumanAIController(this.navigation, ROOMS, DOOR_NODES, Math.random,
      this.humanAiMapSnapshot());
    this.deepseekAI = new DeepSeekAIController(this.navigation, DOOR_NODES, ROOMS);
    // DEV-B: both AI controllers read the same effective values the panel edits.
    this.humanAI.setRuntimeTuning(this.runtime);
    this.deepseekAI.setRuntimeTuning(this.runtime);
    this.humanStillness = new HumanStillness(SPAWNS.human);
    DOOR_NODES.forEach((door, index) => {
      const view = new DoorView(door, index, DEBUG_MAP);
      this.scene.add(view.object);
      this.doorViews.set(door.id, view);
    });
    this.syncAllDoors();
    const actorWidth = C.player.size / U, actorHeight = C.three.actorHeight;
    this.player = this.box(actorWidth, actorHeight, actorWidth, C.player.color,
      SPAWNS.deepseek.x, actorHeight / 2, SPAWNS.deepseek.z);
    this.human = this.box(actorWidth, actorHeight, actorWidth, C.human.color,
      SPAWNS.human.x, actorHeight / 2, SPAWNS.human.z);
    this.playerAction = new CharacterActionView(this.player, 'DEEPSEEK');
    this.humanAction = new CharacterActionView(this.human, 'HUMAN');
    this.captureZone = new CaptureZoneView(this.human, this.runtime.captureRadius, actorHeight);
    // A radius change must invalidate progress accumulated under the old radius.
    this.devBBinding = new DevBRuntimeBinding(this.runtime, {
      gameState: this.match,
      onCaptureRadius: radius => this.captureZone.setRadius(radius),
    });
    this.devBBinding.start();
    this.resetRice();
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);
    window.addEventListener('resize', this.resize);
    this.resize();

    this.debugPanel = new DebugDetailsPanel(container, {
      developerMode: import.meta.env.DEV,
      onTemporaryControl: faction => this.setTemporaryInputTarget(faction),
      onExportLog: () => this.exportAILog(),
      onToggleFreeze: () => this.toggleDevFreeze(),
      onSafetyPaths: enabled => {
        this.safetyPaths.enabled = enabled;
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
      onRebuild: map => this.rebuildApartment(map),
      // S7C-1B：新地图必须先通过「两个角色站位 + 藏身出口仍可站立」的预检，
      // 预检失败时编辑器直接拒绝应用，旧地图与旧藏身状态原样保留。
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
      collectObservation: () => this.collectDevBObservation(),
      collectFrame: () => this.collectDevBFrame(),
    });
    if (this.debugPossessionEnabled) {
      this.renderer.domElement.addEventListener('click', this.onActorClick);
    }
    // S7C-1B 技能 HUD：只显示当前控制方自己的状态与冷却，不暴露对手藏身信息。
    this.skillHud = this.label(container, 'skill-hud');
    this.skillHud.hidden = true;
    this.skillHudState = this.label(this.skillHud, 'skill-hud-state');
    this.skillHudNotice = this.label(this.skillHud, 'skill-hud-notice');
    this.overlay = this.label(container, 'game-overlay');
    this.overlayText = this.label(this.overlay, 'overlay-text');
    this.pauseActions = this.label(this.overlay, 'pause-actions');
    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.textContent = '继续游戏';
    continueButton.addEventListener('click', () => this.resumeFromPause());
    const pauseRestartButton = document.createElement('button');
    pauseRestartButton.type = 'button';
    pauseRestartButton.textContent = '重新开始';
    pauseRestartButton.addEventListener('click', () => this.restart());
    const pauseMenuButton = document.createElement('button');
    pauseMenuButton.type = 'button';
    pauseMenuButton.textContent = '返回阵营选择';
    pauseMenuButton.addEventListener('click', () => this.returnToFactionSelect());
    const debugSwitchButton = document.createElement('button');
    debugSwitchButton.type = 'button';
    debugSwitchButton.textContent = '开发调试：切换主控阵营';
    debugSwitchButton.hidden = !this.debugPossessionEnabled;
    debugSwitchButton.addEventListener('click', () => this.switchPrimaryFactionFromPause());
    this.pauseActions.append(
      continueButton, pauseRestartButton, pauseMenuButton, debugSwitchButton);
    this.resultActions = this.label(this.overlay, 'result-actions');
    const restartButton = document.createElement('button');
    restartButton.type = 'button';
    restartButton.textContent = '再来一局';
    restartButton.addEventListener('click', () => this.restart());
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.textContent = '返回阵营选择';
    menuButton.addEventListener('click', () => this.returnToFactionSelect());
    this.resultActions.append(restartButton, menuButton);
    this.menu = this.label(container, 'faction-menu');
    this.menu.innerHTML =
      '<h1>选择阵营</h1>' +
      '<label><input type="radio" name="faction" value="DEEPSEEK" checked> DeepSeek 娘</label>' +
      '<label><input type="radio" name="faction" value="HUMAN"> 人类</label>' +
      '<button type="button">确认阵营</button>';
    this.menu.querySelector('button')!.addEventListener('click', () => {
      const selected = this.menu.querySelector<HTMLInputElement>('input[name="faction"]:checked');
      if (selected) this.chooseFaction(selected.value as Faction);
    });
    this.minePanel = this.label(container, 'mine-panel');
    this.mineTitle = this.label(this.minePanel, 'mine-title');
    const closeMineButton = document.createElement('button');
    closeMineButton.type = 'button';
    closeMineButton.className = 'mine-close';
    closeMineButton.setAttribute('aria-label', '关闭扫雷');
    closeMineButton.textContent = '×';
    closeMineButton.addEventListener('click', () => this.closeMinesweeper());
    this.minePanel.append(closeMineButton);
    this.mineGrid = this.label(this.minePanel, 'mine-grid');
    this.mineGrid.addEventListener('click', event => {
      const cell = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
      if (cell) this.mineCellAction(Number(cell.dataset.index), false);
    });
    this.minePanel.addEventListener('contextmenu', event => {
      event.preventDefault();
      const cell = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
      if (cell) this.mineCellAction(Number(cell.dataset.index), true);
    });
    const mineHelp = this.label(this.minePanel, 'mine-help');
    mineHelp.textContent = '左键：翻开｜右键：标记｜Esc / ×：退出';
    this.minePanel.hidden = true;
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

  private chooseFaction(faction: Faction): void {
    if (!this.match.beginFromFactionSelect()) return;
    this.control.choose(faction);
    this.lastDeepseekVisualHeadingRad = null;
    this.deepseekVisualTarget = { kind: 'NONE' };
    this.menu.hidden = true;
    this.input.clear();
    this.resize();
    this.followCamera();
    this.updateHud(this.nearestRice());
  }

  private followCamera(): void {
    const target = this.control.cameraTarget === 'DEEPSEEK' ? this.player
      : this.control.cameraTarget === 'HUMAN' ? this.human : null;
    if (!target) return;
    positionCameraOnTarget(this.camera, target.position, this.cameraOffset);
  }

  private setTemporaryInputTarget(faction: Faction): void {
    if (!this.debugPossessionEnabled || this.match.phase !== 'PLAYING' ||
        this.minesweeper.isOpen || this.sceneEditor.isOpen ||
        !this.control.setTemporaryInputTarget(faction)) return;
    this.input.clear();
    this.lastDeepseekVisualHeadingRad = null;
    this.deepseekVisualTarget = { kind: 'NONE' };
    this.hideSearchView.clearPlayerTarget();
    this.updateHud(this.nearestRice());
    this.updatePerceptionHud();
  }

  private onActorClick = (event: MouseEvent): void => {
    if (!this.debugPossessionEnabled || this.match.phase !== 'PLAYING' ||
        this.minesweeper.isOpen || this.sceneEditor.isOpen || event.button !== 0) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      (event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
    const faction = pickActorFaction(this.camera, pointer, this.player, this.human);
    if (faction) this.setTemporaryInputTarget(faction);
  };

  private box(w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color }));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private resetRice(): void {
    for (const view of this.riceViews.values()) {
      this.scene.remove(view.object);
      view.dispose();
    }
    this.riceViews.clear();
    const selected = selectRiceCandidates();
    this.rice = new RiceField(selected.map(point => point.id),
      C.rice.maxProgressMs, C.rice.prepareMs);
    for (const point of selected) {
      const view = new RiceView(C.rice.size / U, C.rice.color, C.rice.visual);
      view.position.set(point.x, 0, point.z);
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
    const viewHeight = this.match.phase === 'FACTION_SELECT'
      ? MAP_DEPTH + 5 : C.three.viewHeight * this.devZoom;
    const viewWidth = viewHeight * width / height;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private tick = (): void => {
    const deltaMs = Math.min(this.clock.getDelta() * 1000, C.match.maxFrameDeltaMs);
    // DEV 双阵营冻结：the single timing seam. While frozen the gameplay delta is
    // zero, so no system advances and no timer or cooldown can expire during the
    // frozen real time; the clock keeps reading so a resume never jumps.
    const gameplayMs = this.devFreeze.gameplayDelta(this.match.phase, deltaMs);
    const frozen = this.devFreeze.isFrozen;
    this.input.setTabCaptureEnabled(
      C.development.factionSwitchEnabled && C.development.directHotkeysEnabled &&
      this.match.phase === 'PLAYING' && !frozen);
    const pausePressed = this.input.consumePress('Escape');
    const restartPressed = this.input.consumePress('KeyR');
    const menuPressed = this.input.consumePress('KeyM');
    const controlSwitchPressed = this.input.consumePress('Tab');
    const shortcut = resolveRoundShortcut(this.match.phase,
      C.development.directHotkeysEnabled && !this.minesweeper.isOpen && !frozen,
      restartPressed, menuPressed);
    if (shortcut === 'RESTART') {
      this.restart();
    } else if (shortcut === 'FACTION_SELECT') {
      this.returnToFactionSelect();
    } else if (this.match.phase === 'FINISHED') {
      // The finished scene remains frozen until a global shortcut or button is used.
    } else if (this.match.phase !== 'FACTION_SELECT') {
      if (pausePressed) {
        if (this.minesweeper.isOpen) this.closeMinesweeper();
        else this.togglePause();
      }
      if (this.match.phase === 'READY') {
        // The pre-round countdown must keep advancing (see readyDelta): it is a
        // phase timer, not the gameplay delta the DEV freeze is allowed to gate.
        const readyMs = this.devFreeze.readyDelta(deltaMs);
        if (readyMs > 0) this.match.advanceReady(readyMs);
      } else if (this.match.phase === 'PLAYING') {
        if (!frozen && !this.minesweeper.isOpen && C.development.factionSwitchEnabled &&
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
    const editorOpen = this.sceneEditor.isOpen;
    if (editorOpen && !this.editorOpenLast) {
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
      else this.followCamera();
    }
    if (editorOpen) this.sceneEditor.onFrame();
    // DEV-B refresh uses the real frame delta so the debug view keeps working
    // while the gameplay freeze is active; it never advances gameplay itself.
    this.devBDebug.onFrame(deltaMs);
    // The toolbar shows the live freeze state plus the most recent rejected
    // freeze action (for example resuming while the scene editor is open).
    this.debugPanel.setFreezeState(frozen, this.devFreeze.lastRejection === '无'
      ? this.devFreeze.reasonLabel
      : `${this.devFreeze.reasonLabel}｜最近拒绝：${this.devFreeze.lastRejection}`);
    // 玩家当前唯一白色交互轮廓：先同步既有 Human Q，再同步人工 DP 的视觉目标。
    this.syncPlayerFurnitureTarget();
    this.syncDeepSeekVisualTarget();
    this.updateHud(this.nearestRice());
    this.updatePerceptionHud();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  private followEditorCamera(): void {
    positionCameraOnTarget(this.camera, this.editorFocus, this.cameraOffset);
  }

  private zoomEditorCamera(direction: number): void {
    if (!this.sceneEditor.isOpen) return;
    const factor = direction > 0 ? 1.15 : 1 / 1.15;
    this.devZoom = Math.min(2.5, Math.max(0.45, this.devZoom * factor));
    this.resize();
  }

  private panEditorCamera(deltaX: number, deltaY: number): void {
    if (!this.sceneEditor.isOpen) return;
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
    const seconds = Math.floor(this.match.elapsedMs / 1000);
    const summary = `对局中 ${String(Math.floor(seconds / 60)).padStart(2, '0')}:` +
      `${String(seconds % 60).padStart(2, '0')}｜米 ${this.rice.completedCount}/${ACTIVE_RICE_COUNT}｜` +
      `抓捕 ${(this.match.captureProgressMs / 1000).toFixed(2)}`;
    if (this.devFreeze.manualFreeze(this.match.phase, summary)) this.input.clear();
  }

  // Safe rebuild: the edited map replaces the static collision world and the
  // navigation grid, every AI drops its cached path, and the door dynamic
  // obstacles are re-registered on the new world.
  private rebuildApartment(map: CommittedMap): ApartmentBuild {
    this.apartment.dispose();
    this.apartment = buildApartment(this.scene, {
      furniture: map.furniture, hideSpots: map.hideSpots });
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
      this.appliedMapSignature = signature;
      this.releaseHide('MAP_APPLIED');
      this.deepseekVisualTarget = { kind: 'NONE' };
      this.hideSearchView.clearPlayerTarget();
    }
    // S7C-2：AI 的公开地图数据、站位可行性、失败冷却与线索记忆都绑在旧几何上，
    // 必须跟着新地图一起更新，绝不能继续前往被删除或移动过的旧家具位置。
    this.humanAI.rebindMap(this.humanAiMapSnapshot(), changed);
    this.syncAllDoors();
    return this.apartment;
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

  private updatePlaying(deltaMs: number): void {
    this.sound.advance(deltaMs);
    // S7C-1B：两个 Q 技能的冷却与扇形特效都跑在正式玩法时间上，所以暂停与 DEV
    // 冻结期间不会推进；藏身事件每帧收集，供 DEV 面板与 AI JSON 使用。
    this.humanSearchCooldown.advance(deltaMs);
    this.deepseekLockCooldown.advance(deltaMs);
    this.hideSearchView.advance(deltaMs);
    // 藏身事件无论 DeepSeek AI 是否在跑都要进日志时间线；冷却与特效都只随正式
    // 玩法时间推进（上面的 advance 调用）。
    this.aiLogCollector.recordHideEvents(this.hide.drainEvents());
    // S7C-2：Human AI 的循迹 / 搜查事件同样进 AI JSON，且与 DeepSeek AI 是否在跑无关。
    this.aiLogCollector.recordHumanSearchEvents(this.humanAI.drainHumanSearchEvents());
    if (this.hideNoticeRemainingMs > 0) {
      this.hideNoticeRemainingMs = Math.max(0, this.hideNoticeRemainingMs - deltaMs);
      if (this.hideNoticeRemainingMs === 0) this.hideNotice = '';
    }
    this.traces.advance(deltaMs);
    this.vision.update(deltaMs, this.human.position, this.player.position,
      this.perceptionGeometry);
    this.humanStillness.update(this.human.position, deltaMs);
    this.humanDoorSkill.advance(deltaMs, this.match.phase);
    if (this.mineFailureRemainingMs > 0) {
      this.mineFailureRemainingMs = Math.max(0, this.mineFailureRemainingMs - deltaMs);
      if (this.mineFailureRemainingMs === 0 &&
          this.doorStatusMessage === '破解失败：踩雷；再次按 E 生成新盘') {
        this.doorStatusMessage = '';
      }
    }
    const local = cameraRelativeDirection(this.camera, this.input.localDirection());
    const debug = cameraRelativeDirection(this.camera, this.input.debugDirection());
    const { deepseek: direction, human: humanDirection } = this.control.directions(local, debug);
    const doorInteraction = this.handleDoorInteractions();
    // 藏身状态可能在本帧刚刚切换（E 进入/退出、Q 搜查命中），因此门交互之后立刻
    // 同步感知与表现，再让移动、进食与抓捕读取同一个状态。
    const concealedDeepseek = this.hide.isConcealed('DEEPSEEK');
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
    this.aiLogCollector.advance(deltaMs, this.match.phase === 'PLAYING');
    if (deepseekAiEnabled) {
      if (!this.deepseekAiWasActive) this.deepseekAI.resumeAfterManualControl();
      const sight = this.vision.get('DEEPSEEK');
      const heardHuman = this.sound.heardBy(this.player.position, 'DEEPSEEK',
        this.camera, this.perceptionGeometry);
      const heardHumanDanger = this.sound.heardBy(this.player.position, 'DEEPSEEK',
        this.camera, this.perceptionGeometry,
        event => isHumanPursuitSound(event.type));
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
      });
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
      }
      const dsRoom = roomAt(this.player.position.x, this.player.position.z);
      this.aiLogCollector.diffSnapshot({
        doorEscapeEvents: this.deepseekAI.drainDoorEscapeEvents(),
        doorLockEvents: this.deepseekAI.drainDoorLockEvents(),
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
      });
    }
    this.deepseekAiWasActive = deepseekAiEnabled;
    const activeDeepseekDirection = deepseekCommand
      ? { x: deepseekCommand.direction.x, y: deepseekCommand.direction.z } : direction;
    if (deepseekCommand?.startSprint && !concealedDeepseek) {
      this.sprint.tryStart(activeDeepseekDirection, ratio,
        `AI_${this.deepseekAI.sprintDecision}`);
    }
    if (this.input.consumePress('Space')) {
      if (this.control.isControlling('DEEPSEEK') && !concealedDeepseek) {
        this.sprint.tryStart(direction, ratio, 'PLAYER_SPACE');
      } else if (this.control.isControlling('HUMAN') && !this.minesweeper.isOpen) {
        const nearby = this.nearestInteractableDoor(this.human.position);
        if (nearby) {
          const result = this.humanDoorSkill.use(
            nearby.door.id, 'HUMAN', this.match.phase);
          if (result !== 'INVALID_STATE') {
            if (result === 'COOLDOWN') {
              this.doorStatusMessage = '强制破锁冷却中；普通门仍可快速打开';
            } else {
              this.applyDoorResult(nearby.door.id, result);
            }
          }
        }
      }
    }
    const previousSprintState = this.sprint.state;
    this.sprint.advance(deltaMs, activeDeepseekDirection);
    if (previousSprintState !== 'STUNNED' && this.sprint.state === 'STUNNED') {
      this.sound.emit('FALL', this.player.position, 'DEEPSEEK');
    }
    // 藏身中禁止移动（与 STUNNED 同构：位移强制为 0，不新增物理特性）。
    const movement = concealedDeepseek
      ? { x: 0, y: 0 } : this.sprint.movementDirection(activeDeepseekDirection);
    const speed = effectiveSpeeds(this.runtime).player / U *
      (this.sprint.state === 'SPRINT_RUNNING' ? C.sprint.speedMultiplier : 1);
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
    const aiCanAct = aiEnabled && !doorInteraction.humanMovementLocked;
    let aiHumanDirection: { x: number; y: number } | null = null;
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
      if (command.forceBreakDoorId) {
        const result = this.humanDoorSkill.use(command.forceBreakDoorId,
          'HUMAN', this.match.phase);
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
      aiHumanDirection = { x: command.direction.x, y: command.direction.z };
    }
    this.humanAiWasActive = aiCanAct;
    // S7C-2 修复轮 五：AI 搜查的可见反馈跟随 AI 自己公开的搜查状态（不参与判定）。
    this.syncHumanAiSearchFeedback(aiCanAct);
    const baseHumanSpeed = effectiveSpeeds(this.runtime).human / U;
    const humanSpeed = aiHumanDirection
      ? humanAiMovementSpeed(baseHumanSpeed, this.runtime.humanAIMovementMultiplier)
      : baseHumanSpeed;
    const activeHumanDirection = doorInteraction.humanMovementLocked
      ? { x: 0, y: 0 } : aiHumanDirection ?? humanDirection;
    const oldHuman = this.human.position.clone();
    this.move(this.human, activeHumanDirection.x * humanSpeed * deltaMs / 1000,
      activeHumanDirection.y * humanSpeed * deltaMs / 1000);
    this.humanStillness.update(this.human.position, 0);
    this.emitMovementSound('HUMAN', oldHuman, this.human.position, false);
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
      deepseekCommand ? aiInRange && this.sprint.state === 'NORMAL' &&
        activeDeepseekDirection.x === 0 && activeDeepseekDirection.y === 0 :
      this.control.isControlling('DEEPSEEK') && !concealedDeepseek &&
      this.sprint.state === 'NORMAL' && this.input.isHeld('KeyE') &&
      !doorInteraction.doorOwnsInteraction && !doorInteraction.hideOwnsInteraction &&
      inRange && direction.x === 0 && direction.y === 0);
    for (const portion of this.rice.portions) {
      this.riceViews.get(portion.rice.id)!.sync(portion.rice);
      const position = this.riceViews.get(portion.rice.id)!.position;
      this.traces.recordProgress(portion.rice.id, this.player.position,
        previousRice.get(portion.rice.id) ?? 0, portion.rice.progressMs);
      if (portion.rice.progressMs > (previousRice.get(portion.rice.id) ?? 0) &&
          this.sound.nowMs - this.lastRiceSoundMs >= C.perception.riceSoundIntervalMs) {
        this.sound.emit('RICE_EAT', position, 'DEEPSEEK');
        this.lastRiceSoundMs = this.sound.nowMs;
      }
    }
    this.syncTraceViews();
    this.vision.update(0, this.human.position, this.player.position,
      this.perceptionGeometry);
    const insideCaptureRadius = isInsideCaptureZoneXZ(
      this.human.position, this.player.position, this.runtime.captureRadius);
    // 藏身中普通抓捕无效：资格直接判为 false，既有的 advancePlaying 会把累计
    // 进度归零，因此不需要第二套抓捕规则。
    this.captureZoneBlocked = !concealedDeepseek && insideCaptureRadius &&
      this.collision.isLineBlockedXZ(this.human.position, this.player.position);
    this.captureZoneActive = !concealedDeepseek && isCaptureEligibleXZ(
      this.human.position, this.player.position, this.runtime.captureRadius, this.captureZoneBlocked);
    this.match.advancePlaying(deltaMs, this.captureZoneActive, this.rice.completed);
    this.captureZone.setProgress(
      this.match.captureProgressMs, C.match.captureMs, this.captureZoneActive);
    if (this.match.result) {
      this.rice.interrupt();
      this.closeMinesweeper();
      this.releaseHide('ROUND_FINISHED');
      // S7C-2 修复轮 二：本帧的正式搜查很可能就是分出胜负的那一次（家具搜查命中
      // 会立即 forceCapture）。局终之后 `updatePlaying` 不再运行，如果不在这里
      // 再冲一次时间线，REQUEST / RESOLVE / HIT 与这次 HIDE_EXIT 就永远不会写进
      // AI JSON——真实日志里就会出现「有 DWELL 却没有结算码」的断点。
      this.aiLogCollector.recordHideEvents(this.hide.drainEvents());
      this.aiLogCollector.recordHumanSearchEvents(this.humanAI.drainHumanSearchEvents());
    }
    // The action layer observes resolved gameplay; it never feeds back into movement or rules.
    const playerMoved = distance(oldDeepseek, this.player.position) > C.collision.contactEpsilon;
    const humanMoved = distance(oldHuman, this.human.position) > C.collision.contactEpsilon;
    const riceState = this.rice.activeId ? this.rice.get(this.rice.activeId)?.rice.interactionState : null;
    this.playerAction.update(resolveCharacterAction({
      moving: playerMoved,
      running: this.sprint.state === 'SPRINT_RUNNING',
      falling: previousSprintState !== 'STUNNED' && this.sprint.state === 'STUNNED',
      stunned: this.sprint.state === 'STUNNED',
      eating: riceState === 'PREPARING' || riceState === 'EATING',
      startled: this.match.captureProgressMs > 0,
      curiosityPeek: deepseekAiEnabled && this.deepseekAI.state === 'CURIOUS_OBSERVE' &&
        this.deepseekAI.curiosityObserveRemainingMs > C.deepseekAI.curiosityObserveMs / 2,
      curiosityLook: deepseekAiEnabled && this.deepseekAI.state === 'CURIOUS_OBSERVE' &&
        this.deepseekAI.curiosityObserveRemainingMs <= C.deepseekAI.curiosityObserveMs / 2,
      interacting: this.control.isControlling('DEEPSEEK') &&
        (this.input.isHeld('KeyQ') || this.input.isHeld('KeyE')) &&
        !!this.nearestInteractableDoor(this.player.position),
    }), deltaMs);
    this.humanAction.update(resolveCharacterAction({
      moving: humanMoved,
      running: humanMoved && aiEnabled && this.humanAI.state === 'CHASE',
      capturing: this.captureZoneActive,
      // S7C-2 修复轮 五：正式搜查停留期间让 Human 走既有的 INTERACT 动作，
      // 配合橙色扇形与家具轮廓，玩家能辨认「它正在检查这件家具」。纯表现，
      // 不参与命中判定，也不触发玩家 Q 的冷却。
      interacting: (aiEnabled && this.humanAI.unlockProgressMs > 0) ||
        (aiEnabled && this.humanAI.checkHidePhase === 'DWELL') ||
        this.minesweeper.isOpen || (this.control.isControlling('HUMAN') &&
        this.input.isHeld('KeyE') && !!this.nearestInteractableDoor(this.human.position)),
    }), deltaMs);
  }

  private handleDoorInteractions(): {
    doorOwnsInteraction: boolean;
    hideOwnsInteraction: boolean;
    humanMovementLocked: boolean;
  } {
    const faction = this.control.controlledFaction;
    const actor = this.control.controlled(this.player, this.human);
    if (!faction || !actor) {
      this.input.consumePress('KeyE');
      this.input.consumePress('KeyQ');
      return { doorOwnsInteraction: false, hideOwnsInteraction: false,
        humanMovementLocked: false };
    }
    if (this.minesweeper.isOpen) {
      this.input.consumePress('KeyE');
      this.input.consumePress('KeyQ');
      return { doorOwnsInteraction: true, hideOwnsInteraction: false,
        humanMovementLocked: true };
    }
    const nearby = this.nearestInteractableDoor(actor.position);
    const rice = faction === 'DEEPSEEK' ? this.nearestRice() : null;
    // Q 是按阵营区分的技能：DeepSeek 锁门（成功才开始 20 秒冷却），Human 扇形搜查。
    if (this.input.consumePress('KeyQ')) this.useSkillQ(faction, actor, nearby);
    const concealed = this.hide.isConcealed(faction);
    const hideCandidate = faction === 'DEEPSEEK' && !concealed && this.match.phase === 'PLAYING'
      ? this.nearestHideCandidate(actor.position) : null;
    // E 只在这里仲裁一次：整局只会执行下面其中一个分支，不存在一次按键触发多种行为。
    const intent = resolveInteractionIntent({
      minesweeperOpen: false,
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
        if (this.minesweeper.open(nearby.door.id, faction, this.match.phase)) {
          this.doorStatusMessage = '扫雷锁已打开：Human 暴露';
          this.renderMinesweeper();
        }
      } else if (intent === 'DOOR' && nearby) {
        const canClose = nearby.door.state !== 'OPEN' || this.canCloseDoor(nearby.definition.id);
        const result = this.doorSystem.toggle(nearby.door.id, faction, canClose);
        this.applyDoorResult(nearby.door.id, result);
      } else if (intent === 'HIDE_ENTER') {
        this.enterHide(actor.position, hideCandidate);
      } else if (intent === 'HIDE_EXIT') {
        this.exitHide();
      }
    }
    return { doorOwnsInteraction, hideOwnsInteraction,
      humanMovementLocked: this.minesweeper.movementLocked };
  }

  // S7C-1B：Q 技能按阵营分流（本轮仅人工控制的角色会走到这里）。
  private useSkillQ(faction: Faction, actor: THREE.Mesh, nearby: NearbyDoor | null): void {
    const skill = resolveQSkill(faction);
    if (skill === 'LOCK_DOOR') {
      const gate = deepseekLockGate({
        concealed: this.hide.isConcealed('DEEPSEEK'),
        ready: this.deepseekLockCooldown.ready,
        remainingSeconds: this.deepseekLockCooldown.remainingSeconds,
      });
      if (!gate.ok) {
        this.setHideNotice(gate.message ?? '锁门被拒绝');
        return;
      }
      const result = nearby ? this.doorSystem.lock(nearby.door.id, faction) : 'NOT_FOUND';
      this.applyDoorResult(nearby?.door.id ?? null, result);
      if (lockArmsPlayerCooldown(result)) this.deepseekLockCooldown.arm();
      return;
    }
    if (skill !== 'FAN_SEARCH') return;
    // S7C-2 修复轮 三：Human 玩家 Q 的唯一输入优先级（用户本轮批准的 ①→②→③→④）：
    //   ① 12 秒冷却中 → 直接拒绝（不搜查、不抓捕、不产生新冷却）；
    //   ② 当帧有**合法暴露目标** → 原有普通扇形抓捕（即使正站在家具交互区域内、
    //      并正对着家具，也绝不改为家具搜查）；
    //   ③ 否则当帧有**合法 + 被指向**的家具 → 只搜查这件家具；
    //   ④ 否则 → 原有普通扇形空挥。
    // 三条输入全部来自**按键当帧**重新解析，绝不复用上一帧的高亮目标，因此不存在
    // 「UI 高亮 A 家具、技能层搜 B 家具」，也不会出现「有暴露目标却提示可以搜家具」。
    const pressResolution = this.playerQTargetResolution(actor.position);
    const exposed = this.probeExposedTarget();
    const plan = resolvePlayerQPlan({
      cooldownReady: this.humanSearchCooldown.ready,
      remainingSeconds: this.humanSearchCooldown.remainingSeconds,
      exposedTargetAvailable: exposed.available,
      furnitureTarget: pressResolution.pointedLegalTarget,
    });
    this.lastPlayerQPlanReason = plan.reason;
    if (plan.kind === 'REJECT_COOLDOWN') {
      this.setHideNotice(plan.message ?? '搜查被拒绝');
      return;
    }
    // 有效释放（对局中且不在冷却）就先开始计时：扇形命中、家具搜查、合法搜空与
    // 普通扇形空挥同样消耗这 12 秒冷却。
    if (plan.armsCooldown) this.humanSearchCooldown.arm();
    if (plan.kind === 'FURNITURE' && pressResolution.pointedLegalTarget &&
        this.performFurnitureSearch(actor.position, pressResolution.pointedLegalTarget)) {
      return;
    }
    // ② 与 ④：都是原有普通扇形，只是原因不同（`reason` 只进 DEV / AI 日志）。
    this.performHumanSearch(actor, plan.reason, exposed);
  }

  /**
   * S7C-2 修复轮 二 / 三：Human 玩家 Q 的**家具交互搜查**。
   *
   * 与 Human AI 共用「指定家具权威占用」这一个小接口，但上游几何是另一套：
   * 玩家只要站在合法交互区域内、并且朝向大致对着这件家具（指向条件选完家具之后
   * 就不再参与判定）即可，家具不必落在 120° 扇形里，也不做 1.5 u 距离判定。
   *
   * 判定顺序（用户本轮批准）：按键当帧解析出的唯一「合法 + 被指向」家具 → ① 该藏身点
   * 与家具仍属于当前已应用地图 → ② 玩家确实位于合法交互区域 → ③ 与家具之间没有墙或
   * 非 OPEN 门叶 → ④ 才读一次权威占用。返回 true 表示这次 Q 已经由家具搜查消费掉
   * （搜中或合法搜空），false 表示没有可用的家具目标，调用方应回退到普通扇形。
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
    this.furnitureSearchSpotId = target.spotId;
    this.furnitureSearchCode = resolution.code;
    this.furnitureSearchDetail = `${HUMAN_FURNITURE_SEARCH_CODE_TEXT[resolution.code]}｜` +
      `家具 ${resolution.furnitureId ?? '无'}｜瞄点 ${pointText(resolution.aimPoint)}｜` +
      `权威占用读取：${resolution.readAuthoritativeSpot ? '是' : '否'}`;
    // DEV 面板「Human Q 搜查：冷却 / 最近判定」也跟上这次家具搜查，避免显示上一次扇形结果。
    this.lastSearchCode = resolution.code;
    this.lastSearchDetail = this.furnitureSearchDetail;
    this.aiLogCollector.recordPlayerSearchEvent({
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
      this.humanSearchTargetKind = 'FURNITURE';
      this.furnitureSearchHitCount++;
      this.showSearchFurnitureFeedback(target.spotId);
      this.releaseHide('SEARCHED');
      this.setHideNotice(`家具搜查命中：已从「${label}」搜出藏身目标并立即抓捕`);
      // 复用 S7C-1B 的同一套正式结算，不新开胜负系统。
      this.match.forceCapture();
      return true;
    }
    if (resolution.code === 'MISS_EMPTY') {
      this.humanSearchTargetKind = 'FURNITURE';
      this.setHideNotice(`家具搜查完成：「${label}」没有人，` +
        `Q 进入 ${(C.humanSearch.cooldownMs / 1000).toFixed(0)} 秒冷却`);
      return true;
    }
    // NOT_LEGAL / PLAN_STALE / NO_TARGET：家具目标在按键当帧已不成立，
    // 按用户规则回退到「原有普通扇形角色抓捕」。
    this.setHideNotice(`家具搜查未执行：${HUMAN_FURNITURE_SEARCH_CODE_TEXT[resolution.code]}`);
    return false;
  }

  // 释放瞬间只做一次命中判定；扇形表现与真实判定共用同一个朝向快照，之后的淡入
  // 淡出不会产生第二次命中。
  //
  // S7C-2 修复轮 三：这里就是「原有普通扇形」的唯一执行点——分支②（有合法暴露目标）
  // 与分支④（无暴露目标也无指向家具，空挥）都走它，因此两条路径的几何完全一致；
  // `reason` 与预检测结果只用于 DEV / AI 日志，绝不改变判定。
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
      target: this.humanSearchTarget(),
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
    this.aiLogCollector.recordPlayerSearchEvent({
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
      this.setHideNotice(`搜查未命中：${HUMAN_SEARCH_CODE_TEXT[result.code]}`);
      return;
    }
    this.humanSearchHitCount++;
    if (result.outcome === 'FLUSH_CONCEALED') {
      this.showSearchFurnitureFeedback(result.spotId);
      this.releaseHide('SEARCHED');
      this.setHideNotice(`搜查命中：已搜出藏身目标（${result.spotId ?? '未知藏身点'}）`);
    } else {
      this.setHideNotice('搜查命中：抓到未藏身的 DeepSeek 娘');
    }
    // 立即抓捕成功走正式结算路径（同一 GameStateSystem，不新开胜负系统）。
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
    }, this.humanSearchCooldown.ready && !exposed.available);
  }

  /** 人工 DP 的唯一白色指向目标；E 的正式判定仍走 handleDoorInteractions()。 */
  private syncDeepSeekVisualTarget(): void {
    const playable = this.match.phase === 'PLAYING' && this.match.result === null &&
      this.control.isControlling('DEEPSEEK') && !this.sceneEditor.isOpen;
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
      minesweeperOpen: this.minesweeper.isOpen,
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
      const realSpotId = this.hide.spotId;
      if (realSpotId) this.showSearchFurnitureFeedback(realSpotId);
      this.releaseHide('SEARCHED');
      // 复用 S7C-1B 的正式结算：同一条抓捕路径、同一套胜负与 UI 结果。
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
    const overlap = Math.hypot(this.human.position.x - this.player.position.x,
      this.human.position.z - this.player.position.z) < C.collision.playerRadius * 2;
    const result = this.hide.exit('PLAYER_E', { humanOverlap: overlap });
    if (result.ok) {
      this.setHideNotice('已退出藏身：普通视觉与抓捕立刻恢复');
    } else {
      this.setHideNotice(result.code === 'HUMAN_BLOCKING'
        ? result.message : `无法退出藏身：${result.message}`);
    }
    this.syncHidePresentation();
  }

  /** 局终、重开、地图应用等强制清空藏身（不做 Human 重叠检查）。 */
  private releaseHide(reason: HideExitReason): void {
    if (this.hide.forcedExit(reason).ok) {
      this.hideCandidateCode = 'NONE';
      this.hideCandidateSpotId = null;
    }
    this.syncHidePresentation();
  }

  private syncHidePresentation(): void {
    this.player.visible = !this.hide.isConcealed('DEEPSEEK');
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
            target.spotId}」｜按 E 藏身（背对仍可 E）`
          : target.kind === 'RICE'
            ? `面向米堆 ${target.riceId}｜停下按住 E 进食`
            : '按 E 藏身 / 停下按住 E 进食（白色轮廓只提示朝向，不限制 E）';
      this.skillHudState.textContent = `DeepSeek 娘：${targetText}｜Q 锁门：${lockText}`;
    } else {
      const target = this.hideTargetSpotId
        ? this.hideSpots.find(spot => spot.id === this.hideTargetSpotId) ?? null : null;
      // S7C-2 修复轮 三：只有「合法 + 被指向 + 当帧没有暴露目标」时，Q 才会搜这件家具。
      // 三者缺一都不能给出「可以搜家具」的提示，否则就是误导性提示（用户本轮红线）。
      if (target && this.hideTargetLegal && !this.hideTargetExposedPriority) {
        this.skillHudState.textContent = this.humanSearchCooldown.ready
          ? `人类：Q 搜查「${target.label}」（面向家具即可，不必精确瞄准）｜Q：可用`
          : `人类：Q 搜查「${target.label}」｜冷却中 ` +
            `${this.humanSearchCooldown.remainingSeconds.toFixed(1)} 秒（家具描边变暗，暂时不能按）`;
      } else {
        this.skillHudState.textContent =
          `人类：Q 扇形搜查（半径 ${C.humanSearch.range}、张角 ` +
          `${C.humanSearch.halfAngleDeg * 2}°）｜Q：${searchText}`;
      }
    }
    this.skillHudNotice.textContent = this.hideNotice;
    this.skillHud.hidden = false;
  }

  private mineCellAction(index: number, flag: boolean): void {
    if (!this.minesweeper.isOpen || this.match.phase !== 'PLAYING') return;
    const doorId = this.minesweeper.openDoorId!;
    const row = Math.floor(index / this.minesweeper.cols);
    const col = index % this.minesweeper.cols;
    const result = flag
      ? this.minesweeper.toggleFlag(row, col, this.match.phase)
      : this.minesweeper.reveal(row, col, this.match.phase);
    if (result === 'UNLOCKED') {
      this.applyDoorResult(doorId, 'UNLOCKED');
    } else if (result === 'FAILED') {
      this.doorStatusMessage = '破解失败：踩雷；再次按 E 生成新盘';
      this.mineFailureRemainingMs = C.pulseLock.failureFeedbackMs;
    }
    this.renderMinesweeper();
    this.updateHud(this.nearestRice());
  }

  private closeMinesweeper(): void {
    this.minesweeper.close();
    this.renderMinesweeper();
    if (this.doorStatusMessage === '扫雷锁已打开：Human 暴露') {
      this.doorStatusMessage = '';
    }
  }

  private renderMinesweeper(): void {
    const doorId = this.minesweeper.openDoorId;
    const board = doorId ? this.minesweeper.get(doorId)?.board : null;
    this.minePanel.hidden = !board;
    if (!board) return;
    this.mineTitle.textContent = `PulseLock / 门锁破解｜${doorId}｜雷：${this.minesweeper.mines}`;
    this.mineGrid.style.setProperty('--mine-cols', String(this.minesweeper.cols));
    this.mineGrid.replaceChildren(...board.cells.map((cell, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.index = String(index);
      button.className = `mine-cell${cell.revealed ? ' revealed' : ''}`;
      button.textContent = cell.revealed
        ? cell.mine ? '✹' : cell.adjacentMineCount ? String(cell.adjacentMineCount) : ''
        : cell.flagged ? '🚩' : '';
      button.setAttribute('aria-label', `第 ${Math.floor(index / this.minesweeper.cols) + 1} 行第 ${index % this.minesweeper.cols + 1} 列`);
      return button;
    }));
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
    if (id && (result === 'OPENED' || result === 'CLOSED' ||
        result === 'LOCKED' || result === 'UNLOCKED' || result === 'FORCE_OPENED')) {
      this.syncDoor(id);
      const soundType: SoundType = result === 'OPENED' ? 'DOOR_OPEN'
        : result === 'CLOSED' ? 'DOOR_CLOSE'
        : result === 'LOCKED' ? 'DOOR_LOCK'
        : result === 'FORCE_OPENED' ? 'FORCE_BREAK' : 'LOCK_BREAK';
      const sourceFaction = result === 'LOCKED' ? 'DEEPSEEK' :
        result === 'FORCE_OPENED' || result === 'UNLOCKED' ? 'HUMAN'
          : actorOverride ?? this.control.controlledFaction;
      const door = this.doorSystem.definition(id);
      if (door && sourceFaction) this.sound.emit(soundType, door, sourceFaction);
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
    mesh.position.copy(this.collision.move(mesh.position, dx, dz,
      C.collision.playerRadius, C.three.actorHeight));
  }

  private togglePause(): void {
    if (this.match.pause()) {
      this.rice.interrupt();
      this.closeMinesweeper();
      // 藏身状态本身在暂停期间保留；只有表现层的扇形特效需要安全清掉。
      this.hideSearchView.reset();
      this.input.clear();
      return;
    }
    this.resumeFromPause();
  }

  private resumeFromPause(): void {
    if (!this.match.resume()) return;
    this.input.clear();
    this.updateHud(this.nearestRice());
  }

  private switchPrimaryFactionFromPause(): void {
    if (this.match.phase !== 'PAUSED' || this.minesweeper.isOpen ||
        !this.debugPossessionEnabled || !this.control.switchPrimaryFaction()) return;
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
    const data = this.aiLogCollector.export();
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

  private restart(): void {
    if (this.match.phase === 'FACTION_SELECT' || this.control.selectedFaction === null) return;
    this.match.reset();
    this.resetRound();
    this.followCamera();
    this.updateHud(this.nearestRice());
  }

  private returnToFactionSelect(): void {
    if (!this.match.returnToFactionSelect()) return;
    this.resetRound();
    this.control.clear();
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);
    this.resize();
    this.menu.querySelector<HTMLInputElement>('input[value="DEEPSEEK"]')!.checked = true;
    this.menu.hidden = false;
    this.updateHud(this.nearestRice());
  }

  private resetRound(): void {
    if (this.sceneEditor.isOpen) this.sceneEditor.close();
    this.devFreeze.reset();
    // A new round/restart clears every temporary DEV-B override.
    this.devBBinding.resetForNewRound();
    this.editorOpenLast = false;
    this.devZoom = 1;
    this.sprint.reset();
    this.control.resetControlled();
    this.resetRice();
    this.doorSystem.reset();
    this.humanDoorSkill.reset();
    this.minesweeper.reset();
    this.renderMinesweeper();
    this.syncAllDoors();
    this.doorStatusMessage = '';
    this.mineFailureRemainingMs = 0;
    this.player.position.set(SPAWNS.deepseek.x, C.three.actorHeight / 2, SPAWNS.deepseek.z);
    this.human.position.set(SPAWNS.human.x, C.three.actorHeight / 2, SPAWNS.human.z);
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
    this.aiLogCollector.startMatch();
    // S7C-1B：藏身状态、两个 Q 冷却与扇形特效都属于本局状态，重开/返回阵营页
    // 必须全部清空，不留下异常抓捕免疫或输入锁定。
    this.hide.reset();
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
    this.furnitureSearchSpotId = null;
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
    const phaseText = phase === 'FACTION_SELECT' ? '选择阵营'
      : phase === 'READY' ? `准备：${Math.ceil(this.match.readyRemainingMs / 1000)} 秒`
      : phase === 'PLAYING' ? '对局中' : phase === 'PAUSED' ? '已暂停' : '已结束';
    const seconds = Math.floor(this.match.elapsedMs / 1000);
    const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if (phase === 'PAUSED') this.overlayText.textContent = '游戏已暂停\n按 Esc 或点击按钮继续';
    else if (phase === 'FINISHED') {
      const result = this.match.result!;
      this.overlayText.textContent =
        `${result.winner === 'DEEPSEEK' ? 'DeepSeek 娘' : '人类'}获胜\n` +
        `原因：${result.reason === 'RICE_COMPLETED' ? `${ACTIVE_RICE_COUNT} 份大米完成` : '抓捕完成'}\n` +
        `对局时间：${time}\n大米：${this.rice.completedCount}/${ACTIVE_RICE_COUNT}`;
    } else this.overlayText.textContent = '';
    this.pauseActions.hidden = phase !== 'PAUSED';
    this.resultActions.hidden = phase !== 'FINISHED';
    this.overlay.hidden = phase !== 'PAUSED' && phase !== 'FINISHED';
    const controlledFaction = this.control.controlledFaction;
    this.debugPanel.setVisible(phase !== 'FACTION_SELECT');
    this.debugPanel.setControlContext(
      this.debugPossessionEnabled && phase === 'PLAYING', controlledFaction);
    this.updateSkillHud();
  }

  private mineHudEntry(): MineEntry | null {
    const actor = this.control.controlled(this.player, this.human);
    if (actor && this.control.isControlling('HUMAN')) {
      const nearby = this.nearestInteractableDoor(actor.position);
      if (nearby) return this.minesweeper.get(nearby.door.id) ?? null;
    }
    return this.minesweeper.entries.find(entry => entry.state === 'OPEN') ?? null;
  }

  private emitMovementSound(faction: Faction, before: THREE.Vector3,
    after: THREE.Vector3, sprinting: boolean): void {
    if (distance(before, after) < C.perception.minimumMovementSoundDistance) return;
    const interval = sprinting ? C.perception.sprintStepIntervalMs : C.perception.footstepIntervalMs;
    if (this.sound.nowMs - this.lastStepMs[faction] < interval) return;
    this.sound.emit(sprinting ? 'SPRINT' : 'FOOTSTEP', after, faction);
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
      this.safetyPaths.update(this.deepseekAI.safetyDebug, this.human.position);
    const faction = this.control.informationObserver;
    if (!faction) {
      this.soundVisual.update(null, null, false, this.sound.nowMs);
      return;
    }
    const listener = faction === 'HUMAN' ? this.human.position : this.player.position;
    const heard = this.sound.heardBy(listener, faction, this.camera, this.perceptionGeometry);
    const probe = heard ?? this.sound.analyzeBy(listener, faction, this.camera, this.perceptionGeometry);
    // Development display also exposes heavily occluded events; production stays audible-only.
    this.soundVisual.update(listener, this.debugPossessionEnabled ? probe : heard,
      this.match.phase !== 'FINISHED', this.sound.nowMs);
    if (!this.debugPanel.isExpanded || this.debugPanel.root.hidden) return;
    const sight = this.vision.get(faction);
    this.updateDebugDetailsPanel(faction, heard, probe, sight);
  }

  private updateDebugDetailsPanel(faction: Faction,
    heard: ReturnType<SoundEventSystem['heardBy']>,
    probe: ReturnType<SoundEventSystem['analyzeBy']>,
    sight: ReturnType<VisionSystem['get']>): void {
    const make = (key: string, label: string, value: string,
      tone: DebugProperty['tone'] = 'normal', children?: DebugProperty[]): DebugProperty =>
      ({ key, label, value, tone, children });
    const stateTone = (state: string): DebugProperty['tone'] =>
      state === 'EVADE' ? 'danger' : state === 'SAFE_WAIT' ? 'warning'
        : state.startsWith('CURIOUS') || state === 'SAFE_BYPASS' ? 'curious'
          : ['COMPLETED', 'DISABLED', 'PASS', 'SUCCESS'].includes(state) ? 'success' : 'normal';
    const point = (value: { x: number; z: number } | null | undefined) => value
      ? `(${value.x.toFixed(1)}, ${value.z.toFixed(1)})` : '无';
    const selectedFaction = this.control.selectedFaction;
    const factionName = selectedFaction === 'DEEPSEEK' ? 'DeepSeek 娘'
      : selectedFaction === 'HUMAN' ? '人类' : '未选择';
    const controlledName = this.control.controlledFaction === 'DEEPSEEK' ? 'DeepSeek 娘'
      : this.control.controlledFaction === 'HUMAN' ? 'Human' : '未选择';
    const phaseName = this.match.phase === 'FACTION_SELECT' ? '选择阵营'
      : this.match.phase === 'READY' ? `准备：${Math.ceil(this.match.readyRemainingMs / 1000)} 秒`
        : this.match.phase === 'PLAYING' ? '对局中'
          : this.match.phase === 'PAUSED' ? '已暂停' : '已结束';
    const seconds = Math.floor(this.match.elapsedMs / 1000);
    const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const ratio = this.rice.progressRatio;
    const risk = this.sprint.state === 'NORMAL'
      ? ratio >= C.sprint.riskThreshold ? 'RISK SPRINT' : 'SAFE SPRINT'
      : this.sprint.riskMode === 'FALL_ON_END' ? 'RISK SPRINT' : 'SAFE SPRINT';
    const mineEntry = this.mineHudEntry();
    const mineDoor = mineEntry ? this.doorSystem.get(mineEntry.doorId) : null;
    const mineStatus = !mineEntry ? '未开始'
      : mineEntry.state === 'DISABLED' ? '锁芯已失效'
        : mineEntry.state === 'FAILED' ? '破解失败，等待新盘'
          : mineEntry.state === 'OPEN' ? '扫雷中：Human 暴露'
            : mineEntry.board ? '盘面已保留' : '未开始';
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
    const humanSight = this.vision.get('HUMAN');
    const humanPath = this.humanAI.getPathProgress();
    const humanActive = shouldRunHumanAI(this.match.phase, this.control.selectedFaction,
      this.control.temporaryInputTarget, this.input.debugDirection(), this.debugPossessionEnabled);
    const humanMode = this.match.phase === 'PAUSED' ? 'PAUSED'
      : this.match.phase === 'READY' ? 'STANDBY' : humanActive ? this.humanAI.state : 'MANUAL';
    const deepseekPath = this.deepseekAI.getPathProgress();
    const deepseekActive = shouldRunDeepSeekAI(this.match.phase, this.control.selectedFaction,
      this.control.temporaryInputTarget, this.input.debugDirection(), this.debugPossessionEnabled);
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
          make('unlock-progress', '解锁进度', `${(this.humanAI.unlockProgressMs / 1000).toFixed(1)} / ${(C.humanAI.aiUnlockDurationMs / 1000).toFixed(1)} 秒`),
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
            `${this.humanAI.checkHideInvestigationChecks}（上限 ${C.humanAI.searchRoomCount}）｜` +
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
          make('hide-vision', '藏身对普通 Vision 的影响',
            `Human 看到的 DeepSeek：${this.vision.get('HUMAN').status}`,
            this.vision.get('HUMAN').status === 'CONCEALED' ? 'curious' : 'normal'),
          make('hide-capture', '常规抓捕资格（藏身中必须不累计）',
            this.captureZoneActive ? '圈内累计中' : '不累计',
            this.captureZoneActive ? 'danger' : 'normal'),
          make('hide-search', 'Human Q 搜查：冷却 / 最近判定',
            `${this.humanSearchCooldown.ready ? '可用'
              : `${this.humanSearchCooldown.remainingSeconds.toFixed(1)} 秒`} / ${this.lastSearchCode}`),
          // S7C-2 修复轮 二 / 三：玩家 Q 的唯一家具交互目标（公开解析结果）与家具搜查结果。
          // 「当前高亮」是**本帧**的公开解析结果，「最近一次 Q」是上一次真正执行的用途。
          make('hide-search-target', 'Human Q 当前高亮 / 最近一次执行',
            `高亮 ${this.hideTargetSpotId ? 'FURNITURE' : 'NONE'}` +
            `（${this.hideTargetSpotId ?? '无'}｜家具 ${this.hideTargetFurnitureId ?? '无'}｜` +
            `合法 ${this.hideTargetLegal ? '是' : '否'}｜指向 ` +
            `${this.hideTargetPointed ? '是' : '否'}` +
            `${Number.isNaN(this.hideTargetPointingDeltaDeg) ? '' :
              ` ${this.hideTargetPointingDeltaDeg.toFixed(1)}°`}` +
            `｜暴露目标优先 ${this.hideTargetExposedPriority ? '是' : '否'}）｜` +
            `最近一次 Q：${this.humanSearchTargetKind}（${this.lastPlayerQPlanReason}）`,
            this.hideTargetSpotId && this.hideTargetLegal &&
              !this.hideTargetExposedPriority ? 'success' : 'normal'),
          make('hide-search-region', '家具交互区域合法性（公开解析）',
            `${this.hideTargetCode}｜${HIDE_TARGET_CODE_TEXT[this.hideTargetCode] ?? '—'}` +
            `｜区域内候选 ${this.hideTargetCandidates} 件`,
            this.hideTargetLegal ? 'success' : 'normal'),
          make('hide-search-furniture', 'Human Q 家具搜查最近结果',
            `${this.furnitureSearchCode}｜${this.furnitureSearchDetail}｜` +
            `家具搜查 ${this.furnitureSearchCount} 次 / 命中 ${this.furnitureSearchHitCount} 次`),
          make('hide-search-detail', 'Human Q 最近结果', this.lastSearchDetail),
          make('hide-search-counts', 'Human Q 释放 / 命中次数',
            `${this.humanSearchCount} / ${this.humanSearchHitCount}`),
          make('hide-search-spot', 'Human Q 最近瞄到的藏身点', this.lastSearchSpotId ?? '无'),
          make('hide-lock-cooldown', 'DeepSeek Q 锁门冷却',
            this.deepseekLockCooldown.ready ? '可用'
              : `${this.deepseekLockCooldown.remainingSeconds.toFixed(1)} 秒`,
            this.deepseekLockCooldown.ready ? 'normal' : 'warning'),
          make('hide-notice', '玩家可见提示', this.hideNotice || '无'),
          make('hide-controls', '藏身操作',
            this.control.isControlling('DEEPSEEK')
              ? '走到藏身点附近点按 E 进入 / 再按 E 退出（藏身中禁止移动、冲刺、进食、锁门）'
              : '控制 Human：面朝方向点按 Q 放出 120° 扇形，命中藏身家具即搜出并抓捕'),
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
          ? this.sceneEditor.statusEntries().map(entry =>
            make(`dev-${entry.label}`, entry.label, entry.value, entry.tone ?? 'normal'))
          : [],
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
            : 'E 开/关或扫雷｜Space 普通门快开 / 锁门强破'),
          make('door-message', '门状态消息', this.doorStatusMessage || '无'),
          make('force-break', '强制破锁', this.humanDoorSkill.cooldownRemainingMs > 0
            ? `CD ${(this.humanDoorSkill.cooldownRemainingMs / 1000).toFixed(1)} 秒` : 'READY',
            this.humanDoorSkill.cooldownRemainingMs > 0 ? 'warning' : 'success'),
          make('lock-core-mines', '锁芯 / 扫雷状态', `${mineDoor?.lockCoreState ?? 'ACTIVE'} / ${mineStatus}`,
            mineDoor?.lockCoreState === 'DISABLED' ? 'success' : 'normal'),
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
    const latestClue = this.humanAI.clueList().slice(-1)[0] ?? null;
    const inference = this.humanAI.traceInference;
    const stance = this.humanAI.checkHideStance;
    const nowMs = this.traces.nowMs;
    const lastSeen = this.humanAI.lastSeenPublic(nowMs);
    const lastSeenPublic = lastSeen as { present?: boolean; valid?: boolean;
      x?: number; z?: number; roomId?: string | null; ageMs?: number };
    const detail = this.humanAI.lastCheckDetail;
    return {
      clueCount: this.humanAI.clueMemory.count(),
      expiredClueCount: this.humanAI.clueMemory.expiredCount,
      latestCluePosition: latestClue ? { ...latestClue.position } : null,
      latestClueAgeMs: latestClue ? nowMs - latestClue.discoveredAt : null,
      inferenceCode: inference.code,
      inferenceConfidence: inference.confidence,
      inferenceHeadingDeg: inference.directionHeadingRad === null ? null
        : inference.directionHeadingRad * 180 / Math.PI,
      inferenceAnchor: inference.anchor ? { ...inference.anchor } : null,
      inferenceBasis: inference.basis.join('；'),
      candidateRanking: this.humanAI.candidateRanking,
      suspectedSpotId: this.humanAI.suspectedSpotIds[0] ?? null,
      suspectedBasis: this.humanAI.candidateBasis.join('；'),
      candidateSkipped: this.humanAI.candidateSkipped,
      // 修复轮 一 / 二：待处理线索与 Last Seen 的公开摘要。
      pendingClueCount: this.humanAI.pendingClueCount,
      pendingClueRemainingMs: Math.max(0,
        this.humanAI.pendingClueValidUntilMs - nowMs),
      pendingClueDeferReason: this.humanAI.pendingClueDeferReason,
      pendingClueDeferCount: this.humanAI.pendingClueDeferCount,
      pendingClueReevalCount: this.humanAI.pendingClueReevalCount,
      lastSeenPresent: lastSeenPublic.present === true,
      lastSeenValid: lastSeenPublic.valid === true,
      lastSeenPosition: lastSeenPublic.present
        ? { x: lastSeenPublic.x ?? 0, z: lastSeenPublic.z ?? 0 } : null,
      lastSeenRoomId: this.humanAI.lastSeenRoomId,
      lastSeenAgeMs: lastSeenPublic.ageMs ?? null,
      lastSeenRoomGateCode: this.humanAI.lastSeenRoomGateCode,
      lastSeenRoomGateDetail: this.humanAI.lastSeenRoomGateDetail,
      // 修复轮 三 / 四 / 六：计数、收尾方式、声音明细与瞄点一致性。
      roundAttempts: this.humanAI.checkHideRoundAttempts,
      attemptedSpotId: this.humanAI.checkHideAttemptedSpotId,
      investigationEndReason: this.humanAI.checkHideInvestigationEndReason,
      interruptSoundType: this.humanAI.lastInterruptSoundType,
      interruptSoundStrength: this.humanAI.lastInterruptSoundStrength,
      interruptSoundRemainingMs: this.humanAI.lastInterruptSoundRemainingMs,
      interruptSoundIsNew: this.humanAI.lastInterruptSoundIsNew,
      checkResult: detail.result,
      checkDetailText: detail.detail,
      plannedSurfacePoint: detail.plannedSurfacePoint,
      finalAimPoint: detail.finalAimPoint,
      aimPointDelta: detail.aimPointDelta,
      aimAngleDeltaDeg: detail.angleDeltaDeg,
      aimBlocked: detail.blocked,
      authoritativeCode: this.humanAiCheckCode,
      authoritativeDetail: this.humanAiCheckDetail,
      phase: this.humanAI.checkHidePhase,
      source: this.humanAI.checkHideSource,
      spotId: this.humanAI.checkHideSpotId,
      stancePoint: stance ? { ...stance.stancePoint } : null,
      surfacePoint: stance ? { ...stance.surfacePoint } : null,
      // 修复轮 二：导航终点 / 正式站位 / REQUEST 实际位置三处一起看，
      // 「为什么判成 STANCE_LOST」不再需要靠猜。
      navGoal: this.humanAI.checkHideNavGoal
        ? { ...this.humanAI.checkHideNavGoal } : null,
      stanceDistance: this.humanAI.checkHideStanceDistance,
      requestPosition: this.humanAI.checkHideRequestPosition
        ? { ...this.humanAI.checkHideRequestPosition } : null,
      approachSteps: this.humanAI.checkHideApproachSteps,
      requestCount: this.humanAI.checkHideRequestCount,
      staleCancels: this.humanAI.checkHideStaleCancels,
      countsAsFormalCheck: this.humanAiCheckCountsAsFormal,
      dwellRemainingMs: this.humanAI.checkHideDwellRemainingMs,
      dwellMs: this.humanAI.checkHideDwellMs,
      roundChecks: this.humanAI.checkHideRoundChecks,
      roundBudget: this.humanAI.checkHideRoundBudget,
      investigationChecks: this.humanAI.checkHideInvestigationChecks,
      checkedSpotIds: [...this.humanAI.checkHideCheckedSpotIds],
      cooldowns: this.humanAI.checkHideCooldowns(),
      lastResult: this.humanAI.checkHideLastResult,
      lastResultSpotId: this.humanAI.checkHideLastResultSpotId,
      giveUpCode: this.humanAI.checkHideGiveUpCode,
      giveUpDetail: this.humanAI.checkHideGiveUpDetail,
      startCount: this.humanAI.checkHideStartCount,
      hitCount: this.humanAI.checkHideHitCount,
      missCount: this.humanAI.checkHideMissCount,
      interruptCount: this.humanAI.checkHideInterruptCount,
    };
  }

  // Read-only observation: every value below already exists in a system; nothing
  // here advances a timer, repaths an AI or invents a field.
  private collectDevBObservation(): DevBObservationInput {    const observer = this.control.informationObserver ?? 'HUMAN';
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
    cancelAnimationFrame(this.frame);
    this.devBDebug.dispose();
    this.hideSearchView.dispose();
    this.renderer.domElement.removeEventListener('click', this.onActorClick);
    window.removeEventListener('resize', this.resize);
    this.sceneEditor.dispose();
    this.input.dispose();
    this.captureZone.dispose();
    this.soundVisual.dispose();
    this.clearTraceViews();
    for (const view of this.doorViews.values()) view.dispose();
    this.renderer.dispose();
  }
}
