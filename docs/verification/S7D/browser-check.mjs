// S7D：**真实浏览器**整局复核（自动化浏览器腿，不是真人试玩）。
//
// 用法：node --experimental-strip-types docs/verification/S7D/browser-check.mjs [outDir]
//   前置：`http://127.0.0.1:5173/` 已在运行（npm run dev）。
//
// 覆盖：
//   ① 玩家选 Human：DeepSeek AI 自主推进 → 正确结算（大米 5/5）；
//   ② 玩家选 Human + 修复用的固定种子 20292603：必须在时限内结算（修复前会无限等待）；
//   ③ 玩家选 DeepSeek 娘：Human AI 自主推进 → 正确结算（抓捕）；
//   ④ 结算后「再来一局」→ 回到 READY / 对局中；
//   ⑤ 结算后「返回阵营选择」→ 回到阵营菜单；
//   ⑥ 每局通过 DEV 面板真实导出一次 AI JSON，读取其中的整局摘要 `matchSummary`。
//
// 重要限制（报告中必须原样保留）：真实游戏里两套 AI 的随机抽签是 `Math.random`，
// `?matchSeed=` 只复现**布局**（出生点 / 门初态 / 米位），因此浏览器里的整局轨迹
// 与无头仿真的同种子轨迹不会完全相同；这里验证的是「真实游戏能不能正常走完整局」，
// 不是「复现仿真的那一条轨迹」。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync }
  from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2] ?? 'docs/verification/S7D/browser';
const ONLY = process.argv[3] ?? null;
const PORT = 9344;
const DOWNLOADS = `${OUT}/downloads`;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(path => existsSync(path));
if (!CHROME) throw new Error('找不到本机 Chrome');
mkdirSync(DOWNLOADS, { recursive: true });
const PROFILE = `${process.env.TEMP}\\s7d-chrome-profile`;

const log = [];
const say = (...args) => { const line = args.join(' '); log.push(line); console.log(line); };

const MATCH_TIMEOUT_MS = 180_000;
const MATCHES = [
  { id: 'human-20268846', faction: 'HUMAN', seed: 20268846,
    expect: 'DeepSeek 娘获胜', why: '玩家 Human 站桩，DeepSeek AI 自主吃完 5/5 米' },
  { id: 'human-20292603', faction: 'HUMAN', seed: 20292603,
    expect: '结算（不限胜负）', why: 'S7D 修复用的固定种子：修复前 SAFE_WAIT 会无限等待' },
  { id: 'deepseek-20260927', faction: 'DEEPSEEK', seed: 20260927,
    expect: '人类获胜', why: '玩家 DeepSeek 站桩，Human AI 自主抓获取胜' },
  { id: 'deepseek-20276765', faction: 'DEEPSEEK', seed: 20276765,
    expect: '人类获胜', why: '同上，换一个典型随机种子' },
];

async function connect() {
  for (let attempt = 0; attempt < 80; attempt++) {
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
        this.console.push('[exception] ' + (msg.params.exceptionDetails.exception?.description
          ?? msg.params.exceptionDetails.text));
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
      }, 60_000);
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression,
      returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--window-size=1440,900', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--mute-audio', 'http://127.0.0.1:5173/'], { stdio: 'ignore', detached: false });

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
  // 让 DEV 面板的「导出本局 AI 日志」直接落到磁盘，便于读取整局摘要。
  try {
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow',
      downloadPath: DOWNLOADS.replace(/\//g, '\\'), eventsEnabled: true });
  } catch {
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow',
      downloadPath: DOWNLOADS.replace(/\//g, '\\') });
  }
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });

  const shot = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  // DEV 面板的属性行是**按需渲染**的（未展开分类时 [data-property] 数量为 0），
  // 因此这里不依赖 DEV 属性节点，改用真实 DOM 的可见性事实：
  //   .faction-menu 隐藏 = 已选阵营；.skill-hud 可见 = 已进入 READY 之后的正式对局
  //   （READY 期间不显示），.result-actions 可见 = 已结算。
  const readState = async () => JSON.parse(await cdp.eval(`JSON.stringify({
    menuHidden: !!document.querySelector('.faction-menu')?.hidden,
    skillVisible: !!document.querySelector('.skill-hud') &&
      !document.querySelector('.skill-hud').hidden,
    overlay: document.querySelector('.overlay-text')?.textContent ?? '',
    resultVisible: !!document.querySelector('.result-actions') &&
      !document.querySelector('.result-actions').hidden,
    pauseVisible: !!document.querySelector('.pause-actions') &&
      !document.querySelector('.pause-actions').hidden,
  })`));
  const overlayText = async () => (await readState()).overlay;
  const waitFor = async (expression, attempts = 240) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await cdp.eval(expression)) return true;
      await sleep(500);
    }
    return false;
  };
  const clickByText = async (selector, text) => cdp.eval(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const node = nodes.find(n => n.textContent.trim() === ${JSON.stringify(text)});
    if (!node) return 'NOT_FOUND';
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2,
      rect.top + rect.height / 2);
    if (!hit || !node.contains(hit) && hit !== node) return 'COVERED';
    node.click();
    return 'CLICKED';
  })()`);

  const results = [];
  const selected = ONLY ? MATCHES.filter(match => match.id.includes(ONLY)) : MATCHES;
  for (const match of selected) {
    const record = { ...match, phases: [], settled: false };
    say(`\n===== ${match.id}（玩家 ${match.faction}，种子 ${match.seed}）=====`);
    say(`目的：${match.why}`);
    await cdp.send('Page.navigate',
      { url: `http://127.0.0.1:5173/?matchSeed=${match.seed}` });
    await sleep(2_500);
    const menuReady = await waitFor(
      'document.querySelector(".faction-menu") && !document.querySelector(".faction-menu").hidden',
      40);
    record.menuReady = menuReady;
    if (!menuReady) { record.error = '阵营菜单没有出现'; results.push(record); continue; }
    const selected = await cdp.eval(`(() => {
      const input = document.querySelector('input[name="faction"][value="${match.faction}"]');
      if (!input) return 'NOT_FOUND';
      input.checked = true;
      return 'OK';
    })()`);
    record.factionSelected = selected;
    const clicked = await clickByText('.faction-menu button', '确认阵营');
    record.confirmClicked = clicked;
    const playing = await waitFor(
      `!!document.querySelector('.skill-hud') && !document.querySelector('.skill-hud').hidden`
      + ` && !!document.querySelector('.faction-menu')?.hidden`, 60);
    record.reachedPlaying = playing;
    if (!playing) { record.error = '没有进入对局中';
      record.stateAtFail = await readState();
      await shot(`${match.id}-nostart`);
      results.push(record); continue; }
    record.stateAtStart = await readState();
    await shot(`${match.id}-playing`);

    // 站桩等人机自己推进到结算（真实时间）。
    const started = Date.now();
    let finished = false;
    while (Date.now() - started < MATCH_TIMEOUT_MS) {
      const state = await readState();
      if (state.overlay.includes('获胜')) { finished = true; break; }
      await sleep(1_000);
    }
    record.settled = finished;
    record.wallMs = Date.now() - started;
    record.overlay = await overlayText();
    record.stateAtEnd = await readState();
    say(`结算：${finished ? record.overlay.replace(/\n/g, ' / ') : '超时未结算'} ` +
      `（真实耗时 ${(record.wallMs / 1000).toFixed(1)}s）`);
    await shot(`${match.id}-finished`);

    // 打开 DEV 面板（属性行与导出按钮都在默认收起的 `.debug-content` 里）。
    await cdp.eval(`(() => { const body = document.querySelector('.debug-content');
      if (body && body.hidden) document.querySelector('.debug-toggle').click();
      return !document.querySelector('.debug-content').hidden; })()`);
    await sleep(800);
    // 真实按钮点击仍会生成 Blob；headless 下文件下载不稳定，因此在这里**只包一层**
    // `URL.createObjectURL` 把真实导出的 JSON 文本留在页面里读回来。
    // 这是验证脚本自己的读取手段，不修改游戏代码，也不改动导出内容。
    await cdp.eval(`(() => {
      if (window.__s7dHooked) return true;
      const original = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        try { blob.text().then(text => { window.__s7dExport = text; }); } catch {}
        return original.call(URL, blob);
      };
      window.__s7dHooked = true;
      return true;
    })()`);
    const before = new Set(readdirSync(DOWNLOADS));
    const exported = await clickByText('.details-export', '导出本局 AI 日志');
    record.exportClicked = exported;
    let raw = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(250);
      raw = await cdp.eval('window.__s7dExport ?? null');
      if (raw) break;
      const fresh = readdirSync(DOWNLOADS).filter(name => name.endsWith('.json'))
        .find(name => !before.has(name));
      if (fresh) { raw = readFileSync(`${DOWNLOADS}/${fresh}`, 'utf8'); break; }
    }
    if (raw) {
      const data = JSON.parse(raw);
      record.formatVersion = data.formatVersion;
      record.matchSummary = data.matchSummary;
      record.lastEvents = data.events.slice(-12).map(event =>
        `${(event.t / 1000).toFixed(1)}s ${event.type}=${event.reason}`);
      say(`AI JSON（真实导出）：formatVersion=${data.formatVersion}，摘要 ` +
        `${JSON.stringify({ winner: data.matchSummary.winner,
          reason: data.matchSummary.reason, rice: data.matchSummary.riceCompleted,
          seed: data.matchSummary.matchSeed, faction: data.matchSummary.playerFaction })}`);
      say(`整局摘要计数：${JSON.stringify(data.matchSummary.counts)}`);
      say(`异常记录：${JSON.stringify(data.matchSummary.anomalies)}`);
      if (!finished) say(`未结算时的最后事件：${record.lastEvents.join(' | ')}`);
    } else {
      record.error = 'AI JSON 没有导出成功';
    }
    if (!finished) { results.push(record); continue; }
    record.expectationMet = match.expect === '结算（不限胜负）'
      ? true : record.overlay.includes(match.expect);

    // 结算后「再来一局」：必须回到对局（READY → 对局中），且结算面板收起。
    const restart = await clickByText('.result-actions button', '再来一局');
    record.restartClicked = restart;
    const backToPlay = await waitFor(
      `(() => {
        const overlay = document.querySelector('.game-overlay');
        const result = document.querySelector('.result-actions');
        return !!overlay && overlay.hidden && !!result && result.hidden;
      })()`, 60);
    record.restartBackToPlay = backToPlay;
    // 重开后先回到 READY（3 秒）再进对局；READY 期间技能 HUD 不显示、Esc 也不接管，
    // 因此必须**等到真的再次进入对局**再做后面的暂停 / 返回菜单步骤。
    const playingAgain = await waitFor(
      `!!document.querySelector('.skill-hud') && !document.querySelector('.skill-hud').hidden`,
      40);
    record.restartReachedPlaying = playingAgain;
    record.stateAfterRestart = await readState();
    say(`再来一局：结算面板收起=${backToPlay}，再次进入正式对局=${playingAgain}`);
    await shot(`${match.id}-after-restart`);

    // 再走一次「返回阵营选择」：正式对局中按 Esc 打开暂停菜单，再点返回阵营选择。
    if (!playingAgain) {
      record.error = '重开后没有再次进入正式对局，跳过暂停 / 返回菜单步骤';
      results.push(record); continue;
    }
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape',
      code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape',
      code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await sleep(800);
    const pauseMenuOpened = await waitFor(
      `!!document.querySelector('.pause-actions') &&
       !document.querySelector('.pause-actions').hidden`, 20);
    record.pauseMenuOpened = pauseMenuOpened;
    record.stateWhenPaused = await readState();
    const backToMenu = await clickByText('.pause-actions button', '返回阵营选择');
    record.menuClicked = backToMenu;
    record.menuVisibleAgain = await waitFor(
      '(() => { const m = document.querySelector(".faction-menu"); return !!m && !m.hidden; })()', 60);
    say(`返回阵营选择：菜单可见=${record.menuVisibleAgain}（暂停面板可见=` +
      `${record.stateWhenPaused.pauseVisible}）`);
    await shot(`${match.id}-menu`);
    results.push(record);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    kind: 'real-browser-driven-match',
    // 真实浏览器、真实渲染循环、真实 DOM 与真实 Dev 面板；但玩家一侧是脚本站桩，
    // 不是真人试玩。`?matchSeed=` 只固定布局，AI 掷骰仍是 Math.random。
    caveat: '真实浏览器整局（玩家站桩）；不是真人试玩，也不复现仿真的同种子轨迹。',
    headless: true, matches: results,
    consoleErrors: cdp.console.filter(line => line.startsWith('[exception]')
      || line.startsWith('[error]') || line.startsWith('[log:error]')),
  };
  writeFileSync(`${OUT}/browser-check-log.txt`, log.join('\n'));
  writeFileSync(`${OUT}/browser-check-summary.json`, JSON.stringify(summary, null, 2));
  say(`\n浏览器复核完成：${results.filter(r => r.settled).length}/${results.length} 局结算。`);
  say(`证据：${OUT}/browser-check-summary.json、browser-check-log.txt、各阶段 PNG。`);
  ws.close();
  chrome.kill();
}

await main();
