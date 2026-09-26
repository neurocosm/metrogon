'use strict';
const $ = id => document.getElementById(id);
$('open-sounds').onclick=()=>$('sound-dialog').showModal();
$('close-sounds').onclick=()=>$('sound-dialog').close();
$('sound-dialog').addEventListener('click',event=>{
  const dialog=$('sound-dialog'),bounds=dialog.getBoundingClientRect();
  if(event.target===dialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))dialog.close();
});
$('app-version').textContent = METROGON_VERSION;
const names = {3:'Triangle',4:'Square',5:'Pentagon',6:'Hexagon',7:'Heptagon',8:'Octagon'};
const sounds = Object.keys(SAMPLE_FILES);
const sampleBuffers=new Map();
let sampleLoading, starting=false, startRequest=0;
async function loadSamples(){
  if(!sampleLoading)sampleLoading=Promise.all(Object.entries(SAMPLE_FILES).map(async([name,path])=>{
    const response=await fetch(path);
    if(!response.ok)throw new Error(`Could not load ${name}`);
    const buffer=await context.decodeAudioData(await response.arrayBuffer());
    let peak=0;
    for(let ch=0;ch<buffer.numberOfChannels;ch++)for(const value of buffer.getChannelData(ch))peak=Math.max(peak,Math.abs(value));
    let onset=0;
    if(SAMPLE_CUTS[name]){
      const channels=Array.from({length:buffer.numberOfChannels},(_,ch)=>buffer.getChannelData(ch));
      for(let n=0;n<buffer.length;n++)if(channels.some(channel=>Math.abs(channel[n])>peak*.035)){
        onset=Math.max(0,n/buffer.sampleRate-.003);break;
      }
    }
    sampleBuffers.set(name,{buffer,gain:SAMPLE_FIXED_GAINS[name]??(peak>0?.75/peak:1),onset});
  })).catch(error=>{sampleLoading=null;throw error;});
  return sampleLoading;
}
const rudiments={
  none:{pattern:'',shape:4},
  single:{pattern:'LR',shape:4},
  double:{pattern:'LLRR',shape:4},
  triple:{pattern:'LLLRRR',shape:3},
  triplets:{pattern:'LR',shape:3},
  paradiddle:{pattern:'LRLLRLRR',shape:4},
  'double-paradiddle':{pattern:'LRLRLLRLRLRR',shape:6},
  'triple-paradiddle':{pattern:'LRLRLRLLRLRLRLRR',shape:8}
};
let nextStroke=0, reversed=false;
function updateSticking(lapStart=0){
  const pattern=rudiments[$('rudiment').value].pattern;
  for(let i=0;i<count;i++){
    const hand=pattern?pattern[(lapStart+i)%pattern.length]:'';
    $('stick-'+i).textContent=hand&&reversed?(hand==='L'?'R':'L'):hand;
  }
}
let bpm=100, count=4, playing=false, context, master, timer, nextTime=0, nextBeat=0, queue=[], current=null, points=[], taps=[];
const voices = new Set();
const beatSounds=Array.from({length:8},(_,i)=>i===0?'Cowbell':'Side stick');
$('default-sounds').onclick=()=>{
  beatSounds.fill('Side stick');
  beatSounds[0]='Cowbell';
  renderBeatSounds();
};
function renderBeatSounds(){
  $('beat-sounds').replaceChildren();
  for(let i=0;i<count;i++){
    const row=document.createElement('div');row.className='beat-sound-row';
    const label=document.createElement('label');label.htmlFor=`sound-${i}`;label.textContent=i+1;label.className=i===0?'beat-dot downbeat':'beat-dot';
    const select=document.createElement('select');select.id=`sound-${i}`;select.setAttribute('aria-label',`Beat ${i+1} sound`);
    for(const name of sounds)select.add(new Option(name,name));
    select.value=beatSounds[i];select.onchange=()=>{beatSounds[i]=select.value;};
    row.append(label,select);$('beat-sounds').append(row);
  }
}
function draw(){
  points=Array.from({length:count},(_,i)=>{const a=2*Math.PI*i/count-(count===4?3*Math.PI/4:Math.PI/2);return [250+155*Math.cos(a),220+155*Math.sin(a)];});
  $('visual').innerHTML=`<circle cx="250" cy="220" r="188" fill="none" stroke="#354a3c" stroke-dasharray="2 9"/><polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="#d3ee8b" fill-opacity=".025" stroke="#69815e" stroke-width="2"/>`+points.map(([x,y],i)=>`<circle id="node-${i}" cx="${x}" cy="${y}" r="7" fill="${i===0?'#d3ee8b':'#71906b'}"/><text x="${250+(x-250)*1.19}" y="${220+(y-220)*1.19+5}" text-anchor="middle" fill="#d1ddc9" font-size="15">${i+1}</text>`).join('')+`<text id="count-display" x="250" y="229" text-anchor="middle" fill="#edf1e8" font-size="64" font-weight="300">${playing?'1':'—'}</text><text x="250" y="259" text-anchor="middle" fill="#98aaa1" font-size="9" letter-spacing="3">BEAT</text><circle id="cursor" r="11" fill="#d3ee8b" stroke="#1a2821" stroke-width="4" visibility="hidden"/>`;
  $('visual').setAttribute('aria-label',`${count} beats arranged in a ${names[count].toLowerCase()}`);
  $('meter-label').textContent=`${count}/4`;$('shape-label').textContent=names[count];
  for(let i=0;i<count;i++){
    const [x,y]=points[i];
    const label=document.createElementNS('http://www.w3.org/2000/svg','text');
    label.id=`stick-${i}`;label.setAttribute('x',250+(x-250)*.75);label.setAttribute('y',220+(y-220)*.75);
    label.setAttribute('text-anchor','middle');label.setAttribute('dominant-baseline','central');
    label.setAttribute('fill','#ff5757');label.setAttribute('font-size','23');label.setAttribute('font-weight','700');
    $('visual').append(label);
  }
  updateSticking();
}
function sound(name,time){
  if(sampleBuffers.has(name)){
    const sample=sampleBuffers.get(name),source=context.createBufferSource(),level=context.createGain();
    source.buffer=sample.buffer;source.playbackRate.value=SAMPLE_PLAYBACK_RATES[name]||1;level.gain.value=sample.gain;source.connect(level);level.connect(master);
    voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();level.disconnect();};
    const cut=SAMPLE_CUTS[name];
    if(cut){
      const duration=Math.min(cut.duration,sample.buffer.duration-sample.onset);
      level.gain.setValueAtTime(0,time);
      level.gain.linearRampToValueAtTime(sample.gain,time+cut.attack);
      level.gain.setValueAtTime(sample.gain,time+Math.max(cut.attack,duration-cut.release));
      level.gain.linearRampToValueAtTime(0,time+duration);
      source.start(time,sample.onset,duration);
    }else source.start(time);
    return;
  }
  const gain=context.createGain();gain.connect(master);
  const duration=name==='Bass drum'?.23:name==='Agogo'?.18:.075;
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.4,time+.002);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  const noise=name==='Hi-hat'||name==='Snare';
  const frequencies=name==='Cowbell'?[540,800]:name==='Agogo'?[880,1320]:[name==='Bass drum'?130:1100];
  for(const frequency of frequencies){
    let source;
    if(noise){const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;source=context.createBufferSource();source.buffer=buffer;const filter=context.createBiquadFilter();filter.type='highpass';filter.frequency.value=name==='Hi-hat'?7000:1500;source.connect(filter);filter.connect(gain);}
    else{source=context.createOscillator();source.type=name==='Cowbell'?'square':name==='Side stick'?'triangle':'sine';source.frequency.setValueAtTime(frequency,time);if(name==='Bass drum')source.frequency.exponentialRampToValueAtTime(45,time+duration);source.connect(gain);}
    voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();};source.start(time);source.stop(time+duration);
  }
}
function schedule(){
  while(nextTime<context.currentTime+.12){const duration=60/bpm;sound(beatSounds[nextBeat],nextTime);queue.push({time:nextTime,beat:nextBeat,duration,stroke:nextStroke++});nextTime+=duration;nextBeat=(nextBeat+1)%count;}
}
function stop(){startRequest++;starting=false;playing=false;clearInterval(timer);for(const voice of voices){try{voice.stop();}catch{}}voices.clear();queue=[];current=null;$('play').textContent='▶ Start playing';$('play').setAttribute('aria-pressed','false');$('status').textContent='Ready to play';draw();}
async function start(){
  if(playing||starting)return;
  starting=true;const request=++startRequest;
  nextStroke=0;updateSticking();
  $('play').textContent='■ Cancel loading';$('status').textContent='Loading sounds…';
  try{
    context??=new AudioContext();
    if(!master){master=context.createGain();master.connect(context.destination);}
    await context.resume();await loadSamples();
    if(request!==startRequest||document.hidden)return;
    master.gain.value=Number($('volume').value)/100;
    starting=false;playing=true;nextBeat=0;nextTime=context.currentTime+.05;queue=[];current=null;
    $('play').textContent='■ Stop playing';$('play').setAttribute('aria-pressed','true');
    $('status').textContent='In the groove';$('message').textContent='';schedule();timer=setInterval(schedule,25);
  }catch(error){if(request===startRequest){stop();$('message').textContent='Could not load the drum sounds. Check your connection and try again.';}}
}
function animate(){
  if(playing){while(queue.length&&queue[0].time<=context.currentTime)current=queue.shift();if(current){const {beat,time,duration}=current;const elapsed=context.currentTime-time;const progress=Math.min(1,elapsed/duration);const a=points[beat],b=points[(beat+1)%count];$('cursor').setAttribute('visibility','visible');$('cursor').setAttribute('cx',a[0]+(b[0]-a[0])*progress);$('cursor').setAttribute('cy',a[1]+(b[1]-a[1])*progress);$('count-display').textContent=beat+1;
    updateSticking(current.stroke-beat);
    // Flash the corner on the audio clock, then return it to its resting state.
    const flashDuration=Math.min(.16,duration*.45);
    for(let i=0;i<count;i++){
      const node=$('node-'+i);
      const flashing=i===beat&&elapsed<flashDuration;
      const color=i===0?'#58f58a':'#42a5ff';
      node.setAttribute('r',flashing?'14':'7');
      node.setAttribute('fill',flashing?color:(i===0?'#d3ee8b':'#71906b'));
      node.style.filter=flashing?`drop-shadow(0 0 10px ${color})`:'none';
    }
  }}
  requestAnimationFrame(animate);
}
function tempo(value){bpm=Math.max(30,Math.min(240,Math.round(Number(value)||100)));$('tempo').value=bpm;$('tempo-slider').value=bpm;}
$('tempo').addEventListener('change',e=>tempo(e.target.value));$('tempo-slider').addEventListener('input',e=>tempo(e.target.value));$('slower').onclick=()=>tempo(bpm-1);$('faster').onclick=()=>tempo(bpm+1);
$('play').onclick=()=>(playing||starting)?stop():start();$('meter').onchange=()=>{const resume=playing||starting;stop();count=Number($('meter').value);draw();renderBeatSounds();if(resume)start();};
$('volume').oninput=()=>{if(master)master.gain.setTargetAtTime(Number($('volume').value)/100,context.currentTime,.015);};
$('rudiment').onchange=()=>{
  const resume=playing||starting;stop();
  $('reverse').hidden=$('rudiment').value==='none';
  if($('rudiment').value!=='none')count=rudiments[$('rudiment').value].shape;
  $('meter').value=count;draw();renderBeatSounds();if(resume)start();
};
$('reverse').onclick=()=>{
  reversed=!reversed;
  $('reverse').setAttribute('aria-pressed',String(reversed));
  $('reverse').title=reversed?'Right hand leads. Switch to left hand.':'Left hand leads. Switch to right hand.';
  updateSticking(current?current.stroke-current.beat:0);
};
$('tap').onclick=()=>{const now=performance.now();if(taps.length&&now-taps.at(-1)>2000)taps=[];taps.push(now);if(taps.length>5)taps.shift();if(taps.length>1)tempo(60000*(taps.length-1)/(now-taps[0]));};
document.addEventListener('keydown',event=>{if(event.code==='Space'&&!event.repeat&&!event.target.closest('button,input,select,summary,a')){event.preventDefault();(playing||starting)?stop():start();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||starting))stop();});
draw();renderBeatSounds();requestAnimationFrame(animate);
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{$('message').textContent='Offline mode is unavailable in this browser session.';});
