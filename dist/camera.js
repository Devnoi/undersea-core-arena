let cameraMode = 'top';
let orbitAngle = Math.PI * .64;
let orbitLift = 760;
let autoOrbit = true;
let orbitDrag = null;
let orbitTick = 0;

const add = (a,b) => a.map((v,i)=>v+b[i]);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
const unit = v => v.map(n=>n/Math.hypot(...v));
const cross = ([x,y,z],[a,b,c]) => [y*c-z*b,z*a-x*c,x*b-y*a];

function view(eye,target,focal){
  const forward=unit(sub(target,eye));
  const right=unit(cross([0,0,1],forward));
  const up=cross(forward,right);
  return {eye,forward,right,up,focal};
}

function scene(camera,{context=ctx,fieldItems=items,showRobots=true}={}){
  const ctx=context;
  const faces=[];
  function face(vertices,color,edge,decals){
    const points=vertices.map(vertex=>{
      const v=sub(vertex,camera.eye);
      return [dot(v,camera.right),dot(v,camera.up),dot(v,camera.forward)];
    });
    const clipped=[];
    for(let i=0;i<points.length;i++){
      const a=points[i], b=points[(i+1)%points.length];
      if(a[2]>=8) clipped.push(a);
      if((a[2]>=8)!==(b[2]>=8)){
        const t=(8-a[2])/(b[2]-a[2]);
        clipped.push(a.map((v,j)=>v+(b[j]-v)*t));
      }
    }
    if(clipped.length<3) return;
    const depth=points.reduce((sum,p)=>sum+p[2],0)/points.length;
    faces.push({clipped,depth,color,edge,decals:points.every(p=>p[2]>=8)?decals:undefined});
  }
  function prism(x,y,z,length,width,height,angle,colors,finish){
    const c=Math.cos(angle),s=Math.sin(angle);
    const base=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>
      [x+u*length/2*c-v*width/2*s,y+u*length/2*s+v*width/2*c,z]);
    const top=base.map(p=>add(p,[0,0,height]));
    const sides=[0,1,2,3];
    for(const i of sides){
      const j=(i+1)%4;
      const normal=cross(sub(base[j],base[i]),[0,0,1]);
      if(dot(normal,sub(camera.eye,base[i]))>0)
        face([base[i],base[j],top[j],top[i]],colors[1+i%2],colors[3],finish?.(i%2?width:length,height));
    }
    if(camera.eye[2]>z+height) face(top,colors[0],colors[3],finish?.(length,width));
    else if(camera.eye[2]<z) face(base,colors[2],colors[3]);
  }
  function strip(x,y,a,b,z,width,colors,height=0,finish){
    prism((x+a)/2,(y+b)/2,z,Math.hypot(a-x,b-y),width,height,Math.atan2(b-y,a-x),colors,finish);
  }
  function railFinish(width,height){
    if(width<16||height>10) return perforated(width,height);
    const count=Math.max(1,Math.round(width/42));
    return Array.from({length:count},(_,i)=>({u:(i+.5)/count,v:.53,rx:Math.min(.44/count,18/width),ry:.31,label:'MARC',color:'#f5f7fc'}));
  }
  function panelRail(x,y,a,b,z,width,paint,depth){
    strip(x,y,a,b,z,width,[paint,paint,paint,'#38434b'],depth,railFinish);
    strip(x,y,a,b,z+depth,width,steel,2,perforated);
  }
  const steel=['#cbd2d6','#85939b','#5e6b73','#394a54'];
  const dark=['#67747c','#454e56','#333c43','#26333c'];
  const light=['#e4e4da','#a9a99f','#888a82'];
  const teamPaint=[['#69bbff','#397cb2','#235477','#20445e'],['#ff8596','#c24f64','#95354a','#682939']];
  const tileColors=['#363d41','#3b4246','#383f44'];
  for(let i=0;i<12;i++) for(let j=0;j<12;j++){
    const x=i*60,y=j*60;
    face([[x,y,0],[x+60,y,0],[x+60,y+60,0],[x,y+60,0]],tileColors[(Math.floor(i/2)+Math.floor(j/2)*2)%3],(i%2||j%2)?undefined:'#282f34');
  }
  const matSides=[
    [[0,0,0],[720,0,0],[720,0,-11],[0,0,-11]],
    [[720,0,0],[720,720,0],[720,720,-11],[720,0,-11]],
    [[720,720,0],[0,720,0],[0,720,-11],[720,720,-11]],
    [[0,720,0],[0,0,0],[0,0,-11],[0,720,-11]]
  ];
  matSides.forEach(vertices=>face(vertices,'#1b2226','#10161a'));
  const ground=faces.splice(0);
  // Draw floor markings as segments so they sort with the floor instead of distant props.
  function tape(x,y,a,b,paint=light,width=6){
    const count=Math.max(1,Math.ceil(Math.hypot(x-a,y-b)/24));
    for(let i=0;i<count;i++){
      const t=i/count,u=(i+1)/count;
      const px=x+(a-x)*t,py=y+(b-y)*t,qx=x+(a-x)*u,qy=y+(b-y)*u;
      floors.push(()=>strip(px,py,qx,qy,1,width,paint));
    }
  }
  const floors=[];
  function square(x,y,size,paint){
    tape(x,y,x+size,y,paint);tape(x+size,y,x+size,y+size,paint);
    tape(x+size,y+size,x,y+size,paint);tape(x,y+size,x,y,paint);
  }
  tape(132,132,588,588);
  square(1,1,131,light);square(588,588,131,light);
  tape(129,591,250,470);tape(130,474,246,590);
  tape(591,129,470,250);tape(474,130,590,246);
  for(let t=0;t<2;t++){
    const paint=teamPaint[t];
    const [x,y]=bases[t], [hx,hy]=mounts[t];
    const bx=x+(t?-64:64), by=y+(t?64:-64);
    panelRail(bx,by,bx+(t?118:-118),by,22,7,railPaint[t],9);
    panelRail(bx,by,bx,by+(t?-118:118),22,7,railPaint[t],9);
    for(const [dx,dy,angle] of [[0,0,0],[t?109:-109,0,0],[0,t?-109:109,Math.PI/2],[t?53:-53,0,0],[0,t?-53:53,Math.PI/2]]){
      prism(bx+dx,by+dy,0,10,7,2,angle,steel,perforated);
      prism(bx+dx,by+dy,2,7,3,22,angle,steel,perforated);
    }
    prism(bx,by,22,8,8,10,0,['#275498','#224176','#172b57'],perforated);
    square(hx-61,hy-61,122,paint);
    for(const [sx,sy] of starts[t]){
      square(sx-58,sy-58,116,light);
      if(sx<100||sx>620) tape(sx+(t?49:-49),sy-53,sx+(t?49:-49),sy+53,paint,5);
      else tape(sx-53,sy+(t?-49:49),sx+53,sy+(t?-49:49),paint,5);
    }
  }
  for(const [x,y] of [[130,130],[590,590]]){
    prism(x,y,0,30,30,6,0,dark);
    prism(x,y,6,11,11,31,0,steel);
    prism(x-10,y+9,16,23,23,4,0,steel);
    prism(x+8,y-8,35,22,22,5,0,steel);
  }
  prism(360,360,0,44,37,3,-Math.PI/4,steel,perforated);
  prism(360,360,3,36,22,5,-Math.PI/4,steel,perforated);
  for(const offset of [-11,11])
    prism(360+offset,360-offset,8,9,9,beamHeight-8,-Math.PI/4,steel,perforated);
  for(const height of [12,62,118])
    strip(344,376,376,344,height,6,steel,7,perforated);
  const start = tridentCenter-tridentEnd;
  const end = tridentCenter+tridentEnd;
  panelRail(start,end,end,start,beamHeight-2,15,'#1a2025',8);
  strip(start+5,end+5,end+5,start+5,beamHeight+7,5,steel,2,perforated);
  strip(start-5,end-5,end-5,start-5,beamHeight+7,5,steel,2,perforated);
  for(let t=0;t<2;t++){
    const [x,y]=mounts[t];
    strip(x-51,y-51,x+51,y+51,beamHeight-7,13,steel,7,perforated);
    panelRail(x-51,y-51,x+51,y+51,beamHeight,10,railPaint[t],7);
    prism(x,y,beamHeight-1,22,22,3,Math.PI/4,steel,perforated);
  }
  prism(360,360,beamHeight,42,35,12,Math.PI/4,steel);
  const aluminum=['#e3eaed','#a1aeb6','#77848d','#55626a'];
  const blueMetal=['#426cc7','#2d4f9b','#1c3575','#152c61'];
  const whitePolymer=['#fafafa','#d4dde2','#a2adb8','#89959f'];
  const tire=['#aeb8c2','#747e86','#57636a','#41494f'];
  const motor=['#245fcb','#194ba7','#133c8e','#132e61'];
  const markerColors=['#1373f5','#f2441a'];
  function holePattern(width,height,marker){
    const spots=[];
    const columns=Math.max(1,Math.floor(width/4.7));
    const rows=Math.max(1,Math.floor(height/4.7));
    if(width<4||height<4) return spots;
    for(let col=0;col<columns;col++) for(let row=0;row<rows;row++){
      const u=(col+.5)/columns,v=(row+.5)/rows;
      if(marker&&Math.hypot(u-.5,v-.5)<.34) continue;
      spots.push({u,v,rx:1.07/width,ry:1.07/height,color:'#293740'});
    }
    if(marker&&Math.abs(width-height)<2) spots.push({u:.5,v:.5,rx:.26,ry:.26,color:marker});
    return spots;
  }
  function perforated(width,height){return holePattern(width,height);}
  function wheel(local,x,y,z){
    const radius=16,half=4.5,count=16;
    const ring=side=>Array.from({length:count},(_,i)=>{
      const angle=i/count*Math.PI*2;
      return local(x+Math.cos(angle)*radius,y+side*half,z+Math.sin(angle)*radius);
    });
    const left=ring(-1),right=ring(1);
    for(let i=0;i<count;i++){
      const j=(i+1)%count;
      face([left[i],left[j],right[j],right[i]],i%2?'#78838c':'#aab3bc','#4b535a');
    }
    for(const direction of [-1,1]){
      const center=local(x,y+direction*half,z);
      const outward=sub(local(x,y+direction*(half+1),z),center);
      if(dot(outward,sub(camera.eye,center))<=0) continue;
      const disk=(r,offset,color)=>{
        const vertices=Array.from({length:count},(_,i)=>{
          const angle=i/count*Math.PI*2;
          return local(x+Math.cos(angle)*r,y+direction*(half+offset),z+Math.sin(angle)*r);
        });
        face(vertices,color,'#43566a');
      };
      disk(radius,0,'#e1e5e6');disk(12,.1,'#254da7');
      disk(9,.2,'#1b2b48');
      for(let i=0;i<6;i++){
        const angle=i*Math.PI/3;
        const v=(r,a)=>local(x+Math.cos(a)*r,y+direction*(half+.24),z+Math.sin(a)*r);
        face([v(2,angle-.26),v(10,angle-.13),v(10,angle+.13),v(2,angle+.26)],'#4b7ad0');
      }
      disk(3.7,.3,'#6e9ae3');
    }
  }
  function panel(corners,color,width,height){
    face(corners,color,'#62717b',perforated(width,height));
  }
  const spectator=robots[Number(document.getElementById('follow').value)];
  for(const r of showRobots?robots:[]){
    if(r.out||(cameraMode==='person'&&r===spectator)) continue;
    const lift=r.hung?Math.min(1,(elapsed-r.hangStarted)/hangDuration):0;
    const z=41*lift;
    const c=Math.cos(r.angle),s=Math.sin(r.angle);
    const local=(x,y,h)=>[r.x+x*c-y*s,r.y+x*s+y*c,z+h];
    const activeCargo=r.held||r.releasing;
    const cargo=activeCargo&&r.liftCargo?itemPose(activeCargo):null;
    const letGo=r.releasing?Math.min(1,(elapsed-r.releasing.drop.started)/.2):0;
    const reachProgress=r.pickup?Math.min(1,(elapsed-r.pickup.started)/contactTime):1;
    const dx=cargo?cargo.x-r.x:0,dy=cargo?cargo.y-r.y:0;
    const cargoX=dx*c+dy*s,cargoY=dy*c-dx*s;
    const part=(x,y,h,l,w,height,material,rotation=0,finish)=>{
      const [px,py,pz]=local(x,y,h);
      prism(px,py,pz,l,w,height,r.angle+rotation,material,finish);
    };
    part(-5,0,9,49,48,3,aluminum,0,perforated);
    part(-27,0,11,4,60,14,aluminum,0,perforated);
    part(11,0,11,34,39,2,blueMetal);
    part(7,0,13,30,37,10,whitePolymer);
    part(8,0,23,20,19,1,['#f8fbfc','#d7e0e3','#818e9c']);
    part(3,0,24,8,10,1,['#83bfc9','#58858f','#4c757e']);
    for(const side of [-1,1]){
      part(-5,side*20,11,23,7,10,motor);
      wheel(local,-6,side*28,16);
      for(let socket=0;socket<6;socket++)
        part(socket*3.8-4,side*14,24,2.4,4.2,1.4,dark);
      part(-22,side*9,15,7,7,41,aluminum,0,perforated);
      const idleX=r.hung?Math.hypot(16,16):-48, idleZ=r.hung?beamHeight+6-z:84;
      const jawWidth=activeCargo?.core?14:10;
      const open=r.pickup&&!r.pickup.contact?Math.min(1,(1-reachProgress)*3):letGo;
      const tipX=cargo?idleX+(cargoX-2-idleX)*reachProgress:idleX;
      const tipY=cargo?side*11+(cargoY+side*(jawWidth+5*open)-side*11)*reachProgress:side*11;
      const tipZ=cargo?idleZ+(cargo.z+9-idleZ)*reachProgress:idleZ;
      const arm=(u,v,height)=>local(-19+(tipX+19)*u,side*11+(tipY-side*11)*u+v,height);
      const railLength=Math.hypot(tipX+19,tipY-side*11,tipZ-42);
      panel([arm(0,-3,42),arm(1,-3,tipZ),arm(1,3,tipZ),arm(0,3,42)],'#c8d1d7',railLength,6);
      panel([arm(0,0,39),arm(1,0,tipZ-3),arm(1,0,tipZ+4),arm(0,0,46)],'#99a5ad',railLength,7);
      part(tipX+2,tipY,tipZ-4,cargo?18:11,cargo?3.5:9,cargo?8:4,aluminum,0,perforated);
      if(r.hung) part(tipX+7,tipY,tipZ-4,3.5,6,9,aluminum,0,perforated);

    }
    part(-22,0,29,13,12,20,motor);
    part(-19,0,47,8,29,4,aluminum,0,perforated);
    const scoop=[local(42,-24,2),local(42,24,2),local(27,24,16),local(27,-24,16)];
    panel(scoop,'#becad0',48,21);
    for(const side of [-1,1])
      face([local(42,side*24,2),local(27,side*24,16),local(27,side*24,3)],'#85949e','#4f626c');
    part(41,0,2,3,49,2,teamPaint[r.team]);
  }
  for(const [index,o] of fieldItems.entries()){
    const r=o.owner;
    const {x,y,z}=itemPose(o,index);
    const onTrident=o.hook!==undefined&&!o.removed;
    if(o.core){
      for(const angle of [Math.PI/4,-Math.PI/4]){
        prism(x,y,z,33,3.5,16,angle,aluminum,perforated);
        prism(x,y,z+4,31,7,3,angle,blueMetal,perforated);
        prism(x,y,z+10,30,6,2,angle,blueMetal,perforated);
      }
      continue;
    }
    const color=markerColors[o.hook??(index<2?index:-1)];
    prism(x,y,z,19,19,19,0,aluminum,(w,h)=>holePattern(w,h,color));
    for(const delta of [-8.7,8.7]) for(const side of [-8.7,8.7])
      prism(x+delta,y+side,z+1,.9,.9,17,0,blueMetal);
    if(o.hook!==undefined){
      const hookHeight=o.longHook?21:14;
      const angle=onTrident||!r?0:r.angle;
      prism(x,y,z+19,3.5,8,hookHeight,angle,aluminum,perforated);
      prism(x+2*Math.cos(angle),y+2*Math.sin(angle),z+18+hookHeight,8,8,2,angle,aluminum,perforated);
    }
  }
  const sky=ctx.createLinearGradient(0,0,0,720);
  sky.addColorStop(0,'#182c3a');sky.addColorStop(1,'#07141d');
  ctx.fillStyle=sky;
  ctx.fillRect(0,0,720,720);
  const project=([x,y,z])=>[360+x/z*camera.focal,360-y/z*camera.focal];
  function paint(face){
    ctx.beginPath();
    face.clipped.forEach((point,i)=>{
      const [px,py]=project(point);
      if(i) ctx.lineTo(px,py);else ctx.moveTo(px,py);
    });
    ctx.closePath();
    ctx.fillStyle=face.color;ctx.fill();
    if(face.edge){ctx.lineWidth=.65;ctx.strokeStyle=face.edge;ctx.stroke();}
    if(!face.decals?.length||face.clipped.length!==4) return;
    const [a,b,c,d]=face.clipped;
    const mapped=(u,v)=>project(a.map((n,i)=>(1-v)*((1-u)*n+u*b[i])+v*((1-u)*d[i]+u*c[i])));
    for(const {u,v,rx,ry,color,label} of face.decals){
      const center=mapped(u,v);
      const edgeX=mapped(u+rx,v), edgeY=mapped(u,v+ry);
      if(label){
        let [a,b]=sub(edgeX,center);
        let [c,d]=sub(edgeY,center);
        if(Math.hypot(c,d)<1.2) continue;
        if(a<0){a=-a;b=-b;}
        if(d<0){c=-c;d=-d;}
        ctx.save();
        ctx.transform(a/16,b/16,c/5,d/5,...center);
        ctx.font='italic 800 10px system-ui';
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;
        ctx.fillText(label,0,0,32);
        ctx.restore();
        continue;
      }
      if(Math.max(Math.hypot(...sub(edgeX,center)),Math.hypot(...sub(edgeY,center)))<.38) continue;
      ctx.beginPath();
      for(let i=0;i<10;i++){
        const angle=i*Math.PI/5;
        const p=mapped(u+rx*Math.cos(angle),v+ry*Math.sin(angle));
        if(i) ctx.lineTo(...p);else ctx.moveTo(...p);
      }
      ctx.closePath();
      ctx.fillStyle=color;ctx.fill();
    }
  }
  const order=(a,b)=>b.depth-a.depth;
  ground.sort(order).forEach(paint);
  const props=faces.splice(0);
  floors.forEach(draw=>draw());
  faces.sort(order).forEach(paint);
  props.sort(order).forEach(paint);
}
function drawCamera(){
  if(cameraMode==='top'){draw();return;}
  const status=document.getElementById('camera-status');
  let camera;
  if(cameraMode==='person'){
    const r=robots[Number(document.getElementById('follow').value)];
    const heading=[Math.cos(r.angle),Math.sin(r.angle),0];
    const eye=[r.x,r.y,r.hung?116:54];
    const position=add(eye,heading.map(v=>v*13));
    const target=add(position,[heading[0]*220,heading[1]*220,-21]);
    camera=view(position,target,410);
    const message=r.out?'Robot is off the mat':r.hung?'Robot is hanging':'Live robot camera';
    if(status.textContent!==message) status.textContent=message;
  } else {
    if(cameraMode==='orbit'){
      const now=performance.now();
      if(autoOrbit&&!orbitDrag&&orbitTick) orbitAngle+=Math.min(50,now-orbitTick)*.00037;
      orbitTick=now;
      camera=view([360+Math.cos(orbitAngle)*1070,360+Math.sin(orbitAngle)*1070,orbitLift],[360,360,34],1020);
    } else camera=view([1065,1175,990],[360,360,37],1080);
  }
  scene(camera);
}
document.addEventListener('DOMContentLoaded',()=>{
  const canvas=document.getElementById('field');
  const buttons=[...document.querySelectorAll('[data-camera]')];
  const follow=document.getElementById('follow');
  const orbit=document.getElementById('orbit-controls');
  const auto=document.getElementById('auto-orbit');
  const status=document.getElementById('camera-status');
  function select(mode){
    cameraMode=mode;orbitTick=0;
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===mode)));
    document.getElementById('camera-options').hidden=mode==='top';
    document.getElementById('follow-label').hidden=follow.hidden=mode!=='person';
    orbit.hidden=mode!=='orbit';
    canvas.classList.toggle('orbit',mode==='orbit');
    canvas.parentElement.classList.toggle('perspective',mode!=='top');
    canvas.setAttribute('aria-label',({top:'Top-down competition arena',person:'Robot first-person camera',orbit:'360-degree orbit camera', '3d':'3D arena overview'})[mode]);
    status.textContent=mode==='orbit'?'Drag the arena to orbit and tilt.':mode==='3d'?'Fixed elevated camera':'';
    drawCamera();
  }
  function rotation(enabled){
    autoOrbit=enabled;
    orbitTick=0;
    auto.setAttribute('aria-pressed',String(enabled));
    drawCamera();
  }
  buttons.forEach(button=>button.onclick=e=>{
    select(button.dataset.camera);
    if(e.detail>0) button.blur();
  });
  follow.onchange=drawCamera;
  auto.onclick=()=>rotation(!autoOrbit);
  document.getElementById('rotate-left').onclick=()=>{orbitAngle-=Math.PI/8;rotation(false);};
  document.getElementById('rotate-right').onclick=()=>{orbitAngle+=Math.PI/8;rotation(false);};
  canvas.addEventListener('pointerdown',e=>{
    if(cameraMode!=='orbit') return;
    orbitDrag=[e.clientX,e.clientY];
    canvas.setPointerCapture(e.pointerId);
    rotation(false);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!orbitDrag) return;
    orbitAngle-=(e.clientX-orbitDrag[0])*.012;
    orbitLift=Math.max(300,Math.min(1200,orbitLift+(e.clientY-orbitDrag[1])*4));
    orbitDrag=[e.clientX,e.clientY];
    drawCamera();
  });
  canvas.addEventListener('lostpointercapture',()=>{orbitDrag=null;});
});
