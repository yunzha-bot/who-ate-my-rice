// Evidence processing only: hashes, accepted-layout comparison and lossless side-by-side.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sharp=(await import(process.env.SHARP_MODULE??'sharp')).default;
const out=process.env.OPENING_ARTIFACT_DIR??'docs/verification/opening-final-2026-10-22';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const chrome=await read(`${out}/chrome-final-results.json`),edge=await read(`${out}/msedge-final-results.json`);
const accepted=await read('docs/verification/opening-static/browser-results.json');
const prior=await read('docs/verification/opening-motion/final-source-hashes.json');
const baseline=await read('docs/verification/opening-motion/baseline.json');
const hashes={};
for(const [name,expected] of Object.entries({...baseline.hashes,...prior})) {
  const actual=createHash('sha256').update(await readFile(name)).digest('hex');
  hashes[name]={expected,actual,unchanged:expected===actual};
}
const runtime=['src/three/MenuAtmosphereView.ts','src/three/ThreeGame.ts','src/opening-menu.css'];
assert(runtime.every(p=>hashes[p].unchanged));
const layout=[];
for(const actual of chrome.layouts) {
  const before=accepted.layouts.find(l=>l.width===actual.width&&l.height===actual.height);
  const legacy=[before.logo,...before.cards,before.start,before.settings];
  const differences=actual.boxes.map((box,i)=>({selector:box.selector,dx:box.x-legacy[i].x,dy:box.y-legacy[i].y,dw:box.w-legacy[i].width,dh:box.h-legacy[i].height}));
  assert(differences.every(b=>b.dx===0&&b.dy===0&&b.dw===0&&b.dh===0));
  assert.deepEqual(actual.boxes,edge.layouts.find(l=>l.width===actual.width).boxes);
  layout.push({viewport:[actual.width,actual.height],differences,chromeEdgeGeometryEqual:true});
}
const reference='docs/verification/opening-static/reference.png',actual=`${out}/chrome-static-1768x890.png`;
const a=await sharp(reference).metadata(),b=await sharp(actual).metadata();assert.equal(a.width,b.width);assert.equal(a.height,b.height);
await sharp({create:{width:a.width*2,height:a.height,channels:3,background:'#eee9db'}}).composite([{input:reference,left:0,top:0},{input:actual,left:a.width,top:0}]).png().toFile(`${out}/reference-left-current-right-1768x890.png`);
await writeFile(`${out}/protection-and-layout.json`,JSON.stringify({runtimeUnchanged:true,hashes,layout,reference:{path:reference,width:a.width,height:a.height},comparison:'left reference / right current, native size, no stretch'},null,2));
console.log(JSON.stringify({runtimeUnchanged:true,assetsChecked:Object.keys(hashes).length,layouts:layout.length,changedFiles:Object.entries(hashes).filter(([,v])=>!v.unchanged).map(([p])=>p)},null,2));
