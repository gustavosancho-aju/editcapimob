
import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceRect, locateScene, totalDuration, cropSuggestions, validateProject, motions, formats } from '../src/engine.js';

const scene = { id:'s1',photoId:'p1',room:'Sala',caption:'',duration:4,motion:'zoom-in',zoom:1,focusX:.5,focusY:.5 };
const project = () => ({
  version:1,name:'Teste',format:'16:9',brand:'',contact:'',music:null,
  photos:[{id:'p1',name:'sala.jpg',data:'data:image/jpeg;base64,/9j/AA==',width:2400,height:1600}],
  scenes:[{...scene}]
});
test('crops remain inside the original photo, preserving target aspect ratio',()=>{
  for(const [width,height] of [[2400,1600],[800,1600],[1000,1000]])
    for(const [ow,oh] of Object.values(formats))
      for(const motion of motions)
        for(const progress of [0,.25,.5,1])
          for(const focus of [0,.5,1]){
            const r=sourceRect(width,height,ow,oh,{...scene,motion,focusX:focus,focusY:focus,zoom:2},progress);
            assert.ok(r.x>=0 && r.y>=0 && r.w>0 && r.h>0);
            assert.ok(r.x+r.w<=width+.0001 && r.y+r.h<=height+.0001);
            assert.ok(Math.abs(r.w/r.h-ow/oh)<.00001);
          }
});
test('timeline boundary selects next scene and clamps the last frame',()=>{
  const scenes=[scene,{...scene,id:'s2',duration:5}];
  assert.equal(totalDuration(scenes),9);
  assert.equal(locateScene(scenes,0).index,0);
  assert.equal(locateScene(scenes,4).index,1);
  assert.equal(locateScene(scenes,20).progress,1);
  assert.equal(locateScene([],0),null);
});
test('four suggestions retain user control over focal position',()=>{
  const crops=cropSuggestions();
  assert.equal(crops.length,4);
  assert.equal(crops[0].zoom,1);
  assert.ok(crops.every(c=>c.focusX>=0 && c.focusX<=1 && c.focusY>=0 && c.focusY<=1));
});
test('valid file projects round-trip through JSON',()=>{const p=project();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);});
test('rejects unsafe media, duplicate IDs, missing photo references and unbounded numbers',()=>{
  for(const mutate of [
    p=>p.photos[0].data='https://example.org/private-image',
    p=>p.photos[0].data='data:image/svg+xml;base64,PHN2Zz4=',
    p=>p.photos.push({...p.photos[0]}),
    p=>p.scenes.push({...p.scenes[0]}),
    p=>p.scenes[0].photoId='missing',
    p=>p.scenes[0].zoom=Infinity,
    p=>p.scenes[0].duration=-1,
    p=>p.scenes[0].motion='unknown',
    p=>p.photos[0].width=999999,
    p=>p.format='__proto__',
    p=>p.music={name:'unsafe',data:'https://example.org/audio.mp3'}
  ]){const p=project();mutate(p);assert.throws(()=>validateProject(p));}
});
test('rejects a timeline beyond five minutes',()=>{const p=project();p.scenes=Array.from({length:40},(_,i)=>({...scene,id:'s'+i,duration:8}));assert.throws(()=>validateProject(p));});

test('horizontal camera movement changes the crop even when image width fills output',()=>{
  const s={...scene,motion:'pan-right'};
  const a=sourceRect(2400,1600,1280,720,s,0), b=sourceRect(2400,1600,1280,720,s,1);
  assert.ok(b.x>a.x);
});
