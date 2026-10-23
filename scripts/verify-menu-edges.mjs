import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const out=resolve(process.env.OPENING_ARTIFACT_DIR??'docs/verification/menu-edges-2026-10-22');
await mkdir(out,{recursive:true});
const results=[];
for(const channel of (process.env.OPENING_CHANNELS??'chrome,msedge').split(',')){
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();const source=await response.text();
   assert(source.includes('const game = new ThreeGame('));
   await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__edgeGame = new ThreeGame(')});
  });
  for(const [width,height] of [[1280,900],[1920,1080],[1768,890],[1366,768]]){
   await page.setViewportSize({width,height});
   await page.goto('http://127.0.0.1:5173/');
   await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
   await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.faction-menu img')].map(i=>i.decode()));
    const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/three/MenuAtmosphereView.ts')).name;
    window.__edgeConfig=(await import(url)).MENU_MOTION;
    window.__edgeConfig.foliage.enabled=false;
    window.__edgeConfig.interaction.enabled=false;
   });
   const positions=[[width/2,height/2],[1,height/2],[width-2,height/2],[width/2,1],[width/2,height-2],
    [1,1],[width-2,height-2],[width-2,1],[1,height-2]];
   for(let i=0;i<positions.length;i++){
    await page.mouse.move(...positions[i]);await page.waitForTimeout(900);
    const state=await page.evaluate(()=>{
     const menu=document.querySelector('.faction-menu');
     const point=window.__edgeGame.camera.position.clone().set(0,0,0).project(window.__edgeGame.camera);
     return {scene:{x:point.x*innerWidth/2,y:-point.y*innerHeight/2},
      ui:[...menu.querySelectorAll('.menu-logo,.faction-card,.menu-settings')].map(n=>{
       const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}),
      leaves:[...menu.querySelectorAll('.menu-motion-leaf')].map(n=>{
       const s=getComputedStyle(n,'::before'),r=n.querySelector('img').getBoundingClientRect();
       const transform=new DOMMatrixReadOnly(getComputedStyle(n).transform);
       return {borderImage:s.borderImageSource,scale:getComputedStyle(n.querySelector('img')).scale,
        x:transform.e,y:transform.f,
        box:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
      })};
    });
    await page.screenshot({path:resolve(out,`${channel}-${width}-${i}.png`)});
    if(i===0)results.push({channel,width,height,ui:state.ui,scales:state.leaves.map(n=>n.scale),
     scene:state.scene,leaf:state.leaves[0]});
    else {
     assert.deepEqual(state.ui,results.at(-1).ui,'core UI must not move with pointer');
     assert.deepEqual(state.leaves.map(n=>n.scale),results.at(-1).scales,'leaf size must not change with pointer');
     if(i===1||i===3){
      const axis=i===1?'x':'y',base=results.at(-1);
      const sceneDelta=state.scene[axis]-base.scene[axis],leafDelta=state.leaves[0][axis]-base.leaf[axis];
      assert(Math.abs(sceneDelta)>3,'real background scene must move');
      assert(sceneDelta*leafDelta<0,'foreground and scene must move independently in opposite directions');
     }
    }
    if(i>0)for(const leaf of state.leaves){
     assert.equal(leaf.borderImage,'none','moving leaves must not stretch one edge texel into a visible border strip');
     // DOM transform matrices serialize with finite precision; allow one layout subpixel.
     assert(leaf.box.left<=1/64&&leaf.box.top<=1/64&&leaf.box.right>=width-1/64&&leaf.box.bottom>=height-1/64,
       'moving artwork must cover viewport without an exposed rectangular edge: '+JSON.stringify({width,height,i,leaf}));
    }
   }
   await page.mouse.move(width/2,height/2);
   await page.waitForTimeout(1200);
   await page.evaluate(()=>window.__edgeConfig.foliage.enabled=true);
   const windSamples=[];
   for(let i=0;i<5;i++){
    await page.waitForTimeout(450);
    windSamples.push(await page.locator('.menu-motion-leaf').evaluateAll(nodes=>nodes.map(n=>{
     const m=new DOMMatrixReadOnly(getComputedStyle(n).transform);
     return {x:m.e,y:m.f,angle:Math.atan2(m.b,m.a)*180/Math.PI};
    })));
   }
   assert.notDeepEqual(windSamples[0],windSamples.at(-1),'leaves must sway with the pointer stationary');
   assert(windSamples.some(pair=>Math.abs(pair[0].angle-pair[1].angle)>.01),'wind groups must have different phases');
   for(const pair of windSamples)for(const p of pair)assert(Math.abs(p.angle)<=.551,'wind must remain subtle');
   results.at(-1).windSamples=windSamples;
   assert.deepEqual(await page.locator('.menu-motion-leaf-art').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).scale)),
    results.at(-1).scales,'wind must not resize foliage');
   await page.screenshot({path:resolve(out,`${channel}-${width}-wind.png`)});
  }
 }finally{await browser.close();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));
console.log('PASS',results.length,'browser/viewport combinations; center, four edges and four corners');
