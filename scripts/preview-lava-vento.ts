// Prévia autocontida do lote novo e do alinhamento do Nagashi; não abre navegador.
import { drawPressureTube } from '../src/render/pressureCannon';
import { FX, type SpriteFx } from '../src/data/jutsuFx';
const entries: Record<string, { label: string; sprite: SpriteFx; loop?: boolean }> = {
  yokai: { label: 'Yōkai — lava', sprite: FX.jutsus.yokai!.sprite!, loop: true },
  yokaiImpact: { label: 'Yōkai — impacto', sprite: FX.jutsus.yokai!.impact! },
  daitoppa: { label: 'Daitoppa — rajada', sprite: FX.jutsus.daitoppa!.gust! },
  shinkuuha: { label: 'Shinkuu Ha — lâmina', sprite: FX.jutsus.shinkuuha!.sprite!, loop: true },
  nagashi: { label: 'Nagashi — registro Y corrigido', sprite: FX.jutsus.chidorinagashi!.impact! },
};
const urls = Object.fromEntries(await Promise.all(Object.entries(entries).map(async ([id, e]) => [
  id, 'data:image/png;base64,' + Buffer.from(await Bun.file('src/art/effects/' + e.sprite.sheet + '.png').arrayBuffer()).toString('base64'),
])));
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Lava e vento — sprites</title>
<style>body{margin:2rem;background:#202a25;color:#eee;font:16px system-ui}p{max-width:70rem}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;max-width:1200px}article{background:#2a362f;padding:1rem;border-radius:8px}canvas{width:100%;background:#899469;image-rendering:pixelated}button,label{margin:.6rem}a{color:#a4dfff}</style>
<h1>Yōkai · Daitoppa · Shinkuu Ha · Sekizō</h1><p>Lote integrado para avaliação. O Sekizō executa cinco socos sucessivos; cada soco lança um canhão de ar na direção do alvo. Use o quadro manual para conferir as oito fases. No Nagashi, o marcador representa o espaço do ninja, com pés na linha fixa.</p>
<button id="pause">Pausar</button><button id="restart">Reiniciar</button><button id="turn">Girar vento e projéteis</button><label>Quadro manual <input id="frame" type="range" min="0" max="7" step="1" value="0"></label><span id="label"></span>
<div class="cards">${Object.entries(entries).map(([id,e])=>'<article><h2>'+e.label+'</h2><canvas id="'+id+'" width="520" height="400"></canvas></article>').join('')}<article><h2>Sekizō — cinco canhões de ar</h2><canvas id="sekizo" width="520" height="400"></canvas></article></div>
<script>
const FX=${JSON.stringify({jutsus:{sekizo:{cannon:FX.jutsus.sekizo!.cannon}}})};
${drawPressureTube.toString()}
const entries=${JSON.stringify(entries)},urls=${JSON.stringify(urls)};
const images=Object.fromEntries(Object.entries(urls).map(([id,url])=>{const img=new Image();img.src=url;return[id,img]}));
let t=0,last=performance.now(),paused=false,manual=null,angle=0;const button=document.querySelector('#pause');
button.onclick=()=>{paused=!paused;manual=null;button.textContent=paused?'Continuar':'Pausar'};
document.querySelector('#restart').onclick=()=>{t=0;manual=null;paused=false;button.textContent='Pausar'};
document.querySelector('#turn').onclick=()=>{angle+=Math.PI/4};
document.querySelector('#frame').oninput=e=>{manual=+e.target.value;paused=true;button.textContent='Continuar'};
function marker(ctx,x,y){ctx.fillStyle='#263747';ctx.fillRect(x-5,y-23,10,16);ctx.fillRect(x-7,y-8,5,8);ctx.fillRect(x+2,y-8,5,8);ctx.fillStyle='#dbbb9b';ctx.fillRect(x-4,y-32,8,8)}
function tick(now){if(!paused)t+=(now-last)/1000;last=now;
for(const [id,e]of Object.entries(entries)){const ctx=document.querySelector('#'+id).getContext('2d'),s=e.sprite,img=images[id];ctx.clearRect(0,0,520,400);ctx.save();ctx.scale(2,2);ctx.imageSmoothingEnabled=false;
const age=t%1.6,frame=manual??(e.loop?Math.floor(t*s.fps)%8:Math.min(7,Math.floor(age*s.fps)));
ctx.strokeStyle='#46583a';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(10,159);ctx.lineTo(250,159);ctx.stroke();ctx.setLineDash([]);
if(id==='nagashi')marker(ctx,130,159);
if(img.complete&&img.naturalWidth&&(manual!==null||e.loop||age<8/s.fps)){
const x=id==='daitoppa'?80:130,y=id==='nagashi'?150:e.loop||id==='daitoppa'?100:159,w=s.size,h=w*(img.height/s.rows)/(img.width/s.cols),cw=img.width/s.cols,ch=img.height/s.rows;
ctx.translate(x+(s.dx??0)+Math.cos(angle)*(s.forward??0)-Math.sin(angle)*(s.side??0),y+s.dy+Math.sin(angle)*(s.forward??0)+Math.cos(angle)*(s.side??0));if(s.rotate){ctx.rotate(angle);if(s.flip&&Math.cos(angle)<0)ctx.scale(1,-1)}
ctx.globalAlpha=s.opacity;ctx.drawImage(img,frame%s.cols*cw,Math.floor(frame/s.cols)*ch,cw,ch,-w*s.anchorX,-h*s.anchorY,w,h);
}ctx.restore()}
const pressure=document.querySelector('#sekizo').getContext('2d');pressure.clearRect(0,0,520,400);pressure.save();pressure.scale(2,2);marker(pressure,35,130);marker(pressure,220,130);const age=t%1.8;for(const [i,start]of [0,.30,.54,.72,.84].entries()){const a=manual!==null?(manual/7)*.25:age-start;if(a>=0&&a<.25)drawPressureTube(pressure,40,106,40+180*Math.min(1,a/.14),106,i,1-a/.25)}pressure.restore();
document.querySelector('#label').textContent=manual===null?'Animação automática':'Quadro '+(manual+1)+'/8';requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>`;
await Bun.write('docs/arte/jutsus/lava-vento/preview.html', html);
console.log('docs/arte/jutsus/lava-vento/preview.html');
