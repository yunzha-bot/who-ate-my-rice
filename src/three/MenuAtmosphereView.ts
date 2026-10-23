import { OrthographicCamera, Vector3 } from 'three';

/** Opening-only visual tuning. No gameplay state, clocks, input or balance values. */
export const MENU_MOTION = {
  enabled: true, // One switch restores the accepted static opening.
  parallax: { enabled: true, sceneMaxPx: 12, foliageMaxPx: 8, smoothingAt60Fps: .06 },
  foliage: { enabled: true, angleDeg: .55, driftPx: 1.5, periodsSec: [6.4, 7.7] },
  rice: { enabled: true, count: 14, minLifeSec: 6, maxLifeSec: 10, minLengthPx: 3, maxLengthPx: 6.5 },
  interaction: { enabled: true, durationMs: 230, selectionMs: 340,
    cardLiftPx: 5, cardScale: 1.015, selectionScale: 1.025 },
};
const cameraRight = new Vector3(), cameraUp = new Vector3();

export function menuPointer(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const nx = Math.max(-1, Math.min(1, x / Math.max(1, width) * 2 - 1));
  const ny = Math.max(-1, Math.min(1, y / Math.max(1, height) * 2 - 1));
  const length = Math.max(1, Math.hypot(nx, ny));
  return { x: nx / length, y: ny / length }; // Radial bound, including the four corners.
}

export function menuFollow(current: number, target: number, deltaMs: number): number {
  const alpha = 1 - Math.pow(1 - MENU_MOTION.parallax.smoothingAt60Fps, Math.max(0, deltaMs) * .06);
  const next = current + (target - current) * alpha;
  return Math.abs(next - target) < .00001 ? target : next;
}

/** Absolute baseline translation in the camera's screen plane; orientation/frustum never change. */
export function applyMenuCamera(camera: OrthographicCamera, base: Vector3,
  x: number, y: number, width: number, height: number): void {
  const pixels = MENU_MOTION.parallax.sceneMaxPx;
  camera.position.copy(base)
    .addScaledVector(cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion),
      -x * pixels * (camera.right - camera.left) / camera.zoom / Math.max(1, width))
    .addScaledVector(cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion),
      y * pixels * (camera.top - camera.bottom) / camera.zoom / Math.max(1, height));
}

export function menuLeafPose(seconds: number, side: number): { angle: number; x: number; y: number } {
  const t = seconds * Math.PI * 2 / MENU_MOTION.foliage.periodsSec[side];
  const envelope = Math.sin(seconds * .43); // Zero at entry, with a slowly changing breeze.
  return {
    angle: Math.sin(t + side * 1.8) * envelope * MENU_MOTION.foliage.angleDeg,
    x: Math.sin(t * .79 + side * 2.1) * envelope * MENU_MOTION.foliage.driftPx,
    y: Math.sin(t * .61 + side) * envelope * MENU_MOTION.foliage.driftPx * .6,
  };
}

/** Overscan the original artwork uniformly; never stretch edge texels into border strips. */
export function menuLeafCover(x: number, y: number, angleDeg: number, width: number, height: number): number {
  const w = Math.max(1, width), h = Math.max(1, height);
  const angle = Math.abs(angleDeg) * Math.PI / 180;
  return 1 + 2 * Math.max((Math.abs(x) + (h + Math.abs(y)) * angle) / w,
    (Math.abs(y) + (w + Math.abs(x)) * angle) / h);
}

type Rice = { age: number; life: number; x: number; drift: number; length: number; angle: number; alpha: number };
type SafeBox = { left: number; top: number; right: number; bottom: number };

/** One owner for camera/leaf transforms. Called by ThreeGame's existing frame loop; owns no rAF. */
export class MenuAtmosphereView {
  private readonly menu: HTMLElement;
  private readonly camera: OrthographicCamera;
  private readonly baseline = new Vector3();
  private readonly original: HTMLImageElement;
  private readonly foliage: HTMLDivElement;
  private readonly leaves: HTMLDivElement[];
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  private readonly particles: Rice[] = [];
  private safeBoxes: SafeBox[] = [];
  private width = 1;
  private height = 1;
  private menuVisible = false;
  private active = false;
  private disposed = false;
  private seconds = 0;
  private pointer = { x: 0, y: 0 };
  private offset = { x: 0, y: 0 };
  private seed = 1729;
  private visibleRiceCount = 0;

  constructor(menu: HTMLElement, camera: OrthographicCamera) {
    this.menu = menu; this.camera = camera;
    this.original = menu.querySelector<HTMLImageElement>('.menu-foliage')!;
    this.foliage = document.createElement('div');
    this.foliage.className = 'menu-motion-foliage';
    this.foliage.setAttribute('aria-hidden', 'true');
    // The original composite has a transparent vertical middle, not individual leaf cutouts.
    // Two clipped copies retain the accepted source/framing at rest; left/right are branch groups.
    this.leaves = [0, 1].map(side => {
      const leaf = document.createElement('div');
      leaf.className = `menu-motion-leaf menu-motion-leaf-${side}`;
      const image = this.original.cloneNode() as HTMLImageElement;
      image.className = 'menu-motion-leaf-art'; leaf.append(image);
      this.foliage.append(leaf); return leaf;
    });
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'menu-motion-rice'; this.canvas.setAttribute('aria-hidden', 'true');
    this.context = this.canvas.getContext('2d');
    this.original.after(this.foliage, this.canvas);
    this.resize();
    for (let i = 0; i < MENU_MOTION.rice.count; i++) {
      const rice = this.newRice(); rice.age = rice.life * (i + .5) / MENU_MOTION.rice.count;
      this.particles.push(rice);
    }
    const { interaction: it } = MENU_MOTION;
    menu.style.setProperty('--menu-motion-ms', `${it.durationMs}ms`);
    menu.style.setProperty('--menu-card-lift', `${-it.cardLiftPx}px`);
    menu.style.setProperty('--menu-card-scale', String(it.cardScale));
    menu.style.setProperty('--menu-selection-scale', String(it.selectionScale));
    menu.style.setProperty('--menu-selection-ms', `${it.selectionMs}ms`);
    menu.addEventListener('pointermove', this.onPointer, { passive: true });
    menu.addEventListener('scroll', this.measureSafeBoxes, { passive: true });
    window.addEventListener('pointerout', this.onLeave, { passive: true });
    window.addEventListener('blur', this.recenter);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onAvailability);
    this.reduced.addEventListener('change', this.onAvailability);
    this.finePointer.addEventListener('change', this.onAvailability);
    this.resize();
    this.setMenuVisible(true);
  }

  setMenuVisible(visible: boolean): void {
    this.menuVisible = visible;
    const next = visible && MENU_MOTION.enabled && !this.reduced.matches && !document.hidden && !this.disposed;
    if (next === this.active) return;
    if (next) {
      this.baseline.copy(this.camera.position);
      this.seconds = 0; this.measureSafeBoxes();
    } else {
      this.camera.position.copy(this.baseline);
      this.recenter(); this.offset.x = this.offset.y = 0;
      this.context?.clearRect(0, 0, this.width, this.height);
      this.visibleRiceCount = 0;
    }
    this.active = next;
    this.syncChannels();
  }

  private syncChannels(): void {
    const flags: Record<string, boolean> = {
      'data-menu-motion': this.active,
      'data-menu-foliage': this.active && (MENU_MOTION.foliage.enabled || (MENU_MOTION.parallax.enabled && this.finePointer.matches)),
      'data-menu-rice': this.active && MENU_MOTION.rice.enabled,
      'data-menu-interaction': this.active && MENU_MOTION.interaction.enabled,
    };
    for (const [name, value] of Object.entries(flags)) {
      if (this.menu.hasAttribute(name) !== value) this.menu.toggleAttribute(name, value);
    }
  }

  update(deltaMs: number): void {
    this.setMenuVisible(this.menuVisible);
    if (!this.active) return;
    this.syncChannels();
    // Hidden time is never integrated; availability changes reset the pointer and baseline.
    const ms = Math.max(0, Math.min(250, deltaMs));
    this.seconds += ms / 1000;
    const enabled = MENU_MOTION.parallax.enabled && this.finePointer.matches;
    this.offset.x = menuFollow(this.offset.x, enabled ? this.pointer.x : 0, ms);
    this.offset.y = menuFollow(this.offset.y, enabled ? this.pointer.y : 0, ms);
    applyMenuCamera(this.camera, this.baseline, this.offset.x, this.offset.y, this.width, this.height);
    const px = MENU_MOTION.parallax.foliageMaxPx;
    this.leaves.forEach((leaf, side) => {
      const wind = MENU_MOTION.foliage.enabled ? menuLeafPose(this.seconds, side) : { angle: 0, x: 0, y: 0 };
      // Foreground counter-motion creates depth against the camera's scene translation.
      const x = -this.offset.x * px + wind.x, y = -this.offset.y * px + wind.y;
      leaf.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${wind.angle}deg)`;
    });
    // Parallax can remain enabled independently of wind.
    if (MENU_MOTION.rice.enabled) this.drawRice(ms / 1000);
  }

  private onPointer = (event: PointerEvent): void => {
    if (!this.active || event.pointerType !== 'mouse' || !this.finePointer.matches) return;
    this.pointer = menuPointer(event.clientX, event.clientY, this.width, this.height);
  };
  private onLeave = (event: PointerEvent): void => { if (!event.relatedTarget) this.recenter(); };
  private recenter = (): void => { this.pointer.x = this.pointer.y = 0; };
  private onAvailability = (): void => { this.recenter(); this.setMenuVisible(this.menuVisible); };

  private resize = (): void => {
    this.width = Math.max(1, innerWidth); this.height = Math.max(1, innerHeight);
    // Reserve the full motion envelope once per viewport, never resize artwork with the pointer/wind.
    const px = MENU_MOTION.parallax.foliageMaxPx, wind = MENU_MOTION.foliage;
    const cover = menuLeafCover(px + wind.driftPx, px + wind.driftPx * .6,
      wind.angleDeg, this.width, this.height);
    this.leaves.forEach(leaf => leaf.style.setProperty('--menu-leaf-cover', String(cover)));
    // Twelve-ish small grains do not need a Retina-sized full-screen bitmap.
    this.canvas.width = this.width; this.canvas.height = this.height;
    this.measureSafeBoxes();
  };
  private measureSafeBoxes = (): void => {
    this.safeBoxes = [...this.menu.querySelectorAll<HTMLElement>(
      '.menu-logo,.menu-settings,.faction-copy,.faction-description b,.faction-portrait')]
      .map(node => {
        const r = node.getBoundingClientRect();
        const face = node.classList.contains('faction-portrait');
        return face ? { left: r.left + r.width * .25, top: r.top, right: r.right - r.width * .1, bottom: r.top + r.height * .32 }
          : { left: r.left - 14, top: r.top - 14, right: r.right + 14, bottom: r.bottom + 14 };
      });
  };
  private random(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private newRice(): Rice {
    const cfg = MENU_MOTION.rice;
    // Prefer quiet vertical corridors, rather than emitting behind faces and hiding half the pool.
    // Still mask protected rectangles when drifting; only spawning does this bounded search.
    const blockedHeight = (nx: number) => this.safeBoxes.reduce((sum, b) =>
      sum + (nx * this.width >= b.left - 26 && nx * this.width <= b.right + 26
        ? Math.max(0, Math.min(this.height, b.bottom) - Math.max(0, b.top)) : 0), 0);
    let x = this.random(), cost = blockedHeight(x);
    for (let i = 0; i < 10 && cost > 0; i++) {
      const candidate = this.random(), nextCost = blockedHeight(candidate);
      if (nextCost < cost) { x = candidate; cost = nextCost; }
    }
    return { age: 0, life: cfg.minLifeSec + this.random() * (cfg.maxLifeSec - cfg.minLifeSec),
      x, drift: (this.random() - .5) * 24,
      length: cfg.minLengthPx + this.random() * (cfg.maxLengthPx - cfg.minLengthPx),
      angle: this.random() * Math.PI, alpha: .45 + this.random() * .35 };
  }
  private drawRice(dt: number): void {
    const ctx = this.context;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.visibleRiceCount = 0;
    for (const rice of this.particles) {
      rice.age += dt;
      if (rice.age >= rice.life) Object.assign(rice, this.newRice()); // Fixed pool, never append.
      const p = rice.age / rice.life;
      const x = rice.x * this.width + Math.sin(p * Math.PI * 2 + rice.angle) * rice.drift;
      const y = -12 + p * (this.height + 24);
      if (this.safeBoxes.some(b => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom)) continue;
      if (y < 0 || y > this.height || x < 0 || x > this.width) continue;
      this.visibleRiceCount++;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rice.angle + p * .55);
      ctx.globalAlpha = rice.alpha * Math.min(1, p * 15, (1 - p) * 15);
      ctx.fillStyle = '#fffbed';
      const l = rice.length / 2, w = rice.length * .17;
      ctx.beginPath(); ctx.moveTo(-l, 0);
      ctx.bezierCurveTo(-l * .4, -w, l * .6, -w, l, 0);
      ctx.bezierCurveTo(l * .4, w, -l * .6, w, -l, 0); ctx.fill();
      ctx.strokeStyle = '#dccfb0'; ctx.lineWidth = .35; ctx.stroke(); ctx.restore();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.setMenuVisible(false); this.disposed = true;
    this.menu.removeEventListener('pointermove', this.onPointer);
    this.menu.removeEventListener('scroll', this.measureSafeBoxes);
    window.removeEventListener('pointerout', this.onLeave);
    window.removeEventListener('blur', this.recenter);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onAvailability);
    this.reduced.removeEventListener('change', this.onAvailability);
    this.finePointer.removeEventListener('change', this.onAvailability);
    this.foliage.remove(); this.canvas.remove();
    for (const name of ['--menu-motion-ms', '--menu-card-lift', '--menu-card-scale',
      '--menu-selection-scale', '--menu-selection-ms']) this.menu.style.removeProperty(name);
  }
}
