// Strict repository-subpath preview: no SPA fallback or root asset aliases.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out = resolve(process.env.PAGES_ARTIFACT_DIR ?? 'docs/verification/git-preparation-2026-10-22/pages');
await mkdir(out, {recursive:true});
const base='/who-ate-my-rice/', root=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ogg':'audio/ogg','.mp3':'audio/mpeg','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith(base)){res.writeHead(404).end();return;}
  const file=resolve(root,decodeURIComponent(path.slice(base.length))||'index.html');
  if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\')){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`, results=[];
try{
  for(const channel of ['chrome','msedge']){
    const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader']});
    try{
      const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
      await page.goto(origin+base);
      await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
      await page.screenshot({path:resolve(out,`${channel}-production-menu.png`)});
      for(const faction of ['DEEPSEEK','HUMAN']){
        await page.locator(`.faction-card[data-faction="${faction}"]`).click();await page.locator('.menu-start').click();
        await page.waitForTimeout(300);
        if(await page.locator('.controls-help-close').isVisible())await page.locator('.controls-help-close').click();
        await page.waitForTimeout(3800);
        assert(await page.locator('.faction-menu').isHidden());
        await page.screenshot({path:resolve(out,`${channel}-production-${faction}.png`)});
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
        await page.locator('.faction-menu').waitFor({state:'visible'});
      }
      const audio=await page.evaluate(async()=>{
        const urls=performance.getEntriesByType('resource').map(r=>r.name).filter(u=>/\.(ogg|mp3|wav)(\?|$)/.test(u));
        const context=new AudioContext();
        try{for(const u of urls){const response=await fetch(u);if(!response.ok)throw Error(u);await context.decodeAudioData(await response.arrayBuffer());}return urls.length;}
        finally{await context.close();}
      });
      assert(audio>0,'real production audio must load and decode');assert.deepEqual(errors,[]);
      results.push({channel,version:browser.version(),factions:['DEEPSEEK','HUMAN'],audioDecoded:audio,errors});
    }finally{await browser.close();}
  }
  assert.equal((await fetch(origin+'/assets/not-a-root-alias.js')).status,404);
  await writeFile(resolve(out,'results.json'),JSON.stringify({base,strictRoot404:true,results},null,2));
  console.log(JSON.stringify(results));
}finally{await new Promise(r=>server.close(r));}
