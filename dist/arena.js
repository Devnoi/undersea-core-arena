const $ = id => document.getElementById(id);
const ctx = $('field').getContext('2d');
const colors = ['#64b9ff', '#ff7d8c'];
const bases = [[65,655],[655,65]];
const baseHalf = 63;
const dropDuration = .42;
const deliverySlots = [-39,-13,13,39].flatMap(x=>[-39,-13,13,39].map(y=>[x,y]));
const starts = [[[65,415],[303,655]],[[655,303],[418,65]]];
const tridentCenter = 360;
const tridentEnd = 98;
const beamHeight = 130;
const hangDuration = .58;
const railPaint = ['#174caa','#e33720'];
const pickupDuration = .82;
const contactTime = .28;
const hookOffsets = [24,45];
const mounts = [[301,419],[419,301]];
const keys = new Set();
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const point = ([x,y]) => ({x,y});
let robots, items, bank, elapsed, state, phase, allBots;

function reset() {
  robots = starts.flatMap((positions, team) => positions.map((pos, slot) => ({
    ...point(pos), team, slot, angle: team ? Math.PI : 0, held:null, reset:false, protectedUntil:0
  })));
  const hookedCubes = [0,1].flatMap(team => hookOffsets.map((offset, length) => {
    const delta = team ? offset : -offset;
    return [tridentCenter+delta,tridentCenter-delta,team,length===1];
  }));
  items = [[250,470],[470,250],...hookedCubes,[136,121],[123,139],[584,599],[597,581],
    [tridentCenter,tridentCenter,2]]
    .map(([x,y,hook,longHook]) => ({x,y,hook,longHook,core:hook===2,removed:false,base:null,owner:null}));
  elapsed=0; state='ready'; phase=0; bank=[0,0]; keys.clear();
  $('log').innerHTML='<li>Waiting for kickoff.</li>';
  $('ready').hidden=false; $('mode').disabled=false; syncMode(); $('pause').disabled=true;
  $('pause').textContent='Pause';
  update();
}
function syncMode() {
  allBots=$('mode').value==='bots';
  $('controls').hidden=allBots;
  $('routine').hidden=allBots;
  $('routine').labels[0].hidden=allBots;
  $('routine').disabled=allBots||state!=='ready';
}
function log(message) {
  const row=document.createElement('li');
  row.textContent=clock()+' · '+message;
  $('log').prepend(row);
  if ($('log').children.length>25) $('log').lastChild.remove();
}
function clock() {
  const left=Math.max(0,Math.ceil(150-elapsed));
  return Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
}
function total(team) {
  const hung=robots.filter(r=>r.team===team&&r.hung&&elapsed-r.hangStarted>=hangDuration).length;
  return bank[team]+items.filter(o=>o.base===team).reduce((sum,o)=>sum+(o.core?300:100),0)
    +hung*700+(hung===2?300:0);
}
function update() {
  $('time').textContent=clock();
  $('blue').textContent=String(total(0)).padStart(3,'0');
  $('red').textContent=String(total(1)).padStart(3,'0');
  $('phase').textContent={ready:'MATCH READY',paused:'PAUSED',done:'FINAL SCORE',play:['EXPLORATION','SCRAMBLE','OCCUPATION'][phase]}[state];
  [...$('phases').children].forEach((el,i)=>el.classList.toggle('active',state==='play'&&phase===i));
  const player=robots[0];
  $('hint').textContent=state==='done' ? (total(0)===total(1)?'Match tied.':total(0)>total(1)?'Blue alliance wins.':'Red alliance wins.')
    : state==='ready'?(allBots?'Four bots are ready.':'Choose an autonomous routine, then start the match.')
    : state==='paused'?'Match paused.'
    : allBots?['Bots are running their autonomous routes.','Bots are collecting cubes and the Ocean Core.','Bots are returning to their crossbeams to hang.'][phase]
    : phase===0?'Autonomous running. Driver control unlocks at 2:00.'
    : player.hung?'Blue 1 is hanging.'
    : player.out?(phase===1&&!player.reset?'Off the mat. Use your Reset Card to return.':'Blue 1 is out for this match.')
    : player.releasing?'Releasing the object.'
    : player.held?'Drive into Blue Base and use Space to release.'
    : phase===2?'Hang at the blue side of the Trident or keep scoring.':'Collect objects or push opponents off the mat.';
  drawCamera();
}
function restingHeight(o) {
  if (o.hook!==undefined && !o.removed)
    return o.core?beamHeight+12:beamHeight-(o.longHook?38:31);
  const index=items.indexOf(o);
  return o.base===null && index>=6 && index<=9 &&
    (Math.hypot(o.x-130,o.y-130)<28 || Math.hypot(o.x-590,o.y-590)<28)?(index%2?20:40):0;
}
function cargoPose(r) {
  const pickup=r.pickup;
  const distanceAhead=r.liftCargo?33:32;
  const x=r.x+Math.cos(r.angle)*distanceAhead;
  const y=r.y+Math.sin(r.angle)*distanceAhead;
  const z=r.liftCargo?46:11;
  if(!pickup) return {x,y,z};
  const progress=Math.max(0,Math.min(1,(elapsed-pickup.started-contactTime)/(pickupDuration-contactTime)));
  const lift=Math.min(1,progress*3);
  const travel=Math.max(0,(progress-.25)/.75);
  const ease=travel*travel*(3-2*travel);
  return {
    x:pickup.x+(x-pickup.x)*ease,
    y:pickup.y+(y-pickup.y)*ease,
    z:pickup.z+(z-pickup.z)*ease+(r.liftCargo?12:4)*lift*(1-ease)
  };
}
function grab(r,o) {
  if (!o || r.held || o.owner || o.base!==null || distance(r,o)>43) return;
  if (phase===0 && o.hook!==undefined && o.hook!==r.team) return;
  if (phase===0 && r.autoTarget!==o) return;
  const z=restingHeight(o);
  r.liftCargo=z>0||o.core;
  r.pickup={x:o.x,y:o.y,z,started:elapsed,angle:r.angle,
    heading:Math.atan2(o.y-r.y,o.x-r.x),phase,contact:false};
  r.held=o; o.owner=r;
}
function advancePickup(r) {
  const pickup=r.pickup;
  if(!pickup) return;
  const time=elapsed-pickup.started;
  const turn=pickup.heading-pickup.angle;
  r.angle=pickup.angle+Math.atan2(Math.sin(turn),Math.cos(turn))*Math.min(1,time/contactTime);
  if(time>=contactTime&&!pickup.contact){
    pickup.contact=true;
    const o=r.held;
    if(o.hook!==undefined&&!o.removed){
      o.removed=true;
      if(!o.core&&pickup.phase===0&&phase===0) bank[r.team]+=100;
    }
    if ((!allBots && r===robots[0]) || o.core || o.hook!==undefined)
      log(name(r)+' picked up '+(o.core?'the Ocean Core.':'a cube.'));
  }
  if(time>=pickupDuration) r.pickup=null;
}
function name(r){return (r.team?'Red ':'Blue ')+(r.slot+1);}
function itemPose(o) {
  if(o.owner) return cargoPose(o.owner);
  if(!o.drop) return {x:o.x,y:o.y,z:restingHeight(o)};
  const {z,started}=o.drop;
  const t=Math.min(1,(elapsed-started)/dropDuration);
  return {x:o.x,y:o.y,z:z*(1-t*t)};
}
function inBase(o,team) {
  const [x,y]=bases[team];
  const half=baseHalf-(o.core?16.5:9.5);
  return Math.abs(o.x-x)<=half && Math.abs(o.y-y)<=half;
}
function release(r,allowScore=true) {
  const o=r.held;
  if(!o) return;
  const pose=cargoPose(r);
  const unfinished=r.pickup&&!r.pickup.contact;
  r.held=null; o.owner=null; r.pickup=null; r.delivery=null;
  if(unfinished) return;
  if(r.out) {
    o.x=r.x+r.y<720?105:615;
    o.y=o.x;
    return;
  }
  o.x=Math.min(709,Math.max(11,pose.x));
  o.y=Math.min(709,Math.max(11,pose.y));
  o.drop={robot:r,z:pose.z,started:elapsed,allowScore};
  r.releasing=o;
}
function settleDrops(){
  for(const o of items){
    if(!o.drop||elapsed-o.drop.started<dropDuration) continue;
    const {robot,allowScore}=o.drop;
    if(allowScore&&inBase(o,robot.team)){
      o.base=robot.team;
      log(name(robot)+' delivered '+(o.core?'the Ocean Core.':'an energy cube.'));
    }
    robot.releasing=null;
    o.drop=null;
  }
}
function planDelivery(r) {
  const [bx,by]=bases[r.team];
  const distanceAhead=r.liftCargo?33:32;
  const held=r.held;
  const slots=deliverySlots.map(([x,y])=>({x:bx+x,y:by+y}));
  const occupied=items.filter(o=>o.base===r.team||o.drop&&inBase(o,r.team));
  const partner=robots.find(b=>b!==r&&b.team===r.team);
  if(partner.delivery) occupied.push(partner.delivery.slot);
  const open=slots.filter(slot=>occupied.every(o=>distance(o,slot)>=(held.core||o.core?31:23)));
  const candidates=(open.length?open:slots).flatMap(slot=>[0,1,2,3,4,5,6,7].map(i=>{
    const angle=i*Math.PI/4;
    const x=slot.x-Math.cos(angle)*distanceAhead,y=slot.y-Math.sin(angle)*distanceAhead;
    return {angle,x,y,slot,depth:Math.hypot(x-bx,y-by)};
  }));
  candidates.sort((a,b)=>a.depth-b.depth||distance(r,a)-distance(r,b));
  return candidates[0];
}
function deliver(r,dt) {
  const target=r.delivery??(r.delivery=planDelivery(r));
  if(distance(r,target)>4){
    steer(r,target,Math.min(78,Math.max(25,distance(r,target)*7)),dt);
    return;
  }
  const delta=target.angle-r.angle;
  const error=Math.atan2(Math.sin(delta),Math.cos(delta));
  if(Math.abs(error)>.08) {
    r.angle+=Math.max(-3.3*dt,Math.min(3.3*dt,error));
    return;
  }
  release(r);
}
function hang(r) {
  if (r.out || r.hung || phase===0 || distance(r,point(mounts[r.team]))>58) return;
  if (phase===1 && items.some(o=>o.hook!==undefined&&!o.removed)) {
    if(!allBots && r===robots[0]) log('Trident occupied. Hanging opens in Occupation.');
    return;
  }
  release(r,false);
  const direction=r.team?1:-1;
  const slotOffset=r.slot?22:-22;
  const [x,y]=mounts[r.team];
  r.hung=true;
  r.hangStarted=elapsed;
  r.x=x+slotOffset+direction*16;
  r.y=y+slotOffset-direction*16;
  r.angle=Math.atan2(direction,-direction);
  log(name(r)+' secured a hang.');
}
function action(key) {
  const r=robots[0];
  if (allBots||state!=='play'||phase===0||r.hung||r.pickup||r.releasing) return;
  if (key==='r' && phase===1 && r.out && !r.reset) {
    resetRobot(r);
  }
  if (r.out) return;
  if (key==='h') hang(r);
  if (key===' ') {
    if(r.held) release(r);
    else grab(r,nearest(r,available()));
  }
}
function resetRobot(r) {
  Object.assign(r,point(starts[r.team][r.slot]),{out:false,reset:true,protectedUntil:elapsed+5});
  bank[1-r.team]+=50;
  log(name(r)+' used its Reset Card.');
}
function available(){return items.filter(o=>!o.owner&&!o.drop&&o.base===null);}
function nearest(r,list){return list.reduce((best,o)=>!best||distance(r,o)<distance(r,best)?o:best,null);}
function move(r,dx,dy,speed,dt) {
  const len=Math.hypot(dx,dy);
  if(len<0.001) return;
  r.angle=Math.atan2(dy,dx);
  const x=r.x+dx/len*speed*dt, y=r.y+dy/len*speed*dt;
  if (phase===0 && (r.team===0 ? y-x<35 : x-y<35)) return;
  r.x=x; r.y=y;
}
function steer(r,target,speed,dt) {
  const desired=Math.atan2(target.y-r.y,target.x-r.x);
  const error=Math.atan2(Math.sin(desired-r.angle),Math.cos(desired-r.angle));
  const limit=3.3*dt;
  const angle=r.angle+Math.max(-limit,Math.min(limit,error));
  r.angle=angle;
  if(Math.abs(error)<1.05) move(r,Math.cos(angle),Math.sin(angle),speed*Math.cos(error),dt);
}
function bot(r,dt) {
  let target;
  if(r.held){deliver(r,dt);return;}
  if (phase===0) {
    if(r.autoTarget?.owner || r.autoTarget?.base!==null) return;
    target=r.autoTarget;
  } else if (phase===2 && (r.slot===1||elapsed>132)) {
    target=point(mounts[r.team]); hang(r);
  } else {
    const free=available();
    const core=free.find(o=>o.core);
    const partner=robots.find(bot=>bot.team===r.team&&bot.slot!==r.slot);
    const alternatives=free.filter(o=>o!==partner.target);
    target=(r.slot===0&&core)||nearest(r,alternatives.length?alternatives:free);
    r.target=target;
  }
  if (!target || r.hung) return;
  if (items.includes(target) && distance(r,target)<37) {grab(r,target);return;}
  steer(r,target,phase===0?69:89,dt);
}
function protectedRobot(r) {
  const start=point(starts[r.team][r.slot]);
  const mount=point(mounts[r.team]);
  return (r.protectedUntil>elapsed && distance(r,start)<42)
    || (phase===2 && Math.abs(r.x-mount.x)<72 && Math.abs(r.y-mount.y)<72);
}
function tick(dt) {
  elapsed=Math.min(150,elapsed+dt);
  settleDrops();
  if (phase===0 && elapsed>=30) {
    items.forEach(o=>{if(o.base!==null&&!o.core) bank[o.base]+=200;});
    phase=1; log('Exploration scored. Driver control is live.');
  }
  if (phase===1 && elapsed>=120) {phase=2; log('Occupation started. Hanging zones are protected.');}
  if (elapsed>=150) {state='done';$('pause').disabled=true;log('Match finished.');return;}
  const r=robots[0];
  if (!allBots && phase>0 && !r.hung&&!r.out&&!r.pickup&&!r.releasing) {
    const dx=Number(keys.has('d'))-Number(keys.has('a'));
    const dy=Number(keys.has('s'))-Number(keys.has('w'));
    move(r,dx,dy,137,dt);
  }
  for(const b of robots) {
    if(b.pickup) {advancePickup(b);continue;}
    if(b.releasing) continue;
    if(b===r&&!allBots&&phase!==0) continue;
    if(b.out&&phase===1&&!b.reset&&elapsed-b.fellAt>=1.5) resetRobot(b);
    if(!b.out&&!b.hung) bot(b,dt);
  }
  if (phase>0) {
    for (const a of robots) for (const b of robots) {
      if (a.team>=b.team||a.out||b.out||a.hung||b.hung) continue;
      const d=distance(a,b);
      if (d>=49) continue;
      const dx=d?(a.x-b.x)/d:1, dy=d?(a.y-b.y)/d:0;
      const push=(49-d)*.65;
      if(!protectedRobot(a)){a.x+=dx*push;a.y+=dy*push;}
      if(!protectedRobot(b)){b.x-=dx*push;b.y-=dy*push;}
    }
  }
  for (const b of robots) {
    if (!b.out && (b.x<0||b.y<0||b.x>720||b.y>720)) {
      b.out=true; b.fellAt=elapsed; release(b,false);bank[1-b.team]+=50;log(name(b)+' fell off the mat.');
    }
  }
}
function line(x,y,a,b,color,width=2) {
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function box(x,y,w,h,fill,stroke) {
  ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);}
}
function label(text,x,y,color='#b8c9d6',size=13){
  ctx.font='700 '+size+'px system-ui';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,x,y);
}
const mat = document.createElement('canvas');
mat.width=mat.height=720;
function paintMat() {
  const c=mat.getContext('2d');
  const light=c.createLinearGradient(60,0,610,720);
  light.addColorStop(0,'#494c50');
  light.addColorStop(1,'#25282c');
  c.fillStyle=light;c.fillRect(0,0,720,720);
  for(let x=3;x<720;x+=5) for(let y=3;y<720;y+=5) {
    c.fillStyle=(x+y)%3?'#ffffff09':'#00000022';
    c.fillRect(x,y,2,2);
  }
  c.lineWidth=1.5;c.strokeStyle='#17191c';
  for(let tile=1;tile<6;tile++) for(let axis=0;axis<2;axis++) {
    c.save();
    if(axis) c.transform(0,1,1,0,0,0);
    const x=tile*120;
    c.beginPath();c.moveTo(x,0);
    for(let y=0;y<720;y+=20) {
      c.lineTo(x,y+6);c.lineTo(x+3,y+8);c.lineTo(x+3,y+13);c.lineTo(x,y+15);
    }
    c.lineTo(x,720);c.stroke();c.restore();
  }
}
paintMat();
function rail(x,y,length,angle,width=12,tint='#b7bdc3'){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  box(3,4,length,width,'#10121488');
  box(0,0,length,width,tint,'#6a727a');
  line(0,1,length,1,'#eff1ef',1);
  for(let i=5;i<length-2;i+=7) box(i,width/2-1.5,3,3,'#48525b');
  ctx.restore();
}
function tapeRect(x,y,w,h,color){
  ctx.strokeStyle=color;ctx.lineWidth=6;ctx.strokeRect(x,y,w,h);
}
function drawRobot(r){
  if(r.out) return;
  ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.angle);
  box(-26,-22+(r.hung?13:5),56,49,'#0008');
  if(!allBots&&r===robots[0]){
    ctx.beginPath();ctx.arc(0,0,41,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
  }
  box(-29,-22,57,44,'#a6aab0','#e4e8ea');
  for(const y of [-25,16]){
    box(-18,y,27,9,'#bdc4c8','#51585d');
    for(let x=-16;x<9;x+=4) line(x,y+1,x,y+8,'#777c83',1);
  }
  box(-8,-16,30,32,'#e9edec','#7a8289');
  box(0,-8,15,16,'#d5e7eb');
  for(const y of [-13,11]) for(let x=-4;x<20;x+=4) box(x,y,2,3,'#182c38');
  box(26,-23,16,46,'#b7c3ca','#56656d');
  for(let x=29;x<41;x+=4) for(let y=-20;y<23;y+=4) box(x,y,1.4,1.4,'#2a3740');
  rail(-44,-13,30,0,5);
  rail(-44,8,30,0,5);
  rail(7,-17,27,0,6);
  rail(7,11,27,0,6);
  if(r.held&&r.liftCargo) {
    const cargo=cargoPose(r);
    const dx=cargo.x-r.x,dy=cargo.y-r.y;
    const x=dx*Math.cos(r.angle)+dy*Math.sin(r.angle);
    const y=dy*Math.cos(r.angle)-dx*Math.sin(r.angle);
    for(const side of [-1,1]){
      const tipY=y+side*(r.pickup&&!r.pickup.contact?14:10);
      rail(-19,side*11,Math.hypot(x+19,tipY-side*11),Math.atan2(tipY-side*11,x+19),5);
    }
  }
  box(39,-7,3,14,colors[r.team]);
  ctx.restore();
  label(r.hung?'HANG':(r.team?'R':'B')+(r.slot+1),r.x,r.y+37,'#fff',13);
}
function drawStaticField(){
  ctx.drawImage(mat,0,0);
  const tape='#f1f0e7';
  line(132,132,588,588,tape,6);
  tapeRect(0,0,132,132,tape);
  tapeRect(588,588,132,132,tape);
  label('OBJECT RETURN',65,65);label('OBJECT RETURN',654,660);
  line(65,655,250,470,tape,6);
  line(130,474,246,590,tape,6);
  line(655,65,470,250,tape,6);
  line(474,130,590,246,tape,6);
  for(let t=0;t<2;t++){
    const [x,y]=bases[t], color=colors[t], [hx,hy]=mounts[t];
    box(x-baseHalf,y-baseHalf,baseHalf*2,baseHalf*2,t?'#e3372012':'#174caa12');
    const cornerX=t?x-64:x+64, cornerY=t?y+64:y-64;
    rail(cornerX,cornerY,118,t?0:Math.PI,8,railPaint[t]);
    rail(cornerX,cornerY,118,t?-Math.PI/2:Math.PI/2,8,railPaint[t]);
    label(t?'RED BASE':'BLUE BASE',x,y+5,color,16);
    tapeRect(hx-61,hy-61,122,122,color);
    label('HANG ZONE',hx,hy+(t?-43:52),color,12);
    for (const [sx,sy] of starts[t]){
      tapeRect(sx-58,sy-58,116,116,tape);
      if(sx<100||sx>620) line(sx+(t?49:-49),sy-53,sx+(t?49:-49),sy+53,color,5);
      else line(sx-53,sy+(t?-49:49),sx+53,sy+(t?-49:49),color,5);
    }
  }
  for(const [x,y] of [[130,130],[590,590]]){
    box(x-18,y-16,40,40,'#13151988');
    box(x-17,y-17,34,34,'#a1a6a8','#d6dbda');
    box(x-12,y-12,24,24,'#65727b','#e2e2dd');
  }
  const start = tridentCenter-tridentEnd;
  const end = tridentCenter+tridentEnd;
  rail(start-6,end-6,Math.hypot(end-start,end-start),-Math.PI/4,16,'#929ba2');
  for(let t=0;t<2;t++){
    const [x,y]=mounts[t];
    rail(x-44,y-44,122,Math.PI/4,12,railPaint[t]);
  }
  box(348,348,24,24,'#a8b1b7','#dee5e8');
}
const arenaMap=document.createElement('canvas');
arenaMap.width=arenaMap.height=720;
drawStaticField();
arenaMap.getContext('2d').drawImage($('field'),0,0);

function draw(){
  ctx.drawImage(arenaMap,0,0);
  for(const r of robots) drawRobot(r);
  for(const o of items){
    const {x,y}=itemPose(o);
    const size=o.core?30:19;
    ctx.save();ctx.translate(x,y);
    if(o.core){
      rail(-9,-11,33,Math.PI/4,5,'#9aaec8');
      rail(-12,10,33,-Math.PI/4,5,'#526fa6');
    } else {
      const i=items.indexOf(o);
      const team=o.hook??(i<2?i:null);
      box(-size/2+3,-size/2+4,size,size,'#13171b99');
      box(-size/2,-size/2,size,size,'#335b9b','#213650');
      box(-size/2+1,-size/2+1,size-2,size-2,'#bac5cb','#d0d8dc');
      for(let u=-6;u<=6;u+=4) for(let v=-6;v<=6;v+=4)
        box(u-.75,v-.75,1.5,1.5,'#263744');
      if(team!==null){
        ctx.beginPath();ctx.arc(0,0,4.5,0,Math.PI*2);
        ctx.fillStyle=team?'#f2441a':'#1373f5';ctx.fill();
      }
    }
    ctx.restore();
  }
}
function start(){
  syncMode();
  const routine=allBots?'floor':$('routine').value;
  robots[0].autoTarget={floor:items[0],hook:items[2],idle:null}[routine];
  robots[1].autoTarget=items[routine==='hook'?0:3];
  robots[2].autoTarget=items[1];robots[3].autoTarget=items[5];
  $('mode').disabled=true;
  state='play';$('ready').hidden=true;$('routine').disabled=true;$('pause').disabled=false;
  $('log').replaceChildren();log('Exploration started.');update();
}
const aliases={ArrowUp:'w',ArrowLeft:'a',ArrowDown:'s',ArrowRight:'d'};
const movement='wasd'.split('');
function keyboard(e,down){
  const key=aliases[e.key]||e.key.toLowerCase();
  if (!movement.includes(key)&&![' ','h','r'].includes(key)) return;
  if (down&&(allBots||state!=='play'||$('guide').open||$('equipment').open||e.target.closest('button,select'))) return;
  e.preventDefault();
  if (!down) keys.delete(key);
  else if (movement.includes(key)) keys.add(key);
  else if(!e.repeat) action(key);
}
window.addEventListener('keydown',e=>keyboard(e,true));
window.addEventListener('keyup',e=>keyboard(e,false));
window.addEventListener('blur',()=>keys.clear());
document.querySelectorAll('[data-key]').forEach(button=>{
  const key=button.dataset.key;
  if(!movement.includes(key)) {button.onclick=()=>{action(key);button.blur();};return;}
  button.onpointerdown=e=>{button.setPointerCapture(e.pointerId);keys.add(key);};
  button.onlostpointercapture=()=>keys.delete(key);
  button.onkeydown=e=>{if(e.key===' '||e.key==='Enter') keys.add(key);};
  button.onkeyup=()=>keys.delete(key);
});
$('mode').onchange=()=>{syncMode();update();};
$('start').onclick=start;
$('restart').onclick=reset;
$('pause').onclick=()=>{
  state=state==='paused'?'play':'paused';keys.clear();
  $('pause').textContent=state==='paused'?'Resume':'Pause';$('pause').blur();update();
};
$('parts').onclick=()=>{
  if(state==='play') $('pause').click();
  $('equipment').showModal();
};
$('rules').onclick=()=>{
  if(state==='play') $('pause').click();
  $('guide').showModal();
};
reset();
let last=performance.now();
function frame(now){
  const dt=Math.min((now-last)/1000,.1);
  last=now;
  if(state==='play') {
    const speed=Number($('speed').value)||1;
    const steps=Math.ceil(speed);
    for(let step=0;step<steps&&state==='play';step++) tick(dt*speed/steps);
    update();
  }
  if(state!=='play'&&cameraMode==='orbit'&&autoOrbit) drawCamera();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
