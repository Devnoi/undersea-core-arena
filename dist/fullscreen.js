const matchFullscreen={target:$('match-layout'),button:$('match-fullscreen')};
const stageFullscreen={target:$('stage-shell'),button:$('stage-fullscreen')};
const fullscreenViews=[matchFullscreen,stageFullscreen];
let viewportFullscreen=null;

function showFullscreenState(){
  for(const {target,button} of fullscreenViews){
    const expanded=document.fullscreenElement===target||viewportFullscreen===target;
    target.classList.toggle('fullscreen-active',expanded);
    target.classList.toggle('fullscreen-fallback',viewportFullscreen===target);
    button.setAttribute('aria-pressed',String(expanded));
    button.textContent=expanded?'Exit full screen':'Full screen';
  }
  $('stage').classList.toggle('fullscreen-dialog',viewportFullscreen===stageFullscreen.target);
  document.body.classList.toggle('fullscreen-page',viewportFullscreen!==null);
}
async function closeFullscreen(target){
  if(viewportFullscreen===target){
    viewportFullscreen=null;
    showFullscreenState();
  } else if(document.fullscreenElement===target){
    await document.exitFullscreen();
  }
}
async function toggleFullscreen(target){
  if(document.fullscreenElement===target||viewportFullscreen===target){
    await closeFullscreen(target);
    return;
  }
  if(target===matchFullscreen.target && document.fullscreenEnabled && target.requestFullscreen){
    try {
      await target.requestFullscreen();
      return;
    } catch {
      // Use the whole available viewport when the browser denies native fullscreen.
    }
  }
  if(target===stageFullscreen.target&&!$('stage').open) return;
  viewportFullscreen=target;
  showFullscreenState();
}
for(const {target,button} of fullscreenViews){
  button.addEventListener('click',async event=>{
    if(event.detail>0 && target===matchFullscreen.target) button.blur();
    await toggleFullscreen(target);
  });
}
document.addEventListener('fullscreenchange',showFullscreenState);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&viewportFullscreen===matchFullscreen.target){
    event.preventDefault();
    closeFullscreen(matchFullscreen.target);
  }
});
$('stage').addEventListener('cancel',event=>{
  if(viewportFullscreen!==stageFullscreen.target && document.fullscreenElement!==stageFullscreen.target) return;
  event.preventDefault();
  closeFullscreen(stageFullscreen.target);
});
$('stage').addEventListener('close',()=>closeFullscreen(stageFullscreen.target));
