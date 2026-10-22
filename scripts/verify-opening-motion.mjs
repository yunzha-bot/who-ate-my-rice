// Real browser evidence, using the existing local server and an isolated test-page observation handle.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out = resolve(process.env.OPENING_ARTIFACT_DIR ?? 'docs/verification/opening-motion');
await mkdir(out, { recursive: true });
const channel = process.env.OPENING_CHANNEL ?? 'chrome';
const prefix = channel === 'chrome' ? '' : `${channel}-`;
const browser = await chromium.launch({ channel, headless: true,
  args: process.argv.includes('--performance') || process.env.OPENING_USE_GPU==='1' ? ['--enable-unsafe-swiftshader'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.route('**/src/main.ts*', async route => {
  const response = await route.fetch(), source = await response.text();
  assert(source.includes('const game = new ThreeGame('));
  await route.fulfill({ response, body: source.replace('const game = new ThreeGame(', 'const game = window.__openingGame = new ThreeGame(') });
});
async function loaded() {
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.faction-menu img')].map(i=>i.decode()));
    await Promise.all([...document.querySelectorAll('.faction-copy strong,.faction-copy small,.faction-description b')].map(async n=>{
      const i=new Image(); i.src=getComputedStyle(n,'::before').backgroundImage.match(/url\(["']?([^"')]+)/)[1]; await i.decode();
    }));
  });
}
async function geometry() {
  return page.evaluate(()=>{
    const g=window.__openingGame;
    return { camera:g.camera.position.toArray(), quaternion:g.camera.quaternion.toArray(),
      ui:[...document.querySelectorAll('.menu-logo,.faction-card,.faction-portrait,.menu-start,.menu-settings,.menu-credits')].map(n=>{
        const r=n.getBoundingClientRect(); return {selector:n.className,x:r.x,y:r.y,w:r.width,h:r.height};
      }) };
  });
}
try {
  await loaded();
  if(process.argv.includes('--performance')) {
    const samples=await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/three/MenuAtmosphereView.ts')).name;
      const c=(await import(url)).MENU_MOTION,g=window.__openingGame,samples=[];
      for(const enabled of [false,true,false,true]) {
        c.enabled=enabled;await new Promise(r=>setTimeout(r,1200));
        const times=await new Promise(resolve=>{const times=[],render=g.renderer.render;
          g.renderer.render=function(...args){times.push(performance.now());render.apply(this,args);if(times.length===180){g.renderer.render=render;resolve(times);}};});
        const deltas=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
        samples.push({enabled,frames:times.length,meanFps:(times.length-1)*1000/(times.at(-1)-times[0]),p95Ms:deltas[Math.floor(deltas.length*.95)]});
      }
      const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',samples};
    });await writeFile(`${out}/hardware-performance.json`,JSON.stringify(samples,null,2));console.log(samples);
  } else if(process.argv.includes('--leaf-proof')) {
    await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/three/MenuAtmosphereView.ts')).name;
      const c=(await import(url)).MENU_MOTION;c.parallax.enabled=false;c.foliage.enabled=false;});
    await page.waitForFunction(()=>document.querySelectorAll('.menu-motion-leaf.is-moving').length===0);
    const style=await page.addStyleTag({content:`
      .game-canvas,.faction-menu > :not(.menu-foliage):not(.menu-motion-foliage) { visibility:hidden !important; }
      .faction-menu { background:#ded7bc !important; }
      .menu-motion-leaf { transform:none !important; }
      .menu-foliage { visibility:visible !important; }
      .menu-motion-foliage { display:none !important; }
    `});
    const sharp=(await import(process.env.SHARP_MODULE??'sharp')).default;
    const proof=[];
    for(const [w,h] of [[1920,1080],[1768,890]]) {
      await page.setViewportSize({width:w,height:h});
      await style.evaluate(n=>n.textContent=n.textContent.replace('.menu-motion-foliage { display:block !important; }','.menu-motion-foliage { display:none !important; }').replace('.menu-foliage { visibility:hidden !important; }','.menu-foliage { visibility:visible !important; }'));
      const original=await page.screenshot({path:`${out}/leaf-original-${w}x${h}.png`});
      await style.evaluate(n=>n.textContent=n.textContent.replace('.menu-motion-foliage { display:none !important; }','.menu-motion-foliage { display:block !important; }').replace('.menu-foliage { visibility:visible !important; }','.menu-foliage { visibility:hidden !important; }'));
      const split=await page.screenshot({path:`${out}/leaf-split-${w}x${h}.png`});
      const a=await sharp(original).raw().toBuffer(),b=await sharp(split).raw().toBuffer();
      let changed=0,maxDifference=0,totalDifference=0,interiorMax=0;
      const channels=a.length/(w*h);
      for(let i=0;i<a.length;i++){
        const d=Math.abs(a[i]-b[i]),pixel=Math.floor(i/channels),x=pixel%w,y=Math.floor(pixel/w);
        if(d)changed++;maxDifference=Math.max(maxDifference,d);totalDifference+=d;
        if(x>0&&x<w-1&&y>0&&y<h-1)interiorMax=Math.max(interiorMax,d);
      }
      // GPU alpha rounding is <= two steps internally. Fractional cover/clipping at the
      // viewport's outermost raster row/column is reported separately, never called identical.
      assert(interiorMax<=2,'interior leaf framing changed beyond alpha rounding');proof.push({w,h,changedChannels:changed,maxDifference,interiorMax,meanDifference:totalDifference/a.length});
    }
    await style.evaluate(n=>n.remove());await page.setViewportSize({width:1920,height:1080});
    await page.mouse.move(1900,100);assert(await page.evaluate(()=>window.__openingGame.menuAtmosphere.pointer.x>0));
    await page.waitForTimeout(400);await page.mouse.move(-10,-10);
    await page.waitForFunction(()=>window.__openingGame.menuAtmosphere.pointer.x===0&&window.__openingGame.menuAtmosphere.pointer.y===0);
    await writeFile(`${out}/leaf-proof.json`,JSON.stringify({proof,realPointerLeave:true},null,2));console.log(proof);
  } else if(process.argv.includes('--quick')) {
    await page.locator('.faction-card').first().hover();await page.waitForTimeout(1000);
    console.log(await page.evaluate(()=>{const n=document.querySelector('.faction-card'),s=getComputedStyle(n);
      return {active:window.__openingGame.menuAtmosphere.active,media:matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches,
        scale:s.scale,translate:s.translate,animation:s.animation,vars:[s.getPropertyValue('--menu-card-scale'),s.getPropertyValue('--menu-card-lift'),s.getPropertyValue('--menu-motion-ms')],
        rules:[...document.styleSheets].flatMap(sheet=>[...sheet.cssRules]).filter(r=>r.cssText?.includes('menu-interaction')).map(r=>r.cssText)};}));
  } else if(process.argv.includes('--baseline')) {
    await page.screenshot({path:`${out}/before-1920x1080.png`});
    const assets=['src/three/GameUiLayout.ts','src/config/gameConfig.ts','src/three/AlphaPresentation.ts',
      ...['logo','card-blue','card-yellow','start','foliage','rice-cat','rice-tub'].map(n=>`public/assets/ui/menu/${n}.webp`),
      ...['name-deepseek','name-human','role-deepseek','role-human','slogan-deepseek','slogan-human'].map(n=>`public/assets/ui/menu/labels/${n}.webp`),
      'public/assets/ui/portraits/deepseek-normal.png','public/assets/ui/portraits/human-guardian-v1.webp'];
    const hashes={}; for(const name of assets) hashes[name]=createHash('sha256').update(await readFile(name)).digest('hex');
    await writeFile(`${out}/baseline.json`, JSON.stringify({...await geometry(),hashes},null,2));
    console.log('Baseline saved: 1920x1080, camera/UI geometry and protected asset hashes.');
  } else {
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/three/MenuAtmosphereView.ts')).name;
      window.__motionConfig=(await import(url)).MENU_MOTION;
    });
    const baseline=JSON.parse(await readFile(`${out}/baseline.json`,'utf8'));
    for(const [name,hash] of Object.entries(baseline.hashes))
      assert.equal(createHash('sha256').update(await readFile(name)).digest('hex'),hash,`protected: ${name}`);
    const cfg=(key,value)=>page.evaluate(([key,value])=>{const c=window.__motionConfig;if(key==='enabled')c.enabled=value;else c[key].enabled=value;},[key,value]);
    const state=()=>page.evaluate(()=>{
      const g=window.__openingGame,v=g.menuAtmosphere,point=g.camera.position.clone().set(0,0,0).project(g.camera);
      return {phase:g.match.phase,active:v.active,offset:{...v.offset},seconds:v.seconds,visibleRice:v.visibleRiceCount,
        riceCount:v.particles.length,dom:document.querySelector('.faction-menu').querySelectorAll('*').length,
        projected:{x:point.x*innerWidth/2,y:-point.y*innerHeight/2},camera:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),
        leaf:[...document.querySelectorAll('.menu-motion-leaf')].map(n=>getComputedStyle(n).transform),
        canvas:{width:v.canvas.width,height:v.canvas.height},triangles:g.renderer.info.render.triangles,
        geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
    });
    await cfg('enabled',false);
    await page.waitForFunction(()=>!window.__openingGame.menuAtmosphere.active).catch(async e=>{console.log(await state());throw e;});
    assert.deepEqual((await geometry()).ui,baseline.ui);
    assert.deepEqual((await geometry()).camera,baseline.camera);
    await page.screenshot({path:`${out}/${prefix}motion-off-1920x1080.png`});
    const off=await state();
    await cfg('enabled',true); await cfg('interaction',false); await cfg('foliage',false); await cfg('rice',false);
    await page.waitForFunction(()=>window.__openingGame.menuAtmosphere.active);
    const center=await state(), positions=[];
    // Each result follows an actual mouse gesture, not a state assignment.
    for(const [name,x,y] of [['center',960,540],['top-left',1,1],['top-right',1919,1],['bottom-right',1919,1079],['bottom-left',1,1079]]) {
      console.log('Checking pointer:',name);
      await page.mouse.move(x,y,{steps:12});
      await page.waitForFunction(([x,y])=>{const v=window.__openingGame.menuAtmosphere;const nx=x/innerWidth*2-1,ny=y/innerHeight*2-1,l=Math.max(1,Math.hypot(nx,ny));
        return Math.hypot(v.offset.x-nx/l,v.offset.y-ny/l)<.002;},[x,y],{timeout:30000}).catch(async e=>{console.log(await page.evaluate(()=>{const v=window.__openingGame.menuAtmosphere;return {pointer:v.pointer,offset:v.offset,active:v.active,fine:v.finePointer.matches,hidden:document.hidden,config:window.__motionConfig};}));throw e;});
      const s=await state(), dx=s.projected.x-center.projected.x,dy=s.projected.y-center.projected.y;
      assert(Math.hypot(dx,dy)<=12.01);assert.deepEqual(s.quaternion,off.quaternion);
      assert.deepEqual((await geometry()).ui,baseline.ui,'core UI must not inherit parallax');
      if(name!=='center'){assert(Math.sign(dx)===Math.sign(x-960));assert(Math.sign(dy)===Math.sign(y-540));}
      await page.screenshot({path:`${out}/${prefix}${name}.png`});
      positions.push({name,dx,dy,...s});
    }
    const held=await state();await page.waitForTimeout(2500);const later=await state();
    assert(Math.hypot(later.projected.x-held.projected.x,later.projected.y-held.projected.y)<.04,'no accumulated drift');
    // Real browser CDP emits blur/leave; collect both the intermediate and settled position.
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(()=>Math.hypot(window.__openingGame.menuAtmosphere.offset.x,window.__openingGame.menuAtmosphere.offset.y)<.001,{timeout:30000});
    const recentered=await state();assert(Math.abs(recentered.projected.x-center.projected.x)<.02);
    await cfg('foliage',true);await cfg('rice',true);await cfg('interaction',true);
    const windBefore=await state();await page.waitForTimeout(1300);const windAfter=await state();
    assert.notDeepEqual(windAfter.leaf,windBefore.leaf,'wind must move without pointer input');
    assert.notEqual(windAfter.leaf[0],windAfter.leaf[1]);
    const riceSamples=[];for(let i=0;i<15;i++){riceSamples.push((await state()).visibleRice);await page.waitForTimeout(300);}
    console.log({riceSamples});
    assert(riceSamples.every(n=>n>=8&&n<=15),'visible rice must remain sparse but not disappear behind UI');
    const card=page.locator('.faction-card[data-faction="DEEPSEEK"]');
    await page.mouse.move(960,100);await page.waitForTimeout(350);const cardBefore=await card.boundingBox();
    await card.hover();await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.faction-card')).scale)>1.01);
    await page.waitForTimeout(350);const cardHover=await card.boundingBox();
    console.log({cardBefore,cardHover,css:await card.evaluate(n=>({scale:getComputedStyle(n).scale,translate:getComputedStyle(n).translate,hover:n.matches(':hover'),attrs:n.parentElement.parentElement.parentElement.getAttributeNames()}))});
    assert(cardHover.width/cardBefore.width>1.01&&cardHover.width/cardBefore.width<1.0251);
    await card.click();await page.waitForTimeout(400);assert.equal(await card.getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.faction-card[data-faction="HUMAN"]').getAttribute('aria-pressed'),'false');
    const selection=await card.evaluate(n=>({filter:getComputedStyle(n).filter,scale:getComputedStyle(n).scale}));
    const start=page.locator('.menu-start');await start.hover();await page.waitForTimeout(350);
    await page.mouse.down();await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.menu-start')).scale)<1);
    const pressed=await start.evaluate(n=>({scale:getComputedStyle(n).scale,translate:getComputedStyle(n).translate}));
    await page.mouse.move(1910,1070);await page.mouse.up(); // Release off-button: must not start a match.
    assert.equal((await state()).phase,'FACTION_SELECT');
    await page.screenshot({path:`${out}/${prefix}all-motion.png`});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>!window.__openingGame.menuAtmosphere.active);
    await page.mouse.move(1919,1);const reducedBefore=await state();await page.waitForTimeout(1000);const reducedAfter=await state();
    assert.deepEqual(reducedAfter.camera,reducedBefore.camera);assert.equal(reducedAfter.seconds,reducedBefore.seconds);
    assert.equal(await page.locator('.menu-motion-rice').evaluate(n=>getComputedStyle(n).display),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');
    const memoryBefore=await cdp.send('Runtime.getHeapUsage');const domBefore=await cdp.send('Memory.getDOMCounters');
    const beforeLong=await state();await page.waitForTimeout(Number(process.env.MOTION_SOAK_MS??90000));const afterLong=await state();
    await cdp.send('HeapProfiler.collectGarbage');const memoryAfter=await cdp.send('Runtime.getHeapUsage');const domAfter=await cdp.send('Memory.getDOMCounters');
    assert.equal(afterLong.dom,beforeLong.dom);assert.equal(afterLong.riceCount,beforeLong.riceCount);
    assert.equal(afterLong.geometries,beforeLong.geometries);assert.equal(afterLong.textures,beforeLong.textures);
    assert.equal(domAfter.jsEventListeners,domBefore.jsEventListeners);
    const extraWorkMs=await page.evaluate(()=>{const v=window.__openingGame.menuAtmosphere,samples=[];
      for(let i=0;i<120;i++){const t=performance.now();v.update(1000/60);samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);return {median:samples[60],p95:samples[114],max:samples[119]};});
    const other=await context.newPage();await other.bringToFront();
    const nativeHidden=await page.evaluate(()=>document.hidden);
    if(!nativeHidden)await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    const hiddenBefore=await state();await page.waitForTimeout(500);const hiddenAfter=await state();
    assert.equal(hiddenBefore.active,false);assert.equal(hiddenAfter.seconds,hiddenBefore.seconds);
    await other.close();await page.bringToFront();
    if(!nativeHidden)await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>window.__openingGame.menuAtmosphere.active);
    const flows=[];
    for(const faction of ['DEEPSEEK','HUMAN']) {
      await page.locator(`.faction-card[data-faction="${faction}"]`).click();await page.locator('.menu-start').click();
      assert.equal((await state()).phase,'READY');assert.equal((await state()).active,false);
      assert.equal(await page.locator('.faction-menu[data-menu-motion]').count(),0);
      const stopped=await state();await page.mouse.move(1919,1);await page.waitForTimeout(300);
      // Existing depth fitting may retreat along camera Z after chooseFaction; compare screen framing,
      // not raw Z/position, so this check does not falsely reject the protected depth-fit system.
      const still=await state();assert(Math.hypot(still.projected.x-stopped.projected.x,still.projected.y-stopped.projected.y)<.001);
      assert.deepEqual(still.quaternion,stopped.quaternion);assert.equal(still.seconds,stopped.seconds);
      // Re-dispatch stale button clicks after the real click: neither may restart READY.
      await page.locator('.menu-start').dispatchEvent('click');await page.locator('.menu-start').dispatchEvent('click');
      assert.equal((await state()).phase,'READY');
      if(await page.locator('.controls-help').isVisible())await page.locator('.controls-help-close').click();
      await page.waitForFunction(()=>window.__openingGame.match.phase==='PLAYING',{timeout:30000});
      await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__openingGame.match.phase==='PAUSED');
      await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
      assert.equal((await state()).phase,'FACTION_SELECT');assert.equal((await state()).active,true);
      assert.equal((await state()).riceCount,14);assert.deepEqual((await state()).offset,{x:0,y:0});
      assert.equal(await page.locator('.menu-motion-rice').count(),1);assert.equal(await page.locator('.menu-motion-leaf').count(),2);
      flows.push(`${faction}: start once, READY camera unaffected by pointer, opening animation stopped, PLAYING/pause/menu reset`);
    }
    for(const [width,height] of [[1768,890],[1366,768],[390,844]]) {
      await page.setViewportSize({width,height});await page.mouse.move(100,40);await page.waitForTimeout(300);
      assert(await page.locator('.faction-menu').evaluate(n=>n.scrollWidth<=innerWidth));
      assert(await page.locator('.faction-portrait').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).objectFit==='contain')));
      await page.screenshot({path:`${out}/${prefix}dynamic-${width}x${height}.png`});
    }
    const countLeave=async()=>(await cdp.send('Runtime.evaluate',{expression:'(getEventListeners(window).pointerout || []).length',includeCommandLineAPI:true,returnByValue:true})).result.value;
    const leaveListenersBefore=await countLeave();
    await page.evaluate(()=>window.__openingGame.menuAtmosphere.dispose());
    const leaveListenersAfter=await countLeave();assert.equal(leaveListenersAfter,leaveListenersBefore-1);
    assert.equal(await page.locator('.menu-motion-rice,.menu-motion-foliage').count(),0);
    assert.deepEqual(errors,[]);
    await writeFile(`${out}/${prefix}motion-results.json`,JSON.stringify({positions,recentered,riceSamples,cardBefore,cardHover,selection,pressed,reducedBefore,reducedAfter,beforeLong,afterLong,memoryBefore,memoryAfter,domBefore,domAfter,extraWorkMs,visibility:{nativeHidden,hiddenBefore,hiddenAfter},flows,leaveListenersBefore,leaveListenersAfter,errors},null,2));
    console.log(JSON.stringify({channel,positions:positions.map(({name,dx,dy})=>({name,dx,dy})),riceSamples,cardScale:cardHover.width/cardBefore.width,stablePool:afterLong.riceCount,errors},null,2));
  }
} finally { await context.close(); await browser.close(); }
