// Real game integration evidence; expose only a test-page handle, never alter gameplay source.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const out=resolve(process.env.HUMAN_ARTIFACT_DIR??'docs/verification/human-v2-integration-2026-10-22');
await mkdir(out,{recursive:true});
const results=[];
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.url().endsWith('human_v2.glb')){requests.push({url:r.url(),status:r.status()});if(r.status()!==200)errors.push('Human resource failure');}});
  await page.addInitScript(()=>localStorage.setItem('who-ate-my-rice/controls-help-seen-v1','1'));
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch(),source=await response.text();assert(source.includes('const game = new ThreeGame('));
   await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__humanGame = new ThreeGame(')});
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  await page.waitForFunction(()=>!!window.__humanGame.human.getObjectByName('HumanGLB'));
  const sample=()=>page.evaluate(async()=>{
   const T=await import('/node_modules/.vite/deps/three.js');
   const g=window.__humanGame,m=g.human.getObjectByName('HumanGLB');
   const bounds=new T.Box3().setFromObject(m);
   return {phase:g.match.phase,position:g.human.position.toArray(),uuid:m.uuid,
    visualHeight:bounds.max.y-bounds.min.y,groundY:bounds.min.y,
    left:m.getObjectByName('HumanLegPivot.L').rotation.x,right:m.getObjectByName('HumanLegPivot.R').rotation.x,
    heading:g.humanAction.headingRad,rootScale:g.human.scale.toArray(),visible:g.human.visible,
    models:g.human.children.reduce((n,o)=>{o.traverse(c=>{if(c.name==='HumanGLB')n++;});return n;},0)};
  });
  const identity=(await sample()).uuid,flows=[];
  await page.screenshot({path:resolve(out,`${channel}-opening.png`)});
  for(const faction of ['HUMAN','DEEPSEEK']){
   await page.locator(`.faction-card[data-faction="${faction}"]`).click();
   await page.waitForFunction(()=>window.__humanGame.match.phase==='READY');
   const ready=await sample();await page.waitForTimeout(120);assert.deepEqual(await sample(),ready);
   if(process.env.HUMAN_EXPECT_HEIGHT)assert(Math.abs(ready.visualHeight-Number(process.env.HUMAN_EXPECT_HEIGHT))<1e-5,`visual height ${ready.visualHeight} must match target ${process.env.HUMAN_EXPECT_HEIGHT}`);
   assert(Math.abs(ready.groundY)<1e-5,'enlarged feet stay on the ground');
   await page.screenshot({path:resolve(out,`${channel}-${faction}-ready.png`)});
   await page.waitForFunction(()=>window.__humanGame.match.phase==='PLAYING');
   const start=await sample();
   if(faction==='HUMAN'){
    await page.keyboard.down('KeyD');await page.waitForTimeout(280);
    const walking=await sample();await page.keyboard.up('KeyD');
    assert.notDeepEqual(walking.position,start.position,'real keyboard input must move Human');
    assert(Math.abs(walking.left)>.01,'rigid legs must animate during actual input');
    assert(Math.abs(walking.left+walking.right)<1e-8);
    await page.keyboard.down('KeyS');await page.waitForTimeout(500);await page.keyboard.up('KeyS');
   }else{
    await page.waitForFunction(()=>Math.abs(window.__humanGame.human.getObjectByName('HumanLegPivot.L').rotation.x)>.01);
   }
   await page.screenshot({path:resolve(out,`${channel}-${faction}-playing.png`)});
   if(faction==='HUMAN'){
    // Crop actual render around the projected character, without changing its camera/scale.
    const clip=await page.evaluate(async()=>{
     const T=await import('/node_modules/.vite/deps/three.js'),g=window.__humanGame;
     const b=new T.Box3().setFromObject(g.human.getObjectByName('HumanGLB')),p=b.getCenter(new T.Vector3()).project(g.camera);
     return {x:Math.min(innerWidth-280,Math.max(0,(p.x+1)*innerWidth/2-140)),
      y:Math.min(innerHeight-280,Math.max(0,(1-p.y)*innerHeight/2-140)),width:280,height:280};
    });
    await page.screenshot({path:resolve(out,`${channel}-human-detail.png`),clip});
   }
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__humanGame.match.phase==='PAUSED');
   const paused=await sample();await page.waitForTimeout(220);assert.deepEqual(await sample(),paused);
   await page.getByRole('button',{name:'继续游戏',exact:true}).click();await page.waitForFunction(()=>window.__humanGame.match.phase==='PLAYING');
   await page.keyboard.press('Escape');await page.getByRole('button',{name:'重新开始',exact:true}).click();
   await page.waitForFunction(()=>window.__humanGame.match.phase==='PLAYING');assert.equal((await sample()).uuid,identity);
   await page.keyboard.press('Escape');await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
   await page.locator('.faction-menu').waitFor({state:'visible'});
   const returned=await sample();assert.equal(returned.uuid,identity);assert.equal(returned.models,1);assert.deepEqual(returned.rootScale,[1,1,1]);
   flows.push({faction,ready:true,visualHeight:ready.visualHeight,groundY:ready.groundY,playing:true,humanAnimated:true,pauseFrozen:true,restartSameModel:true,returnedSingleModel:true});
  }
  await page.screenshot({path:resolve(out,`${channel}-returned-menu.png`)});
  assert.equal(requests.length,1);assert.deepEqual(errors,[]);
  // An unavailable Human must keep the explicit loading fallback usable, not unlock silently.
  const failed=await browser.newPage({viewport:{width:1366,height:768}}),failureErrors=[];
  failed.on('pageerror',e=>failureErrors.push(String(e)));
  await failed.route('**/assets/characters/human/human_v2.glb',r=>r.fulfill({status:404,body:'intentional unavailable model'}));
  await failed.route('**/src/main.ts*',async route=>{
   const response=await route.fetch(),source=await response.text();
   await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__humanGame = new ThreeGame(')});
  });
  await failed.goto('http://127.0.0.1:5173/');await failed.locator('.startup-simplify').waitFor({state:'visible'});
  assert.equal(await failed.locator('#app').evaluate(n=>n.inert),true);
  await failed.locator('.startup-simplify').click();await failed.locator('.startup-view').waitFor({state:'detached'});
  assert(await failed.evaluate(()=>!window.__humanGame.human.getObjectByName('HumanGLB')&&
   window.__humanGame.human.getObjectByName('leftLeg').visible));
  assert.deepEqual(failureErrors,[]);await failed.close();
  results.push({channel,version:browser.version(),requests,flows,explicitFailureFallback:true,errors});
  console.log(JSON.stringify(results.at(-1)));
 }finally{await browser.close();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));
