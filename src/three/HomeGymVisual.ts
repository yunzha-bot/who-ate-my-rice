import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

/** 家用器械使用原家具合批/编辑器代理；瑜伽垫是随长凳移动的无碰撞薄层。 */
export function dressHomeGym(rect: Rect,
  emit: (g: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const {id, width:w, depth:d, height:h}=rect;
  const dark=0x65716d, trim=0xc8c9bb, cream=0xeee8d9, green=0x99afa2, oak=0xbca585;
  const box=(a:number,b:number,c:number,color:number,x:number,y:number,z=0)=>emit(new THREE.BoxGeometry(a,b,c),color,x,y,z);
  const round=(r:number,height:number,color:number,x:number,y:number,z=0)=>emit(new THREE.CylinderGeometry(r,r,height,12),color,x,y,z);
  const rod=(a:THREE.Vector3,b:THREE.Vector3,r:number,color:number)=>{
    const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    const c=a.clone().add(b).multiplyScalar(.5);emit(g,color,c.x,c.y,c.z);
  };
  if(id==='gym_treadmill'){
    box(w,.13,d,trim,0,.12);box(w*.74,.025,d*.86,0x505d58,0,.2);
    for(const x of [-w*.45,w*.45]){
      box(.07,.07,d*.9,dark,x,.21);
      rod(new THREE.Vector3(x,.2,-d*.38),new THREE.Vector3(x,h*.85,-d*.34),.028,dark);
      rod(new THREE.Vector3(x,h*.8,-d*.34),new THREE.Vector3(x,h*.8,d*.08),.025,dark);
    }
    for(const z of [-d*.4,d*.4])box(w*.74,.016,.025,trim,0,.222,z);
    box(w*.82,.13,.25,dark,0,h*.9,-d*.34);
    box(w*.44,.015,.16,0xa9c5bd,0,h*.967,-d*.34);
    round(.027,.016,0xc4aa8a,w*.29,h*.967,-d*.34);
    for(const x of [-w*.36,w*.36])box(.12,.06,.18,dark,x,.03,d*.35);
  }else if(id==='gym_bike'){
    for(const z of [-d*.34,d*.34])box(w*.85,.07,.09,dark,0,.05,z);
    const a=new THREE.Vector3(0,.16,d*.27),b=new THREE.Vector3(0,.6,-d*.2),c=new THREE.Vector3(0,.4,d*.12);
    rod(a,b,.04,green);rod(b,c,.04,green);rod(c,a,.04,green);
    rod(c,new THREE.Vector3(0,.88,d*.17),.025,dark);
    box(w*.35,.08,d*.2,dark,0,.91,d*.17);
    emit(new THREE.CylinderGeometry(.25,.25,.12,16).rotateZ(Math.PI/2),trim,0,.32,-d*.25);
    emit(new THREE.TorusGeometry(.2,.025,5,16).rotateY(Math.PI/2),dark,-.075,.32,-d*.25);
    rod(b,new THREE.Vector3(0,1.01,-d*.31),.028,dark);
    box(w*.7,.045,.04,dark,0,1.03,-d*.31);
    box(.16,.1,.08,trim,0,1.01,-d*.36);
    rod(new THREE.Vector3(-.19,.4,d*.12),new THREE.Vector3(.19,.4,d*.12),.025,dark);
    for(const side of [-1,1]){
      rod(new THREE.Vector3(side*.19,.4,d*.12),new THREE.Vector3(side*.19,.4+side*.12,d*.12),.018,dark);
      box(.12,.04,.14,dark,side*.25,.4+side*.12,d*.12);
    }
  }else if(id==='gym_dumbbell_rack'){
    for(const x of [-w*.43,w*.43]){
      box(.06,h*.9,.06,dark,x,h*.45,-d*.2);
      box(.12,.04,d*.9,dark,x,.03);
    }
    for(const y of [h*.35,h*.78]){
      box(w,.035,d*.75,oak,0,y);
      for(let i=0;i<3;i++){
        const x=(i-1)*w*.29,r=.065+i*.012;
        rod(new THREE.Vector3(x-.13,y+.1,0),new THREE.Vector3(x+.13,y+.1,0),.018,trim);
        for(const side of [-1,1])emit(new THREE.CylinderGeometry(r,r,.07,8).rotateZ(Math.PI/2),dark,x+side*.11,y+.1,0);
      }
    }
  }else if(id==='gym_bench'){
    for(const z of [-d*.35,d*.35]){
      box(w*.9,.045,.12,dark,0,.025,z);box(.07,h*.8,.07,trim,0,h*.4,z);
    }
    box(w*.92,.08,d*.96,dark,0,h-.065);
    box(w*.96,.025,d*.9,green,0,h-.0125);
    // 不产生足印/导航障碍，保留中间轻运动区可穿行。
    for(const [x,z,color] of [[-1.7,0,0xa6bfb3],[-.7,-2,0xb6c9ca]]){
      box(.72,.009,1.65,color,x,.01,z);
      for(const side of [-1,1])box(.64,.003,.015,cream,x,.016,z+side*.73);
    }
  }else if(id==='gym_mirror'){
    box(w,.05,d*.9,dark,0,.025);
    box(.055,h*.92,d*.94,oak,w*.2,h*.53);
    box(.012,h*.83,d*.84,0xb5cdca,w*.2-.035,h*.53);
    box(.014,.015,d*.72,cream,w*.2-.045,h*.9);
  }else if(id==='gym_towel_stand'){
    for(const z of [-d*.38,d*.38]){
      box(w*.9,.04,.08,oak,0,.02,z);round(.018,h*.95,dark,0,h*.475,z);
    }
    box(.025,.025,d*.8,dark,0,h*.94);
    box(.02,h*.42,d*.55,cream,.02,h*.7);
    box(.025,.05,d*.55,green,.034,h*.55);
    box(w*.7,.04,d*.7,oak,0,.19);
    round(.06,.2,green,0,.31);
  }else{
    box(w*.8,h*.66,d*.8,cream,0,h*.35);
    box(w*.83,.04,d*.83,oak,0,h*.7);
    box(w*.5,.13,.02,dark,0,h*.5,d*.41);
    for(const x of [-.055,.055])box(.025,.025,.06,greyTap(x),x,h*.55,d*.4);
    round(w*.28,h*.22,0xaac6c6,0,h*.84);
    round(w*.15,.035,cream,0,h*.965);
    box(w*.8,.04,d*.8,dark,0,.02);
  }
}
function greyTap(x:number):number{return x<0?0x96afba:0xb7a28b;}
