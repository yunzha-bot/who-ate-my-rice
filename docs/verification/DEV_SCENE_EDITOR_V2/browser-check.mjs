// DEV 场景编辑器 V2（布局保存 / 恢复 / 导入）的**真实浏览器**复核。
//
// 用法：node --experimental-strip-types browser-check.mjs <outDir>
//
// 覆盖用户集中验收清单里的浏览器侧行为：应用布局 → 保存到 localStorage →
// **刷新页面后自动恢复** → 非法 JSON 导入不改变当前地图 → V3 文档导入生效 →
// 「恢复默认地图」经确认后生效且**不删除本地存档** → 关编辑器后「重新开始」
// 仍保留已应用布局 → 清掉存档后回落到默认布局。
//
// 全部走真实 DOM：按钮用 elementFromPoint 命中测试后再点击（证明没有被覆盖），
// 导入走真实 <input type="file"> 的 change 事件（用 DataTransfer 造 File，
// 不弹原生文件框），确认框由 CDP 自动接受并记录。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2] ?? '.';
const PORT = 9341;
const KEY = 'who-ate-my-rice/scene-editor-layout';
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(path => existsSync(path));
if (!CHROME) throw new Error('找不到本机 Chrome');
mkdirSync(OUT, { recursive: true });
const PROFILE = `${process.env.TEMP}\\dev-editor-v2-chrome-profile`;

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
  const waitPlaying = async () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const phase = await cdp.eval(
        `document.querySelector('[data-property="other/match-phase"] .details-property-value')
          ?.textContent ?? ''`);
      if (phase.includes('对局中')) return phase;
      await sleep(500);
    }
    return '未进入对局';
  };
  // 面板关闭时保留上一次的内容，因此这里必须确认面板真的可见再读布局状态，
  // 否则会把"打开失败"误读成上一次的旧状态。
  const layoutState = () => cdp.eval(`(() => {
    const panel = document.querySelector('.scene-editor-panel');
    if (!panel || panel.hidden) return null;
    const el = document.querySelector('.scene-editor-layout');
    return el ? { state: el.dataset.layoutState ?? null,
      unsaved: el.dataset.layoutUnsaved ?? null, text: el.textContent ?? '' } : null; })()`);
  const stored = () => cdp.eval(`(() => {
    const raw = localStorage.getItem(${JSON.stringify(KEY)});
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const sofa = parsed.document.furniture.find(entry => entry.id === 'living_sofa');
    return { layoutVersion: parsed.layoutVersion, savedAt: parsed.savedAt ?? null,
      sofaWidth: sofa?.size.width ?? null }; })()`);
  const width = async (attempts = 12) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const value = await cdp.eval(`(() => {
        const input = document.querySelector('.scene-editor-detail [data-field="width"]');
        return input ? Number(input.value) : null; })()`);
      if (value !== null) return value;
      await sleep(250);
    }
    return null;
  };
  const clickButton = async label => cdp.eval(`(() => {
    const button = [...document.querySelectorAll('.scene-editor-button')]
      .find(node => node.textContent.trim() === ${JSON.stringify(label)});
    if (!button) return 'NOT_FOUND';
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    button.click();
    return hit === button || button.contains(hit) ? 'CLICKED'
      : 'COVERED_BY:' + (hit ? (hit.className || hit.tagName) : 'null'); })()`);
  const selectObject = async id => {
    await cdp.eval(`(() => { const input = document.querySelector('.scene-editor-search');
      input.value = ${JSON.stringify(id)};
      input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await sleep(300);
    const ok = await cdp.eval(`(() => {
      const row = document.querySelector('[data-object-id=${JSON.stringify(id)}]');
      if (!row) return false;
      row.click(); return true; })()`);
    await sleep(400);
    return ok;
  };
  const setWidth = async value => {
    const ok = await cdp.eval(`(() => {
      const input = document.querySelector('.scene-editor-detail [data-field="width"]');
      if (!input) return false;
      input.value = '${value}';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true; })()`);
    await sleep(400);
    return ok;
  };
  const importFile = async (name, text) => cdp.eval(`(() => {
    const input = document.querySelector('.scene-editor-file');
    if (!input) return 'NO_INPUT';
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)},
      { type: 'application/json' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return 'DISPATCHED'; })()`);
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
    for (let attempt = 0; attempt < 60; attempt++) {
      const phase = await cdp.eval(
        `document.querySelector('[data-property="other/match-phase"] .details-property-value')
          ?.textContent ?? ''`);
      if (phase.includes('对局中')) return phase;
      await sleep(500);
    }
    return '未进入对局';
  };
  const openEditor = async () => {
    const clicked = await cdp.eval(`(() => {
      const button = document.querySelector('.scene-editor-launch');
      if (!button) return 'NO_LAUNCHER';
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      button.click();
      return hit === button || button.contains(hit) ? 'CLICKED' : 'COVERED'; })()`);
    const open = await waitFor(`(() => { const p = document.querySelector('.scene-editor-panel');
      return !!p && !p.hidden; })()`);
    return { clicked, open };
  };

  // ---------------------------------------------------------- 1 默认布局
  say('对局阶段：' + await startMatch());
  // 干净基线：清掉这个 Chrome 档案里可能残留的存档，再刷新，保证是「从未保存过」的启动。
  await cdp.eval(`localStorage.removeItem(${JSON.stringify(KEY)}); true`);
  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(1_200);
  await startMatch();
  const before = await openEditor();
  say(`场景编辑入口：${before.clicked}，面板打开：${before.open}`);
  await waitFor(`!!document.querySelector('.scene-editor-layout')`);
  await sleep(700);
  const initial = await layoutState();
  await selectObject('living_sofa');
  const authored = await width();
  say(`初始布局状态：${initial.state}｜${initial.text}`);
  say(`living_sofa 授权宽度：${authored}`);
  record('1-default', { launcher: before.clicked, open: before.open,
    layout: initial.state, text: initial.text, authoredWidth: authored });
  await shot('01-default');

  // ------------------------------------------------- 2 应用编辑 + 保存
  await setWidth(1.4);
  const applied = await clickButton('应用编辑');
  const afterApply = await layoutState();
  say(`应用编辑：${applied}；布局状态：${afterApply.state}｜未保存=${afterApply.unsaved}`);
  const saved = await clickButton('保存布局');
  const afterSave = await layoutState();
  const storeAfterSave = await stored();
  say(`保存布局：${saved}；布局状态：${afterSave.state}；localStorage：` +
    `v${storeAfterSave?.layoutVersion} sofaWidth=${storeAfterSave?.sofaWidth} ${storeAfterSave?.savedAt}`);
  record('2-apply-save', { apply: applied, afterApply: afterApply.state,
    unsavedAfterApply: afterApply.unsaved, save: saved, afterSave: afterSave.state,
    stored: storeAfterSave });
  await shot('02-applied-saved');

  // ------------------------------------------------- 3 刷新后自动恢复
  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(1_200);
  const phaseAfterReload = await startMatch();
  const reopened = await openEditor();
  await waitFor(`!!document.querySelector('.scene-editor-layout')`);
  const afterReload = await layoutState();
  await selectObject('living_sofa');
  const restoredWidth = await width();
  say(`刷新后：${phaseAfterReload}｜面板打开 ${reopened.open}｜布局 ${afterReload.state}｜` +
    `living_sofa 宽度 ${restoredWidth}`);
  record('3-after-reload', { phase: phaseAfterReload, launcher: reopened.clicked,
    open: reopened.open, layout: afterReload.state, width: restoredWidth });
  await shot('03-after-reload');

  // ------------------------------------------- 4 非法 JSON 不改变当前地图
  await importFile('broken.json', '{ "format": "who-ate-my-rice/apartment-map"');
  await sleep(800);
  const afterBroken = await layoutState();
  const widthAfterBroken = await width();
  say(`非法 JSON 导入后：${afterBroken.state}｜未保存=${afterBroken.unsaved}｜` +
    `living_sofa 宽度 ${widthAfterBroken}`);
  record('4-import-broken', { layout: afterBroken.state, unsaved: afterBroken.unsaved,
    width: widthAfterBroken, text: afterBroken.text });
  await shot('04-import-broken');

  // 结构合法但与当前地图不一致（改了房间边界）的文档也必须被拒绝。
  await cdp.eval(`(() => {
    const raw = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));
    const tampered = JSON.parse(JSON.stringify(raw.document));
    tampered.rooms[0].bounds.minX += 1;
    window.__devEditorV2WrongMap = JSON.stringify(tampered);
    return true; })()`);
  const wrongText = await cdp.eval('window.__devEditorV2WrongMap');
  await importFile('wrong-map.json', wrongText);
  await sleep(800);
  const afterWrong = await layoutState();
  const widthAfterWrong = await width();
  say(`来自另一张地图的文档：${afterWrong.state}｜宽度仍为 ${widthAfterWrong}`);
  record('5-import-wrong-map', { layout: afterWrong.state, width: widthAfterWrong,
    text: afterWrong.text });
  await shot('05-import-wrong-map');

  // ------------------------------------------------- 6 合法导入生效
  await cdp.eval(`(() => {
    const raw = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));
    const edited = JSON.parse(JSON.stringify(raw.document));
    edited.furniture.find(entry => entry.id === 'living_sofa').size.width = 1.6;
    window.__devEditorV2Import = JSON.stringify(edited);
    return true; })()`);
  const goodText = await cdp.eval('window.__devEditorV2Import');
  await importFile('good.json', goodText);
  await sleep(800);
  const afterGood = await layoutState();
  const widthAfterGood = await width();
  say(`合法 V3 文档导入后：${afterGood.state}｜未保存=${afterGood.unsaved}｜` +
    `living_sofa 宽度 ${widthAfterGood}`);
  record('6-import-good', { layout: afterGood.state, unsaved: afterGood.unsaved,
    width: widthAfterGood, text: afterGood.text });
  await shot('06-import-good');

  // ------------------------------------- 7 恢复默认地图（确认 + 保留存档）
  const restore = await clickButton('恢复默认地图');
  await sleep(500);
  const afterRestore = await layoutState();
  await selectObject('living_sofa');
  const widthAfterRestore = await width();
  const storeAfterRestore = await stored();
  say(`恢复默认地图：${restore}｜确认框：${cdp.dialogs.length} 次｜状态 ${afterRestore.state}｜` +
    `宽度回到 ${widthAfterRestore}（授权值 ${authored}）｜localStorage 仍在：` +
    `${storeAfterRestore ? 'yes' : 'no'}`);
  record('7-restore-default', { click: restore, dialogs: cdp.dialogs.length,
    layout: afterRestore.state, unsaved: afterRestore.unsaved, width: widthAfterRestore,
    authoredWidth: authored, stored: storeAfterRestore });
  await shot('07-restored-default');

  // ------------------------------- 8 重开后保留已应用布局（含自定义改动）
  // 先换成一个自定义布局再保存，这样"重开后保留"验证的是自定义布局，而不是默认布局。
  await setWidth(1.55);
  const appliedBeforeRestart = await clickButton('应用编辑');
  const stateBeforeRestart = await layoutState();
  const saveBeforeRestart = await clickButton('保存布局');
  say(`重开前：应用编辑 ${appliedBeforeRestart}｜存储 ${saveBeforeRestart}｜` +
    `布局 ${stateBeforeRestart.state}｜宽度 ${await width()}`);
  await cdp.eval(`document.querySelector('.scene-editor-close')?.click(); true`);
  await sleep(400);
  await pressKey('Escape', 'Escape', 27);
  await waitFor(`(() => { const o = document.querySelector('.pause-actions');
    return !!o && !o.closest('#game-overlay')?.hidden; })()`, 20);
  const restart = await clickText('.pause-actions button', '重新开始');
  await sleep(1_200);
  // 重开先回到 READY，编辑器只能在 PLAYING 打开：必须先等到对局中。
  const phaseAfterRestart = await waitPlaying();
  const afterRestartOpen = await openEditor();
  await waitFor(`!!document.querySelector('.scene-editor-layout')`);
  await sleep(600);
  const afterRestart = await layoutState();
  const reselected = await selectObject('living_sofa');
  const widthAfterRestart = await width();
  const storeAfterRestart = await stored();
  say(`重开：${restart}｜阶段 ${phaseAfterRestart}｜面板打开 ${afterRestartOpen.open}｜` +
    `布局 ${afterRestart?.state}｜重新选中 ${reselected}｜living_sofa 宽度 ` +
    `${widthAfterRestart}（重开前 1.55）｜localStorage 宽度 ${storeAfterRestart?.sofaWidth}`);
  record('8-after-restart', { restart, phase: phaseAfterRestart,
    open: afterRestartOpen.open, applyBeforeRestart: appliedBeforeRestart,
    layoutBeforeRestart: stateBeforeRestart.state,
    layout: afterRestart?.state, reselected, width: widthAfterRestart,
    stored: storeAfterRestart });
  await shot('08-after-restart');

  // ------------------------------- 9 清掉存档后安全回落到默认布局
  await cdp.eval(`localStorage.removeItem(${JSON.stringify(KEY)}); true`);
  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(1_200);
  await startMatch();
  const afterClear = await openEditor();
  await waitFor(`!!document.querySelector('.scene-editor-layout')`);
  const cleared = await layoutState();
  const storedCleared = await stored();
  say(`清掉本地存档后刷新：面板打开 ${afterClear.open}｜布局 ${cleared.state}｜` +
    `localStorage ${storedCleared ? '仍在' : '已清空'}`);
  record('9-cleared', { open: afterClear.open, layout: cleared.state,
    stored: storedCleared, text: cleared.text });
  await shot('09-cleared');

  // ------------------------------------------------------------- 收尾
  // 只忽略 Vite 自身的连接日志与浏览器自动请求 /favicon.ico 的 404（index.html 没有
  // icon，是既有现象）；其余任何控制台错误 / 异常都算失败。
  const errors = cdp.console.filter(line =>
    !line.includes('[vite]') &&
    !line.includes('Failed to load resource: the server responded with a status of 404'));
  say(`控制台异常：${errors.length === 0 ? '无' : errors.join(' | ')}`);
  record('console', { errors, favicon404: cdp.console.some(line =>
    line.includes('status of 404')) });
  writeFileSync(`${OUT}/browser-check-log.txt`, log.join('\n') + '\n');
  writeFileSync(`${OUT}/browser-check-summary.json`,
    JSON.stringify({ steps, dialogs: cdp.dialogs, consoleErrors: errors }, null, 2));
  ws.close();
  chrome.kill();
}

await main();
