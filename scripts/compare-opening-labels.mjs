// Read-only checks + evidence images. Run after verify-opening-static with OPENING_ARTIFACT_DIR.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const {default:sharp}=await import(process.env.SHARP_MODULE ?? 'sharp');
const dir='docs/verification/opening-labels/';
const baseline=JSON.parse(readFileSync(dir+'before-layout.json'));
const after=JSON.parse(readFileSync(dir+'browser-results.json'));
const hashes=JSON.parse(readFileSync(dir+'protected-files.json'));
for(const [file,hash]of Object.entries(hashes))
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,`protected file changed: ${file}`);
for(const width of [1920,1768]){
  const before=baseline.find(n=>n.width===width), current=after.layouts.find(n=>n.width===width);
  const same=(a,b,name)=>{for(const key of ['x','y','width','height']) assert.ok(Math.abs(a[key]-b[key])<.1,`${name}.${key} moved`);};
  same(before.boxes.find(n=>n.selector==='menu-logo'),current.logo,'logo');
  same(before.boxes.find(n=>n.selector==='menu-start'),current.start,'start');
  same(before.boxes.find(n=>n.selector==='menu-settings'),current.settings,'settings');
  same(before.boxes.find(n=>n.selector==='menu-credits'),current.footer,'footer');
  before.boxes.filter(n=>n.selector==='faction-card').forEach((b,i)=>same(b,current.cards[i],`card${i}`));
  before.boxes.filter(n=>n.selector==='faction-portrait').forEach((b,i)=>same(b,current.portraits[i],`portrait${i}`));
}
const groups=[
  ['deepseek',{left:426,top:340,width:235,height:125}],
  ['human',{left:1010,top:340,width:185,height:130}],
  ['rice',{left:398,top:505,width:240,height:125}],
  ['guard',{left:990,top:490,width:250,height:135}],
];
for(const [name,rect]of groups){
  const images=await Promise.all(['reference.png','static-1768x890.png'].map(file=>sharp(dir+file).extract(rect)
    .resize({width:rect.width*3}).png().toBuffer()));
  await sharp({create:{width:rect.width*6,height:rect.height*3,channels:4,background:'#fff9ee'}})
    .composite([{input:images[0],left:0,top:0},{input:images[1],left:rect.width*3,top:0}])
    .png().toFile(dir+`compare-${name}.png`);
}
writeFileSync(dir+'protection-results.json',JSON.stringify({protectedFiles:Object.keys(hashes).length,
  viewports:[1920,1768],unchanged:'logo/cards/portraits/start/settings/footer',comparisons:groups.map(g=>`compare-${g[0]}.png`)},null,2));
console.log('Protected files and non-label geometry unchanged; four 3× comparison pairs saved.');
