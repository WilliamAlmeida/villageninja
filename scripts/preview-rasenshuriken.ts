// Prévia das artes com os tamanhos e tempos do jogo, sem abrir navegador.
import { FX } from '../src/data/jutsuFx';
const names = ['projectile-rasenshuriken-v1', 'effect-rasenshuriken-impact-v1', 'effect-rasengan-crater-v1'];
const images = Object.fromEntries(await Promise.all(names.map(async name => [name,
  `data:image/png;base64,${Buffer.from(await Bun.file(`src/art/effects/${name}.png`).arrayBuffer()).toString('base64')}`])));
await Bun.write('docs/arte/jutsus/rasenshuriken/preview.html', `<!doctype html>
<html lang="pt-BR"><meta charset="utf-8"><title>Rasenshuriken — prévia</title>
<style>body{margin:2rem;background:#202a25;color:#eee;font:16px system-ui}canvas{max-width:100%;image-rendering:pixelated;background:#879461;border:1px solid #596448}button,input{margin:.6rem}p{max-width:60rem}a{color:#a4dfff}</style>
<h1>Rasenshuriken</h1><p>Formação → voo → domo de vento (0,8 s) → cratera (20 s). Abaixo: tamanho do jogo e zoom 2×. A linha tracejada indica o chão, sem personagem nesta prévia.</p>
<button id="restart">Reiniciar</button><button id="impact">Ver explosão</button><button id="pause">Pausar</button><label>Tempo <input id="time" type="range" min="0" max="22" step="0.01" value="0"></label><span id="clock"></span>
<br><canvas width="960" height="430"></canvas>
<script>
const cfg=${JSON.stringify(FX.jutsus.rasenshuriken)}, urls=${JSON.stringify(images)};
const art=Object.fromEntries(Object.entries(urls).map(([k,url])=>{const img=new Image();img.src=url;return[k,img]}));
const ctx=document.querySelector('canvas').getContext('2d'),slider=document.querySelector('#time');let t=0,paused=false,last=performance.now();
document.querySelector('#restart').onclick=()=>{t=0;paused=false;document.querySelector('#pause').textContent='Pausar'};
document.querySelector('#impact').onclick=()=>{t=1.3;paused=false;document.querySelector('#pause').textContent='Pausar'};
document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Continuar':'Pausar'};
slider.oninput=()=>{t=+slider.value;paused=true;document.querySelector('#pause').textContent='Continuar'};
function sprite(s,x,y,frame=0,opacity=1,growth=1){const img=art[s.sheet];if(!img.complete||!img.naturalWidth)return;const cw=img.width/s.cols,ch=img.height/s.rows,w=s.size*growth,h=w*ch/cw;ctx.save();ctx.globalAlpha=s.opacity*opacity;ctx.drawImage(img,frame%s.cols*cw,Math.floor(frame/s.cols)*ch,cw,ch,x-w*s.anchorX,y+s.dy-h*s.anchorY,w,h);ctx.restore()}
function tick(now){if(!paused)t=(t+(now-last)/1000)%22;last=now;ctx.clearRect(0,0,960,430);ctx.imageSmoothingEnabled=false;ctx.font='20px system-ui';ctx.fillStyle='#182a23';ctx.fillText('Tamanho do jogo',40,35);ctx.fillText('Zoom 2×',520,35);
[1,2].forEach((zoom,i)=>{ctx.save();ctx.translate(i?690:260,320);ctx.scale(zoom,zoom);ctx.strokeStyle='#526440';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(-160,0);ctx.lineTo(110,0);ctx.stroke();ctx.setLineDash([]);const age=t-1.3;
if(age>=0&&age<cfg.crater.life)sprite(cfg.crater,0,0,0,Math.min(1,(1-age/cfg.crater.life)/.3),Math.min(1,age/.12));
if(t<.3)sprite(cfg.sprite,-130,-18,Math.floor(t*cfg.sprite.fps)%8,1,Math.min(1,.2+t/.24));
else if(t<1.3)sprite(cfg.sprite,-130*(1-(t-.3)),-8,Math.floor(t*cfg.sprite.fps)%8);
if(age>=0&&age<.8)sprite(cfg.impact,0,0,Math.min(7,Math.floor(age*cfg.impact.fps)),Math.min(1,(.8-age)/.16));ctx.restore()});
slider.value=t;document.querySelector('#clock').textContent=t.toFixed(2)+' s';requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>`);
console.log('docs/arte/jutsus/rasenshuriken/preview.html');
