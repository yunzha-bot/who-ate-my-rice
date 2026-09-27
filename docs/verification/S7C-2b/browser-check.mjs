// S7C-2b：DeepSeek 娘 AI 自主藏身的**真实浏览器**复核（本机 Chrome headless + CDP）。
//
// 用法：node --experimental-strip-types browser-check.mjs <outDir>
//
// 复现的正是本阶段真正要实现的行为：玩家选 Human 阵营（此时 DeepSeek AI 才运行）→
// 用真实按键把 Human 追到 DP 娘身边 → 观察 DP 是否**真的走向某件家具并钻进去**
// （DEV `Hide` 分类的 AI 相位 / 目标点 / 公开理由 / 权威进入结论）→ 拉开距离后
// 观察它是否**自己出来** 并回到吃米。全程用真实按键 + 真实碰撞移动，不做任何瞬移。
//
// 为了让「追逐」在无头环境里可复现，脚本只用 DEV-B 的**仅内存**覆盖层调两个值：
//   · movement.humanSpeedMultiplier ↑：让 Human 追得上（不写回 GAME_CONFIG）；
//   · capture.radius → 0.2：避免人工追逐时误触发抓捕把对局提前结束。
// 两者都是已批准的可调参数，正式平衡值不变。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2] ?? '.';
const PORT = 9343;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(path => existsSync(path));
if (!CHROME) throw new Error('找不到本机 Chrome');
mkdirSync(OUT, { recursive: true });
const PROFILE = `${process.env.TEMP}\\s7c2b-chrome-profile`;

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--window-size=1280,900',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--mute-audio',
  'http://127.0.0.1:5173/'], { stdio: 'ignore', detached: false });

const log = [];
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
    this.ws = ws; this.id = 0; this.pending = new Map(); this.console = [];
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
};

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
  const propDebug = async key => cdp.eval(
    `document.querySelector('[data-property="${key}"]')?.outerHTML.slice(0, 220) ?? 'ROW_NOT_FOUND'`);
  const devb = async entry => cdp.eval(
    `document.querySelector('[data-entry="${entry}"] .dev-b-entry-value')?.textContent ?? null`);
  const pointOf = async entry => {
    const text = await devb(entry);
    const match = /\(([-\d.]+),\s*([-\d.]+)\)/.exec(text ?? '');
    return match ? { x: Number(match[1]), z: Number(match[2]) } : null;
  };
  const shot = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  const cleanShot = async name => {
    await cdp.eval(`(() => {
      for (const node of document.querySelectorAll('.dev-b-panel, .debug-panel'))
        node.style.visibility = 'hidden';
      return true; })()`);
    await sleep(300);
    await shot(name);
    await cdp.eval(`(() => {
      for (const node of document.querySelectorAll('.dev-b-panel, .debug-panel'))
        node.style.visibility = '';
      return true; })()`);
  };
  const waitFor = async (expression, attempts = 60) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await cdp.eval(expression)) return true;
      await sleep(500);
    }
    return false;
  };
  const setParam = async (id, value) => {
    const ok = await cdp.eval(`(() => {
      const input = document.querySelector('[data-param="${id}"] .dev-b-param-input');
      if (!input) return false;
      input.value = '${value}';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    say(`DEV-B 覆盖 ${id} = ${value} → ${ok ? '已应用' : '未找到该参数'}`);
  };
  const dp = () => pointOf('movement/DeepSeek 位置');
  const human = () => pointOf('movement/Human 位置');
  const hideSnapshot = async () => ({
    dp: await dp(), human: await human(),
    hideState: await prop('hide/hide-state'),
    hideCapture: await prop('hide/hide-capture'),
    phase: await prop('hide/hide-ai-phase'),
    reason: await prop('hide/hide-ai-reason'),
    candidate: await prop('hide/hide-ai-candidate'),
    loopguard: await prop('hide/hide-ai-loopguard'),
    exitGate: await prop('hide/hide-ai-exit-gate'),
    entry: await prop('hide/hide-ai-entry'),
    entryDetail: await prop('hide/hide-ai-entry-detail'),
    scores: await prop('hide/hide-ai-scores'),
    dpMode: await prop('deepseek-ai/mode'),
    dpThreat: await prop('deepseek-ai/threat'),
    dpEscapeTarget: await prop('deepseek-ai/escape-target'),
    dpNavigation: await prop('deepseek-ai/navigation-reason'),
  });

  // ---------------------------------------------------------------- 选阵营
  if (!await waitFor(`!!document.querySelector('.faction-menu input[value="HUMAN"]')`))
    throw new Error('阵营菜单没有出现');
  await cdp.eval(`(() => {
    const radio = document.querySelector('.faction-menu input[value="HUMAN"]');
    radio.checked = true;
    document.querySelector('.faction-menu button').click();
    return true; })()`);
  say('已选择阵营 HUMAN（此时 DeepSeek AI 运行）');

  await sleep(1_500);
  await cdp.eval(`document.querySelector('.debug-toggle')?.click(); true`);
  await waitFor(`!!document.querySelector('[data-property="other/match-phase"]')`);
  await cdp.eval(`(() => { const b = document.querySelector('.dev-b-launcher');
    if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); return true; })()`);
  await waitFor(`!!document.querySelector('[data-entry="movement/DeepSeek 位置"]')`);
  for (const key of ['hide/hide-ai-phase', 'hide/hide-ai-reason', 'hide/hide-ai-entry',
    'hide/hide-ai-loopguard']) {
    const present = await cdp.eval(`!!document.querySelector('[data-property="${key}"]')`);
    say(`DEV 字段 ${key}：${present ? '存在' : '缺失'}`);
  }
  await sleep(600);

  for (let attempt = 0; attempt < 60; attempt++) {
    const phase = await prop('other/match-phase');
    if ((phase ?? '').includes('对局中')) break;
    await sleep(500);
  }
  say('对局阶段：' + await prop('other/match-phase'));

  // 让「追逐」在无头环境里可复现：DP 变慢、Human 变快，从而稳定进入
  // hideThreatDistance(3.5) 以内；抓捕圈调小以免人工追逐误触发抓捕提前结束对局。
  await setParam('movement.playerSpeed', 60);
  await setParam('movement.humanSpeedMultiplier', 6);
  await setParam('capture.radius', 0.2);
  await sleep(400);

  // -------------------------------------------------- 实测「按键 → 世界方向」
  // 相机是正交跟随相机，W/A/S/D 是**相机相对**的。这里不猜映射，直接按键测位移，
  // 得到 W 与 D 在世界 XZ 上的单位方向，之后所有走位都由这两个基向量解算。
  const measure = async code => {
    const before = await human();
    await hold([code], 700);
    await sleep(250);
    const after = await human();
    const dx = after.x - before.x, dz = after.z - before.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) throw new Error(`按键 ${code} 没有产生位移（${length.toFixed(3)}）`);
    return { x: dx / length, z: dz / length, speed: length / 0.7 };
  };
  const forward = await measure('W');
  const right = await measure('D');
  say(`按键基向量：W → (${forward.x.toFixed(3)}, ${forward.z.toFixed(3)})，` +
    `D → (${right.x.toFixed(3)}, ${right.z.toFixed(3)})，实测速度约 ` +
    `${right.speed.toFixed(2)} 世界单位/秒`);

  /** 朝世界方向 (dirX, dirZ) 按住相应按键 `ms` 毫秒。 */
  const stepToward = async (dirX, dirZ, ms) => {
    const alongW = dirX * forward.x + dirZ * forward.z;
    const alongD = dirX * right.x + dirZ * right.z;
    const codes = [];
    if (alongW > 0.28) codes.push('W');
    else if (alongW < -0.28) codes.push('S');
    if (alongD > 0.28) codes.push('D');
    else if (alongD < -0.28) codes.push('A');
    if (!codes.length) return false;
    await hold(codes, ms);
    return true;
  };

  /**
   * 走向目标点。公寓里有墙与 18 扇门，直线贪心单独用会卡死在墙上（脚本第一版正是
   * 卡在 10 u 之外 100 秒），因此这里加入有界的**侧向绕行 + 按 E 开门**：
   * 连续 3 次没有靠近就换一个垂直方向走几步并敲一次 E，之后重新直奔目标。
   */
  const walkTo = async (target, tolerate, budgetMs) => {
    const started = Date.now();
    let best = Infinity;
    let stale = 0;
    let detour = 0;
    let detourSign = 1;
    const trail = [];
    while (Date.now() - started < budgetMs) {
      const me = await human();
      const dx = target.x - me.x, dz = target.z - me.z;
      const distance = Math.hypot(dx, dz);
      trail.push({ x: me.x, z: me.z, distance });
      if (distance <= tolerate) return { ok: true, distance, trail };
      if (distance > best - 0.12) stale++; else { stale = 0; detour = 0; }
      best = Math.min(best, distance);
      if (stale >= 3) {
        stale = 0;
        detour = 6;
        detourSign = -detourSign;
        await tap('E');
      }
      const toX = dx / distance, toZ = dz / distance;
      let dirX = toX, dirZ = toZ;
      if (detour > 0) {
        detour--;
        // 垂直方向绕行（左右交替），绕完继续直奔目标。
        dirX = -toZ * detourSign;
        dirZ = toX * detourSign;
      }
      const ms = detour > 0 ? 200 : Math.max(70, Math.min(300, distance * 90));
      if (!await stepToward(dirX, dirZ, ms)) return { ok: false,
        distance, trail, blockedBy: 'NO_KEY_MAPPING' };
      await sleep(50);
    }
    const me = await human();
    return { ok: false,
      distance: Math.hypot(target.x - me.x, target.z - me.z), trail,
      blockedBy: 'BUDGET' };
  };

  writeFileSync(`${OUT}/browser-check-progress.txt`, log.join('\n'));

  // ---------------------------------------------------------------- 追逐
  const before = await hideSnapshot();
  say('追逐前：' + JSON.stringify(before));
  await cleanShot('00-before-chase');

  const chaseStarted = Date.now();
  let chased = false;
  let concealed = null;
  let phaseDebugged = false;
  const timeline = [];
  while (Date.now() - chaseStarted < 210_000) {
    const target = await dp();
    const me = await human();
    if (!target || !me) { await sleep(500); continue; }
    const distance = Math.hypot(target.x - me.x, target.z - me.z);
    const phase = await prop('hide/hide-ai-phase');
    const threat = await prop('deepseek-ai/threat');
    timeline.push({ t: Date.now() - chaseStarted, distance, phase, threat });
    if (timeline.length % 5 === 1) say(`追逐 ${Math.round((Date.now() - chaseStarted) / 1000)}s：` +
      `距离 ${distance.toFixed(2)}｜AI ${phase}｜DP 威胁 ${threat}`);
    if ((phase ?? '').includes('CONCEALED') || (await prop('hide/hide-state'))?.includes('藏身中')) {
      concealed = await hideSnapshot();
      chased = true;
      break;
    }
    if (distance > 1.2) {
      await walkTo(target, 1.2, 8_000);
    } else {
      chased = true;
      // 已经贴到 1.2 u 以内：原地观察 4 秒，让 DP 的威胁评估有机会触发藏身。
      await sleep(4_000);
    }
  }
  writeFileSync(`${OUT}/chase-timeline.json`, JSON.stringify(timeline, null, 1));
  say(`追逐结束（${chased ? '接近过' : '未接近'}）：` +
    `最终距离 ${timeline.length ? timeline[timeline.length - 1].distance.toFixed(2) : '—'}`);

  const afterChase = await hideSnapshot();
  say('贴近后：' + JSON.stringify(afterChase));
  await cleanShot('01-after-chase');

  if (concealed) {
    say('>>> 观察到 AI 自主藏身：' + JSON.stringify(concealed));
    writeFileSync(`${OUT}/concealed-snapshot.json`, JSON.stringify(concealed, null, 1));
    await cleanShot('02-concealed');

    // -------------------------------------------------- 拉开距离 → 自主退出
    const awayStart = await human();
    const dpPoint = concealed.dp;
    const away = { x: awayStart.x + (awayStart.x - dpPoint.x) * 3,
      z: awayStart.z + (awayStart.z - dpPoint.z) * 3 };
    say(`拉开距离：走向 (${away.x.toFixed(2)}, ${away.z.toFixed(2)})`);
    await walkTo(away, 1.2, 20_000);
    const exitStarted = Date.now();
    while (Date.now() - exitStarted < 45_000) {
      const state = await prop('hide/hide-state');
      if (!(state ?? '').includes('藏身中')) break;
      await sleep(1_000);
    }
    const afterExit = await hideSnapshot();
    say('拉开后：' + JSON.stringify(afterExit));
    await cleanShot('03-after-exit');
    writeFileSync(`${OUT}/after-exit-snapshot.json`, JSON.stringify(afterExit, null, 1));
  }

  // ---------------------------------------------------------------- AI JSON
  await sleep(2_500);
  const exportJson = await cdp.eval(`(async () => {
    window.__s7c2bExport = null;
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { window.__s7c2bBlob = blob; return original.call(URL, blob); };
    const button = [...document.querySelectorAll('button')]
      .find(node => /导出|JSON/.test(node.textContent ?? ''));
    if (!button) return 'NO_EXPORT_BUTTON';
    button.click();
    await new Promise(resolve => setTimeout(resolve, 400));
    URL.createObjectURL = original;
    if (!window.__s7c2bBlob) return 'NO_BLOB';
    return await window.__s7c2bBlob.text();
  })()`);

  const summary = { chased, concealed: concealed !== null,
    afterChase, chaseSamples: timeline.length };
  if (typeof exportJson === 'string' && exportJson.startsWith('{')) {
    writeFileSync(`${OUT}/s7c2b-ai-json.json`, exportJson);
    const parsed = JSON.parse(exportJson);
    summary.formatVersion = parsed.formatVersion;
    summary.hideEvents = (parsed.hideEvents ?? []).map(event =>
      `${Math.round(event.t)}ms ${event.type}｜${event.reason}｜${event.spotId ?? '—'}`);
    say(`AI JSON：formatVersion ${parsed.formatVersion}｜hideEvents ` +
      `${(parsed.hideEvents ?? []).length} 条`);
    for (const line of summary.hideEvents) say('  ' + line);
    const failed = (parsed.events ?? []).filter(event => event.type === 'STATE_TRANSITION' &&
      String(event.reason).includes('HIDE'));
    for (const event of failed) say(`  状态迁移 ${Math.round(event.t)}ms ${event.reason}`);
  } else {
    summary.exportError = exportJson;
    say('AI JSON 导出失败：' + exportJson);
  }

  const exceptions = cdp.console.filter(entry => entry.startsWith('[exception]'));
  summary.consoleEntries = cdp.console.length;
  summary.exceptions = exceptions;
  say(`控制台条目 ${cdp.console.length} 条（异常 ${exceptions.length} 条）`);
  for (const entry of cdp.console.slice(0, 15)) say('  ' + entry);

  writeFileSync(`${OUT}/browser-check-summary.json`, JSON.stringify(summary, null, 1));
  writeFileSync(`${OUT}/browser-check-log.txt`, [...log].join('\n'));
  ws.close();
  chrome.kill();
}

await main();
