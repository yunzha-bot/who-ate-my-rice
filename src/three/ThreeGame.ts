import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import { GameStateSystem } from '../systems/GameStateSystem';
import { RiceSystem } from '../systems/RiceSystem';
import { SprintSystem } from '../systems/SprintSystem';
import { CollisionWorld } from './CollisionWorld';
import { InputManager } from './InputManager';
import { cameraRelativeDirection, positionCameraOnTarget } from './CameraRelativeMovement';
import { LocalControl, type Faction } from './LocalControl';

const U = C.three.pixelsPerUnit;
const wx = (x: number) => (x - C.width / 2) / U;
const wz = (y: number) => (y - C.height / 2) / U;
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
  private rice = new RiceSystem(C.rice.id, C.rice.maxProgressMs, C.rice.prepareMs);
  private sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold, C.sprint.stunMs);
  private player: THREE.Mesh;
  private human: THREE.Mesh;
  private riceMesh: THREE.Mesh;
  private collision: CollisionWorld;
  private hud: HTMLElement;
  private riceHud: HTMLElement;
  private overlay: HTMLElement;
  private overlayText: HTMLElement;
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
    light.shadow.camera.left = light.shadow.camera.bottom = -12;
    light.shadow.camera.right = light.shadow.camera.top = 12;
    this.scene.add(light);

    const width = C.width / U, depth = C.height / U;
    const floor = this.box(width, 0.15, depth, 0xa8afb5, 0, -0.075, 0);
    floor.receiveShadow = true;
    const edge = C.three.boundaryHeight;
    this.box(width, edge, 0.15, 0x667078, 0, edge / 2, -depth / 2 - 0.08);
    this.box(width, edge, 0.15, 0x667078, 0, edge / 2, depth / 2 + 0.08);
    this.box(0.15, edge, depth, 0x667078, -width / 2 - 0.08, edge / 2, 0);
    this.box(0.15, edge, depth, 0x667078, width / 2 + 0.08, edge / 2, 0);
    const obstacles = C.walls.map(wall => {
      const mesh = this.box(wall.width / U, C.three.wallHeight, wall.height / U,
        C.wallColor, wx(wall.x), C.three.wallHeight / 2, wz(wall.y));
      return new THREE.Box3().setFromObject(mesh);
    });
    this.collision = new CollisionWorld(width / 2, depth / 2, obstacles);
    const actorWidth = C.player.size / U, actorHeight = C.three.actorHeight;
    this.player = this.box(actorWidth, actorHeight, actorWidth, C.player.color,
      wx(C.player.x), actorHeight / 2, wz(C.player.y));
    this.human = this.box(actorWidth, actorHeight, actorWidth, C.human.color,
      wx(C.human.x), actorHeight / 2, wz(C.human.y));
    this.riceMesh = this.box(C.rice.size / U, 0.25, C.rice.size / U, C.rice.color,
      wx(C.rice.x), 0.125, wz(C.rice.y));
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);
    window.addEventListener('resize', this.resize);
    this.resize();

    this.hud = this.label(container, 'game-hud');
    this.riceHud = this.label(container, 'rice-hud');
    this.overlay = this.label(container, 'game-overlay');
    this.overlayText = this.label(this.overlay, 'overlay-text');
    this.resultActions = this.label(this.overlay, 'result-actions');
    const restartButton = document.createElement('button');
    restartButton.type = 'button';
    restartButton.textContent = '再来一局 [R]';
    restartButton.addEventListener('click', () => this.restart());
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.textContent = '返回阵营选择 [M]';
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
    this.updateHud(false);
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
    this.followCamera();
    this.updateHud(false);
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

  private resize = (): void => {
    const width = Math.max(1, innerWidth), height = Math.max(1, innerHeight);
    const viewWidth = C.three.viewHeight * width / height;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = C.three.viewHeight / 2;
    this.camera.bottom = -C.three.viewHeight / 2;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private tick = (): void => {
    const deltaMs = Math.min(this.clock.getDelta() * 1000, 50);
    const pausePressed = this.input.consumePress('Escape');
    const restartPressed = this.input.consumePress('KeyR');
    const menuPressed = this.input.consumePress('KeyM');
    if (this.match.phase === 'FINISHED') {
      if (restartPressed) this.restart();
      else if (menuPressed) this.returnToFactionSelect();
    } else if (this.match.phase !== 'FACTION_SELECT') {
      if (pausePressed) this.togglePause();
      if (this.match.phase === 'READY') this.match.advanceReady(deltaMs);
      else if (this.match.phase === 'PLAYING') this.updatePlaying(deltaMs);
    }
    if (this.control.faction !== null) {
      this.followCamera();
    }
    this.updateHud(distance(this.player.position, this.riceMesh.position) <= C.rice.interactionRange / U);
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  private updatePlaying(deltaMs: number): void {
    const local = cameraRelativeDirection(this.camera, this.input.localDirection());
    const debug = cameraRelativeDirection(this.camera, this.input.debugDirection());
    const { deepseek: direction, human: humanDirection } = this.control.directions(local, debug);
    const ratio = this.rice.rice.progressMs / this.rice.rice.maxProgressMs;
    if (this.input.consumePress('Space') && this.control.faction === 'DEEPSEEK') {
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
    this.move(this.human, humanDirection.x * humanSpeed * deltaMs / 1000,
      humanDirection.y * humanSpeed * deltaMs / 1000);
    const inRange = distance(this.player.position, this.riceMesh.position) <= C.rice.interactionRange / U;
    this.rice.update(deltaMs, this.control.faction === 'DEEPSEEK' &&
      this.sprint.state === 'NORMAL' && this.input.isHeld('KeyE') &&
      inRange && direction.x === 0 && direction.y === 0);
    this.riceMesh.visible = !this.rice.rice.completed;
    const capture = distance(this.player.position, this.human.position) <= C.match.captureRange / U;
    this.match.advancePlaying(deltaMs, capture, this.rice.rice.completed);
    if (this.match.result) this.rice.interrupt();
  }

  private move(mesh: THREE.Mesh, dx: number, dz: number): void {
    mesh.position.copy(this.collision.move(mesh.position, dx, dz,
      C.player.size / U, C.three.actorHeight));
  }

  private togglePause(): void {
    if (this.match.pause()) this.rice.interrupt();
    else this.match.resume();
  }

  private restart(): void {
    if (this.match.phase !== 'FINISHED') return;
    this.match.reset();
    this.resetRound();
    this.followCamera();
    this.updateHud(false);
  }

  private returnToFactionSelect(): void {
    if (!this.match.returnToFactionSelect()) return;
    this.resetRound();
    this.control.clear();
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);
    this.menu.querySelector<HTMLInputElement>('input[value="DEEPSEEK"]')!.checked = true;
    this.menu.hidden = false;
    this.updateHud(false);
  }

  private resetRound(): void {
    this.sprint.reset();
    this.rice.reset();
    this.player.position.set(wx(C.player.x), C.three.actorHeight / 2, wz(C.player.y));
    this.human.position.set(wx(C.human.x), C.three.actorHeight / 2, wz(C.human.y));
    this.player.rotation.z = 0;
    (this.player.material as THREE.MeshStandardMaterial).color.setHex(C.player.color);
    this.riceMesh.visible = true;
    this.input.clear();
  }

  private updateHud(inRange: boolean): void {
    const phase = this.match.phase;
    const phaseText = phase === 'FACTION_SELECT' ? '选择阵营'
      : phase === 'READY' ? `准备：${Math.ceil(this.match.readyRemainingMs / 1000)} 秒`
      : phase === 'PLAYING' ? '对局中' : phase === 'PAUSED' ? '已暂停' : '已结束';
    const seconds = Math.floor(this.match.elapsedMs / 1000);
    const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const ratio = this.rice.rice.progressMs / this.rice.rice.maxProgressMs;
    const risk = this.sprint.state === 'NORMAL'
      ? ratio >= C.sprint.riskThreshold ? 'RISK SPRINT' : 'SAFE SPRINT'
      : this.sprint.riskMode === 'FALL_ON_END' ? 'RISK SPRINT' : 'SAFE SPRINT';
    const factionName = this.control.faction === 'DEEPSEEK' ? 'DeepSeek 娘'
      : this.control.faction === 'HUMAN' ? '人类' : '未选择';
    this.hud.textContent = `${phaseText}  时间：${time}\n玩家阵营：${factionName}\n` +
      'WASD/方向键：当前玩家｜IJKL：另一角色（调试）\n' +
      'DeepSeek 娘：E 进食、移动时点 Space 冲刺\n' +
      `抓捕：${(this.match.captureProgressMs / 1000).toFixed(2)} / ${(C.match.captureMs / 1000).toFixed(2)} 秒\n` +
      `DeepSeek 状态：${this.sprint.state}  米总进度：${Math.round(ratio * 100)}%\n` +
      `${risk}  冲刺剩余：${(this.sprint.sprintRemainingMs / 1000).toFixed(1)} 秒\n` +
      `结束摔倒：${this.sprint.riskMode === 'FALL_ON_END' ? 'YES' : 'NO'}  眩晕剩余：${(this.sprint.stunRemainingMs / 1000).toFixed(1)} 秒`;
    const riceStates = { IDLE: '未交互', PREPARING: '准备中', EATING: '进食中',
      INTERRUPTED: '已中断', COMPLETED: '已完成' };
    const hint = this.rice.rice.completed ? '已吃完'
      : this.control.faction === 'HUMAN' ? 'DeepSeek 娘进食仅在其为玩家时可操作'
      : this.sprint.state !== 'NORMAL' ? '冲刺或眩晕中无法进食'
      : inRange ? '按住 E 进食，移动可中断' : '靠近大米后按住 E';
    this.riceHud.textContent =
      `大米进度：${(this.rice.rice.progressMs / 1000).toFixed(1)} / ${(this.rice.rice.maxProgressMs / 1000).toFixed(1)} 秒\n` +
      `状态：${riceStates[this.rice.rice.interactionState]}\n${hint}`;
    if (phase === 'PAUSED') this.overlayText.textContent = '已暂停 · 按 Esc 继续';
    else if (phase === 'FINISHED') {
      const result = this.match.result!;
      this.overlayText.textContent =
        `${result.winner === 'DEEPSEEK' ? 'DeepSeek 娘' : '人类'}获胜\n` +
        `原因：${result.reason === 'RICE_COMPLETED' ? '测试大米完成' : '抓捕完成'}\n` +
        `对局时间：${time}\n大米：${this.rice.rice.completed ? '已完成' : '未完成'}\n` +
        '[R] 再来一局\n[M] 返回阵营选择';
    } else this.overlayText.textContent = '';
    this.resultActions.hidden = phase !== 'FINISHED';
    this.overlay.hidden = phase !== 'PAUSED' && phase !== 'FINISHED';
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.renderer.dispose();
  }
}
