import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import { GameStateSystem } from '../systems/GameStateSystem';
import { RiceField } from '../systems/RiceField';
import { SprintSystem } from '../systems/SprintSystem';
import { DoorSystem, doorIntersectsActor, type DoorActionResult } from '../systems/DoorSystem';
import { PulseLockSystem, type PulseLockEntry } from '../systems/PulseLockSystem';
import { CollisionWorld } from './CollisionWorld';
import { DoorView } from './DoorView';
import { InputManager } from './InputManager';
import { RiceView } from './RiceView';
import { resolveDirectControlSwitch, resolveRoundShortcut } from './RoundShortcuts';
import { CaptureZoneView, isCaptureEligibleXZ, isInsideCaptureZoneXZ } from './CaptureZone';
import { cameraRelativeDirection, positionCameraOnTarget } from './CameraRelativeMovement';
import { LocalControl, type Faction } from './LocalControl';
import { buildApartment } from './map/MapBuilder';
import { ACTIVE_RICE_COUNT, DEBUG_MAP, DOOR_NODES, MAP_WIDTH, MAP_DEPTH, SPAWNS,
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
  private captureZone: CaptureZoneView;
  private captureZoneActive = false;
  private captureZoneBlocked = false;
  private riceViews = new Map<string, RiceView>();
  private doorSystem = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  private pulseLock = new PulseLockSystem(
    this.doorSystem, C.pulseLock.unlockDurationMs, C.pulseLock.retentionMs);
  private doorViews = new Map<string, DoorView>();
  private doorStatusMessage = '';
  private collision: CollisionWorld;
  private hud: HTMLElement;
  private riceHud: HTMLElement;
  private overlay: HTMLElement;
  private overlayText: HTMLElement;
  private pauseActions: HTMLElement;
  private resultActions: HTMLElement;
  private menu: HTMLElement;
  private frame = 0;

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(C.backgroundColor);
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
    this.captureZone = new CaptureZoneView(this.human, C.match.captureRadius, actorHeight);
    this.resetRice();
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);
    window.addEventListener('resize', this.resize);
    this.resize();

    this.hud = this.label(container, 'game-hud');
    this.riceHud = this.label(container, 'rice-hud');
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
    debugSwitchButton.textContent = '开发调试：切换控制角色';
    debugSwitchButton.hidden = !C.development.factionSwitchEnabled;
    debugSwitchButton.addEventListener('click', () => this.switchControlledFactionFromPause());
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
    const target = this.control.controlled(this.player, this.human);
    if (!target) return;
    positionCameraOnTarget(this.camera, target.position, this.cameraOffset);
  }

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
    const deltaMs = Math.min(this.clock.getDelta() * 1000, 50);
    this.input.setTabCaptureEnabled(
      C.development.factionSwitchEnabled && C.development.directHotkeysEnabled &&
      this.match.phase === 'PLAYING');
    const pausePressed = this.input.consumePress('Escape');
    const restartPressed = this.input.consumePress('KeyR');
    const menuPressed = this.input.consumePress('KeyM');
    const controlSwitchPressed = this.input.consumePress('Tab');
    const shortcut = resolveRoundShortcut(this.match.phase,
      C.development.directHotkeysEnabled, restartPressed, menuPressed);
    if (shortcut === 'RESTART') {
      this.restart();
    } else if (shortcut === 'FACTION_SELECT') {
      this.returnToFactionSelect();
    } else if (this.match.phase === 'FINISHED') {
      // The finished scene remains frozen until a global shortcut or button is used.
    } else if (this.match.phase !== 'FACTION_SELECT') {
      if (pausePressed) this.togglePause();
      if (this.match.phase === 'READY') this.match.advanceReady(deltaMs);
      else if (this.match.phase === 'PLAYING') {
        if (C.development.factionSwitchEnabled &&
            resolveDirectControlSwitch(this.match.phase,
              C.development.directHotkeysEnabled, controlSwitchPressed)) {
          this.control.toggleControlled();
        }
        this.updatePlaying(deltaMs);
      }
    }
    if (this.control.controlledFaction !== null) {
      this.followCamera();
    }
    this.updateHud(this.nearestRice());
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  private updatePlaying(deltaMs: number): void {
    const local = cameraRelativeDirection(this.camera, this.input.localDirection());
    const debug = cameraRelativeDirection(this.camera, this.input.debugDirection());
    const { deepseek: direction, human: humanDirection } = this.control.directions(local, debug);
    const doorInteraction = this.handleDoorInteractions(deltaMs);
    const ratio = this.rice.progressRatio;
    if (this.input.consumePress('Space') && this.control.isControlling('DEEPSEEK')) {
      this.sprint.tryStart(direction, ratio);
    }
    this.sprint.advance(deltaMs, direction);
    const movement = this.sprint.movementDirection(direction);
    const speed = C.player.speed / U *
      (this.sprint.state === 'SPRINT_RUNNING' ? C.sprint.speedMultiplier : 1);
    this.move(this.player, movement.x * speed * deltaMs / 1000, movement.y * speed * deltaMs / 1000);
    this.player.rotation.z = this.sprint.state === 'STUNNED' ? Math.PI / 2 : 0;
    (this.player.material as THREE.MeshStandardMaterial).color.setHex(
      this.sprint.state === 'STUNNED' ? 0xff7777 : C.player.color);

    const humanSpeed = C.player.speed / U * C.human.speedMultiplier;
    const activeHumanDirection = doorInteraction.humanMovementLocked
      ? { x: 0, y: 0 } : humanDirection;
    this.move(this.human, activeHumanDirection.x * humanSpeed * deltaMs / 1000,
      activeHumanDirection.y * humanSpeed * deltaMs / 1000);
    const nearest = this.nearestRice();
    const inRange = !!nearest && nearest.range <= C.rice.interactionRange / U;
    this.rice.update(deltaMs, inRange ? nearest!.id : null,
      this.control.isControlling('DEEPSEEK') &&
      this.sprint.state === 'NORMAL' && this.input.isHeld('KeyE') &&
      !doorInteraction.doorOwnsInteraction && inRange && direction.x === 0 && direction.y === 0);
    for (const portion of this.rice.portions) {
      this.riceViews.get(portion.rice.id)!.sync(portion.rice);
    }
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
      this.pulseLock.interrupt();
    }
  }

  private handleDoorInteractions(deltaMs: number): {
    doorOwnsInteraction: boolean;
    humanMovementLocked: boolean;
  } {
    const faction = this.control.controlledFaction;
    const actor = this.control.controlled(this.player, this.human);
    if (!faction || !actor) {
      this.input.consumePress('KeyE');
      this.input.consumePress('KeyQ');
      this.pulseLock.advance(deltaMs, this.match.phase, null, null, false);
      return { doorOwnsInteraction: false, humanMovementLocked: false };
    }
    const nearby = this.doorSystem.nearest(
      actor.position.x, actor.position.z, C.door.interactionRange);
    const rice = faction === 'DEEPSEEK' ? this.nearestRice() : null;
    const doorOwnsInteraction = !!nearby && (!rice || nearby.distance <= rice.range);
    const nearbyCore = faction === 'HUMAN'
      ? this.nearestLockCore(actor.position, false) : null;
    const coreOwnsInteraction = nearbyCore !== null;
    const pulseResult = this.pulseLock.advance(
      deltaMs, this.match.phase, faction, nearbyCore?.id ?? null, this.input.isHeld('KeyE'));
    const interactPressed = this.input.consumePress('KeyE');
    if (interactPressed && nearby && doorOwnsInteraction && !coreOwnsInteraction) {
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
    if (pulseResult.completedDoorId) {
      this.applyDoorResult(pulseResult.completedDoorId, 'UNLOCKED');
    } else if (this.pulseLock.humanExposed) {
      this.doorStatusMessage = 'PulseLock 破解中：Human 暴露';
    } else if (this.doorStatusMessage === 'PulseLock 破解中：Human 暴露') {
      this.doorStatusMessage = '';
    }
    return {
      doorOwnsInteraction: doorOwnsInteraction || coreOwnsInteraction,
      humanMovementLocked: pulseResult.movementLocked,
    };
  }

  private nearestLockCore(position: THREE.Vector3, includeDisabled: boolean): {
    id: string;
    distance: number;
  } | null {
    let nearest: { id: string; distance: number } | null = null;
    for (const door of this.doorSystem.doors) {
      const eligible = door.lockCoreState === 'DISABLED'
        ? includeDisabled : door.state === 'LOCKED' && door.locked;
      if (!eligible) continue;
      const corePosition = this.doorViews.get(door.id)!.lockCoreWorldPosition();
      const coreDistance = Math.hypot(
        position.x - corePosition.x, position.z - corePosition.z);
      if (coreDistance <= C.pulseLock.interactionRange &&
          (!nearest || coreDistance < nearest.distance)) {
        nearest = { id: door.id, distance: coreDistance };
      }
    }
    return nearest;
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

  private applyDoorResult(id: string | null, result: DoorActionResult): void {
    if (id && (result === 'OPENED' || result === 'CLOSED' ||
        result === 'LOCKED' || result === 'UNLOCKED')) {
      this.syncDoor(id);
    }
    this.doorStatusMessage = result === 'OPENED' ? '门已打开'
      : result === 'CLOSED' ? '门已关闭'
      : result === 'LOCKED' ? '门已上锁'
      : result === 'UNLOCKED' ? '锁芯已失效，门仍为关闭状态'
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
      this.pulseLock.interrupt();
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

  private switchControlledFactionFromPause(): void {
    if (this.match.phase !== 'PAUSED' || !C.development.factionSwitchEnabled) return;
    this.control.toggleControlled();
    this.input.clear();
    this.followCamera();
    this.updateHud(this.nearestRice());
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
    this.pulseLock.reset();
    this.syncAllDoors();
    this.doorStatusMessage = '';
    this.player.position.set(SPAWNS.deepseek.x, C.three.actorHeight / 2, SPAWNS.deepseek.z);
    this.human.position.set(SPAWNS.human.x, C.three.actorHeight / 2, SPAWNS.human.z);
    this.player.rotation.z = 0;
    (this.player.material as THREE.MeshStandardMaterial).color.setHex(C.player.color);
    this.captureZoneActive = false;
    this.captureZoneBlocked = false;
    this.captureZone.reset();
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
    const developmentControl = C.development.factionSwitchEnabled
      ? `当前控制：${controlledName}｜Esc 菜单可切换控制${directHotkeyHint}\n` : '';
    const doorHint = this.control.isControlling('DEEPSEEK')
      ? `门：E 开/关｜Q 锁门  锁：${this.doorSystem.activeLockedDoorCount} / ${C.door.maxActiveLocks}`
      : '门：E 开/关｜靠近 LOCKED 锁芯后按住 E 破解';
    const pulseEntry = this.pulseHudEntry();
    const pulseRatio = pulseEntry
      ? pulseEntry.unlockProgressMs / C.pulseLock.unlockDurationMs : 0;
    const filledSegments = Math.round(Math.max(0, Math.min(1, pulseRatio)) * 10);
    const pulseBar = `${'█'.repeat(filledSegments)}${'░'.repeat(10 - filledSegments)}`;
    const pulseDoor = pulseEntry ? this.doorSystem.get(pulseEntry.doorId) : null;
    const pulseStatus = !pulseEntry ? '无目标'
      : pulseDoor?.lockCoreState === 'DISABLED' ? '锁芯已失效'
      : pulseEntry.interactionState === 'UNLOCKING' ? '解锁中：暴露'
      : pulseEntry.interactionState === 'RETAINED'
        ? `进度保留：${(pulseEntry.retentionRemainingMs / 1000).toFixed(1)} 秒`
        : '等待破解';
    const coreState = pulseDoor?.lockCoreState ?? 'ACTIVE';
    const pulseText = `锁芯：${coreState}｜PulseLock：${pulseBar} ${((pulseEntry?.unlockProgressMs ?? 0) / 1000).toFixed(1)} / ` +
      `${(C.pulseLock.unlockDurationMs / 1000).toFixed(1)} 秒｜${pulseStatus}`;
    this.hud.textContent = `${phaseText}  时间：${time}\n玩家阵营：${factionName}\n` +
      developmentControl +
      'WASD/方向键：当前控制角色｜IJKL：另一角色（调试）\n' +
      'DeepSeek 娘：E 进食、移动时点 Space 冲刺\n' +
      `${doorHint}${this.doorStatusMessage ? `｜${this.doorStatusMessage}` : ''}\n` +
      `${pulseText}\n` +
      `抓捕：${(this.match.captureProgressMs / 1000).toFixed(2)} / ${(C.match.captureMs / 1000).toFixed(2)} 秒\n` +
      `抓捕区：${this.captureZoneBlocked ? '有阻挡' : this.captureZoneActive ? '圈内' : '圈外'}\n` +
      `DeepSeek 状态：${this.sprint.state}  米总进度：${Math.round(ratio * 100)}%\n` +
      `${risk}  冲刺剩余：${(this.sprint.sprintRemainingMs / 1000).toFixed(1)} 秒\n` +
      `结束摔倒：${this.sprint.riskMode === 'FALL_ON_END' ? 'YES' : 'NO'}  眩晕剩余：${(this.sprint.stunRemainingMs / 1000).toFixed(1)} 秒`;
    const riceStates = { IDLE: '未交互', PREPARING: '准备中', EATING: '进食中',
      INTERRUPTED: '已中断', COMPLETED: '已完成' };
    const inRange = !!nearest && nearest.range <= C.rice.interactionRange / U;
    const hint = this.rice.completed ? '5 份大米已吃完'
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
        `原因：${result.reason === 'RICE_COMPLETED' ? '5 份大米完成' : '抓捕完成'}\n` +
        `对局时间：${time}\n大米：${this.rice.completedCount}/${ACTIVE_RICE_COUNT}`;
    } else this.overlayText.textContent = '';
    this.pauseActions.hidden = phase !== 'PAUSED';
    this.resultActions.hidden = phase !== 'FINISHED';
    this.overlay.hidden = phase !== 'PAUSED' && phase !== 'FINISHED';
  }

  private pulseHudEntry(): PulseLockEntry | null {
    const actor = this.control.controlled(this.player, this.human);
    if (actor && this.control.isControlling('HUMAN')) {
      const nearby = this.nearestLockCore(actor.position, true);
      if (nearby) return this.pulseLock.get(nearby.id) ?? null;
    }
    return this.pulseLock.entries.find(entry => entry.interactionState === 'UNLOCKING') ??
      this.pulseLock.entries.find(entry => entry.interactionState === 'RETAINED') ?? null;
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.captureZone.dispose();
    for (const view of this.doorViews.values()) view.dispose();
    this.renderer.dispose();
  }
}
