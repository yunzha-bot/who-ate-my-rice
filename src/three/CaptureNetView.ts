import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { CaptureNetSystem, type NetPlacementCheck } from '../systems/CaptureNetSystem.ts';
import type { ThrowPoint, ThrowTrace } from '../systems/ThrowableSystem.ts';

/** Mouse ownership and procedural net only; all clocks/rules live in CaptureNetSystem. */
export class CaptureNetView {
  readonly root = new THREE.Group();
  readonly status = document.createElement('div');
  private readonly nets = Array.from({ length: GAME_CONFIG.captureNet.maxActiveNets }, () => this.makeNet());
  private readonly preview = this.makeNet();
  private readonly caught = this.makeNet();
  private readonly range: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly mouse = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private pointer: ThrowPoint | null = null;
  private owned = false;
  private swallowClick = false;
  private disposed = false;
  private touchPointer: number | null = null;
  private readonly touchControls = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.Camera;
  private readonly system: CaptureNetSystem;
  private readonly human: () => ThrowPoint;
  private readonly deepseek: () => ThrowPoint;
  private readonly canUse: () => boolean;
  private readonly trace: ThrowTrace;
  private readonly check: NetPlacementCheck;
  private readonly humanObserver: () => boolean;
  private readonly deepseekVisible: () => boolean;

  constructor(canvas: HTMLCanvasElement, scene: THREE.Scene,
    camera: THREE.Camera, system: CaptureNetSystem,
    human: () => ThrowPoint, deepseek: () => ThrowPoint,
    canUse: () => boolean, trace: ThrowTrace, check: NetPlacementCheck,
    humanObserver: () => boolean, deepseekVisible: () => boolean = () => true) {
    this.canvas = canvas; this.camera = camera; this.system = system;
    this.human = human; this.deepseek = deepseek; this.canUse = canUse;
    this.trace = trace; this.check = check;
    this.humanObserver = humanObserver;
    this.deepseekVisible = deepseekVisible;
    this.range = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 64 }, (_, i) => new THREE.Vector3(
        Math.cos(i * Math.PI / 32) * system.config.placeRange, .06,
        Math.sin(i * Math.PI / 32) * system.config.placeRange))),
    new THREE.LineBasicMaterial({ color: 0xffc768 }));
    this.root.name = 'capture-net'; this.root.add(...this.nets, this.preview, this.caught, this.range);
    scene.add(this.root);
    this.status.className = 'capture-net-status'; this.status.setAttribute('role', 'status');
    canvas.parentElement?.append(this.status);
    canvas.addEventListener('pointerdown', this.down, true);
    window.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up, true);
    canvas.addEventListener('lostpointercapture', this.pointerCancel);
    canvas.addEventListener('click', this.click, true);
    canvas.addEventListener('contextmenu', this.context, true);
    window.addEventListener('blur', this.cancel);
    window.addEventListener('pointercancel', this.pointerCancel);
    this.sync();
  }
  private makeNet(): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const r = GAME_CONFIG.captureNet.radius;
    const points: THREE.Vector3[] = [];
    for (let i = -4; i <= 4; i++) {
      const a = i / 4 * r, b = Math.sqrt(Math.max(0, r * r - a * a));
      points.push(new THREE.Vector3(a, .065, -b), new THREE.Vector3(a, .065, b),
        new THREE.Vector3(-b, .065, a), new THREE.Vector3(b, .065, a));
    }
    return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xc67c29, depthWrite: false }));
  }
  begin(): boolean {
    if (!this.canUse() || !this.system.beginAim()) return false;
    this.owned = true; return true;
  }
  cancel = (): void => {
    if (this.owned) this.system.cancel();
    this.owned = false; this.pointer = null;
    this.touchPointer = null;
  };
  private move = (e: PointerEvent): void => {
    if (this.touchPointer !== null && e.pointerId !== this.touchPointer) return;
    if (e.target !== this.canvas || !this.owned) { this.pointer = null; return; }
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.set((e.clientX - rect.left) / rect.width * 2 - 1,
      -(e.clientY - rect.top) / rect.height * 2 + 1);
    this.camera.updateMatrixWorld(true); this.ray.setFromCamera(this.mouse, this.camera);
    this.pointer = this.ray.ray.intersectPlane(this.plane, this.hit)
      ? { x: this.hit.x, z: this.hit.z } : null;
  };
  private down = (e: PointerEvent): void => {
    if (!this.owned || !this.canUse()) return;
    if (e.pointerType === 'touch' && this.touchPointer !== null) {
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    this.swallowClick = true; e.preventDefault(); e.stopImmediatePropagation();
    if (e.button === 2) { this.cancel(); return; }
    this.move(e);
    if (e.pointerType === 'touch') {
      this.touchPointer = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (this.pointer && this.system.mode === 'AIMING')
      this.system.place(this.human(), this.pointer, this.trace, this.check);
  };
  private up = (event: PointerEvent): void => {
    if (event.pointerId === this.touchPointer) {
      this.move(event);
      this.touchPointer = null;
      if (this.owned && this.canUse() && this.pointer && this.system.mode === 'AIMING')
        this.system.place(this.human(), this.pointer, this.trace, this.check);
    }
    this.blockGesture(event);
  };
  private pointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.touchPointer || (event.pointerType !== 'touch' && this.touchPointer === null)) this.cancel();
  };
  private blockGesture = (e: Event): void => {
    if (this.swallowClick) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  private click = (e: Event): void => { this.blockGesture(e); this.swallowClick = false; };
  private context = (e: Event): void => {
    if (this.owned || this.swallowClick) { e.preventDefault(); e.stopImmediatePropagation(); this.cancel(); this.swallowClick = false; }
  };
  sync(): void {
    if (this.owned && (!this.canUse() || this.system.mode === 'NONE')) this.cancel();
    const humanObserver = this.humanObserver();
    this.nets.forEach((view, index) => {
      const net = this.system.nets[index];
      view.visible = humanObserver && !!net;
      if (!net) return;
      view.position.set(net.x, 0, net.z);
      view.material.color.setHex(net.ageMs >= this.system.config.armMs ? 0xc67c29 : 0x858c8c);
    });
    this.caught.visible = this.system.rootMs > 0 && this.deepseekVisible();
    if (this.caught.visible) {
      const p = this.deepseek(); this.caught.position.set(p.x, .15, p.z);
      this.caught.rotation.x = -.45;
    }
    const point = this.system.pending ?? this.pointer;
    this.preview.visible = humanObserver && this.owned && !!point;
    this.range.visible = humanObserver && this.owned && this.system.mode === 'AIMING';
    const human = this.human(); this.range.position.set(human.x, 0, human.z);
    if (this.preview.visible && point) {
      this.preview.position.set(point.x, 0, point.z);
      this.preview.material.color.setHex(this.system.valid(human, point, this.trace, this.check) ? 0x43a6a1 : 0xd75442);
    }
    this.status.hidden = !humanObserver || !this.owned;
    this.status.textContent = this.touchControls ? this.system.placing ? '正在布网 · 点取消可中止'
      : '触摸空地拖动预览，绿色可放；松手布网 · 点取消可退出' : this.system.placing
      ? `正在布网 ${Math.floor(this.system.placementMs / this.system.config.placeMs * 100)}% · 右键或 Esc 取消`
      : '捕捉网 · 移动鼠标选择近处空地，绿色可放 · 左键确认 · 右键或 Esc 取消';
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.cancel();
    this.canvas.removeEventListener('pointerdown', this.down, true);
    window.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up, true);
    this.canvas.removeEventListener('lostpointercapture', this.pointerCancel);
    this.canvas.removeEventListener('click', this.click, true);
    this.canvas.removeEventListener('contextmenu', this.context, true);
    window.removeEventListener('blur', this.cancel);
    window.removeEventListener('pointercancel', this.pointerCancel);
    this.root.removeFromParent(); this.status.remove();
    for (const line of [...this.nets, this.preview, this.caught, this.range]) {
      line.geometry.dispose(); line.material.dispose();
    }
  }
}
