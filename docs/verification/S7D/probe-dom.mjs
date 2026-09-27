// 临时探针：确认 S7D 浏览器脚本用到的 DOM 选择器在真实页面里存在。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 9346;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => existsSync(p));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\s7d-probe`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--window-size=1440,900', '--mute-audio',
  'http://127.0.0.1:5173/?matchSeed=20268846'], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === 'page' && t.url.includes('5173'));
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(500);
  }
  throw new Error('no cdp');
}
const ws = new WebSocket(await connect());
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(resolve => {
  const myId = ++id; pending.set(myId, resolve);
  ws.send(JSON.stringify({ id: myId, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true,
    awaitPromise: true });
  if (r.result?.exceptionDetails) return 'EXCEPTION: ' + JSON.stringify(r.result.exceptionDetails);
  return r.result?.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await sleep(3_000);
console.log('menu exists:', await evaluate('!!document.querySelector(".faction-menu")'));
console.log('menu hidden:', await evaluate('document.querySelector(".faction-menu")?.hidden'));
console.log('menu html:', (await evaluate('document.querySelector(".faction-menu")?.outerHTML ?? "NONE"') ?? '').slice(0, 200));
console.log('radios:', await evaluate('[...document.querySelectorAll("input[name=faction]")].map(i=>i.value).join(",")'));
console.log('all classes:', await evaluate('[...document.querySelectorAll("[class]")].map(n=>n.className).filter(c=>typeof c==="string").filter((v,i,a)=>a.indexOf(v)===i).join(" | ")'));
console.log('data-property count:', await evaluate('document.querySelectorAll("[data-property]").length'));
console.log('data-property names:', await evaluate('[...document.querySelectorAll("[data-property]")].map(n=>n.getAttribute("data-property")).slice(0,40).join(",")'));
console.log('overlay-text:', await evaluate('document.querySelector(".overlay-text")?.textContent ?? "NONE"'));
console.log('export button:', await evaluate('[...document.querySelectorAll("button")].map(b=>b.textContent.trim()).filter(t=>t.includes("导出")).join(",") || "NONE"'));
ws.close(); chrome.kill();
