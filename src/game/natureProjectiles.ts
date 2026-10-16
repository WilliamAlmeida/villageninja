// Formação e voo compartilham o mesmo estado com o render; dano só no contato físico.
import type { Game } from './game';
import type { NatureFlight, Projectile, Unit } from './types';
import type { JutsuDef } from '../data/jutsus';
import { spawnProjectile } from './combat';
import { fx } from './fx';
import { FX } from '../data/jutsuFx';
import { unproject, projectAngle } from '../core/iso';

export function naturePoint(f: NatureFlight, progress: number) {
  const k=Math.max(0,Math.min(1,progress)), q=1-k;
  const dx=f.tx-f.sx,dy=f.ty-f.sy,d=Math.hypot(dx,dy)||1;
  const nx=-dy/d,ny=dx/d;
  // Curva quadrática: o feixe permanece entre origem e destino e converge na ponta.
  const cx=(f.sx+f.tx)/2+nx*f.bend,cy=(f.sy+f.ty)/2+ny*f.bend;
  return { x:q*q*f.sx+2*q*k*cx+k*k*f.tx, y:q*q*f.sy+2*q*k*cy+k*k*f.ty,
    vx:2*q*(cx-f.sx)+2*k*(f.tx-cx), vy:2*q*(cy-f.sy)+2*k*(f.ty-cy) };
}

/** Ponto de emissão na frente das mãos, em pixels de cena, convertido de volta para a simulação. */
export function reizaSource(u: Unit) {
  const s=FX.jutsus.reiza?.origin, a=projectAngle(u.facing);
  const forward=s?.forward??14,side=s?.side??0;
  const offset=unproject(Math.cos(a)*forward-Math.sin(a)*side+(s?.dx??0)+((s?.mouthX??.5)-(s?.anchorX??.5))*(s?.size??48),
    Math.sin(a)*forward+Math.cos(a)*side+(s?.dy??-10)+8+((s?.mouthY??.5)-(s?.anchorY??.5))*(s?.size??48));
  return {x:u.x+offset.x,y:u.y+offset.y};
}

export function holdingNatureJutsu(g: Game,u: Unit) {
  return g.state.projectiles.some(p=>!p.dead&&p.ownerId===u.id&&p.natureFlight&&
    (p.natureFlight.elapsed<p.natureFlight.delay||p.fx==='reiza'));
}

export function releaseNatureJutsu(g: Game,u: Unit,d: JutsuDef,target: Unit,power: number): boolean {
  if(!['sensatsu','reiza','kajosatsu'].includes(d.id))return false;
  u.moving=false;u.hasGoal=false;
  const heat=d.id==='kajosatsu',storm=d.id==='reiza';
  const count=Math.max(1,Math.min(16,Math.round(heat?(FX.jutsus.kajosatsu?.proj?.count??3):(d.count??4))));
  const speed=d.projSpeed??(heat?250:320);
  for(let i=0;i<count;i++){
    const a=i*Math.PI*2/count;
    const source=storm?reizaSource(u):heat?{x:u.x+Math.cos(a)*35,y:u.y+Math.sin(a)*35-4}:
      {x:target.x+Math.cos(a)*48,y:target.y+Math.sin(a)*48-4};
    const p=spawnProjectile(g,u,u.faction,source.x,source.y,target.x,target.y-4,{
      damage:heat?power/count:power,radius:heat?(d.radius??70):0,nature:d.nature,
      color:storm?'#bfefff':heat?'#ff887b':d.color,size:d.projSize??4,speed,
      kind:d.projKind??'orb',stun:d.stun??0,range:d.range,vfx:storm?'storm':heat?'heat':'ice',fx:d.id,
    });
    const delay=storm?.35:heat?1.05+i*.08:.6;
    const bend=storm?(i-(count-1)/2)*32:0;
    const distance=Math.hypot(target.x-source.x,target.y-4-source.y);
    p.natureFlight={elapsed:0,delay,duration:Math.max(.2,(distance+Math.abs(bend)*.35)/speed),
      sx:source.x,sy:source.y,tx:target.x,ty:target.y-4,bend,index:i,count,targetId:target.id,launched:false,range:d.range};
    p.life=delay+p.natureFlight.duration+.2;
    const v=naturePoint(p.natureFlight,0);p.vx=v.vx/p.natureFlight.duration;p.vy=v.vy/p.natureFlight.duration;
  }
  if(storm){const s=FX.jutsus.reiza?.origin;
    fx(g,'jutsuOrigin',u.x,u.y,{uid:u.id,facing:u.facing,fx:'reiza',life:s?.life??1,color:'#bfefff'});
  }
  return true;
}

/** false: ainda está formando, ou foi cancelado; nenhuma colisão/dano durante a formação. */
export function advanceNatureProjectile(g: Game,p: Projectile,dt: number): boolean {
  const f=p.natureFlight!;f.elapsed+=dt;
  const owner=g.unit(p.ownerId),target=g.unit(f.targetId);
  const storm=p.fx==='reiza',heat=p.fx==='kajosatsu';
  if(!f.launched&&(!owner||owner.dead||owner.hidden||owner.stun>0||!target||target.dead||target.hidden)||
    storm&&(!owner||owner.dead||owner.hidden||owner.stun>0)) {p.dead=true;return false;}
  if(f.elapsed<f.delay){
    if(owner){owner.anim=.2;owner.animKind='release';owner.moving=false;owner.hasGoal=false;}
    if(heat&&owner){const a=f.elapsed*3+f.index*Math.PI*2/f.count;
      p.x=owner.x+Math.cos(a)*35;p.y=owner.y+Math.sin(a)*35-4;
    }else if(storm&&owner){const s=reizaSource(owner);p.x=s.x;p.y=s.y;}
    return false;
  }
  if(!f.launched){f.launched=true;f.sx=p.x;f.sy=p.y;}
  // Reiza acompanha o alvo durante a emissão; as outras técnicas convergem no ponto escolhido.
  if(storm&&target&&!target.dead&&!target.hidden){
    if(owner){owner.anim=.2;owner.animKind='release';owner.moving=false;owner.hasGoal=false;
      owner.facing=Math.atan2(target.y-owner.y,target.x-owner.x);}
    const source=owner?reizaSource(owner):{x:f.sx,y:f.sy};
    f.sx=source.x;f.sy=source.y;
    if(Math.hypot(target.x-f.sx,target.y-f.sy)>f.range*1.4){p.dead=true;return false;}
    f.tx=target.x;f.ty=target.y-4;
  }
  const k=Math.min(1,(f.elapsed-f.delay)/f.duration),pos=naturePoint(f,k);
  p.x=pos.x;p.y=pos.y;p.vx=pos.vx/f.duration;p.vy=pos.vy/f.duration;p.tx=f.tx;p.ty=f.ty;
  return true;
}
