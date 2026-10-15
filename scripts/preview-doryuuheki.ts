// Galeria local das dezesseis direções com a seleção de folhas usada no jogo.
import { FX } from '../src/data/jutsuFx';
import { wallView } from '../src/render/earthSandMotion';
const config = FX.jutsus.doryuuheki!;
const images = Object.fromEntries(await Promise.all([config.sprite!, config.profile!, config.oblique!].map(async s => [s.sheet,
  `data:image/png;base64,${Buffer.from(await Bun.file(`src/art/effects/${s.sheet}.png`).arrayBuffer()).toString('base64')}`])));
await Bun.write('docs/arte/jutsus/doton-suna/preview-doryuuheki.html', `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Doryuuheki — direções</title>
<style>body{background:#25332b;color:#eee;font:16px system-ui;margin:2rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;max-width:1080px}canvas{width:100%;image-rendering:pixelated;background:#949567}label{display:block;margin:1rem 0}</style>
<h1>Doryuuheki — frontal, diagonal e perfil com espessura</h1><label>Quadro <input id="frame" type="range" min="0" max="7" value="3" step="1"> <span id="phase">4/8</span></label><div class="grid">${Array.from({length:16},(_,i)=>`<article><p>Direção ${i*22.5}°</p><canvas id="v${i}" width="240" height="240"></canvas></article>`).join('')}</div>
<script>
const cfg=${JSON.stringify(config)}, urls=${JSON.stringify(images)}, viewFor=${wallView.toString()};
const images=Object.fromEntries(Object.entries(urls).map(([name,url])=>{const img=new Image();img.src=url;img.onload=render;return[name,img]}));
function render(){const frame=+document.querySelector('#frame').value;document.querySelector('#phase').textContent=(frame+1)+'/8';
for(let i=0;i<16;i++){const angle=i*Math.PI/8,wa=angle+Math.PI/2,wx=32*Math.cos(wa),wy=32*Math.sin(wa);let dx=(wx-wy)*.75,dy=(wx+wy)*.375;if(dx<0){dx=-dx;dy=-dy}const view=viewFor(dx,dy),s=view==='profile'?cfg.profile:view==='oblique'?cfg.oblique:cfg.sprite,img=images[s.sheet],ctx=document.querySelector('#v'+i).getContext('2d');ctx.clearRect(0,0,240,240);if(!img.complete||!img.naturalWidth)continue;ctx.save();ctx.translate(120,180);ctx.scale(3,3);ctx.strokeStyle='#52663e';ctx.setLineDash([1,2]);ctx.beginPath();ctx.moveTo(-dx/2,-dy/2);ctx.lineTo(dx/2,dy/2);ctx.stroke();ctx.setLineDash([]);
if(s.flip&&dy>0)ctx.scale(-1,1);
ctx.imageSmoothingEnabled=false;const cw=img.width/4,ch=img.height/2;ctx.drawImage(img,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,-s.size*s.anchorX,-s.size*s.anchorY,s.size,s.size);ctx.restore();ctx.fillStyle='#18271c';ctx.font='14px system-ui';ctx.fillText(view==='profile'?'Perfil':view==='oblique'?'Diagonal':'Frontal',12,224)}}
document.querySelector('#frame').oninput=render;
</script></html>`);
console.log('docs/arte/jutsus/doton-suna/preview-doryuuheki.html');
