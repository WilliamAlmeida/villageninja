// Prévia autocontida das cinco folhas, sem abrir navegador ou mexer no save.
export {};
const sheets = {
  wall: { name: 'effect-doryuuheki-v1', size: 64, anchorY: .78 },
  dragon: { name: 'effect-doryuudan-origin-v1', size: 68, anchorY: .78 },
  mud: { name: 'projectile-doryuudan-v1', size: 22, anchorY: .5 },
  shield: { name: 'effect-sunanotate-v1', size: 64, anchorY: .78 },
  coffin: { name: 'effect-sabakukyu-v1', size: 56, anchorY: .78 },
};
const images = Object.fromEntries(await Promise.all(Object.entries(sheets).map(async ([id, s]) => [id,
  `data:image/png;base64,${Buffer.from(await Bun.file(`src/art/effects/${s.name}.png`).arrayBuffer()).toString('base64')}`])));
await Bun.write('docs/arte/jutsus/doton-suna/preview.html', `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<title>Doton e areia — sprites</title><style>body{margin:2rem;background:#202a25;color:#eee;font:16px system-ui}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;max-width:1100px}article{background:#2a362f;padding:1rem;border-radius:8px}canvas{width:100%;background:#899469;image-rendering:pixelated}button,label{margin:.6rem}a{color:#a4dfff}p{max-width:70rem}</style>
<h1>Doryuuheki · Doryuudan · Suna no Tate · Sabaku Kyū</h1><p>Prévia das artes em zoom 2,5×. Os quatro jutsus já estão integrados no jogo. Doryuudan combina cabeça fixa e projétil separado; muralha e casulo usam formação, permanência e desaparecimento.</p>
<button id="pause">Pausar</button><button id="restart">Reiniciar</button><label>Quadro manual <input id="frame" type="range" min="0" max="7" step="1" value="0"></label><span id="label"></span>
<div class="cards"><article><h2>Doryuuheki</h2><canvas id="wall" width="480" height="300"></canvas></article><article><h2>Doryuudan</h2><canvas id="dragon" width="480" height="300"></canvas></article><article><h2>Suna no Tate</h2><canvas id="shield" width="480" height="300"></canvas></article><article><h2>Sabaku Kyū</h2><canvas id="coffin" width="480" height="300"></canvas></article></div>
<script>
const sheets=${JSON.stringify(sheets)}, urls=${JSON.stringify(images)};
const images=Object.fromEntries(Object.entries(urls).map(([id,url])=>{const img=new Image();img.src=url;return[id,img]}));
let t=0,last=performance.now(),paused=false,manual=null;
const button=document.querySelector('#pause'),slider=document.querySelector('#frame');
button.onclick=()=>{paused=!paused;manual=null;button.textContent=paused?'Continuar':'Pausar'};
document.querySelector('#restart').onclick=()=>{t=0;manual=null;paused=false;button.textContent='Pausar'};
slider.oninput=()=>{manual=+slider.value;paused=true;button.textContent='Continuar'};
function draw(ctx,id,x,y,frame){const s=sheets[id],img=images[id];if(!img.complete||!img.naturalWidth)return;const cw=img.width/4,ch=img.height/2,w=s.size,h=w*ch/cw;ctx.drawImage(img,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,x-w*.5,y-h*s.anchorY,w,h)}
function phase(t){const age=t%3;if(age<.6)return Math.min(3,Math.floor(age/.15));if(age<2.2)return 4;return Math.min(7,5+Math.floor((age-2.2)/.2667))}
function tick(now){if(!paused)t+=(now-last)/1000;last=now;const stage=manual??phase(t),loop=manual??Math.floor(t*12)%8;
for(const id of ['wall','dragon','shield','coffin']){const canvas=document.querySelector('#'+id),ctx=canvas.getContext('2d');ctx.clearRect(0,0,480,300);ctx.imageSmoothingEnabled=false;ctx.save();ctx.scale(2.5,2.5);ctx.strokeStyle='#53633e';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(10,90);ctx.lineTo(182,90);ctx.stroke();ctx.setLineDash([]);
if(id==='dragon'){draw(ctx,'dragon',42,90,loop);const k=(t*1.3)%1;if(manual!==null||k>.3)draw(ctx,'mud',60+(manual!==null?45:(k-.3)/.7*105),72.3,manual??Math.floor(t*16)%8)}
else draw(ctx,id,96,90,id==='shield'?loop:stage);ctx.restore()}
document.querySelector('#label').textContent=manual===null?'Animação automática':'Quadro '+(manual+1)+'/8';requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>`);
console.log('docs/arte/jutsus/doton-suna/preview.html');
