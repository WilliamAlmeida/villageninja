// Repete disparos reais nas oito direções e em três distâncias; relatório para ajuste de arte.
import { JUTSU_LIST } from '../src/data/jutsus';
import { FX } from '../src/data/jutsuFx';
import { castJutsu } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { PROJECTILE_DEBUG, TARGET_BODY } from '../src/game/projectileCollision';
import { projectileSystem } from '../src/game/systems/projectiles';
import { techniqueSystem } from '../src/game/systems/techniques';
import { CENTER_TX, CENTER_TY } from '../src/game/world';
const rows:{name:string;cases:number;hits:number;maxError:number;initialOverlaps:number}[]=[];
PROJECTILE_DEBUG.enabled=true;
try {
 for(const def of JUTSU_LIST.filter(d=>(d.effect==='projectile'||d.effect==='multi')&&FX.jutsus[d.id]?.sprite)) {
  let cases=0,hits=0,maxError=0,initialOverlaps=0;
  for(const distance of [40,100,160])for(let direction=0;direction<8;direction++){
   const g=createNewGame([],3189),x=(CENTER_TX+6)*32,y=(CENTER_TY+6)*32;
   g.state.pace='fast';
   const a=direction*Math.PI/4,d=Math.min(distance,def.range*.9);
   const n=createNinja(g,x,y,'jounin',0),target=createRogue(g,x+Math.cos(a)*d,y+Math.sin(a)*d,1);
   const st=n.ninja!.stats;for(const k of Object.keys(st) as (keyof typeof st)[])st[k]=8;
   n.ninja!.jutsu=[def.id,null];n.chakra=n.maxChakra=1000;target.hp=target.maxHp=100000;
   PROJECTILE_DEBUG.hits.length=0;castJutsu(g,n,0,target);
   for(let t=0;t<4&&g.state.projectiles.some(p=>!p.dead);t+=1/60){techniqueSystem(g,1/60);projectileSystem(g,1/60)}
   cases++;const hit=PROJECTILE_DEBUG.hits[0];
   if(hit){hits++;const dx=(hit.point.x-hit.target.x)/(TARGET_BODY.x+hit.radius),dy=(hit.point.y-hit.target.y)/(TARGET_BODY.y+hit.radius);
    const distance=Math.sqrt(dx*dx+dy*dy);if(distance<.999999)initialOverlaps++;maxError=Math.max(maxError,Math.max(0,distance-1));}
  }
  rows.push({name:def.name,cases,hits,maxError,initialOverlaps});
 }
}finally{PROJECTILE_DEBUG.enabled=false;PROJECTILE_DEBUG.hits.length=0}
const markdown='# Auditoria de contato dos projéteis\n\nDisparos reais: oito direções × três distâncias (limitadas ao alcance de cada jutsu), passo de 1/60 s. O erro mede a separação fora do corpo na primeira colisão elegível; zero significa contato ou interseção. A última coluna conta os casos já intersectados no início do passo elegível (artes grandes perto do alvo ou mergulho do dragão). Não é aprovação visual.\n\n| Jutsu | Casos | Com contato | Maior separação | Já intersectado |\n|---|---:|---:|---:|---:|\n'+rows.map(r=>'| '+r.name+' | '+r.cases+' | '+r.hits+' | '+r.maxError.toFixed(6)+' | '+r.initialOverlaps+' |').join('\n')+'\n\nReproduzir: powershell -File scripts/audit-projectile-contacts.ps1 e bun scripts/audit-jutsu-projectiles.ts. No laboratório, conferir com Diagnóstico de contato e Pausar no contato; ajustar o marcador Contato na peça Principal / projétil.\n';
await Bun.write('docs/auditoria-projeteis.md',markdown);
console.log(rows.map(r=>r.name+': '+r.hits+'/'+r.cases+' contatos; erro '+r.maxError.toFixed(6)).join('\n'));
