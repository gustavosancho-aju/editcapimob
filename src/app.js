
import { MAX_PHOTOS, MAX_SCENES, MAX_IMAGE_BYTES, MAX_PROJECT_BYTES, formats, clamp, totalDuration, locateScene, sourceRect, cropSuggestions, validateProject } from './engine.js';

const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID();
let project = { version: 1, name: 'Meu primeiro imóvel', format: '16:9', brand: '', contact: '', photos: [], scenes: [], music: null };
let selected = null, time = 0, playing = false, raf = 0, dirty = false, busy = false, cancelRecording = null;
let lastTime = 0, toastTimer, explorerScene = null;
const images = new Map();
const canvas = $('preview'), ctx = canvas.getContext('2d', { alpha: false });
let musicAudio = null;
const mediaTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
function notify(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 6000); }
function markDirty() { dirty = true; $('save-state').textContent = 'Alterações nesta sessão · salve seu projeto'; }
const activeScene = () => project.scenes.find(s => s.id === selected);
const photoOf = scene => project.photos.find(p => p.id === scene?.photoId);
function formatTime(t) { return String(Math.floor(t / 60)).padStart(2,'0') + ':' + String(Math.floor(t % 60)).padStart(2,'0'); }
function readData(file) { return new Promise((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('Não foi possível ler o arquivo.')); r.readAsDataURL(file); }); }
function decodeImage(data) { return new Promise((resolve,reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Imagem inválida ou formato não suportado.')); image.src = data; }); }
function validateImageSize(image) {
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 16000 || image.naturalHeight > 16000 || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Use uma foto com até 40 megapixels e 16.000 pixels por lado.');
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function safeName() { return (project.name.trim() || 'meu-imovel').replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '-').slice(0,80); }
function makeScene(photoId, overrides = {}) { return { id: uid(), photoId, room: 'A classificar', caption: '', duration: 4, motion: 'zoom-in', zoom: 1, focusX: .5, focusY: .5, ...overrides }; }
function checkCapacity(count, duration) {
  if (project.scenes.length + count > MAX_SCENES || totalDuration(project.scenes) + duration > 300) throw new Error('Limite desta versão: 80 cenas e 5 minutos de vídeo.');
}
async function addPhotos(files) {
  if (busy) return;
  if (project.photos.length + files.length > MAX_PHOTOS) return notify('Você pode usar até 24 fotos por projeto.');
  busy = true; $('upload').disabled = true;
  let added = 0;
  try {
    for (const file of files) {
      if (!mediaTypes.has(file.type)) { notify(file.name + ': escolha JPG, PNG ou WebP.'); continue; }
      if (file.size > MAX_IMAGE_BYTES) { notify(file.name + ': o limite é 10 MB por foto.'); continue; }
      const data = await readData(file);
      if (project.photos.reduce((n,p) => n + p.data.length, 0) + data.length > 60 * 1024 * 1024) throw new Error('Limite de fotos desta sessão atingido. Salve o projeto antes de iniciar outro.');
      const image = await decodeImage(data); validateImageSize(image);
      checkCapacity(1,4);
      const photo = { id: uid(), name: file.name.slice(0,180), data, width: image.naturalWidth, height: image.naturalHeight };
      project.photos.push(photo); images.set(photo.id,image);
      const scene = makeScene(photo.id); project.scenes.push(scene); selected = scene.id; added++; markDirty();
    }
    if (added) { stopPlayback(); time = sceneStart(selected); renderAll(); notify(added + ' foto(s) adicionada(s). Escolha uma cena para editar.'); }
  } catch (e) { notify(e.message); renderAll(); }
  finally { busy = false; $('upload').disabled = false; $('photo-input').value = ''; }
}
function sceneStart(id) { let n=0; for (const s of project.scenes) { if (s.id===id) return n; n+=s.duration; } return 0; }
function fitText(context,text,maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let s=text;
  while (s.length && context.measureText(s + '…').width > maxWidth) s=s.slice(0,-1);
  return s+'…';
}
function drawScene(target, scene, progress = 0, overlays = true) {
  const context=target.getContext('2d'), w=target.width, h=target.height;
  context.fillStyle='#080c0a'; context.fillRect(0,0,w,h);
  const photo=photoOf(scene), image=images.get(photo?.id);
  if (!image || !scene) return;
  const rect=sourceRect(photo.width,photo.height,w,h,scene,progress);
  context.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,w,h);
  if (!overlays || (!scene.caption && !project.brand && !project.contact)) return;
  const padding=w*.055;
  const gradient=context.createLinearGradient(0,h*.57,0,h);
  gradient.addColorStop(0,'transparent'); gradient.addColorStop(1,'rgba(0,0,0,.8)');
  context.fillStyle=gradient; context.fillRect(0,h*.57,w,h*.43);
  context.fillStyle='#ffffff'; context.textBaseline='bottom';
  const base=Math.min(w,h);
  if (scene.caption) {
    context.font='600 '+Math.round(base*.045)+'px system-ui, sans-serif';
    context.fillText(fitText(context,scene.caption,w-padding*2),padding,h-padding-base*.065);
  }
  if (project.brand || project.contact) {
    context.font='400 '+Math.round(base*.023)+'px system-ui, sans-serif';
    context.fillStyle='#e3ebdf';
    context.fillText(fitText(context,[project.brand,project.contact].filter(Boolean).join(' · '),w-padding*2),padding,h-padding);
  }
}
function drawAt(position) {
  const located=locateScene(project.scenes,position);
  if (!located) { ctx.fillStyle='#080c0a'; ctx.fillRect(0,0,canvas.width,canvas.height); return; }
  drawScene(canvas,located.scene,located.progress);
  // Gentle fade at scene boundaries, using the same renderer for preview and export.
  const local=located.progress * located.scene.duration;
  const remaining=located.scene.duration-local;
  const opacity=1-Math.min(1,local/.22,remaining/.22);
  if (opacity > 0 && (playing || cancelRecording !== null)) {
    ctx.fillStyle='rgba(0,0,0,'+clamp(opacity,0,1)+')';ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  $('scene-counter').textContent='Cena '+(located.index+1)+' de '+project.scenes.length;
  $('scrubber').value=String(position);
  $('time').textContent=formatTime(position)+' / '+formatTime(totalDuration(project.scenes));
}
function renderLibrary() {
  const container=$('photo-library'); container.replaceChildren();
  $('photo-count').textContent=String(project.photos.length); $('library-empty').hidden=project.photos.length>0;
  for (const photo of project.photos) {
    const card=document.createElement('article');card.className='photo-card';
    const img=document.createElement('img');img.src=photo.data;img.alt=photo.name;img.loading='lazy';
    const footer=document.createElement('div');footer.className='photo-card-footer';
    const copy=document.createElement('div'), title=document.createElement('strong'),meta=document.createElement('small');
    title.textContent=photo.name;meta.textContent=photo.width+' × '+photo.height;
    copy.append(title,meta);
    const add=document.createElement('button');add.textContent='+';add.setAttribute('aria-label','Adicionar '+photo.name+' à sequência');
    add.onclick=()=>{ if(busy)return;try{checkCapacity(1,4);stopPlayback();const s=makeScene(photo.id);project.scenes.push(s);selected=s.id;time=sceneStart(s.id);markDirty();renderAll();}catch(e){notify(e.message);} };
    const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Remover foto '+photo.name);
    remove.onclick=()=>{if(busy)return;if(!confirm('Remover esta foto e todas as suas cenas?'))return;stopPlayback();project.photos=project.photos.filter(p=>p.id!==photo.id);project.scenes=project.scenes.filter(s=>s.photoId!==photo.id);images.delete(photo.id);selected=project.scenes[0]?.id??null;time=0;markDirty();renderAll();};
    footer.append(copy,add,remove);card.append(img,footer);container.append(card);
  }
}
function selectScene(id) { if(busy)return;stopPlayback();selected=id;time=sceneStart(id);renderTimeline();renderSettings();drawAt(time); }
function renderTimeline() {
  const container=$('timeline');container.replaceChildren();
  const duration=totalDuration(project.scenes);
  $('duration').textContent=project.scenes.length+' cenas · '+duration+'s';
  $('scrubber').max=String(duration);$('scrubber').disabled=!project.scenes.length;
  if (!project.scenes.length) { const p=document.createElement('p');p.className='empty-timeline';p.textContent='Adicione uma foto à sequência e comece a contar a história.';container.append(p); }
  project.scenes.forEach((scene,index)=>{
    const card=document.createElement('article');card.className='scene-card'+(scene.id===selected?' selected':'');
    const select=document.createElement('button');select.className='scene-select';select.setAttribute('aria-label','Selecionar cena '+(index+1));select.setAttribute('aria-pressed',String(scene.id===selected));
    const thumb=document.createElement('canvas');thumb.width=240;thumb.height=135;drawScene(thumb,scene,.5,false);
    const label=document.createElement('span');label.textContent=String(index+1).padStart(2,'0')+' · '+scene.room+' · '+scene.duration+'s';
    select.append(thumb,label);select.onclick=()=>selectScene(scene.id);
    const actions=document.createElement('div');actions.className='scene-actions';
    for(const [symbol,title,action,disabled] of [
      ['←','Mover cena para antes',()=>moveScene(index,-1),index===0],
      ['→','Mover cena para depois',()=>moveScene(index,1),index===project.scenes.length-1],
      ['×','Remover cena',()=>{if(busy)return;stopPlayback();project.scenes.splice(index,1);selected=project.scenes[Math.min(index,project.scenes.length-1)]?.id??null;time=sceneStart(selected);markDirty();renderAll();},false]
    ]){const b=document.createElement('button');b.textContent=symbol;b.setAttribute('aria-label',title);b.disabled=disabled;b.onclick=action;actions.append(b);}
    card.append(select,actions);container.append(card);
  });
}
function moveScene(index,by) {if(busy)return;stopPlayback();const [s]=project.scenes.splice(index,1);project.scenes.splice(index+by,0,s);time=sceneStart(selected);markDirty();renderTimeline();drawAt(time);}
function renderSettings() {
  const s=activeScene();$('scene-settings').disabled=!s;
  if(!s)return;
  $('room').value=s.room;$('caption').value=s.caption;$('seconds').value=String(s.duration);$('motion').value=s.motion;
  $('zoom').value=String(s.zoom);$('zoom-value').textContent=s.zoom.toFixed(2)+'×';
  $('focus-x').value=String(s.focusX);$('focus-y').value=String(s.focusY);
  const p=photoOf(s);const rect=sourceRect(p.width,p.height,canvas.width,canvas.height,s,.5);
  $('resolution-warning').hidden=rect.w>=canvas.width&&rect.h>=canvas.height;
}
function renderAll() {
  [canvas.width,canvas.height]=formats[project.format];
  $('project-name').value=project.name;$('format').value=project.format;$('brand').value=project.brand;$('contact').value=project.contact;
  $('stage-empty').hidden=!!project.scenes.length;$('stage-label').hidden=!project.scenes.length;
  $('export').disabled=!project.scenes.length;$('play').disabled=!project.scenes.length;
  $('music-name').textContent=project.music?.name||'Trilha sonora';
  $('music-description').textContent=project.music?'Volume suave · repetida até o fim do vídeo':'Adicione uma música que você tenha autorização para usar.';
  $('add-music').textContent=project.music?'Trocar áudio':'Adicionar áudio';$('remove-music').hidden=!project.music;
  renderLibrary();renderTimeline();renderSettings();drawAt(time);
  if(!project.scenes.length){$('time').textContent='00:00 / 00:00';$('scene-counter').textContent='Nenhuma cena';}
}
function stopPlayback() {playing=false;cancelAnimationFrame(raf);$('play').textContent='▶';$('play').setAttribute('aria-label','Reproduzir vídeo');musicAudio?.pause();}
function playbackTick(now) {
  if(!playing)return;
  time+=(now-lastTime)/1000;lastTime=now;
  if(time>=totalDuration(project.scenes)){time=0;stopPlayback();drawAt(0);return;}
  drawAt(time);raf=requestAnimationFrame(playbackTick);
}
async function play() {
  if(busy||!project.scenes.length)return;
  if(playing){stopPlayback();return;}
  if(time>=totalDuration(project.scenes))time=0;
  playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pausar vídeo');
  if(project.music){if(!musicAudio){musicAudio=new Audio(project.music.data);musicAudio.loop=true;musicAudio.volume=.3;}try{if(Number.isFinite(musicAudio.duration)&&musicAudio.duration>0)musicAudio.currentTime=time%musicAudio.duration;await musicAudio.play();}catch{notify('Não foi possível reproduzir a música neste navegador.');}}
  if(!playing)return;lastTime=performance.now();raf=requestAnimationFrame(playbackTick);
}
function updateScene(key,value) {
  if(busy)return;const s=activeScene();if(!s)return;stopPlayback();
  if(key==='duration'&&totalDuration(project.scenes)-s.duration+value>300){notify('O limite é 5 minutos de vídeo.');renderSettings();return;}
  s[key]=value;time=sceneStart(s.id);markDirty();renderSettings();renderTimeline();drawAt(time);
}
function switchMode(ai) {
  if(busy)return;
  $('ai-panel').hidden=!ai;$('scene-settings').hidden=ai;
  $('motion-tab').classList.toggle('active',!ai);$('ai-tab').classList.toggle('active',ai);
  $('motion-tab').setAttribute('aria-selected',String(!ai));$('ai-tab').setAttribute('aria-selected',String(ai));
}
function openExplorer() {
  if(busy)return;const scene=activeScene();if(!scene)return;stopPlayback();explorerScene={...scene};
  const container=$('crop-options');container.replaceChildren();
  for(const suggestion of cropSuggestions()){
    const article=document.createElement('article');article.className='crop-card';
    const preview=document.createElement('canvas');preview.width=400;preview.height=Math.round(400*canvas.height/canvas.width);
    drawScene(preview,{...scene,...suggestion},0,false);
    const title=document.createElement('h3');title.textContent=suggestion.name;
    const button=document.createElement('button');button.className='secondary';button.textContent='Adicionar à sequência';
    button.onclick=()=>addCrops([suggestion]);
    article.append(preview,title,button);container.append(article);
  }
  $('explore-dialog').showModal();
}
function addCrops(suggestions) {
  if(busy||!explorerScene)return;
  try{checkCapacity(suggestions.length,suggestions.length*explorerScene.duration);
    const newScenes=suggestions.map(({name,...crop})=>({...explorerScene,...crop,id:uid()}));
    const index=project.scenes.findIndex(s=>s.id===explorerScene.id);
    project.scenes.splice(index+1,0,...newScenes);selected=newScenes[0].id;time=sceneStart(selected);markDirty();renderAll();$('explore-dialog').close();
    notify(newScenes.length+' enquadramento(s) adicionado(s). Ajuste o foco à direita.');
  }catch(e){notify(e.message);}
}
async function saveProject() {
  if(busy)return;
  try{validateProject(project);const content=JSON.stringify(project);if(content.length>MAX_PROJECT_BYTES)throw new Error('Projeto muito grande para salvar. Remova algumas fotos.');
    download(new Blob([content],{type:'application/json'}),safeName()+'.ecimob.json');dirty=false;$('save-state').textContent='Arquivo de projeto solicitado para download';notify('Guarde o arquivo .ecimob.json. Ele contém suas fotos e edições.');
  }catch(e){notify(e.message);}
}
async function openProject(file) {
  if(!file||busy)return;
  if(file.size>MAX_PROJECT_BYTES)return notify('O projeto deve ter no máximo 80 MB.');
  if(dirty&&!confirm('Abrir outro projeto? Alterações não salvas serão perdidas.'))return;
  busy=true;stopPlayback();
  try{
    const next=validateProject(JSON.parse(await file.text()));
    const nextImages=new Map();
    for(const photo of next.photos){const image=await decodeImage(photo.data);validateImageSize(image);
      if(image.naturalWidth!==photo.width||image.naturalHeight!==photo.height)throw new Error('As dimensões de uma imagem não correspondem ao projeto.');
      nextImages.set(photo.id,image);
    }
    project=next;images.clear();for(const [key,image] of nextImages)images.set(key,image);
    musicAudio?.pause();musicAudio=null;selected=project.scenes[0]?.id??null;time=0;dirty=false;
    $('save-state').textContent='Projeto aberto do arquivo';renderAll();switchMode(false);notify('Projeto recuperado com suas fotos e cenas.');
  }catch(e){notify(e instanceof SyntaxError?'Este arquivo não contém um projeto válido.':e.message);}
  finally{busy=false;$('project-input').value='';}
}
async function addMusic(file) {
  if(!file||busy)return;
  if(!/^audio\/(mpeg|wav|x-wav|ogg|mp4|aac)$/.test(file.type))return notify('Use áudio MP3, WAV, OGG, M4A ou AAC.');
  if(file.size>8*1024*1024)return notify('O áudio deve ter no máximo 8 MB.');
  busy=true;
  try{const data=await readData(file);const audio=new Audio(data);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Não foi possível abrir o áudio.')),10000);audio.onloadedmetadata=()=>{clearTimeout(timer);resolve();};audio.onerror=()=>{clearTimeout(timer);reject(new Error('Áudio incompatível com este navegador.'));};audio.load();});
    stopPlayback();musicAudio=null;project.music={name:file.name.slice(0,180),data};markDirty();renderAll();
  }catch(e){notify(e.message);}finally{busy=false;$('music-input').value='';}
}
async function exportVideo() {
  if(busy||!project.scenes.length)return;
  if(!globalThis.MediaRecorder||!canvas.captureStream)return notify('Este navegador não oferece gravação de vídeo. Tente uma versão atual do Chrome ou Edge.');
  const types=project.music?['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm']:
    ['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm'];
  const mime=types.find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)return notify('Não foi encontrado um formato de vídeo compatível neste navegador.');
  stopPlayback();busy=true;const oldTime=time;let stream=null,context=null,audio=null,recorder=null,timer=null,wake=null;
  let aborted=false,recordingError=null;
  const chunks=[],extension=mime.startsWith('video/mp4')?'mp4':'webm';
  $('export-heading').textContent='Gerando seu vídeo '+extension.toUpperCase();
  $('export-info').textContent='Mantenha esta aba visível. A gravação leva aproximadamente '+totalDuration(project.scenes)+' segundos.'+(extension==='webm'?' Este navegador não oferece MP4; o arquivo será WebM.':'');
  $('export-progress').value=0;$('export-percent').textContent='0%';$('export-dialog').showModal();
  cancelRecording=()=>{aborted=true;if(recorder?.state==='recording')recorder.stop();};
  try{
    if(navigator.wakeLock)try{wake=await navigator.wakeLock.request('screen');}catch{}
    if(aborted)throw new Error('Exportação cancelada.');
    stream=canvas.captureStream(30);
    if(project.music){
      context=new AudioContext();await context.resume();
      audio=new Audio(project.music.data);audio.loop=true;
      const source=context.createMediaElementSource(audio),gain=context.createGain(),destination=context.createMediaStreamDestination();
      gain.gain.value=.3;source.connect(gain);gain.connect(destination);
      destination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
      await audio.play();
    }
    if(aborted)throw new Error('Exportação cancelada.');
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});
    const finished=new Promise((resolve,reject)=>{
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||new Error('A gravação falhou.'));
    });
    time=0;drawAt(0);recorder.start(250);const started=performance.now(),duration=totalDuration(project.scenes);
    timer=setInterval(()=>{
      if(document.hidden){recordingError=new Error('A aba ficou em segundo plano. Exporte novamente mantendo-a visível.');cancelRecording();return;}
      time=Math.min((performance.now()-started)/1000,duration);drawAt(time);
      const percent=Math.round(time/duration*100);$('export-progress').value=percent;$('export-percent').textContent=percent+'%';
      if(time>=duration&&recorder.state==='recording')recorder.stop();
    },1000/30);
    await finished;
    if(recordingError)throw recordingError;
    if(!aborted){
      const blob=new Blob(chunks,{type:recorder.mimeType||mime});
      if(!blob.size)throw new Error('O navegador não produziu dados de vídeo.');
      download(blob,safeName()+'.'+extension);notify('Vídeo '+extension.toUpperCase()+' pronto. O download foi iniciado.');
    }else notify('Exportação cancelada. Seu projeto foi mantido.');
  }catch(e){notify(e.message||'Não foi possível exportar o vídeo.');}
  finally{
    clearInterval(timer);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());
    audio?.pause();if(context)await context.close().catch(()=>{});if(wake)await wake.release().catch(()=>{});
    cancelRecording=null;busy=false;time=oldTime;$('export-dialog').close();drawAt(time);
  }
}
$('upload').onclick=$('stage-upload').onclick=()=>{if(!busy)$('photo-input').click();};
$('photo-input').onchange=e=>addPhotos([...e.target.files]);
const drop=document.querySelector('.media-panel');
drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag-over');};
drop.ondragleave=()=>drop.classList.remove('drag-over');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag-over');addPhotos([...e.dataTransfer.files]);};
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
$('play').onclick=play;$('scrubber').oninput=e=>{if(busy)return;stopPlayback();time=Number(e.target.value);drawAt(time);};
$('project-name').oninput=e=>{if(busy)return;project.name=e.target.value;markDirty();};
$('format').onchange=e=>{if(busy)return;stopPlayback();project.format=e.target.value;markDirty();renderAll();};
$('brand').oninput=e=>{if(busy)return;project.brand=e.target.value;markDirty();drawAt(time);};
$('contact').oninput=e=>{if(busy)return;project.contact=e.target.value;markDirty();drawAt(time);};
$('room').onchange=e=>updateScene('room',e.target.value);
$('caption').oninput=e=>updateScene('caption',e.target.value);
$('seconds').onchange=e=>updateScene('duration',Number(e.target.value));
$('motion').onchange=e=>updateScene('motion',e.target.value);
$('zoom').oninput=e=>updateScene('zoom',Number(e.target.value));
$('focus-x').oninput=e=>updateScene('focusX',Number(e.target.value));$('focus-y').oninput=e=>updateScene('focusY',Number(e.target.value));
$('motion-tab').onclick=$('back-motion').onclick=()=>switchMode(false);$('ai-tab').onclick=()=>switchMode(true);
$('explore').onclick=openExplorer;$('close-explore').onclick=()=>$('explore-dialog').close();
$('add-all-crops').onclick=()=>addCrops(cropSuggestions());
$('save-project').onclick=saveProject;$('open-project').onclick=()=>{if(!busy)$('project-input').click();};
$('project-input').onchange=e=>openProject(e.target.files[0]);
$('add-music').onclick=()=>{if(!busy)$('music-input').click();};$('music-input').onchange=e=>addMusic(e.target.files[0]);
$('remove-music').onclick=()=>{if(busy)return;stopPlayback();musicAudio=null;project.music=null;markDirty();renderAll();};
$('export').onclick=exportVideo;$('cancel-export').onclick=()=>cancelRecording?.();
$('export-dialog').addEventListener('cancel',e=>{e.preventDefault();cancelRecording?.();});
$('download-frame').onclick=()=>{
  const scene=activeScene();if(!scene||busy)return;
  const frame=document.createElement('canvas');[frame.width,frame.height]=formats[project.format];
  drawScene(frame,scene,0,false);frame.toBlob(blob=>{if(blob)download(blob,safeName()+'-detalhe.jpg');else notify('Não foi possível gerar a imagem.');},'image/jpeg',.95);
};
$('demo').onclick=async()=>{
  if(busy)return;$('demo').disabled=true;
  try{
    const response=await fetch('https://images.pexels.com/photos/16274689/pexels-photo-16274689/free-photo-of-sofa-in-modern-living-room.jpeg?auto=compress&dpr=1&h=1600&w=2400');
    if(!response.ok)throw new Error('A foto de exemplo está indisponível. Envie uma foto sua para continuar.');
    const blob=await response.blob();await addPhotos([new File([blob],'Demonstração — Bruna Finelli - Pexels.jpg',{type:'image/jpeg'})]);
  }catch(e){notify('Não foi possível carregar o exemplo. Você pode enviar suas próprias fotos.');}
  finally{$('demo').disabled=false;}
};
window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stopPlayback();});
renderAll();
