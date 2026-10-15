// Prévia autocontida das artes do próximo lote; não abre navegador nem altera o jogo.
export {};
const sheets = {
  kirin: { name: 'effect-kirin-v1', size: 180, anchorY: .78 },
  jukai: { name: 'effect-jukai-v1', size: 76, anchorY: .78 },
  raikyuu: { name: 'projectile-raikyuu-v1', size: 30, anchorY: .5 },
  chidorinagashi: { name: 'effect-chidorinagashi-v1', size: 142, anchorY: .78, dy: 9 },
};
const images = Object.fromEntries(await Promise.all(Object.entries(sheets).map(async ([id, s]) => [id,
  `data:image/png;base64,${Buffer.from(await Bun.file(`src/art/effects/${s.name}.png`).arrayBuffer()).toString('base64')}`])));
await Bun.write('docs/arte/jutsus/raiton-mokuton/preview.html', `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Kirin, Jukai, Raikyuu e Chidori Nagashi</title>
<style>body{margin:2rem;background:#202a25;color:#eee;font:16px system-ui}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;max-width:1100px}article{background:#2a362f;padding:1rem;border-radius:8px}canvas{width:100%;background:#899469;image-rendering:pixelated}button,label{margin:.6rem}</style>
<h1>Raiton e Mokuton — sprites v1</h1><p>Artes integradas no jogo, em zoom 2× nesta prévia. Kirin desce do céu; Jukai Kōtan envolve com raízes; Raikyuu voa; Chidori Nagashi descarrega ao redor do corpo.</p>
<button id="pause">Pausar</button><button id="restart">Reiniciar</button><label>Quadro manual <input id="frame" type="range" min="0" max="7" step="1" value="0"></label><span id="label"></span>
<div class="cards">${Object.entries({kirin:'Kirin',jukai:'Jukai Kōtan',raikyuu:'Raikyuu',chidorinagashi:'Chidori Nagashi'}).map(([id,label])=>`<article><h2>${label}</h2><canvas id="${id}" width="480" height="360"></canvas></article>`).join('')}</div>
<script>
const sheets=${JSON.stringify(sheets)}, urls=${JSON.stringify(images)};
const images=Object.fromEntries(Object.entries(urls).map(([id,url])=>{const img=new Image();img.src=url;return[id,img]}));
let t=0,last=performance.now(),paused=false,manual=null;const button=document.querySelector('#pause'),slider=document.querySelector('#frame');
button.onclick=()=>{paused=!paused;manual=null;button.textContent=paused?'Continuar':'Pausar'};
document.querySelector('#restart').onclick=()=>{t=0;manual=null;paused=false;button.textContent='Pausar'};
slider.oninput=()=>{manual=+slider.value;paused=true;button.textContent='Continuar'};
function draw(ctx,id,x,y,frame){const s=sheets[id],img=images[id];if(!img.complete||!img.naturalWidth)return;const cw=img.width/4,ch=img.height/2,w=s.size;ctx.drawImage(img,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,x-w*.5,y+(s.dy??0)-w*s.anchorY,w,w)}
function tick(now){if(!paused)t+=(now-last)/1000;last=now;
for(const id of Object.keys(sheets)){const ctx=document.querySelector('#'+id).getContext('2d');ctx.clearRect(0,0,480,360);ctx.imageSmoothingEnabled=false;ctx.save();ctx.scale(2,2);ctx.strokeStyle='#53633e';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(10,150);ctx.lineTo(230,150);ctx.stroke();ctx.setLineDash([]);
if(id==='raikyuu')draw(ctx,id,40+(t*.6%1)*160,100,manual??Math.floor(t*16)%8);
else if(id==='jukai'){const age=t%3,frame=age<.6?Math.min(2,Math.floor(age/.2)):age<2.4?3+Math.floor(age*2)%2:Math.min(7,5+Math.floor((age-2.4)/.2));draw(ctx,id,120,150,manual??frame)}
else{const age=t%1.6;if(manual!==null||age<.8)draw(ctx,id,120,150,manual??Math.min(7,Math.floor(age*10)))}ctx.restore()}
document.querySelector('#label').textContent=manual===null?'Animação automática':'Quadro '+(manual+1)+'/8';requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>`);
console.log('docs/arte/jutsus/raiton-mokuton/preview.html');
