// Isolated browser contexts only; never changes a user's saved preferences.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const out=resolve(process.env.KEY_BINDINGS_ARTIFACT_DIR??'docs/verification/key-bindings-2026-10-22');
await mkdir(out,{recursive:true});
const results=[];
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>localStorage.setItem('who-ate-my-rice/controls-help-seen-v1','1'));
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch(),source=await response.text();
   assert(source.includes('const game = new ThreeGame('));
   await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__bindingsGame = new ThreeGame(')});
  });
  const loaded=async()=>{
   await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  };
  const start=async faction=>{
   await page.locator(`.faction-card[data-faction="${faction}"]`).click();
   await page.waitForFunction(()=>window.__bindingsGame.match.phase==='PLAYING');
  };
  const settings=async()=>{
   await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'设置',exact:true}).click();
   await page.getByRole('button',{name:'按键设置',exact:true}).click();
   await page.locator('.keyboard-settings').waitFor({state:'visible'});
  };
  await page.goto('http://127.0.0.1:5173/');await loaded();await start('HUMAN');await settings();
  assert(await page.evaluate(()=>Object.entries(window.__bindingsGame.input.bindings.values).every(([action,code])=>action===code)),
   'a fresh browser must preserve every original default key');
  await page.screenshot({path:resolve(out,`${channel}-default-settings.png`)});
  await page.locator('[data-binding-action="KeyE"]').click();await page.keyboard.press('q');
  assert.match(await page.locator('.keyboard-settings-status').textContent(),/已用于/);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.__bindingsGame.match.phase),'PAUSED');
  assert.equal(await page.locator('[data-binding-action="KeyE"]').textContent(),'E');
  const changes={KeyW:'KeyT',KeyE:'KeyG',KeyQ:'KeyH',KeyV:'KeyB',KeyF:'KeyY',KeyL:'KeyO',Space:'ShiftLeft'};
  for(const [action,code] of Object.entries(changes)){
   await page.locator(`[data-binding-action="${action}"]`).click();await page.keyboard.press(code);
   assert.equal(await page.evaluate(a=>window.__bindingsGame.input.bindings.values[a],action),code);
  }
  assert.match(await page.locator('.keyboard-settings-status').textContent(),/已保存/);
  await page.screenshot({path:resolve(out,`${channel}-settings.png`)});
  // Capture cancellation must leave neither a key nor a dialog state behind.
  await page.locator('[data-binding-action="KeyE"]').click();await page.keyboard.press('Tab');
  assert.match(await page.locator('.keyboard-settings-status').textContent(),/保留/);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'操作说明',exact:true}).click();
  assert.match(await page.locator('.controls-help [data-side="HUMAN"] dl').textContent(),/G/);
  assert.match(await page.locator('.controls-help [data-side="HUMAN"] dl').textContent(),/左 Shift/);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'继续游戏',exact:true}).click();
  await page.waitForFunction(()=>window.__bindingsGame.match.phase==='PLAYING');
  assert.equal(await page.locator('.alpha-key b').textContent(),'G');
  assert.match(await page.locator('.alpha-q').textContent(),/^B 抓捕/);
  assert.match(await page.locator('.alpha-net').textContent(),/^H 布网/);
  assert.match(await page.locator('.alpha-sprint').textContent(),/^左 Shift/);
  await page.keyboard.down('KeyE');assert.equal(await page.evaluate(()=>window.__bindingsGame.input.isHeld('KeyE')),false);await page.keyboard.up('KeyE');
  await page.keyboard.down('KeyG');assert.equal(await page.evaluate(()=>window.__bindingsGame.input.isHeld('KeyE')),true);await page.keyboard.up('KeyG');
  await page.keyboard.down('KeyT');assert.deepEqual(await page.evaluate(()=>window.__bindingsGame.input.localDirection()),{x:0,y:-1});await page.keyboard.up('KeyT');
  await page.keyboard.press('KeyB');await page.waitForFunction(()=>window.__bindingsGame.humanSearchCooldown.remainingSeconds>0);
  await page.keyboard.press('KeyH');await page.waitForFunction(()=>window.__bindingsGame.captureNet.mode!=='NONE');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__bindingsGame.captureNet.mode==='NONE');
  await page.screenshot({path:resolve(out,`${channel}-human-custom-hud.png`)});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
  await start('DEEPSEEK');
  assert.equal(await page.locator('.alpha-key b').textContent(),'G');
  assert.match(await page.locator('.alpha-q').textContent(),/^H 锁门/);
  await page.keyboard.down('KeyT');await page.keyboard.press('ShiftLeft');
  await page.waitForFunction(()=>window.__bindingsGame.sprint.state==='SPRINT_RUNNING');await page.keyboard.up('KeyT');
  await page.screenshot({path:resolve(out,`${channel}-deepseek-custom-hud.png`)});
  // Refresh must restore the same keyboard map without touching match defaults.
  await page.reload();await loaded();
  for(const [action,code] of Object.entries(changes))assert.equal(await page.evaluate(a=>window.__bindingsGame.input.bindings.values[a],action),code);
  await start('HUMAN');await settings();await page.getByRole('button',{name:'恢复默认按键',exact:true}).click();
  assert.equal(await page.locator('[data-binding-action="KeyE"]').textContent(),'E');
  assert.equal(await page.locator('[data-binding-action="Space"]').textContent(),'Space');
  assert(await page.evaluate(()=>!window.__bindingsGame.input.isHeld('KeyE')));
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'继续游戏',exact:true}).click();
  assert.equal(await page.locator('.alpha-key b').textContent(),'E');
  assert.deepEqual(errors,[]);
  results.push({channel,conflict:true,cancel:true,persistence:true,reset:true,bothFactions:true,
   realCapture:true,realNet:true,realSprint:true,customHud:true,help:true,errors});
 }finally{await browser.close();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
