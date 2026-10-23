// Real browser motion/flow evidence. Inspection cameras are temporary test-only views.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const out=resolve(process.env.STREET_ACTIVITY_ARTIFACT_DIR??'docs/verification/street-activity-2026-10-22');
await mkdir(out,{recursive:true});
const results=[];
const positions=page=>page.evaluate(()=>window.__streetGame.apartment.streetActivity.root.children.map(o=>o.position.toArray()));
const uiBoxes=page=>page.locator('.menu-logo,.faction-card,.menu-settings-bar').evaluateAll(nodes=>
 nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
for(const channel of (process.env.STREET_CHANNELS??'chrome,msedge').split(',')){
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 const errors=[];
 try{
  const setup=async page=>{
   page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(()=>localStorage.setItem('who-ate-my-rice/controls-help-seen-v1','1'));
   await page.route('**/src/main.ts*',async route=>{
    const response=await route.fetch(),source=await response.text();
    assert(source.includes('const game = new ThreeGame('));
    await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__streetGame = new ThreeGame(')});
   });
   await page.goto('http://127.0.0.1:5173/');
   await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  };
  const page=await context.newPage();await setup(page);
  await page.evaluate(()=>document.fonts.ready);
  const identity=await page.evaluate(()=>window.__streetGame.apartment.streetActivity.root.uuid);
  const before=await positions(page),boxes=await uiBoxes(page);
  await page.waitForTimeout(550);
  const after=await positions(page);
  assert(after.every((p,i)=>Math.abs(p[0]-before[i][0])>.05),'all six actors visibly advance');
  assert.deepEqual(await uiBoxes(page),boxes,'background motion must not move UI');
  await page.screenshot({path:resolve(out,`${channel}-opening.png`)});
  const flows=[];
  for(const faction of ['DEEPSEEK','HUMAN']){
   await page.locator(`.faction-card[data-faction="${faction}"]`).click();
   await page.waitForFunction(()=>window.__streetGame.match.phase==='READY');
   const ready=await positions(page);await page.waitForTimeout(150);assert.deepEqual(await positions(page),ready);
   await page.waitForFunction(()=>window.__streetGame.match.phase==='PLAYING');
   const playing=await positions(page);await page.waitForTimeout(200);assert.notDeepEqual(await positions(page),playing);
   await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');
   await page.screenshot({path:resolve(out,`${channel}-${faction}-playing.png`)});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__streetGame.match.phase==='PAUSED');
   const paused=await positions(page);await page.waitForTimeout(200);assert.deepEqual(await positions(page),paused);
   await page.getByRole('button',{name:'继续游戏',exact:true}).click();
   await page.waitForFunction(()=>window.__streetGame.match.phase==='PLAYING');
   await page.waitForTimeout(150);assert.notDeepEqual(await positions(page),paused);
   await page.keyboard.press('Escape');await page.getByRole('button',{name:'重新开始',exact:true}).click();
   await page.waitForFunction(()=>window.__streetGame.match.phase==='PLAYING');
   assert.equal(await page.evaluate(()=>window.__streetGame.apartment.streetActivity.root.uuid),identity);
   await page.keyboard.press('Escape');await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
   await page.locator('.faction-menu').waitFor({state:'visible'});
   assert.equal(await page.locator('.menu-start').count(),0);
   assert.equal(await page.evaluate(()=>window.__streetGame.apartment.streetActivity.root.uuid),identity);
   assert.equal((await positions(page)).length,6);
   flows.push({faction,readyFrozen:true,playing:true,pauseFrozen:true,resume:true,restarted:true,returnedSameSixActors:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await positions(page);await page.waitForTimeout(200);assert.deepEqual(await positions(page),reduced);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(200);
  assert.notDeepEqual(await positions(page),reduced);
  const cover=await context.newPage();await cover.goto('about:blank');await cover.bringToFront();
  const focus=await page.evaluate(()=>({hidden:document.hidden,focused:document.hasFocus()}));
  let backgroundVerified=false;
  if(focus.hidden||!focus.focused){
   const background=await positions(page);await page.waitForTimeout(200);
   assert.deepEqual(await positions(page),background);backgroundVerified=true;
  }
  await cover.close();await page.bringToFront();
  const metrics=await page.evaluate(()=>{
   const g=window.__streetGame;
   return {calls:g.renderer.info.render.calls,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  });
  // Show a useful close-up while retaining the real ThreeGame requestAnimationFrame loop.
  const inspect=async p=>p.evaluate(async()=>{
   const g=window.__streetGame;
   const {describeResidentialLayout}=await import('/src/three/ResidentialExterior.ts');
   const {ROOMS}=await import('/src/three/map/apartmentMap.ts');const l=describeResidentialLayout(ROOMS);
   g.menuAtmosphere.setMenuVisible(false);g.menu.hidden=true;g.alphaHud.root.hidden=true;
   document.querySelectorAll('.debug-top-row,.debug-panel,.dev-b-panel').forEach(n=>n.hidden=true);
   const c=g.camera,w=65,x=l.cx-8,z=l.front+7;
   c.zoom=1;c.left=-w/2;c.right=w/2;c.top=w*900/1600/2;c.bottom=-c.top;
   c.position.set(x+23,32,z-30);c.lookAt(x,0,z);c.updateProjectionMatrix();c.updateMatrixWorld();
  });
  await inspect(page);await page.waitForTimeout(200);
  await page.screenshot({path:resolve(out,`${channel}-street-0.png`)});
  await page.waitForTimeout(2400);await page.screenshot({path:resolve(out,`${channel}-street-2.png`)});
  if(channel==='chrome'){
   const movie=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:resolve(out,'raw'),size:{width:1600,height:900}}});
   const videoPage=await movie.newPage();await setup(videoPage);await inspect(videoPage);
   await videoPage.waitForTimeout(12000);const video=videoPage.video();await movie.close();
   await video.saveAs(resolve(out,'chrome-street-motion.webm'));
  }
  assert.deepEqual(errors,[]);
  results.push({channel,flows,allSixMove:true,coreUiStable:true,reducedMotionVerified:true,backgroundVerified,focus,metrics,errors});
 }finally{await context.close();await browser.close();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
