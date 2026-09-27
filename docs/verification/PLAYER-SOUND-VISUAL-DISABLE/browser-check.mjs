// 玩家声音探测表现层（声音范围圈 + 彩色动态声纹）停用的**真实浏览器**复核。
//
// 用法：node browser-check.mjs <outDir> <before|after>
//   （先确保 `http://127.0.0.1:5173/` 已在运行；建议每次先清空本脚本专用的 Chrome 档案）
//
// 同一份脚本在停用前 / 停用后各跑一次，用**同一套操作与同一套像素度量**对比，
// 避免只凭源码推断「看不见了」：
//   1. 选 DeepSeek 阵容开局，等真正进入「对局中」；
//   2. 原地静止采样一组帧（范围圈在 DEV 下可见，声纹等 AI 发声）；
//   3. 按住 W 走一段再采样一组帧（持续产生声音事件）；
//   4. 每一帧都在页面里用浏览器自带的 PNG 解码器统计像素。
//
// 像素度量（只统计，不注入任何游戏代码）：
//   ring      —— 声音范围圈 / 阈值圈专属色 0xb5d8e5 的像素数（±14）。该色只出现在
//                SoundVisualView 的四个面上；容差是实测选出来的：±6 会因圈下方地板颜色不同而漏计，
//                ±20 会把淡紫 / 淡蓝地板算进来。配合固定 `matchSeed`（同场景）后该计数可以对照。
//   waveBlue  —— 蓝色声纹像素：b-r>=60 且 g-r>=40 且 b>=170。**辅助值**：声纹是半透明混合色，
//                任何「贴近纯色」的容差都测不到它，这个宽松判据又会带上场景里本来就有的蓝色，
//                因此它不能单独判定声纹有无；声纹的判据以截图目视为准。
//   waveWarm  —— 黄 / 红两档声纹（0xffd45f / 0xff635b，±8），同样是辅助值。
//
// 为了让「停用前 / 停用后」可比，两轮都用固定 `matchSeed`（S7C-3 的复现入口），
// 因此出生点、门初态、镜头与角色站位一致，像素差异只来自被停用的表现层。
// 脚本还会先向开发服务器要一次 `ThreeGame.ts`，把「服务器此刻真的在发哪一版」写进日志，
// 避免把「改了文件但页面拿到旧模块」当成结论。
//
// 全部走真实 DOM / 真实键盘事件；截图走 Page.captureScreenshot。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2] ?? '.';
const LABEL = process.argv[3] ?? 'run';
const PORT = 9343;
const SEED = 20260927;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(path => existsSync(path));
if (!CHROME) throw new Error('找不到本机 Chrome');
mkdirSync(OUT, { recursive: true });
const PROFILE = `${process.env.TEMP}\\player-sound-visual-chrome-profile`;

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--window-size=1440,900',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--mute-audio',
  `http://127.0.0.1:5173/?matchSeed=${SEED}`], { stdio: 'ignore', detached: false });

const log = [];
const steps = [];
const say = (...args) => { const line = args.join(' '); log.push(line); console.log(line); };

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
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.console = []; this.dialogs = [];
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
      } else if (msg.method === 'Page.javascriptDialogOpening') {
        this.dialogs.push(msg.params.message);
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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

// 页面内统计：把 PNG 交给浏览器自己的解码器，再用 2D canvas 读像素。
const metricsExpression = base64 => `(async () => {
  const img = new Image();
  img.src = 'data:image/png;base64,${base64}';
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const hit = (r, g, b, c, t) => Math.abs(r - c[0]) <= t && Math.abs(g - c[1]) <= t &&
    Math.abs(b - c[2]) <= t;
  let ring = 0, waveBlue = 0, waveWarm = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (hit(r, g, b, [181, 216, 229], 14)) ring++;
    if (b - r >= 60 && g - r >= 40 && b >= 170) waveBlue++;
    if (hit(r, g, b, [255, 212, 95], 8) || hit(r, g, b, [255, 99, 91], 8)) waveWarm++;
  }
  const phase = document.querySelector('[data-property$="match-phase"] ' +
    '.details-property-value')?.textContent ?? '';
  return { width: canvas.width, height: canvas.height, ring, waveBlue, waveWarm, phase };
})()`;

async function main() {
  // 先记录「开发服务器此刻在发哪一版 ThreeGame」：源码 / 打包证据与浏览器证据要能对上。
  const served = await fetch('http://127.0.0.1:5173/src/three/ThreeGame.ts').then(r => r.text());
  const flagValue = /PLAYER_SOUND_VISUAL_ENABLED\s*(?::\s*boolean)?\s*=\s*(true|false)/
    .exec(served)?.[1] ?? 'NOT_FOUND';
  // 开发服务器发的是转译后的 JS：类型注解已被去掉、可选链 `?.` 仍在。
  const updateCalls = (served.match(/soundVisual\??\.update/g) ?? []).length;
  say(`【${LABEL}】开发服务器当前源码：PLAYER_SOUND_VISUAL_ENABLED = ${flagValue}｜` +
    `soundVisual.update 出现 ${updateCalls} 次`);

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

  const waitFor = async (expression, attempts = 60) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await cdp.eval(expression)) return true;
      await sleep(500);
    }
    return false;
  };
  const phase = () => cdp.eval(
    `document.querySelector('[data-property="other/match-phase"] .details-property-value')
      ?.textContent ?? ''`);
  const waitPlaying = async () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const value = await phase();
      if (value.includes('对局中')) return value;
      await sleep(500);
    }
    return '未进入对局';
  };
  const startMatch = async () => {
    if (!await waitFor(`!!document.querySelector('.faction-menu input[value="DEEPSEEK"]')`))
      throw new Error('阵营菜单没有出现');
    await cdp.eval(`(() => {
      const radio = document.querySelector('.faction-menu input[value="DEEPSEEK"]');
      radio.checked = true;
      document.querySelector('.faction-menu button').click();
      return true; })()`);
    await sleep(1_500);
    await cdp.eval(`document.querySelector('.debug-toggle')?.click(); true`);
    await waitFor(`!!document.querySelector('[data-property="other/match-phase"]')`);
    return waitPlaying();
  };
  const capture = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const base64 = result.data;
    if (name) writeFileSync(`${OUT}/${LABEL}-${name}.png`, Buffer.from(base64, 'base64'));
    const metrics = await cdp.eval(metricsExpression(base64));
    return metrics;
  };
  const pressKey = async (type, code, key, keyCode) => cdp.send('Input.dispatchKeyEvent',
    { type, code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  const tapKey = async (code, key, keyCode) => {
    await pressKey('keyDown', code, key, keyCode);
    await sleep(80);
    await pressKey('keyUp', code, key, keyCode);
  };
  const clickText = async (selector, text) => cdp.eval(`(() => {
    const node = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find(value => value.textContent.trim() === ${JSON.stringify(text)});
    if (!node) return 'NOT_FOUND';
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    node.click();
    return hit === node || node.contains(hit) ? 'CLICKED'
      : 'COVERED_BY:' + (hit ? (hit.className || hit.tagName) : 'null'); })()`);
  // 采样一批帧：返回每一帧的度量，并把「蓝色声纹最多 / 范围圈最多」的两帧各存一张图。
  const sampleFrames = async (name, count, gapMs) => {
    const frames = [];
    let bestWave = { waveBlue: -1 }, bestRing = { ring: -1 };
    for (let index = 0; index < count; index++) {
      const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const metrics = await cdp.eval(metricsExpression(result.data));
      frames.push(metrics);
      if (metrics.waveBlue > bestWave.waveBlue) bestWave = { ...metrics, base64: result.data };
      if (metrics.ring > bestRing.ring) bestRing = { ...metrics, base64: result.data };
      await sleep(gapMs);
    }
    const saved = {};
    if (bestWave.base64) {
      writeFileSync(`${OUT}/${LABEL}-${name}-waves.png`, Buffer.from(bestWave.base64, 'base64'));
      saved.waveBlue = bestWave.waveBlue;
    }
    if (bestRing.base64) {
      writeFileSync(`${OUT}/${LABEL}-${name}-rings.png`, Buffer.from(bestRing.base64, 'base64'));
      saved.ring = bestRing.ring;
    }
    const summary = frames.map(f => ({ ring: f.ring, waveBlue: f.waveBlue,
      waveWarm: f.waveWarm, phase: f.phase }));
    const inMatch = frames.filter(f => f.phase.includes('对局中'));
    const inMatchRingMax = inMatch.length ? Math.max(...inMatch.map(f => f.ring)) : null;
    say(`${name}：${count} 帧（其中「对局中」${inMatch.length} 帧）｜` +
      `范围圈专属色 0xb5d8e5(±6) max ${Math.max(...frames.map(f => f.ring))} / ` +
      `min ${Math.min(...frames.map(f => f.ring))}｜对局中 max ${inMatchRingMax}｜` +
      `蓝色声纹像素 max ${Math.max(...frames.map(f => f.waveBlue))} / ` +
      `min ${Math.min(...frames.map(f => f.waveBlue))}｜` +
      `暖色声纹像素 max ${Math.max(...frames.map(f => f.waveWarm))}｜存图：${JSON.stringify(saved)}`);
    return { frames: summary, saved, inMatchFrames: inMatch.length, inMatchRingMax };
  };

  // 真实重开一局：开发配置单局只有约 5～11 秒，每一步采样前都要拿一个新的对局窗口。
  // Esc 偶发被吞，因此最多重试 3 次；仍打不开就如实记录，不虚构成功。
  const restartMatch = async label => {
    let menu = 'NOT_OPENED';
    for (let attempt = 0; attempt < 3 && menu !== 'OPEN'; attempt++) {
      await tapKey('Escape', 'Escape', 27);
      const opened = await waitFor(`(() => { const o = document.querySelector('.pause-actions');
        return !!o && !o.closest('#game-overlay')?.hidden; })()`, 8);
      if (opened) menu = 'OPEN';
      else await sleep(600);
    }
    const clicked = menu === 'OPEN'
      ? await clickText('.pause-actions button', '重新开始') : 'SKIPPED_MENU_NOT_OPEN';
    await sleep(1_200);
    const restartPhase = await waitPlaying();
    say(`重开（${label}）：菜单 ${menu}｜点击 ${clicked}｜阶段 ${restartPhase}`);
    return { menu, clicked, restartPhase };
  };

  const phaseNow = await startMatch();
  const seed = await cdp.eval(`document.querySelector('[data-property$="match-seed"] ' +
    '.details-property-value')?.textContent ?? ''`);
  say(`【${LABEL}】对局阶段：${phaseNow}｜固定种子（URL matchSeed=${SEED}）｜` +
    `面板显示种子：${seed}`);
  await sleep(700);
  const idle = await capture('01-idle');
  say(`静止首帧（${idle.phase}）：范围圈专属色 ${idle.ring}｜蓝色声纹 ${idle.waveBlue}｜` +
    `暖色声纹 ${idle.waveWarm}｜${idle.width}x${idle.height}`);
  const idleBurst = await sampleFrames('02-idle-burst', 6, 300);

  // 声纹触发：用 DEV 面板把临时输入目标切到 Human 并让 Human 走一段。
  // Human 的脚步声属于「另一个阵营」的声音事件，停用前应显示彩色声纹
  // （DEV 探针连重遮挡 / 不可听事件也显示），停用后应完全不出现。
  const possessRestart = await restartMatch('声纹采样前');
  const possess = await clickText('.details-tool-button', '临时控制 Human');
  await sleep(250);
  await pressKey('keyDown', 'KeyW', 'w', 87);
  await sleep(1_200);
  await pressKey('keyUp', 'KeyW', 'w', 87);
  await sleep(150);
  const possessed = await capture('03-possess');
  say(`临时控制 Human：${possess}｜范围圈 ${possessed.ring}｜蓝色声纹 ${possessed.waveBlue}` +
    `（阶段 ${possessed.phase}）`);
  const possessBurst = await sampleFrames('04-possess-burst', 6, 250);
  const released = await clickText('.details-tool-button', '临时控制 DeepSeek 娘');
  say(`归还控制：${released}`);

  const movedRestart = await restartMatch('移动采样前');
  await pressKey('keyDown', 'KeyW', 'w', 87);
  await sleep(1_000);
  await pressKey('keyUp', 'KeyW', 'w', 87);
  await sleep(150);
  const moved = await capture('05-moved');
  say(`移动后首帧（${moved.phase}）：范围圈专属色 ${moved.ring}｜蓝色声纹 ${moved.waveBlue}`);
  const moveBurst = await sampleFrames('06-moved-burst', 6, 300);

  const finalPhase = await phase();
  const known = line => line.includes('THREE.Clock: This module has been deprecated');
  const knownWarnings = cdp.console.filter(known);
  const errors = cdp.console.filter(line => !known(line) && !line.includes('[vite]') &&
    !line.includes('Failed to load resource: the server responded with a status of 404'));
  say(`收尾：阶段 ${finalPhase}｜控制台异常 ${errors.length === 0 ? '无' : errors.join(' | ')}` +
    `（既有 THREE.Clock 告警 ${knownWarnings.length} 条）`);

  steps.push({ label: LABEL, matchSeed: SEED, servedFlag: flagValue, servedUpdateCalls: updateCalls,
    phase: phaseNow, possessRestart, movedRestart, finalPhase, seed,
    idle, idleBurst, possess, possessed, possessBurst, released, moved, moveBurst,
    consoleErrors: errors, knownWarnings });
  writeFileSync(`${OUT}/${LABEL}-summary.json`, JSON.stringify(steps, null, 2));
  writeFileSync(`${OUT}/${LABEL}-log.txt`, log.join('\n') + '\n');
  ws.close();
  chrome.kill();
}

main().catch(error => {
  console.error('复核失败：', error);
  writeFileSync(`${OUT}/${LABEL}-log.txt`, log.join('\n') + `\n复核失败：${error}\n`);
  chrome.kill();
  process.exitCode = 1;
});
