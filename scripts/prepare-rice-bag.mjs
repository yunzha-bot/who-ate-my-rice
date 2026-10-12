// node scripts/prepare-rice-bag.mjs <Python with Pillow>
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const source='incoming-assets/rice-bag/',output='public/assets/props/rice-bag/rice-bag.glb';
const obj=new OBJLoader().parse(fs.readFileSync(source+'19bdb7546f1457a1fe515737f54bd661.obj','utf8'));
const meshes=[];obj.traverse(o=>{if(o.isMesh)meshes.push(o);});
if(meshes.length!==1)throw new Error('Expected one source mesh; inspect before processing');
let geometry=meshes[0].geometry;
const originalTriangles=geometry.attributes.position.count/3;
geometry.deleteAttribute('normal');geometry=mergeVertices(geometry,1e-6);geometry.computeVertexNormals();
geometry=await new SimplifyModifier().modify(geometry,Math.round(geometry.attributes.position.count*.76));
geometry.computeVertexNormals();geometry.computeBoundingBox();
const b=geometry.boundingBox,c=b.getCenter(b.min.clone()),size=b.getSize(b.min.clone());
geometry.translate(-c.x,-b.min.y,-c.z);geometry.scale(1/Math.max(size.x,size.z),1/Math.max(size.x,size.z),1/Math.max(size.x,size.z));
geometry.computeBoundingBox();
// OBJ使用左下纹理原点，glTF使用左上，避免米粒/袋身贴图上下颠倒。
for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setY(i,1-geometry.attributes.uv.getY(i));
const jpeg=execFileSync(process.argv[2]||'python',['-c',
 'from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert("RGB"); im.thumbnail((1024,1024),Image.Resampling.LANCZOS); im.save(sys.stdout.buffer,format="JPEG",quality=88,optimize=True)',source+'texture_pbr_20250901.png'],{maxBuffer:8*1024*1024});
const chunks=[],views=[],accessors=[];let offset=0;
function bytes(data){const raw=Buffer.from(data.buffer??data,data.byteOffset??0,data.byteLength??data.length);const padded=Buffer.alloc(Math.ceil(raw.length/4)*4);raw.copy(padded);const id=views.length;views.push({buffer:0,byteOffset:offset,byteLength:raw.length});chunks.push(padded);offset+=padded.length;return id;}
function attribute(a,type,componentType,min,max){const id=accessors.length;accessors.push({bufferView:bytes(a.array),componentType,count:a.count,type,...(min?{min,max}:{})});return id;}
const bounds=geometry.boundingBox;
const position=attribute(geometry.attributes.position,'VEC3',5126,bounds.min.toArray(),bounds.max.toArray());
const normal=attribute(geometry.attributes.normal,'VEC3',5126),uv=attribute(geometry.attributes.uv,'VEC2',5126);
const indices=attribute(geometry.index,'SCALAR',geometry.index.array instanceof Uint16Array?5123:5125);
const imageView=bytes(jpeg);
const gltf={asset:{version:'2.0',generator:'who-ate-my-rice / supplied OBJ optimization'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'RiceBag'}],
 meshes:[{primitives:[{attributes:{POSITION:position,NORMAL:normal,TEXCOORD_0:uv},indices,material:0}]}],
 materials:[{name:'RiceBagCloth',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.9}}],
 images:[{bufferView:imageView,mimeType:'image/jpeg'}],textures:[{source:0,sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
 buffers:[{byteLength:offset}],bufferViews:views,accessors};
const jsonRaw=Buffer.from(JSON.stringify(gltf)),json=Buffer.alloc(Math.ceil(jsonRaw.length/4)*4,32);jsonRaw.copy(json);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+offset,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(offset,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.mkdirSync('public/assets/props/rice-bag',{recursive:true});fs.writeFileSync(output,Buffer.concat([header,json,binHeader,...chunks]));
console.log(JSON.stringify({output,originalTriangles,triangles:geometry.index.count/3,vertices:geometry.attributes.position.count,bytes:fs.statSync(output).size,texture:'1024 JPEG',bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}},null,2));
