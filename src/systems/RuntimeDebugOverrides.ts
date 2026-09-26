import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { SoundType } from './PerceptionSystem.ts';

// DEV-B runtime parameter layer.
//
// GAME_CONFIG stays the single read-only source of balance values: this module
// never writes to it, never persists anything and only remembers a whitelist of
// per-page overrides in memory. Every tunable field is consumed by the real
// gameplay systems through the typed getters below, so a number that changes in
// the panel changes the same value the game actually reads.
//
// Lifecycle contract (see docs/DEV_B_RUNTIME_DEBUG_DESIGN.md):
// - overrides live only in the current page's memory (no file, no localStorage);
// - closing the DEV panel keeps them, a new round/restart clears them;
// - snapshots allow restoring the values that were effective when DEV-B opened.

export type RuntimeParamGroup = 'capture' | 'vision' | 'hearing' | 'movement';

export interface RuntimeParamSpec {
  id: string;
  group: RuntimeParamGroup;
  groupLabel: string;
  label: string;
  unit: string;
  base: number;
  min: number;
  max: number;
  step: number;
  /** Whether the next real decision already uses the new value. */
  immediate: boolean;
  /** When the new value takes effect, in plain Chinese. */
  effect: string;
}

export const RUNTIME_SOUND_TYPES = Object.keys(GAME_CONFIG.perception.sounds) as SoundType[];

const GROUP_LABELS: Record<RuntimeParamGroup, string> = {
  capture: '抓捕',
  vision: '视觉',
  hearing: '听觉',
  movement: '移动',
};

const group = (id: RuntimeParamGroup): string => GROUP_LABELS[id];

function spec(value: Omit<RuntimeParamSpec, 'groupLabel'>): RuntimeParamSpec {
  return { ...value, groupLabel: group(value.group) };
}

export const RUNTIME_PARAM_SPECS: readonly RuntimeParamSpec[] = [
  spec({
    id: 'capture.radius', group: 'capture', label: '抓捕圈半径', unit: '世界单位',
    base: GAME_CONFIG.match.captureRadius, min: 0.2, max: 3, step: 0.05, immediate: true,
    effect: '下一次真实抓捕资格判定；改动会立即清空当前抓捕累计进度',
  }),
  spec({
    id: 'vision.range', group: 'vision', label: '基础视觉距离', unit: '世界单位',
    base: GAME_CONFIG.perception.visionRange, min: 1, max: 30, step: 0.5, immediate: true,
    effect: '下一次真实视觉检测（距离 + 墙体/关门遮挡，无视锥角）',
  }),
  ...RUNTIME_SOUND_TYPES.flatMap(type => [
    spec({
      id: `hearing.range.${type}`, group: 'hearing', label: `${type} 有效传播范围`,
      unit: '世界单位', base: GAME_CONFIG.perception.sounds[type].range,
      min: 0.5, max: 40, step: 0.5, immediate: false,
      effect: '只影响修改后新产生的该类声音事件；已在场事件保留生成时的范围',
    }),
    spec({
      id: `hearing.strength.${type}`, group: 'hearing', label: `${type} 事件强度`,
      unit: '无量纲', base: GAME_CONFIG.perception.sounds[type].strength,
      min: 0, max: 2, step: 0.05, immediate: false,
      effect: '只影响修改后新产生的该类声音事件',
    }),
    spec({
      id: `hearing.lifetime.${type}`, group: 'hearing', label: `${type} 事件寿命`,
      unit: '毫秒', base: GAME_CONFIG.perception.sounds[type].lifetimeMs,
      min: 100, max: 10_000, step: 100, immediate: false,
      effect: '只影响修改后新产生的该类声音事件',
    }),
  ]),
  spec({
    id: 'hearing.falloffPower', group: 'hearing', label: '距离衰减指数', unit: '无量纲',
    base: GAME_CONFIG.perception.distanceFalloffPower, min: 0.2, max: 4, step: 0.05,
    immediate: true, effect: '下一次声音分析（含已在场事件）',
  }),
  spec({
    id: 'hearing.wallFactor', group: 'hearing', label: '墙体声音削弱系数', unit: '倍率',
    base: GAME_CONFIG.perception.wallSoundFactor, min: 0, max: 1, step: 0.01, immediate: true,
    effect: '下一次声音分析（含已在场事件）',
  }),
  spec({
    id: 'hearing.openDoorFactor', group: 'hearing', label: 'OPEN 门声音削弱系数', unit: '倍率',
    base: GAME_CONFIG.perception.openDoorSoundFactor, min: 0, max: 1, step: 0.01,
    immediate: true, effect: '下一次声音分析（含已在场事件）',
  }),
  spec({
    id: 'hearing.closedDoorFactor', group: 'hearing', label: 'CLOSED 门声音削弱系数',
    unit: '倍率', base: GAME_CONFIG.perception.closedDoorSoundFactor,
    min: 0, max: 1, step: 0.01, immediate: true, effect: '下一次声音分析（含已在场事件）',
  }),
  spec({
    id: 'hearing.lockedDoorFactor', group: 'hearing', label: 'LOCKED 门声音削弱系数',
    unit: '倍率', base: GAME_CONFIG.perception.lockedDoorSoundFactor,
    min: 0, max: 1, step: 0.01, immediate: true, effect: '下一次声音分析（含已在场事件）',
  }),
  spec({
    id: 'hearing.minAudible', group: 'hearing', label: '最小可听强度', unit: '无量纲',
    base: GAME_CONFIG.perception.minimumAudibleStrength, min: 0, max: 0.5, step: 0.001,
    immediate: true, effect: '下一次声音分析的可听判定（含已在场事件）',
  }),
  spec({
    id: 'movement.playerSpeed', group: 'movement', label: 'DeepSeek 基础速度', unit: '像素/秒',
    base: GAME_CONFIG.player.speed, min: 30, max: 600, step: 5, immediate: true,
    effect: '下一次真实移动，同时影响 AI 的路程时间估算（不重建导航网格）',
  }),
  spec({
    id: 'movement.humanSpeedMultiplier', group: 'movement', label: 'Human 速度倍率', unit: '倍率',
    base: GAME_CONFIG.human.speedMultiplier, min: 0.2, max: 3, step: 0.01, immediate: true,
    effect: '下一次真实移动（Human 玩家与 Human AI 的基础速度）',
  }),
  spec({
    id: 'movement.humanAiMultiplier', group: 'movement', label: 'Human AI 移速倍率',
    unit: '倍率', base: GAME_CONFIG.humanAI.movementSpeedMultiplier,
    min: 0.2, max: 2, step: 0.01, immediate: true,
    effect: '下一次 Human AI 真实移动；不影响 Human 玩家手动移动',
  }),
];

// Fields DEV-B deliberately refuses to tune, with the reason it must stay fixed.
export const RUNTIME_EXCLUDED_PARAMS: readonly { label: string; reason: string }[] = [
  { label: 'captureMs（连续抓捕时间）', reason: '属已验收核心规则，改变它会重写抓捕机制' },
  { label: 'READY 准备时间', reason: '属阶段计时，与调试覆盖层无关' },
  { label: '冲刺时长 / 眩晕 / 30 秒冷却', reason: '属已验收技能平衡' },
  { label: '角色碰撞半径', reason: '会改变碰撞与合法站立语义' },
  { label: '导航网格尺寸', reason: '会要求重建整张导航网格' },
  { label: '家具碰撞 / 地图几何 / 门锁规则', reason: '属地图与门系统唯一来源' },
  { label: '正式 AI 状态机与藏身玩法', reason: 'DEV-B 只观察，不新增状态' },
];

export interface RuntimeParamChange {
  kind: 'set' | 'clear' | 'clearAll' | 'restore';
  ids: readonly string[];
}

export type RuntimeParamResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

export type RuntimeOverrideSnapshot = Readonly<Record<string, number>>;

export class RuntimeDebugOverrides {
  private readonly specs = new Map<string, RuntimeParamSpec>();
  private readonly values = new Map<string, number>();
  private readonly listeners = new Set<(change: RuntimeParamChange) => void>();
  private revisionValue = 0;

  constructor(specs: readonly RuntimeParamSpec[] = RUNTIME_PARAM_SPECS) {
    for (const value of specs) this.specs.set(value.id, value);
  }

  get revision(): number { return this.revisionValue; }

  list(): RuntimeParamSpec[] { return [...this.specs.values()]; }

  specOf(id: string): RuntimeParamSpec | null { return this.specs.get(id) ?? null; }

  isOverridden(id: string): boolean { return this.values.has(id); }

  get overrideCount(): number { return this.values.size; }

  /** Effective value: the override when present, otherwise the GAME_CONFIG base. */
  get(id: string): number {
    const override = this.values.get(id);
    if (override !== undefined) return override;
    const spec = this.specs.get(id);
    if (!spec) throw new Error(`未知的 DEV-B 参数：${id}`);
    return spec.base;
  }

  set(id: string, raw: unknown): RuntimeParamResult {
    const spec = this.specs.get(id);
    if (!spec) return { ok: false, message: `未知参数：${id}` };
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return { ok: false, message: `${spec.label} 必须是有限数字（不接受 NaN / Infinity / 非数字）` };
    }
    if (raw < spec.min || raw > spec.max) {
      return { ok: false, message: `${spec.label} 需在 ${spec.min}–${spec.max} ${spec.unit} 之间` };
    }
    if (this.values.get(id) === raw) return { ok: true, value: raw };
    this.values.set(id, raw);
    this.emit({ kind: 'set', ids: [id] });
    return { ok: true, value: raw };
  }

  clear(id: string): boolean {
    if (!this.values.delete(id)) return false;
    this.emit({ kind: 'clear', ids: [id] });
    return true;
  }

  clearAll(): number {
    if (this.values.size === 0) return 0;
    const ids = [...this.values.keys()];
    this.values.clear();
    this.emit({ kind: 'clearAll', ids });
    return ids.length;
  }

  snapshot(): RuntimeOverrideSnapshot { return Object.fromEntries(this.values); }

  /** Replaces every override with the snapshot, reporting one combined change. */
  restore(snapshot: RuntimeOverrideSnapshot): void {
    const ids = new Set<string>([...this.values.keys(), ...Object.keys(snapshot)]);
    this.values.clear();
    for (const [id, value] of Object.entries(snapshot)) {
      const spec = this.specs.get(id);
      if (!spec || !Number.isFinite(value)) continue;
      this.values.set(id, Math.min(spec.max, Math.max(spec.min, value)));
    }
    this.emit({ kind: 'restore', ids: [...ids] });
  }

  subscribe(listener: (change: RuntimeParamChange) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // Typed effective values consumed by the real systems.
  get captureRadius(): number { return this.get('capture.radius'); }
  get visionRange(): number { return this.get('vision.range'); }
  get distanceFalloffPower(): number { return this.get('hearing.falloffPower'); }
  get minimumAudibleStrength(): number { return this.get('hearing.minAudible'); }
  get wallSoundFactor(): number { return this.get('hearing.wallFactor'); }
  get openDoorSoundFactor(): number { return this.get('hearing.openDoorFactor'); }
  get closedDoorSoundFactor(): number { return this.get('hearing.closedDoorFactor'); }
  get lockedDoorSoundFactor(): number { return this.get('hearing.lockedDoorFactor'); }
  get playerSpeedPx(): number { return this.get('movement.playerSpeed'); }
  get humanSpeedMultiplier(): number { return this.get('movement.humanSpeedMultiplier'); }
  get humanAIMovementMultiplier(): number { return this.get('movement.humanAiMultiplier'); }

  soundRange(type: SoundType): number { return this.get(`hearing.range.${type}`); }
  soundStrength(type: SoundType): number { return this.get(`hearing.strength.${type}`); }
  soundLifetimeMs(type: SoundType): number { return this.get(`hearing.lifetime.${type}`); }

  // `SoundTuning` implementation consumed by SoundEventSystem.
  range(type: SoundType): number { return this.soundRange(type); }
  strength(type: SoundType): number { return this.soundStrength(type); }
  lifetimeMs(type: SoundType): number { return this.soundLifetimeMs(type); }

  private emit(change: RuntimeParamChange): void {
    this.revisionValue++;
    for (const listener of this.listeners) listener(change);
  }
}

/** Structural view the AI controllers and perception systems depend on. */
export interface RuntimeTuning {
  readonly captureRadius: number;
  readonly visionRange: number;
  readonly playerSpeedPx: number;
  readonly humanSpeedMultiplier: number;
  readonly humanAIMovementMultiplier: number;
}
