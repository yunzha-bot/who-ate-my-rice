import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import { GameStateSystem } from '../systems/GameStateSystem';
import { RiceField } from '../systems/RiceField';
import { SprintSystem } from '../systems/SprintSystem';
import { DoorSystem, doorIntersectsActor, type DoorActionResult,
  type NearbyDoor } from '../systems/DoorSystem';
import { HumanDoorSkill } from '../systems/HumanDoorSkill';
import { MinesweeperLockSystem, type MineEntry } from '../systems/MinesweeperLockSystem';
import { PerceptionGeometry, RiceTraceSystem, SoundEventSystem, VisionSystem,
  type SoundType } from '../systems/PerceptionSystem';
import { HumanAIController, humanAiMovementSpeed, shouldRunHumanAI }
  from '../systems/HumanAIController';
import { DeepSeekAIController, shouldRunDeepSeekAI,
  type DeepSeekAICommand } from '../systems/DeepSeekAIController';
import { resolveCharacterAction } from '../systems/CharacterAction';
import { NavigationSystem } from '../systems/NavigationSystem';
import { CollisionWorld, canInteractWithDoorXZ } from './CollisionWorld';
import { DoorView } from './DoorView';
import { CharacterActionView } from './CharacterActionView';
import { InputManager } from './InputManager';
import { RiceView } from './RiceView';
import { createRiceTraceView, syncRiceTraceView } from './RiceTraceView';
import { SoundVisualView } from './SoundVisualView';
import { resolveDirectControlSwitch, resolveRoundShortcut } from './RoundShortcuts';
import { CaptureZoneView, isCaptureEligibleXZ, isInsideCaptureZoneXZ } from './CaptureZone';
import { cameraRelativeDirection, positionCameraOnTarget } from './CameraRelativeMovement';
import { LocalControl, pickActorFaction, type Faction } from './LocalControl';
import { buildApartment } from './map/MapBuilder';
import { ACTIVE_RICE_COUNT, DEBUG_MAP, DOOR_NODES, MAP_WIDTH, MAP_DEPTH, ROOMS, SPAWNS, WALLS,
  selectRiceCandidates } from './map/apartmentMap';

const U = C.three.pixelsPerUnit;
const distance = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

export class ThreeGame {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private clock = new THREE.Clock();
  private input = new InputManager();
  private control = new LocalControl();
  private readonly cameraOffset = new THREE.Vector3(12, 14, 12);
  private match = new GameStateSystem(C.match.readyMs, C.match.captureMs, 'FACTION_SELECT');
  private rice = new RiceField([], C.rice.maxProgressMs, C.rice.prepareMs);
  private sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold, C.sprint.stunMs);
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
  private humanAI: HumanAIController;
  private humanAiWasActive = false;
  private deepseekAI: DeepSeekAIController;
  private deepseekAiWasActive = false;
  private debugPanel: HTMLElement;
  private debugContent: HTMLElement;
  private debugToggle: HTMLButtonElement;
  private hud: HTMLElement;
  private riceHud: HTMLElement;
  private perceptionHud: HTMLElement;
  private soundArrow: HTMLElement;
  private soundDetails: HTMLElement;
  private visionDetails: HTMLElement;
  private traceDetails: HTMLElement;
  private debugPossession: HTMLElement;
  private humanAiDetails: HTMLElement;
  private deepseekAiDetails: HTMLElement;
  private actionDetails: HTMLElement;
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

    this.collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2,
      buildApartment(this.scene));
    const navigation = new NavigationSystem(this.collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
    this.humanAI = new HumanAIController(navigation, ROOMS, DOOR_NODES);
    this.deepseekAI = new DeepSeekAIController(navigation, DOOR_NODES);
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

    this.debugPanel = this.label(container, 'debug-panel');
    this.debugToggle = document.createElement('button');
    this.debugToggle.type = 'button';
    this.debugToggle.className = 'debug-toggle';
    this.debugToggle.textContent = 'DEV ▾';
    this.debugToggle.setAttribute('aria-expanded', 'false');
    this.debugToggle.addEventListener('click', () => this.toggleDebugPanel());
    this.debugPanel.append(this.debugToggle);
    this.debugContent = this.label(this.debugPanel, 'debug-content');
    this.debugContent.hidden = true;

    const matchSection = this.label(this.debugContent, 'debug-section');
    const matchTitle = this.label(matchSection, 'debug-section-title');
    matchTitle.textContent = '对局状态';
    this.hud = this.label(matchSection, 'game-hud');
    this.riceHud = this.label(matchSection, 'rice-hud');

    this.perceptionHud = this.label(this.debugContent, 'debug-section perception-hud');
    const perceptionTitle = this.label(this.perceptionHud, 'debug-section-title');
    perceptionTitle.textContent = '感知 / 信息';
    this.soundArrow = this.label(this.perceptionHud, 'sound-arrow');
    this.soundDetails = this.label(this.perceptionHud, 'sound-details');
    this.visionDetails = this.label(this.perceptionHud, 'vision-details');
    this.traceDetails = this.label(this.perceptionHud, 'trace-details');
    this.debugPossession = this.label(this.perceptionHud, 'debug-possession');
    this.humanAiDetails = this.label(this.perceptionHud, 'human-ai-details');
    this.deepseekAiDetails = this.label(this.perceptionHud, 'deepseek-ai-details');
    this.actionDetails = this.label(this.perceptionHud, 'action-details');
    const controlsSection = this.label(this.debugContent, 'debug-section');
    const controlsTitle = this.label(controlsSection, 'debug-section-title');
    controlsTitle.textContent = '控制 / 玩法调试';
    controlsSection.append(this.debugPossession, this.humanAiDetails,
      this.deepseekAiDetails, this.actionDetails);
    this.actionDetails.hidden = !import.meta.env.DEV;
    if (this.debugPossessionEnabled) {
      for (const faction of ['HUMAN', 'DEEPSEEK'] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `临时控制 ${faction === 'HUMAN' ? 'Human' : 'DeepSeek 娘'}`;
        button.addEventListener('click', () => this.setTemporaryInputTarget(faction));
        this.debugPossession.append(button);
      }
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

  private toggleDebugPanel(): void {
    this.debugContent.hidden = !this.debugContent.hidden;
    this.debugToggle.textContent = this.debugContent.hidden ? 'DEV ▾' : '收起 DEV ▴';
    this.debugToggle.setAttribute('aria-expanded', String(!this.debugContent.hidden));
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
        this.minesweeper.isOpen || !this.control.setTemporaryInputTarget(faction)) return;
    this.input.clear();
    this.updateHud(this.nearestRice());
    this.updatePerceptionHud();
  }

  private onActorClick = (event: MouseEvent): void => {
    if (!this.debugPossessionEnabled || this.match.phase !== 'PLAYING' ||
        this.minesweeper.isOpen || event.button !== 0) return;
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
    const viewHeight = this.match.phase === 'FACTION_SELECT' ? MAP_DEPTH + 5 : C.three.viewHeight;
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
    this.input.setTabCaptureEnabled(
      C.development.factionSwitchEnabled && C.development.directHotkeysEnabled &&
      this.match.phase === 'PLAYING');
    const pausePressed = this.input.consumePress('Escape');
    const restartPressed = this.input.consumePress('KeyR');
    const menuPressed = this.input.consumePress('KeyM');
    const controlSwitchPressed = this.input.consumePress('Tab');
    const shortcut = resolveRoundShortcut(this.match.phase,
      C.development.directHotkeysEnabled && !this.minesweeper.isOpen,
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
      if (this.match.phase === 'READY') this.match.advanceReady(deltaMs);
      else if (this.match.phase === 'PLAYING') {
        if (!this.minesweeper.isOpen && C.development.factionSwitchEnabled &&
            resolveDirectControlSwitch(this.match.phase,
              C.development.directHotkeysEnabled, controlSwitchPressed)) {
          this.control.toggleControlled();
        }
        this.updatePlaying(deltaMs);
      }
    }
    if (this.control.selectedFaction !== null) {
      this.followCamera();
    }
    this.updateHud(this.nearestRice());
    this.updatePerceptionHud();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  private updatePlaying(deltaMs: number): void {
    this.sound.advance(deltaMs);
    this.traces.advance(deltaMs);
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
      debug, this.debugPossessionEnabled) && this.sprint.state === 'NORMAL';
    let deepseekCommand: DeepSeekAICommand | null = null;
    if (deepseekAiEnabled) {
      if (!this.deepseekAiWasActive) this.deepseekAI.resumeAfterManualControl();
      deepseekCommand = this.deepseekAI.update({
        deltaMs,
        deepseek: this.player.position,
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
      });
      if (deepseekCommand.openDoorId) {
        const result = this.doorSystem.toggle(deepseekCommand.openDoorId, 'DEEPSEEK');
        this.applyDoorResult(deepseekCommand.openDoorId, result, 'DEEPSEEK');
      }
    }
    this.deepseekAiWasActive = deepseekAiEnabled;
    const activeDeepseekDirection = deepseekCommand
      ? { x: deepseekCommand.direction.x, y: deepseekCommand.direction.z } : direction;
    if (this.input.consumePress('Space')) {
      if (this.control.isControlling('DEEPSEEK')) {
        this.sprint.tryStart(direction, ratio);
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
    this.vision.update(deltaMs, this.human.position, this.player.position,
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
    const ratio = this.rice.progressRatio;
    const risk = this.sprint.state === 'NORMAL'
      ? ratio >= C.sprint.riskThreshold ? 'RISK SPRINT' : 'SAFE SPRINT'
      : this.sprint.riskMode === 'FALL_ON_END' ? 'RISK SPRINT' : 'SAFE SPRINT';
    const factionName = this.control.selectedFaction === 'DEEPSEEK' ? 'DeepSeek 娘'
      : this.control.selectedFaction === 'HUMAN' ? '人类' : '未选择';
    const controlledName = this.control.controlledFaction === 'DEEPSEEK' ? 'DeepSeek 娘'
      : this.control.controlledFaction === 'HUMAN' ? 'Human' : '未选择';
    const directHotkeyHint = C.development.directHotkeysEnabled ? '｜直达 R / M / Tab 已开启' : '';
    const developmentControl = this.debugPossessionEnabled
      ? `正式主控：${factionName}｜临时输入目标：${controlledName}｜Camera：${factionName}｜信息观察者：${factionName}${directHotkeyHint}\n` : '';
    const doorHint = this.control.isControlling('DEEPSEEK')
      ? `门：E 开/关｜Q 锁门  锁：${this.doorSystem.activeLockedDoorCount} / ${C.door.maxActiveLocks}`
      : '门：E 开/关或扫雷｜Space 普通门快开 / 锁门强破';
    const forceBreak = this.humanDoorSkill.cooldownRemainingMs > 0
      ? `CD ${(this.humanDoorSkill.cooldownRemainingMs / 1000).toFixed(1)}s`
      : 'READY';
    const mineEntry = this.mineHudEntry();
    const mineDoor = mineEntry ? this.doorSystem.get(mineEntry.doorId) : null;
    const mineStatus = !mineEntry ? '未开始'
      : mineEntry.state === 'DISABLED' ? '锁芯已失效'
      : mineEntry.state === 'FAILED' ? '破解失败，等待新盘'
      : mineEntry.state === 'OPEN' ? '扫雷中：Human 暴露'
      : mineEntry.board ? '盘面已保留' : '未开始';
    const mineText = `锁芯：${mineDoor?.lockCoreState ?? 'ACTIVE'}｜扫雷：${mineStatus}`;
    this.hud.textContent = `${phaseText}  时间：${time}\n玩家阵营：${factionName}\n` +
      developmentControl +
      'WASD/方向键：当前控制角色｜IJKL：另一角色（调试）\n' +
      'DeepSeek 娘：E 进食、移动时点 Space 冲刺\n' +
      `${doorHint}${this.doorStatusMessage ? `｜${this.doorStatusMessage}` : ''}\n` +
      `强制破锁：${forceBreak}\n` +
      `${mineText}\n` +
      `抓捕：${(this.match.captureProgressMs / 1000).toFixed(2)} / ${(C.match.captureMs / 1000).toFixed(2)} 秒\n` +
      `抓捕区：${this.captureZoneBlocked ? '有阻挡' : this.captureZoneActive ? '圈内' : '圈外'}\n` +
      `DeepSeek 状态：${this.sprint.state}  米总进度：${Math.round(ratio * 100)}%\n` +
      `${risk}  冲刺剩余：${(this.sprint.sprintRemainingMs / 1000).toFixed(1)} 秒\n` +
      `结束摔倒：${this.sprint.riskMode === 'FALL_ON_END' ? 'YES' : 'NO'}  眩晕剩余：${(this.sprint.stunRemainingMs / 1000).toFixed(1)} 秒`;
    const riceStates = { IDLE: '未交互', PREPARING: '准备中', EATING: '进食中',
      INTERRUPTED: '已中断', COMPLETED: '已完成' };
    const inRange = !!nearest && nearest.range <= C.rice.interactionRange / U;
    const hint = this.rice.completed ? `${ACTIVE_RICE_COUNT} 份大米已吃完`
      : this.deepseekAiWasActive ? 'DeepSeek AI 正在自主寻找或进食'
      : this.control.isControlling('HUMAN') ? '当前控制 Human，不能进食'
      : this.sprint.state !== 'NORMAL' ? '冲刺或眩晕中无法进食'
      : inRange ? '按住 E 进食，移动可中断' : '靠近大米后按住 E';
    const current = nearest?.portion.rice;
    const remainingMs = current ? Math.max(0, current.maxProgressMs - current.progressMs) : 0;
    const activeIds = this.rice.states.map(state => state.id).join(', ');
    this.riceHud.textContent =
      `大米：${this.rice.completedCount} / ${ACTIVE_RICE_COUNT}  总进度：${Math.round(ratio * 100)}%\n` +
      `本局米点：${activeIds}\n` +
      `当前目标：${current?.id ?? '无'}\n` +
      `当前 Rice：${((current?.progressMs ?? 0) / 1000).toFixed(1)} / ${((current?.maxProgressMs ?? C.rice.maxProgressMs) / 1000).toFixed(1)} 秒\n` +
      `剩余：${(remainingMs / 1000).toFixed(1)} 秒  状态：${current ? riceStates[current.interactionState] : '全部完成'}\n${hint}`;
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
    this.debugPanel.hidden = phase === 'FACTION_SELECT';
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
    if (import.meta.env.DEV) {
      this.actionDetails.textContent =
        `Human 动作：${this.humanAction.action}｜切换原因：${this.humanAction.lastTransitionReason}\n` +
        `DeepSeek 动作：${this.playerAction.action}｜切换原因：${this.playerAction.lastTransitionReason}\n` +
        '预留：Human EAT / STARTLED / FALL / STUN；DeepSeek CAPTURE';
    }
    const faction = this.control.informationObserver;
    this.perceptionHud.hidden = !faction || this.match.phase === 'FACTION_SELECT';
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
    const sight = this.vision.get(faction);
    const seen = sight.lastSeen;
    this.soundArrow.hidden = !heard;
    this.soundArrow.textContent = heard?.direction ?? '';
    this.perceptionHud.style.color = heard
      ? heard.audibleStrength >= C.perception.soundVisual.hudHighStrength ? '#ffad6d'
        : heard.audibleStrength >= C.perception.soundVisual.hudMidStrength ? '#ffe18a' : '#b7d4e8'
      : '#c9d6df';
    this.soundDetails.textContent = probe
      ? `${heard ? '最近声音' : '声音探针（不可听）'}：${probe.event.type}  剩余 ${(probe.remainingMs / 1000).toFixed(1)}s\n` +
        `Raw ${probe.rawStrength.toFixed(2)} × Distance ${probe.distanceFactor.toFixed(2)} × ` +
        `Occlusion ${probe.occlusionMultiplier.toFixed(2)} = Final ${probe.audibleStrength.toFixed(2)}\n` +
        `遮挡：${probe.occlusion}`
      : '最近声音：无';
    const blockerIndex = DOOR_NODES.findIndex(node => node.id === sight.blocker);
    const blockerLabel = blockerIndex >= 0
      ? `Door D${String(blockerIndex + 1).padStart(2, '0')}` : sight.blocker;
    this.visionDetails.textContent = `Vision：${sight.status}` +
      (blockerLabel ? `（${blockerLabel}）` : '') + '\n' +
      `Last Seen：${seen ? `(${seen.position.x.toFixed(1)}, ${seen.position.z.toFixed(1)}) ` +
        `${((this.vision.nowMs - seen.timeMs) / 1000).toFixed(1)} 秒前` : '无'}`;
    this.traceDetails.textContent =
      `脚印生成窗口：${(this.traces.generationRemainingMs / 1000).toFixed(1)}s\n` +
      `当前有效脚印：${this.traces.traces.length}`;
    this.humanAiDetails.hidden = !this.debugPossessionEnabled;
    this.deepseekAiDetails.hidden = !this.debugPossessionEnabled;
    if (this.debugPossessionEnabled) {
      const active = shouldRunHumanAI(this.match.phase, this.control.selectedFaction,
        this.control.temporaryInputTarget, this.input.debugDirection(),
        this.debugPossessionEnabled);
      const goal = this.humanAI.target;
      const path = this.humanAI.getPathProgress();
      const mode = this.match.phase === 'PAUSED' ? 'PAUSED'
        : this.match.phase === 'READY' ? 'STANDBY'
          : active ? this.humanAI.state : 'MANUAL';
      this.humanAiDetails.textContent = `Human AI：${mode}\n` +
        `目标：${goal ? `${this.humanAI.targetRoomId ?? '位置'} ` +
          `(${goal.x.toFixed(1)}, ${goal.z.toFixed(1)})` : '无'}\n` +
        `路径节点：${path ? `${path.index}/${path.total} ` +
          `(${path.waypoint.x.toFixed(1)}, ${path.waypoint.z.toFixed(1)})` : '无'}\n` +
        `锁门决策：${this.humanAI.lockDecision} / ${this.humanAI.targetDoorId ?? '无'}\n` +
        `选择原因：${this.humanAI.decisionReason}\n` +
        `解锁：${(this.humanAI.unlockProgressMs / 1000).toFixed(1)}s / ` +
          `${(C.humanAI.aiUnlockDurationMs / 1000).toFixed(1)}s\n` +
        `强破 CD：${(this.humanDoorSkill.cooldownRemainingMs / 1000).toFixed(1)}s\n` +
        `搜索房间：${this.humanAI.searchTargetRoomId ?? '无'}\n` +
        `切换原因：${this.humanAI.lastTransitionReason}\n` +
        `路径事件：${this.humanAI.lastNavigationReason}`;
      const deepseekActive = shouldRunDeepSeekAI(this.match.phase,
        this.control.selectedFaction, this.control.temporaryInputTarget,
        this.input.debugDirection(), this.debugPossessionEnabled) &&
        this.sprint.state === 'NORMAL';
      const deepseekPath = this.deepseekAI.getPathProgress();
      const deepseekMode = this.match.phase === 'PAUSED' ? 'PAUSED'
        : this.match.phase === 'READY' ? 'STANDBY'
          : deepseekActive ? this.deepseekAI.state : 'MANUAL';
      this.deepseekAiDetails.textContent = `DeepSeek AI：${deepseekMode}\n` +
        `目标米堆：${this.deepseekAI.targetRiceId ?? '无'}\n` +
        `预计完成：${this.deepseekAI.targetScoreMs === null ? '无' :
          `${(this.deepseekAI.targetScoreMs / 1000).toFixed(1)}s`}\n` +
        `路径节点：${deepseekPath ? `${deepseekPath.index}/${deepseekPath.total} ` +
          `(${deepseekPath.waypoint.x.toFixed(1)}, ${deepseekPath.waypoint.z.toFixed(1)})` : '无'}\n` +
        `重选原因：${this.deepseekAI.lastSelectionReason}\n` +
        `路径事件：${this.deepseekAI.lastNavigationReason}`;
    }
    this.debugPossession.hidden = !this.debugPossessionEnabled || this.match.phase !== 'PLAYING';
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.renderer.domElement.removeEventListener('click', this.onActorClick);
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.captureZone.dispose();
    this.soundVisual.dispose();
    this.clearTraceViews();
    for (const view of this.doorViews.values()) view.dispose();
    this.renderer.dispose();
  }
}
