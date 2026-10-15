import { describe, expect, test } from 'bun:test';
import { project, unproject } from '../src/core/iso';
import { SAVE_VERSION } from '../src/config';
import { FX, formatFx } from '../src/data/jutsuFx';
import { castJutsu, spawnProjectile } from '../src/game/combat';
import { createNinja, createRogue } from '../src/game/entities';
import { createNewGame } from '../src/game/newGame';
import { migrate } from '../src/game/save';
import { PROJECTILE_DEBUG, projectileContact, segmentEllipseHit, spriteContact, targetBody, TARGET_BODY } from '../src/game/projectileCollision';
import { techniqueSystem } from '../src/game/systems/techniques';
import { projectileSystem } from '../src/game/systems/projectiles';
import { SYSTEMS } from '../src/game/systems';
import { CENTER_TX, CENTER_TY } from '../src/game/world';
function setup(id='yokai',dx=75,dy=0) {
 const g=createNewGame(SYSTEMS,7128);g.state.pace='fast';
 const x=(CENTER_TX+6)*32,y=(CENTER_TY+6)*32;
 const n=createNinja(g,x,y,'jounin',0),target=createRogue(g,x+dx,y+dy,1);
 const st=n.ninja!.stats;for(const k of Object.keys(st) as (keyof typeof st)[])st[k]=8;
 n.ninja!.jutsu=[id,null];n.chakra=n.maxChakra=400;target.hp=target.maxHp=10000;
 return {g,n,target};
}
describe('contato visual dos projéteis',()=>{
 test('contato varrido não atravessa alvo e não depende da ordem das unidades',()=>{
  const {g,n,target}=setup();const near=createRogue(g,n.x+40,n.y,1);near.hp=near.maxHp=10000;
  castJutsu(g,n,0,target);PROJECTILE_DEBUG.enabled=true;PROJECTILE_DEBUG.hits.length=0;
  try{projectileSystem(g,.5);expect(PROJECTILE_DEBUG.hits).toHaveLength(1);
   expect(PROJECTILE_DEBUG.hits[0]!.target).toEqual(targetBody(near));
   const h=PROJECTILE_DEBUG.hits[0]!,dx=(h.point.x-h.target.x)/(TARGET_BODY.x+h.radius),dy=(h.point.y-h.target.y)/(TARGET_BODY.y+h.radius);
   expect(dx*dx+dy*dy).toBeCloseTo(1,5);
  }finally{PROJECTILE_DEBUG.enabled=false;PROJECTILE_DEBUG.hits.length=0}
 });
 test('Yōkai não explode na caixa antiga antes da frente tocar o corpo',()=>{
  const {g,n,target}=setup();castJutsu(g,n,0,target);const p=g.state.projectiles[0]!;
  p.x=target.x-17;p.y=target.y-6;p.vx=200;p.vy=0;
  projectileSystem(g,0);expect(p.dead).not.toBe(true);expect(target.hp).toBe(10000);
  projectileSystem(g,.06);expect(p.dead).toBe(true);expect(target.hp).toBeLessThan(10000);
  const e=g.state.effects.find(e=>e.kind==='burst'&&e.fx==='yokai')!;
  expect(e.x).toBe(target.x);expect(e.y).toBe(target.y);
 });
 test('a ponta toca o alvo nas oito direções, inclusive em passos grandes',()=>{
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const {g,n,target}=setup('shinkuuha',Math.cos(a)*75,Math.sin(a)*75);
   spawnProjectile(g,n,n.faction,n.x,n.y-4,target.x,target.y,{damage:10,radius:0,nature:'fuuton',color:'#fff',size:5,speed:340,kind:'blade',stun:0,range:160,fx:'shinkuuha'});
   projectileSystem(g,.4);expect(target.hp).toBeLessThan(10000);
  }
 });
 test('ponto de contato acompanha tamanho, âncora, giro, espelho e deslocamento',()=>{
  const {g,n,target}=setup('shinkuuha');castJutsu(g,n,0,target);const p=g.state.projectiles[0]!,s=FX.jutsus.shinkuuha!.sprite!;
  const old={...s};try{
   Object.assign(s,{anchorX:.5,anchorY:.5,hitX:.8,hitY:.6,size:40,dy:3,dx:2,forward:5,side:4});
   p.vx=1;p.vy=-1;const xy=project(p.x,p.y),c=projectileContact(p);
   expect(c.x).toBeCloseTo(xy.x+12+2+5);expect(c.y).toBeCloseTo(xy.y-8+4+3+4);
   p.vx=-1;p.vy=1;const left=projectileContact(p);
   expect(left.x).toBeCloseTo(xy.x-12+2-5);expect(left.y).toBeCloseTo(xy.y-8+4+3-4);
  }finally{for(const k of Object.keys(s))delete (s as unknown as Record<string,unknown>)[k];Object.assign(s,old)}
 });
 test('geometria rejeita passagem afastada e aceita contato parado dentro',()=>{
  expect(segmentEllipseHit({x:-20,y:20},{x:20,y:20},{x:0,y:0},7,10)).toBeNull();
  expect(segmentEllipseHit({x:0,y:0},{x:0,y:0},{x:0,y:0},7,10)).toBe(0);
  expect(spriteContact(FX.jutsus.yokai!.sprite!).x).toBeGreaterThan(.7);
 });
 test('save v44 migra e preserva sequência/canhão e ajustes do laboratório',()=>{
  const {g,n,target}=setup('sekizo');castJutsu(g,n,0,target);
  const raw=JSON.parse(JSON.stringify(g.state));raw.version=44;const saved=migrate(raw)!;
  expect(saved.version).toBe(SAVE_VERSION);expect(saved.units.find(u=>u.id===n.id)!.barrage).toEqual(n.barrage);
  expect(saved.projectiles[0]!.cannon).toEqual(g.state.projectiles[0]!.cannon);
  expect(JSON.parse(formatFx(FX))).toEqual(JSON.parse(JSON.stringify(FX)));
 });
});
describe('Sekizō: cinco socos de ar sucessivos',()=>{
 test('dispara em sequência acelerada dirigida ao alvo, sem leque ou coluna vertical',()=>{
  const {g,n,target}=setup('sekizo');castJutsu(g,n,0,target);expect(g.state.projectiles).toHaveLength(1);
  for(const [dt,count]of [[.301,2],[.24,3],[.18,4],[.12,5]]){techniqueSystem(g,dt!);expect(g.state.projectiles).toHaveLength(count!)}
  expect(n.barrage).toBeUndefined();expect(FX.jutsus.sekizo!.impact).toBeUndefined();
  let speed=0;for(const p of g.state.projectiles){expect(p.tx).toBe(target.x);expect(p.ty).toBe(target.y);
   expect(p.cannon).toBeDefined();const next=Math.hypot(p.vx,p.vy);expect(next).toBeGreaterThan(speed);speed=next;}
  expect(new Set(g.state.projectiles.map(p=>p.cannon!.sx+','+p.cannon!.sy)).size).toBeGreaterThan(1);
  for(const p of g.state.projectiles){p.x=target.x;p.y=target.y-6;p.vx=p.vy=0;const c=projectileContact(p),body=targetBody(target),d=unproject(body.x-c.x,body.y-c.y);p.x+=d.x;p.y+=d.y}
  projectileSystem(g,0);expect(g.state.effects.filter(e=>e.kind==='pressure')).toHaveLength(5);
  expect(g.state.effects.some(e=>e.fx==='sekizo'&&e.life===.5)).toBe(false);
 });
 for(const reason of ['stun','dead','target','ally'] as const)test('interrompe sequência: '+reason,()=>{
  const {g,n,target}=setup('sekizo');castJutsu(g,n,0,target);
  if(reason==='stun')n.stun=1;else if(reason==='dead')n.dead=true;else if(reason==='target')target.dead=true;else target.faction=n.faction;
  techniqueSystem(g,.8);expect(n.barrage).toBeUndefined();expect(g.state.projectiles).toHaveLength(1);
 });
});
