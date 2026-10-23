// Capture real browser frames (Playwright video), then remove loading time with its recording helper.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out=resolve(process.env.OPENING_ARTIFACT_DIR??'docs/verification/opening-motion');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:join(out,'raw'),size:{width:1920,height:1080}}});
const videoStart=Date.now(),page=await context.newPage(),video=page.video();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/src/main.ts*',async route=>{const response=await route.fetch(),source=await response.text();
  await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__openingGame = new ThreeGame(')});});
try {
  await page.goto('http://127.0.0.1:5173/');await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  await page.evaluate(()=>document.fonts.ready);await page.mouse.move(960,150);
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('.game-canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
  // The browser recorder omits the OS cursor. This test-only marker follows real pointer events.
  await page.evaluate(()=>{
    const cursor=document.createElement('div');cursor.style.cssText='position:fixed;left:0;top:0;z-index:9999;width:18px;height:26px;pointer-events:none';
    cursor.innerHTML='<svg viewBox="0 0 18 26"><path d="M1 1v20l5-5 4 8 3-2-4-8h8Z" fill="white" stroke="#172a33" stroke-width="1.2"/></svg>';
    document.body.append(cursor);window.addEventListener('pointermove',e=>{cursor.style.transform=`translate(${e.clientX}px,${e.clientY}px)`;});
  });
  const start=Date.now(),events=[];
  await page.evaluate(()=>{const g=window.__openingGame,render=g.renderer.render.bind(g.renderer);window.__recordFrames=[];
    g.renderer.render=(...args)=>{window.__recordFrames.push(performance.now());return render(...args);};});
  async function sweep(x0,y0,x1,y1,ms) {
    const began=Date.now();
    while(Date.now()-began<ms) {const t=Math.min(1,(Date.now()-began)/ms);await page.mouse.move(x0+(x1-x0)*t,y0+(y1-y0)*t);await page.waitForTimeout(50);}
    await page.mouse.move(x1,y1);events.push({x:x1,y:y1,t:(Date.now()-start)/1000});
  }
  await sweep(960,150,1820,140,1700);await sweep(1820,140,120,950,2100);
  await sweep(120,950,680,580,1700);await page.locator('.faction-card[data-faction="DEEPSEEK"]').hover();await page.waitForTimeout(600);
  await sweep(680,580,1380,560,1600);await page.locator('.faction-card[data-faction="HUMAN"]').hover();await page.waitForTimeout(600);
  await sweep(1380,560,1800,950,1400);
  await page.locator('.faction-card[data-faction="HUMAN"]').click();await page.waitForTimeout(1100);
  await sweep(1800,950,960,150,1000);
  const remain=14000-(Date.now()-start);if(remain>0)await page.waitForTimeout(remain);
  const frames=await page.evaluate(()=>window.__recordFrames);
  const deltas=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
  const frameTiming={frames:frames.length,meanFps:(frames.length-1)*1000/(frames.at(-1)-frames[0]),medianMs:deltas[Math.floor(deltas.length/2)],p95Ms:deltas[Math.floor(deltas.length*.95)]};
  await page.screenshot({path:join(out,'recording-final-frame.png')});
  await context.close();await video.saveAs(join(out,'opening-raw.webm'));
  const ffmpeg=process.env.FFMPEG_PATH??join(process.env.LOCALAPPDATA,'ms-playwright','ffmpeg-1011','ffmpeg-win64.exe');
  const rawInfo=spawnSync(ffmpeg,['-hide_banner','-i',join(out,'opening-raw.webm')],{encoding:'utf8'}).stderr;
  const d=rawInfo.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if(!d)throw new Error('Cannot read actual recording duration');
  const rawDurationSec=Number(d[1])*3600+Number(d[2])*60+Number(d[3]);
  // The first screencast frame can lag newPage; trim from actual media time, not wall-clock birth.
  const result=spawnSync(ffmpeg,['-hide_banner','-y','-ss',Math.max(0,rawDurationSec-14).toFixed(3),'-i',join(out,'opening-raw.webm'),
    '-t','14','-an','-c:v','libvpx','-b:v','2500k','-deadline','realtime','-cpu-used','8',join(out,'opening-motion-14s.webm')],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr);
  await writeFile(join(out,'recording.json'),JSON.stringify({viewport:[1920,1080],requestedClipSec:14,rawDurationSec,realBrowser:true,gpu,softwareRenderer:/swiftshader|software/i.test(gpu),testOnlyCursor:true,frameTiming,events,errors,encoder:result.stderr.slice(-1200)},null,2));
  console.log(`Real 1920x1080 browser recording: ${join(out,'opening-motion-14s.webm')}`);
} finally {await context.close();await browser.close();}
