const stage = $('stage');
const stageMap = $('stage-map');
const stageCtx = stageMap.getContext('2d');
const compactStage = window.matchMedia('(max-width: 540px)');
const stageAreas = [
  {name:'Object Return Zones', side:0, y:73, points:[[65,66],[654,654]], detail:'Referees return loose scoring objects that leave the mat to the nearest return-zone boundary.'},
  {name:'Ancient Ruin Pillars', side:0, y:169, points:[[130,130],[590,590]], detail:'Two Energy Cubes start on each of the two-tiered pillars.'},
  {name:'White Center Line', side:0, y:267, points:[[228,228]], detail:'The diagonal between the two return zones. Robots must keep clear of it during Exploration.'},
  {name:'Blue Starting Zones', side:0, y:423, points:starts[0], color:colors[0], detail:'Blue robots start fully within these two taped squares.'},
  {name:'Blue Hanging Forbidden Zone', side:0, y:513, points:[mounts[0]], color:colors[0], detail:'During Occupation, opponents must avoid contact with a Blue robot touching this marked zone.'},
  {name:'Blue Alliance Base', side:0, y:665, points:[bases[0]], color:colors[0], detail:'Blue scores by releasing Energy Cubes and the Ocean Core onto the floor inside this base.'},
  {name:'Red Alliance Base', side:1, y:73, points:[bases[1]], color:colors[1], detail:'Red scores by releasing Energy Cubes and the Ocean Core onto the floor inside this base.'},
  {name:'Red Starting Zones', side:1, y:168, defaultPoint:1, points:starts[1], color:colors[1], detail:'Red robots start fully within these two taped squares.'},
  {name:'Red Hanging Forbidden Zone', side:1, y:284, points:[mounts[1]], color:colors[1], detail:'During Occupation, opponents must avoid contact with a Red robot touching this marked zone.'},
  {name:'Poseidon’s Trident', side:1, y:388, points:[[tridentCenter,tridentCenter]], detail:'The Ocean Core starts on top, and hooked Energy Cubes hang under the long beam. Each alliance hangs its robots on its colored crossbar.'},
  {name:'Tracking Lines', side:1, y:484, points:[[534,184],[189,535]], detail:'White cross-shaped tape guides autonomous runs from the starting zones toward each base.'}
];
let activeArea=null;

function paintStage(){
  const compact=compactStage.matches;
  const width=compact?720:1120;
  const offset=compact?0:200;
  stageMap.width=width;
  stageMap.height=compact?720:756;
  stageCtx.fillStyle='#0a1620';
  stageCtx.fillRect(0,0,width,stageMap.height);
  const top=compact?0:18;
  stageCtx.drawImage(arenaMap,offset,top);
  const displayed=activeArea?[activeArea]:compact?[stageAreas[9]]:stageAreas;
  for(const area of displayed){
    const accent=area.color||'#baf4ed';
    const points=activeArea?area.points:[area.points[area.defaultPoint??0]];
    const right=area.side===1;
    const x=compact?(right?420:14):(right?925:6);
    const boxWidth=compact?286:189;
    const y=compact?Math.max(36,Math.min(682,points[0][1]+60)):area.y;
    const edge=right?x:x+boxWidth;
    stageCtx.strokeStyle=accent;
    stageCtx.lineWidth=activeArea?3:1.5;
    for(const [px,py] of points){
      const ax=px+offset,ay=py+top;
      stageCtx.beginPath();
      stageCtx.moveTo(compact?x+boxWidth/2:edge,y);
      if(!compact) stageCtx.lineTo(edge+(right?-19:19),y);
      stageCtx.lineTo(ax,ay);
      stageCtx.stroke();
      stageCtx.beginPath();stageCtx.arc(ax,ay,activeArea?6:4,0,Math.PI*2);
      stageCtx.fillStyle=accent;stageCtx.fill();
    }
    stageCtx.fillStyle='#122632';
    stageCtx.fillRect(x,y-20,boxWidth,40);
    stageCtx.strokeRect(x,y-20,boxWidth,40);
    stageCtx.textAlign='center';
    stageCtx.textBaseline='middle';
    stageCtx.font=compact?'700 22px system-ui':'700 17px system-ui';
    stageCtx.fillStyle=accent;
    const words=area.name.split(' ');
    const lines=[''];
    for(const word of words){
      const i=lines.length-1;
      const candidate=lines[i]?lines[i]+' '+word:word;
      if(lines[i]&&stageCtx.measureText(candidate).width>boxWidth-12) lines.push(word);
      else lines[i]=candidate;
    }
    lines.forEach((line,i)=>stageCtx.fillText(line,x+boxWidth/2,y+(i-(lines.length-1)/2)*17,boxWidth-10));
  }
}
for(const area of stageAreas){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=area.name;
  button.setAttribute('aria-pressed','false');
  button.onclick=()=>{
    activeArea=activeArea===area?null:area;
    for(const child of $('stage-areas').children)
      child.setAttribute('aria-pressed',String(child===button&&activeArea!==null));
    $('stage-description').textContent=activeArea?.detail||'Select an area to see where it is and what it does.';
    paintStage();
  };
  $('stage-areas').append(button);
}
$('introduce').onclick=()=>{
  if(state==='play') $('pause').click();
  paintStage();
  stage.showModal();
};
compactStage.addEventListener('change',()=>{if(stage.open) paintStage();});
