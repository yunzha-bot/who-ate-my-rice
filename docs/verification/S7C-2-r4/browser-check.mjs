// S7C-2 修复轮 四：白色家具「呼吸轮廓」的真实浏览器复核（本机 Chrome headless + CDP）。
//
// 用法：node --experimental-strip-types browser-check.mjs <bed|carton> <outDir> <tag>
//   tag：after（当前修复后的代码）/ before（把根节点位移缺陷临时改回去的对照）
//
// 复现的正是本轮修复的那条链路：正常扇形释放（`show()`）→ 12 秒冷却结束 →
// 面向家具 → 白色呼吸轮廓。脚本用**真实按键输入 + 真实碰撞移动**走到床边与纸箱旁，
// 然后逐个呼吸相位截屏，直接在 Node 里解码 PNG 做像素统计：
//   · baseline：背对家具（无轮廓）——同一裁剪区里的近白像素应≈0；
//   · facing  ：面向家具，每 250 ms 采一帧（呼吸周期 1.4 s），
//               裁剪区内的亮度均值必须随相位上下变化（而不是只断言 visible === true）；
//   · cooldown：按 Q 之后（描边压暗）——亮度必须明显低于呼吸峰值。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { deflateSync, inflateSync } from 'node:zlib';

const TARGET = process.argv[2] ?? 'bed';
const OUT = process.argv[3] ?? '.';
const TAG = process.argv[4] ?? 'after';
const PORT = 9341;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(path => existsSync(path));
if (!CHROME) throw new Error('找不到本机 Chrome');
mkdirSync(OUT, { recursive: true });
const PROFILE = `${process.env.TEMP}\\s7c2r4-chrome-profile`;

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--window-size=1280,900',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--mute-audio',
  'http://127.0.0.1:5173/'], { stdio: 'ignore', detached: false });

const log = [];
const say = (...args) => { const line = args.join(' '); log.push(line); console.log(line); };

// ---------------------------------------------------------------- PNG 解码
function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error('不支持交错 PNG');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6))
    throw new Error(`不支持的 PNG：depth=${bitDepth} color=${colorType}`);
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  const previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const current = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? current[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      const value = line[i];
      let result;
      if (filter === 0) result = value;
      else if (filter === 1) result = value + a;
      else if (filter === 2) result = value + b;
      else if (filter === 3) result = value + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        result = value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error('未知 PNG 过滤器 ' + filter);
      current[i] = result & 0xff;
    }
    previous.set(current);
  }
  return { width, height, channels, data: out };
}

/**
 * 在**同一相机、同一站位**的连续帧里找出「随呼吸明暗变化的中性白像素」。
 *
 * 不能拿「背对 / 面向」两帧做差：玩家转身是靠真实走位实现的，相机跟随会整体平移，
 * 整屏都会不同。这里改用时间序列：白色轮廓是画面里唯一既中性（R≈G≈B）又在明暗上
 * 大幅周期变化的元素（角色是橙 / 蓝、扇形是薄荷色、DEBUG_MAP 文字与地板静止不动）。
 */
function breathingMask(frames) {
  const { width, height, channels } = frames[0].image;
  const count = width * height;
  const low = new Uint8Array(count).fill(255);
  const high = new Uint8Array(count);
  const neutralAtHigh = new Uint8Array(count);
  for (const frame of frames) {
    const data = frame.image.data;
    for (let pixel = 0, index = 0; pixel < count; pixel++, index += channels) {
      const r = data[index], g = data[index + 1], b = data[index + 2];
      const min = Math.min(r, g, b), max = Math.max(r, g, b);
      if (min < low[pixel]) low[pixel] = min;
      if (min > high[pixel]) {
        high[pixel] = min;
        neutralAtHigh[pixel] = max - min <= 24 ? 1 : 0;
      }
    }
  }
  const pixels = [];
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let pixel = 0; pixel < count; pixel++) {
    // 真正的白色轮廓在呼吸峰值时是**纯白**（min 通道接近 255），而地板（浅灰）、
    // 声音波纹（有色）、DEBUG_MAP 文字（静止）都到不了这个亮度，因此这三条判据
    // 可以把轮廓从「相机微动 / 声音波纹扩散 / AI 走动」里摘出来。
    if (high[pixel] - low[pixel] < 40) continue;   // 没有随呼吸明显变化
    if (high[pixel] < 225) continue;               // 峰值时必须接近纯白
    if (!neutralAtHigh[pixel]) continue;           // 峰值时必须是中性白（排除角色 / 调试色块）
    const x = pixel % width, y = (pixel / width) | 0;
    pixels.push(pixel);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { pixels, box: x1 < 0 ? null : { x0, y0, x1, y1 } };
}

/** 掩膜内的像素统计：亮度均值（RGB 最小通道）与「近白且中性」的像素数。 */
function maskStats(image, mask) {
  let sum = 0, bright = 0, peak = 0;
  for (const pixel of mask.pixels) {
    const index = pixel * image.channels;
    const r = image.data[index], g = image.data[index + 1], b = image.data[index + 2];
    const min = Math.min(r, g, b), max = Math.max(r, g, b);
    sum += min;
    if (min > peak) peak = min;
    if (min > 140 && max - min <= 24) bright++;
  }
  const pixels = mask.pixels.length;
  return { pixels, meanMin: Number((sum / Math.max(1, pixels)).toFixed(2)), bright, peak };
}

// ------------------------------------------------- 只用于「放大留证」的最小 PNG 编码
let crcTable = null;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let value = n;
      for (let bit = 0; bit < 8; bit++)
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[n] = value;
    }
  }
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))]);
}

/** 从已捕获的帧里裁出轮廓区域并放大若干倍（相位确定，不受后续操作影响）。 */
function cropZoom(image, box, scale) {
  const width = (box.x1 - box.x0 + 1) * scale;
  const height = (box.y1 - box.y0 + 1) * scale;
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceX = box.x0 + Math.floor(x / scale);
      const sourceY = box.y0 + Math.floor(y / scale);
      const from = (sourceY * image.width + sourceX) * image.channels;
      const to = (y * width + x) * 3;
      rgb[to] = image.data[from];
      rgb[to + 1] = image.data[from + 1];
      rgb[to + 2] = image.data[from + 2];
    }
  }
  return encodePng(width, height, rgb);
}

// ---------------------------------------------------------------- CDP
async function connect() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === 'page' && t.url.includes('127.0.0.1:5173'));
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('CDP 未就绪');
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.console = [];
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        this.console.push(`[${msg.params.type}] ` + msg.params.args
          .map(a => a.value ?? a.description ?? a.type).join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.console.push('[exception] ' + JSON.stringify(
          msg.params.exceptionDetails.exception?.description ??
          msg.params.exceptionDetails.text));
      } else if (msg.method === 'Log.entryAdded') {
        this.console.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id);
          reject(new Error(`CDP 超时：${method}`)); }
      }, 30_000);
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression,
      returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}

const KEYS = {
  W: { code: 'KeyW', key: 'w', keyCode: 87 },
  A: { code: 'KeyA', key: 'a', keyCode: 65 },
  S: { code: 'KeyS', key: 's', keyCode: 83 },
  D: { code: 'KeyD', key: 'd', keyCode: 68 },
  E: { code: 'KeyE', key: 'e', keyCode: 69 },
  Q: { code: 'KeyQ', key: 'q', keyCode: 81 },
};

const CARTON_TARGET = {
  label: '储物间纸箱',
  centre: { x: 15.7, z: -4.8 },
  regionRadius: 1.2,
  route: [
    { x: 12.6, z: -5.6 }, { x: 14.5, z: -6.8 }, { x: 14.5, z: -6.9, door: true },
    { x: 15.8, z: -6.9 }, { x: 16.1, z: -6.0 }, { x: 16.0, z: -5.6 },
  ],
};
const BED_TARGET = {
  label: '主卧床',
  centre: { x: -13, z: -5 },
  regionRadius: 2.0,
  route: [
    { x: 9.8, z: -5.2 }, { x: 9.8, z: -6.0, door: true }, { x: 8.3, z: -6.0 },
    { x: 8.4, z: -2.0 }, { x: 8.4, z: 0.6 }, { x: 4.0, z: 0.6 }, { x: -0.5, z: 0.8 },
    { x: -2.0, z: 1.0, door: true }, { x: -4.3, z: 0.9 }, { x: -6.8, z: -1.4 },
    { x: -8.0, z: -1.5, door: true }, { x: -9.4, z: -2.2 }, { x: -10.4, z: -3.6 },
    { x: -11.4, z: -5.0 },
  ],
};

function keysFor(dx, dz) {
  const length = Math.hypot(dx, dz) || 1;
  const sx = 0.7071 * (dx - dz) / length;
  const sy = 0.7071 * (dx + dz) / length;
  const keys = [];
  if (sx < -0.35) keys.push('A'); else if (sx > 0.35) keys.push('D');
  if (sy < -0.35) keys.push('W'); else if (sy > 0.35) keys.push('S');
  if (!keys.length) keys.push('W');
  return keys;
}

/**
 * 全局隐藏 3D 画面之外的 DOM（HUD / DEV 面板 / 调试文字），只留 canvas。
 *
 * 注意不能简单遍历 `document.body.children`：canvas 可能被包在容器里，把容器
 * 一起设成 hidden 会让整张截图变成空白（那样「前后帧无差异」就是假证据）。
 * 因此这里沿「包含 canvas 的那条分支」逐层下钻，只隐藏它的兄弟节点。
 */
const HIDE_DOM = `(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 'NO_CANVAS';
  const walk = node => {
    for (const child of [...node.children]) {
      if (child === canvas || child.contains(canvas)) { walk(child); continue; }
      child.style.visibility = 'hidden';
    }
  };
  walk(document.body);
  return 'OK'; })()`;
const SHOW_DOM = `(() => {
  for (const node of document.querySelectorAll('*')) node.style.visibility = '';
  return true; })()`;

/** 画面「丰富度」自检：空白页只会有极少数几种颜色。 */
function variety(image) {
  const seen = new Set();
  for (let y = 0; y < image.height; y += 5) {
    for (let x = 0; x < image.width; x += 5) {
      const index = (y * image.width + x) * image.channels;
      seen.add((image.data[index] << 16) | (image.data[index + 1] << 8) |
        image.data[index + 2]);
    }
  }
  return seen.size;
}

async function main() {
  const wsUrl = await connect();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const cdp = new Cdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });

  const hold = async (codes, ms) => {
    for (const code of codes) await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', ...KEYS[code], modifiers: 0 });
    await sleep(ms);
    for (const code of codes) await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', ...KEYS[code], modifiers: 0 });
  };
  const tap = async code => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...KEYS[code] });
    await sleep(60);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...KEYS[code] });
  };
  const prop = async key => cdp.eval(
    `document.querySelector('[data-property="${key}"] .details-property-value')?.textContent ?? null`);
  const devb = async key => cdp.eval(
    `document.querySelector('[data-entry="${key}"] .dev-b-entry-value')?.textContent ?? null`);
  const hud = async () => cdp.eval(
    `document.querySelector('.skill-hud-state')?.textContent ?? null`);
  const pointOf = async key => {
    const text = await devb(key);
    const match = /\(([-\d.]+), ([-\d.]+)\)/.exec(text ?? '');
    return match ? { x: Number(match[1]), z: Number(match[2]) } : null;
  };
  const rawShot = async () => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(result.data, 'base64');
  };
  const saveShot = async (name, buffer) => {
    const file = `${OUT}/${TAG}-${TARGET}-${name}.png`;
    writeFileSync(file, buffer);
    return file;
  };
  const waitFor = async (expression, attempts = 60) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await cdp.eval(expression)) return true;
      await sleep(500);
    }
    return false;
  };

  const ctx = { cdp, hold, tap, prop, devb, hud, pointOf, rawShot, saveShot, say, waitFor };

  if (!await waitFor(`!!document.querySelector('.faction-menu input[value="DEEPSEEK"]')`))
    throw new Error('阵营菜单没有出现');
  await cdp.eval(`(() => {
    document.querySelector('.faction-menu input[value="HUMAN"]').checked = true;
    document.querySelector('.faction-menu button').click();
    return true; })()`);
  say(`[${TAG}/${TARGET}] 已选择阵营 HUMAN（DeepSeek 娘由 AI 控制）`);

  await sleep(1_500);
  await cdp.eval(`document.querySelector('.debug-toggle')?.click(); true`);
  await waitFor(`!!document.querySelector('[data-property="other/match-phase"]')`);
  await cdp.eval(`(() => { const b = document.querySelector('.dev-b-launcher');
    if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); return true; })()`);
  await waitFor(`!!document.querySelector('[data-entry="movement/DeepSeek 位置"]')`);
  await sleep(500);
  for (let attempt = 0; attempt < 60; attempt++) {
    const phase = await prop('other/match-phase');
    if ((phase ?? '').includes('对局中')) break;
    await sleep(500);
  }
  say(`[${TAG}/${TARGET}] 对局阶段：` + await prop('other/match-phase'));

  const setParam = async (id, value) => {
    const ok = await cdp.eval(`(() => {
      const input = document.querySelector('[data-param="${id}"] .dev-b-param-input');
      if (!input) return false;
      input.value = '${value}';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true; })()`);
    say(`  DEV-B 内存覆盖 ${id} = ${value} → ${ok ? '已应用' : '未找到'}`);
  };
  // 只做内存覆盖，不改正式配置：抓捕圈缩到最小，避免脚本走图时被抓；
  // DeepSeek AI 减速，避免它在测量期间吃满米结束对局。
  await setParam('capture.radius', 0.05);
  await setParam('movement.playerSpeed', 30);
  await sleep(300);

  // ---------------------------------------------------------------- 走到家具旁
  const config = TARGET === 'carton' ? CARTON_TARGET : BED_TARGET;
  for (const waypoint of config.route) {
    await gotoHuman(ctx, waypoint);
    if (waypoint.door) { await tap('E'); await sleep(400); }
  }
  const me = await pointOf('movement/Human 位置');
  say(`[${TAG}/${TARGET}] 玩家位置：` + JSON.stringify(me));
  say(`  DEV 区域合法性：` + await prop('hide/hide-search-region'));
  // 走图器在门框 / 家具角落有随机卡住的可能：没进交互区域就朝最后一个路点补走几步，
  // 否则后面的测量只是在量「没有高亮的画面」。
  const approach = config.route[config.route.length - 1];
  for (let attempt = 0; attempt < 6; attempt++) {
    const region = (await prop('hide/hide-search-region')) ?? '';
    if (region.startsWith('LEGAL')) break;
    say(`  区域未命中（${region.slice(0, 22)}…）→ 朝 ${config.label} 补走（第 ${attempt + 1} 次）`);
    await gotoHuman(ctx, approach);
    await sleep(200);
  }
  say(`  补走后位置：` + JSON.stringify(await pointOf('movement/Human 位置')) +
    `｜区域：` + await prop('hide/hide-search-region'));

  // ---------------------------------------------------------------- 测量
  const summary = { tag: TAG, target: TARGET, label: config.label, player: me,
    dev: {}, samples: [], cooldown: null, verdict: 'UNKNOWN' };
  await cdp.eval(HIDE_DOM);
  await sleep(400);
  say('  自检：隐藏 DOM 后的画面颜色数 = ' + variety(decodePng(await rawShot())));

  // ① 基线：背对家具（没有轮廓）。同时先按一次 Q（旧缺陷正是在这一步把根节点搬走）。
  const here = (await pointOf('movement/Human 位置')) ?? me;
  await faceTowards(ctx, here, { x: here.x + (here.x - config.centre.x),
    z: here.z + (here.z - config.centre.z) });
  await sleep(500);
  say(`  背对${config.label} → DEV：` + await prop('hide/hide-search-target'));
  summary.dev.backwards = await prop('hide/hide-search-target');
  const baselineBuffer = await rawShot();
  await saveShot('baseline-backwards', baselineBuffer);
  summary.baseline = { note: '背对家具：DEV 显示高亮 NONE（此时玩家转身靠真实走位，' +
    '相机随之平移，所以这一帧只作留证，不参与像素比较）' };
  await tap('Q');
  await sleep(600);
  say('  背对按 Q（普通扇形释放，旧代码在这里把表现层根节点搬到了玩家位置）');

  // ② 等 12 秒冷却结束（正式玩法时间），然后面向家具。
  say('  等待 12 秒 Q 冷却结束…');
  for (let attempt = 0; attempt < 40; attempt++) {
    const state = (await prop('hide/hide-search')) ?? '';
    if (state.startsWith('可用')) break;
    await sleep(1_000);
  }
  const now = await pointOf('movement/Human 位置');
  await faceTowards(ctx, now, config.centre);
  await sleep(500);
  const facingDev = await prop('hide/hide-search-target');
  say(`  面向${config.label} → DEV：` + facingDev);
  say(`  面向${config.label} → HUD：` + await hud());
  summary.dev.facing = facingDev;
  summary.dev.hud = await hud();

  // ③ 逐个呼吸相位采样：每 250 ms 一帧，覆盖 1.4 s 呼吸周期 ≈ 3.5 帧/周期。
  const frames = [];
  for (let index = 0; index < 14; index++) {
    const buffer = await rawShot();
    frames.push({ index, image: decodePng(buffer), buffer,
      ai: await pointOf('movement/DeepSeek 位置'),
      state: await prop('hide/hide-search') });
    await sleep(190);
  }

  // ④ 在**同一相机、同一站位**的时间序列里找出真正随呼吸变化的白色像素。
  const mask = breathingMask(frames);
  // 阈值 20：掩膜只收「呼吸峰值接近纯白」的线条核心像素，纸箱这类小家具在屏幕上
  // 的可见轮廓本来就只有 ~30 个这样的像素（床约 116），所以门槛按最小家具定。
  if (!mask.box || mask.pixels.length < 20) {
    // FAIL 路径也要留证：把「面向家具但屏幕上没有任何呼吸变化」的那一帧存下来。
    await saveShot('no-outline-facing', frames[0].buffer);
    throw new Error(`面向家具时画面里找不到可辨识的呼吸轮廓（候选像素 ` +
      `${mask.pixels.length}）`);
  }
  summary.mask = { pixels: mask.pixels.length, box: mask.box };
  say(`  呼吸轮廓掩膜：${mask.pixels.length} 个像素｜屏幕区域 ` +
    JSON.stringify(mask.box));

  let minFrame = frames[0], maxFrame = frames[0];
  for (const frame of frames) {
    frame.stats = maskStats(frame.image, mask);
    if (frame.stats.meanMin < minFrame.stats.meanMin) minFrame = frame;
    if (frame.stats.meanMin > maxFrame.stats.meanMin) maxFrame = frame;
  }
  for (const frame of frames) {
    summary.samples.push({ index: frame.index, ...frame.stats, ai: frame.ai,
      state: frame.state });
    say(`  呼吸采样 ${String(frame.index).padStart(2)}：轮廓区亮度均值 ` +
      `${frame.stats.meanMin}｜近白 ${frame.stats.bright}/${frame.stats.pixels}` +
      `｜Q ${frame.state}｜AI ${frame.ai ? `(${frame.ai.x},${frame.ai.z})` : '—'}`);
  }
  await saveShot('breath-min', minFrame.buffer);
  await saveShot('breath-max', maxFrame.buffer);
  // 放大留证：从已捕获的帧里裁出轮廓区域放大 6 倍，相位是确定的。
  const zoomBox = { x0: Math.max(0, mask.box.x0 - 12), y0: Math.max(0, mask.box.y0 - 12),
    x1: Math.min(frames[0].image.width - 1, mask.box.x1 + 12),
    y1: Math.min(frames[0].image.height - 1, mask.box.y1 + 12) };
  writeFileSync(`${OUT}/${TAG}-${TARGET}-zoom-breath-min.png`,
    cropZoom(minFrame.image, zoomBox, 6));
  writeFileSync(`${OUT}/${TAG}-${TARGET}-zoom-breath-max.png`,
    cropZoom(maxFrame.image, zoomBox, 6));
  say(`  呼吸最暗 / 最亮帧：采样 ${minFrame.index}（${minFrame.stats.meanMin}）/ ` +
    `采样 ${maxFrame.index}（${maxFrame.stats.meanMin}）`);

  // ⑤ 按 Q 之后进入冷却：描边必须压暗（不可用），不能再呼吸成亮白。
  await tap('Q');
  await sleep(800);
  const cooldownBuffer = await rawShot();
  await saveShot('cooldown', cooldownBuffer);
  const cooldownImage = decodePng(cooldownBuffer);
  summary.cooldown = { stats: maskStats(cooldownImage, mask),
    dev: await prop('hide/hide-search-target'), hud: await hud() };
  writeFileSync(`${OUT}/${TAG}-${TARGET}-zoom-cooldown.png`,
    cropZoom(cooldownImage, zoomBox, 6));
  say(`  按 Q 之后 → HUD：${summary.cooldown.hud}`);
  say(`  按 Q 之后 → DEV：${summary.cooldown.dev}`);
  say(`  按 Q 之后（冷却中）轮廓区：` + JSON.stringify(summary.cooldown.stats));

  const means = summary.samples.map(sample => sample.meanMin);
  const amplitude = Number((Math.max(...means) - Math.min(...means)).toFixed(2));
  const dimmerThanMin = summary.cooldown.stats.meanMin < Math.min(...means) - 5;
  const brightRatio = sample => sample.bright / sample.pixels;
  // 掩膜像素全部落在深色家具面上（约 116），所以「每个相位下轮廓区平均亮度都明显
  // 高于这个底色」就等价于「每一帧都看得见白色轮廓」——比数「近白像素」更贴近肉眼。
  const alwaysVisible = summary.samples.every(sample => sample.meanMin > 155);
  summary.metrics = { maskPixels: mask.pixels.length, amplitude, alwaysVisible,
    dimmerThanMin, breathMin: Math.min(...means), breathMax: Math.max(...means),
    cooldownMean: summary.cooldown.stats.meanMin,
    brightRatioMin: Number(Math.min(...summary.samples.map(brightRatio)).toFixed(3)) };
  summary.verdict = mask.pixels.length >= 20 && alwaysVisible && amplitude >= 20 &&
    dimmerThanMin ? 'PASS' : 'FAIL';
  say(`  判定：轮廓像素 ${mask.pixels.length}（≥20）｜呼吸亮度振幅 ${amplitude}（≥20）` +
    `｜每帧都清晰可见=${alwaysVisible}（各相位平均亮度 >155 且最暗 ${Math.min(...means)}）` +
    `｜冷却更暗=${dimmerThanMin} → ${summary.verdict}`);

  // ---------------------------------------------------------------- 控制台 / 产物
  await cdp.eval(SHOW_DOM);
  writeFileSync(`${OUT}/${TAG}-${TARGET}-summary.json`, JSON.stringify(summary, null, 2));
  writeFileSync(`${OUT}/${TAG}-${TARGET}-log.txt`,
    [...log, '--- 浏览器控制台 ---', ...cdp.console].join('\n'));
  say(`[${TAG}/${TARGET}] 控制台条目 ${cdp.console.length} 条`);
  for (const entry of cdp.console.slice(0, 10)) say('  ' + entry);
  ws.close();
  chrome.kill();
  if (summary.verdict !== 'PASS') process.exitCode = 2;
}

/** 朝目标点走：用真实坐标闭环修正；卡住时按 E 开门（最多 6 次）。 */
async function gotoHuman(ctx, target) {
  const { hold, tap, pointOf } = ctx;
  let previous = null;
  let doorPresses = 0;
  for (let step = 0; step < 60; step++) {
    const me = await pointOf('movement/Human 位置');
    if (!me) { await sleep(300); continue; }
    const dx = target.x - me.x;
    const dz = target.z - me.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0.32) return true;
    if (previous && Math.hypot(me.x - previous.x, me.z - previous.z) < 0.06 &&
        doorPresses < 6) {
      doorPresses++;
      await tap('E');
      await sleep(350);
      ctx.say(`  卡在 (${me.x.toFixed(2)}, ${me.z.toFixed(2)}) → 按 E 开门 ` +
        `（${await ctx.prop('other/door-message')}）`);
      previous = null;
      continue;
    }
    previous = { ...me };
    const sx = 0.7071 * (dx - dz) / distance;
    const sy = 0.7071 * (dx + dz) / distance;
    const keys = [];
    if (sx < -0.35) keys.push('A'); else if (sx > 0.35) keys.push('D');
    if (sy < -0.35) keys.push('W'); else if (sy > 0.35) keys.push('S');
    if (!keys.length) keys.push('W');
    const ms = Math.min(420, Math.max(140, Math.min(distance, 1.6) / 4.14 * 1000 * 0.7));
    await hold(keys, ms);
    await sleep(70);
  }
  ctx.say(`走图超时：目标 ${target.x},${target.z}`);
  return false;
}

/** 朝世界方向走一小步（真实输入，因此会同时改变朝向）。 */
async function faceTowards(ctx, from, to) {
  await ctx.hold(keysFor(to.x - from.x, to.z - from.z), 150);
  await sleep(250);
}

main().catch(async error => {
  console.error('脚本失败：', error?.message ?? error);
  log.push('脚本失败：' + (error?.stack ?? error));
  writeFileSync(`${OUT}/${TAG}-${TARGET}-log.txt`, log.join('\n'));
  chrome.kill();
  process.exitCode = 1;
});
