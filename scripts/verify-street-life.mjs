import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const out=resolve(process.env.STREET_ARTIFACT_DIR??'docs/verification/street-life-2026-10-22');
await mkdir(out,{recursive:true});
const results=[];
for(const channel of (process.env.STREET_CHANNELS??'chrome,msedge').split(',')){
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
  await page.addInitScript(()=>localStorage.setItem('who-ate-my-rice/controls-help-seen-v1','1'));
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch(),source=await response.text();
   assert(source.includes('const game = new ThreeGame('));
   await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__streetGame = new ThreeGame(')});
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:resolve(out,`${channel}-opening.png`)});
  const metrics=await page.evaluate(async()=>{
   const g=window.__streetGame;
   const layout=(await import('/src/three/ResidentialExterior.ts')).describeResidentialLayout((await import('/src/three/map/apartmentMap.ts')).ROOMS);
   window.__streetLayout=layout;
   return {drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,
    geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,
    props:!!g.scene.getObjectByName('street-life-visual-only')};
  });
  const flows=[];
  for(const faction of ['DEEPSEEK','HUMAN']){
   await page.locator(`.faction-card[data-faction="${faction}"]`).click();
   await page.waitForFunction(()=>window.__streetGame.match.phase==='PLAYING');
   await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');
   await page.screenshot({path:resolve(out,`${channel}-${faction}-playing.png`)});
   await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
   await page.locator('.faction-menu').waitFor({state:'visible'});
   assert.equal(await page.locator('.menu-start').count(),0);
   flows.push({faction,playing:true,returned:true});
  }
  // Real scene inspection cameras, deliberately distinct from normal gameplay framing.
  await page.evaluate(()=>{
   const g=window.__streetGame;cancelAnimationFrame(g.frame);g.menuAtmosphere.setMenuVisible(false);
   g.menu.hidden=true;g.alphaHud.root.hidden=true;g.controlsHelp.hide();
   document.querySelectorAll('.debug-top-row,.debug-panel,.dev-b-panel').forEach(n=>n.hidden=true);
  });
  for(const area of ['shop','parking','homes']){
   await page.evaluate(area=>{
    const g=window.__streetGame,l=window.__streetLayout;
    const shop=l.groups.find(p=>p.id==='corner-shop');
    const target=area==='shop'?{x:(shop.body.minX+shop.body.maxX)/2,z:shop.body.minZ+1}
     :area==='parking'?{x:l.right+26,z:l.front-1}:{x:l.cx-5,z:l.front+19};
    const viewWidth=area==='shop'?25:area==='parking'?33:44;
    const c=g.camera;c.zoom=1;c.left=-viewWidth/2;c.right=viewWidth/2;c.top=viewWidth*900/1600/2;c.bottom=-c.top;
    c.position.set(target.x+23,32,target.z-30);c.lookAt(target.x,0,target.z);
    c.updateProjectionMatrix();c.updateMatrixWorld();g.renderer.render(g.scene,c);
   },area);
   await page.screenshot({path:resolve(out,`${channel}-${area}-inspection.png`)});
  }
  assert.deepEqual(errors,[]);
  if(!process.env.STREET_BASELINE)assert(metrics.props,'street detail layer must be present');
  results.push({channel,metrics,flows,errors});
 }finally{await browser.close();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
