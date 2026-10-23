import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=resolve('docs/verification/upper-street-2026-10-22');
const before=!!process.env.UPPER_STREET_BEFORE,out=resolve(base,before?'before':'after');
await mkdir(out,{recursive:true});const results=[];
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  for(const [width,height]of [[1280,1186],[1920,1080],[1366,768]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(()=>localStorage.setItem('who-ate-my-rice/controls-help-seen-v1','1'));
   await page.route('**/src/main.ts*',async route=>{
    const response=await route.fetch(),source=await response.text();assert(source.includes('const game = new ThreeGame('));
    await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__upperGame = new ThreeGame(')});
   });
   await page.goto('http://127.0.0.1:5173/');
   await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});await page.evaluate(()=>document.fonts.ready);
   const key=`${channel}-${width}x${height}`;
   const layout=await page.locator('.menu-logo,.faction-card,.menu-settings').evaluateAll(nodes=>
    nodes.map(n=>{const r=n.getBoundingClientRect();return {className:n.className,box:[r.x,r.y,r.width,r.height]};}));
   assert.equal(layout.length,4,'logo, two faction cards and settings must be measured');
   if(!before){
    const accepted=JSON.parse(await readFile(resolve(base,'before',`${key}.json`),'utf8')).filter(item=>!String(item.className).includes('menu-start'));
    assert.deepEqual(layout,accepted,'accepted UI must not move');
   }
   await writeFile(resolve(out,`${key}.json`),JSON.stringify(layout,null,2));
   await page.screenshot({path:resolve(out,`${key}.png`)});
   if(width===1280)await page.screenshot({path:resolve(out,`${channel}-upper-detail.png`),
    clip:{x:580,y:100,width:440,height:240}});
   const projection=await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js');const g=window.__upperGame;
    const b=new T.Box3(),a=new T.Box3();
    g.scene.getObjectByName('street-life-visual-only').traverse(mesh=>{
     if(!mesh.isInstancedMesh)return;mesh.geometry.computeBoundingBox();
     mesh.userData.parts.forEach((name,i)=>{
      if(!name.startsWith('north-stop-'))return;
      const m=new T.Matrix4();mesh.getMatrixAt(i,m);m.premultiply(mesh.matrixWorld);
      a.copy(mesh.geometry.boundingBox).applyMatrix4(m);b.union(a);
     });
    });
    if(b.isEmpty())return null;
    const points=[];
    for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){
     const p=new T.Vector3(x,y,z).project(g.camera);points.push([(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2]);
    }
    return {left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
     top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
   });
   if(!before)assert(projection&&projection.left>0&&projection.right<width&&projection.top>0&&projection.bottom<height*.5,
    `bus stop must appear in the actual upper opening: ${JSON.stringify(projection)}`);
   if(!before&&width===1366){
    for(const faction of ['DEEPSEEK','HUMAN']){
     await page.locator(`.faction-card[data-faction="${faction}"]`).click();
     await page.waitForFunction(()=>window.__upperGame.match.phase==='PLAYING');
     await page.keyboard.press('Escape');await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
     await page.locator('.faction-menu').waitFor({state:'visible'});
    }
   }
   assert.deepEqual(errors,[]);results.push({channel,width,height,projection,uiUnchanged:!before,errors});await page.close();
  }
 }finally{await browser.close();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
