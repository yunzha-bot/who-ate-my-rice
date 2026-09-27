// DEV-B 运行时调试参数持久化（保存 / 恢复 / 本地预设）的**真实浏览器**复核。
//
// 用法：node --experimental-strip-types browser-check.mjs <outDir>
//   （先确保 `http://127.0.0.1:5173/` 已在运行）
//
// 覆盖用户本轮要求的浏览器验收步骤：
//   FOOTSTEP 有效传播范围 17 → 13 → 点「保存调试参数」→ **刷新后仍为 13**
//   → **正常重开对局后仍为 13** → 「恢复正式默认值」显示 17（本地预设保留）
//   → 「加载已保存预设」恢复 13 → 场景编辑器 V2 的地图存档键不受影响。
//
// 全部走真实 DOM：按钮先 elementFromPoint 命中测试再点击（证明没有被覆盖），
// 参数走真实 input 的 change 事件，刷新走 Page.reload，重开走真实 Esc → 重新开始。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2] ?? '.';
const PORT = 9342;
const KEY = 'who-ate-my-rice/dev-b-runtime-params';
const EDITOR_KEY = 'who-ate-my-rice/scene-editor-layout';
const PARAM = 'hearing.range.FOOTSTEP';
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(path => existsSync(path));
if (!CHROME) throw new Error('找不到本机 Chrome');
mkdirSync(OUT, { recursive: true });
const PROFILE = `${process.env.TEMP}\\dev-b-params-chrome-profile`;

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--window-size=1440,900',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--mute-audio',
  'http://127.0.0.1:5173/'], { stdio: 'ignore', detached: false });

const log = [];
const steps = [];
const say = (...args) => { const line = args.join(' '); log.push(line); console.log(line); };
const record = (name, value) => { steps.push({ step: name, ...value }); };

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
    this.dialogs = [];
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

  const shot = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(result.data, 'base64'));
  };
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
  // 只保证「打开」：面板已经开着时不要再点一次（点击是切换，会把面板关掉）。
  const openDevB = async () => {
    const alreadyOpen = await cdp.eval(`(() => { const p = document.querySelector('.dev-b-panel');
      return !!p && !p.hidden; })()`);
    if (alreadyOpen) return { clicked: 'ALREADY_OPEN', open: true };
    const clicked = await cdp.eval(`(() => {
      const button = document.querySelector('.dev-b-launcher');
      if (!button) return 'NO_LAUNCHER';
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      button.click();
      return hit === button || button.contains(hit) ? 'CLICKED' : 'COVERED_BY:' +
        (hit ? (hit.className || hit.tagName) : 'null'); })()`);
    const open = await waitFor(`(() => { const p = document.querySelector('.dev-b-panel');
      return !!p && !p.hidden; })()`, 20);
    await sleep(400);
    return { clicked, open };
  };
  // 面板关闭时会保留上一次渲染的 DOM：读值前必须确认面板真的可见。
  const readParam = () => cdp.eval(`(() => {
    const panel = document.querySelector('.dev-b-panel');
    if (!panel || panel.hidden) return null;
    const row = document.querySelector('[data-param=${JSON.stringify(PARAM)}]');
    if (!row) return null;
    return { value: Number(row.querySelector('.dev-b-param-input').value),
      status: row.querySelector('.dev-b-param-status').textContent ?? '' }; })()`);
  const readStorage = () => cdp.eval(`(() => {
    const panel = document.querySelector('.dev-b-panel');
    if (!panel || panel.hidden) return null;
    const el = document.querySelector('.dev-b-storage-status');
    const notice = document.querySelector('.dev-b-notice');
    return { state: el?.dataset.storageState ?? null,
      error: el?.dataset.storageError ?? null,
      text: el?.textContent ?? '',
      notice: notice && !notice.hidden ? (notice.textContent ?? '') : '' }; })()`);
  const setParam = async value => {
    const ok = await cdp.eval(`(() => {
      const row = document.querySelector('[data-param=${JSON.stringify(PARAM)}]');
      if (!row) return false;
      // 面板很长且 .dev-b-body 自身滚动：先滚到视野内，截图与命中测试才有意义。
      row.scrollIntoView({ block: 'center' });
      const input = row.querySelector('.dev-b-param-input');
      input.value = ${JSON.stringify(String(value))};
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true; })()`);
    await sleep(400);
    return ok;
  };
  const scrollTo = selector => cdp.eval(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return 'NOT_FOUND';
    node.scrollIntoView({ block: 'center' });
    return 'SCROLLED'; })()`);
  const clickDevB = async className => {
    const result = await cdp.eval(`(() => {
      const button = document.querySelector(${JSON.stringify(`.${className}`)});
      if (!button) return 'NOT_FOUND';
      button.scrollIntoView({ block: 'center' });
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      button.click();
      return hit === button || button.contains(hit) ? 'CLICKED'
        : 'COVERED_BY:' + (hit ? (hit.className || hit.tagName) : 'null'); })()`);
    await sleep(500);
    return result;
  };
  const stored = () => cdp.eval(`(() => {
    const raw = localStorage.getItem(${JSON.stringify(KEY)});
    if (!raw) return null;
    try { const parsed = JSON.parse(raw);
      return { format: parsed.format, version: parsed.version, savedAt: parsed.savedAt,
        params: parsed.params, keys: Object.keys(parsed.params ?? {}).length };
    } catch (error) { return { broken: String(error) }; } })()`);
  const pressKey = async (code, key, keyCode) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key,
      windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await sleep(60);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key,
      windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
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

  // ------------------------------------------------------------- 1 干净基线
  let phaseNow = await startMatch();
  say(`对局阶段：${phaseNow}`);
  // 清掉这个 Chrome 档案里可能残留的本地预设，保证是「从未保存过」的启动基线。
  await cdp.eval(`localStorage.removeItem(${JSON.stringify(KEY)}); true`);
  // 场景编辑器 V2 的地图存档哨兵：本轮**不打开**场景编辑器，只用来证明
  // DEV-B 的保存 / 恢复 / 删除都不会碰这个键（它不是一份合法布局，仅作标记）。
  await cdp.eval(`localStorage.setItem(${JSON.stringify(EDITOR_KEY)},
    'dev-b-non-interference-sentinel'); true`);
  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(1_200);
  phaseNow = await startMatch();
  const opened = await openDevB();
  say(`DEV-B 入口：${opened.clicked}，面板打开：${opened.open}，阶段：${phaseNow}`);
  const baseline = await readParam();
  const baselineStorage = await readStorage();
  say(`基线：FOOTSTEP=${baseline?.value}｜${baseline?.status}｜本地预设状态 ${baselineStorage?.state}` +
    `（${baselineStorage?.text}）｜键存在：${await stored() ? 'yes' : 'no'}`);
  record('1-baseline', { open: opened, param: baseline, storage: baselineStorage,
    stored: await stored() });
  await scrollTo('.dev-b-storage');
  await sleep(200);
  await shot('01-baseline');

  // ------------------------------------------------ 2 改成 13 → 未保存修改
  const set13 = await setParam(13);
  const afterSet = await readParam();
  const afterSetStorage = await readStorage();
  say(`改为 13（写入结果 ${set13}）：FOOTSTEP=${afterSet?.value}｜${afterSet?.status}｜` +
    `状态 ${afterSetStorage?.state}`);
  record('2-unsaved', { set: set13, param: afterSet, storage: afterSetStorage });
  await shot('02-unsaved');

  // ------------------------------------------------------ 3 保存调试参数
  const saved = await clickDevB('dev-b-save-params');
  const afterSave = await readStorage();
  const storedAfterSave = await stored();
  say(`保存：${saved}｜状态 ${afterSave?.state}｜提示「${afterSave?.notice}」｜` +
    `localStorage FOOTSTEP=${storedAfterSave?.params?.[PARAM]}（version ${storedAfterSave?.version}）`);
  record('3-saved', { click: saved, storage: afterSave, stored: storedAfterSave });
  await shot('03-saved');

  // --------------------------------------------- 4 刷新页面后自动恢复 13
  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(1_200);
  const reloadPhase = await startMatch();
  const reopen = await openDevB();
  const afterReload = await readParam();
  const reloadStorage = await readStorage();
  say(`刷新后（${reloadPhase}）：FOOTSTEP=${afterReload?.value}｜${afterReload?.status}｜` +
    `状态 ${reloadStorage?.state}｜面板打开 ${reopen.open}`);
  record('4-after-reload', { phase: reloadPhase, open: reopen, param: afterReload,
    storage: reloadStorage, stored: await stored() });
  await scrollTo(`[data-param="${PARAM}"]`);
  await sleep(200);
  await shot('04-after-reload');

  // --------------------------------------------- 5 重开对局后仍为 13
  await pressKey('Escape', 'Escape', 27);
  await waitFor(`(() => { const o = document.querySelector('.pause-actions');
    return !!o && !o.closest('#game-overlay')?.hidden; })()`, 20);
  const restart = await clickText('.pause-actions button', '重新开始');
  await sleep(1_200);
  const restartPhase = await waitPlaying();
  const afterRestartOpen = await openDevB();
  const afterRestart = await readParam();
  const restartStorage = await readStorage();
  say(`重开：${restart}｜阶段 ${restartPhase}｜面板打开 ${afterRestartOpen.open}｜` +
    `FOOTSTEP=${afterRestart?.value}（重开前 13）｜状态 ${restartStorage?.state}`);
  record('5-after-restart', { restart, phase: restartPhase, open: afterRestartOpen,
    param: afterRestart, storage: restartStorage });
  await scrollTo(`[data-param="${PARAM}"]`);
  await sleep(200);
  await shot('05-after-restart');

  // ---------------------------- 6 恢复正式默认值 → 17，且本地预设保留
  const restored = await clickDevB('dev-b-restore-defaults');
  const afterRestore = await readParam();
  const restoreStorage = await readStorage();
  const storedAfterRestore = await stored();
  say(`恢复正式默认值：${restored}｜FOOTSTEP=${afterRestore?.value}（正式基准 17）｜` +
    `状态 ${restoreStorage?.state}（${restoreStorage?.text}）｜本地预设仍在：` +
    `${storedAfterRestore ? 'yes' : 'no'}｜提示「${restoreStorage?.notice}」`);
  record('6-restored-formal', { click: restored, param: afterRestore, storage: restoreStorage,
    stored: storedAfterRestore });
  await shot('06-restored-formal');

  // ------------------------------- 7 重新加载已保存预设 → 恢复 13
  const loaded = await clickDevB('dev-b-load-params');
  const afterLoad = await readParam();
  const loadStorage = await readStorage();
  say(`加载已保存预设：${loaded}｜FOOTSTEP=${afterLoad?.value}｜状态 ${loadStorage?.state}｜` +
    `提示「${loadStorage?.notice}」`);
  record('7-loaded-preset', { click: loaded, param: afterLoad, storage: loadStorage });
  await scrollTo('.dev-b-storage');
  await sleep(200);
  await shot('07-loaded-preset');

  // ----------------------- 8 场景编辑器 V2 的地图存档不受影响
  const editorSentinel = await cdp.eval(
    `localStorage.getItem(${JSON.stringify(EDITOR_KEY)})`);
  const devBKey = await stored();
  say(`场景编辑器存档键：${editorSentinel === 'dev-b-non-interference-sentinel'
    ? '原样保留' : `被改动（${editorSentinel}）`}｜DEV-B 键与编辑器键不同：` +
    `${KEY !== EDITOR_KEY}`);
  record('8-editor-key-intact', { sentinel: editorSentinel, devBStored: devBKey });

  // ------------------- 9 删除本地预设必须经确认，且只删预设不动当前覆盖值
  const resave = await clickDevB('dev-b-save-params');
  const beforeDelete = await stored();
  const dialogsBefore = cdp.dialogs.length;
  const deleted = await clickDevB('dev-b-delete-params');
  await sleep(400);
  const afterDelete = await readStorage();
  const afterDeleteParam = await readParam();
  const storedAfterDelete = await stored();
  say(`删除本地预设：${resave} → ${deleted}｜确认框 ${cdp.dialogs.length - dialogsBefore} 次｜` +
    `localStorage ${storedAfterDelete ? '仍在' : '已删除'}｜FOOTSTEP 仍为 ` +
    `${afterDeleteParam?.value}（内存覆盖值不受影响）｜状态 ${afterDelete?.state}｜` +
    `提示「${afterDelete?.notice}」`);
  record('9-delete-confirm', { resave, beforeDelete, click: deleted,
    dialogs: cdp.dialogs.length - dialogsBefore, confirmText: cdp.dialogs.at(-1) ?? null,
    stored: storedAfterDelete, param: afterDeleteParam, storage: afterDelete });
  await scrollTo('.dev-b-storage');
  await sleep(200);
  await shot('08-delete-confirm');

  // ------------------------------------------------------------- 收尾
  // 只忽略既有的 THREE.Clock 弃用告警、Vite 自身的连接日志与浏览器自动请求
  // /favicon.ico 的 404（index.html 没有 icon）；其余任何控制台错误都算失败。
  const known = line => line.includes('THREE.Clock: This module has been deprecated');
  const knownWarnings = cdp.console.filter(known);
  const errors = cdp.console.filter(line =>
    !known(line) &&
    !line.includes('[vite]') &&
    !line.includes('Failed to load resource: the server responded with a status of 404'));
  say(`控制台异常：${errors.length === 0 ? '无' : errors.join(' | ')}` +
    `（既有 THREE.Clock 弃用告警 ${knownWarnings.length} 条，非本轮引入）`);
  record('console', { errors, knownWarnings, favicon404: cdp.console.some(line =>
    line.includes('status of 404')) });
  writeFileSync(`${OUT}/browser-check-log.txt`, log.join('\n') + '\n');
  writeFileSync(`${OUT}/browser-check-summary.json`,
    JSON.stringify({ steps, dialogs: cdp.dialogs, consoleErrors: errors,
      param: PARAM, storageKey: KEY, editorStorageKey: EDITOR_KEY }, null, 2));
  ws.close();
  chrome.kill();
}

main().catch(error => {
  console.error('复核失败：', error);
  writeFileSync(`${OUT}/browser-check-log.txt`, log.join('\n') + `\n复核失败：${error}\n`);
  chrome.kill();
  process.exitCode = 1;
});
