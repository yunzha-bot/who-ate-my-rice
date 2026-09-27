// S7C-2 修复轮 三：真实浏览器（本机 Chrome headless + CDP）集中复核。
// 用法：node --experimental-strip-types browser-check.mjs <playerQ|playerQBedWait> <outDir>
//
// 两个场景都基于**真实游戏循环 + 真实按键输入 + 真实碰撞移动**：
//   playerQ        ：走进储物间纸箱的交互区域 → 背对纸箱按 Q（不得搜家具）→ 冷却结束后
//                    面向纸箱按 Q（白色呼吸高亮 + 只搜这一件家具 + 12 秒冷却）。
//   playerQBedWait ：走到主卧床区域的床边等 DeepSeek AI 按自己的状态机巡视进来，
//                    再现场求解「玩家仍在区域内、AI 落在普通扇形里、床仍在正前方」
//                    的站位，按 Q 必须**抓人而不是搜家具**。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const SCENARIO = process.argv[2] ?? 'playerQ';
const OUT = process.argv[3] ?? '.';
const PORT = 9339;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(path => existsSync(path));
if (!CHROME) throw new Error('找不到本机 Chrome');
mkdirSync(OUT, { recursive: true });
const PROFILE = `${process.env.TEMP}\\s7c2r3-chrome-profile`;

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
  const notice = async () => cdp.eval(
    `document.querySelector('.skill-hud-notice')?.textContent ?? null`);
  const pointOf = async key => {
    const text = await devb(key);
    const match = /\(([-\d.]+), ([-\d.]+)\)/.exec(text ?? '');
    return match ? { x: Number(match[1]), z: Number(match[2]) } : null;
  };
  const shot = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${SCENARIO}-${name}.png`, Buffer.from(result.data, 'base64'));
  };
  const cleanShot = async name => {
    await cdp.eval(`(() => {
      for (const node of document.querySelectorAll('.dev-b-panel, .debug-panel'))
        node.style.visibility = 'hidden';
      return true; })()`);
    await sleep(350);
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
  if (!await waitFor(`!!document.querySelector('.faction-menu input[value="DEEPSEEK"]')`))
    throw new Error('阵营菜单没有出现');
  // 两个场景都是由玩家控制 Human、由 AI 控制 DeepSeek 娘。
  await cdp.eval(`(() => {
    const radio = document.querySelector('.faction-menu input[value="HUMAN"]');
    radio.checked = true;
    document.querySelector('.faction-menu button').click();
    return true;
  })()`);
  say('已选择阵营 HUMAN（DeepSeek 娘由 AI 控制）');

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
  say('对局阶段：' + await prop('other/match-phase'));

  const setParam = async (id, value) => {
    const ok = await cdp.eval(`(() => {
      const input = document.querySelector('[data-param="${id}"] .dev-b-param-input');
      if (!input) return false;
      input.value = '${value}';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    say(`DEV-B 内存覆盖 ${id} = ${value} → ${ok ? '已应用' : '未找到该参数'}`);
    return ok;
  };
  // 只降低抓捕圈半径，避免脚本走图时被普通抓捕提前结束对局（不改正式配置）。
  await setParam('capture.radius', 0.05);
  // playerQBedWait：把 DeepSeek AI 的速度降到 40 px/s，并让它的视觉几乎失效
  // （vision.range 1 u）——它仍然按自己的状态机跑去吃米，但不会被远处的玩家吓跑，
  // 于是它会照常巡视到主卧床区域，脚本才有机会摆出优先抓捕的那一帧。
  // 全部是 DEV-B 内存覆盖，不写回正式配置。
  if (SCENARIO === 'playerQBedWait') {
    await setParam('movement.playerSpeed', 30);
    await setParam('vision.range', 1);
  }
  await sleep(300);

  const ctx = { cdp, hold, tap, prop, devb, hud, notice, pointOf, shot, cleanShot, say,
    setParam };
  if (SCENARIO === 'playerQ') await runPlayerQ(ctx, CARTON_TARGET);
  else if (SCENARIO === 'playerQBed') await runPlayerQBed(ctx);
  else await runPlayerQBedWait(ctx);

  // 收集控制台与 AI JSON（先等两帧把判定事件冲进时间线）
  await sleep(2_500);
  const exportJson = await cdp.eval(`(async () => {
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { window.__s7c2r3Blob = blob; return original.call(URL, blob); };
    const button = [...document.querySelectorAll('button')]
      .find(node => /导出|JSON/.test(node.textContent ?? ''));
    if (!button) return 'NO_EXPORT_BUTTON';
    button.click();
    await new Promise(resolve => setTimeout(resolve, 400));
    URL.createObjectURL = original;
    if (!window.__s7c2r3Blob) return 'NO_BLOB';
    return await window.__s7c2r3Blob.text();
  })()`);
  if (typeof exportJson === 'string' && exportJson.startsWith('{')) {
    writeFileSync(`${OUT}/${SCENARIO}-ai-json.json`, exportJson);
    const parsed = JSON.parse(exportJson);
    say(`AI JSON：formatVersion ${parsed.formatVersion}｜playerSearchEvents ` +
      `${parsed.playerSearchEvents?.length ?? 0} 条｜humanSearchEvents ` +
      `${parsed.humanSearchEvents?.length ?? 0} 条`);
    for (const event of parsed.playerSearchEvents ?? [])
      say(`  玩家 Q ${Math.round(event.t)}ms ${event.type}｜${event.reason}｜` +
        JSON.stringify(event.data ?? {}));
  } else say('AI JSON 导出失败：' + exportJson);

  writeFileSync(`${OUT}/${SCENARIO}-console.txt`,
    [...log, '--- 浏览器控制台 ---', ...cdp.console].join('\n'));
  say(`控制台条目 ${cdp.console.length} 条`);
  for (const entry of cdp.console.slice(0, 20)) say('  ' + entry);
  ws.close();
  chrome.kill();
}

/** 朝目标点走：用真实坐标闭环修正；卡住时按 E 开门（最多 6 次）。 */
async function goto(ctx, target, entryKey) {
  const { hold, tap } = ctx;
  const pointOf = key => ctx.pointOf(key);
  let previous = null;
  let doorPresses = 0;
  for (let step = 0; step < 60; step++) {
    const me = await pointOf(entryKey);
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

const gotoHuman = (ctx, target) => goto(ctx, target, 'movement/Human 位置');

/** 相机相对输入的按键反解：把朝向/走位转成按键组合。 */
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

/** 朝世界方向走一小步（真实输入，因此会同时改变朝向）。 */
async function faceTowards(ctx, from, to) {
  await ctx.hold(keysFor(to.x - from.x, to.z - from.z), 150);
  await sleep(250);
}

/** 读取「Human Q 当前高亮 / 最近一次执行」的 DEV 行，拆成结构化字段。 */
async function readTarget(ctx) {
  const text = (await ctx.prop('hide/hide-search-target')) ?? '';
  return {
    text,
    furniture: /高亮 FURNITURE/.test(text),
    legal: /合法 是/.test(text),
    pointed: /指向 是/.test(text),
    exposedPriority: /暴露目标优先 是/.test(text),
  };
}

/** 家具目标配置：路线、家具中心（= 交互区域圆心）、名字。 */
const CARTON_TARGET = {
  label: '储物间纸箱',
  centre: { x: 15.7, z: -4.8 },
  regionRadius: 1.2,
  route: [
    { x: 12.6, z: -5.6 }, { x: 14.5, z: -6.8 }, { x: 14.5, z: -6.9, door: true },
    { x: 15.8, z: -6.9 }, { x: 16.1, z: -6.0 }, { x: 16.0, z: -5.6 },
  ],
};
// 主卧床：家具中心 (-13,-5)、交互半径 2.0。路线走
// door_living_kitchen(9,-6) → door_hall_living(-3,1) → door_hall_master(-8,-1.5)。
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

/** 场景 1：走进家具交互区域 → 背对（不得搜）→ 冷却结束 → 面向（只搜这一件家具）。 */
async function runPlayerQ(ctx, config = CARTON_TARGET) {
  const { prop, pointOf, cleanShot, say, tap, hud, notice } = ctx;
  const { centre, label, route } = config;
  for (const waypoint of route) {
    await gotoHuman(ctx, waypoint);
    if (waypoint.door) { await tap('E'); await sleep(400); }
  }
  const me = await pointOf('movement/Human 位置');
  say('玩家位置：' + JSON.stringify(me));
  say('  DEV 区域合法性：' + await prop('hide/hide-search-region'));

  // ⓪ 机会性优先抓捕：如果 DeepSeek AI 恰好就在区域内，先试一次「暴露目标优先」。
  if (await tryPriority(ctx, centre, config.regionRadius)) return;

  // ① 留在区域内但**背对**家具：白色高亮必须消失，Q 不得搜家具。
  await faceTowards(ctx, me, { x: me.x + (me.x - centre.x), z: me.z + (me.z - centre.z) });
  await sleep(400);
  const backwards = await readTarget(ctx);
  say(`背对${label} → DEV：` + backwards.text);
  say(`背对${label} → HUD：` + await hud());
  await cleanShot('player-q-backwards');
  await tap('Q');
  await sleep(700);
  say(`背对${label}按 Q → 家具搜查行：` + await prop('hide/hide-search-furniture'));
  say(`背对${label}按 Q → 提示：` + await notice());
  say(`背对${label}按 Q → HUD：` + await hud());
  await cleanShot('player-q-backwards-after-q');

  // ② 等 12 秒冷却结束（正式玩法时间），再面向家具。
  say('等待 12 秒冷却结束…');
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = (await prop('hide/hide-search')) ?? '';
    if (state.startsWith('可用')) break;
    await sleep(1_000);
  }
  const now = await pointOf('movement/Human 位置');
  await faceTowards(ctx, now, centre);
  await sleep(400);
  const facing = await readTarget(ctx);
  say(`面向${label} → DEV：` + facing.text);
  say(`面向${label} → 区域合法性：` + await prop('hide/hide-search-region'));
  say(`面向${label} → HUD：` + await hud());
  await cleanShot('player-q-facing');
  await tap('Q');
  await sleep(700);
  say(`面向${label}按 Q → 家具搜查行：` + await prop('hide/hide-search-furniture'));
  say(`面向${label}按 Q → 提示：` + await notice());
  say(`面向${label}按 Q → 冷却：` + await prop('hide/hide-search'));
  say(`面向${label}按 Q → HUD：` + await hud());
  await cleanShot('player-q-after');
  // ③ 冷却中再按一次：必须被拒绝，且不产生新的搜查。
  await tap('Q');
  await sleep(500);
  say(`冷却中再按 Q → 家具搜查行：` + await prop('hide/hide-search-furniture'));
  say(`冷却中再按 Q → 提示：` + await notice());
}

/**
 * 场景 3：走到主卧床区域后完整跑一遍 Q 分支（背对不搜 / 面向只搜这一件家具）。
 * 与 `playerQ` 的区别只是家具换成了**床**（用户本轮点名的场景）。
 */
async function runPlayerQBed(ctx) {
  await runPlayerQ(ctx, BED_TARGET);
}

/**
 * 尝试摆出并执行「暴露目标优先」的那一帧：DeepSeek AI 必须已经在区域环内，
 * 玩家仍在区域内、AI 落在普通扇形里、且家具仍被指向。成功按 Q 返回 true。
 * 整个过程只用真实几何 + DEV 读数闭环，绝不改写游戏状态来「造」出这一帧。
 */
async function tryPriority(ctx, centre, regionRadius) {
  const { prop, pointOf, cleanShot, say, tap, notice } = ctx;
  const me = await pointOf('movement/Human 位置');
  const ai = await pointOf('movement/DeepSeek 位置');
  if (!me || !ai) return false;
  const aiToCentre = Math.hypot(ai.x - centre.x, ai.z - centre.z);
  if (!(aiToCentre > 1.15 && aiToCentre < regionRadius)) return false;
  const candidates = [];
  for (let dx = -1.3; dx <= 1.3; dx += 0.1) {
    for (let dz = -1.3; dz <= 1.3; dz += 0.1) {
      const point = { x: ai.x + dx, z: ai.z + dz };
      const toAi = Math.hypot(dx, dz);
      if (toAi > 1.35 || toAi < 0.05) continue;
      const dCentre = Math.hypot(point.x - centre.x, point.z - centre.z);
      if (dCentre > regionRadius - 0.1) continue;
      const a1 = Math.atan2(ai.z - point.z, ai.x - point.x);
      const a2 = Math.atan2(centre.z - point.z, centre.x - point.x);
      const delta = Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) *
        180 / Math.PI;
      if (delta > 45) continue;
      const walk = Math.hypot(point.x - me.x, point.z - me.z);
      candidates.push({ point, toAi, delta, walk, toCentre: dCentre,
        margin: Math.min(regionRadius - 0.1 - dCentre, 1.4 - toAi, 45 - delta) -
          walk * 0.15 });
    }
  }
  candidates.sort((a, b) => b.margin - a.margin);
  for (const candidate of candidates.slice(0, 3)) {
    if (candidate.walk > 0.35) await gotoHuman(ctx, candidate.point);
    const now = await pointOf('movement/Human 位置');
    const aiNow = await pointOf('movement/DeepSeek 位置');
    if (!now || !aiNow) continue;
    const realToAi = Math.hypot(aiNow.x - now.x, aiNow.z - now.z);
    if (realToAi > 1.45) continue;
    const toCentreLength = Math.hypot(centre.x - now.x, centre.z - now.z);
    const bisector = {
      x: (aiNow.x - now.x) / realToAi + (centre.x - now.x) / toCentreLength,
      z: (aiNow.z - now.z) / realToAi + (centre.z - now.z) / toCentreLength,
    };
    await faceTowards(ctx, now, { x: now.x + bisector.x, z: now.z + bisector.z });
    const target = await readTarget(ctx);
    say(`  候选 P=(${candidate.point.x.toFixed(2)}, ${candidate.point.z.toFixed(2)})｜` +
      `实际站位 ${JSON.stringify(now)}｜到 AI ${realToAi.toFixed(2)}｜DEV：${target.text}`);
    if (target.legal && target.pointed && target.exposedPriority) {
      await cleanShot('player-q-priority');
      const searchBefore = await prop('hide/hide-search-furniture');
      const fanBefore = await prop('hide/hide-search-counts');
      say('按下 Q 之前 HUD：' + await ctx.hud());
      await tap('Q');
      await sleep(700);
      say('按 Q 之后提示：' + await notice());
      say('按 Q 之后家具搜查行：' + await prop('hide/hide-search-furniture'));
      say('  按 Q 之前家具搜查行：' + searchBefore);
      say('按 Q 之后扇形释放次数：' + await prop('hide/hide-search-counts') +
        `（按 Q 之前 ${fanBefore}）`);
      say('按 Q 之后对局：' + await prop('other/match-phase'));
      await cleanShot('player-q-priority-after');
      return true;
    }
  }
  return false;
}

/** 场景 2：只在主卧床区域等 DeepSeek AI 巡视进来，专测「暴露目标优先」。 */
async function runPlayerQBedWait(ctx) {
  const { prop, pointOf, say, tap } = ctx;
  const centre = BED_TARGET.centre;
  const regionRadius = BED_TARGET.regionRadius;
  for (const waypoint of BED_TARGET.route) {
    await gotoHuman(ctx, waypoint);
    if (waypoint.door) { await tap('E'); await sleep(400); }
  }
  const me0 = await pointOf('movement/Human 位置');
  say('玩家已在主卧床区域：' + JSON.stringify(me0));
  say('  DEV 区域合法性：' + await prop('hide/hide-search-region'));
  await faceTowards(ctx, me0, centre);
  say('  面向床后 DEV：' + (await readTarget(ctx)).text);

  for (let round = 0; round < 300; round++) {
    if ((await prop('other/match-phase') ?? '').includes('已结束')) {
      say(`BLOCKED：对局在构造完成前结束（${await prop('other/match-phase')}）`);
      return;
    }
    const ai = await pointOf('movement/DeepSeek 位置');
    const aiToCentre = ai
      ? Math.hypot(ai.x - centre.x, ai.z - centre.z) : Number.NaN;
    if (round % 4 === 0)
      say(`[${round}] AI ${JSON.stringify(ai)}｜AI 到床心 ` +
        `${Number.isFinite(aiToCentre) ? aiToCentre.toFixed(2) : '—'}`);
    if (await tryPriority(ctx, centre, regionRadius)) return;
    await sleep(500);
  }
  say('BLOCKED：300 轮内未能摆出「指向主卧床 + 暴露目标在扇形内」的同一帧');
}

main().catch(async error => {
  console.error('脚本失败：', error?.message ?? error);
  log.push('脚本失败：' + (error?.stack ?? error));
  writeFileSync(`${OUT}/${SCENARIO}-console.txt`, log.join('\n'));
  chrome.kill();
  process.exitCode = 1;
});
