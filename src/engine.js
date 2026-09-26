export const MAX_PHOTOS = 24;
export const MAX_SCENES = 80;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 80 * 1024 * 1024;
export const formats = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720] };
export const rooms = ['A classificar', 'Fachada', 'Sala', 'Cozinha', 'Quarto', 'Banheiro', 'Varanda', 'Área de lazer', 'Outro'];
export const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'still'];
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const totalDuration = scenes => scenes.reduce((sum, scene) => sum + scene.duration, 0);
export function locateScene(scenes, time) {
  let start = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (time < start + scenes[i].duration || i === scenes.length - 1) {
      return { scene: scenes[i], index: i, progress: clamp((time - start) / scenes[i].duration, 0, 1) };
    }
    start += scenes[i].duration;
  }
  return null;
}
export function sourceRect(width, height, outputWidth, outputHeight, scene, progress = 0) {
  const t = clamp(progress, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const animation = scene.motion === 'zoom-in' ? 1 + eased * 0.12 :
    scene.motion === 'zoom-out' ? 1.12 - eased * 0.12 : 1;
  const zoom = clamp(scene.zoom, 1, 3) * animation;
  const aspect = outputWidth / outputHeight;
  let w = Math.min(width, height * aspect) / zoom;
  let h = w / aspect;
  const pan = scene.motion === 'pan-left' ? (0.5 - eased) * 0.18 :
    scene.motion === 'pan-right' ? (eased - 0.5) * 0.18 : 0;
  const x = (width - w) * clamp(scene.focusX + pan, 0, 1);
  const y = (height - h) * clamp(scene.focusY, 0, 1);
  return { x, y, w, h };
}
export function cropSuggestions() {
  return [
    { name: 'Plano aberto', zoom: 1, focusX: 0.5, focusY: 0.5 },
    { name: 'Detalhe à esquerda', zoom: 1.8, focusX: 0.2, focusY: 0.6 },
    { name: 'Detalhe central', zoom: 2, focusX: 0.5, focusY: 0.65 },
    { name: 'Detalhe à direita', zoom: 1.8, focusX: 0.8, focusY: 0.5 },
  ];
}
const finite = (x, low, high) => typeof x === 'number' && Number.isFinite(x) && x >= low && x <= high;
const text = (x, max) => typeof x === 'string' && x.length <= max;
export function validateProject(p) {
  if (!p || p.version !== 1 || !text(p.name, 80) || !Object.hasOwn(formats, p.format) ||
    !text(p.brand, 60) || !text(p.contact, 60) || !Array.isArray(p.photos) || p.photos.length > MAX_PHOTOS ||
    !Array.isArray(p.scenes) || p.scenes.length > MAX_SCENES) throw new Error('Arquivo de projeto inválido ou de versão incompatível.');
  const ids = new Set();
  let bytes = 0;
  for (const photo of p.photos) {
    if (!photo || !text(photo.id, 80) || !photo.id || ids.has(photo.id) || !text(photo.name, 180) ||
      !finite(photo.width, 1, 16000) || !finite(photo.height, 1, 16000) || photo.width * photo.height > 40000000 ||
      typeof photo.data !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.data) ||
      photo.data.length > MAX_IMAGE_BYTES * 1.4) throw new Error('Uma foto do projeto é inválida.');
    ids.add(photo.id); bytes += photo.data.length;
  }
  const sceneIds = new Set();
  for (const s of p.scenes) {
    if (!s || !text(s.id, 80) || !s.id || sceneIds.has(s.id) || !ids.has(s.photoId) ||
      !text(s.caption, 100) || !rooms.includes(s.room) || !motions.includes(s.motion) ||
      !finite(s.duration, 2, 10) || !finite(s.zoom, 1, 3) ||
      !finite(s.focusX, 0, 1) || !finite(s.focusY, 0, 1)) throw new Error('Uma cena do projeto é inválida.');
    sceneIds.add(s.id);
  }
  if (totalDuration(p.scenes) > 300) throw new Error('O projeto ultrapassa o limite de 5 minutos.');
  if (p.music !== null) {
    if (!p.music || !text(p.music.name, 180) || typeof p.music.data !== 'string' ||
      !/^data:audio\/(mpeg|wav|x-wav|ogg|mp4|aac);base64,[A-Za-z0-9+/=]+$/.test(p.music.data) ||
      p.music.data.length > 12 * 1024 * 1024) throw new Error('Áudio inválido no projeto.');
    bytes += p.music.data.length;
  }
  if (bytes > MAX_PROJECT_BYTES) throw new Error('Projeto muito grande para esta versão.');
  return p;
}
