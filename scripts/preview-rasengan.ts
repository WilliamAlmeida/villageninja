// Prévia local das artes e dos valores reais; não abre navegador nem toca no save.
import { FX } from '../src/data/jutsuFx';
const names = ['effect-rasengan-v1', 'effect-rasengan-impact-v1', 'effect-rasengan-crater-v1'];
const images = Object.fromEntries(await Promise.all(names.map(async name => [name,
  `data:image/png;base64,${Buffer.from(await Bun.file(`src/art/effects/${name}.png`).arrayBuffer()).toString('base64')}`])));
await Bun.write('docs/arte/jutsus/rasengan/preview-impacto.html', `<!doctype html>
<html lang="pt-BR"><meta charset="utf-8"><title>Rasengan — esfera, impacto e cratera</title>
<style>body{margin:2rem;background:#202a25;color:#eee;font:16px system-ui}canvas{max-width:100%;image-rendering:pixelated;background:#879461;border:1px solid #596448}button,input{margin:.6rem}p{max-width:60rem}</style>
<h1>Rasengan e Ōdama</h1><p>Mesmas três imagens, escala 1× e 2×. Prévia das artes sem personagens: esfera por 1 segundo, impacto por 0,5 segundo e cratera por 12/18 segundos. A esfera segue a mão no jogo.</p>
<button id="restart">Reiniciar</button><button id="pause">Pausar</button><input id="time" type="range" min="0" max="20" step="0.01" value="0"><span id="clock"></span>
<br><canvas width="960" height="420"></canvas>
<script>
const cfg=${JSON.stringify({rasengan:FX.jutsus.rasengan,odama:FX.jutsus.odama})};
const urls=${JSON.stringify(images)};
const art=Object.fromEntries(Object.entries(urls).map(([k,url])=>{const img=new Image();img.src=url;return [k,img]}));
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),slider=document.querySelector('#time');
let t=0,paused=false,last=performance.now();
document.querySelector('#restart').onclick=()=>t=0;
document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Continuar':'Pausar'};
slider.oninput=()=>{t=+slider.value;paused=true;document.querySelector('#pause').textContent='Continuar'};
function sprite(s,x,y,frame=0,opacity=1,growth=1){const img=art[s.sheet];if(!img.complete||!img.naturalWidth)return;const cw=img.width/s.cols,ch=img.height/s.rows,w=s.size*growth,h=w*ch/cw;ctx.save();ctx.globalAlpha=s.opacity*opacity;ctx.drawImage(img,frame%s.cols*cw,Math.floor(frame/s.cols)*ch,cw,ch,x-w*s.anchorX,y-h*s.anchorY,w,h);ctx.restore()}
function tick(now){if(!paused)t=(t+(now-last)/1000)%20;last=now;ctx.clearRect(0,0,960,420);ctx.imageSmoothingEnabled=false;
ctx.fillStyle='#182a23';ctx.font='20px system-ui';ctx.fillText('Rasengan — 1×',30,32);ctx.fillText('Ōdama — 2×',510,32);
['rasengan','odama'].forEach((id,i)=>{ctx.save();ctx.translate(i*480,80);ctx.scale(2.5,2.5);const c=cfg[id],age=t-1;
if(age>=0&&age<c.crater.life)sprite(c.crater,96,85,0,Math.min(1,(1-age/c.crater.life)/.3),Math.min(1,age/.12));
if(t<1)sprite(c.sprite,30+66*t,66,Math.floor(t*c.sprite.fps)%8,1,Math.min(1,.25+t/.12));
if(age>=0&&age<.5)sprite(c.impact,96,85,Math.min(7,Math.floor(age*c.impact.fps)));
ctx.restore()});slider.value=t;document.querySelector('#clock').textContent=t.toFixed(2)+' s';requestAnimationFrame(tick)}
requestAnimationFrame(tick);
</script></html>`);
console.log('docs/arte/jutsus/rasengan/preview-impacto.html');
