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
import { HumanAIController, humanAiMovementSpeed, shouldRunHumanAI }
  from '../systems/HumanAIController';
import { DeepSeekAIController, isHumanPursuitSound, shouldRunDeepSeekAI,
  type DeepSeekAICommand } from '../systems/DeepSeekAIController';
import { AILogCollector } from '../systems/AILogCollector';
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
import { ACTIVE_RICE_COUNT, DEBUG_MAP, DOOR_NODES, MAP_WIDTH, MAP_DEPTH, ROOMS, SPAWNS, WALLS,
  roomAt, selectRiceCandidates } from './map/apartmentMap';

const U = C.three.pixelsPerUnit;
const distance = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

export class ThreeGame {
  private scene = new THREE.Scene();
  private safetyPaths = new AISafetyPathView(this.scene);
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
  private sound = new SoundEventSystem();
  private soundVisual: SoundVisualView;
  private traces = new RiceTraceSystem();
  private vision = new VisionSystem();
  private perceptionGeometry = new PerceptionGeometry(WALLS, DOOR_NODES,
    () => this.doorSystem.doors);
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
  private debugPanel: DebugDetailsPanel;
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
    this.collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, this.apartment.obstacles);
    const navigation = new NavigationSystem(this.collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
    this.humanAI = new HumanAIController(navigation, ROOMS, DOOR_NODES);
    this.deepseekAI = new DeepSeekAIController(navigation, DOOR_NODES, ROOMS);
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
    this.captureZone = new CaptureZoneView(this.human, C.match.captureRadius, actorHeight);
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
      onFocus: point => this.editorFocus.set(point.x, 0, point.z),
      onZoom: direction => this.zoomEditorCamera(direction),
      onPan: (deltaX, deltaY) => this.panEditorCamera(deltaX, deltaY),
    });
    this.sceneEditor.setBuild(this.apartment);
    if (this.debugPossessionEnabled) {
      this.renderer.domElement.addEventListener('click', this.onActorClick);
    }
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
    // The toolbar shows the live freeze state plus the most recent rejected
    // freeze action (for example resuming while the scene editor is open).
    this.debugPanel.setFreezeState(frozen, this.devFreeze.lastRejection === '无'
      ? this.devFreeze.reasonLabel
      : `${this.devFreeze.reasonLabel}｜最近拒绝：${this.devFreeze.lastRejection}`);
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
    this.collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, this.apartment.obstacles);
    const navigation = new NavigationSystem(this.collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
    this.humanAI.rebindNavigation(navigation);
    this.deepseekAI.rebindNavigation(navigation);
    this.syncAllDoors();
    return this.apartment;
  }

  private updatePlaying(deltaMs: number): void {
    this.sound.advance(deltaMs);
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
    if (deepseekCommand?.startSprint) {
      this.sprint.tryStart(activeDeepseekDirection, ratio,
        `AI_${this.deepseekAI.sprintDecision}`);
    }
    if (this.input.consumePress('Space')) {
      if (this.control.isControlling('DEEPSEEK')) {
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
    const movement = this.sprint.movementDirection(activeDeepseekDirection);
    const speed = C.player.speed / U *
      (this.sprint.state === 'SPRINT_RUNNING' ? C.sprint.speedMultiplier : 1);
    const oldDeepseek = this.player.position.clone();
    this.move(this.player, movement.x * speed * deltaMs / 1000, movement.y * speed * deltaMs / 1000);
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
        this.human.position, this.player.position, C.match.captureRadius,
        this.collision.isLineBlockedXZ(this.human.position, this.player.position));
      const command = this.humanAI.update({
        deltaMs, human: this.human.position,
        visibleTarget: sight.visible ? this.player.position : null,
        lastSeen: sight.lastSeen,
        heard: this.sound.heardBy(this.human.position, 'HUMAN', this.camera,
          this.perceptionGeometry),
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
      aiHumanDirection = { x: command.direction.x, y: command.direction.z };
    }
    this.humanAiWasActive = aiCanAct;
    const baseHumanSpeed = C.player.speed / U * C.human.speedMultiplier;
    const humanSpeed = aiHumanDirection
      ? humanAiMovementSpeed(baseHumanSpeed) : baseHumanSpeed;
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
      this.control.isControlling('DEEPSEEK') &&
      this.sprint.state === 'NORMAL' && this.input.isHeld('KeyE') &&
      !doorInteraction.doorOwnsInteraction && inRange && direction.x === 0 && direction.y === 0);
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
      this.human.position, this.player.position, C.match.captureRadius);
    this.captureZoneBlocked = insideCaptureRadius &&
      this.collision.isLineBlockedXZ(this.human.position, this.player.position);
    this.captureZoneActive = isCaptureEligibleXZ(
      this.human.position, this.player.position, C.match.captureRadius, this.captureZoneBlocked);
    this.match.advancePlaying(deltaMs, this.captureZoneActive, this.rice.completed);
    this.captureZone.setProgress(
      this.match.captureProgressMs, C.match.captureMs, this.captureZoneActive);
    if (this.match.result) {
      this.rice.interrupt();
      this.closeMinesweeper();
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
      interacting: (aiEnabled && this.humanAI.unlockProgressMs > 0) ||
        this.minesweeper.isOpen || (this.control.isControlling('HUMAN') &&
        this.input.isHeld('KeyE') && !!this.nearestInteractableDoor(this.human.position)),
    }), deltaMs);
  }

  private handleDoorInteractions(): {
    doorOwnsInteraction: boolean;
    humanMovementLocked: boolean;
  } {
    const faction = this.control.controlledFaction;
    const actor = this.control.controlled(this.player, this.human);
    if (!faction || !actor) {
      this.input.consumePress('KeyE');
      this.input.consumePress('KeyQ');
      return { doorOwnsInteraction: false, humanMovementLocked: false };
    }
    if (this.minesweeper.isOpen) {
      this.input.consumePress('KeyE');
      this.input.consumePress('KeyQ');
      return { doorOwnsInteraction: true, humanMovementLocked: true };
    }
    const nearby = this.nearestInteractableDoor(actor.position);
    const rice = faction === 'DEEPSEEK' ? this.nearestRice() : null;
    const doorOwnsInteraction = !!nearby && (!rice || nearby.distance <= rice.range);
    const coreOwnsInteraction = faction === 'HUMAN' &&
      nearby?.door.state === 'LOCKED' && nearby.door.lockCoreState === 'ACTIVE';
    const interactPressed = this.input.consumePress('KeyE');
    if (interactPressed && coreOwnsInteraction && nearby) {
      if (this.minesweeper.open(nearby.door.id, faction, this.match.phase)) {
        this.doorStatusMessage = '扫雷锁已打开：Human 暴露';
        this.renderMinesweeper();
      }
    } else if (interactPressed && nearby && doorOwnsInteraction) {
      const canClose = nearby.door.state !== 'OPEN' || this.canCloseDoor(nearby.definition.id);
      const result = this.doorSystem.toggle(nearby.door.id, faction, canClose);
      this.applyDoorResult(nearby.door.id, result);
    }
    if (this.input.consumePress('KeyQ')) {
      const result = nearby
        ? this.doorSystem.lock(nearby.door.id, faction)
        : 'NOT_FOUND';
      this.applyDoorResult(nearby?.door.id ?? null, result);
    }
    return {
      doorOwnsInteraction: doorOwnsInteraction || coreOwnsInteraction,
      humanMovementLocked: this.minesweeper.movementLocked,
    };
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
    this.followCamera();
    this.syncTraceViews();
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

  dispose(): void {
    cancelAnimationFrame(this.frame);
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
