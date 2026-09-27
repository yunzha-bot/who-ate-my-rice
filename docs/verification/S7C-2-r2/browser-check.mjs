// S7C-2 修复轮 二：真实浏览器（本机 Chrome headless + CDP）集中复核。
// 用法：node --experimental-strip-types browser-check.mjs <playerQ|bedAi> <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const SCENARIO = process.argv[2] ?? 'bedAi';
const OUT = process.argv[3] ?? '.';
const PORT = 9339;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(path => existsSync(path));
if (!CHROME) throw new Error('找不到本机 Chrome');
mkdirSync(OUT, { recursive: true });
const PROFILE = `${process.env.TEMP}\\s7c2r2-chrome-profile`;

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
  const pointOf = async key => {
    const text = await devb(key);
    const match = /\(([-\d.]+), ([-\d.]+)\)/.exec(text ?? '');
    return match ? { x: Number(match[1]), z: Number(match[2]) } : null;
  };
  const shot = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  // 只隐藏视觉（不改 hidden / aria-pressed），这样 DEV-B 面板仍在刷新，
  // 读到的状态与截图里的场景是同一帧。
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

  // 阵营选择 → 对局中
  const waitFor = async (expression, attempts = 60) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await cdp.eval(expression)) return true;
      await sleep(500);
    }
    return false;
  };
  if (!await waitFor(`!!document.querySelector('.faction-menu input[value="DEEPSEEK"]')`))
    throw new Error('阵营菜单没有出现');
  const faction = SCENARIO === 'playerQ' ? 'HUMAN' : 'DEEPSEEK';
  await cdp.eval(`(() => {
    const radio = document.querySelector('.faction-menu input[value="${faction}"]');
    radio.checked = true;
    document.querySelector('.faction-menu button').click();
    return true;
  })()`);
  say(`已选择阵营 ${faction}`);

  // 展开 DEV 面板与 DEV-B 面板
  await sleep(1_500);
  await cdp.eval(`document.querySelector('.debug-toggle')?.click(); true`);
  await waitFor(`!!document.querySelector('[data-property="other/match-phase"]')`);
  await cdp.eval(`(() => { const b = document.querySelector('.dev-b-launcher');
    if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); return true; })()`);
  await waitFor(`!!document.querySelector('[data-entry="movement/DeepSeek 位置"]')`);
  await sleep(500);

  // 等 READY 结束进入 PLAYING
  for (let attempt = 0; attempt < 60; attempt++) {
    const phase = await prop('other/match-phase');
    if ((phase ?? '').includes('对局中')) break;
    await sleep(500);
  }
  say('对局阶段：' + await prop('other/match-phase'));

  // DEV-B 内存覆盖：降低 Human AI 移速与抓捕圈，避免脚本走图时被抓（不写回正式配置）
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
  await setParam('movement.humanAiMultiplier', 0.45);
  await setParam('capture.radius', 0.05);
  await sleep(300);

  writeFileSync(`${OUT}/${SCENARIO}-console.txt`, log.join('\n'));

  if (SCENARIO === 'bedAi') await runBedAi({ cdp, hold, tap, prop, devb, pointOf, shot,
    cleanShot, say });
  else await runPlayerQ({ cdp, hold, tap, prop, devb, pointOf, shot, cleanShot, say,
    setParam });

  // 收集控制台与 AI JSON（先等两帧把判定事件冲进时间线，否则会漏掉最后两条）
  await sleep(2_500);
  const exportJson = await cdp.eval(`(async () => {
    window.__s7c2r2Export = null;
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { window.__s7c2r2Blob = blob; return original.call(URL, blob); };
    const button = [...document.querySelectorAll('button')]
      .find(node => /导出|JSON/.test(node.textContent ?? ''));
    if (!button) return 'NO_EXPORT_BUTTON';
    button.click();
    await new Promise(resolve => setTimeout(resolve, 400));
    URL.createObjectURL = original;
    if (!window.__s7c2r2Blob) return 'NO_BLOB';
    return await window.__s7c2r2Blob.text();
  })()`);
  if (typeof exportJson === 'string' && exportJson.startsWith('{')) {
    writeFileSync(`${OUT}/${SCENARIO}-ai-json.json`, exportJson);
    const parsed = JSON.parse(exportJson);
    say(`AI JSON：formatVersion ${parsed.formatVersion}｜humanSearchEvents ` +
      `${parsed.humanSearchEvents?.length ?? 0} 条｜playerSearchEvents ` +
      `${parsed.playerSearchEvents?.length ?? 0} 条`);
    const types = (parsed.humanSearchEvents ?? []).map(event => event.type);
    say('Human 搜查事件：' + [...new Set(types)].join(', '));
    say('--- Human 搜查时间线全文 ---');
    for (const event of parsed.humanSearchEvents ?? [])
      say(`  ${Math.round(event.t)}ms ${event.type}｜${event.reason}`);
    const resolve = (parsed.humanSearchEvents ?? []).find(event =>
      event.type === 'HUMAN_HIDE_SEARCH_RESOLVE');
    if (resolve) say('RESOLVE 事件：' + JSON.stringify(resolve.data ?? {}).slice(0, 600));
    const player = (parsed.playerSearchEvents ?? []).map(event =>
      `${event.type}｜${event.reason}`);
    if (player.length) say('玩家 Q 事件：' + player.join(' || '));
  } else say('AI JSON 导出失败：' + exportJson);

  writeFileSync(`${OUT}/${SCENARIO}-console.txt`,
    [...log, '--- 浏览器控制台 ---', ...cdp.console].join('\n'));
  say(`控制台条目 ${cdp.console.length} 条`);
  for (const entry of cdp.console.slice(0, 20)) say('  ' + entry);
  ws.close();
  chrome.kill();
}

/** 场景：DeepSeek 玩家藏进次卧床，Human AI 自主发现并正式搜查。 */
async function runBedAi(ctx) {
  const { hold, tap, prop, devb, pointOf, shot, cleanShot, say } = ctx;
  const waypoints = [
    { x: 4.6, z: 9.1, door: null },
    // 站在门前 0.9 世界单位处（门交互范围 1.3）再按 E。
    { x: 1.9, z: 9.0, door: 'door_study_entry' },
    // 书房书桌 study_desk(-3.1, 9.2) 占住 z 8.7–9.7：必须从北侧绕过去。
    { x: -1.2, z: 10.7, door: null },
    { x: -5.0, z: 10.5, door: null },
    { x: -6.9, z: 10.0, door: 'door_bedroom2_study' },
    // 次卧床 second_bed(-13, 10) 占住 x −14.05…−11.95、z 8.9…11.1：从南侧绕过去。
    { x: -9.4, z: 9.2, door: null },
    { x: -9.4, z: 8.2, door: null },
    { x: -13.2, z: 8.0, door: null },
    { x: -14.7, z: 9.5, door: null },
  ];
  for (const waypoint of waypoints) {
    await gotoDeepSeek(ctx, waypoint);
    if (waypoint.door) { await tap('E'); await sleep(400); }
  }
  // 找一个**合法**的次卧床藏身位置（用游戏自己的公开检查结果闭环确认）。
  const candidates = [
    { x: -14.7, z: 9.5 }, { x: -14.7, z: 10.2 }, { x: -13.0, z: 8.2 },
  ];
  let legalAt = null;
  for (const candidate of candidates) {
    await gotoDeepSeek(ctx, candidate);
    const code = await prop('hide/hide-candidate');
    say(`藏身候选 (${candidate.x}, ${candidate.z}) → ${code}`);
    if ((code ?? '').startsWith('LEGAL')) { legalAt = candidate; break; }
  }
  say('藏身位置：' + JSON.stringify(legalAt ?? (await pointOf('movement/DeepSeek 位置'))));
  // 站在原地等 Human AI 靠近到目视范围内：这样它真的看见过我，
  // 之后我藏起来才会产生真实的 Last Seen（房间 = 次卧）。
  let gap = null;
  for (let attempt = 0; attempt < 240; attempt++) {
    const me = await pointOf('movement/DeepSeek 位置');
    const human = await pointOf('movement/Human 位置');
    if (me && human) {
      gap = Math.hypot(me.x - human.x, me.z - human.z);
      if (attempt % 10 === 0) say(`  等待目视：Human ${JSON.stringify(human)}｜距离 ` +
        `${gap.toFixed(2)}｜Vision＝${await devb('perception/视线状态')}`);
      if (gap <= 6) break;
    }
    await sleep(500);
  }
  say(`Human 已靠近：距离 ${gap === null ? '未知' : gap.toFixed(2)}`);
  await tap('E');
  await sleep(600);
  say('藏身状态：' + await prop('hide/hide-state'));
  await cleanShot('bed-ai-hidden');
  if (!(await prop('hide/hide-state') ?? '').includes('藏身中')) {
    say('藏身失败，终止 AI 场景');
    return;
  }
  // 观察 Human AI 的搜查链
  const seen = [];
  for (let attempt = 0; attempt < 300; attempt++) {
    const phase = await prop('human-ai/hide-check-phase');
    const lastSeenGate = await prop('human-ai/hide-last-seen-room-gate');
    const round = await prop('human-ai/hide-check-round');
    const truth = await prop('human-ai/hide-check-truth');
    const result = await prop('human-ai/hide-check-result');
    const key = `${phase}|${lastSeenGate}|${round}|${truth}|${result}`;
    if (seen[seen.length - 1] !== key) {
      seen.push(key);
      say(`[${attempt}] 阶段=${phase}`);
      say(`     门槛=${lastSeenGate}`);
      say(`     计数=${round}`);
      say(`     真值=${truth}`);
      say(`     结果=${result}`);
    }
    if (/HIT_CONCEALED/.test(truth ?? '')) { await cleanShot('bed-ai-hit'); break; }
    if ((await prop('other/match-phase') ?? '').includes('已结束')) {
      await cleanShot('bed-ai-finished');
      say('对局已结束：' + await prop('other/match-phase'));
      break;
    }
    await sleep(500);
  }
  say('最终对局状态：' + await prop('other/match-phase'));
  say('最终藏身状态：' + await prop('hide/hide-state'));
  say('最终搜查真值：' + await prop('human-ai/hide-check-truth'));
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
    // 卡住（上一步几乎没有位移）→ 认为被关着的门挡住：按 E 开门后继续。
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
    // 相机相对输入：sx = 0.7071*(dx-dz)/len，sy = 0.7071*(dx+dz)/len。
    const sx = 0.7071 * (dx - dz) / distance;
    const sy = 0.7071 * (dx + dz) / distance;
    const keys = [];
    if (sx < -0.35) keys.push('A'); else if (sx > 0.35) keys.push('D');
    if (sy < -0.35) keys.push('W'); else if (sy > 0.35) keys.push('S');
    if (!keys.length) keys.push('W');
    // 步长 ≤ 约 1.6 世界单位，接近目标时收小，避免一步跨过门洞中心线。
    const ms = Math.min(420, Math.max(140, Math.min(distance, 1.6) / 4.14 * 1000 * 0.7));
    await hold(keys, ms);
    await sleep(70);
  }
  ctx.say(`走图超时：目标 ${target.x},${target.z}`);
  return false;
}

/** 场景：Human 玩家走进储物间纸箱的交互区域，验证白色高亮 / Q 提示 / 家具搜查。 */
async function runPlayerQ(ctx) {
  const { prop, devb, pointOf, shot, cleanShot, say, tap } = ctx;
  const waypoints = [
    // 厨房岛台 kitchen_island(11,-6.3) 与柜台 kitchen_counter(13.7,-8.4) 之间只有一条
    // 窄通道：先走到柜台以东、门洞正西的 (14.5,-6.8)，再沿门洞中心线穿过。
    { x: 12.6, z: -5.6, door: null },
    { x: 14.5, z: -6.8, door: null },
    { x: 14.5, z: -6.9, door: 'door_kitchen_storage' },
    { x: 15.8, z: -6.9, door: null },
    { x: 16.1, z: -6.0, door: null },
    { x: 16.0, z: -5.6, door: null },
  ];
  for (const waypoint of waypoints) {
    await gotoHuman(ctx, waypoint);
    if (waypoint.door) { await tap('E'); await sleep(400); }
  }
  say('玩家位置：' + JSON.stringify(await pointOf('movement/Human 位置')));
  await sleep(600);
  say('HUD：' + await ctx.cdp.eval(
    `document.querySelector('.skill-hud-state')?.textContent ?? null`));
  say('Q 目标：' + await prop('hide/hide-search-target'));
  say('区域合法性：' + await prop('hide/hide-search-region'));
  await cleanShot('player-q-target');
  // 在**留在区域内**的前提下转身（朝西走一小步）：家具这时落在 120° 扇形之外，
  // 但家具搜查不应该受朝向影响。
  await ctx.hold(['A', 'W'], 160);
  await sleep(500);
  say('背对家具后 HUD：' + await ctx.cdp.eval(
    `document.querySelector('.skill-hud-state')?.textContent ?? null`));
  say('背对家具后目标：' + await prop('hide/hide-search-target'));
  await cleanShot('player-q-backwards');
  await tap('Q');
  await sleep(700);
  say('Q 之后：' + await prop('hide/hide-search-furniture'));
  say('Q 之后提示：' + await ctx.cdp.eval(
    `document.querySelector('.skill-hud-notice')?.textContent ?? null`));
  say('Q 冷却：' + await ctx.cdp.eval(
    `document.querySelector('[data-property="hide/hide-search"] .details-property-value')?.textContent ?? null`));
  say('Q 之后 HUD：' + await ctx.cdp.eval(
    `document.querySelector('.skill-hud-state')?.textContent ?? null`));
  await cleanShot('player-q-after');
  // 冷却中再按一次：必须被拒绝，且不产生新的搜查。
  await tap('Q');
  await sleep(500);
  say('冷却中再按 Q：' + await prop('hide/hide-search-furniture'));
  say('冷却中提示：' + await ctx.cdp.eval(
    `document.querySelector('.skill-hud-notice')?.textContent ?? null`));
}

async function gotoDeepSeek(ctx, target) {
  return goto(ctx, target, 'movement/DeepSeek 位置');
}
async function gotoHuman(ctx, target) {
  return goto(ctx, target, 'movement/Human 位置');
}

main().catch(async error => {
  console.error('脚本失败：', error?.message ?? error);
  log.push('脚本失败：' + (error?.stack ?? error));
  writeFileSync(`${OUT}/${SCENARIO}-console.txt`, log.join('\n'));
  chrome.kill();
  process.exitCode = 1;
});
