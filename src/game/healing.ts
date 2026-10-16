import type { Game } from './game';
import type { Unit } from './types';
import { JUTSUS, jutsuChakra, jutsuCooldown, jutsuPower } from '../data/jutsus';
import { chase } from './movement';
import { holdingNatureJutsu } from './natureProjectiles';
import { fxText } from './fx';
const command=(u:Unit)=>JSON.stringify(u.command);
const unavailable=(u:Unit)=>u.dead||u.hidden||u.stun>0||u.away!=null||u.edoIntro!=null;
function stop(g:Game,u:Unit){const h=u.healing;if(!h)return;const p=g.unit(h.targetId);if(p?.treatedBy===u.id)p.treatedBy=undefined;u.healing=undefined;u.healRetry=1.5;if(command(u)===h.command){u.moving=false;u.hasGoal=false;u.path.length=0;}}
function valid(g:Game,u:Unit){const h=u.healing,p=h&&g.unit(h.targetId);return !!h&&!!p&&!unavailable(u)&&!unavailable(p)&&u.faction===p.faction&&command(u)===h.command&&command(p)===h.patientCommand;}
/** IA respeita a aproximação e a pausa voluntária. Ordens novas cancelam imediatamente. */
export function supportBusy(g:Game,u:Unit):boolean{
 if(u.healing){if(!valid(g,u)){stop(g,u);return false;}return true;}
 if(u.treatedBy!=null){const medic=g.unit(u.treatedBy);if(!medic?.healing||medic.healing.targetId!==u.id||!valid(g,medic)){if(medic?.healing)stop(g,medic);u.treatedBy=undefined;return false;}return medic.healing.stage==='treat';}
 return false;
}
export function beginHealing(g:Game,u:Unit):boolean{
 const n=u.ninja;if(!n||u.kind==='clone'||u.attackCd>0||u.arenaSide!=null||unavailable(u)||u.cast||u.dash||u.barrage||u.channel||u.onTower!=null||u.perch!=null||u.healing||u.treatedBy!=null||(u.healRetry??0)>0||u.command||holdingNatureJutsu(g,u))return false;
 for(let slot=0;slot<2;slot++){
  const d=JUTSUS[n.jutsu[slot]??''];if(!d||d.effect!=='heal'||n.cd[slot]!>0||u.chakra<jutsuChakra(d,n.stats))continue;
  let patient:Unit|undefined,ratio=.6;
  for(const p of g.state.units){if(unavailable(p)||p.faction!==u.faction||p.kind==='animal'||p.arenaSide!=null||p.onTower!=null||p.perch!=null||p.channel||holdingNatureJutsu(g,p)||p.healing||p.treatedBy!=null||p.cast||p.dash||p.barrage||p.command?.kind==='retreat'||p.command?.kind==='move')continue;if(Math.hypot(p.x-u.x,p.y-u.y)>d.range)continue;if(p.hp/p.maxHp<ratio){patient=p;ratio=p.hp/p.maxHp;}}
  if(!patient)continue;
  u.healing={targetId:patient.id,slot,stage:'approach',t:0,total:0,given:0,command:command(u),patientCommand:command(patient),hp:u.hp,patientHp:patient.hp,x:u.x,y:u.y,patientX:patient.x,patientY:patient.y};patient.treatedBy=u.id;return true;
 }return false;
}
export function healingTick(g:Game,u:Unit,dt:number){
 const h=u.healing;if(!h)return;if(!valid(g,u)){stop(g,u);return;}const p=g.unit(h.targetId)!;
 if(u.hp<h.hp-.01||p.hp<h.patientHp-.01){stop(g,u);return;}
 h.hp=u.hp;h.patientHp=p.hp;h.t+=dt;
 if(h.stage==='approach'){
  if(h.t>5||p.hp>=p.maxHp||Math.hypot(p.x-u.x,p.y-u.y)>160){stop(g,u);return;}
  const self=p===u,d=Math.hypot(p.x-u.x,p.y-u.y);
  // Posição física próxima, com percurso real. Não iniciar através de paredes.
  const samples=8;let clear=true;for(let i=1;i<samples;i++)if(!g.world.clearPx(u.x+(p.x-u.x)*i/samples,u.y+(p.y-u.y)*i/samples))clear=false;
  if(!self&&(d>22||!clear)){chase(g,u,p.x,p.y,dt,18);return;}
  const n=u.ninja!,def=JUTSUS[n.jutsu[h.slot]??''];if(!def||def.effect!=='heal'||n.cd[h.slot]!>0||u.chakra<jutsuChakra(def,n.stats)){stop(g,u);return;}
  u.chakra-=jutsuChakra(def,n.stats);n.cd[h.slot]=jutsuCooldown(def,n.stats);u.attackCd=.7;
  h.stage='treat';h.t=0;h.total=Math.round(jutsuPower(def,n.stats));h.x=u.x;h.y=u.y;h.patientX=p.x;h.patientY=p.y;
  fxText(g,u.x,u.y-30,def.shout,def.color,true);
 }
 if(h.stage==='treat'){
  if(Math.hypot(u.x-h.x,u.y-h.y)>2||Math.hypot(p.x-h.patientX,p.y-h.patientY)>2||Math.hypot(p.x-u.x,p.y-u.y)>25){stop(g,u);return;}
  u.moving=false;p.moving=false;u.facing=p===u?u.facing:Math.atan2(p.y-u.y,p.x-u.x);u.anim=.2;u.animKind='release';
  const expected=h.total*Math.min(1,h.t),add=Math.max(0,Math.min(expected-h.given,p.maxHp-p.hp));p.hp+=add;h.given=expected;h.patientHp=p.hp;
  if(h.t>=1||p.hp>=p.maxHp){fxText(g,p.x,p.y-18,`+${Math.round(Math.min(h.total,h.total*h.t))}`,JUTSUS.shousen!.color);h.stage='ending';h.t=0;if(p.treatedBy===u.id)p.treatedBy=undefined;}
 }else if(h.stage==='ending'){u.moving=false;u.anim=.2;u.animKind='release';if(h.t>=.2)stop(g,u);}
}