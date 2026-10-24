// Actual UI rendering; test-only outcome injection through the existing match methods.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out=resolve(process.env.HUMAN_RESULTS_ARTIFACT_DIR ?? 'docs/verification/human-defeat-2026-10-24/browser');
await mkdir(out,{recursive:true});
const rows=[],errors=[];
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(`${channel}: ${e}`));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${channel}: ${r.status()} ${r.url()}`);});
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch(),source=await response.text();
   assert(source.includes('const game = new ThreeGame('));
   await route.fulfill({response,body:source.replace('const game = new ThreeGame(','const game = window.__resultCheck = new ThreeGame(')});
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  const cases=[['HUMAN','DEEPSEEK'],['HUMAN','HUMAN'],['HUMAN','DEEPSEEK'],['DEEPSEEK','HUMAN'],['DEEPSEEK','DEEPSEEK']];
  for(const [index,[faction,winner]] of cases.entries()){
   await page.locator(`.faction-card[data-faction="${faction}"]`).click();
   if(await page.locator('.controls-help').isVisible())await page.locator('.controls-help-close').click();
   await page.waitForFunction(()=>window.__resultCheck.match.phase==='PLAYING',null,{timeout:30000});
   // Controlled fixture, not a natural complete match or a new production API.
   await page.evaluate(w=>{const match=window.__resultCheck.match;
    if(w==='HUMAN')match.forceCapture();else match.advancePlaying(0,false,true);},winner);
   const outcome=faction===winner?'win':'lose';
   await page.waitForFunction(expected=>document.querySelector('.game-overlay').dataset.outcome===expected &&
    document.querySelector('.result-actions').hidden===false,outcome);
   const overlay=page.locator('.game-overlay'),img=overlay.locator(faction==='HUMAN'?'.portrait-human':'.portrait-deepseek');
   const file=faction==='HUMAN'?(winner==='HUMAN'?'human-report-hoodie-v1.png':'human-report-lose-v1.png'):
    (winner==='DEEPSEEK'?'deepseek-win.png':'deepseek-lose.png');
   await img.evaluate(n=>n.decode());assert(await img.isVisible());
   assert((await img.getAttribute('src')).endsWith(file));
   assert.equal(await img.evaluate(n=>getComputedStyle(n).objectFit),'contain');
   const dimensions=await img.evaluate(n=>[n.naturalWidth,n.naturalHeight]);
   if(faction==='HUMAN')assert.deepEqual(dimensions,winner==='HUMAN'?[1312,1199]:[1536,1024]);
   const artFilter=await overlay.locator('.report-art').evaluate(n=>getComputedStyle(n).filter);
   assert.equal(artFilter,outcome==='lose'?'grayscale(1)':'none');
   if(index!==2)await page.screenshot({path:resolve(out,`${channel}-${faction}-${outcome}.png`)});
   rows.push({channel,faction,winner,outcome,file,dimensions,artFilter,repeatedDefeat:index===2});
   await page.getByRole('button',{name:'返回阵营选择',exact:true}).click();
   assert(await page.locator('.faction-menu').isVisible());
  }
 }finally{await browser.close();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify({method:'Real browser UI; controlled match outcomes, not natural full-match victories',rows,errors},null,2));
assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:rows.length,errors}));
