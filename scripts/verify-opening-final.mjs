// Stage D: fresh real-browser evidence; observation handle exists only in this isolated page.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out=resolve(process.env.OPENING_ARTIFACT_DIR ?? 'docs/verification/opening-final-2026-10-22');
await mkdir(out,{recursive:true});
const channel=process.env.OPENING_CHANNEL??'chrome';
const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const page=await context.newPage(), errors=[], result={channel,version:browser.version(),layouts:[],flows:[],errors};
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.route('**/src/main.ts*',async route=>{const response=await route.fetch(),source=await response.text();
  assert(source.includes('const game = new ThreeGame('));await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__openingGame = new ThreeGame(')});});
const shot=async name=>{await page.screenshot({path:`${out}/${channel}-${name}.png`});};
const phase=()=>page.evaluate(()=>window.__openingGame.match.phase);
const waitPhase=p=>page.waitForFunction(p=>window.__openingGame.match.phase===p,p,{timeout:30000});
const state=()=>page.evaluate(()=>{const g=window.__openingGame,v=g.menuAtmosphere;return {phase:g.match.phase,active:v.active,seconds:v.seconds,pool:v.particles.length,visible:v.visibleRiceCount,offset:{...v.offset},canvas:document.querySelectorAll('.menu-motion-rice').length,leaves:document.querySelectorAll('.menu-motion-leaf').length};});
try {
  await page.goto('http://127.0.0.1:5173/');await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.faction-menu img')].map(i=>i.decode()));
    const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/three/MenuAtmosphereView.ts')).name;window.__motionConfig=(await import(url)).MENU_MOTION;
    await Promise.all([...document.querySelectorAll('.faction-copy strong,.faction-copy small,.faction-description b')].map(async n=>{const url=getComputedStyle(n,'::before').backgroundImage.match(/url\(["']?([^"')]+)/)[1],i=new Image();i.src=url;await i.decode();}));});
  result.startedAt=new Date().toISOString();
  result.gpu=await page.evaluate(()=>{const gl=window.__openingGame.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';});
  await page.evaluate(()=>{window.__motionConfig.enabled=false;});await page.waitForFunction(()=>!window.__openingGame.menuAtmosphere.active);
  for(const [width,height] of [[1920,1080],[1768,890],[1600,900],[1366,768]]) {
    await page.setViewportSize({width,height});await page.mouse.move(width/2,20);await page.waitForTimeout(180);
    const layout=await page.evaluate(()=>{
      const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
      const selectors=['.menu-logo','.faction-card[data-faction="DEEPSEEK"]','.faction-card[data-faction="HUMAN"]','.menu-settings'];
      return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport.scale,overflow:document.querySelector('.faction-menu').scrollWidth>innerWidth,
        menuScrollHeight:document.querySelector('.faction-menu').scrollHeight,
        boxes:selectors.map(s=>({selector:s,...rect(document.querySelector(s))})),
        hitTargets:selectors.slice(1).map(s=>{const n=document.querySelector(s),r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {selector:s,ownsCenter:n===hit||n.contains(hit)};}),
        portraits:[...document.querySelectorAll('.faction-portrait')].map(n=>({src:n.getAttribute('src'),natural:[n.naturalWidth,n.naturalHeight],fit:getComputedStyle(n).objectFit,...rect(n)}))};});
    assert.equal(layout.scale,1);assert.equal(layout.dpr,1);assert.equal(layout.overflow,false);
    assert(layout.hitTargets.every(t=>t.ownsCenter),'an overlay intercepted a main control');
    for(const b of layout.boxes)assert(b.x>=0&&b.y>=0&&b.x+b.w<=width+.5&&b.y+b.h<=layout.menuScrollHeight+.5,`unreachable ${b.selector}`);
    assert(layout.portraits.every(p=>p.fit==='contain'&&p.natural.every(x=>x>0)));
    await shot(`static-${width}x${height}`);result.layouts.push(layout);
  }
  await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>{window.__motionConfig.enabled=true;});
  await page.waitForFunction(()=>window.__openingGame.menuAtmosphere.active);
  assert.equal(await page.locator('.menu-start').count(),0);
  await page.locator('[data-menu-panel="audio"]').click();await page.locator('.menu-audio-slot input[type="range"]').first().fill('37');
  await page.getByLabel('总静音',{exact:true}).check();
  assert.deepEqual(await page.evaluate(()=>[window.__openingGame.audio.settings.master,window.__openingGame.audio.settings.muted]),[.37,true]);
  await shot('audio-settings');await page.locator('[data-menu-panel="difficulty"]').click();assert(await page.locator('.menu-audio-slot').isHidden());
  for(const difficulty of ['NORMAL','HARD','EASY']) {if(await page.locator('.menu-difficulty-slot').isHidden())await page.locator('[data-menu-panel="difficulty"]').click();await page.locator(`input[name="difficulty"][value="${difficulty}"]`).check();assert.equal(await page.evaluate(()=>window.__openingGame.difficultyView.value),difficulty);}
  await page.keyboard.press('Escape');
  // Each effect switch is exercised against the actual imported module instance.
  result.switches=[];
  for(const [key,attribute] of [['rice','data-menu-rice'],['interaction','data-menu-interaction']]) {
    await page.evaluate(k=>window.__motionConfig[k].enabled=false,key);await page.waitForFunction(a=>!document.querySelector('.faction-menu').hasAttribute(a),attribute);
    result.switches.push({key,off:true,display:key==='rice'?await page.locator('.menu-motion-rice').evaluate(n=>getComputedStyle(n).display):null});
    await page.evaluate(k=>window.__motionConfig[k].enabled=true,key);
  }
  await page.mouse.move(1900,40);await page.waitForTimeout(1000);
  await page.mouse.move(-10,-10);await page.waitForFunction(()=>Math.hypot(window.__openingGame.menuAtmosphere.offset.x,window.__openingGame.menuAtmosphere.offset.y)<.001);
  result.realPointerLeave=await state();
  // Native CDP window minimization, without mocking document.hidden. Headless may not hide.
  const cdp=await context.newCDPSession(page);
  try {const w=await cdp.send('Browser.getWindowForTarget');await cdp.send('Browser.setWindowBounds',{windowId:w.windowId,bounds:{windowState:'minimized'}});await page.waitForTimeout(600);
    const hidden=await page.evaluate(()=>document.hidden);const before=await state();await page.waitForTimeout(400);const after=await state();
    result.nativeBackground={hidden,before,after,verified:hidden&&!before.active&&before.seconds===after.seconds};
    await cdp.send('Browser.setWindowBounds',{windowId:w.windowId,bounds:{windowState:'normal'}});await page.bringToFront();
  }catch(e){result.nativeBackground={verified:false,reason:String(e)};}
  await page.waitForFunction(()=>window.__openingGame.menuAtmosphere.active);
  result.listenersBefore=(await cdp.send('Memory.getDOMCounters')).jsEventListeners;
  for(const faction of ['DEEPSEEK','HUMAN']) {
    if(faction==='DEEPSEEK') {
      await page.evaluate(async()=>{const {StartupReadiness}=await import('/src/three/StartupReadiness.ts');window.__savedGate=window.__openingGame.startupReadiness;window.__openingGame.startupReadiness=new StartupReadiness();});
      await page.locator('.faction-card[data-faction="DEEPSEEK"]').click();assert.equal(await phase(),'FACTION_SELECT');
      await page.evaluate(()=>{window.__openingGame.startupReadiness=window.__savedGate;delete window.__savedGate;});
    }
    const card=page.locator(`.faction-card[data-faction="${faction}"]`);
    await card.focus();await page.keyboard.press(faction==='DEEPSEEK'?'Space':'Enter');await waitPhase('READY');
    assert.equal(await card.getAttribute('aria-pressed'),'true');await shot(`${faction}-ready`);
    assert(!(await state()).active);assert.equal(await page.evaluate(()=>window.__openingGame.control.controlledFaction),faction);
    const teaching=await page.locator('.controls-help').isVisible();if(teaching)await page.locator('.controls-help-close').click();
    await waitPhase('PLAYING');
    const actorPosition=()=>page.evaluate(f=>{const g=window.__openingGame,p=(f==='HUMAN'?g.human:g.player).position;return {x:p.x,z:p.z};},faction);
    const stopped=await state(),positionBefore=await actorPosition();await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');const positionAfter=await actorPosition();await shot(`${faction}-playing`);
    assert(Math.hypot(positionAfter.x-positionBefore.x,positionAfter.z-positionBefore.z)>.001,'real WASD movement must move the controlled actor');
    assert.equal((await state()).seconds,stopped.seconds);
    await page.keyboard.press('Escape');await waitPhase('PAUSED');await shot(`${faction}-paused`);
    await page.getByRole('button',{name:'继续游戏',exact:true}).click();await waitPhase('PLAYING');
    await page.keyboard.press('Escape');await waitPhase('PAUSED');await page.getByRole('button',{name:'重新开始',exact:true}).click();
    await waitPhase('READY');assert(!(await state()).active);await shot(`${faction}-restarted`);await waitPhase('PLAYING');
    await page.keyboard.press('Escape');await waitPhase('PAUSED');await page.getByRole('button',{name:'返回主菜单',exact:true}).click();await waitPhase('FACTION_SELECT');
    const returned=await state();assert(returned.active);assert.equal(returned.canvas,1);assert.equal(returned.leaves,2);assert.equal(returned.pool,14);
    assert.equal(await page.locator('.menu-start').count(),0);await page.mouse.move(960,60);await shot(`${faction}-returned`);
    result.flows.push({faction,teaching,ready:true,played:true,moveInput:true,positionBefore,positionAfter,pauseResume:true,restartReadyPlaying:true,returned});
  }
  result.listenersAfter=(await cdp.send('Memory.getDOMCounters')).jsEventListeners;
  // Normal game UI creates lazy listeners on first use; menu-specific node count must not grow.
  for(const [width,height] of [[1768,890],[1600,900],[1366,768],[1920,1080]]) {
    await page.setViewportSize({width,height});await page.mouse.move(width-1,1);await page.waitForTimeout(450);await shot(`dynamic-${width}x${height}`);
    const s=await state();assert(Number.isFinite(s.offset.x)&&Math.hypot(s.offset.x,s.offset.y)<=1.00001);assert.equal(s.canvas,1);
  }
  result.final=await state();result.protectedHashes={};
  for(const p of ['src/three/MenuAtmosphereView.ts','src/three/ThreeGame.ts','src/opening-menu.css','src/config/gameConfig.ts','public/assets/ui/portraits/deepseek-normal.png','public/assets/ui/portraits/human-guardian-v1.webp'])result.protectedHashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');
  assert.deepEqual(errors,[]);await writeFile(`${out}/${channel}-final-results.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({channel,layouts:result.layouts.length,flows:result.flows,nativeBackground:result.nativeBackground,errors},null,2));
} catch(e){result.failure=String(e);await writeFile(`${out}/${channel}-failed-results.json`,JSON.stringify(result,null,2));await shot('failure');throw e;}
finally {await context.close();await browser.close();}
